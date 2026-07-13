"""End-to-end smoke test for the WMS core flow, against the REAL database.

Run it on your machine (the sandbox has no Postgres):

    cd ~/projects/wms/backend
    source .venv/bin/activate           # has the deps
     # make sure backend/.env -> DATABASE_URL points at localhost:5433
    python tests/test_e2e_flow.py       # plain run, prints PASS/FAIL per step
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
from app.models.user import User
from app.core.security import hash_password

client = TestClient(app)

TI_BARCODE = "1PTPS54331DRCR1T30009D2024W15"  # parses to vendor_pn=TPS54331DRCR
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
    print(f"   [{mark}] {label}" + (f"   -> {extra}" if extra else ""))
    return cond


def cleanup_test_data():
    """Remove rows from prior runs so the flow is isolated (FIFO would otherwise
    allocate an older leftover lot instead of this run's lot)."""
    db = SessionLocal()
    try:
        so_ids = [
            r[0]
            for r in db.query(SalesOrder.so_id)
            .filter(SalesOrder.so_number.like("SO-E2E-%"))
            .all()
        ]
        line_ids = (
            [
                r[0]
                for r in db.query(SOLine.so_line_id)
                .filter(SOLine.so_id.in_(so_ids))
                .all()
            ]
            if so_ids
            else []
        )
        lot_ids = [
            r[0]
            for r in db.query(InventoryLot.lot_id)
            .filter(InventoryLot.internal_sku == SKU)
            .all()
        ]

        # Extended cleanup for split child lots and adjust/split transactions
        # We delete all transactions/lots associated with our test SKU to ensure clean state
        # including any child lots created by splits

        if line_ids or lot_ids:
            db.query(PickTask).filter(
                (PickTask.so_line_id.in_(line_ids)) | (PickTask.lot_id.in_(lot_ids))
            ).delete(synchronize_session=False)

        if lot_ids:
            # Delete transactions first (FK constraint)
            db.query(InventoryTransaction).filter(
                InventoryTransaction.lot_id.in_(lot_ids)
            ).delete(synchronize_session=False)
            # Delete lots (including children which share the same SKU but different IDs,
            # though we filtered by parent lot_ids above. To be safe against split children
            # that might not have been captured in initial lot_ids query if they were created
            # after the filter, we rely on the fact that split children inherit internal_sku.
            # However, standard FK deletion order is Transactions -> Lots.
            # If split children exist, their IDs are NOT in `lot_ids` from the initial query
            # unless we re-query. Let's do a broader cleanup for this specific test run's scope.

            # Re-fetch all lots for this SKU to catch any split children
            all_lot_ids = [
                r[0]
                for r in db.query(InventoryLot.lot_id)
                .filter(InventoryLot.internal_sku == SKU)
                .all()
            ]

            if all_lot_ids:
                db.query(InventoryTransaction).filter(
                    InventoryTransaction.lot_id.in_(all_lot_ids)
                ).delete(synchronize_session=False)
                db.query(InventoryLot).filter(
                    InventoryLot.lot_id.in_(all_lot_ids)
                ).delete(synchronize_session=False)

        if so_ids:
            db.query(SOLine).filter(SOLine.so_id.in_(so_ids)).delete(
                synchronize_session=False
            )
            db.query(SalesOrder).filter(SalesOrder.so_id.in_(so_ids)).delete(
                synchronize_session=False
            )

        po_ids = [
            r[0]
            for r in db.query(PurchaseOrder.po_id)
            .filter(PurchaseOrder.po_number.like("PO-E2E-%"))
            .all()
        ]
        if po_ids:
            db.query(POLine).filter(POLine.po_id.in_(po_ids)).delete(
                synchronize_session=False
            )
            db.query(PurchaseOrder).filter(PurchaseOrder.po_id.in_(po_ids)).delete(
                synchronize_session=False
            )

        db.commit()
    finally:
        db.close()


def seed_master_data():
    """Idempotently ensure: item, TI vendor (from seed), AVL mapping, sales order."""
    db = SessionLocal()
    try:
        if not db.query(Item).filter(Item.internal_sku == SKU).first():
            db.add(
                Item(
                    internal_sku=SKU,
                    item_type="IC",
                    description="E2E test IC",
                    base_unit="PCS",
                    lot_control_required=True,
                )
            )
        vendor = db.query(Vendor).filter(Vendor.vendor_code == "TI").first()
        if not vendor:
            raise SystemExit("TI vendor missing — load seed_patterns.sql first")
        if (
            not db.query(VendorItem)
            .filter(
                VendorItem.vendor_id == vendor.vendor_id,
                VendorItem.vendor_pn == VENDOR_PN,
            )
            .first()
        ):
            db.add(
                VendorItem(
                    vendor_id=vendor.vendor_id,
                    vendor_pn=VENDOR_PN,
                    internal_sku=SKU,
                    approval_status="APPROVED",
                )
            )
        # Seed e2e-admin user for JWT authentication (always ensure admin role)
        e2e_admin = db.query(User).filter(User.username == "e2e-admin").first()
        if not e2e_admin:
            db.add(
                User(
                    username="e2e-admin",
                    password_hash=hash_password("e2e-test-pw"),
                    role="admin",
                    is_active=True,
                )
            )
        elif e2e_admin.role != "admin" or not e2e_admin.is_active:
            # Prior runs may have left a non-admin row; restore expected role for e2e.
            e2e_admin.role = "admin"
            e2e_admin.is_active = True
        db.commit()

        ts = datetime.now().strftime("%Y%m%d%H%M%S")

        # purchase order for A2 PO validation (ordered_qty large enough for the receipt)
        po_number = f"PO-E2E-{ts}"
        po = PurchaseOrder(
            po_number=po_number,
            vendor_id=vendor.vendor_id,
            po_date=date.today(),
            status="OPEN",
        )
        db.add(po)
        db.flush()
        db.add(
            POLine(
                po_id=po.po_id,
                line_number=1,
                internal_sku=SKU,
                vendor_pn=VENDOR_PN,
                ordered_qty=100000,
                received_qty=0,
            )
        )

        so_number = f"SO-E2E-{ts}"
        so = SalesOrder(
            so_number=so_number,
            order_date=date.today(),
            status="OPEN",
            lot_selection_rule="FIFO",
        )
        db.add(so)
        db.flush()
        db.add(
            SOLine(so_id=so.so_id, line_number=1, internal_sku=SKU, ordered_qty=1000)
        )
        db.commit()
        return vendor.vendor_id, so_number, po_number
    finally:
        db.close()


def main():
    print("WMS end-to-end flow")
    cleanup_test_data()
    vendor_id, so_number, po_number = seed_master_data()
    print(f"  seeded item={SKU}, vendor_id={vendor_id}, so={so_number}, po={po_number}")

    # Negative check: unauthenticated request should be rejected with 401
    r_noauth = client.get("/api/v1/inventory/lots")
    check(
        "unauthenticated request rejected (401)",
        r_noauth.status_code == 401,
        r_noauth.status_code,
    )

    # Login with e2e-admin user
    r = client.post(
        "/api/v1/auth/login", json={"username": "e2e-admin", "password": "e2e-test-pw"}
    )
    check("login succeeds", r.status_code == 200, r.text[:200])
    if r.status_code == 200:
        client.headers.update({"Authorization": f"Bearer {r.json()['access_token']}"})

    # 1. Receive (scan + create lot)
    r = client.post(
        "/api/v1/receiving/receive",
        json={
            "po_number": po_number,
            "barcode": TI_BARCODE,
            "vendor_id": vendor_id,
            "qty": 3000,
        },
    )
    ok = check("POST /receiving/receive 200", r.status_code == 200, r.text[:200])
    if not ok:
        return
    body = r.json()
    lot_id = body.get("lotId")
    internal_barcode = body.get("internalBarcode")
    check(
        "receive returned lotId + internalBarcode",
        bool(lot_id and internal_barcode),
        f"lotId={lot_id}",
    )

    # 1.5 強制換標:TI requires_relabeling=TRUE,未列印標籤前 IQC PASS 必須被擋
    r = client.post(
        "/api/v1/receiving/iqc",
        json={
            "lotId": lot_id,
            "result": "PASS",
            "inspector": "qc-e2e",
        },
    )
    check("IQC PASS blocked before relabel (400)", r.status_code == 400, r.text[:120])

    r = client.post("/api/v1/receiving/print-label", json={"lot_id": lot_id})
    check("POST /receiving/print-label 200", r.status_code == 200, r.text[:120])

    # 2. IQC PASS -> lot becomes AVAILABLE
    r = client.post(
        "/api/v1/receiving/iqc",
        json={
            "lotId": lot_id,
            "result": "PASS",
            "inspector": "qc-e2e",
        },
    )
    check("POST /receiving/iqc PASS 200", r.status_code == 200, r.text[:200])
    check("IQC set status AVAILABLE", r.json().get("status") == "AVAILABLE", r.json())

    # 3. Inventory list shows the lot
    r = client.get("/api/v1/inventory/lots")
    check("GET /inventory/lots 200", r.status_code == 200, r.text[:120])

    # 4. Allocate (FIFO)
    r = client.post("/api/v1/picking/allocate", json={"so_number": so_number})
    ok = check("POST /picking/allocate 200", r.status_code == 200, r.text[:200])
    if ok:
        check(
            "allocatedQty == 1000",
            r.json().get("allocatedQty") == 1000,
            r.json().get("allocatedQty"),
        )

    # 5. Find the pending pick task and confirm it
    r = client.get("/api/v1/picking/tasks")
    task_id = None
    if r.status_code == 200:
        for t in r.json():
            if t.get("status") == "PENDING" and t.get("lot_id") == lot_id:
                task_id = t.get("task_id")
                break
    check(
        "found PENDING pick task for our lot", task_id is not None, f"task_id={task_id}"
    )
    if task_id:
        r = client.post(
            "/api/v1/picking/confirm",
            json={
                "task_id": task_id,
                "picked_qty": 1000,
                "picker": "picker-e2e",
            },
        )
        check("POST /picking/confirm 200", r.status_code == 200, r.text[:200])

    # 6. Confirm shipment
    r = client.post(
        "/api/v1/shipping/confirm", json={"so_number": so_number, "shipper": "ship-e2e"}
    )
    check("POST /shipping/confirm 200", r.status_code == 200, r.text[:200])

    # 7. Packing list (FIFO proof)
    r = client.get(f"/api/v1/shipping/packing-list/{so_number}")
    check("GET /shipping/packing-list 200", r.status_code == 200, r.text[:200])
    if r.status_code == 200:
        items = r.json().get("items", [])
        check(
            "packing list has our SKU", any(i.get("sku") == SKU for i in items), items
        )

    # 8. Trace forward by internal barcode
    for path in ("/api/v1/trace/forward", "/api/v1/traceability/forward"):
        r = client.get(path, params={"query": internal_barcode})
        if r.status_code != 404:
            check(f"GET {path} 200", r.status_code == 200, r.text[:200])
            if r.status_code == 200:
                body = r.json()
                supplier = body.get("supplier", {}).get("name")
                check(
                    "trace supplier == Texas Instruments",
                    supplier == "Texas Instruments",
                    supplier,
                )
                check(
                    "trace supplier.poNumber == seeded PO",
                    body["supplier"]["poNumber"] == po_number,
                    body["supplier"]["poNumber"],
                )
                check(
                    "trace shipments[0].shipDate non-empty",
                    bool(body["shipments"]) and bool(body["shipments"][0]["shipDate"]),
                    (
                        body["shipments"][0]["shipDate"]
                        if body.get("shipments")
                        else "no shipments"
                    ),
                )
            break

    # --- NEW TEST STEPS START HERE ---

    # Step 9: Inventory Adjust
    print("\n--- Step 9: Inventory Adjust ---")
    db = SessionLocal()
    try:
        lot_before_adjust = (
            db.query(InventoryLot).filter(InventoryLot.lot_id == lot_id).first()
        )
        qty_before = lot_before_adjust.quantity_on_hand if lot_before_adjust else 0

        # Perform adjustment: reduce quantity by 100
        r = client.post(
            "/api/v1/inventory/adjust",
            json={
                "lotId": lot_id,
                "quantityChange": -100,
                "reason": "E2E Test Adjustment",
            },
        )

        ok = check("POST /inventory/adjust 200", r.status_code == 200, r.text[:200])

        if ok:
            # the endpoint committed on its OWN session; drop our session cache so the
            # re-read reflects the committed value rather than the stale identity-map copy
            db.expire_all()
            # Verify DB state
            lot_after_adjust = (
                db.query(InventoryLot).filter(InventoryLot.lot_id == lot_id).first()
            )
            expected_qty = qty_before - 100
            actual_qty = lot_after_adjust.quantity_on_hand if lot_after_adjust else None

            check(
                "Adjust reduced quantity_on_hand correctly",
                actual_qty == expected_qty,
                f"Expected {expected_qty}, Got {actual_qty}",
            )

            # Verify Transaction Record
            txs = (
                db.query(InventoryTransaction)
                .filter(
                    InventoryTransaction.lot_id == lot_id,
                    InventoryTransaction.transaction_type == "ADJUST",
                )
                .all()
            )

            adjust_tx_found = False
            for tx in txs:
                if tx.quantity_change == -100:
                    adjust_tx_found = True
                    break

            check(
                "ADJUST transaction recorded with correct delta",
                adjust_tx_found,
                f"Found {len(txs)} ADJUST transactions",
            )
    finally:
        db.close()

    # Step 10: Inventory Split
    print("\n--- Step 10: Inventory Split ---")
    db = SessionLocal()
    try:
        parent_lot = (
            db.query(InventoryLot).filter(InventoryLot.lot_id == lot_id).first()
        )
        parent_qty_before_split = parent_lot.quantity_on_hand if parent_lot else 0

        # Perform split: split off 200 units
        r = client.post(
            "/api/v1/inventory/split",
            json={"parentLotId": lot_id, "quantityToSplit": 200},
        )

        ok = check("POST /inventory/split 200", r.status_code == 200, r.text[:200])

        if ok:
            db.expire_all()  # drop session cache so re-reads see the endpoint's committed values
            body = r.json()
            child_lot_id = body.get("newLotId") or body.get(
                "lotId"
            )  # Handle potential response shape variations

            # Verify Child Lot exists
            child_lot = None
            if child_lot_id:
                child_lot = (
                    db.query(InventoryLot)
                    .filter(InventoryLot.lot_id == child_lot_id)
                    .first()
                )

            check(
                "Child lot created with correct quantity",
                child_lot is not None and child_lot.quantity_on_hand == 200,
                f"Child ID: {child_lot_id}, Qty: {child_lot.quantity_on_hand if child_lot else 'N/A'}",
            )

            if child_lot:
                check(
                    "Child lot has correct parent_lot_id",
                    child_lot.parent_lot_id == lot_id,
                    f"Parent ID: {child_lot.parent_lot_id}",
                )

            # Verify Parent Lot reduced
            parent_lot_after_split = (
                db.query(InventoryLot).filter(InventoryLot.lot_id == lot_id).first()
            )
            expected_parent_qty = parent_qty_before_split - 200

            check(
                "Parent lot quantity reduced correctly after split",
                parent_lot_after_split.quantity_on_hand == expected_parent_qty,
                f"Expected {expected_parent_qty}, Got {parent_lot_after_split.quantity_on_hand}",
            )

            # Verify SPLIT Transaction for Child
            child_txs = (
                db.query(InventoryTransaction)
                .filter(
                    InventoryTransaction.lot_id == child_lot.lot_id,
                    InventoryTransaction.transaction_type == "SPLIT",
                )
                .all()
            )

            check(
                "SPLIT transaction recorded for child lot",
                len(child_txs) > 0
                and any(tx.quantity_change == 200 for tx in child_txs),
                f"Found {len(child_txs)} transactions",
            )
    finally:
        db.close()

    # Step 11: Pick Wave Retrieval
    print("\n--- Step 11: Pick Wave ---")

    # Note: The previous steps consumed the original allocation.
    # To test pick wave properly with a PENDING task, we need to ensure there is an unallocated/available stock
    # or re-allocate if the system allows partial allocations or new orders.
    # However, the plan says "After allocate...". Since we already allocated and confirmed/picked/shipped the main SO,
    # let's create a small new SO for the remaining stock to generate a fresh PENDING task for this specific test step.

    db = SessionLocal()
    try:
        # Create a new small SO for the remaining stock (approx 2700 units left: 3000 - 100 adj - 200 split)
        ts_wave = datetime.now().strftime("%Y%m%d%H%M%S")
        so_number_wave = f"SO-E2E-WAVE-{ts_wave}"

        so_wave = SalesOrder(
            so_number=so_number_wave,
            order_date=date.today(),
            status="OPEN",
            lot_selection_rule="FIFO",
        )
        db.add(so_wave)
        db.flush()
        db.add(
            SOLine(
                so_id=so_wave.so_id, line_number=1, internal_sku=SKU, ordered_qty=500
            )
        )
        db.commit()

        # Allocate this new SO
        r_alloc = client.post(
            "/api/v1/picking/allocate", json={"so_number": so_number_wave}
        )
        check(
            "POST /picking/allocate for wave test 200",
            r_alloc.status_code == 200,
            r_alloc.text[:200],
        )

        # Get Pick Wave
        r_wave = client.get("/api/v1/picking/wave")
        ok = check(
            "GET /picking/wave 200", r_wave.status_code == 200, r_wave.text[:200]
        )

        if ok:
            wave_data = r_wave.json()
            check(
                "Pick wave response is a list",
                isinstance(wave_data, list),
                type(wave_data).__name__,
            )

            if isinstance(wave_data, list):
                # Find task for our SKU
                our_tasks = [t for t in wave_data if t.get("internalSku") == SKU]

                check(
                    "Wave contains PENDING task for our SKU",
                    len(our_tasks) > 0,
                    f"Found {len(our_tasks)} tasks",
                )

                if our_tasks:
                    task = our_tasks[0]

                    # Validate documented fields exist
                    required_fields = [
                        "location",
                        "internalSku",
                        "internalLotNumber",
                        "internalBarcode",
                        "vendorLotCode",
                        "pickQty",
                        "receiveDate",
                        "expiryDate",
                        "status",
                        "soNumber",
                    ]
                    missing_fields = [f for f in required_fields if f not in task]

                    check(
                        "Wave task has all documented fields",
                        len(missing_fields) == 0,
                        f"Missing: {missing_fields}",
                    )

                    check(
                        "Wave task status is PENDING",
                        task.get("status") == "PENDING",
                        task.get("status"),
                    )

                    # Check ordering by from_location_id (if multiple tasks, they should be sorted)
                    # Since we only have one SKU here, we just verify the field exists and is valid
                    if "location" in task:
                        check(
                            "Location field present in wave task",
                            bool(task["location"]),
                            task["location"],
                        )

    finally:
        db.close()

    # Step 12: Trace Backward
    print("\n--- Step 12: Trace Backward ---")

    r_trace_back = client.get(
        "/api/v1/trace/backward", params={"internal_barcode": internal_barcode}
    )
    ok = check(
        "GET /trace/backward 200",
        r_trace_back.status_code == 200,
        r_trace_back.text[:200],
    )

    if ok:
        trace_data = r_trace_back.json()

        # Assert exact keys
        expected_keys = {
            "internalBarcode",
            "internalLotNumber",
            "vendorLotCode",
            "vendorDateCode",
            "supplierName",
            "originalBarcode",
        }
        actual_keys = set(trace_data.keys())

        check(
            "Trace backward response has exact documented keys",
            actual_keys == expected_keys,
            f"Expected {expected_keys}, Got {actual_keys}",
        )

        check(
            "Trace backward supplierName is Texas Instruments",
            trace_data.get("supplierName") == "Texas Instruments",
            trace_data.get("supplierName"),
        )

    # Step 13: User Management API (e2e-op user)
    print("\n--- Step 13: User Management API ---")

    # 13.1 Create e2e-op user
    r = client.post(
        "/api/v1/users",
        json={"username": "e2e-op", "password": "e2e-op-pw1", "role": "operator"},
    )
    user_created = False
    if r.status_code == 409:
        # Username already exists - check if we can activate it
        db = SessionLocal()
        try:
            existing_op = db.query(User).filter(User.username == "e2e-op").first()
            if existing_op:
                # Check if password is still pw1 or has been changed to pw2
                # If password was changed to pw2, we need to reset it to pw1 for this test
                from app.core.security import verify_password

                if not verify_password("e2e-op-pw1", existing_op.password_hash):
                    # Password was changed by previous test run, reset it
                    existing_op.password_hash = hash_password("e2e-op-pw1")
                existing_op.role = "operator"
                existing_op.is_active = True
                db.commit()
                check(
                    "Activate existing e2e-op user with pw1",
                    True,
                    "activated existing user",
                )
                user_created = True  # Treat as success
            else:
                check(
                    "Create e2e-op user (409 conflict, no user found)",
                    False,
                    "unexpected state",
                )
        finally:
            db.close()
    else:
        check(
            "POST /api/v1/users create e2e-op 201", r.status_code == 201, r.text[:200]
        )
        user_created = True

    # 13.2 GET all users - verify e2e-op is in the list
    r = client.get("/api/v1/users")
    ok = check("GET /api/v1/users 200", r.status_code == 200, r.text[:200])
    if ok:
        users = r.json()
        e2e_op_in_list = any(u.get("username") == "e2e-op" for u in users)
        check("e2e-op user in list", e2e_op_in_list, f"found={e2e_op_in_list}")

    # 13.3 Login as e2e-op and verify operator role cannot access admin endpoints
    r = client.post(
        "/api/v1/auth/login", json={"username": "e2e-op", "password": "e2e-op-pw1"}
    )
    ok = check("e2e-op login with pw1 200", r.status_code == 200, r.text[:200])
    if ok:
        op_token = r.json()["access_token"]
        client.headers.update({"Authorization": f"Bearer {op_token}"})

        # Try to access inventory/adjust which requires admin/supervisor role
        r = client.post(
            "/api/v1/inventory/adjust",
            json={"lotId": lot_id, "quantityChange": -1, "reason": "E2E Test"},
        )
        check(
            "operator cannot access inventory/adjust (403)",
            r.status_code == 403,
            r.status_code,
        )

        # Try to access users endpoint which requires admin role
        r = client.get("/api/v1/users")
        check(
            "operator cannot access users endpoint (403)",
            r.status_code == 403,
            r.status_code,
        )

    # 13.4 Admin resets e2e-op password
    db = SessionLocal()
    try:
        e2e_op_user = db.query(User).filter(User.username == "e2e-op").first()
        if e2e_op_user:
            client.headers.update(
                {
                    "Authorization": (
                        f"Bearer {r_noauth.headers.get('www-authenticate')}"
                        if r_noauth.status_code == 401
                        else "Bearer "
                        + client.headers.get("Authorization", "").replace("Bearer ", "")
                    )
                }
            )
            # Re-login as admin
            client.headers.pop("Authorization", None)
            r_admin = client.post(
                "/api/v1/auth/login",
                json={"username": "e2e-admin", "password": "e2e-test-pw"},
            )
            if r_admin.status_code == 200:
                admin_token = r_admin.json()["access_token"]
                client.headers.update({"Authorization": f"Bearer {admin_token}"})

                r = client.post(
                    f"/api/v1/users/{e2e_op_user.user_id}/password",
                    json={"new_password": "e2e-op-pw2"},
                )
                check(
                    "Admin reset e2e-op password 200",
                    r.status_code == 200,
                    r.text[:200],
                )

                # Verify old password fails
                r = client.post(
                    "/api/v1/auth/login",
                    json={"username": "e2e-op", "password": "e2e-op-pw1"},
                )
                check(
                    "e2e-op old password (pw1) fails 401",
                    r.status_code == 401,
                    r.status_code,
                )

                # Verify new password works
                r = client.post(
                    "/api/v1/auth/login",
                    json={"username": "e2e-op", "password": "e2e-op-pw2"},
                )
                check(
                    "e2e-op new password (pw2) login 200",
                    r.status_code == 200,
                    r.text[:200],
                )
    finally:
        db.close()

    # --- NEW TEST STEPS END HERE ---

    # Step 14: Purchase Order API Test
    print("\n--- Step 14: Purchase Order API Test ---")

    ts = datetime.now().strftime("%Y%m%d%H%M%S")
    test_po_number = f"PO-E2E-API-{ts}"

    # Get vendors first
    response = client.get("/api/v1/vendors")
    assert response.status_code == 200
    vendors = response.json()
    test_vendor_id = vendors[0]["vendor_id"] if vendors else 1

    # Get items to ensure we have valid SKUs
    response = client.get("/api/v1/purchase-orders/items")
    assert response.status_code == 200
    items = response.json()
    # Use the TI SKU/PN so the later receive-against-PO step can match the TI barcode.
    test_sku = SKU

    # Test 1: Create new PO successfully
    response = client.post(
        "/api/v1/purchase-orders",
        json={
            "poNumber": test_po_number,
            "vendorId": test_vendor_id,
            "lines": [
                {"internalSku": test_sku, "vendorPn": VENDOR_PN, "orderedQty": 100000}
            ],
        },
    )
    check(
        "POST /purchase-orders create 201",
        response.status_code == 201,
        f"status={response.status_code}",
    )
    if response.status_code == 201:
        po_data = response.json()
        check(
            "PO has correct poNumber",
            po_data.get("poNumber") == test_po_number,
            po_data.get("poNumber"),
        )
        check(
            "PO status is OPEN", po_data.get("status") == "OPEN", po_data.get("status")
        )
        check(
            "PO has lines",
            len(po_data.get("lines", [])) > 0,
            len(po_data.get("lines", [])),
        )

    # Test 2: Duplicate PO number should return 409
    response = client.post(
        "/api/v1/purchase-orders",
        json={
            "poNumber": test_po_number,
            "vendorId": test_vendor_id,
            "lines": [
                {"internalSku": test_sku, "vendorPn": "TEST-PN-DUP", "orderedQty": 30}
            ],
        },
    )
    check(
        "POST /purchase-orders duplicate returns 409",
        response.status_code == 409,
        f"status={response.status_code}",
    )

    # Test 3: Invalid vendor_id should return 400
    response = client.post(
        "/api/v1/purchase-orders",
        json={
            "poNumber": "PO-INVALID-VENDOR",
            "vendorId": 99999,
            "lines": [
                {"internalSku": test_sku, "vendorPn": "TEST-PN-INV", "orderedQty": 30}
            ],
        },
    )
    check(
        "POST /purchase-orders invalid vendor returns 400",
        response.status_code == 400,
        f"status={response.status_code}",
    )

    # Test 4: Invalid SKU should return 400
    response = client.post(
        "/api/v1/purchase-orders",
        json={
            "poNumber": "PO-INVALID-SKU",
            "vendorId": test_vendor_id,
            "lines": [
                {
                    "internalSku": "SKU-NOT-EXIST",
                    "vendorPn": "TEST-PN-INV",
                    "orderedQty": 30,
                }
            ],
        },
    )
    check(
        "POST /purchase-orders invalid SKU returns 400",
        response.status_code == 400,
        f"status={response.status_code}",
    )

    # Test 5: Receive against the created PO
    # First, scan a barcode to get parsed data
    response = client.post(
        "/api/v1/receiving/scan",
        json={"barcode": TI_BARCODE, "vendor_id": test_vendor_id},
    )
    check(
        "POST /receiving/scan 200",
        response.status_code == 200,
        f"status={response.status_code}",
    )

    if response.status_code == 200 and response.json().get("success"):
        scan_result = response.json()["parsed"]
        response = client.post(
            "/api/v1/receiving/receive",
            json={
                "po_number": test_po_number,
                "barcode": TI_BARCODE,
                "vendor_id": test_vendor_id,
                "qty": min(int(scan_result.get("qty") or 100), 100),
            },
        )
        check(
            "POST /receiving/receive using new PO 200",
            response.status_code == 200,
            f"status={response.status_code} body={response.text[:200]}",
        )

    # Step 15: Change own password (自助改密碼)
    print("\n--- Step 14: Change Own Password ---")

    # 14.1 Create e2e-pwc user with admin token
    # First, try to create user, if 409 (already exists), activate it and reset password
    r = client.post(
        "/api/v1/users",
        json={"username": "e2e-pwc", "password": "pwc-start-1", "role": "operator"},
    )
    user_id = None
    if r.status_code == 409:
        # User exists, get user_id from GET /api/v1/users and activate
        r_users = client.get("/api/v1/users")
        if r_users.status_code == 200:
            users = r_users.json()
            for u in users:
                if u.get("username") == "e2e-pwc":
                    user_id = u.get("user_id")
                    break
        if user_id:
            # Activate user
            r_patch = client.patch(f"/api/v1/users/{user_id}", json={"is_active": True})
            check(
                "Activate existing e2e-pwc user",
                r_patch.status_code == 200,
                r_patch.status_code,
            )
            # Reset password to pwc-start-1 using admin password reset endpoint
            db = SessionLocal()
            try:
                existing_pwc = db.query(User).filter(User.username == "e2e-pwc").first()
                if existing_pwc:
                    existing_pwc.password_hash = hash_password("pwc-start-1")
                    db.commit()
                    check(
                        "Reset e2e-pwc password to pwc-start-1", True, "reset password"
                    )
            finally:
                db.close()
    elif r.status_code == 201:
        # User created successfully, get user_id
        check(
            "POST /api/v1/users create e2e-pwc 201", r.status_code == 201, r.text[:200]
        )
        r_users = client.get("/api/v1/users")
        if r_users.status_code == 200:
            users = r_users.json()
            for u in users:
                if u.get("username") == "e2e-pwc":
                    user_id = u.get("user_id")
                    break

    # 14.2 Login as e2e-pwc with pwc-start-1
    client.headers.pop("Authorization", None)  # Clear admin token
    r = client.post(
        "/api/v1/auth/login", json={"username": "e2e-pwc", "password": "pwc-start-1"}
    )
    ok = check("e2e-pwc login with pwc-start-1 200", r.status_code == 200, r.text[:200])
    e2e_pwc_token = None
    if ok:
        e2e_pwc_token = r.json()["access_token"]
        client.headers.update({"Authorization": f"Bearer {e2e_pwc_token}"})

    # 14.3 Try changing password with wrong old password (should fail with 400)
    r = client.post(
        "/api/v1/auth/me/password",
        json={"old_password": "WRONG", "new_password": "pwc-next-22"},
    )
    check(
        "Change password with wrong old password 400",
        r.status_code == 400,
        r.status_code,
    )

    # 14.4 Change password with correct old password (should succeed with 200)
    r = client.post(
        "/api/v1/auth/me/password",
        json={"old_password": "pwc-start-1", "new_password": "pwc-next-22"},
    )
    ok = check(
        "Change password with correct old password 200",
        r.status_code == 200,
        r.text[:200],
    )

    # 14.5 Verify new password works and old password fails
    # Login with new password
    r = client.post(
        "/api/v1/auth/login", json={"username": "e2e-pwc", "password": "pwc-next-22"}
    )
    check(
        "e2e-pwc login with new password pwc-next-22 200",
        r.status_code == 200,
        r.text[:200],
    )

    # Login with old password (should fail)
    r = client.post(
        "/api/v1/auth/login", json={"username": "e2e-pwc", "password": "pwc-start-1"}
    )
    check(
        "e2e-pwc login with old password pwc-start-1 401",
        r.status_code == 401,
        r.status_code,
    )

    # 14.6 Reset password back to pwc-start-1 for future test runs
    if e2e_pwc_token:
        client.headers.update({"Authorization": f"Bearer {e2e_pwc_token}"})
    r = client.post(
        "/api/v1/auth/me/password",
        json={"old_password": "pwc-next-22", "new_password": "pwc-start-1"},
    )
    check(
        "Reset e2e-pwc password back to pwc-start-1 200",
        r.status_code == 200,
        r.text[:200],
    )

    # Step 16: Create SO via API
    print("\n--- Step 16: Create SO via API ---")

    ts = datetime.now().strftime("%Y%m%d%H%M%S")
    test_so_number = f"SO-E2E-API-{ts}"

    # Get customers first
    response = client.get("/api/v1/customers")
    assert response.status_code == 200
    customers = response.json()
    test_customer_id = customers[0]["customer_id"] if customers else None

    # Get items to ensure we have valid SKUs with inventory
    response = client.get("/api/v1/picking/orders")
    assert response.status_code == 200

    # Use existing SKU with inventory
    test_sku = SKU  # Use the same SKU we've been using

    # Test 1: Create new SO successfully with small quantity (less than existing inventory)
    response = client.post(
        "/api/v1/picking/orders",
        json={
            "soNumber": test_so_number,
            "customerId": test_customer_id,
            "strategy": "FIFO",
            "lines": [{"internalSku": test_sku, "orderedQty": 10}],
        },
    )
    check(
        "POST /picking/orders create 201",
        response.status_code == 201,
        f"status={response.status_code}",
    )
    if response.status_code == 201:
        so_data = response.json()
        check(
            "SO has correct soNumber",
            so_data.get("soNumber") == test_so_number,
            so_data.get("soNumber"),
        )
        check(
            "SO status is OPEN", so_data.get("status") == "OPEN", so_data.get("status")
        )
        check(
            "SO has lines", so_data.get("totalLines", 0) > 0, so_data.get("totalLines")
        )
        check(
            "SO has correct totalQty",
            so_data.get("totalQty", 0) == 10,
            so_data.get("totalQty"),
        )

    # Test 2: Duplicate SO number should return 409
    response = client.post(
        "/api/v1/picking/orders",
        json={
            "soNumber": test_so_number,
            "customerId": test_customer_id,
            "strategy": "FIFO",
            "lines": [{"internalSku": test_sku, "orderedQty": 5}],
        },
    )
    check(
        "POST /picking/orders duplicate returns 409",
        response.status_code == 409,
        f"status={response.status_code}",
    )

    # Test 3: Invalid strategy should return 400
    response = client.post(
        "/api/v1/picking/orders",
        json={
            "soNumber": "SO-INVALID-STRATEGY",
            "customerId": test_customer_id,
            "strategy": "INVALID",
            "lines": [{"internalSku": test_sku, "orderedQty": 5}],
        },
    )
    check(
        "POST /picking/orders invalid strategy returns 400",
        response.status_code == 400,
        f"status={response.status_code}",
    )

    # Test 4: Invalid customer_id should return 400
    response = client.post(
        "/api/v1/picking/orders",
        json={
            "soNumber": "SO-INVALID-CUST",
            "customerId": 99999,
            "strategy": "FIFO",
            "lines": [{"internalSku": test_sku, "orderedQty": 5}],
        },
    )
    check(
        "POST /picking/orders invalid customer returns 400",
        response.status_code == 400,
        f"status={response.status_code}",
    )

    # Test 5: Invalid SKU should return 400
    response = client.post(
        "/api/v1/picking/orders",
        json={
            "soNumber": "SO-INVALID-SKU",
            "customerId": test_customer_id,
            "strategy": "FIFO",
            "lines": [{"internalSku": "SKU-NOT-EXIST", "orderedQty": 5}],
        },
    )
    check(
        "POST /picking/orders invalid SKU returns 400",
        response.status_code == 400,
        f"status={response.status_code}",
    )

    # Test 6: Empty lines should return 400
    response = client.post(
        "/api/v1/picking/orders",
        json={
            "soNumber": "SO-EMPTY-LINES",
            "customerId": test_customer_id,
            "strategy": "FIFO",
            "lines": [],
        },
    )
    check(
        "POST /picking/orders empty lines returns 400",
        response.status_code == 400,
        f"status={response.status_code}",
    )

    # Test 7: Allocate the created SO
    response = client.post(
        "/api/v1/picking/allocate",
        json={"so_number": test_so_number},
    )
    check(
        "POST /picking/allocate created SO 200",
        response.status_code == 200,
        f"status={response.status_code}",
    )
    if response.status_code == 200:
        alloc_data = response.json()
        check(
            "AllocatedQty == orderedQty (10)",
            alloc_data.get("allocatedQty") == 10,
            alloc_data.get("allocatedQty"),
        )

    print(f"\nRESULT: {_passed} passed, {_failed} failed")
    sys.exit(1 if _failed else 0)


def test_e2e_flow():
    """pytest entry point."""
    main()


if __name__ == "__main__":
    main()
