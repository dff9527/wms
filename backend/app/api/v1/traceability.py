from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.traceability.tracer import TraceabilityEngine

try:
    from app.db import get_db
except ImportError:
    from app.dependencies import get_db

router = APIRouter(prefix="/api/v1/trace", tags=["traceability"])


@router.get("/forward")
def trace_forward(query: str, db: Session = Depends(get_db)):
    engine = TraceabilityEngine(db)
    result = engine.trace_forward(query)
    if not result:
        raise HTTPException(status_code=404, detail="Lot/Barcode not found")
    return result


@router.get("/backward")
def trace_backward(internal_barcode: str, db: Session = Depends(get_db)):
    engine = TraceabilityEngine(db)
    result = engine.trace_backward(internal_barcode)
    if not result:
        raise HTTPException(status_code=404, detail="Internal Barcode not found")
    return result
