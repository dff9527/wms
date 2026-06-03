from __future__ import annotations

from datetime import datetime

from sqlalchemy import Boolean, CHAR, DateTime, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class Item(Base):
    __tablename__ = "items"

    item_id: Mapped[int] = mapped_column(Integer, primary_key=True)
    internal_sku: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    item_type: Mapped[str | None] = mapped_column(String(20))
    description: Mapped[str | None] = mapped_column(Text)
    manufacturer: Mapped[str | None] = mapped_column(String(100))
    mpq: Mapped[int | None] = mapped_column(Integer)
    spq: Mapped[int | None] = mapped_column(Integer)
    base_unit: Mapped[str] = mapped_column(String(10), default="PCS")
    msl_level: Mapped[int | None] = mapped_column(Integer)
    rohs_compliant: Mapped[bool] = mapped_column(Boolean, default=True)
    reach_compliant: Mapped[bool] = mapped_column(Boolean, default=True)
    safety_stock: Mapped[int] = mapped_column(Integer, default=0)
    reorder_point: Mapped[int] = mapped_column(Integer, default=0)
    abc_category: Mapped[str | None] = mapped_column(CHAR(1))
    lot_control_required: Mapped[bool] = mapped_column(Boolean, default=True)
    date_code_required: Mapped[bool] = mapped_column(Boolean, default=True)
    coc_required: Mapped[bool] = mapped_column(Boolean, default=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
