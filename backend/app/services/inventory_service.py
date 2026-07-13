from typing import List, Optional
from sqlalchemy.orm import Session

from app.core.warehouse.adjustment import AdjustmentService
from app.schemas.inventory import LotOut, LotListQuery
from app.models.inventory import InventoryLot  # type: ignore
from app.models.storage import StorageLocation  # type: ignore


class InventoryService:
    def __init__(self, db: Session):
        self.db = db
        self.adjustment_svc = AdjustmentService(db)

    def get_lots(self, query_params: LotListQuery) -> List[LotOut]:
        """
        Query lots with filters. Default excludes SHIPPED/EXPIRED/VOID.
        """
        excluded_statuses = query_params.get_excluded_statuses()

        stmt = self.db.query(
            InventoryLot, StorageLocation.location_code.label("location_code")
        ).outerjoin(
            StorageLocation, InventoryLot.location_id == StorageLocation.location_id
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

        results = stmt.all()

        # Map to Pydantic models
        lots_out = []
        for lot, loc_code in results:
            lots_out.append(
                LotOut.model_validate(lot).model_copy(
                    update={"location_code": loc_code}
                )
            )

        return lots_out

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
