from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import get_db
from app.models.vendor import Vendor

router = APIRouter(prefix="/vendors", tags=["vendors"])


@router.get("")
def list_vendors(db: Session = Depends(get_db)):
    """List all vendors for selectors / dropdowns, ordered by vendor_id."""
    vendors = db.query(Vendor).order_by(Vendor.vendor_id).all()
    return [
        {
            "vendor_id": v.vendor_id,
            "vendor_code": v.vendor_code,
            "vendor_name": v.vendor_name,
            "is_active": v.is_active,
        }
        for v in vendors
    ]
