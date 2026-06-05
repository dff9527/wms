import uuid
from datetime import datetime
from typing import Optional

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.core.warehouse.putaway import PutAwayEngine
from app.models.inventory import InventoryLot, InventoryTransaction    # type: ignore
from app.models.vendor import VendorItem
from app.models.storage import StorageLocation
from app.schemas.receiving import ReceiveRequest, ReceiveResponse
from app.core.barcode.parser import BarcodeParser


class ReceivingService:
    def __init__(self, db: Session):
        self.db = db
        self.parser = BarcodeParser(db)
        self.putaway_engine = PutAwayEngine(db)

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
        # 1. Parse Barcode (parser returns vendor_pn / qty / lot_code / date_code)
        parsed_data = self.parser.parse(scanned_barcode, vendor_id)
        if not parsed_data:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid or unrecognized barcode for this vendor.",
            )

        vendor_pn = parsed_data.get("vendor_pn")
        vendor_lot_code = parsed_data.get("lot_code")
        date_code = parsed_data.get("date_code")

        # Resolve internal SKU from the vendor part number via the AVL (vendor_items)
        mapping = (
            self.db.query(VendorItem)
            .filter(VendorItem.vendor_id == vendor_id, VendorItem.vendor_pn == vendor_pn)
            .first()
        )
        if not mapping or not mapping.internal_sku:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"No AVL mapping for vendor_pn '{vendor_pn}' under vendor {vendor_id}.",
            )
        internal_sku = mapping.internal_sku

        # 2. Validate against PO (simplified per spec; full PO validation is Stage A2)
        if not po_number or not vendor_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="PO Number and Vendor ID are required for receipt validation.",
            )

        # 3. Generate Unique Identifiers
        internal_barcode = f"INT-{uuid.uuid4().hex[:12].upper()}"
        internal_lot_number = f"LOT-{datetime.now().strftime('%Y%m%d%H%M%S')}-{uuid.uuid4().hex[:6].upper()}"

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
            vendor_date_code=date_code,
            original_barcode=scanned_barcode,
            quantity_on_hand=quantity,
            quantity_reserved=0,
            unit="PCS",
            lot_status="QC_HOLD",
            iqc_result="PENDING",
            raw_scan_data=parsed_data,
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow(),
        )

        self.db.add(new_lot)
        self.db.flush()   # Get ID before commit

        # 5. Write RECEIVE Transaction
        transaction = InventoryTransaction(
            transaction_type="RECEIVE",
            lot_id=new_lot.lot_id,
            quantity_change=quantity,
            quantity_before=0,
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
        result: str,   # 'PASS' or 'FAIL'
        inspector: str,
        notes: Optional[str] = None,
    ) -> dict:
        """
        Complete IQC inspection. Updates lot status and iqc_result.
        If PASS, assigns a putaway location and records a PUT_AWAY transaction.

        NOTE: The caller (route layer) is responsible for passing the authenticated
        principal as `inspector`. Do not accept this value from user input directly.
        """
        if result not in ("PASS", "FAIL"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="IQC result must be PASS or FAIL.",
            )

        # inspector must be derived from the authenticated session at the route layer, not from user input
        inspector = inspector.strip()
        if len(inspector) > 100 or not inspector.isprintable():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="inspector must be 100 characters or fewer and contain only printable characters",
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

        # Update lot status based on result
        suggested_location_code = None
        if result == "PASS":
            lot.lot_status = "AVAILABLE"

            # A1: persist the suggested putaway location onto the lot
            suggested_id = self.putaway_engine.suggest_location_id(lot)
            if suggested_id is not None:
                lot.location_id = suggested_id
                put_away_transaction = InventoryTransaction(
                    transaction_type="PUT_AWAY",
                    lot_id=lot.lot_id,
                    quantity_change=0,
                    to_location_id=suggested_id,
                    reference_type="IQC",
                    reference_number=str(lot.lot_id),
                    executed_by=inspector,
                    created_at=now,
                )
                self.db.add(put_away_transaction)

                loc_row = self.db.query(StorageLocation).filter(
                    StorageLocation.location_id == suggested_id
                ).first()
                suggested_location_code = loc_row.location_code if loc_row else None
        else:
            lot.lot_status = "QUARANTINE"

        lot.iqc_result = result
        lot.iqc_date = now
        lot.iqc_inspector = inspector
        lot.quality_notes = notes
        lot.updated_at = now

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
            "suggestedLocation": suggested_location_code,
        }

    # ── read helpers used by the receiving API (list / detail / scan) ──────────
    def scan_barcode(self, barcode: str, vendor_id: int):
        """Parse a barcode without creating any rows. Returns a ParseResult."""
        from app.services.barcode_service import parse_barcode
        result = parse_barcode(self.db, barcode, vendor_id)
        if result is None:
            raise ValueError("Invalid or unrecognized barcode for this vendor.")
        return result

    def _lot_row(self, lot, vendor_name, description, location_code):
        """Flatten a lot + joined fields into an attribute bag the API serializes.
        po_number has no column on inventory_lots (only the RECEIVE transaction
        records it), so it is exposed as None here."""
        from types import SimpleNamespace
        return SimpleNamespace(
            lot_id=lot.lot_id, po_number=None, vendor_name=vendor_name,
            internal_sku=lot.internal_sku, internal_lot_number=lot.internal_lot_number,
            internal_barcode=lot.internal_barcode, vendor_pn=lot.vendor_pn,
            vendor_lot_code=lot.vendor_lot_code, vendor_date_code=lot.vendor_date_code,
            original_barcode=lot.original_barcode, description=description,
            quantity_on_hand=lot.quantity_on_hand, unit=lot.unit, lot_status=lot.lot_status,
            receive_date=lot.receive_date, location_code=location_code,
            iqc_result=lot.iqc_result, iqc_date=lot.iqc_date,
            iqc_inspector=lot.iqc_inspector, quality_notes=lot.quality_notes,
        )

    def _lot_query(self):
        from app.models.item import Item
        from app.models.vendor import Vendor
        from app.models.warehouse import StorageLocation
        return (
            self.db.query(InventoryLot, Vendor.vendor_name, Item.description, StorageLocation.location_code)
            .outerjoin(Vendor, InventoryLot.vendor_id == Vendor.vendor_id)
            .outerjoin(Item, InventoryLot.internal_sku == Item.internal_sku)
            .outerjoin(StorageLocation, InventoryLot.location_id == StorageLocation.location_id)
        )

    def list_pending(self, po_number: Optional[str] = None, status: Optional[str] = None):
        q = self._lot_query()
        if status:
            q = q.filter(InventoryLot.lot_status == status)
        else:
            q = q.filter(InventoryLot.iqc_result == "PENDING")
        return [self._lot_row(lot, vn, desc, loc) for lot, vn, desc, loc in q.all()]

    def get_lot_by_id(self, lot_id: int):
        row = self._lot_query().filter(InventoryLot.lot_id == lot_id).first()
        if not row:
            return None
        lot, vn, desc, loc = row
        return self._lot_row(lot, vn, desc, loc)
