import datetime
from typing import Dict, List, Optional

from sqlalchemy.orm import Session

from app.models.order import SalesOrder, SOLine, PickTask
from app.models.inventory import InventoryLot
from app.models.transaction import InventoryTransaction


class InsufficientInventoryError(Exception):
    pass


class PickingEngine:
    def __init__(self, db: Session):
        self.db = db

    @staticmethod
    def _get_so(db: Session, so_number: str) -> Optional[SalesOrder]:
        return db.query(SalesOrder).filter(SalesOrder.so_number == so_number).first()

    def allocate_lots_for_so(self, so_number: str) -> Dict:
        so = self._get_so(self.db, so_number)
        if not so:
            raise ValueError(f"Sales Order {so_number} not found")

        strategy = so.lot_selection_rule or 'FIFO'
        results = []

        lines = (
            self.db.query(SOLine)
            .filter(SOLine.so_id == so.so_id)
            .order_by(SOLine.line_number)
            .all()
        )

        for line in lines:
            result = self._allocate_line(so, line, strategy)
            results.append(result)

        total_allocated = sum(r['allocated_qty'] for r in results)
        
        # Determine primary SKU and requested qty from first line for summary
        internal_sku = lines[0].internal_sku if lines else ''
        requested_qty = sum(l.ordered_qty for l in lines)

        return {
            "soNumber": so_number,
            "internalSku": internal_sku,
            "requestedQty": requested_qty,
            "strategy": strategy,
            "strategy_used": strategy,
            "allocatedQty": total_allocated,
            "details": [d for r in results for d in r.get('allocation_details', [])],
            "results": results
        }

    def _allocate_line(self, so: SalesOrder, line: SOLine, strategy: str) -> Dict:
        available_lots = self._get_available_lots(line.internal_sku)
        sorted_lots = self._sort_by_strategy(available_lots, strategy)

        remaining_needed = line.ordered_qty - (line.picked_qty or 0)
        allocated_qty = 0
        allocation_details = []
        tasks_created = 0

        rank = 1
        for lot in sorted_lots:
            if remaining_needed <= 0:
                break
            
            available_qty = lot.quantity_on_hand - (lot.quantity_reserved or 0)
            if available_qty <= 0:
                continue

            pick_qty = min(remaining_needed, available_qty)
            
            # Update reservation
            lot.quantity_reserved = (lot.quantity_reserved or 0) + pick_qty
            line.allocated_qty = (line.allocated_qty or 0) + pick_qty
            allocated_qty += pick_qty
            remaining_needed -= pick_qty

            allocation_details.append({
                "rank": rank,
                "internalSku": lot.internal_sku,
                "internalLotNumber": lot.internal_lot_number,
                "internalBarcode": lot.internal_barcode,
                "vendorLotCode": lot.vendor_lot_code,
                "qty": pick_qty,
                "receiveDate": lot.receive_date.isoformat()[:10] if isinstance(lot.receive_date, datetime.datetime) else str(lot.receive_date)[:10],
                "location": str(lot.location_id) if lot.location_id is not None else None
            })
            
            # Create PickTask (schema: so_line_id, lot_id, from_location_id, pick_qty, status)
            task = PickTask(
                so_line_id=line.so_line_id,
                lot_id=lot.lot_id,
                from_location_id=lot.location_id,
                pick_qty=pick_qty,
                status='PENDING'
            )
            self.db.add(task)
            tasks_created += 1
            rank += 1

        success = remaining_needed <= 0
        
        return {
            "line_number": line.line_number,
            "success": success,
            "tasks_created": tasks_created,
            "allocated_qty": allocated_qty,
            "allocation_details": allocation_details,
            "error": None if success else f"Insufficient inventory for line {line.line_number}"
        }

    def _get_available_lots(self, internal_sku: str) -> List[InventoryLot]:
        now = datetime.datetime.now().date()
        
        lots = (
            self.db.query(InventoryLot)
            .filter(
                InventoryLot.internal_sku == internal_sku,
                InventoryLot.lot_status == 'AVAILABLE',
                InventoryLot.quantity_on_hand > 0
            )
            .all()
        )

        # Filter out expired lots
        valid_lots = []
        for lot in lots:
            if lot.expiry_date and lot.expiry_date <= now:
                continue
            valid_lots.append(lot)
            
        return valid_lots

    def _sort_by_strategy(self, lots: List[InventoryLot], strategy: str) -> List[InventoryLot]:
        if strategy == 'FEFO':
            # Sort by expiry_date ascending, None last
            max_date = datetime.date.max
            return sorted(
                lots, 
                key=lambda x: x.expiry_date if x.expiry_date else max_date
            )
        elif strategy == 'CUSTOMER_SPECIFIED':
            # Fallback to FIFO
            pass
            
        # Default FIFO: sort by receive_date ascending (None last)
        return sorted(
            lots,
            key=lambda x: x.receive_date or datetime.datetime.min
        )

    def generate_pick_wave(self, picker_id: Optional[str] = None) -> List[Dict]:
        tasks = (
            self.db.query(PickTask)
            .filter(PickTask.status == 'PENDING')
            .order_by(PickTask.from_location_id)
            .all()
        )

        wave = []
        for i, task in enumerate(tasks, 1):
            lot = task.lot
            so = task.so_line.so if task.so_line else None

            wave.append({
                "sequence": i,
                "location": str(task.from_location_id) if task.from_location_id is not None else None,
                "internalSku": lot.internal_sku if lot else '',
                "internalLotNumber": lot.internal_lot_number if lot else '',
                "internalBarcode": lot.internal_barcode if lot else '',
                "vendorLotCode": lot.vendor_lot_code if lot else '',
                "pickQty": task.pick_qty,
                "receiveDate": lot.receive_date.isoformat()[:10] if lot and lot.receive_date else '',
                "expiryDate": lot.expiry_date.isoformat()[:10] if lot and lot.expiry_date else '',
                "status": task.status,
                "soNumber": so.so_number if so else ''
            })

        return wave

    def confirm_pick(self, task_id: int, picked_qty: float, picker: str) -> Dict:
        task = self.db.query(PickTask).filter(PickTask.task_id == task_id).first()
        if not task:
            raise ValueError(f"Pick Task {task_id} not found")

        lot = task.lot or self.db.query(InventoryLot).filter(InventoryLot.lot_id == task.lot_id).first()
        if not lot:
            raise ValueError(f"Lot for task {task_id} not found")

        picked = int(picked_qty)
        qty_before = lot.quantity_on_hand
        lot.quantity_on_hand -= picked
        # picking consumes the reservation it created at allocation time
        lot.quantity_reserved = max(0, (lot.quantity_reserved or 0) - picked)

        so = task.so_line.so if task.so_line else None
        txn = InventoryTransaction(
            lot_id=lot.lot_id,
            transaction_type='PICK',
            quantity_change=-picked,
            quantity_before=qty_before,
            quantity_after=lot.quantity_on_hand,
            reference_type='SO',
            reference_number=so.so_number if so else None,
            executed_by=picker,
        )
        self.db.add(txn)

        task.status = 'PICKED'
        if task.so_line:
            task.so_line.picked_qty = (task.so_line.picked_qty or 0) + picked

        self.db.commit()
        return {"status": "success", "message": f"Picked {picked_qty} units for task {task_id}"}
