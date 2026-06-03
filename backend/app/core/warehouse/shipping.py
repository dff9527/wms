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
            .filter(SOLine.so_number == so_number)
            .all()
        )

        # Check if all lines are picked
        for line in lines:
            picked = line.picked_qty or 0
            if picked < line.ordered_qty:
                raise ValueError(f"Line {line.line_number} has insufficient picks ({picked}/{line.ordered_qty})")

        # Update SO status
        so.status = 'SHIPPED'
        so.shipped_qty = sum(l.ordered_qty for l in lines) # Assuming full shipment
        
        # Write SHIP transactions and update lots
        details = []
        
        # Get pick tasks to know which lots were used
        tasks = (
            self.db.query(PickTask)
            .filter(
                PickTask.so_number == so_number,
                PickTask.status == 'completed'
            )
            .all()
        )

        for task in tasks:
            lot = self.db.query(InventoryLot).filter(InventoryLot.internal_lot_number == task.internal_lot_number).first()
            if lot:
                txn = InventoryTransaction(
                    internal_lot_number=lot.internal_lot_number,
                    transaction_type='SHIP',
                    quantity=task.pick_qty,
                    reference_so_number=so_number,
                    performed_by=shipper
                )
                self.db.add(txn)
                
                details.append({
                    "internalLotNumber": lot.internal_lot_number,
                    "qty": task.pick_qty,
                    "location": lot.location_id
                })

        return {
            "status": "success",
            "message": f"Shipment confirmed for {so_number}",
            "details": details
        }

    def _get_shipment_details(self, so_number: str) -> List[Dict]:
        tasks = (
            self.db.query(PickTask)
            .filter(PickTask.so_number == so_number)
            .all()
        )
        
        lots_map = {}
        if tasks:
            lot_numbers = [t.internal_lot_number for t in tasks]
            lots = self.db.query(InventoryLot).filter(InventoryLot.internal_lot_number.in_(lot_numbers)).all()
            lots_map = {l.internal_lot_number: l for l in lots}
            
        # FIFO order by receive_date
        sorted_tasks = sorted(tasks, key=lambda t: lots_map.get(t.internal_lot_number).receive_date or datetime.date.min if t.internal_lot_number in lots_map else datetime.date.min)
        
        result = []
        for task in sorted_tasks:
            lot = lots_map.get(task.internal_lot_number)
            result.append({
                "internalLotNumber": task.internal_lot_number,
                "qty": task.pick_qty,
                "location": task.location_id,
                "receiveDate": lot.receive_date.isoformat()[:10] if lot and isinstance(lot.receive_date, datetime.datetime) else ''
            })
            
        return result

    def generate_packing_list(self, so_number: str) -> Dict:
        details = self._get_shipment_details(so_number)
        
        # Group by SKU
        sku_groups: Dict[str, List[Dict]] = {}
        for detail in details:
            # Need to get SKU from lot
            lot = self.db.query(InventoryLot).filter(InventoryLot.internal_lot_number == detail['internalLotNumber']).first()
            sku = lot.internal_sku if lot else 'UNKNOWN'
            if sku not in sku_groups:
                sku_groups[sku] = []
            sku_groups[sku].append(detail)
            
        packing_items = []
        for sku, items in sku_groups.items():
            packing_items.append({
                "sku": sku,
                "lots": items
            })
            
        return {
            "soNumber": so_number,
            "items": packing_items
        }
