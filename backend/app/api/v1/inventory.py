from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional

from app.database import get_db   # type: ignore
from app.services.inventory_service import InventoryService
from app.schemas.inventory import LotOut, LotListQuery, AdjustRequest, SplitRequest

router = APIRouter(prefix="/inventory", tags=["Inventory"])


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
def adjust_inventory(request: AdjustRequest, db: Session = Depends(get_db)):
    service = InventoryService(db)
     # Convert Pydantic model to dict for service layer compatibility
    req_dict = request.model_dump(by_alias=True)
    result = service.adjust_quantity(req_dict, executed_by=request.executedBy)
    return result


@router.post("/split")
def split_lot_endpoint(request: SplitRequest, db: Session = Depends(get_db)):
    service = InventoryService(db)
    req_dict = request.model_dump(by_alias=True)
    result = service.split_lot(req_dict, executed_by=request.executedBy)
    return result
