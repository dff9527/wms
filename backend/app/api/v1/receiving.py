"""
收貨 API（CURSOR_INSTRUCTIONS.md）
現階段回傳與 inventory_lots 對齊的 mock；之後接上 SQLAlchemy 查詢即可。
"""

from copy import deepcopy
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, HTTPException, Query

router = APIRouter(tags=["receiving"])

# ── Mock：對齊說明文件「新結構」（snake_case JSON） ─────────────────────────

_MOCK_ITEMS: List[Dict[str, Any]] = [
    {
        "lot_id": 1,
        "po_number": "PO-2024-0501",
        "vendor_name": "Texas Instruments",
        "internal_sku": "IC-001",
        "internal_lot_number": "IC-001-240501-0001",
        "internal_barcode": "240501-IC001-0001-W15",
        "vendor_pn": "TI-7805",
        "vendor_lot_code": "TI2024W15A",
        "vendor_date_code": "2024W15",
        "original_barcode": "1PTI7805...9DTI2024W15A",
        "description": "5V 穩壓 IC",
        "quantity_on_hand": 5000,
        "unit": "PCS",
        "lot_status": "PENDING_RECEIVE",
        "receive_date": "2024-05-01T10:20:00",
        "location_code": None,
        "iqc_result": "PENDING",
        "iqc_date": None,
        "iqc_inspector": None,
        "quality_notes": None,
    },
    {
        "lot_id": 2,
        "po_number": "PO-2024-0501",
        "vendor_name": "Texas Instruments",
        "internal_sku": "IC-001",
        "internal_lot_number": "IC-001-240501-0002",
        "internal_barcode": "240501-IC001-0002-W15",
        "vendor_pn": "TI-7805",
        "vendor_lot_code": "TI2024W15B",
        "vendor_date_code": "2024W15",
        "original_barcode": "",
        "description": "5V 穩壓 IC",
        "quantity_on_hand": 3000,
        "unit": "PCS",
        "lot_status": "QC_HOLD",
        "receive_date": "2024-05-01T14:00:00",
        "location_code": "QC-01-01",
        "iqc_result": "PENDING",
        "iqc_date": None,
        "iqc_inspector": None,
        "quality_notes": None,
    },
    {
        "lot_id": 3,
        "po_number": "PO-2024-0515",
        "vendor_name": "Texas Instruments",
        "internal_sku": "IC-001",
        "internal_lot_number": "IC-001-240515-0001",
        "internal_barcode": "240515-IC001-0001-W18",
        "vendor_pn": "TPS54331DR",
        "vendor_lot_code": "TI2024W18C",
        "vendor_date_code": "2024W18",
        "original_barcode": "",
        "description": "DC/DC Converter",
        "quantity_on_hand": 8000,
        "unit": "PCS",
        "lot_status": "AVAILABLE",
        "receive_date": "2024-05-15T09:00:00",
        "location_code": "A-01-02-03",
        "iqc_result": "PASS",
        "iqc_date": "2024-05-15T11:30:00",
        "iqc_inspector": "王小明",
        "quality_notes": None,
    },
    {
        "lot_id": 4,
        "po_number": "PO-2024-0502",
        "vendor_name": "STMicroelectronics",
        "internal_sku": "IC-STM358",
        "internal_lot_number": "IC-STM358-240502-0001",
        "internal_barcode": "240502-STM358-0001-A42",
        "vendor_pn": "LM358DT",
        "vendor_lot_code": "ST2024042",
        "vendor_date_code": "0424",
        "original_barcode": "",
        "description": "雙運算放大器",
        "quantity_on_hand": 3000,
        "unit": "PCS",
        "lot_status": "QC_HOLD",
        "receive_date": "2024-05-02T08:45:00",
        "location_code": None,
        "iqc_result": "PENDING",
        "iqc_date": None,
        "iqc_inspector": None,
        "quality_notes": None,
    },
    {
        "lot_id": 5,
        "po_number": "PO-2024-0503",
        "vendor_name": "ON Semiconductor",
        "internal_sku": "IC-ON2222",
        "internal_lot_number": "IC-ON2222-240503-0001",
        "internal_barcode": "240503-ON2222-0001-X9",
        "vendor_pn": "2N2222TA",
        "vendor_lot_code": "ON240501",
        "vendor_date_code": "240501",
        "original_barcode": "",
        "description": "NPN 電晶體",
        "quantity_on_hand": 10000,
        "unit": "PCS",
        "lot_status": "AVAILABLE",
        "receive_date": "2024-05-03T07:30:00",
        "location_code": "B-02-01-04",
        "iqc_result": "PASS",
        "iqc_date": "2024-05-03T10:00:00",
        "iqc_inspector": "李小華",
        "quality_notes": None,
    },
]


@router.get("/list")
def get_receiving_list(
    po_number: Optional[str] = Query(None, description="採購單號篩選"),
    status: Optional[str] = Query(None, description="lot_status 篩選"),
):
    rows = deepcopy(_MOCK_ITEMS)

    if po_number:
        rows = [r for r in rows if r["po_number"] == po_number]
    if status:
        rows = [r for r in rows if str(r["lot_status"]).upper() == status.upper()]

    return {"items": rows, "total": len(rows)}


@router.get("/{lot_id}")
def get_receiving_detail(lot_id: int):
    for r in _MOCK_ITEMS:
        if r["lot_id"] == lot_id:
            return r
    raise HTTPException(status_code=404, detail="Lot not found")


@router.post("/scan")
def scan_stub():
    raise HTTPException(status_code=501, detail="掃描 API 尚未實作")


@router.post("/receive")
def receive_stub():
    raise HTTPException(status_code=501, detail="確認收貨 API 尚未實作")


@router.post("/iqc")
def iqc_stub():
    raise HTTPException(status_code=501, detail="IQC API 尚未實作")


@router.post("/print-label")
def print_label_stub():
    raise HTTPException(status_code=501, detail="列印標籤 API 尚未實作")
