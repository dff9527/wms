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
# Assuming get_db exists in app.db or similar based on existing routers
try:
    from app.db import get_db
except ImportError:
    # Fallback if structure differs slightly
    from app.dependencies import get_db

router = APIRouter(prefix="/api/v1/picking", tags=["picking"])


@router.post("/allocate", response_model=AllocateResponse)
def allocate(request: AllocateRequest, db: Session = Depends(get_db)):
    try:
        engine = PickingEngine(db)
        result = engine.allocate_lots_for_so(request.so_number)
        db.commit()
        return result
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except InsufficientInventoryError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/wave")
def get_wave(picker: Optional[str] = None, db: Session = Depends(get_db)):
    engine = PickingEngine(db)
    wave = engine.generate_pick_wave(picker_id=picker)
    return wave


@router.post("/confirm", response_model=ConfirmPickResponse)
def confirm_pick(request: ConfirmPickRequest, db: Session = Depends(get_db)):
    try:
        engine = PickingEngine(db)
        result = engine.confirm_pick(request.task_id, request.picked_qty, request.picker)
        db.commit()
        return result
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.get("/tasks")
def list_tasks(db: Session = Depends(get_db)):
    # Simple pass-through to engine or direct query if needed
    from app.models.order import PickTask
    tasks = db.query(PickTask).all()
    return [t.__dict__ for t in tasks]
