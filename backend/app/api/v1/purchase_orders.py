from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.api.deps import get_db, get_current_user, require_role
from app.models.order import PurchaseOrder, POLine
from app.models.vendor import Vendor
from app.models.item import Item

router = APIRouter(prefix="/api/v1/purchase-orders", tags=["purchase-orders"])


def _po_response(po: PurchaseOrder, vendor_name: str, lines: list) -> dict:
    return {
        "poId": po.po_id,
        "poNumber": po.po_number,
        "vendorId": po.vendor_id,
        "vendorName": vendor_name,
        "poDate": po.po_date.isoformat() if po.po_date else "",
        "expectedDeliveryDate": (
            po.expected_delivery_date.isoformat() if po.expected_delivery_date else ""
        ),
        "status": po.status,
        "lines": [
            {
                "lineNumber": line.line_number,
                "internalSku": line.internal_sku or "",
                "vendorPn": line.vendor_pn or "",
                "orderedQty": line.ordered_qty,
                "receivedQty": line.received_qty,
            }
            for line in lines
        ],
    }


@router.get("/open-po-list")
def list_open_po_numbers(db: Session = Depends(get_db)):
    """List PO numbers with status OPEN or PARTIAL (for SO/PO form dropdown with datalist)."""
    pos = (
        db.query(PurchaseOrder.po_number)
        .filter(PurchaseOrder.status.in_(["OPEN", "PARTIAL"]))
        .order_by(PurchaseOrder.po_date.desc(), PurchaseOrder.po_id.desc())
        .limit(500)
        .all()
    )
    return [{"poNumber": po.po_number, "status": "OPEN"} for po in pos]


@router.get("")
def list_po(
    include_cancelled: bool = Query(False),
    db: Session = Depends(get_db),
):
    """最近 100 筆 PO，每筆包含 lines."""
    q = db.query(PurchaseOrder)
    if not include_cancelled:
        q = q.filter(PurchaseOrder.status != "CANCELLED")
    pos = (
        q.order_by(PurchaseOrder.po_date.desc(), PurchaseOrder.po_id.desc())
        .limit(100)
        .all()
    )

    # Collect vendor IDs and fetch in batch
    vendor_ids = [po.vendor_id for po in pos if po.vendor_id is not None]
    vendor_map = {}
    if vendor_ids:
        for v in db.query(Vendor).filter(Vendor.vendor_id.in_(vendor_ids)).all():
            vendor_map[v.vendor_id] = v.vendor_name

    # Collect PO IDs and fetch lines in batch
    po_ids = [po.po_id for po in pos]
    lines_by_po: dict = {}
    if po_ids:
        for line in db.query(POLine).filter(POLine.po_id.in_(po_ids)).all():
            lines_by_po.setdefault(line.po_id, []).append(line)

    return [
        _po_response(
            po, vendor_map.get(po.vendor_id, ""), lines_by_po.get(po.po_id, [])
        )
        for po in pos
    ]


@router.post("", status_code=201)
def create_po(
    payload: dict,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """
    建立新 PO.
    body: {"poNumber": str, "vendorId": int,
           "lines": [{"internalSku": str, "vendorPn": str, "orderedQty": int}]}
    """
    po_number = payload.get("poNumber")
    vendor_id = payload.get("vendorId")
    lines = payload.get("lines", [])

    if not po_number or not str(po_number).strip():
        raise HTTPException(status_code=400, detail="poNumber is required")
    po_number = str(po_number).strip()

    # Validate poNumber not duplicate
    existing = (
        db.query(PurchaseOrder).filter(PurchaseOrder.po_number == po_number).first()
    )
    if existing:
        raise HTTPException(
            status_code=409, detail=f"PO number '{po_number}' already exists"
        )

    # Validate vendorId exists
    vendor = db.query(Vendor).filter(Vendor.vendor_id == vendor_id).first()
    if not vendor:
        raise HTTPException(status_code=400, detail=f"Vendor ID {vendor_id} not found")

    # Validate lines non-empty
    if not lines:
        raise HTTPException(status_code=400, detail="Lines cannot be empty")

    # Validate each line
    internal_skus = []
    for line in lines:
        ordered_qty = line.get("orderedQty")
        if ordered_qty is None or ordered_qty <= 0:
            raise HTTPException(
                status_code=400, detail="orderedQty must be greater than 0"
            )
        internal_sku = line.get("internalSku")
        if internal_sku:
            internal_skus.append(internal_sku)

    # Validate all SKUs exist (if provided)
    if internal_skus:
        missing_skus = []
        for sku in internal_skus:
            item = db.query(Item).filter(Item.internal_sku == sku).first()
            if not item:
                missing_skus.append(sku)
        if missing_skus:
            raise HTTPException(
                status_code=400, detail=f"SKU(s) not found: {', '.join(missing_skus)}"
            )

    # Create PO
    po = PurchaseOrder(
        po_number=po_number,
        vendor_id=vendor_id,
        po_date=date.today(),
        status="OPEN",
        created_by=current_user.get("username", "system"),
    )
    db.add(po)
    db.flush()  # Get po_id

    # Create lines with line_number starting from 1
    for idx, line in enumerate(lines, start=1):
        po_line = POLine(
            po_id=po.po_id,
            line_number=idx,
            internal_sku=line.get("internalSku"),
            vendor_pn=line.get("vendorPn"),
            ordered_qty=line.get("orderedQty", 1),
        )
        db.add(po_line)

    db.commit()

    # Return created PO
    vendor_name = vendor.vendor_name
    po_lines = db.query(POLine).filter(POLine.po_id == po.po_id).all()

    return _po_response(po, vendor_name, po_lines)


@router.patch("/{po_id}")
def update_po(
    po_id: int,
    payload: dict,
    db: Session = Depends(get_db),
    _current_user: dict = Depends(require_role("admin")),
):
    """
    Edit PO header fields (vendor / expected delivery date).
    Lines with received_qty > 0 are not editable (header-only for demo).
    """
    po = db.query(PurchaseOrder).filter(PurchaseOrder.po_id == po_id).first()
    if not po:
        raise HTTPException(status_code=404, detail="Purchase order not found")
    if po.status == "CANCELLED":
        raise HTTPException(status_code=400, detail="Cannot edit a cancelled PO")

    if "vendorId" in payload and payload["vendorId"] is not None:
        vendor = (
            db.query(Vendor).filter(Vendor.vendor_id == payload["vendorId"]).first()
        )
        if not vendor:
            raise HTTPException(
                status_code=400, detail=f"Vendor ID {payload['vendorId']} not found"
            )
        po.vendor_id = payload["vendorId"]

    if "expectedDeliveryDate" in payload:
        raw = payload["expectedDeliveryDate"]
        if raw in (None, ""):
            po.expected_delivery_date = None
        else:
            try:
                po.expected_delivery_date = date.fromisoformat(str(raw)[:10])
            except ValueError as exc:
                raise HTTPException(
                    status_code=400, detail="Invalid expectedDeliveryDate"
                ) from exc

    db.commit()
    vendor_name = ""
    if po.vendor_id:
        vendor = db.query(Vendor).filter(Vendor.vendor_id == po.vendor_id).first()
        vendor_name = vendor.vendor_name if vendor else ""
    po_lines = db.query(POLine).filter(POLine.po_id == po.po_id).all()
    return _po_response(po, vendor_name, po_lines)


@router.post("/{po_id}/cancel")
def cancel_po(
    po_id: int,
    db: Session = Depends(get_db),
    _current_user: dict = Depends(require_role("admin")),
):
    """Soft-cancel a PO (status = CANCELLED)."""
    po = db.query(PurchaseOrder).filter(PurchaseOrder.po_id == po_id).first()
    if not po:
        raise HTTPException(status_code=404, detail="Purchase order not found")
    if po.status == "CANCELLED":
        return {"detail": "already cancelled", "poId": po.po_id, "status": po.status}

    po.status = "CANCELLED"
    db.commit()
    return {"detail": "cancelled", "poId": po.po_id, "status": po.status}


# 独立 router: GET /api/v1/items for dropdown (SO/PO form item selector)
@router.get("/items")
def list_items(db: Session = Depends(get_db)):
    """List items for dropdowns, limit 500."""
    items = (
        db.query(Item)
        .filter(Item.is_active.is_(True))
        .order_by(Item.internal_sku)
        .limit(500)
        .all()
    )
    return [
        {
            "internalSku": item.internal_sku,
            "description": item.description or "",
        }
        for item in items
    ]
