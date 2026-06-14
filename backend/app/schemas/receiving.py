from pydantic import BaseModel, Field
from typing import Optional


class ScanResult(BaseModel):
    """Result from barcode parsing."""

    success: bool
    parsed: Optional[dict] = None  # Contains vendorPn, qty, lotCode, dateCode etc.
    patternUsed: Optional[str] = None


class ReceiveRequest(BaseModel):
    """Request body for processing a receipt."""

    poNumber: str = Field(..., alias="po_number")
    scannedBarcode: str = Field(..., alias="barcode")
    vendorId: int = Field(..., alias="vendor_id")
    quantity: int = Field(..., alias="qty")

    class Config:
        populate_by_name = True


class ReceiveResponse(BaseModel):
    """Response after successful receipt."""

    success: bool
    lotId: int = Field(alias="lotId")
    internalLotNumber: str = Field(alias="internalLotNumber")
    internalBarcode: str = Field(alias="internalBarcode")
    labelUrl: str = Field(alias="labelUrl")

    class Config:
        populate_by_name = True


class IQCRequest(BaseModel):
    """Request to complete IQC inspection."""

    lotId: int = Field(..., alias="lotId")
    result: str = Field(..., description="PASS or FAIL")
    inspector: str
    notes: Optional[str] = None

    class Config:
        populate_by_name = True
