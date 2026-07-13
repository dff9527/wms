from __future__ import annotations

from datetime import datetime

from sqlalchemy import (
    Boolean,
    DateTime,
    ForeignKey,
    Integer,
    Numeric,
    String,
    Text,
    func,
)
from sqlalchemy.dialects.postgresql import ARRAY
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class Warehouse(Base):
    __tablename__ = "warehouses"

    warehouse_id: Mapped[int] = mapped_column(Integer, primary_key=True)
    warehouse_code: Mapped[str] = mapped_column(String(10), unique=True, nullable=False)
    warehouse_name: Mapped[str] = mapped_column(String(100), nullable=False)
    location: Mapped[str | None] = mapped_column(String(200))
    is_esd_controlled: Mapped[bool] = mapped_column(Boolean, default=False)
    temperature_range: Mapped[str | None] = mapped_column(String(20))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())


class StorageLocation(Base):
    __tablename__ = "storage_locations"

    location_id: Mapped[int] = mapped_column(Integer, primary_key=True)
    warehouse_id: Mapped[int | None] = mapped_column(
        ForeignKey("warehouses.warehouse_id")
    )
    location_code: Mapped[str] = mapped_column(String(20), unique=True, nullable=False)
    location_type: Mapped[str | None] = mapped_column(String(10))
    parent_location_id: Mapped[int | None] = mapped_column(
        ForeignKey("storage_locations.location_id")
    )
    capacity_kg: Mapped[float | None] = mapped_column(Numeric(10, 2))
    capacity_cbm: Mapped[float | None] = mapped_column(Numeric(10, 3))
    msl_level: Mapped[int | None] = mapped_column(Integer)
    allowed_item_types: Mapped[list[str] | None] = mapped_column(ARRAY(Text))
    is_quarantine: Mapped[bool] = mapped_column(Boolean, default=False)
    barcode: Mapped[str | None] = mapped_column(String(50))
    replenishment_sku: Mapped[str | None] = mapped_column(
        ForeignKey("items.internal_sku")
    )
    replenishment_min_qty: Mapped[int] = mapped_column(Integer, default=0)
    replenishment_max_qty: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())


class LocationStatus(Base):
    __tablename__ = "location_status"

    location_id: Mapped[int] = mapped_column(
        ForeignKey("storage_locations.location_id"), primary_key=True
    )
    current_occupancy_pct: Mapped[float | None] = mapped_column(
        Numeric(5, 2), default=0
    )
    last_inventory_date: Mapped[datetime | None] = mapped_column(DateTime)
    status: Mapped[str] = mapped_column(String(20), default="AVAILABLE")
    updated_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
