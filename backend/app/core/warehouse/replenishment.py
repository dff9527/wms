from datetime import datetime

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.warehouse.putaway import PutAwayEngine
from app.models.inventory import InventoryLot, InventoryTransaction
from app.models.replenishment import ReplenishmentTask
from app.models.warehouse import StorageLocation


class ReplenishmentService:
    def __init__(self, db: Session):
        self.db = db

    def generate(self, username: str):
        destinations = (
            self.db.query(StorageLocation)
            .filter(StorageLocation.replenishment_sku.isnot(None))
            .all()
        )
        created = []
        for destination in destinations:
            sku = destination.replenishment_sku
            available = (
                self.db.query(
                    func.coalesce(func.sum(InventoryLot.quantity_available), 0)
                )
                .filter(
                    InventoryLot.location_id == destination.location_id,
                    InventoryLot.internal_sku == sku,
                    InventoryLot.lot_status == "AVAILABLE",
                )
                .scalar()
            )
            if available >= destination.replenishment_min_qty:
                continue
            has_open = (
                self.db.query(ReplenishmentTask.task_id)
                .filter(
                    ReplenishmentTask.to_location_id == destination.location_id,
                    ReplenishmentTask.internal_sku == sku,
                    ReplenishmentTask.status == "OPEN",
                )
                .first()
            )
            if has_open:
                continue
            needed = destination.replenishment_max_qty - available
            source = (
                self.db.query(InventoryLot)
                .filter(
                    InventoryLot.internal_sku == sku,
                    InventoryLot.lot_status == "AVAILABLE",
                    InventoryLot.quantity_reserved == 0,
                    InventoryLot.quantity_on_hand <= needed,
                    InventoryLot.location_id.isnot(None),
                    InventoryLot.location_id != destination.location_id,
                )
                .order_by(
                    InventoryLot.expiry_date.asc().nullslast(),
                    InventoryLot.receive_date.asc(),
                )
                .with_for_update(skip_locked=True)
                .first()
            )
            if not source:
                continue
            task = ReplenishmentTask(
                internal_sku=sku,
                lot_id=source.lot_id,
                from_location_id=source.location_id,
                to_location_id=destination.location_id,
                quantity=source.quantity_on_hand,
                created_by=username,
            )
            self.db.add(task)
            self.db.flush()
            created.append(self._out(task))
        self.db.commit()
        return created

    def list(self):
        return [
            self._out(task)
            for task in self.db.query(ReplenishmentTask)
            .order_by(ReplenishmentTask.created_at.desc())
            .all()
        ]

    def complete(self, task_id: int, username: str):
        task = (
            self.db.query(ReplenishmentTask)
            .filter(ReplenishmentTask.task_id == task_id)
            .with_for_update()
            .first()
        )
        if not task:
            raise ValueError("Replenishment task not found")
        if task.status != "OPEN":
            raise ValueError("Replenishment task is not open")
        lot = (
            self.db.query(InventoryLot)
            .filter(InventoryLot.lot_id == task.lot_id)
            .with_for_update()
            .first()
        )
        destination = (
            self.db.query(StorageLocation)
            .filter(StorageLocation.location_id == task.to_location_id)
            .first()
        )
        if (
            not lot
            or not destination
            or lot.location_id != task.from_location_id
            or lot.quantity_on_hand != task.quantity
        ):
            raise ValueError("Replenishment inventory changed; regenerate the task")
        PutAwayEngine(self.db).validate_location(lot, destination)
        previous = lot.location_id
        lot.location_id = destination.location_id
        task.status = "COMPLETED"
        task.completed_by = username
        task.completed_at = datetime.utcnow()
        self.db.add(
            InventoryTransaction(
                transaction_type="MOVE",
                lot_id=lot.lot_id,
                quantity_change=0,
                quantity_before=lot.quantity_on_hand,
                quantity_after=lot.quantity_on_hand,
                from_location_id=previous,
                to_location_id=destination.location_id,
                reference_type="REPLENISH",
                reference_number=str(task.task_id),
                executed_by=username,
            )
        )
        self.db.commit()
        return self._out(task)

    @staticmethod
    def _out(task):
        return {
            "taskId": task.task_id,
            "internalSku": task.internal_sku,
            "lotId": task.lot_id,
            "fromLocationId": task.from_location_id,
            "toLocationId": task.to_location_id,
            "quantity": task.quantity,
            "status": task.status,
        }
