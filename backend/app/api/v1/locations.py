from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.api.deps import get_db, require_role
from app.models.warehouse import LocationStatus, StorageLocation, Warehouse

router = APIRouter(prefix="/api/v1/locations", tags=["Locations"])

LOCATION_TYPES = {"ZONE", "AISLE", "RACK", "SHELF", "BIN"}


class LocationCreate(BaseModel):
    warehouseId: int
    locationCode: str = Field(min_length=1, max_length=20)
    locationType: str = "BIN"
    isQuarantine: bool = False
    capacityKg: Optional[float] = Field(default=None, ge=0)
    capacityCbm: Optional[float] = Field(default=None, ge=0)
    mslLevel: Optional[int] = Field(default=None, ge=1, le=6)


def _serialize(location: StorageLocation, warehouse: Warehouse | None, status: str):
    return {
        "locationId": location.location_id,
        "locationCode": location.location_code,
        "locationType": location.location_type,
        "warehouseCode": warehouse.warehouse_code if warehouse else None,
        "warehouseName": warehouse.warehouse_name if warehouse else None,
        "isQuarantine": location.is_quarantine,
        "capacityKg": float(location.capacity_kg) if location.capacity_kg else None,
        "capacityCbm": float(location.capacity_cbm) if location.capacity_cbm else None,
        "mslLevel": location.msl_level,
        "status": status,
    }


@router.get("/warehouses")
def list_warehouses(db: Session = Depends(get_db)):
    rows = (
        db.query(Warehouse)
        .filter(Warehouse.is_active.is_(True))
        .order_by(Warehouse.warehouse_id)
        .all()
    )
    return [
        {
            "warehouseId": w.warehouse_id,
            "warehouseCode": w.warehouse_code,
            "warehouseName": w.warehouse_name,
            "isEsdControlled": w.is_esd_controlled,
        }
        for w in rows
    ]


@router.get("")
def list_locations(db: Session = Depends(get_db)):
    rows = (
        db.query(StorageLocation, Warehouse, LocationStatus)
        .outerjoin(Warehouse, StorageLocation.warehouse_id == Warehouse.warehouse_id)
        .outerjoin(
            LocationStatus,
            StorageLocation.location_id == LocationStatus.location_id,
        )
        .order_by(StorageLocation.location_code)
        .all()
    )
    return [
        _serialize(location, warehouse, status.status if status else "AVAILABLE")
        for location, warehouse, status in rows
    ]


@router.post("", status_code=201)
def create_location(
    req: LocationCreate,
    db: Session = Depends(get_db),
    _user: dict = Depends(require_role("admin")),
):
    code = req.locationCode.strip().upper()
    location_type = req.locationType.strip().upper()
    if location_type not in LOCATION_TYPES:
        raise HTTPException(
            status_code=400,
            detail=f"儲位類型必須是 {'/'.join(sorted(LOCATION_TYPES))}",
        )
    warehouse = (
        db.query(Warehouse).filter(Warehouse.warehouse_id == req.warehouseId).first()
    )
    if not warehouse:
        raise HTTPException(status_code=404, detail="倉庫不存在")
    if db.query(StorageLocation).filter(StorageLocation.location_code == code).first():
        raise HTTPException(status_code=400, detail=f"儲位代碼 {code} 已存在")

    location = StorageLocation(
        warehouse_id=req.warehouseId,
        location_code=code,
        location_type=location_type,
        is_quarantine=req.isQuarantine,
        capacity_kg=req.capacityKg,
        capacity_cbm=req.capacityCbm,
        msl_level=req.mslLevel,
    )
    db.add(location)
    db.flush()
    db.add(LocationStatus(location_id=location.location_id, status="AVAILABLE"))
    db.commit()
    db.refresh(location)
    return _serialize(location, warehouse, "AVAILABLE")
