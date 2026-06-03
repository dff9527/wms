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

        strategy = getattr(so, 'fifo_strategy', 'FIFO') or 'FIFO'
        results = []

        lines = (
            self.db.query(SOLine)
            .filter(SOLine.so_number == so_number)
            .order_by(SOLine.line_number)
            .all()
        )

        for line in lines:
            result = self._allocate_line(line, strategy)
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
            "allocatedQty": total_allocated,
            "details": [d for r in results for d in r.get('allocation_details', [])],
            "results": results
        }

    def _allocate_line(self, line: SOLine, strategy: str) -> Dict:
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
                "location": lot.location_id
            })
            
            # Create PickTask
            task = PickTask(
                so_number=line.so_number,
                line_number=line.line_number,
                internal_lot_number=lot.internal_lot_number,
                location_id=lot.location_id,
                pick_qty=pick_qty,
                status='pending'
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
                InventoryLot.status == 'AVAILABLE',
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
            
        # Default FIFO: sort by receive_date ascending
        return sorted(
            lots, 
            key=lambda x: x.receive_date or datetime.date.min
        )

    def generate_pick_wave(self, picker_id: Optional[str] = None) -> List[Dict]:
        tasks = (
            self.db.query(PickTask)
            .filter(PickTask.status.in_(['pending', 'in_progress']))
            .order_by(PickTask.location_id)
            .all()
        )

        wave = []
        for i, task in enumerate(tasks, 1):
            lot = self.db.query(InventoryLot).filter(InventoryLot.internal_lot_number == task.internal_lot_number).first()
            
            so = self._get_so(self.db, task.so_number)
            
            wave.append({
                "sequence": i,
                "location": task.location_id,
                "internalSku": lot.internal_sku if lot else '',
                "internalLotNumber": task.internal_lot_number,
                "internalBarcode": lot.internal_barcode if lot else '',
                "vendorLotCode": lot.vendor_lot_code if lot else '',
                "pickQty": task.pick_qty,
                "receiveDate": lot.receive_date.isoformat()[:10] if lot and isinstance(lot.receive_date, datetime.datetime) else str(lot.receive_date)[:10] if lot else '',
                "expiryDate": lot.expiry_date.isoformat()[:10] if lot and isinstance(lot.expiry_date, datetime.datetime) else str(lot.expiry_date)[:10] if lot else '',
                "status": task.status,
                "soNumber": task.so_number
            })
            
        return wave

    def confirm_pick(self, task_id: int, picked_qty: float, picker: str) -> Dict:
        task = self.db.query(PickTask).filter(PickTask.id == task_id).first()
        if not task:
            raise ValueError(f"Pick Task {task_id} not found")
        
        lot = self.db.query(InventoryLot).filter(InventoryLot.internal_lot_number == task.internal_lot_number).first()
        if not lot:
            raise ValueError(f"Lot {task.internal_lot_number} not found")

        # Decrement on-hand
        lot.quantity_on_hand -= picked_qty
        
        # Release reserve (if we reserved it previously, though typically pick consumes reservation)
        # Spec says: decrement on-hand, release reserve. 
        # Usually picking converts Reserved to Picked/Shipped. 
        # If the spec implies releasing back to available pool then taking from on-hand:
        # But standard WMS: Reserve -> Pick -> Ship.
        # Let's follow spec literally: "decrements on-hand, releases reserve"
        # This might mean moving from Reserved status to Picked status in transaction log.
        
        lot.quantity_reserved = max(0, (lot.quantity_reserved or 0) - picked_qty)
        
        # Write PICK Transaction
        txn = InventoryTransaction(
            internal_lot_number=lot.internal_lot_number,
            transaction_type='PICK',
            quantity=picked_qty,
            reference_so_number=task.so_number,
            performed_by=picker
        )
        self.db.add(txn)
        
        task.status = 'completed'
        task.picked_qty = picked_qty
        
        return {"status": "success", "message": f"Picked {picked_qty} units for task {task_id}"}
