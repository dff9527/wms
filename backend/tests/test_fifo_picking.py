"""FIFO / FEFO 配貨單元測試 — 對真實 DB (localhost:5433) 執行。

    cd ~/projects/wms/backend
    source .venv/bin/activate
    python tests/test_fifo_picking.py        # 直接跑
    pytest -s tests/test_fifo_picking.py     # 或用 pytest

使用獨立 SKU (IC-FIFO-TEST) 與 SO 編號,執行前後自動清理,不影響其他資料。
"""
import os
import sys
from datetime import date, datetime, timedelta

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import pytest

from app.db.session import SessionLocal
from app.models.item import Item
from app.models.inventory import InventoryLot
from app.models.transaction import InventoryTransaction
from app.models.order import SalesOrder, SOLine, PickTask
from app.core.warehouse.picking import PickingEngine

SKU = "IC-FIFO-TEST"
SO_NUMBERS = ("SO-FIFO-TEST", "SO-FEFO-TEST")


def _cleanup(db):
    so_ids = [r[0] for r in db.query(SalesOrder.so_id)
              .filter(SalesOrder.so_number.in_(SO_NUMBERS)).all()]
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


def _make_lot(barcode, lot_number, qty, receive_days_ago, expiry_date=None):
    return InventoryLot(
        internal_sku=SKU,
        internal_barcode=barcode,
        internal_lot_number=lot_number,
        quantity_on_hand=qty,
        quantity_reserved=0,
        unit="PCS",
        lot_status="AVAILABLE",
        receive_date=datetime.utcnow() - timedelta(days=receive_days_ago),
        expiry_date=expiry_date,
    )


def _make_so(db, so_number, rule, ordered_qty):
    so = SalesOrder(so_number=so_number, order_date=date.today(),
                    status="OPEN", lot_selection_rule=rule)
    db.add(so)
    db.flush()
    db.add(SOLine(so_id=so.so_id, line_number=1, internal_sku=SKU, ordered_qty=ordered_qty))
    db.commit()


@pytest.fixture
def db_session():
    db = SessionLocal()
    _cleanup(db)
    if not db.query(Item).filter(Item.internal_sku == SKU).first():
        db.add(Item(internal_sku=SKU, item_type="IC", description="FIFO unit-test IC",
                    base_unit="PCS"))
        db.commit()
    yield db
    _cleanup(db)
    db.close()


class TestFIFOPicking:

    def test_fifo_basic(self, db_session):
        """最早收貨優先;跨批次配貨;最新批次不動。"""
        db_session.add_all([
            _make_lot("INT-UT-OLD", "LOT-OLD", 1000, receive_days_ago=30),
            _make_lot("INT-UT-MID", "LOT-MID", 1500, receive_days_ago=15),
            _make_lot("INT-UT-NEW", "LOT-NEW", 2000, receive_days_ago=0),
        ])
        db_session.commit()
        _make_so(db_session, "SO-FIFO-TEST", "FIFO", ordered_qty=1500)

        result = PickingEngine(db_session).allocate_lots_for_so("SO-FIFO-TEST")
        db_session.commit()

        details = result["details"]
        assert len(details) == 2
        assert details[0]["internalLotNumber"] == "LOT-OLD"
        assert details[0]["qty"] == 1000
        assert details[1]["internalLotNumber"] == "LOT-MID"
        assert details[1]["qty"] == 500

    def test_fefo_with_expiry(self, db_session):
        """最早到期優先,即使它比較早收貨。"""
        db_session.add_all([
            _make_lot("INT-UT-SOON", "LOT-EXPIRE-SOON", 1000, receive_days_ago=30,
                      expiry_date=date.today() + timedelta(days=10)),
            _make_lot("INT-UT-LATER", "LOT-EXPIRE-LATER", 1000, receive_days_ago=20,
                      expiry_date=date.today() + timedelta(days=100)),
        ])
        db_session.commit()
        _make_so(db_session, "SO-FEFO-TEST", "FEFO", ordered_qty=500)

        result = PickingEngine(db_session).allocate_lots_for_so("SO-FEFO-TEST")
        db_session.commit()

        details = result["details"]
        assert len(details) == 1
        assert details[0]["internalLotNumber"] == "LOT-EXPIRE-SOON"
        assert details[0]["qty"] == 500

    def test_expired_lot_excluded(self, db_session):
        """已過期批次不可配出。"""
        db_session.add_all([
            _make_lot("INT-UT-EXP", "LOT-EXPIRED", 5000, receive_days_ago=400,
                      expiry_date=date.today() - timedelta(days=1)),
            _make_lot("INT-UT-OK", "LOT-OK", 1000, receive_days_ago=5,
                      expiry_date=date.today() + timedelta(days=200)),
        ])
        db_session.commit()
        _make_so(db_session, "SO-FEFO-TEST", "FEFO", ordered_qty=500)

        result = PickingEngine(db_session).allocate_lots_for_so("SO-FEFO-TEST")
        db_session.commit()

        lots_used = [d["internalLotNumber"] for d in result["details"]]
        assert "LOT-EXPIRED" not in lots_used
        assert lots_used == ["LOT-OK"]


def main():
    """直接 python 執行時的簡易 runner(不依賴 pytest)。"""
    passed = failed = 0
    suite = TestFIFOPicking()
    for name in ("test_fifo_basic", "test_fefo_with_expiry", "test_expired_lot_excluded"):
        db = SessionLocal()
        _cleanup(db)
        if not db.query(Item).filter(Item.internal_sku == SKU).first():
            db.add(Item(internal_sku=SKU, item_type="IC", description="FIFO unit-test IC",
                        base_unit="PCS"))
            db.commit()
        try:
            getattr(suite, name)(db)
            print(f"   [PASS] {name}")
            passed += 1
        except AssertionError as e:
            print(f"   [FAIL] {name}   -> {e}")
            failed += 1
        finally:
            _cleanup(db)
            db.close()
    print(f"\nRESULT: {passed} passed, {failed} failed")
    sys.exit(1 if failed else 0)


if __name__ == "__main__":
    main()
