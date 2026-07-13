from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.api.deps import get_db, require_role
from app.models.vendor import Vendor

router = APIRouter(prefix="/vendors", tags=["vendors"])


class VendorCreate(BaseModel):
    vendor_code: str = Field(min_length=1, max_length=20)
    vendor_name: str = Field(min_length=1, max_length=100)
    requires_relabeling: bool = True


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


@router.post("", status_code=201)
def create_vendor(
    request: VendorCreate,
    db: Session = Depends(get_db),
    _user: dict = Depends(require_role("admin")),
):
    code = request.vendor_code.strip().upper()
    if db.query(Vendor).filter(Vendor.vendor_code == code).first():
        raise HTTPException(status_code=400, detail=f"供應商代碼 {code} 已存在")
    vendor = Vendor(
        vendor_code=code,
        vendor_name=request.vendor_name.strip(),
        requires_relabeling=request.requires_relabeling,
        is_active=True,
    )
    db.add(vendor)
    db.commit()
    db.refresh(vendor)
    return {
        "vendor_id": vendor.vendor_id,
        "vendor_code": vendor.vendor_code,
        "vendor_name": vendor.vendor_name,
        "is_active": vendor.is_active,
    }
