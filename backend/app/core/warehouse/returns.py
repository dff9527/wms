from uuid import uuid4

from sqlalchemy.orm import Session

from app.models.inventory import InventoryLot, InventoryTransaction
from app.models.returns import ReturnOrder
from app.models.warehouse import StorageLocation


class ReturnService:
    def __init__(self, db: Session):
        self.db = db

    def customer_return(
        self,
        lot_id: int,
        quantity: int,
        reason: str,
        reference: str | None,
        username: str,
    ):
        lot = self._locked_lot(lot_id)
        quarantine = (
            self.db.query(StorageLocation)
            .filter(StorageLocation.is_quarantine.is_(True))
            .order_by(StorageLocation.location_id)
            .first()
        )
        if not quarantine:
            raise ValueError("No quarantine location is configured")
        before = lot.quantity_on_hand
        lot.quantity_on_hand += quantity
        lot.quantity_reserved = min(lot.quantity_reserved, lot.quantity_on_hand)
        lot.location_id = quarantine.location_id
        lot.lot_status = "QUARANTINE"
        lot.iqc_result = "PENDING"
        lot.iqc_date = None
        lot.iqc_inspector = None
        return self._record(
            lot,
            "CUSTOMER_RETURN",
            quantity,
            before,
            quarantine.location_id,
            reason,
            reference,
            username,
            True,
        )

    def supplier_return(
        self,
        lot_id: int,
        quantity: int,
        reason: str,
        reference: str | None,
        username: str,
    ):
        lot = self._locked_lot(lot_id)
        if quantity > lot.quantity_available:
            raise ValueError("Return quantity exceeds available inventory")
        before = lot.quantity_on_hand
        lot.quantity_on_hand -= quantity
        if lot.quantity_on_hand == 0:
            lot.lot_status = "SHIPPED"
        return self._record(
            lot,
            "SUPPLIER_RETURN",
            -quantity,
            before,
            None,
            reason,
            reference,
            username,
            False,
        )

    def _locked_lot(self, lot_id: int) -> InventoryLot:
        lot = (
            self.db.query(InventoryLot)
            .filter(InventoryLot.lot_id == lot_id)
            .with_for_update()
            .first()
        )
        if not lot:
            raise ValueError("Inventory lot not found")
        return lot

    def _record(
        self,
        lot,
        return_type,
        change,
        before,
        destination,
        reason,
        reference,
        username,
        requires_iqc,
    ):
        number = f"RET-{uuid4().hex[:12].upper()}"
        order = ReturnOrder(
            return_number=number,
            return_type=return_type,
            lot_id=lot.lot_id,
            quantity=abs(change),
            reason=reason,
            counterparty_reference=reference,
            created_by=username,
        )
        self.db.add(order)
        self.db.add(
            InventoryTransaction(
                transaction_type="RETURN",
                lot_id=lot.lot_id,
                quantity_change=change,
                quantity_before=before,
                quantity_after=lot.quantity_on_hand,
                from_location_id=lot.location_id if change < 0 else None,
                to_location_id=destination,
                reference_type="RETURN",
                reference_number=number,
                executed_by=username,
                notes=reason,
            )
        )
        self.db.commit()
        self.db.refresh(order)
        return {
            "returnId": order.return_id,
            "returnNumber": number,
            "returnType": return_type,
            "lotId": lot.lot_id,
            "quantity": abs(change),
            "status": order.status,
            "requiresIqc": requires_iqc,
        }
