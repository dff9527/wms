from datetime import date, datetime

from pydantic import BaseModel


class TodayReceivingOut(BaseModel):
    date: date
    count: int
    total_quantity: int


class DailyTrendPoint(BaseModel):
    date: date
    receiving: int
    shipping: int


class RecentActivityOut(BaseModel):
    id: int
    type: str
    lot_id: int | None
    internal_sku: str | None
    internal_lot_number: str | None
    quantity_change: int
    reference_number: str | None
    executed_by: str
    executed_at: datetime
