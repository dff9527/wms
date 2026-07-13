from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api.deps import get_db, get_current_user, require_role
from app.core.warehouse.cycle_count import CycleCountService
from app.schemas.cycle_count import CycleCountCreate, CycleCountEntries, CycleCountOut
from app.models.warehouse import StorageLocation
from app.core.business_logging import log_business_event

router = APIRouter(prefix="/api/v1/cycle-counts", tags=["Cycle Counts"])


def run(action):
    try:
        return action()
    except ValueError as exc:
        status = 404 if "not found" in str(exc).lower() else 400
        raise HTTPException(status_code=status, detail=str(exc)) from exc


@router.get("/locations")
def list_locations(db: Session = Depends(get_db)):
    rows = db.query(StorageLocation).order_by(StorageLocation.location_code).all()
    return [
        {"locationId": row.location_id, "locationCode": row.location_code}
        for row in rows
    ]


@router.get("", response_model=list[CycleCountOut])
def list_counts(db: Session = Depends(get_db)):
    return CycleCountService(db).list_counts()


@router.post("", response_model=CycleCountOut)
def create_count(
    request: CycleCountCreate,
    db: Session = Depends(get_db),
    user: dict = Depends(get_current_user),
):
    return run(
        lambda: CycleCountService(db).create(
            request.locationIds, request.internalSkus, user["username"]
        )
    )


@router.post("/{count_id}/freeze", response_model=CycleCountOut)
def freeze_count(count_id: int, db: Session = Depends(get_db)):
    return run(lambda: CycleCountService(db).freeze(count_id))


@router.put("/{count_id}/entries", response_model=CycleCountOut)
def enter_count(
    count_id: int, request: CycleCountEntries, db: Session = Depends(get_db)
):
    entries = [entry.model_dump() for entry in request.entries]
    return run(lambda: CycleCountService(db).enter(count_id, entries))


@router.post("/{count_id}/submit", response_model=CycleCountOut)
def submit_count(count_id: int, db: Session = Depends(get_db)):
    return run(lambda: CycleCountService(db).submit(count_id))


@router.post("/{count_id}/approve", response_model=CycleCountOut)
def approve_count(
    count_id: int,
    db: Session = Depends(get_db),
    user: dict = Depends(require_role("admin", "supervisor")),
):
    result = run(lambda: CycleCountService(db).review(count_id, True, user["username"]))
    log_business_event(user["username"], "cycle_count_approve")
    return result


@router.post("/{count_id}/reject", response_model=CycleCountOut)
def reject_count(
    count_id: int,
    db: Session = Depends(get_db),
    user: dict = Depends(require_role("admin", "supervisor")),
):
    return run(lambda: CycleCountService(db).review(count_id, False, user["username"]))
