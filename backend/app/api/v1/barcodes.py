from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.api.deps import get_db, get_current_user, require_role
from app.services.barcode_service import (
    parse_barcode,
    learn_pattern,
    list_patterns,
    create_pattern,
    update_pattern,
    delete_pattern,
)
from app.schemas.barcode import (
    ScanRequest,
    ParseResult,
    LearnRequest,
    LearnResult,
    CreatePatternRequest,
    PatternOut,
    UpdatePatternRequest,
)

router = APIRouter(prefix="/barcodes", tags=["barcodes"])


@router.post("/parse", response_model=ParseResult)
def scan_parse(
    req: ScanRequest,
    db: Session = Depends(get_db),
    _current_user: dict = Depends(get_current_user),
):
    """
    Parse a single barcode string against rules for the given vendor.
    Returns 422 if no pattern matches.
    """
    result = parse_barcode(db, req.barcode, req.vendor_id)

    if result is None:
        raise HTTPException(
            status_code=422,
            detail=f"No matching barcode pattern found for vendor {req.vendor_id}",
        )

    return result


@router.post("/learn", response_model=LearnResult)
def learn_new_pattern(
    req: LearnRequest,
    db: Session = Depends(get_db),
    _current_user: dict = Depends(get_current_user),
):
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
    _current_user: dict = Depends(get_current_user),
):
    """
    List barcode patterns. Filter by vendor_id if provided.
    Pass include_inactive=true for the admin view (shows disabled rules too).
    """
    return list_patterns(db, vendor_id=vendor_id, include_inactive=include_inactive)


@router.post("/patterns", response_model=PatternOut, status_code=201)
def add_pattern(
    req: CreatePatternRequest,
    db: Session = Depends(get_db),
    _current_user: dict = Depends(require_role("admin")),
):
    """
    Manually create a barcode pattern. Returns 400 if the regex is invalid
    or the vendor does not exist.
    """
    try:
        return create_pattern(db, req)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.patch("/patterns/{pattern_id}", response_model=PatternOut)
def update_pattern_route(
    pattern_id: int,
    req: UpdatePatternRequest,
    db: Session = Depends(get_db),
    _current_user: dict = Depends(require_role("admin")),
):
    """
    Edit a barcode pattern. Returns 400 if the regex is invalid,
    or 404 if the pattern does not exist.
    """
    try:
        return update_pattern(db, pattern_id, req)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.delete("/patterns/{pattern_id}")
def delete_pattern_route(
    pattern_id: int,
    db: Session = Depends(get_db),
    _current_user: dict = Depends(require_role("admin")),
):
    """
    Soft-delete a barcode pattern (set is_active=False). Returns 200 on success.
    """
    try:
        delete_pattern(db, pattern_id)
        return {"detail": "deleted"}
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
