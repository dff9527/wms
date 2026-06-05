"""End-to-end smoke test for the WMS core flow, against the REAL database.

Run it on your machine (the sandbox has no Postgres):

    cd ~/projects/wms/backend
    source .venv/bin/activate          # has the deps
    # make sure backend/.env -> DATABASE_URL points at localhost:5433
    python tests/test_e2e_flow.py      # plain run, prints PASS/FAIL per step
    #   or:  pytest -s tests/test_e2e_flow.py

Prereqs: schema.sql + seed_patterns.sql already loaded (TI vendor + TI_STANDARD
pattern + warehouses/locations). The test seeds the small master data it needs
(an item + an AVL mapping + a sales order) idempotently.

It exercises: receive -> IQC PASS -> inventory list -> allocate (FIFO) ->
confirm pick -> confirm shipment -> packing list -> trace forward.
"""
import os
import sys
from datetime import date, datetime

# allow `python tests/test_e2e_flow.py` from backend/ by putting backend/ on sys.path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from fastapi.testclient import TestClient

from app.main import app
from app.db.session import SessionLocal
from app.models.item import Item
from app.models.vendor import Vendor, VendorItem
from app.models.order import SalesOrder, SOLine, PickTask, PurchaseOrder, POLine
from app.models.inventory import InventoryLot, InventoryTransaction

client = TestClient(app)

TI_BARCODE = "1PTPS54331DRCR1T30009D2024W15"   # parses to vendor_pn=TPS54331DRCR
VENDOR_PN = "TPS54331DRCR"
SKU = "IC-E2E-001"

_passed = 0
_failed = 0


def check(label, cond, extra=""):
    global _passed, _failed
    mark = "PASS" if cond else "FAIL"
    if cond:
        _passed += 1
    else:
        _failed += 1
    print(f"  [{mark}] {label}" + (f"  -> {extra}" if extra else ""))
    return cond


def cleanup_test_data():
    """Remove rows from prior runs so the flow is isolated (FIFO would otherwise
    allocate an older leftover lot instead of this run's lot)."""
    db = SessionLocal()
    try:
        so_ids = [r[0] for r in db.query(SalesOrder.so_id).filter(SalesOrder.so_number.like("SO-E2E-%")).all()]
        line_ids = [r[0] for r in db.query(SOLine.so_line_id).filter(SOLine.so_id.in_(so_ids)).all()] if so_ids else []
        lot_ids = [r[0] for r in db.query(InventoryLot.lot_id).filter(InventoryLot.internal_sku == SKU).all()]
        if line_ids or lot_ids:
            db.query(PickTask).filter(
                (PickTask.so_line_id.in_(line_ids)) | (PickTask.lot_id.in_(lot_ids))
            ).delete(synchronize_session=False)
        if lot_ids:
            db.query(InventoryTransaction).filter(InventoryTransaction.lot_id.in_(lot_ids)).delete(synchronize_session=False)
            db.query(InventoryLot).filter(InventoryLot.lot_id.in_(lot_ids)).delete(synchronize_session=False)
        if so_ids:
            db.query(SOLine).filter(SOLine.so_id.in_(so_ids)).delete(synchronize_session=False)
            db.query(SalesOrder).filter(SalesOrder.so_id.in_(so_ids)).delete(synchronize_session=False)
        po_ids = [r[0] for r in db.query(PurchaseOrder.po_id).filter(PurchaseOrder.po_number.like("PO-E2E-%")).all()]
        if po_ids:
            db.query(POLine).filter(POLine.po_id.in_(po_ids)).delete(synchronize_session=False)
            db.query(PurchaseOrder).filter(PurchaseOrder.po_id.in_(po_ids)).delete(synchronize_session=False)
        db.commit()
    finally:
        db.close()


def seed_master_data():
    """Idempotently ensure: item, TI vendor (from seed), AVL mapping, sales order."""
    db = SessionLocal()
    try:
        if not db.query(Item).filter(Item.internal_sku == SKU).first():
            db.add(Item(internal_sku=SKU, item_type="IC", description="E2E test IC",
                        base_unit="PCS", lot_control_required=True))
        vendor = db.query(Vendor).filter(Vendor.vendor_code == "TI").first()
        if not vendor:
            raise SystemExit("TI vendor missing — load seed_patterns.sql first")
        if not db.query(VendorItem).filter(
            VendorItem.vendor_id == vendor.vendor_id, VendorItem.vendor_pn == VENDOR_PN
        ).first():
            db.add(VendorItem(vendor_id=vendor.vendor_id, vendor_pn=VENDOR_PN,
                              internal_sku=SKU, approval_status="APPROVED"))
        db.commit()

        ts = datetime.now().strftime('%Y%m%d%H%M%S')

        # purchase order for A2 PO validation (ordered_qty large enough for the receipt)
        po_number = f"PO-E2E-{ts}"
        po = PurchaseOrder(po_number=po_number, vendor_id=vendor.vendor_id,
                           po_date=date.today(), status="OPEN")
        db.add(po)
        db.flush()
        db.add(POLine(po_id=po.po_id, line_number=1, internal_sku=SKU,
                      vendor_pn=VENDOR_PN, ordered_qty=100000, received_qty=0))

        so_number = f"SO-E2E-{ts}"
        so = SalesOrder(so_number=so_number, order_date=date.today(),
                        status="OPEN", lot_selection_rule="FIFO")
        db.add(so)
        db.flush()
        db.add(SOLine(so_id=so.so_id, line_number=1, internal_sku=SKU, ordered_qty=1000))
        db.commit()
        return vendor.vendor_id, so_number, po_number
    finally:
        db.close()


def main():
    print("WMS end-to-end flow")
    cleanup_test_data()
    vendor_id, so_number, po_number = seed_master_data()
    print(f"  seeded item={SKU}, vendor_id={vendor_id}, so={so_number}, po={po_number}")

    # 1. Receive (scan + create lot)
    r = client.post("/api/v1/receiving/receive", json={
        "po_number": po_number, "barcode": TI_BARCODE, "vendor_id": vendor_id, "qty": 3000,
    })
    ok = check("POST /receiving/receive 200", r.status_code == 200, r.text[:200])
    if not ok:
        return
    body = r.json()
    lot_id = body.get("lotId")
    internal_barcode = body.get("internalBarcode")
    check("receive returned lotId + internalBarcode", bool(lot_id and internal_barcode),
          f"lotId={lot_id}")

    # 2. IQC PASS -> lot becomes AVAILABLE
    r = client.post("/api/v1/receiving/iqc", json={
        "lotId": lot_id, "result": "PASS", "inspector": "qc-e2e",
    })
    check("POST /receiving/iqc PASS 200", r.status_code == 200, r.text[:200])
    check("IQC set status AVAILABLE", r.json().get("status") == "AVAILABLE", r.json())

    # 3. Inventory list shows the lot
    r = client.get("/api/v1/inventory/lots")
    check("GET /inventory/lots 200", r.status_code == 200, r.text[:120])

    # 4. Allocate (FIFO)
    r = client.post("/api/v1/picking/allocate", json={"so_number": so_number})
    ok = check("POST /picking/allocate 200", r.status_code == 200, r.text[:200])
    if ok:
        check("allocatedQty == 1000", r.json().get("allocatedQty") == 1000, r.json().get("allocatedQty"))

    # 5. Find the pending pick task and confirm it
    r = client.get("/api/v1/picking/tasks")
    task_id = None
    if r.status_code == 200:
        for t in r.json():
            if t.get("status") == "PENDING" and t.get("lot_id") == lot_id:
                task_id = t.get("task_id")
                break
    check("found PENDING pick task for our lot", task_id is not None, f"task_id={task_id}")
    if task_id:
        r = client.post("/api/v1/picking/confirm", json={
            "task_id": task_id, "picked_qty": 1000, "picker": "picker-e2e",
        })
        check("POST /picking/confirm 200", r.status_code == 200, r.text[:200])

    # 6. Confirm shipment
    r = client.post("/api/v1/shipping/confirm", json={"so_number": so_number, "shipper": "ship-e2e"})
    check("POST /shipping/confirm 200", r.status_code == 200, r.text[:200])

    # 7. Packing list (FIFO proof)
    r = client.get(f"/api/v1/shipping/packing-list/{so_number}")
    check("GET /shipping/packing-list 200", r.status_code == 200, r.text[:200])
    if r.status_code == 200:
        items = r.json().get("items", [])
        check("packing list has our SKU", any(i.get("sku") == SKU for i in items), items)

    # 8. Trace forward by internal barcode
    for path in ("/api/v1/trace/forward", "/api/v1/traceability/forward"):
        r = client.get(path, params={"query": internal_barcode})
        if r.status_code != 404:
            check(f"GET {path} 200", r.status_code == 200, r.text[:200])
            if r.status_code == 200:
                supplier = (r.json() or {}).get("supplier", {}).get("name")
                check("trace supplier == Texas Instruments", supplier == "Texas Instruments", supplier)
            break

    print(f"\nRESULT: {_passed} passed, {_failed} failed")
    sys.exit(1 if _failed else 0)


def test_e2e_flow():
    """pytest entry point."""
    main()


if __name__ == "__main__":
    main()
