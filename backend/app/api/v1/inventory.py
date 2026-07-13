from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Literal, Optional

from app.api.deps import get_db, require_role
from app.services.inventory_service import InventoryService
from app.schemas.inventory import (
    LotOut,
    LotPageOut,
    LotListQuery,
    AdjustRequest,
    SplitRequest,
    LotUpdateRequest,
    MoveRequest,
)

# main.py mounts this under prefix="/api/v1/inventory"; do not add a second prefix here
router = APIRouter(tags=["Inventory"])


@router.get("/lots", response_model=LotPageOut)
def list_lots(
    sku: Optional[str] = None,
    status: Optional[List[str]] = Query(None),
    location: Optional[str] = None,
    vendor: Optional[int] = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=1000),
    sort_by: Literal[
        "internal_sku",
        "internal_lot_number",
        "quantity_on_hand",
        "quantity_reserved",
        "receive_date",
        "expiry_date",
        "lot_status",
        "location_code",
    ] = "receive_date",
    order: Literal["asc", "desc"] = "desc",
    search: Optional[str] = Query(None, max_length=128),
    db: Session = Depends(get_db),
):
    query_params = LotListQuery(
        sku=sku,
        status=status,
        location=location,
        vendor=vendor,
        page=page,
        page_size=page_size,
        sort_by=sort_by,
        order=order,
        search=search,
    )
    service = InventoryService(db)
    return service.get_lots(query_params)


@router.get("/lots/{lot_id}", response_model=LotOut)
def get_lot_detail(lot_id: int, db: Session = Depends(get_db)):
    service = InventoryService(db)
    lot = service.get_lot_detail(lot_id)
    if not lot:
        raise HTTPException(status_code=404, detail="Lot not found")
    return lot


@router.post("/lots/{lot_id}/move")
def move_lot(
    lot_id: int,
    request: MoveRequest,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_role("admin", "supervisor", "operator")),
):
    try:
        return InventoryService(db).move_lot(
            lot_id,
            request.targetLocationCode,
            current_user["username"],
            request.reason,
        )
    except ValueError as exc:
        status = 404 if "not found" in str(exc).lower() else 400
        raise HTTPException(status_code=status, detail=str(exc)) from exc


def msl_action(action):
    try:
        return action()
    except ValueError as exc:
        status = 404 if "not found" in str(exc).lower() else 400
        raise HTTPException(status_code=status, detail=str(exc)) from exc


@router.post("/lots/{lot_id}/open-bag")
def open_msl_bag(
    lot_id: int,
    db: Session = Depends(get_db),
    _user: dict = Depends(require_role("admin", "supervisor", "qc")),
):
    return msl_action(lambda: InventoryService(db).open_msl_bag(lot_id))


@router.post("/lots/{lot_id}/bake")
def bake_msl_lot(
    lot_id: int,
    db: Session = Depends(get_db),
    _user: dict = Depends(require_role("admin", "supervisor", "qc")),
):
    return msl_action(lambda: InventoryService(db).bake_msl_lot(lot_id))


@router.patch("/lots/{lot_id}", response_model=LotOut)
def update_lot(
    lot_id: int,
    request: LotUpdateRequest,
    db: Session = Depends(get_db),
    _current_user: dict = Depends(require_role("admin")),
):
    """Update non-quantity fields (location / quality notes)."""
    service = InventoryService(db)
    try:
        lot = service.update_lot(
            lot_id,
            location_code=request.locationCode,
            quality_notes=request.qualityNotes,
            fields_set=request.model_dump(exclude_unset=True, by_alias=False),
        )
    except ValueError as e:
        msg = str(e)
        if "not found" in msg.lower():
            raise HTTPException(status_code=404, detail=msg)
        raise HTTPException(status_code=400, detail=msg)
    return lot


@router.post("/lots/{lot_id}/void")
def void_lot(
    lot_id: int,
    db: Session = Depends(get_db),
    _current_user: dict = Depends(require_role("admin")),
):
    """
    Soft-void a lot (lot_status = VOID).
    Demo: status-only; does not write inventory_transaction / reverse qty.
    """
    service = InventoryService(db)
    try:
        result = service.void_lot(lot_id)
    except ValueError as e:
        msg = str(e)
        if "not found" in msg.lower():
            raise HTTPException(status_code=404, detail=msg)
        raise HTTPException(status_code=400, detail=msg)
    return result


@router.post("/adjust")
def adjust_inventory(
    request: AdjustRequest,
    db: Session = Depends(get_db),
    current_user: dict = Depends(
        require_role("admin", "supervisor")
    ),  # 調帳限主管/管理員
):
    service = InventoryService(db)
    # dump by FIELD name (lotId/quantityChange/...) to match what the service reads
    req_dict = request.model_dump()
    result = service.adjust_quantity(req_dict, executed_by=current_user["username"])
    return result


@router.post("/split")
def split_lot_endpoint(
    request: SplitRequest,
    db: Session = Depends(get_db),
    current_user: dict = Depends(
        require_role("admin", "supervisor")
    ),  # 拆帶限主管/管理員
):
    service = InventoryService(db)
    req_dict = request.model_dump()
    result = service.split_lot(req_dict, executed_by=current_user["username"])
    return result
