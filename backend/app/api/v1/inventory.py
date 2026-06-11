from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional

from app.api.deps import get_db, require_role
from app.services.inventory_service import InventoryService
from app.schemas.inventory import LotOut, LotListQuery, AdjustRequest, SplitRequest

# main.py mounts this under prefix="/api/v1/inventory"; do not add a second prefix here
router = APIRouter(tags=["Inventory"])


@router.get("/lots", response_model=List[LotOut])
def list_lots(
    sku: Optional[str] = None,
    status: Optional[List[str]] = Query(None),
    location: Optional[str] = None,
    vendor: Optional[int] = None,
    db: Session = Depends(get_db),
):
    query_params = LotListQuery(sku=sku, status=status, location=location, vendor=vendor)
    service = InventoryService(db)
    return service.get_lots(query_params)


@router.get("/lots/{lot_id}", response_model=LotOut)
def get_lot_detail(lot_id: int, db: Session = Depends(get_db)):
    service = InventoryService(db)
    lot = service.get_lot_detail(lot_id)
    if not lot:
        raise HTTPException(status_code=404, detail="Lot not found")
    return lot


@router.post("/adjust")
def adjust_inventory(
    request: AdjustRequest,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_role("admin", "supervisor")),  # 調帳限主管/管理員
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
    current_user: dict = Depends(require_role("admin", "supervisor")),  # 拆帶限主管/管理員
):
    service = InventoryService(db)
    req_dict = request.model_dump()
    result = service.split_lot(req_dict, executed_by=current_user["username"])
    return result
