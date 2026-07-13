import datetime
from typing import Dict, List, Optional

from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.models.order import SalesOrder, SOLine, PickTask
from app.models.inventory import InventoryLot
from app.models.transaction import InventoryTransaction
from app.models.warehouse import LocationStatus


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

        # 防重複配貨：只有 OPEN 狀態可配
        if so.status != "OPEN":
            raise ValueError(f"Sales Order {so_number} 狀態為 {so.status},不可重複配貨")

        strategy = so.lot_selection_rule or "FIFO"
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

        # 全有全無：任一行配不足即整單失敗,由 API 層 rollback,不留部分保留
        failed = [r for r in results if not r["success"]]
        if failed:
            raise InsufficientInventoryError(
                "; ".join(r["error"] for r in failed if r.get("error"))
            )

        so.status = "ALLOCATED"

        total_allocated = sum(r["allocated_qty"] for r in results)

        # Determine primary SKU and requested qty from first line for summary
        internal_sku = lines[0].internal_sku if lines else ""
        requested_qty = sum(l.ordered_qty for l in lines)

        return {
            "soNumber": so_number,
            "internalSku": internal_sku,
            "requestedQty": requested_qty,
            "strategy": strategy,
            "strategy_used": strategy,
            "allocatedQty": total_allocated,
            "details": [d for r in results for d in r.get("allocation_details", [])],
            "results": results,
        }

    def _allocate_line(self, so: SalesOrder, line: SOLine, strategy: str) -> Dict:
        available_lots = self._get_available_lots(
            line.internal_sku,
            customer_avl=so.customer_avl,
            required_vendor=line.required_vendor_id,
            required_date_code=line.required_date_code,
        )
        sorted_lots = self._sort_by_strategy(available_lots, strategy)

        # 以已配數量為基準(picked_qty 是揀貨後才會動的欄位)
        remaining_needed = line.ordered_qty - (line.allocated_qty or 0)
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

            allocation_details.append(
                {
                    "rank": rank,
                    "internalSku": lot.internal_sku,
                    "internalLotNumber": lot.internal_lot_number,
                    "internalBarcode": lot.internal_barcode,
                    "vendorLotCode": lot.vendor_lot_code,
                    "qty": pick_qty,
                    "receiveDate": (
                        lot.receive_date.isoformat()[:10]
                        if isinstance(lot.receive_date, datetime.datetime)
                        else str(lot.receive_date)[:10]
                    ),
                    "location": (
                        str(lot.location_id) if lot.location_id is not None else None
                    ),
                }
            )

            # Create PickTask (schema: so_line_id, lot_id, from_location_id, pick_qty, status)
            task = PickTask(
                so_line_id=line.so_line_id,
                lot_id=lot.lot_id,
                from_location_id=lot.location_id,
                pick_qty=pick_qty,
                status="PENDING",
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
            "error": (
                None
                if success
                else f"Insufficient inventory for line {line.line_number}"
            ),
        }

    def _get_available_lots(
        self,
        internal_sku: str,
        customer_avl: Optional[dict] = None,
        required_vendor: Optional[int] = None,
        required_date_code: Optional[str] = None,
    ) -> List[InventoryLot]:
        now = datetime.datetime.now().date()

        query = self.db.query(InventoryLot).filter(
            InventoryLot.internal_sku == internal_sku,
            InventoryLot.lot_status == "AVAILABLE",
            InventoryLot.quantity_on_hand > 0,
        )

        # 客戶 AVL:只允許客戶核可的供應商批次 (spec §6.3 過濾條件 1)
        approved = (customer_avl or {}).get("approved_vendors")
        if approved:
            query = query.filter(InventoryLot.vendor_id.in_(approved))

        # 行項層級的客戶指定供應商 / 日期碼
        if required_vendor:
            query = query.filter(InventoryLot.vendor_id == required_vendor)
        if required_date_code:
            query = query.filter(InventoryLot.vendor_date_code == required_date_code)

        # 排除盤點凍結(LOCKED)儲位的批次,凍結期間不可配出
        locked_ids = [
            row.location_id
            for row in self.db.query(LocationStatus.location_id)
            .filter(LocationStatus.status == "LOCKED")
            .all()
        ]
        if locked_ids:
            query = query.filter(
                or_(
                    InventoryLot.location_id.is_(None),
                    InventoryLot.location_id.notin_(locked_ids),
                )
            )

        # row lock:避免並發配貨對同批次重複保留(SQLite 會忽略,PG 生效)。
        # of=InventoryLot:model 的 location/vendor 是 lazy="joined"(outer join),
        # PG 不允許 FOR UPDATE 鎖 outer join 的 nullable 側,只鎖主表。
        lots = query.with_for_update(of=InventoryLot).all()

        # Filter out expired lots
        valid_lots = []
        for lot in lots:
            if lot.expiry_date and lot.expiry_date <= now:
                continue
            valid_lots.append(lot)

        return valid_lots

    def _sort_by_strategy(
        self, lots: List[InventoryLot], strategy: str
    ) -> List[InventoryLot]:
        if strategy == "FEFO":
            # Sort by expiry_date ascending, None last
            max_date = datetime.date.max
            return sorted(
                lots, key=lambda x: x.expiry_date if x.expiry_date else max_date
            )
        elif strategy == "CUSTOMER_SPECIFIED":
            # Fallback to FIFO
            pass

        # Default FIFO: sort by receive_date ascending (None last)
        return sorted(lots, key=lambda x: x.receive_date or datetime.datetime.min)

    def generate_pick_wave(self, picker_id: Optional[str] = None) -> List[Dict]:
        # PENDING + PICKED 都回傳:揀貨模式要顯示進度,且「確認出貨」閘門
        # 需要看到已揀完的任務;出貨後任務轉 CONFIRMED 自然退出波次
        tasks = (
            self.db.query(PickTask)
            .filter(PickTask.status.in_(["PENDING", "PICKED"]))
            .order_by(PickTask.from_location_id)
            .all()
        )

        wave = []
        for i, task in enumerate(tasks, 1):
            lot = task.lot
            so = task.so_line.so if task.so_line else None

            wave.append(
                {
                    "sequence": i,
                    "task_id": task.task_id,
                    "location": (
                        str(task.from_location_id)
                        if task.from_location_id is not None
                        else None
                    ),
                    "internalSku": lot.internal_sku if lot else "",
                    "internalLotNumber": lot.internal_lot_number if lot else "",
                    "internalBarcode": lot.internal_barcode if lot else "",
                    "vendorLotCode": lot.vendor_lot_code if lot else "",
                    "pickQty": task.pick_qty,
                    "receiveDate": (
                        lot.receive_date.isoformat()[:10]
                        if lot and lot.receive_date
                        else ""
                    ),
                    "expiryDate": (
                        lot.expiry_date.isoformat()[:10]
                        if lot and lot.expiry_date
                        else ""
                    ),
                    "status": task.status,
                    "soNumber": so.so_number if so else "",
                }
            )

        return wave

    def confirm_pick(self, task_id: int, picked_qty: float, picker: str) -> Dict:
        task = self.db.query(PickTask).filter(PickTask.task_id == task_id).first()
        if not task:
            raise ValueError(f"Pick Task {task_id} not found")

        if task.status != "PENDING":
            raise ValueError(f"Pick Task {task_id} 狀態為 {task.status},不可重複確認")

        # row lock:確認揀貨時鎖住批次,避免並發扣帳(of= 同上,避開 eager outer join)
        lot = (
            self.db.query(InventoryLot)
            .filter(InventoryLot.lot_id == task.lot_id)
            .with_for_update(of=InventoryLot)
            .first()
        )
        if not lot:
            raise ValueError(f"Lot for task {task_id} not found")

        if lot.location_id and (
            self.db.query(LocationStatus)
            .filter(
                LocationStatus.location_id == lot.location_id,
                LocationStatus.status == "LOCKED",
            )
            .first()
        ):
            raise ValueError("儲位盤點凍結中,無法確認揀貨")

        picked = int(picked_qty)
        if picked <= 0:
            raise ValueError("picked_qty 必須為正整數")
        if picked > task.pick_qty:
            raise ValueError(f"實揀數量 {picked} 超過任務數量 {task.pick_qty}")
        if picked > lot.quantity_on_hand:
            raise ValueError(f"實揀數量 {picked} 超過現有庫存 {lot.quantity_on_hand}")

        qty_before = lot.quantity_on_hand
        lot.quantity_on_hand -= picked
        # picking consumes the reservation it created at allocation time
        lot.quantity_reserved = max(0, (lot.quantity_reserved or 0) - picked)

        so = task.so_line.so if task.so_line else None
        txn = InventoryTransaction(
            lot_id=lot.lot_id,
            transaction_type="PICK",
            quantity_change=-picked,
            quantity_before=qty_before,
            quantity_after=lot.quantity_on_hand,
            reference_type="SO",
            reference_number=so.so_number if so else None,
            executed_by=picker,
        )
        self.db.add(txn)

        task.status = "PICKED"
        if task.so_line:
            task.so_line.picked_qty = (task.so_line.picked_qty or 0) + picked

        self.db.commit()
        return {
            "status": "success",
            "message": f"Picked {picked_qty} units for task {task_id}",
        }
