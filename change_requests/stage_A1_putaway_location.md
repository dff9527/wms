# Stage A1 — 上架寫回 lot.location_id

> 餵給 Pipeline **B-Web**。前置見 `REMAINING_WORK.md` §0（commit、清 rag、Fresh Start、schema.sql 為真相來源）。
> 後端 Python 輪：產出後自行 `uvicorn` + `python tests/test_e2e_flow.py` 驗證。

## A. 現況
IQC PASS 時 `core/warehouse/receiving.py` 的 `complete_iqc()` 會呼叫 `PutAwayEngine.suggest_location(lot)`，但只拿到 location_code 字串、**沒寫回 `lot.location_id`**，所以全系統 location 都是 null。

## B. change_request（複製貼上）
```
Persist the suggested putaway location onto the lot when IQC passes, and record a PUT_AWAY transaction.

Context (DB is the source of truth — schema.sql, all columns snake_case):
- storage_locations has: location_id (PK), location_code (unique). suggest_location currently returns location_code.
- inventory_lots has: lot_id, location_id (FK -> storage_locations.location_id), lot_status.
- inventory_transactions allows transaction_type 'PUT_AWAY' and has columns: transaction_type, lot_id, quantity_change, from_location_id, to_location_id, reference_type, reference_number, executed_by.

Changes:
1. backend/app/core/warehouse/putaway.py — add a method suggest_location_id(lot) -> Optional[int] that returns the chosen StorageLocation.location_id (reuse the existing scoring in suggest_location; have suggest_location call the id version and resolve the code, OR return both). Do NOT change the scoring logic.
2. backend/app/core/warehouse/receiving.py — in complete_iqc(), when result == 'PASS':
   - resolve the suggested location_id, set lot.location_id = that id,
   - write an InventoryTransaction(transaction_type='PUT_AWAY', lot_id=lot.lot_id, quantity_change=0, to_location_id=<id>, reference_type='IQC', reference_number=str(lot.lot_id), executed_by=inspector),
   - keep returning {"success", "status", "suggestedLocation"} (suggestedLocation stays the location_code for the UI).
   Commit once at the end (existing try/except).

Constraints:
- Do NOT generate a DB migration; no schema change is needed.
- Do NOT touch the frontend.
- Keep lot_status transitions as-is (PASS -> AVAILABLE, FAIL -> QUARANTINE).

[貼上 spec §6.2「上架流程」整段]
```

## C. 影響
- 改：`core/warehouse/putaway.py`、`core/warehouse/receiving.py`。無新增表、無前端。

## D. 前置 / 驗證
```bash
cd ~/projects/wms && git add -A && git commit -m "checkpoint before A1" && rm -rf .rag-index
# 跑完：
cd backend && source .venv/bin/activate && python tests/test_e2e_flow.py   # location 應不再是 null
```
e2e 腳本裡 packing-list / inventory 的 location 欄位這次應有值。
