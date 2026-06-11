from pydantic import BaseModel
from typing import List, Optional


class AllocateRequest(BaseModel):
    so_number: str


class AllocationDetail(BaseModel):
    rank: int
    internalSku: str
    internalLotNumber: str
    internalBarcode: str
    vendorLotCode: Optional[str] = None   # 拆帶/調整批次可能沒有原廠批號
    qty: float
    receiveDate: str
    location: Optional[str] = None


class LineAllocationResult(BaseModel):
    line_number: int
    success: bool
    tasks_created: int
    allocated_qty: float
    allocation_details: List[AllocationDetail]
    error: Optional[str] = None


class AllocateResponse(BaseModel):
    soNumber: str
    results: List[LineAllocationResult]
    strategy_used: str
    # Summary fields for frontend compatibility if needed, though spec says details[] in response
    internalSku: Optional[str] = None
    requestedQty: Optional[float] = None
    allocatedQty: Optional[float] = None
    details: Optional[List[AllocationDetail]] = None


class PickWaveTaskOut(BaseModel):
    sequence: int
    location: Optional[str] = None
    internalSku: str
    internalLotNumber: str
    internalBarcode: str
    vendorLotCode: str
    pickQty: float
    receiveDate: str
    expiryDate: Optional[str] = None
    status: str
    soNumber: str


class ConfirmPickRequest(BaseModel):
    task_id: int
    picked_qty: float
    picker: str


class ConfirmPickResponse(BaseModel):
    status: str
    message: str
