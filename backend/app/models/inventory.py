from __future__ import annotations

from datetime import date, datetime

from sqlalchemy import (
    CheckConstraint,
    Computed,
    Date,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Text,
    func,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class InventoryLot(Base):
    __tablename__ = "inventory_lots"
    __table_args__ = (
        CheckConstraint(
            "quantity_reserved <= quantity_on_hand", name="check_reserved_qty"
        ),
    )

    lot_id: Mapped[int] = mapped_column(Integer, primary_key=True)
    internal_sku: Mapped[str] = mapped_column(
        ForeignKey("items.internal_sku"), nullable=False
    )
    internal_barcode: Mapped[str] = mapped_column(
        String(100), unique=True, nullable=False
    )
    internal_lot_number: Mapped[str] = mapped_column(String(50), nullable=False)

    vendor_id: Mapped[int | None] = mapped_column(ForeignKey("vendors.vendor_id"))
    vendor_pn: Mapped[str | None] = mapped_column(String(100))
    vendor_lot_code: Mapped[str | None] = mapped_column(String(50))
    vendor_date_code: Mapped[str | None] = mapped_column(String(20))
    original_barcode: Mapped[str | None] = mapped_column(String(200))

    quantity_on_hand: Mapped[int] = mapped_column(Integer, nullable=False)
    quantity_reserved: Mapped[int] = mapped_column(Integer, default=0)
    quantity_available: Mapped[int] = mapped_column(
        Integer, Computed("quantity_on_hand - quantity_reserved", persisted=True)
    )
    unit: Mapped[str | None] = mapped_column(String(10))

    location_id: Mapped[int | None] = mapped_column(
        ForeignKey("storage_locations.location_id")
    )

    manufacture_date: Mapped[date | None] = mapped_column(Date)
    receive_date: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    expiry_date: Mapped[date | None] = mapped_column(Date)
    bag_opened_at: Mapped[datetime | None] = mapped_column(DateTime)

    lot_status: Mapped[str] = mapped_column(String(20), default="AVAILABLE")

    iqc_result: Mapped[str | None] = mapped_column(String(10))
    iqc_date: Mapped[datetime | None] = mapped_column(DateTime)
    iqc_inspector: Mapped[str | None] = mapped_column(String(50))
    quality_notes: Mapped[str | None] = mapped_column(Text)

    coc_file_path: Mapped[str | None] = mapped_column(String(500))
    msds_file_path: Mapped[str | None] = mapped_column(String(500))

    parent_lot_id: Mapped[int | None] = mapped_column(
        ForeignKey("inventory_lots.lot_id")
    )
    split_from_transaction_id: Mapped[int | None] = mapped_column(Integer)

    raw_scan_data: Mapped[dict | None] = mapped_column(JSONB)

    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    # 關聯（spec §6.3 引擎程式碼使用 lot.location / lot.vendor）
    location = relationship(
        "StorageLocation", foreign_keys=[location_id], lazy="joined"
    )
    vendor = relationship("Vendor", foreign_keys=[vendor_id], lazy="joined")


class InventoryTransaction(Base):
    __tablename__ = "inventory_transactions"

    transaction_id: Mapped[int] = mapped_column(Integer, primary_key=True)
    transaction_type: Mapped[str] = mapped_column(String(20), nullable=False)
    lot_id: Mapped[int | None] = mapped_column(ForeignKey("inventory_lots.lot_id"))
    quantity_change: Mapped[int] = mapped_column(Integer, nullable=False)
    quantity_before: Mapped[int | None] = mapped_column(Integer)
    quantity_after: Mapped[int | None] = mapped_column(Integer)
    from_location_id: Mapped[int | None] = mapped_column(
        ForeignKey("storage_locations.location_id")
    )
    to_location_id: Mapped[int | None] = mapped_column(
        ForeignKey("storage_locations.location_id")
    )
    reference_type: Mapped[str | None] = mapped_column(String(20))
    reference_number: Mapped[str | None] = mapped_column(String(50))
    executed_by: Mapped[str] = mapped_column(String(50), nullable=False)
    executed_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    device_id: Mapped[str | None] = mapped_column(String(50))
    notes: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
