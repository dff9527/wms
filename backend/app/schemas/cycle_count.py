from datetime import datetime

from pydantic import BaseModel, Field


class CycleCountCreate(BaseModel):
    locationIds: list[int] = Field(min_length=1)
    internalSkus: list[str] | None = None


class CycleCountEntry(BaseModel):
    lineId: int
    countedQuantity: int = Field(ge=0)
    notes: str | None = None


class CycleCountEntries(BaseModel):
    entries: list[CycleCountEntry] = Field(min_length=1)


class CycleCountLineOut(BaseModel):
    lineId: int
    locationId: int
    locationCode: str
    lotId: int
    internalSku: str
    internalLotNumber: str
    expectedQuantity: int | None
    countedQuantity: int | None
    variance: int | None
    notes: str | None


class CycleCountOut(BaseModel):
    cycleCountId: int
    countNumber: str
    status: str
    createdBy: str
    reviewedBy: str | None
    createdAt: datetime
    lines: list[CycleCountLineOut]
