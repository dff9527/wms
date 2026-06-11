"""
收貨 API（CURSOR_INSTRUCTIONS.md）
現階段回傳與 inventory_lots 對齊的 mock；之後接上 SQLAlchemy 查詢即可。
"""

from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.core.warehouse.receiving import ReceivingService
from app.core.warehouse.putaway import PutAwayEngine
from app.schemas.receiving import IQCRequest, ReceiveRequest, ReceiveResponse, ScanResult
from app.api.deps import get_db, get_current_user, require_role
from app.config import settings
from app.core.printing.label_printer import LabelPrinter

router = APIRouter(tags=["receiving"])


@router.get("/list")
def get_receiving_list(
    po_number: Optional[str] = Query(None, description="採購單號篩選"),
    status: Optional[str] = Query(None, description="lot_status 篩選"),
    db: Session = Depends(get_db),
):
    """
    Query inventory_lots with lot_status in QC_HOLD/PENDING_RECEIVE (or iqc_result PENDING)
    Serialize to ReceivingItemApiRaw snake_case shape.
    """
    service = ReceivingService(db)
    items = service.list_pending(po_number=po_number, status=status)
    
     # Map ORM objects to dict for JSON response matching existing frontend expectations
    rows = []
    for item in items:
        rows.append({
             "lot_id": item.lot_id,
             "po_number": item.po_number,
             "vendor_name": item.vendor_name,
             "internal_sku": item.internal_sku,
             "internal_lot_number": item.internal_lot_number,
             "internal_barcode": item.internal_barcode,
             "vendor_pn": item.vendor_pn,
             "vendor_lot_code": item.vendor_lot_code,
             "vendor_date_code": item.vendor_date_code,
             "original_barcode": item.original_barcode,
             "description": item.description,
             "quantity_on_hand": item.quantity_on_hand,
             "unit": item.unit,
             "lot_status": item.lot_status,
             "receive_date": item.receive_date.isoformat() if item.receive_date else None,
             "location_code": item.location_code,
             "iqc_result": item.iqc_result,
             "iqc_date": item.iqc_date.isoformat() if item.iqc_date else None,
             "iqc_inspector": item.iqc_inspector,
             "quality_notes": item.quality_notes,
         })

    return {"items": rows, "total": len(rows)}


@router.get("/{lot_id}")
def get_receiving_detail(lot_id: int, db: Session = Depends(get_db)):
    service = ReceivingService(db)
    item = service.get_lot_by_id(lot_id)
    
    if not item:
        raise HTTPException(status_code=404, detail="Lot not found")

    return {
         "lot_id": item.lot_id,
         "po_number": item.po_number,
         "vendor_name": item.vendor_name,
         "internal_sku": item.internal_sku,
         "internal_lot_number": item.internal_lot_number,
         "internal_barcode": item.internal_barcode,
         "vendor_pn": item.vendor_pn,
         "vendor_lot_code": item.vendor_lot_code,
         "vendor_date_code": item.vendor_date_code,
         "original_barcode": item.original_barcode,
         "description": item.description,
         "quantity_on_hand": item.quantity_on_hand,
         "unit": item.unit,
         "lot_status": item.lot_status,
         "receive_date": item.receive_date.isoformat() if item.receive_date else None,
         "location_code": item.location_code,
         "iqc_result": item.iqc_result,
         "iqc_date": item.iqc_date.isoformat() if item.iqc_date else None,
         "iqc_inspector": item.iqc_inspector,
         "quality_notes": item.quality_notes,
     }


@router.post("/scan")
def scan_barcode(
    payload: Dict[str, Any], 
    db: Session = Depends(get_db)
):
    """
    Accept ScanBarcodeRequest {barcode, vendorId?}. Use BarcodeParser to parse and return ScanResult.
    Do not create any DB rows. Return 400 if barcode cannot be parsed.
    """
    barcode = payload.get("barcode") or payload.get("scannedBarcode")
    vendor_id = payload.get("vendorId") or payload.get("vendor_id")

    if not barcode:
        raise HTTPException(status_code=400, detail="Barcode is required")

    service = ReceivingService(db)
    try:
        result = service.scan_barcode(barcode, vendor_id)
         # Map internal ScanResult to API response shape
        return {
             "success": True,
             "parsed": {
                 "vendorPn": result.vendor_pn,
                 "qty": result.qty,
                 "lotCode": result.lot_code,
                 "dateCode": result.date_code,
             },
             "patternUsed": result.pattern_used,
         }
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/receive")
def receive_item(
    request: ReceiveRequest,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
):
    """
    Parse body into ReceiveRequest (po_number, barcode/scannedBarcode, vendor_id, qty).
    Call ReceivingService(db).process_receipt(...). Return ReceiveResponse.
    On PO mismatch let service raise and translate to HTTP 400 with detail message.
    """
    service = ReceivingService(db)

    try:
         # process_receipt already returns a ReceiveResponse (success/lotId/
         # internalLotNumber/internalBarcode/labelUrl) and raises HTTPException 400
         # on validation failure.
        return service.process_receipt(
            po_number=request.poNumber,
            scanned_barcode=request.scannedBarcode or "",
            vendor_id=request.vendorId,
            quantity=request.quantity,
            executed_by=current_user["username"],   # 以登入者為準,不信任 body
         )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/iqc")
def complete_iqc(
    request: IQCRequest,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_role("admin", "qc")),  # IQC 限 QC/管理員
):
    """
    Parse IQCRequest {lotId, result, inspector, notes?}.
    Call ReceivingService(db).complete_iqc(lot_id, result, inspector, notes).
    Return {success, status, suggestedLocation?} (suggestedLocation optionally from PutAwayEngine.suggest_location when result==PASS).
    """
    service = ReceivingService(db)

    try:
         # complete_iqc returns {success, status, suggestedLocation} and updates the
         # lot (status + iqc fields), suggesting a putaway location when result==PASS.
        return service.complete_iqc(
            lot_id=request.lotId,
            result=request.result,
            inspector=current_user["username"],     # 以登入者為準,不信任 body
            notes=request.notes
         )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/print-label")
def print_label(payload: Dict[str, Any], db: Session = Depends(get_db)):
    lot_id = payload.get("lot_id")
    
    if not lot_id:
        raise HTTPException(status_code=400, detail="lot_id is required")

    service = ReceivingService(db)
    item = service.get_lot_by_id(lot_id)
    
    if not item:
        raise HTTPException(status_code=404, detail="Lot not found")

    printer = LabelPrinter()
    zpl = printer.render(item)

    # 記錄已換標(強制換標流程的前置條件)
    service.mark_label_printed(lot_id)

    printed = False
    
    if settings.ZEBRA_PRINTER_IP:
        try:
            printer.send_to_printer(zpl, settings.ZEBRA_PRINTER_IP)
            printed = True
        except Exception:
            printed = False
            
    return {
        "success": True,
        "zpl": zpl,
        "printed": printed
    }
