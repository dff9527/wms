from __future__ import annotations

from datetime import datetime

from sqlalchemy import (
    Boolean,
    CHAR,
    DateTime,
    ForeignKey,
    Integer,
    Numeric,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.dialects.postgresql import ARRAY, JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class Vendor(Base):
    __tablename__ = "vendors"

    vendor_id: Mapped[int] = mapped_column(Integer, primary_key=True)
    vendor_code: Mapped[str] = mapped_column(String(20), unique=True, nullable=False)
    vendor_name: Mapped[str] = mapped_column(String(100), nullable=False)
    vendor_type: Mapped[str | None] = mapped_column(String(20))
    iso9001_certified: Mapped[bool] = mapped_column(Boolean, default=False)
    iatf16949_certified: Mapped[bool] = mapped_column(Boolean, default=False)
    default_barcode_format: Mapped[str | None] = mapped_column(String(50))
    requires_relabeling: Mapped[bool] = mapped_column(Boolean, default=True)
    quality_rating: Mapped[str | None] = mapped_column(CHAR(1))
    on_time_delivery_rate: Mapped[float | None] = mapped_column(Numeric(5, 2))
    contact_info: Mapped[dict | None] = mapped_column(JSONB)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())


class BarcodePattern(Base):
    __tablename__ = "barcode_patterns"
    __table_args__ = (UniqueConstraint("vendor_id", "pattern_name"),)

    pattern_id: Mapped[int] = mapped_column(Integer, primary_key=True)
    vendor_id: Mapped[int | None] = mapped_column(ForeignKey("vendors.vendor_id"))
    pattern_name: Mapped[str] = mapped_column(String(50), nullable=False)
    regex_rule: Mapped[str] = mapped_column(Text, nullable=False)
    field_mapping: Mapped[dict] = mapped_column(JSONB, nullable=False)
    priority: Mapped[int] = mapped_column(Integer, default=0)
    validation_rules: Mapped[dict | None] = mapped_column(JSONB)
    multi_scan_mode: Mapped[bool] = mapped_column(Boolean, default=False)
    scan_sequence: Mapped[list[str] | None] = mapped_column(ARRAY(Text))
    quantity_conversion: Mapped[dict | None] = mapped_column(JSONB)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())


class VendorItem(Base):
    __tablename__ = "vendor_items"
    __table_args__ = (UniqueConstraint("vendor_id", "vendor_pn"),)

    mapping_id: Mapped[int] = mapped_column(Integer, primary_key=True)
    vendor_id: Mapped[int | None] = mapped_column(ForeignKey("vendors.vendor_id"))
    vendor_pn: Mapped[str] = mapped_column(String(100), nullable=False)
    internal_sku: Mapped[str | None] = mapped_column(ForeignKey("items.internal_sku"))
    barcode_pattern_id: Mapped[int | None] = mapped_column(ForeignKey("barcode_patterns.pattern_id"))
    approval_status: Mapped[str] = mapped_column(String(20), default="APPROVED")
    preferred_vendor: Mapped[bool] = mapped_column(Boolean, default=False)
    latest_unit_price: Mapped[float | None] = mapped_column(Numeric(10, 4))
    currency: Mapped[str] = mapped_column(String(3), default="USD")
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
