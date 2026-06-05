# Stage B — 補測試（adjust / split / wave / backward）並修出現的欄位 drift

> 餵給 Pipeline **B-Web**。前置見 `REMAINING_WORK.md` §0。
> ⚠️ B-Web 的 validate 跑 tsc/vitest，**不會跑 pytest**——產出後**自行**在 5433 上跑 pytest 驗證。

## A. 現況
以下端點存在但沒在真 DB 上跑過，可能仍有欄位 drift：庫存調整/拆帶、揀貨波次、反向追溯。

## B. change_request（複製貼上）
```
Extend backend/tests/test_e2e_flow.py with additional scenarios that exercise the
so-far-untested endpoints, AND fix any column drift they reveal against schema.sql
(DB is the source of truth; all columns snake_case; status values UPPERCASE).

Add to the existing runnable script (keep its style: seed via SessionLocal, call
endpoints via TestClient, print [PASS]/[FAIL] per step, cleanup test rows first):

1. Inventory adjust: after a lot is AVAILABLE, POST /api/v1/inventory/adjust
   { lotId, quantityChange: -100, reason } -> expect 200 and quantity_on_hand reduced by 100,
   and an ADJUST InventoryTransaction written (transaction_type='ADJUST', quantity_change=-100).
2. Inventory split: POST /api/v1/inventory/split { parentLotId, quantityToSplit: 200 }
   -> expect a new child lot with parent_lot_id = parentLotId, a SPLIT transaction, and the
   parent's quantity reduced by 200.
3. Pick wave: after allocate, GET /api/v1/picking/wave -> expect a list containing the PENDING
   task ordered by from_location_id; each item has the documented fields.
4. Trace backward: GET /api/v1/trace/backward?internal_barcode=<the received lot's barcode>
   -> expect { internalBarcode, internalLotNumber, vendorLotCode, vendorDateCode, supplierName, originalBarcode }
   with supplierName == 'Texas Instruments'.

While adding these, if a handler/engine references a column that does NOT exist on the model
(check app/models/*.py against schema.sql), correct it to the real snake_case column. Likely
suspects: adjustment.py and inventory_service.py. Use the model relationships
(InventoryLot.vendor/location, PickTask.lot/so_line) rather than re-querying by string keys.

Constraints:
- Do NOT change DB schema. Do NOT touch the frontend.
- Reuse the existing cleanup_test_data() so the script stays re-runnable.

[貼上 spec 附錄 A 的 FIFO 測試碼 + §6 調整/拆帶流程說明]
```

## C. 影響
- 改：`backend/tests/test_e2e_flow.py`；可能改 `core/warehouse/adjustment.py`、`services/inventory_service.py`。

## D. 前置 / 驗證
```bash
cd ~/projects/wms && git add -A && git commit -m "checkpoint before B" && rm -rf .rag-index
# 跑完自行驗證（pipeline 不跑 pytest）：
cd backend && source .venv/bin/activate && python tests/test_e2e_flow.py    # 全部 [PASS]
```
