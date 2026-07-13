from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db, require_role
from app.core.warehouse.returns import ReturnService
from app.schemas.returns import CustomerReturnCreate, ReturnOut, SupplierReturnCreate
from app.core.business_logging import log_business_event

router = APIRouter(prefix="/api/v1/returns", tags=["Returns"])


def execute(action):
    try:
        return action()
    except ValueError as exc:
        raise HTTPException(
            status_code=404 if "not found" in str(exc).lower() else 400, detail=str(exc)
        ) from exc


@router.post("/customer", response_model=ReturnOut)
def customer_return(
    request: CustomerReturnCreate,
    db: Session = Depends(get_db),
    user: dict = Depends(get_current_user),
):
    result = execute(
        lambda: ReturnService(db).customer_return(
            request.lotId,
            request.quantity,
            request.reason,
            request.reference,
            user["username"],
        )
    )
    log_business_event(user["username"], "customer_return", request.lotId)
    return result


@router.post("/supplier", response_model=ReturnOut)
def supplier_return(
    request: SupplierReturnCreate,
    db: Session = Depends(get_db),
    user: dict = Depends(require_role("admin", "supervisor")),
):
    result = execute(
        lambda: ReturnService(db).supplier_return(
            request.lotId,
            request.quantity,
            request.reason,
            request.reference,
            user["username"],
        )
    )
    log_business_event(user["username"], "supplier_return", request.lotId)
    return result
