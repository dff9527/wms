from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import date, datetime


class LotOut(BaseModel):
    """Schema for Inventory Lot output."""

    lot_id: int
    internal_sku: str
    internal_barcode: str
    internal_lot_number: str
    vendor_pn: Optional[str]
    quantity_on_hand: int
    quantity_reserved: int
    location_code: Optional[str] = (
        None  # Joined from storage_locations (set after model_validate)
    )
    lot_status: str
    iqc_result: Optional[str]
    manufacture_date: Optional[date]
    expiry_date: Optional[date]

    class Config:
        from_attributes = True


class LotListQuery(BaseModel):
    """Query parameters for listing lots."""

    sku: Optional[str] = None
    status: Optional[List[str]] = None
    location: Optional[str] = None
    vendor: Optional[int] = None

    def get_excluded_statuses(self) -> List[str]:
        """Default excludes SHIPPED and EXPIRED unless explicitly requested."""
        if self.status:
            return []  # User specified statuses, don't filter out anything implicitly
        return ["SHIPPED", "EXPIRED"]


class AdjustRequest(BaseModel):
    """Request to adjust lot quantity."""

    lotId: int = Field(..., alias="lotId")
    quantityChange: int = Field(..., alias="quantity_change")
    reason: Optional[str] = "Manual Adjustment"
    executedBy: str = Field(default="SYSTEM", alias="executed_by")

    class Config:
        populate_by_name = True


class SplitRequest(BaseModel):
    """Request to split a lot."""

    parentLotId: int = Field(..., alias="parent_lot_id")
    quantityToSplit: int = Field(..., alias="quantity_to_split")
    executedBy: str = Field(default="SYSTEM", alias="executed_by")

    class Config:
        populate_by_name = True
