from typing import Optional, Dict, Tuple
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.models.inventory import InventoryLot  # type: ignore
from app.models.item import Item
from app.models.warehouse import StorageLocation, Warehouse


class PutAwayEngine:
    """上架建議引擎 (Spec §6.2 多因子評分)

    過濾(硬性條件):
      1. 隔離區 (is_quarantine) 不收正常品
      2. ESD:IC 類料件只能放 ESD 管控倉 (warehouses.is_esd_controlled)
      3. MSL:儲位有 msl_level 上限時,料件等級不可超過
      4. allowed_item_types 有設定時,料件類型必須在清單內
    評分(軟性偏好):
      - 同料號集中 (clustering)
      - 儲位粒度:BIN > SHELF > RACK > AISLE > ZONE

    容量檢核以 items 單件重量/體積乘上現有與待上架數量，比對儲位 kg/cbm。
    """

    # 儲位粒度偏好分數
    _TYPE_SCORE = {"BIN": 50, "SHELF": 40, "RACK": 30, "AISLE": 10, "ZONE": 0}

    def __init__(self, db: Session):
        self.db = db

    def validate_location(self, lot: InventoryLot, location: StorageLocation) -> None:
        """Apply the same hard constraints used by putaway suggestions."""
        item = self.db.query(Item).filter(Item.internal_sku == lot.internal_sku).first()
        warehouse = None
        if location.warehouse_id:
            warehouse = (
                self.db.query(Warehouse)
                .filter(Warehouse.warehouse_id == location.warehouse_id)
                .first()
            )
        if location.is_quarantine and lot.lot_status != "QUARANTINE":
            raise ValueError(
                "Normal inventory cannot be moved to a quarantine location"
            )
        if (
            item
            and item.item_type == "IC"
            and not (warehouse and warehouse.is_esd_controlled)
        ):
            raise ValueError("IC inventory requires an ESD-controlled warehouse")
        if (
            location.msl_level is not None
            and item
            and item.msl_level
            and item.msl_level > location.msl_level
        ):
            raise ValueError("Target location does not support this MSL level")
        if (
            location.allowed_item_types
            and item
            and item.item_type not in location.allowed_item_types
        ):
            raise ValueError("Item type is not allowed at the target location")
        self.validate_capacity(lot, location, item)

    def validate_capacity(
        self, lot: InventoryLot, location: StorageLocation, item: Item | None = None
    ) -> None:
        item = (
            item
            or self.db.query(Item).filter(Item.internal_sku == lot.internal_sku).first()
        )
        if not item:
            return
        current_weight, current_volume = (
            self.db.query(
                func.coalesce(
                    func.sum(InventoryLot.quantity_on_hand * Item.unit_weight_kg), 0
                ),
                func.coalesce(
                    func.sum(InventoryLot.quantity_on_hand * Item.unit_volume_cbm), 0
                ),
            )
            .join(Item, InventoryLot.internal_sku == Item.internal_sku)
            .filter(
                InventoryLot.location_id == location.location_id,
                InventoryLot.lot_status.notin_(["SHIPPED", "VOID"]),
                InventoryLot.lot_id != lot.lot_id,
            )
            .one()
        )
        required_weight = lot.quantity_on_hand * (item.unit_weight_kg or 0)
        required_volume = lot.quantity_on_hand * (item.unit_volume_cbm or 0)
        if (
            location.capacity_kg is not None
            and current_weight + required_weight > location.capacity_kg
        ):
            raise ValueError("Target location weight capacity would be exceeded")
        if (
            location.capacity_cbm is not None
            and current_volume + required_volume > location.capacity_cbm
        ):
            raise ValueError("Target location volume capacity would be exceeded")

    def suggest_location_id(self, lot: InventoryLot) -> Optional[int]:
        item = self.db.query(Item).filter(Item.internal_sku == lot.internal_sku).first()

        rows = (
            self.db.query(StorageLocation, Warehouse)
            .outerjoin(
                Warehouse, StorageLocation.warehouse_id == Warehouse.warehouse_id
            )
            .filter(StorageLocation.is_quarantine == False)  # noqa: E712
            .all()
        )
        if not rows:
            return None

        # 一次彙總同料號在各儲位的批次數(取代逐儲位 N+1 查詢)
        sku_counts: Dict[int, int] = dict(
            self.db.query(InventoryLot.location_id, func.count(InventoryLot.lot_id))
            .filter(
                InventoryLot.internal_sku == lot.internal_sku,
                InventoryLot.lot_status.in_(["AVAILABLE", "RESERVED"]),
                InventoryLot.location_id.isnot(None),
            )
            .group_by(InventoryLot.location_id)
            .all()
        )

        best_id, best_score = None, -1
        for loc, wh in rows:
            # ESD 管控:IC 必須進 ESD 倉
            if item and item.item_type == "IC" and not (wh and wh.is_esd_controlled):
                continue
            # MSL 上限:儲位有限制時,料件 MSL 等級不可超過
            if (
                loc.msl_level is not None
                and item
                and item.msl_level
                and item.msl_level > loc.msl_level
            ):
                continue
            try:
                self.validate_capacity(lot, loc, item)
            except ValueError:
                continue
            # 料件類型白名單
            if (
                loc.allowed_item_types
                and item
                and item.item_type not in loc.allowed_item_types
            ):
                continue

            score = self._TYPE_SCORE.get(loc.location_type or "", 0)
            cluster = sku_counts.get(loc.location_id, 0)
            if cluster > 0:
                score += 100 + cluster * 10  # 同料號集中優先

            if score > best_score:
                best_id, best_score = loc.location_id, score

        return best_id

    def suggest_location(self, lot: InventoryLot) -> Optional[str]:
        suggested_id = self.suggest_location_id(lot)
        if suggested_id is None:
            return None

        location = (
            self.db.query(StorageLocation)
            .filter(StorageLocation.location_id == suggested_id)
            .first()
        )
        return location.location_code if location else None
