from __future__ import annotations

from datetime import date, datetime

from sqlalchemy import (
    Date,
    DateTime,
    ForeignKey,
    Integer,
    Numeric,
    String,
    UniqueConstraint,
    func,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class PurchaseOrder(Base):
    __tablename__ = "purchase_orders"

    po_id: Mapped[int] = mapped_column(Integer, primary_key=True)
    po_number: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    vendor_id: Mapped[int | None] = mapped_column(ForeignKey("vendors.vendor_id"))
    po_date: Mapped[date] = mapped_column(Date, nullable=False)
    expected_delivery_date: Mapped[date | None] = mapped_column(Date)
    status: Mapped[str] = mapped_column(String(20), default="OPEN")
    total_amount: Mapped[float | None] = mapped_column(Numeric(12, 2))
    created_by: Mapped[str | None] = mapped_column(String(50))
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    lines = relationship("POLine", back_populates="po", cascade="all, delete-orphan")


class POLine(Base):
    __tablename__ = "po_lines"
    __table_args__ = (UniqueConstraint("po_id", "line_number"),)

    po_line_id: Mapped[int] = mapped_column(Integer, primary_key=True)
    po_id: Mapped[int] = mapped_column(ForeignKey("purchase_orders.po_id", ondelete="CASCADE"))
    line_number: Mapped[int] = mapped_column(Integer, nullable=False)
    internal_sku: Mapped[str | None] = mapped_column(ForeignKey("items.internal_sku"))
    vendor_pn: Mapped[str | None] = mapped_column(String(100))
    ordered_qty: Mapped[int] = mapped_column(Integer, nullable=False)
    received_qty: Mapped[int] = mapped_column(Integer, default=0)
    unit_price: Mapped[float | None] = mapped_column(Numeric(10, 4))
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    po = relationship("PurchaseOrder", back_populates="lines")


class SalesOrder(Base):
    __tablename__ = "sales_orders"

    so_id: Mapped[int] = mapped_column(Integer, primary_key=True)
    so_number: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    customer_id: Mapped[int | None] = mapped_column(Integer)
    order_date: Mapped[date] = mapped_column(Date, nullable=False)
    required_delivery_date: Mapped[date | None] = mapped_column(Date)
    status: Mapped[str] = mapped_column(String(20), default="OPEN")
    customer_avl: Mapped[dict | None] = mapped_column(JSONB)
    lot_selection_rule: Mapped[str] = mapped_column(String(20), default="FIFO")
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    lines = relationship("SOLine", back_populates="so", cascade="all, delete-orphan")


class SOLine(Base):
    __tablename__ = "so_lines"
    __table_args__ = (UniqueConstraint("so_id", "line_number"),)

    so_line_id: Mapped[int] = mapped_column(Integer, primary_key=True)
    so_id: Mapped[int] = mapped_column(ForeignKey("sales_orders.so_id", ondelete="CASCADE"))
    line_number: Mapped[int] = mapped_column(Integer, nullable=False)
    internal_sku: Mapped[str | None] = mapped_column(ForeignKey("items.internal_sku"))
    ordered_qty: Mapped[int] = mapped_column(Integer, nullable=False)
    allocated_qty: Mapped[int] = mapped_column(Integer, default=0)
    picked_qty: Mapped[int] = mapped_column(Integer, default=0)
    shipped_qty: Mapped[int] = mapped_column(Integer, default=0)
    required_date_code: Mapped[str | None] = mapped_column(String(20))
    required_vendor_id: Mapped[int | None] = mapped_column(ForeignKey("vendors.vendor_id"))
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    so = relationship("SalesOrder", back_populates="lines")


class PickTask(Base):
    __tablename__ = "pick_tasks"

    task_id: Mapped[int] = mapped_column(Integer, primary_key=True)
    so_line_id: Mapped[int | None] = mapped_column(ForeignKey("so_lines.so_line_id"))
    lot_id: Mapped[int | None] = mapped_column(ForeignKey("inventory_lots.lot_id"))
    pick_qty: Mapped[int] = mapped_column(Integer, nullable=False)
    status: Mapped[str] = mapped_column(String(20), default="PENDING")
    assigned_to: Mapped[str | None] = mapped_column(String(50))
    picked_at: Mapped[datetime | None] = mapped_column(DateTime)
    from_location_id: Mapped[int | None] = mapped_column(ForeignKey("storage_locations.location_id"))
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    # 關聯（spec §6.3 引擎使用 task.lot / task.so_line / task.from_location）
    lot = relationship("InventoryLot", foreign_keys=[lot_id])
    so_line = relationship("SOLine", foreign_keys=[so_line_id])
    from_location = relationship("StorageLocation", foreign_keys=[from_location_id])
