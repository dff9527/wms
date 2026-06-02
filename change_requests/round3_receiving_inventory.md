# Round 3 — 收貨 + 庫存 (Receiving / Putaway / Inventory + API + 前端串接)

> 餵給 Pipeline **B-Web**。依賴 Round 1（models）、Round 2（BarcodeParser）。共通注意事項見 `round1_data_layer.md` 開頭 ⚠️。

---

## A. 現有專案摘要

- 後端已有 `api/v1/receiving.py`（stub，回 mock 資料）、Round 2 的 `BarcodeParser`。
- 前端 `ReceivingModule.tsx` + `receiving/ReceivingList.tsx`、`receiving/ReceivingDetail.tsx` 已存在，目前接 mock client（`app/types/receiving.ts`）。`InventoryModule.tsx` 為殼。
- 本輪把收貨從 stub 變成真實流程，並補上庫存查詢/調整/拆帶。

---

## B. change_request spec（複製貼上）

```
Implement real receiving + inventory backend logic (replacing the receiving stub) and wire the existing frontend Receiving/Inventory modules to it. Models exist from round 1; BarcodeParser exists from round 2. Follow WMS spec sections 6.1, 6.2, 7.1 (inventory + receiving routes).

New backend files:
- backend/app/core/warehouse/__init__.py
- backend/app/core/warehouse/receiving.py — class ReceivingService(db): process_receipt(po_number, barcode, vendor_id, qty, ...) → parse barcode, validate against PO line, create InventoryLot (generate internal_barcode/lot_number), write a RECEIVE InventoryTransaction; complete_iqc(lot_id, result, inspector) → set iqc_result + lot_status.
- backend/app/core/warehouse/putaway.py — class PutAwayEngine(db): suggest_location(lot) multi-factor score (space utilization, same-SKU clustering, ABC, FIFO) per spec 6.2.
- backend/app/core/warehouse/adjustment.py — quantity adjust + lot split (writes ADJUST / SPLIT transactions, sets parent_lot_id on split).
- backend/app/schemas/receiving.py — ScanResult, ReceiveRequest, ReceiveResponse, IQCRequest.
- backend/app/schemas/inventory.py — LotOut, LotListQuery, AdjustRequest, SplitRequest.
- backend/app/services/inventory_service.py — query lots (filter by sku/status/location/vendor), get lot detail, adjust, split.
- backend/app/api/v1/inventory.py — router /inventory: GET /lots, GET /lots/{lot_id}, POST /adjust, POST /split.

Modify backend:
- backend/app/api/v1/receiving.py — replace mock responses with ReceivingService: POST /scan, POST /receive, POST /iqc, GET /pending. Keep the existing response shape/route paths the frontend already consumes where possible.
- backend/app/main.py — register inventory router.

Modify frontend:
- frontend/src/app/components/InventoryModule.tsx — fetch GET /api/v1/inventory/lots via React Query, render lot list + detail (reuse shared lot types in app/types/wms-inventory.ts).
- frontend/src/app/components/receiving/ReceivingList.tsx + ReceivingDetail.tsx — point the typed client at the now-real endpoints; integrate the BarcodeScanner from round 2 in the receive flow.

Behavior:
- process_receipt is atomic: parse → validate PO → create lot → transaction in one commit; raise + 400 on PO mismatch.
- GET /inventory/lots supports query filters; default excludes SHIPPED/EXPIRED.
- Do NOT generate a migration. Reuse existing column names from the inventory_lots schema.

[在這裡貼上 spec §6.1、§6.2 的流程說明 + §7.1 的 receiving/inventory 路由清單；收貨/上架若需細節，附 §4.1 inventory_lots / inventory_transactions 欄位定義]
```

---

## C. 影響分析

- **新增後端**：`core/warehouse/{receiving,putaway,adjustment}.py`、`schemas/{receiving,inventory}.py`、`services/inventory_service.py`、`api/v1/inventory.py`（~7）。
- **修改後端**：`receiving.py`（stub→真實）、`main.py`。
- **修改前端**：`InventoryModule.tsx`、`receiving/ReceivingList.tsx`、`receiving/ReceivingDetail.tsx`。
- ⚠️ 檔案數偏多（~12），**建議照下方子批次拆 3a/3b 兩次跑**，符合 B 的 1–10 限制。
- **下游**：Round 4 揀貨/出貨依賴本輪建立的 lot 與 transaction 寫入。

---

## D. 安全建議

```bash
cd ~/projects/wms
git checkout -b feature/round3-receiving-inventory
git add -A && git commit -m "checkpoint before round3"
```

> 提醒：`receiving.py` 已是前端正在使用的端點，改動時**保持既有 route path 與回傳結構**，避免打斷前端。Pipeline B 直接覆寫檔案、不出 PR，請改完先 `git diff` 再決定保留。

---

## E. 執行指令

```bash
cd ~/projects/ai-pipeline-v8 && source .venv/bin/activate
python run.py b-web '（貼上 B 段 change_request，或子批次版本）' ~/projects/wms
```

**自行驗證**：

```bash
cd ~/projects/wms/backend && uvicorn app.main:app --reload   # 測 /api/v1/receiving/* 與 /inventory/lots
cd ~/projects/wms/frontend && npm run dev                     # InventoryModule 應顯示真實 lots
```

---

## 子批次（建議照此拆）

- **3a 後端收貨/庫存**：`core/warehouse/*`、`schemas/*`、`services/inventory_service.py`、`api/v1/inventory.py`、改 `receiving.py` + `main.py`
- **3b 前端串接**：`InventoryModule.tsx`、`receiving/ReceivingList.tsx`、`receiving/ReceivingDetail.tsx`（B-Web 在此驗證完整）
