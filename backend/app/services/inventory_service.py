from math import ceil
from datetime import timedelta
from typing import Optional

from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.core.warehouse.adjustment import AdjustmentService
from app.schemas.inventory import LotOut, LotListQuery, LotPageOut
from app.models.inventory import InventoryLot, InventoryTransaction  # type: ignore
from app.models.item import Item
from app.models.storage import StorageLocation  # type: ignore
from app.models.warehouse import LocationStatus
from app.core.warehouse.putaway import PutAwayEngine
from app.utils.time import utcnow

MSL_FLOOR_LIFE_HOURS = {2: 8760, 3: 168, 4: 72, 5: 48, 6: 24}


class InventoryService:
    def __init__(self, db: Session):
        self.db = db
        self.adjustment_svc = AdjustmentService(db)

    def get_lots(self, query_params: LotListQuery) -> LotPageOut:
        """
        Query lots with filters. Default excludes SHIPPED/EXPIRED/VOID.
        """
        excluded_statuses = query_params.get_excluded_statuses()

        stmt = (
            self.db.query(
                InventoryLot,
                StorageLocation.location_code.label("location_code"),
                Item.description.label("description"),
                Item.msl_level.label("msl_level"),
            )
            .outerjoin(
                StorageLocation,
                InventoryLot.location_id == StorageLocation.location_id,
            )
            .outerjoin(Item, InventoryLot.internal_sku == Item.internal_sku)
        )

        if query_params.sku:
            stmt = stmt.filter(InventoryLot.internal_sku.ilike(f"%{query_params.sku}%"))

        if query_params.status:
            stmt = stmt.filter(InventoryLot.lot_status.in_(query_params.status))
        else:
            if excluded_statuses:
                stmt = stmt.filter(~InventoryLot.lot_status.in_(excluded_statuses))

        if query_params.location:
            stmt = stmt.filter(
                StorageLocation.location_code.ilike(f"%{query_params.location}%")
            )

        if query_params.vendor:
            stmt = stmt.filter(InventoryLot.vendor_id == query_params.vendor)

        if query_params.search:
            term = f"%{query_params.search.strip()}%"
            stmt = stmt.filter(
                or_(
                    InventoryLot.internal_sku.ilike(term),
                    InventoryLot.internal_lot_number.ilike(term),
                    InventoryLot.internal_barcode.ilike(term),
                    InventoryLot.vendor_lot_code.ilike(term),
                    InventoryLot.vendor_pn.ilike(term),
                    StorageLocation.location_code.ilike(term),
                )
            )

        sort_columns = {
            "internal_sku": InventoryLot.internal_sku,
            "internal_lot_number": InventoryLot.internal_lot_number,
            "quantity_on_hand": InventoryLot.quantity_on_hand,
            "quantity_reserved": InventoryLot.quantity_reserved,
            "receive_date": InventoryLot.receive_date,
            "expiry_date": InventoryLot.expiry_date,
            "lot_status": InventoryLot.lot_status,
            "location_code": StorageLocation.location_code,
        }
        sort_column = sort_columns[query_params.sort_by]
        direction = (
            sort_column.asc() if query_params.order == "asc" else sort_column.desc()
        )
        total = stmt.count()
        results = (
            stmt.order_by(direction, InventoryLot.lot_id.desc())
            .offset((query_params.page - 1) * query_params.page_size)
            .limit(query_params.page_size)
            .all()
        )

        # Map to Pydantic models
        lots_out = []
        for lot, loc_code, description, msl_level in results:
            lots_out.append(
                LotOut.model_validate(lot).model_copy(
                    update={
                        "location_code": loc_code,
                        "description": description,
                        "msl_level": msl_level,
                    }
                )
            )

        return LotPageOut(
            items=lots_out,
            total=total,
            page=query_params.page,
            page_size=query_params.page_size,
            total_pages=ceil(total / query_params.page_size) if total else 0,
        )

    def get_lot_detail(self, lot_id: int) -> Optional[LotOut]:
        """Get detailed info for a single lot."""
        result = (
            self.db.query(
                InventoryLot, StorageLocation.location_code.label("location_code")
            )
            .outerjoin(
                StorageLocation, InventoryLot.location_id == StorageLocation.location_id
            )
            .filter(InventoryLot.lot_id == lot_id)
            .first()
        )

        if not result:
            return None

        lot, loc_code = result
        out = LotOut.model_validate(lot)
        out.location_code = loc_code
        return out

    def update_lot(
        self,
        lot_id: int,
        location_code: Optional[str] = None,
        quality_notes: Optional[str] = None,
        fields_set: Optional[dict] = None,
    ) -> LotOut:
        """Update non-quantity lot fields."""
        lot = self.db.query(InventoryLot).filter(InventoryLot.lot_id == lot_id).first()
        if not lot:
            raise ValueError(f"Lot {lot_id} not found")
        if lot.lot_status == "VOID":
            raise ValueError("Cannot edit a voided lot")

        fields_set = fields_set or {}

        if "locationCode" in fields_set or "location_code" in fields_set:
            code = location_code
            if code in (None, ""):
                lot.location_id = None
            else:
                loc = (
                    self.db.query(StorageLocation)
                    .filter(StorageLocation.location_code == code)
                    .first()
                )
                if not loc:
                    raise ValueError(f"Location '{code}' not found")
                lot.location_id = loc.location_id

        if "qualityNotes" in fields_set or "quality_notes" in fields_set:
            lot.quality_notes = quality_notes

        self.db.commit()
        detail = self.get_lot_detail(lot_id)
        if not detail:
            raise ValueError(f"Lot {lot_id} not found")
        return detail

    def void_lot(self, lot_id: int) -> dict:
        """Soft-void a lot (status only; no qty reversal)."""
        lot = self.db.query(InventoryLot).filter(InventoryLot.lot_id == lot_id).first()
        if not lot:
            raise ValueError(f"Lot {lot_id} not found")
        if lot.lot_status == "VOID":
            return {
                "detail": "already voided",
                "lotId": lot.lot_id,
                "lotStatus": "VOID",
            }
        if lot.lot_status == "SHIPPED":
            raise ValueError("Cannot void a shipped lot")

        lot.lot_status = "VOID"
        self.db.commit()
        return {"detail": "voided", "lotId": lot.lot_id, "lotStatus": "VOID"}

    def adjust_quantity(self, request_data: dict, executed_by: str) -> dict:
        """Delegate adjustment to AdjustmentService."""
        return self.adjustment_svc.adjust_quantity(
            lot_id=request_data["lotId"],
            quantity_change=request_data["quantityChange"],
            executed_by=executed_by,
            reason=request_data.get("reason"),
        )

    def split_lot(self, request_data: dict, executed_by: str) -> dict:
        """Delegate split to AdjustmentService."""
        return self.adjustment_svc.split_lot(
            parent_lot_id=request_data["parentLotId"],
            quantity_to_split=request_data["quantityToSplit"],
            executed_by=executed_by,
        )

    def move_lot(
        self,
        lot_id: int,
        target_location_code: str,
        executed_by: str,
        reason: str | None,
    ) -> dict:
        lot = (
            self.db.query(InventoryLot)
            .filter(InventoryLot.lot_id == lot_id)
            .with_for_update(of=InventoryLot)
            .first()
        )
        if not lot:
            raise ValueError(f"Lot {lot_id} not found")
        if lot.lot_status in {"SHIPPED", "VOID"}:
            raise ValueError(f"Cannot move a {lot.lot_status.lower()} lot")
        target = (
            self.db.query(StorageLocation)
            .filter(StorageLocation.location_code == target_location_code)
            .first()
        )
        if not target:
            raise ValueError(f"Location '{target_location_code}' not found")
        if lot.location_id == target.location_id:
            raise ValueError("Lot is already at the target location")
        locked = (
            self.db.query(LocationStatus)
            .filter(
                LocationStatus.location_id.in_(
                    [
                        location_id
                        for location_id in [lot.location_id, target.location_id]
                        if location_id
                    ]
                ),
                LocationStatus.status == "LOCKED",
            )
            .with_for_update()
            .first()
        )
        if locked:
            raise ValueError("Source or target location is frozen for cycle counting")
        PutAwayEngine(self.db).validate_location(lot, target)
        source_id = lot.location_id
        lot.location_id = target.location_id
        self.db.add(
            InventoryTransaction(
                transaction_type="MOVE",
                lot_id=lot.lot_id,
                quantity_change=0,
                quantity_before=lot.quantity_on_hand,
                quantity_after=lot.quantity_on_hand,
                from_location_id=source_id,
                to_location_id=target.location_id,
                reference_type="MOVE",
                executed_by=executed_by,
                notes=reason or "Inventory location transfer",
            )
        )
        self.db.commit()
        return {
            "success": True,
            "lotId": lot.lot_id,
            "fromLocationId": source_id,
            "toLocationId": target.location_id,
            "targetLocationCode": target.location_code,
        }

    def open_msl_bag(self, lot_id: int) -> dict:
        lot = (
            self.db.query(InventoryLot)
            .filter(InventoryLot.lot_id == lot_id)
            .with_for_update(of=InventoryLot)
            .first()
        )
        if not lot:
            raise ValueError(f"Lot {lot_id} not found")
        if lot.bag_opened_at:
            raise ValueError(
                "MSL bag has already been opened; bake it before reopening"
            )
        item = self.db.query(Item).filter(Item.internal_sku == lot.internal_sku).first()
        level = item.msl_level if item else None
        now = utcnow()
        lot.bag_opened_at = now
        hours = MSL_FLOOR_LIFE_HOURS.get(level)
        if hours:
            lot.expiry_date = (now + timedelta(hours=hours)).date()
        lot.updated_at = now
        self.db.commit()
        return {
            "success": True,
            "lotId": lot.lot_id,
            "mslLevel": level,
            "bagOpenedAt": lot.bag_opened_at,
            "expiryDate": lot.expiry_date,
        }

    def bake_msl_lot(self, lot_id: int) -> dict:
        lot = (
            self.db.query(InventoryLot)
            .filter(InventoryLot.lot_id == lot_id)
            .with_for_update(of=InventoryLot)
            .first()
        )
        if not lot:
            raise ValueError(f"Lot {lot_id} not found")
        item = self.db.query(Item).filter(Item.internal_sku == lot.internal_sku).first()
        level = item.msl_level if item else None
        now = utcnow()
        lot.bag_opened_at = None
        lot.expiry_date = (
            (now + timedelta(days=365)).date() if level and level > 1 else None
        )
        lot.updated_at = now
        self.db.commit()
        return {
            "success": True,
            "lotId": lot.lot_id,
            "mslLevel": level,
            "bagOpenedAt": None,
            "expiryDate": lot.expiry_date,
        }
