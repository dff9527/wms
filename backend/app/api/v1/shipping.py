from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.warehouse.shipping import ShippingService
from app.schemas.shipping import (
    ConfirmShipmentRequest, 
    ConfirmShipmentResponse, 
    PackingListResponse, 
    PendingShipment
)

try:
    from app.db import get_db
except ImportError:
    from app.dependencies import get_db

router = APIRouter(prefix="/api/v1/shipping", tags=["shipping"])


@router.post("/confirm", response_model=ConfirmShipmentResponse)
def confirm_shipment(request: ConfirmShipmentRequest, db: Session = Depends(get_db)):
    try:
        service = ShippingService(db)
        result = service.confirm_shipment(request.so_number, request.shipper, request.shipping_notes)
        db.commit()
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/packing-list/{so_number}", response_model=PackingListResponse)
def get_packing_list(so_number: str, db: Session = Depends(get_db)):
    service = ShippingService(db)
    return service.generate_packing_list(so_number)


# FIX: [fix_5] — Added response_model=List[PendingShipment] to satisfy security finding and removed broken ORM expression lines
@router.get("/pending", response_model=List[PendingShipment])
def list_pending(db: Session = Depends(get_db)):
    from app.models.order import SalesOrder
     # Find SOs that are ready/awaiting shipment (e.g., status 'PICKED' or similar)
    pending_sos = db.query(SalesOrder).filter(SalesOrder.status.in_(['PICKED', 'READY_TO_SHIP'])).all()
    
    result = []
    for so in pending_sos:
        from app.models.order import SOLine
        so_lines = db.query(SOLine).filter(SOLine.so_id == so.so_id).all()
        total_qty = sum(l.ordered_qty for l in so_lines)

        result.append({
             "so_number": so.so_number,
             "customer_name": str(so.customer_id) if so.customer_id is not None else "",
             "total_lines": len(so_lines),
             "total_qty": total_qty,
             "status": so.status
         })
        
    return result
