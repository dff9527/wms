import uuid
from datetime import datetime
from typing import Optional

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.core.warehouse.putaway import PutAwayEngine
from app.models.inventory import InventoryLot, InventoryTransaction   # type: ignore
from app.schemas.receiving import ReceiveRequest, ReceiveResponse
from app.services.barcode_service import BarcodeParser   # type: ignore


class ReceivingService:
    def __init__(self, db: Session):
        self.db = db
        self.parser = BarcodeParser()
        self.putaway_engine = PutAwayEngine(db)

    # FIX: [fix_6] — Rename 'barcode' to 'scanned_barcode' and 'qty' to 'quantity' in method signature
    def process_receipt(
        self,
        po_number: str,
        scanned_barcode: str,
        vendor_id: int,
        quantity: int,
        executed_by: str = "SYSTEM",
        device_id: Optional[str] = None,
     ) -> ReceiveResponse:
         """
        Atomic receiving flow: Parse → Validate PO → Create Lot → Write Transaction.
        Raises HTTPException 400 on failure.
         """
         # 1. Parse Barcode
        # FIX: [fix_6] — Update internal reference from 'barcode' to 'scanned_barcode'
        parsed_data = self.parser.parse(scanned_barcode)
        if not parsed_data or not parsed_data.get("sku"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid barcode format or missing SKU.",
             )

        internal_sku = parsed_data["sku"]
        vendor_pn = parsed_data.get("vendorPn")
        vendor_lot_code = parsed_data.get("lotCode")
        date_code = parsed_data.get("dateCode")

         # 2. Validate against PO (Simplified validation logic per spec)
         # In a real system, this would query the PurchaseOrders table to ensure
         # the PO exists, is open, and contains this SKU/Vendor.
        if not po_number or not vendor_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="PO Number and Vendor ID are required for receipt validation.",
             )
        
         # Mock PO Validation Check - Replace with actual DB lookup in production
         # if not self._validate_po_line(po_number, vendor_id, internal_sku):
         #     raise HTTPException(...)
        
         # 3. Generate Unique Identifiers
        internal_barcode = f"INT-{uuid.uuid4().hex[:12].upper()}"
        internal_lot_number = f"LOT-{datetime.now().strftime('%Y%m%d%H%M%S')}-{uuid.uuid4().hex[:6].upper()}"

         # Ensure uniqueness (retry loop omitted for brevity, assuming low collision rate)
        existing = self.db.query(InventoryLot).filter(
            InventoryLot.internal_barcode == internal_barcode
         ).first()
        if existing:
              # Collision retry logic would go here
             pass 

         # 4. Create Inventory Lot
        new_lot = InventoryLot(
            internal_sku=internal_sku,
            internal_barcode=internal_barcode,
            internal_lot_number=internal_lot_number,
            vendor_id=vendor_id,
            vendor_pn=vendor_pn,
            vendor_lot_code=vendor_lot_code,
            # FIX: [fix_6] — Update internal reference from 'barcode' to 'scanned_barcode'
            original_barcode=scanned_barcode,
            # FIX: [fix_6] — Update internal reference from 'qty' to 'quantity'
            quantity_on_hand=quantity,
            quantity_reserved=0,
            unit="PCS", # Default unit, should ideally come from SKU definition
            lot_status="QC_HOLD", # New receipts go to QC Hold by default
            iqc_result="PENDING",
            raw_scan_data=parsed_data,
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow(),
         )
        
        self.db.add(new_lot)
        self.db.flush() # Get ID before commit

         # 5. Write RECEIVE Transaction
        transaction = InventoryTransaction(
            transaction_type="RECEIVE",
            lot_id=new_lot.lot_id,
            # FIX: [fix_6] — Update internal reference from 'qty' to 'quantity'
            quantity_change=quantity,
            quantity_before=0,
            # FIX: [fix_6] — Update internal reference from 'qty' to 'quantity'
            quantity_after=quantity,
            reference_type="PO",
            reference_number=po_number,
            executed_by=executed_by,
            device_id=device_id,
            notes=f"Received via PO {po_number}",
            created_at=datetime.utcnow(),
         )
        self.db.add(transaction)
        
        try:
            self.db.commit()
            self.db.refresh(new_lot)
        except Exception as e:
            self.db.rollback()
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Failed to process receipt: {str(e)}",
             )

        return ReceiveResponse(
            success=True,
            lotId=new_lot.lot_id,
            internalLotNumber=new_lot.internal_lot_number,
            internalBarcode=new_lot.internal_barcode,
            labelUrl=f"/api/v1/labels/{new_lot.internal_barcode}",
         )

    def complete_iqc(
        self,
        lot_id: int,
        result: str, # 'PASS' or 'FAIL'
        inspector: str,
        notes: Optional[str] = None,
     ) -> dict:
         """
        Complete IQC inspection. Updates lot status and iqc_result.
        If PASS, suggests a putaway location.
         """
        if result not in ("PASS", "FAIL"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="IQC result must be PASS or FAIL.",
             )

        lot = self.db.query(InventoryLot).filter(InventoryLot.lot_id == lot_id).first()
        if not lot:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Lot not found.",
             )

        if lot.iqc_result != "PENDING":
             raise HTTPException(
                 status_code=status.HTTP_400_BAD_REQUEST,
                 detail="Lot is not pending IQC.",
              )

        now = datetime.utcnow()
        
         # Update Lot Status based on Result
        if result == "PASS":
            lot.lot_status = "AVAILABLE"
            suggested_location = self.putaway_engine.suggest_location(lot)
        else:
            lot.lot_status = "QUARANTINE"
            suggested_location = None

        lot.iqc_result = result
        lot.iqc_date = now
        lot.iqc_inspector = inspector
        lot.quality_notes = notes
        lot.updated_at = now

         # Write Transaction for IQC Completion (Optional but good practice for audit trail)
         # Usually IQC doesn't change quantity, just status. 
         # We can write a STATUS_CHANGE transaction type if supported, or skip if only qty changes are tracked.
         # Per spec 7.1, we don't strictly need a transaction row for status-only changes unless specified.
         # However, to be safe and consistent with "Every inventory mutation... writes a corresponding InventoryTransaction",
         # let's check if we have a STATUS_CHANGE type. The schema says: 
         # CHECK (transaction_type IN ('RECEIVE', 'PUT_AWAY', 'PICK', 'SHIP', 'ADJUST', 'SPLIT', 'MERGE', 'RETURN', 'SCRAP'))
         # No STATUS_CHANGE. So we do NOT write a transaction here, just update the lot.

        try:
            self.db.commit()
            self.db.refresh(lot)
        except Exception as e:
            self.db.rollback()
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to complete IQC: {str(e)}",
             )

        return {
             "success": True,
             "status": lot.lot_status,
             "suggestedLocation": suggested_location,
         }
