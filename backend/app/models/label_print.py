from __future__ import annotations

from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class LabelPrint(Base):
    __tablename__ = "label_prints"

    label_print_id: Mapped[int] = mapped_column(Integer, primary_key=True)
    lot_id: Mapped[int] = mapped_column(
        ForeignKey("inventory_lots.lot_id"), nullable=False
    )
    print_number: Mapped[int] = mapped_column(Integer, nullable=False)
    printed_by: Mapped[str] = mapped_column(String(50), nullable=False)
    is_reprint: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    printed_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    voided_at: Mapped[datetime | None] = mapped_column(DateTime)
    voided_by: Mapped[str | None] = mapped_column(String(50))
    void_reason: Mapped[str | None] = mapped_column(Text)
