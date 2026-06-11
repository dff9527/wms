from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import Optional

from app.core.warehouse.picking import PickingEngine, InsufficientInventoryError
from app.schemas.picking import (
    AllocateRequest, 
    AllocateResponse, 
    PickWaveTaskOut, 
    ConfirmPickRequest, 
    ConfirmPickResponse
)
from app.api.deps import get_db, get_current_user

router = APIRouter(prefix="/api/v1/picking", tags=["picking"])


@router.post("/allocate", response_model=AllocateResponse)
def allocate(request: AllocateRequest, db: Session = Depends(get_db)):
    try:
        engine = PickingEngine(db)
        result = engine.allocate_lots_for_so(request.so_number)
        db.commit()
        return result
    except ValueError as e:
        db.rollback()
        msg = str(e)
        if "not found" in msg:
            raise HTTPException(status_code=404, detail=msg)
        raise HTTPException(status_code=400, detail=msg)
    except InsufficientInventoryError as e:
        # 全有全無:配不足時回滾,不留部分保留
        db.rollback()
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/wave")
def get_wave(picker: Optional[str] = None, db: Session = Depends(get_db)):
    engine = PickingEngine(db)
    wave = engine.generate_pick_wave(picker_id=picker)
    return wave


@router.post("/confirm", response_model=ConfirmPickResponse)
def confirm_pick(
    request: ConfirmPickRequest,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    try:
        engine = PickingEngine(db)
        # picker 以登入者為準,不信任 body
        result = engine.confirm_pick(request.task_id, request.picked_qty, current_user["username"])
        db.commit()
        return result
    except ValueError as e:
        msg = str(e)
        if "not found" in msg:
            raise HTTPException(status_code=404, detail=msg)
        raise HTTPException(status_code=400, detail=msg)


@router.get("/orders")
def list_orders(db: Session = Depends(get_db)):
    """銷售訂單清單(揀貨頁卡片用),最近 100 筆。"""
    from app.models.order import SalesOrder, SOLine
    from app.models.customer import Customer

    sos = (
        db.query(SalesOrder)
        .order_by(SalesOrder.order_date.desc(), SalesOrder.so_id.desc())
        .limit(100)
        .all()
    )

    customer_ids = {so.customer_id for so in sos if so.customer_id is not None}
    cmap = {}
    if customer_ids:
        for c in db.query(Customer).filter(Customer.customer_id.in_(customer_ids)).all():
            cmap[c.customer_id] = c.customer_name

    so_ids = [so.so_id for so in sos]
    lines_by_so: dict = {}
    if so_ids:
        for line in db.query(SOLine).filter(SOLine.so_id.in_(so_ids)).all():
            lines_by_so.setdefault(line.so_id, []).append(line)

    return [
        {
            "soNumber": so.so_number,
            "customer": cmap.get(so.customer_id, ""),
            "orderDate": so.order_date.isoformat() if so.order_date else "",
            "status": so.status,
            "totalLines": len(lines_by_so.get(so.so_id, [])),
            "totalQty": sum(l.ordered_qty for l in lines_by_so.get(so.so_id, [])),
            "strategy": so.lot_selection_rule or "FIFO",
        }
        for so in sos
    ]


@router.get("/tasks")
def list_tasks(db: Session = Depends(get_db)):
    from app.models.order import PickTask
    tasks = db.query(PickTask).all()
    return [
        {
            "task_id": t.task_id,
            "so_line_id": t.so_line_id,
            "lot_id": t.lot_id,
            "from_location_id": t.from_location_id,
            "pick_qty": t.pick_qty,
            "status": t.status,
        }
        for t in tasks
    ]
