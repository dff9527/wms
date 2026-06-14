"""清空供應商相關資料 — 為「依實際供應商條碼重建規則庫」做準備。

⚠️ 破壞性操作。會刪除(依 FK 順序):
    pick_tasks → inventory_transactions → inventory_lots
    → so_lines → sales_orders → po_lines → purchase_orders
    → vendor_items → barcode_patterns → vendors
保留:users、customers、warehouses、storage_locations、items(料號主檔)。
如果連料號也要清,加 --include-items。

用法:
    cd ~/projects/wms/backend
    source .venv/bin/activate
    python scripts/reset_vendor_data.py            # 顯示將刪除的筆數(dry-run)
    python scripts/reset_vendor_data.py --execute  # 真的刪(會再要求輸入 RESET 確認)

清完之後重建規則的兩條路:
  1. 手動:POST /api/v1/barcodes/patterns(regex 會先驗證能否 compile)
  2. AI 學習:POST /api/v1/barcodes/learn(拿實際掃到的 3-5 個條碼樣本,需 CLAUDE_API_KEY)
"""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.db.session import SessionLocal
from app.models.item import Item
from app.models.inventory import InventoryLot
from app.models.transaction import InventoryTransaction
from app.models.order import SalesOrder, SOLine, PickTask, PurchaseOrder, POLine
from app.models.vendor import Vendor, VendorItem, BarcodePattern

# 刪除順序很重要(子表先刪)
DELETE_ORDER = [
    ("pick_tasks", PickTask),
    ("inventory_transactions", InventoryTransaction),
    ("inventory_lots", InventoryLot),
    ("so_lines", SOLine),
    ("sales_orders", SalesOrder),
    ("po_lines", POLine),
    ("purchase_orders", PurchaseOrder),
    ("vendor_items", VendorItem),
    ("barcode_patterns", BarcodePattern),
    ("vendors", Vendor),
]


def main():
    execute = "--execute" in sys.argv
    include_items = "--include-items" in sys.argv

    targets = list(DELETE_ORDER)
    if include_items:
        targets.append(("items", Item))

    db = SessionLocal()
    try:
        print("目前資料量:")
        counts = {}
        for name, model in targets:
            counts[name] = db.query(model).count()
            print(f"  {name:25s} {counts[name]:>8,}")

        total = sum(counts.values())
        if total == 0:
            print("\n沒有資料可刪。")
            return

        if not execute:
            print("\n(dry-run)加上 --execute 才會真的刪除。")
            return

        print("\n⚠️  即將刪除以上全部資料(users/warehouses/storage_locations 保留)。")
        answer = input("確認請輸入 RESET:")
        if answer.strip() != "RESET":
            print("已取消。")
            return

        for name, model in targets:
            n = db.query(model).delete(synchronize_session=False)
            print(f"  deleted {name}: {n:,}")
        db.commit()
        print("\n完成。接下來:")
        print("  1. 用實際供應商標籤建 vendors + barcode_patterns")
        print("     (POST /api/v1/barcodes/patterns 或 /barcodes/learn)")
        print("  2. 建 vendor_items(AVL 對照)後才能收貨")
    finally:
        db.close()


if __name__ == "__main__":
    main()
