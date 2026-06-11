"""並發整合測試 — 驗證 row lock 防超賣 / 防重複扣帳 / 無死鎖。

只在 PostgreSQL 上有意義(SQLite 會忽略 FOR UPDATE,自動 skip)。

    cd ~/projects/wms/backend
    source .venv/bin/activate
    python tests/test_concurrent_allocation.py

情境 1(防超賣):庫存 1000,兩個 SO 各訂 800 同時 allocate。
  正確結果:恰好一單成功;總保留量 ≤ 現有量;另一單 rollback 不留殘餘。
情境 2(防重複扣帳):同一揀貨任務兩個執行緒同時 confirm。
  正確結果:恰好一次成功,庫存只扣一次。
兩個情境都有 30 秒 timeout,卡住代表死鎖。
"""
import os
import sys
import threading
from datetime import date, datetime, timedelta

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.db.session import SessionLocal, engine
from app.models.item import Item
from app.models.inventory import InventoryLot
from app.models.transaction import InventoryTransaction
from app.models.order import SalesOrder, SOLine, PickTask
from app.core.warehouse.picking import PickingEngine, InsufficientInventoryError

SKU = "IC-CONC-TEST"
SO_PREFIX = "SO-CONC-"
TIMEOUT_S = 30

_passed = 0
_failed = 0


def check(label, cond, extra=""):
    global _passed, _failed
    print(f"   [{'PASS' if cond else 'FAIL'}] {label}" + (f"   -> {extra}" if extra else ""))
    if cond:
        _passed += 1
    else:
        _failed += 1


def _cleanup():
    db = SessionLocal()
    try:
        so_ids = [r[0] for r in db.query(SalesOrder.so_id)
                  .filter(SalesOrder.so_number.like(f"{SO_PREFIX}%")).all()]
        line_ids = [r[0] for r in db.query(SOLine.so_line_id)
                    .filter(SOLine.so_id.in_(so_ids)).all()] if so_ids else []
        lot_ids = [r[0] for r in db.query(InventoryLot.lot_id)
                   .filter(InventoryLot.internal_sku == SKU).all()]
        if line_ids or lot_ids:
            db.query(PickTask).filter(
                (PickTask.so_line_id.in_(line_ids)) | (PickTask.lot_id.in_(lot_ids))
            ).delete(synchronize_session=False)
        if lot_ids:
            db.query(InventoryTransaction).filter(
                InventoryTransaction.lot_id.in_(lot_ids)).delete(synchronize_session=False)
            db.query(InventoryLot).filter(
                InventoryLot.lot_id.in_(lot_ids)).delete(synchronize_session=False)
        if so_ids:
            db.query(SOLine).filter(SOLine.so_id.in_(so_ids)).delete(synchronize_session=False)
            db.query(SalesOrder).filter(SalesOrder.so_id.in_(so_ids)).delete(synchronize_session=False)
        db.commit()
    finally:
        db.close()


def _seed_lot_and_orders():
    db = SessionLocal()
    try:
        if not db.query(Item).filter(Item.internal_sku == SKU).first():
            db.add(Item(internal_sku=SKU, item_type="IC", description="Concurrency test IC",
                        base_unit="PCS"))
            db.commit()
        db.add(InventoryLot(
            internal_sku=SKU, internal_barcode="INT-CONC-001",
            internal_lot_number="LOT-CONC-001", quantity_on_hand=1000,
            quantity_reserved=0, unit="PCS", lot_status="AVAILABLE",
            receive_date=datetime.utcnow() - timedelta(days=1)))
        for i in (1, 2):
            so = SalesOrder(so_number=f"{SO_PREFIX}{i}", order_date=date.today(),
                            status="OPEN", lot_selection_rule="FIFO")
            db.add(so)
            db.flush()
            db.add(SOLine(so_id=so.so_id, line_number=1, internal_sku=SKU, ordered_qty=800))
        db.commit()
    finally:
        db.close()


def _allocate_in_thread(so_number, results, barrier):
    """每個執行緒自己的 session;模擬兩個使用者同時按下配貨。"""
    db = SessionLocal()
    try:
        barrier.wait(timeout=TIMEOUT_S)
        engine_ = PickingEngine(db)
        engine_.allocate_lots_for_so(so_number)
        db.commit()
        results[so_number] = "SUCCESS"
    except InsufficientInventoryError:
        db.rollback()
        results[so_number] = "INSUFFICIENT"
    except Exception as e:  # noqa: BLE001
        db.rollback()
        results[so_number] = f"ERROR: {e!r}"
    finally:
        db.close()


def test_concurrent_allocate_no_oversell():
    _cleanup()
    _seed_lot_and_orders()

    results = {}
    barrier = threading.Barrier(2)
    threads = [
        threading.Thread(target=_allocate_in_thread, args=(f"{SO_PREFIX}{i}", results, barrier))
        for i in (1, 2)
    ]
    for t in threads:
        t.start()
    for t in threads:
        t.join(timeout=TIMEOUT_S)

    hung = [t for t in threads if t.is_alive()]
    check("no deadlock (both threads finished)", not hung, results)

    outcomes = sorted(results.values())
    check("exactly one SUCCESS, one INSUFFICIENT", outcomes == ["INSUFFICIENT", "SUCCESS"], results)

    db = SessionLocal()
    lot = db.query(InventoryLot).filter(InventoryLot.internal_barcode == "INT-CONC-001").first()
    reserved, on_hand = lot.quantity_reserved, lot.quantity_on_hand
    tasks = db.query(PickTask).filter(PickTask.lot_id == lot.lot_id).count()
    db.close()
    check("no oversell: reserved <= on_hand", reserved <= on_hand, f"reserved={reserved}, on_hand={on_hand}")
    check("reserved == 800 (single allocation only)", reserved == 800, reserved)
    check("only one SO's tasks exist", tasks == 1, f"tasks={tasks}")


def _confirm_in_thread(task_id, results, idx, barrier):
    db = SessionLocal()
    try:
        barrier.wait(timeout=TIMEOUT_S)
        PickingEngine(db).confirm_pick(task_id, 800, f"racer-{idx}")
        results[idx] = "SUCCESS"   # confirm_pick 內部已 commit
    except ValueError as e:
        db.rollback()
        results[idx] = "REJECTED"
    except Exception as e:  # noqa: BLE001
        db.rollback()
        results[idx] = f"ERROR: {e!r}"
    finally:
        db.close()


def test_concurrent_confirm_no_double_deduct():
    db = SessionLocal()
    task = (
        db.query(PickTask)
        .join(InventoryLot, PickTask.lot_id == InventoryLot.lot_id)
        .filter(InventoryLot.internal_sku == SKU, PickTask.status == "PENDING")
        .first()
    )
    task_id = task.task_id
    qty_before = task.lot.quantity_on_hand
    db.close()

    results = {}
    barrier = threading.Barrier(2)
    threads = [
        threading.Thread(target=_confirm_in_thread, args=(task_id, results, i, barrier))
        for i in (1, 2)
    ]
    for t in threads:
        t.start()
    for t in threads:
        t.join(timeout=TIMEOUT_S)

    check("no deadlock on concurrent confirm", not any(t.is_alive() for t in threads), results)
    outcomes = sorted(results.values())
    check("exactly one confirm SUCCESS, one REJECTED", outcomes == ["REJECTED", "SUCCESS"], results)

    db = SessionLocal()
    lot = db.query(InventoryLot).filter(InventoryLot.internal_barcode == "INT-CONC-001").first()
    db.close()
    check("inventory deducted exactly once", lot.quantity_on_hand == qty_before - 800,
          f"{qty_before} -> {lot.quantity_on_hand}")


def main():
    if engine.dialect.name != "postgresql":
        print(f"SKIP: dialect={engine.dialect.name} — row lock 只在 PostgreSQL 有意義,"
              "請在本機 (5433) 執行。")
        return

    print("Concurrency integration test (PostgreSQL)")
    try:
        test_concurrent_allocate_no_oversell()
        test_concurrent_confirm_no_double_deduct()
    finally:
        _cleanup()
    print(f"\nRESULT: {_passed} passed, {_failed} failed")
    sys.exit(1 if _failed else 0)


if __name__ == "__main__":
    main()
