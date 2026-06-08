from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.api.deps import get_db
from app.services.barcode_service import (
    parse_barcode,
    learn_pattern,
    list_patterns,
    create_pattern,
    set_pattern_active,
)
from app.schemas.barcode import (
    ScanRequest,
    ParseResult,
    LearnRequest,
    LearnResult,
    CreatePatternRequest,
    PatternOut,
    SetPatternActiveRequest,
)

router = APIRouter(prefix="/barcodes", tags=["barcodes"])


@router.post("/parse", response_model=ParseResult)
def scan_parse(req: ScanRequest, db: Session = Depends(get_db)):
    """
    Parse a single barcode string against rules for the given vendor.
    Returns 422 if no pattern matches.
    """
    result = parse_barcode(db, req.barcode, req.vendor_id)
    
    if result is None:
        raise HTTPException(
            status_code=422, 
            detail=f"No matching barcode pattern found for vendor {req.vendor_id}"
        )
        
    return result


@router.post("/learn", response_model=LearnResult)
def learn_new_pattern(req: LearnRequest, db: Session = Depends(get_db)):
    """
    Infer a new barcode pattern from samples using AI.
    Optionally save to database if save_pattern=True.
    """
    try:
        return learn_pattern(db, req, save=req.save_pattern)
    except ValueError as e:
        raise HTTPException(status_code=503, detail=str(e))
    except RuntimeError as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/patterns")
def get_patterns(
    vendor_id: int | None = None,
    include_inactive: bool = False,
    db: Session = Depends(get_db),
):
    """
    List barcode patterns. Filter by vendor_id if provided.
    Pass include_inactive=true for the admin view (shows disabled rules too).
    """
    return list_patterns(db, vendor_id=vendor_id, include_inactive=include_inactive)


@router.post("/patterns", response_model=PatternOut, status_code=201)
def add_pattern(req: CreatePatternRequest, db: Session = Depends(get_db)):
    """
    Manually create a barcode pattern. Returns 400 if the regex is invalid
    or the vendor does not exist.
    """
    try:
        return create_pattern(db, req)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.patch("/patterns/{pattern_id}", response_model=PatternOut)
def toggle_pattern(
    pattern_id: int,
    req: SetPatternActiveRequest,
    db: Session = Depends(get_db),
):
    """Enable/disable a barcode pattern. Returns 404 if not found."""
    try:
        return set_pattern_active(db, pattern_id, req.is_active)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))

