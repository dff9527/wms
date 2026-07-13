from datetime import datetime

from sqlalchemy.orm import Session, selectinload

from app.models.cycle_count import CycleCount, CycleCountLine
from app.models.inventory import InventoryLot, InventoryTransaction
from app.models.warehouse import LocationStatus, StorageLocation
from app.utils.time import utcnow


class CycleCountService:
    def __init__(self, db: Session):
        self.db = db

    def _get(self, count_id: int, lock: bool = False) -> CycleCount:
        query = self.db.query(CycleCount).options(selectinload(CycleCount.lines))
        if lock:
            query = query.with_for_update(of=CycleCount)
        count = query.filter(CycleCount.cycle_count_id == count_id).first()
        if not count:
            raise ValueError("Cycle count not found")
        return count

    def list_counts(self) -> list[dict]:
        counts = self.db.query(CycleCount).order_by(CycleCount.created_at.desc()).all()
        return [self.serialize(count, reveal_expected=False) for count in counts]

    def create(
        self, location_ids: list[int], internal_skus: list[str] | None, username: str
    ) -> dict:
        locations = (
            self.db.query(StorageLocation)
            .filter(StorageLocation.location_id.in_(location_ids))
            .all()
        )
        if len(locations) != len(set(location_ids)):
            raise ValueError("One or more locations were not found")
        now = utcnow()
        count = CycleCount(
            count_number=f"CC-{now.strftime('%Y%m%d%H%M%S%f')}",
            status="DRAFT",
            created_by=username,
        )
        self.db.add(count)
        self.db.flush()
        lots = self.db.query(InventoryLot).filter(
            InventoryLot.location_id.in_(location_ids),
            InventoryLot.lot_status.notin_(["SHIPPED", "VOID"]),
        )
        if internal_skus:
            lots = lots.filter(InventoryLot.internal_sku.in_(internal_skus))
        for lot in lots.all():
            self.db.add(
                CycleCountLine(
                    cycle_count_id=count.cycle_count_id,
                    location_id=lot.location_id,
                    lot_id=lot.lot_id,
                    internal_sku=lot.internal_sku,
                    expected_quantity=lot.quantity_on_hand,
                )
            )
        self.db.commit()
        return self.serialize(self._get(count.cycle_count_id), reveal_expected=True)

    def freeze(self, count_id: int) -> dict:
        count = self._get(count_id, lock=True)
        if count.status != "DRAFT":
            raise ValueError("Only draft counts can be frozen")
        location_ids = sorted({line.location_id for line in count.lines})
        statuses = (
            self.db.query(LocationStatus)
            .filter(LocationStatus.location_id.in_(location_ids))
            .with_for_update()
            .all()
        )
        by_id = {status.location_id: status for status in statuses}
        for location_id in location_ids:
            status = by_id.get(location_id)
            if status and status.status == "LOCKED":
                raise ValueError(f"Location {location_id} is already locked")
            if not status:
                status = LocationStatus(location_id=location_id)
                self.db.add(status)
            status.status = "LOCKED"
            status.updated_at = utcnow()
        count.status = "FROZEN"
        count.frozen_at = utcnow()
        self.db.commit()
        return self.serialize(count, reveal_expected=False)

    def enter(self, count_id: int, entries: list[dict]) -> dict:
        count = self._get(count_id, lock=True)
        if count.status not in {"FROZEN", "COUNTING"}:
            raise ValueError("Count is not open for blind entry")
        lines = {line.cycle_count_line_id: line for line in count.lines}
        for entry in entries:
            line = lines.get(entry["lineId"])
            if not line:
                raise ValueError(f"Line {entry['lineId']} does not belong to count")
            line.counted_quantity = entry["countedQuantity"]
            line.notes = entry.get("notes")
        count.status = "COUNTING"
        self.db.commit()
        return self.serialize(count, reveal_expected=False)

    def submit(self, count_id: int) -> dict:
        count = self._get(count_id, lock=True)
        if count.status not in {"FROZEN", "COUNTING"}:
            raise ValueError("Count cannot be submitted")
        if any(line.counted_quantity is None for line in count.lines):
            raise ValueError("Every line must be counted before submission")
        count.status = "REVIEW"
        count.submitted_at = utcnow()
        self.db.commit()
        return self.serialize(count, reveal_expected=True)

    def review(self, count_id: int, approve: bool, username: str) -> dict:
        count = self._get(count_id, lock=True)
        if count.status != "REVIEW":
            raise ValueError("Only submitted counts can be reviewed")
        location_ids = sorted({line.location_id for line in count.lines})
        lots = (
            self.db.query(InventoryLot)
            .filter(InventoryLot.lot_id.in_([line.lot_id for line in count.lines]))
            .with_for_update(of=InventoryLot)
            .all()
        )
        lots_by_id = {lot.lot_id: lot for lot in lots}
        if approve:
            for line in count.lines:
                lot = lots_by_id[line.lot_id]
                before = lot.quantity_on_hand
                after = line.counted_quantity
                change = after - before
                if change:
                    lot.quantity_on_hand = after
                    self.db.add(
                        InventoryTransaction(
                            transaction_type="ADJUST",
                            lot_id=lot.lot_id,
                            quantity_change=change,
                            quantity_before=before,
                            quantity_after=after,
                            from_location_id=lot.location_id,
                            to_location_id=lot.location_id,
                            reference_type="CYCLE_COUNT",
                            reference_number=count.count_number,
                            executed_by=username,
                            notes="Approved cycle count variance",
                        )
                    )
            count.status = "APPROVED"
        else:
            count.status = "REJECTED"
        for status in (
            self.db.query(LocationStatus)
            .filter(LocationStatus.location_id.in_(location_ids))
            .with_for_update()
            .all()
        ):
            status.status = "AVAILABLE"
            status.last_inventory_date = utcnow()
            status.updated_at = utcnow()
        count.reviewed_by = username
        count.reviewed_at = utcnow()
        self.db.commit()
        return self.serialize(count, reveal_expected=True)

    @staticmethod
    def serialize(count: CycleCount, reveal_expected: bool) -> dict:
        reveal = reveal_expected or count.status in {"REVIEW", "APPROVED", "REJECTED"}
        return {
            "cycleCountId": count.cycle_count_id,
            "countNumber": count.count_number,
            "status": count.status,
            "createdBy": count.created_by,
            "reviewedBy": count.reviewed_by,
            "createdAt": count.created_at,
            "lines": [
                {
                    "lineId": line.cycle_count_line_id,
                    "locationId": line.location_id,
                    "locationCode": line.location.location_code,
                    "lotId": line.lot_id,
                    "internalSku": line.internal_sku,
                    "internalLotNumber": line.lot.internal_lot_number,
                    "expectedQuantity": line.expected_quantity if reveal else None,
                    "countedQuantity": line.counted_quantity,
                    "variance": (
                        line.counted_quantity - line.expected_quantity
                        if reveal and line.counted_quantity is not None
                        else None
                    ),
                    "notes": line.notes,
                }
                for line in count.lines
            ],
        }
