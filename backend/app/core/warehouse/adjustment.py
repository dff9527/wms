from datetime import datetime
from typing import Optional

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.inventory import InventoryLot, InventoryTransaction  # type: ignore


class AdjustmentService:
    def __init__(self, db: Session):
        self.db = db

    def adjust_quantity(
        self,
        lot_id: int,
        quantity_change: int,
        executed_by: str,
        reason: str = "Manual Adjustment",
        device_id: Optional[str] = None,
    ) -> dict:
        """
        Adjusts quantity of a specific lot.
        Positive change = Add stock (RECEIVE/ADJUST IN)
        Negative change = Remove stock (SCRAP/ADJUST OUT)
        """
        lot = self.db.query(InventoryLot).filter(InventoryLot.lot_id == lot_id).with_for_update(of=InventoryLot).first()
        if not lot:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Lot not found")

        new_qty = lot.quantity_on_hand + quantity_change
        
        if new_qty < 0:
            raise HTTPException(
                status.HTTP_400_BAD_REQUEST, 
                f"Insufficient quantity. Current: {lot.quantity_on_hand}, Requested Change: {quantity_change}"
            )

        old_qty = lot.quantity_on_hand
        lot.quantity_on_hand = new_qty
        lot.updated_at = datetime.utcnow()

        # Determine transaction type based on sign
        tx_type = "ADJUST"
        notes = reason

        transaction = InventoryTransaction(
            transaction_type=tx_type,
            lot_id=lot_id,
            quantity_change=quantity_change,
            quantity_before=old_qty,
            quantity_after=new_qty,
            reference_type="ADJUSTMENT",
            executed_by=executed_by,
            device_id=device_id,
            notes=notes,
            created_at=datetime.utcnow(),
        )
        
        self.db.add(transaction)
        
        try:
            self.db.commit()
            self.db.refresh(lot)
        except Exception as e:
            self.db.rollback()
            raise HTTPException(status.HTTP_500_INTERNAL_SERVER_ERROR, str(e))
            
        return {"success": True, "newQuantity": new_qty}

    def split_lot(
        self,
        parent_lot_id: int,
        quantity_to_split: int,
        executed_by: str,
        device_id: Optional[str] = None,
    ) -> dict:
        """
        Splits a portion of a lot into a new child lot.
        Parent retains remaining qty. Child gets the split qty.
        Child inherits all attributes from Parent except ID/Barcode/LotNumber.
        Sets parent_lot_id on Child.
        """
        parent_lot = self.db.query(InventoryLot).filter(InventoryLot.lot_id == parent_lot_id).with_for_update(of=InventoryLot).first()
        if not parent_lot:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Parent Lot not found")

        if quantity_to_split <= 0 or quantity_to_split >= parent_lot.quantity_on_hand:
             # Cannot split entire lot (that's just moving/receiving), must be partial
             # Or handle full split as a move? Spec says "split_from_transaction_id".
             # Usually split implies creating a new container for part of the stock.
             raise HTTPException(
                 status.HTTP_400_BAD_REQUEST, 
                 "Split quantity must be greater than 0 and less than current on-hand."
             )

        import uuid
        
        # Create Child Lot
        internal_barcode = f"INT-{uuid.uuid4().hex[:12].upper()}"
        internal_lot_number = f"SPLIT-{datetime.now().strftime('%Y%m%d%H%M%S')}-{uuid.uuid4().hex[:6].upper()}"
        
        child_lot = InventoryLot(
            internal_sku=parent_lot.internal_sku,
            internal_barcode=internal_barcode,
            internal_lot_number=internal_lot_number,
            vendor_id=parent_lot.vendor_id,
            vendor_pn=parent_lot.vendor_pn,
            vendor_lot_code=parent_lot.vendor_lot_code,
            original_barcode=parent_lot.original_barcode,
            quantity_on_hand=quantity_to_split,
            quantity_reserved=0,
            unit=parent_lot.unit,
            location_id=parent_lot.location_id, # Inherits location initially
            manufacture_date=parent_lot.manufacture_date,
            receive_date=parent_lot.receive_date,
            expiry_date=parent_lot.expiry_date,
            lot_status=parent_lot.lot_status,
            iqc_result=parent_lot.iqc_result,
            iqc_date=parent_lot.iqc_date,
            iqc_inspector=parent_lot.iqc_inspector,
            quality_notes=f"Split from {parent_lot.internal_lot_number}",
            parent_lot_id=parent_lot.lot_id,
            raw_scan_data=parent_lot.raw_scan_data,
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow(),
        )

        self.db.add(child_lot)
        self.db.flush() # Get child ID

        # Update Parent Lot Quantity
        old_parent_qty = parent_lot.quantity_on_hand
        new_parent_qty = old_parent_qty - quantity_to_split
        parent_lot.quantity_on_hand = new_parent_qty
        parent_lot.updated_at = datetime.utcnow()

        # Write Transactions
        
        # 1. SPLIT transaction for the Child (Positive change into existence)
        split_tx_child = InventoryTransaction(
            transaction_type="SPLIT",
            lot_id=child_lot.lot_id,
            quantity_change=quantity_to_split,
            quantity_before=0,
            quantity_after=quantity_to_split,
            reference_type="ADJUSTMENT",
            executed_by=executed_by,
            device_id=device_id,
            notes=f"Split from {parent_lot.internal_lot_number}",
            created_at=datetime.utcnow(),
        )
        
        # 2. ADJUST/SPLIT transaction for the Parent (Negative change)
        # Spec says "writes ADJUST / SPLIT transactions". 
        # We'll use SPLIT type for both sides to link them logically if needed, 
        # or ADJUST for the reduction. Let's use SPLIT for consistency in audit trail of splits.
        split_tx_parent = InventoryTransaction(
            transaction_type="SPLIT",
            lot_id=parent_lot.lot_id,
            quantity_change=-quantity_to_split,
            quantity_before=old_parent_qty,
            quantity_after=new_parent_qty,
            reference_type="ADJUSTMENT",
            executed_by=executed_by,
            device_id=device_id,
            notes=f"Split off {quantity_to_split} units to {child_lot.internal_lot_number}",
            created_at=datetime.utcnow(),
        )

        self.db.add(split_tx_child)
        self.db.add(split_tx_parent)

        try:
            self.db.commit()
            self.db.refresh(child_lot)
            self.db.refresh(parent_lot)
        except Exception as e:
            self.db.rollback()
            raise HTTPException(status.HTTP_500_INTERNAL_SERVER_ERROR, str(e))

        return {
            "success": True,
            "newLotId": child_lot.lot_id,
            "newInternalBarcode": child_lot.internal_barcode,
            "remainingParentQty": new_parent_qty,
        }

