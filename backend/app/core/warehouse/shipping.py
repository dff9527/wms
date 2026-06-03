import datetime
from typing import Dict, List, Optional

from sqlalchemy.orm import Session

from app.models.order import SalesOrder, SOLine, PickTask
from app.models.inventory import InventoryLot
from app.models.transaction import InventoryTransaction


class ShippingService:
    def __init__(self, db: Session):
        self.db = db

    @staticmethod
    def _get_so(db: Session, so_number: str) -> Optional[SalesOrder]:
        return db.query(SalesOrder).filter(SalesOrder.so_number == so_number).first()

    def confirm_shipment(self, so_number: str, shipper: str, shipping_notes: Optional[str] = None) -> Dict:
        so = self._get_so(self.db, so_number)
        if not so:
            raise ValueError(f"Sales Order {so_number} not found")

        lines = (
            self.db.query(SOLine)
            .filter(SOLine.so_id == so.so_id)
            .all()
        )

        # Check if all lines are picked
        for line in lines:
            picked = line.picked_qty or 0
            if picked < line.ordered_qty:
                raise ValueError(f"Line {line.line_number} has insufficient picks ({picked}/{line.ordered_qty})")

        so.status = 'SHIPPED'

        details = []
        # pick tasks for this SO's lines that have been picked
        tasks = (
            self.db.query(PickTask)
            .join(SOLine, PickTask.so_line_id == SOLine.so_line_id)
            .filter(SOLine.so_id == so.so_id, PickTask.status == 'PICKED')
            .all()
        )

        for task in tasks:
            lot = task.lot
            if not lot:
                continue
            # on-hand was already decremented at confirm_pick; this SHIP row records
            # the dispatch in the ledger without double-decrementing.
            txn = InventoryTransaction(
                lot_id=lot.lot_id,
                transaction_type='SHIP',
                quantity_change=-task.pick_qty,
                reference_type='SO',
                reference_number=so_number,
                executed_by=shipper,
            )
            self.db.add(txn)
            task.status = 'CONFIRMED'
            details.append({
                "internalLotNumber": lot.internal_lot_number,
                "qty": task.pick_qty,
                "location": str(lot.location_id) if lot.location_id is not None else None
            })

        for line in lines:
            line.shipped_qty = line.picked_qty or 0

        self.db.commit()
        return {
            "status": "success",
            "message": f"Shipment confirmed for {so_number}",
            "details": details
        }

    def _get_shipment_details(self, so_number: str) -> List[Dict]:
        so = self._get_so(self.db, so_number)
        if not so:
            return []
        tasks = (
            self.db.query(PickTask)
            .join(SOLine, PickTask.so_line_id == SOLine.so_line_id)
            .filter(SOLine.so_id == so.so_id)
            .all()
        )

        def _rkey(t):
            lot = t.lot
            return lot.receive_date if lot and lot.receive_date else datetime.datetime.min

        # FIFO order: earliest receive_date first (proof of first-in-first-out)
        sorted_tasks = sorted(tasks, key=_rkey)

        result = []
        for task in sorted_tasks:
            lot = task.lot
            result.append({
                "internalLotNumber": lot.internal_lot_number if lot else '',
                "internalSku": lot.internal_sku if lot else '',
                "qty": task.pick_qty,
                "location": str(lot.location_id) if lot and lot.location_id is not None else None,
                "receiveDate": lot.receive_date.isoformat()[:10] if lot and lot.receive_date else ''
            })

        return result

    def generate_packing_list(self, so_number: str) -> Dict:
        details = self._get_shipment_details(so_number)
        
        # Group by SKU (internalSku already resolved in _get_shipment_details)
        sku_groups: Dict[str, List[Dict]] = {}
        for detail in details:
            sku = detail.get("internalSku") or 'UNKNOWN'
            sku_groups.setdefault(sku, []).append(detail)

        packing_items = [{"sku": sku, "lots": items} for sku, items in sku_groups.items()]

        return {
            "soNumber": so_number,
            "items": packing_items
        }
