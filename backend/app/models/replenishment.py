from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class ReplenishmentTask(Base):
    __tablename__ = "replenishment_tasks"

    task_id: Mapped[int] = mapped_column(Integer, primary_key=True)
    internal_sku: Mapped[str] = mapped_column(
        ForeignKey("items.internal_sku"), nullable=False
    )
    lot_id: Mapped[int] = mapped_column(
        ForeignKey("inventory_lots.lot_id"), nullable=False
    )
    from_location_id: Mapped[int] = mapped_column(
        ForeignKey("storage_locations.location_id"), nullable=False
    )
    to_location_id: Mapped[int] = mapped_column(
        ForeignKey("storage_locations.location_id"), nullable=False
    )
    quantity: Mapped[int] = mapped_column(Integer, nullable=False)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="OPEN")
    created_by: Mapped[str] = mapped_column(String(50), nullable=False)
    completed_by: Mapped[str | None] = mapped_column(String(50))
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    completed_at: Mapped[datetime | None] = mapped_column(DateTime)
