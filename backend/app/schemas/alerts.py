from datetime import date, datetime

from pydantic import BaseModel


class AlertOut(BaseModel):
    type: str
    severity: str
    message: str
    internalSku: str
    lotId: int | None = None
    currentQty: int | None = None
    thresholdQty: int | None = None
    dueDate: date | None = None
    bagOpenedAt: datetime | None = None


class AlertsResponse(BaseModel):
    items: list[AlertOut]
    total: int
