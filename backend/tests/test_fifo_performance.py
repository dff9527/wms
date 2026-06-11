"""FIFO 配貨性能測試 (spec 附錄 A.3) — 對真實 DB (localhost:5433) 執行。

目標:1000 筆庫存中配貨 5000 件,1 秒內完成,且 FIFO 順序正確。

    cd ~/projects/wms/backend
    source .venv/bin/activate
    python tests/test_fifo_performance.py
    # 或: pytest -s tests/test_fifo_performance.py
"""
import os
import sys
import time
from datetime import date, datetime, timedelta
from app.utils.time import utcnow

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import pytest

from app.db.session import SessionLocal
from app.models.item import Item
from app.models.inventory import InventoryLot
from app.models.transaction import InventoryTransaction
from app.models.order import SalesOrder, SOLine, PickTask
from app.core.warehouse.picking import PickingEngine

SKU = "IC-PERF-TEST"
SO_NUMBER = "SO-PERF-TEST"
N_LOTS = 1000
QTY_PER_LOT = 100
ORDER_QTY = 5000          # 需要前 50 個最舊批次
TIME_LIMIT_S = 1.0


def _cleanup(db):
    so_ids = [r[0] for r in db.query(SalesOrder.so_id)
              .filter(SalesOrder.so_number == SO_NUMBER).all()]
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


def _seed(db):
    if not db.query(Item).filter(Item.internal_sku == SKU).first():
        db.add(Item(internal_sku=SKU, item_type="IC", description="Perf test IC",
                    base_unit="PCS"))
        db.commit()

    base = utcnow()
    lots = [
        InventoryLot(
            internal_sku=SKU,
            internal_barcode=f"INT-PERF-{i:04d}",
            internal_lot_number=f"LOT-PERF-{i:04d}",
            quantity_on_hand=QTY_PER_LOT,
            quantity_reserved=0,
            unit="PCS",
            lot_status="AVAILABLE",
            # i 越小收貨越早 → FIFO 應從 LOT-PERF-0000 開始配
            receive_date=base - timedelta(days=N_LOTS - i),
        )
        for i in range(N_LOTS)
    ]
    db.add_all(lots)
    db.commit()

    so = SalesOrder(so_number=SO_NUMBER, order_date=date.today(),
                    status="OPEN", lot_selection_rule="FIFO")
    db.add(so)
    db.flush()
    db.add(SOLine(so_id=so.so_id, line_number=1, internal_sku=SKU, ordered_qty=ORDER_QTY))
    db.commit()


def test_large_inventory_fifo():
    db = SessionLocal()
    try:
        _cleanup(db)
        _seed(db)

        start = time.time()
        result = PickingEngine(db).allocate_lots_for_so(SO_NUMBER)
        db.commit()
        elapsed = time.time() - start

        # 性能:1 秒內
        assert elapsed < TIME_LIMIT_S, f"FIFO 配貨耗時 {elapsed:.2f}s,超過 {TIME_LIMIT_S}s 限制"

        # 正確性:配滿 5000
        assert result["allocatedQty"] == ORDER_QTY, result["allocatedQty"]

        # FIFO 順序:前 50 批應為最舊的 LOT-PERF-0000..0049,各 100 件
        details = result["details"]
        assert len(details) == ORDER_QTY // QTY_PER_LOT
        for i, d in enumerate(details):
            assert d["internalLotNumber"] == f"LOT-PERF-{i:04d}", \
                f"第 {i} 批應為 LOT-PERF-{i:04d},實際 {d['internalLotNumber']}"
            assert d["qty"] == QTY_PER_LOT

        print(f"\n   1000 lots / allocate 5000 pcs: {elapsed*1000:.0f} ms (限制 {TIME_LIMIT_S}s)")
    finally:
        _cleanup(db)
        db.close()


def main():
    try:
        test_large_inventory_fifo()
        print("RESULT: 1 passed, 0 failed")
    except AssertionError as e:
        print(f"   [FAIL] {e}")
        print("RESULT: 0 passed, 1 failed")
        sys.exit(1)


if __name__ == "__main__":
    main()