from pydantic import BaseModel
from typing import List, Optional


class ConfirmShipmentRequest(BaseModel):
    so_number: str
    shipper: str
    shipping_notes: Optional[str] = None


class ShipmentDetail(BaseModel):
    internalLotNumber: str
    qty: float
    location: Optional[str] = None


class ConfirmShipmentResponse(BaseModel):
    status: str
    message: str
    details: List[ShipmentDetail]


class PackingListItem(BaseModel):
    sku: str
    lots: List[dict]  # Simplified for packing list structure


class PackingListResponse(BaseModel):
    soNumber: str
    items: List[PackingListItem]


class PendingShipment(BaseModel):
    so_number: str
    customer_name: str
    total_lines: int
    total_qty: float
    status: str
