from datetime import date, datetime, time, timedelta

from fastapi import APIRouter, Depends
from sqlalchemy import case, func
from sqlalchemy.orm import Session

from app.api.deps import get_db
from app.models.inventory import InventoryLot, InventoryTransaction
from app.schemas.dashboard import (
    DailyTrendPoint,
    InventoryStatusOut,
    InventoryStatusSlice,
    RecentActivityOut,
    TodayReceivingOut,
)

router = APIRouter(tags=["Dashboard"])


@router.get("/today-receiving", response_model=TodayReceivingOut)
def today_receiving(db: Session = Depends(get_db)):
    today = date.today()
    start = datetime.combine(today, time.min)
    end = start + timedelta(days=1)
    count, total_quantity = (
        db.query(
            func.count(InventoryTransaction.transaction_id),
            func.coalesce(func.sum(InventoryTransaction.quantity_change), 0),
        )
        .filter(
            InventoryTransaction.transaction_type == "RECEIVE",
            InventoryTransaction.executed_at >= start,
            InventoryTransaction.executed_at < end,
        )
        .one()
    )
    return TodayReceivingOut(
        date=today,
        count=int(count or 0),
        total_quantity=int(total_quantity or 0),
    )


@router.get("/daily-trend", response_model=list[DailyTrendPoint])
def daily_trend(db: Session = Depends(get_db)):
    today = date.today()
    start_date = today - timedelta(days=13)
    rows = (
        db.query(
            func.date(InventoryTransaction.executed_at).label("day"),
            func.coalesce(
                func.sum(
                    case(
                        (
                            InventoryTransaction.transaction_type == "RECEIVE",
                            InventoryTransaction.quantity_change,
                        ),
                        else_=0,
                    )
                ),
                0,
            ).label("receiving"),
            func.coalesce(
                func.sum(
                    case(
                        (
                            InventoryTransaction.transaction_type == "SHIP",
                            func.abs(InventoryTransaction.quantity_change),
                        ),
                        else_=0,
                    )
                ),
                0,
            ).label("shipping"),
        )
        .filter(
            InventoryTransaction.executed_at >= datetime.combine(start_date, time.min),
            InventoryTransaction.transaction_type.in_(["RECEIVE", "SHIP"]),
        )
        .group_by(func.date(InventoryTransaction.executed_at))
        .all()
    )
    by_date = {
        (
            row.day if isinstance(row.day, date) else date.fromisoformat(str(row.day))
        ): row
        for row in rows
    }
    return [
        DailyTrendPoint(
            date=day,
            receiving=int(by_date[day].receiving) if day in by_date else 0,
            shipping=int(by_date[day].shipping) if day in by_date else 0,
        )
        for day in (start_date + timedelta(days=offset) for offset in range(14))
    ]


@router.get("/inventory-status", response_model=InventoryStatusOut)
def inventory_status(db: Session = Depends(get_db)):
    """庫存狀態彙總(DB 端 GROUP BY,不受清單分頁上限影響)。"""
    rows = (
        db.query(
            InventoryLot.lot_status,
            func.coalesce(func.sum(InventoryLot.quantity_on_hand), 0),
        )
        .filter(InventoryLot.lot_status != "VOID")
        .group_by(InventoryLot.lot_status)
        .all()
    )
    breakdown = [
        InventoryStatusSlice(status=lot_status or "UNKNOWN", quantity=int(quantity))
        for lot_status, quantity in rows
    ]
    return InventoryStatusOut(
        total_quantity=sum(slice_.quantity for slice_ in breakdown),
        breakdown=breakdown,
    )


@router.get("/recent-activities", response_model=list[RecentActivityOut])
def recent_activities(db: Session = Depends(get_db)):
    rows = (
        db.query(InventoryTransaction, InventoryLot)
        .outerjoin(InventoryLot, InventoryTransaction.lot_id == InventoryLot.lot_id)
        .order_by(
            InventoryTransaction.executed_at.desc(),
            InventoryTransaction.transaction_id.desc(),
        )
        .limit(20)
        .all()
    )
    return [
        RecentActivityOut(
            id=transaction.transaction_id,
            type=transaction.transaction_type,
            lot_id=transaction.lot_id,
            internal_sku=lot.internal_sku if lot else None,
            internal_lot_number=lot.internal_lot_number if lot else None,
            quantity_change=transaction.quantity_change,
            reference_number=transaction.reference_number,
            executed_by=transaction.executed_by,
            executed_at=transaction.executed_at,
        )
        for transaction, lot in rows
    ]
