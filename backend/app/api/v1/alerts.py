from datetime import date, timedelta

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.api.deps import get_db
from app.models.inventory import InventoryLot
from app.models.item import Item
from app.schemas.alerts import AlertsResponse

router = APIRouter(prefix="/api/v1/alerts", tags=["Alerts"])


@router.get("", response_model=AlertsResponse)
def list_alerts(
    days: int = Query(default=30, ge=1, le=365), db: Session = Depends(get_db)
):
    today = date.today()
    horizon = today + timedelta(days=days)
    alerts = []

    expiring = (
        db.query(InventoryLot)
        .filter(
            InventoryLot.quantity_on_hand > 0,
            InventoryLot.lot_status.in_(["AVAILABLE", "RESERVED", "QUARANTINE"]),
            InventoryLot.expiry_date.isnot(None),
            InventoryLot.expiry_date <= horizon,
        )
        .order_by(InventoryLot.expiry_date)
        .all()
    )
    for lot in expiring:
        overdue = lot.expiry_date < today
        is_msl = lot.bag_opened_at is not None
        alert_type = "MSL_EXPIRED" if is_msl and overdue else "EXPIRING_LOT"
        severity = "critical" if overdue else "warning"
        alerts.append(
            {
                "type": alert_type,
                "severity": severity,
                "message": (
                    "MSL floor life 已逾時"
                    if alert_type == "MSL_EXPIRED"
                    else ("批次已過期" if overdue else f"批次將於 {days} 天內到期")
                ),
                "internalSku": lot.internal_sku,
                "lotId": lot.lot_id,
                "dueDate": lot.expiry_date,
                "bagOpenedAt": lot.bag_opened_at,
            }
        )

    stock_rows = (
        db.query(
            Item.internal_sku,
            Item.safety_stock,
            func.coalesce(func.sum(InventoryLot.quantity_available), 0),
        )
        .outerjoin(
            InventoryLot,
            (InventoryLot.internal_sku == Item.internal_sku)
            & InventoryLot.lot_status.in_(["AVAILABLE", "RESERVED"]),
        )
        .filter(Item.is_active.is_(True), Item.safety_stock > 0)
        .group_by(Item.internal_sku, Item.safety_stock)
        .having(
            func.coalesce(func.sum(InventoryLot.quantity_available), 0)
            < Item.safety_stock
        )
        .all()
    )
    for sku, threshold, current in stock_rows:
        alerts.append(
            {
                "type": "LOW_STOCK",
                "severity": "critical" if current == 0 else "warning",
                "message": "可用庫存低於安全庫存",
                "internalSku": sku,
                "currentQty": int(current),
                "thresholdQty": threshold,
            }
        )

    severity_order = {"critical": 0, "warning": 1}
    alerts.sort(
        key=lambda alert: (
            severity_order[alert["severity"]],
            alert["type"],
            alert["internalSku"],
        )
    )
    return {"items": alerts, "total": len(alerts)}
