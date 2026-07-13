from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api.deps import get_db, require_role
from app.core.warehouse.replenishment import ReplenishmentService
from app.models.warehouse import StorageLocation
from app.schemas.replenishment import ReplenishmentRuleUpdate, ReplenishmentTaskOut

router = APIRouter(prefix="/api/v1/replenishment", tags=["Replenishment"])


@router.get("/tasks", response_model=list[ReplenishmentTaskOut])
def list_tasks(db: Session = Depends(get_db)):
    return ReplenishmentService(db).list()


@router.post("/generate", response_model=list[ReplenishmentTaskOut])
def generate_tasks(
    db: Session = Depends(get_db),
    user: dict = Depends(require_role("admin", "supervisor")),
):
    return ReplenishmentService(db).generate(user["username"])


@router.put("/locations/{location_id}/rule")
def configure_rule(
    location_id: int,
    request: ReplenishmentRuleUpdate,
    db: Session = Depends(get_db),
    _user: dict = Depends(require_role("admin")),
):
    if request.maximumQty <= request.minimumQty:
        raise HTTPException(
            status_code=400, detail="Maximum quantity must exceed minimum quantity"
        )
    location = (
        db.query(StorageLocation)
        .filter(StorageLocation.location_id == location_id)
        .first()
    )
    if not location:
        raise HTTPException(status_code=404, detail="Storage location not found")
    location.replenishment_sku = request.internalSku
    location.replenishment_min_qty = request.minimumQty
    location.replenishment_max_qty = request.maximumQty
    db.commit()
    return {"success": True}


@router.post("/tasks/{task_id}/complete", response_model=ReplenishmentTaskOut)
def complete_task(
    task_id: int,
    db: Session = Depends(get_db),
    user: dict = Depends(require_role("admin", "supervisor", "operator")),
):
    try:
        return ReplenishmentService(db).complete(task_id, user["username"])
    except ValueError as exc:
        raise HTTPException(
            status_code=404 if "not found" in str(exc).lower() else 409, detail=str(exc)
        ) from exc
