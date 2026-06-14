from typing import List, Optional
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_

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
        Query lots with filters. Default excludes SHIPPED/EXPIRED.
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
