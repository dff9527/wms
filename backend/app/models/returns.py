from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class ReturnOrder(Base):
    __tablename__ = "return_orders"

    return_id: Mapped[int] = mapped_column(Integer, primary_key=True)
    return_number: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    return_type: Mapped[str] = mapped_column(String(20), nullable=False)
    lot_id: Mapped[int] = mapped_column(
        ForeignKey("inventory_lots.lot_id"), nullable=False
    )
    quantity: Mapped[int] = mapped_column(Integer, nullable=False)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="COMPLETED")
    reason: Mapped[str] = mapped_column(Text, nullable=False)
    counterparty_reference: Mapped[str | None] = mapped_column(String(100))
    created_by: Mapped[str] = mapped_column(String(50), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
