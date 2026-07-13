from __future__ import annotations

from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class CycleCount(Base):
    __tablename__ = "cycle_counts"

    cycle_count_id: Mapped[int] = mapped_column(Integer, primary_key=True)
    count_number: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    status: Mapped[str] = mapped_column(String(20), default="DRAFT", nullable=False)
    created_by: Mapped[str] = mapped_column(String(50), nullable=False)
    reviewed_by: Mapped[str | None] = mapped_column(String(50))
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    frozen_at: Mapped[datetime | None] = mapped_column(DateTime)
    submitted_at: Mapped[datetime | None] = mapped_column(DateTime)
    reviewed_at: Mapped[datetime | None] = mapped_column(DateTime)

    lines = relationship(
        "CycleCountLine", cascade="all, delete-orphan", lazy="selectin"
    )


class CycleCountLine(Base):
    __tablename__ = "cycle_count_lines"

    cycle_count_line_id: Mapped[int] = mapped_column(Integer, primary_key=True)
    cycle_count_id: Mapped[int] = mapped_column(
        ForeignKey("cycle_counts.cycle_count_id", ondelete="CASCADE"), nullable=False
    )
    location_id: Mapped[int] = mapped_column(
        ForeignKey("storage_locations.location_id"), nullable=False
    )
    lot_id: Mapped[int] = mapped_column(
        ForeignKey("inventory_lots.lot_id"), nullable=False
    )
    internal_sku: Mapped[str] = mapped_column(String(50), nullable=False)
    expected_quantity: Mapped[int] = mapped_column(Integer, nullable=False)
    counted_quantity: Mapped[int | None] = mapped_column(Integer)
    notes: Mapped[str | None] = mapped_column(Text)

    location = relationship("StorageLocation", lazy="joined")
    lot = relationship("InventoryLot", lazy="joined")
