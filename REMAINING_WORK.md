# WMS — 未完成事項清單（給後續 Pipeline B-Web 補齊用）

> 整理時間：2026-06-03。以「現況實測」為基準，不是照 spec 想像。
> 目的：作為後續一輪一輪餵給 **Pipeline B-Web** 的 backlog。每個區塊大致對應 1–2 份 change_request。

---

## 0. 跑 B-Web 前必讀（重複提醒，避免重蹈覆轍）

1. **先 commit**：`cd ~/projects/wms && git add -A && git commit -m "..."`。沒 commit 的東西會被 pipeline 的 `git stash` 洗掉。
2. **清 RAG 索引**：每輪前 `rm -rf ~/projects/wms/.rag-index`，否則 Planner 看不到上一輪/手動修過的檔。
3. **用 Fresh Start，不要按 Run**（Run 在有 checkpoint 時會卡死在互動式 input）。
4. **真相來源是 `change_requests/schema.sql`**：change_request 內務必聲明「DB 欄位一律 snake_case，照 schema.sql；前端 camelCase 只是回傳整形，不是欄位名」。並把 spec 對應章節原文貼進去（RAG 索引不到 `.py`）。
5. **Stage F 已上線**：現在 pipeline 跑完會自動跑決定性 gate（語法 / import 接線 / 欄位 drift / openapi 建構 / 雙重 prefix / ORM `__dict__`）。但它**抓不到「欄位值邏輯錯」**——那仍要靠 `backend/tests/test_e2e_flow.py` 在 5433 上實測。每輪後跑它。

---

## ✅ 已驗證可動（端到端 13/13，不用再做）

收貨 → IQC → 庫存查詢 → FIFO 配貨 → 揀貨確認 → 出貨 → 裝箱單(FIFO 證明) → 正向追溯。
後端這條主線是通的（`backend/tests/test_e2e_flow.py` 全綠）。

---

## A. 後端功能缺口（spec 有列，但目前是 stub 或沒做）

### A1. 上架儲位沒寫回 `lot.location_id`（小修、優先）
- **現況**：`core/warehouse/receiving.py` 的 `complete_iqc()` 會呼叫 `PutAwayEngine.suggest_location()` 算出建議儲位，但**沒把結果寫進 `lot.location_id`**。所以全系統的 location 都是 null（庫存、揀貨、出貨、裝箱單都看不到儲位）。
- **要做**：IQC PASS 後，把建議儲位的 `location_id` 寫回 lot，並寫一筆 `PUT_AWAY` 交易（schema 的 transaction_type 已允許）。
- **spec**：§6.2 上架演算法。
- **影響檔**：`core/warehouse/receiving.py`、可能 `core/warehouse/putaway.py`（回傳 location_id 而非只有 code）。

### A2. PO 驗證是 mock（收貨不檢查採購單）
- **現況**：`process_receipt()` 裡 PO 驗證被註解掉（`_validate_po_line` 是空殼），給任何 `po_number` 都會收。
- **要做**：查 `purchase_orders` / `po_lines`，驗證 PO 存在且 OPEN、含此 SKU/vendor，收貨後累加 `po_lines.received_qty`、必要時把 PO 轉 PARTIAL/CLOSED。
- **spec**：§6.1 收貨流程；schema 的 `purchase_orders` / `po_lines`。
- **影響檔**：`core/warehouse/receiving.py`、新增 PO 查詢邏輯。
- **注意**：目前沒有建立 PO 的端點/種子，測試前要先有 PO 資料。

### A3. 認證 / 權限（完全沒有）
- **現況**：`api/deps.py` 的 `get_current_user()` 回寫死的 `{"username":"system"}`。沒有登入、沒有權限控管。
- **要做**：實作 `/api/v1/auth/login`、`/logout`，JWT 簽發/驗證（`python-jose`、`passlib` 已在 requirements），把 `get_current_user` 換成真的解 token。
- **spec**：§7.1 列了 auth 路由（但無實作細節，需自行設計使用者表）。
- **影響檔**：新增 `api/v1/auth.py`、`models/user.py`、`schemas/auth.py`、改 `api/deps.py`。⚠️ 需要新增 `users` 表（記得先手動建表）。

### A4. 標籤列印 ZPL（未實作）
- **現況**：`api/v1/receiving.py` 的 `/print-label` 回 501。`core/printing/` 整個資料夾不存在。
- **要做**：依 spec §9 建 `core/printing/zpl_templates.py` + `label_printer.py`，產 ZPL 字串並（可選）送到 `ZEBRA_PRINTER_IP`。先做「產生 ZPL / 回傳預覽」即可，實體印表機可後置。
- **spec**：§9 ZPL 模板。
- **影響檔**：新增 `core/printing/*`、改 `api/v1/receiving.py` 的 print-label。

### A5. `/barcodes/learn`（AI 學習）有 bug
- **現況**：`services/barcode_service.py` 的 `learn_pattern()` 用 `scalar_subquery()` 當成數值在 `(max_priority or 0)+1`，邏輯錯；另有自動建 vendor 的 fallback 需檢查。
- **要做**：改成正確取 `max(priority)`（用 `func.max` + `.scalar()`），驗證存規則流程。
- **spec**：§5.3。
- **影響檔**：`services/barcode_service.py`。需 `CLAUDE_API_KEY`。

### A6. 客戶主檔（spec 標為第二階段）
- **現況**：`sales_orders.customer_id` 是裸 int，無 FK、無客戶表。trace 的 customer 只有 id。
- **要做**：建 `customers` 表 + FK + CRUD；trace/裝箱單顯示客戶名稱與 AVL。
- **spec**：明確標「第二階段」。⚠️ 需新增表。

---

## B. 後端已寫但未驗證（要補測試 + 可能有欄位 drift）

> 這些 endpoint 存在、import 得起來，但沒在真 DB 上跑過。建議各補一段進 `test_e2e_flow.py` 後再決定要不要修。

- **庫存調整 / 拆帶**：`core/warehouse/adjustment.py`、`services/inventory_service.py`、`POST /inventory/adjust`、`/inventory/split`。拆帶要正確設 `parent_lot_id` 並寫 SPLIT 交易。
- **揀貨波次**：`GET /picking/wave`（`generate_pick_wave`）。
- **反向追溯**：`GET /trace/backward`（`trace_backward`）。
- **收貨清單 / 詳情**：能跑，但 `po_number` 永遠 null（lot 沒存 PO 關聯；要嘛 join 交易表、要嘛加欄位）。
- **FIFO 單元測試**：`tests/test_fifo_picking.py`（round4 產出）可能仍有欄位 drift，未跑過。

---

## C. 前端 ↔ 後端逐模組對齊（整合債，spec 沒涵蓋）

> 根因：pipeline 各輪 RAG 看不到彼此，前端用的欄位名/狀態值跟後端回傳對不上。
> 典型症狀：模組空白、`Cannot read properties of undefined`、status badge 崩、Network 404/422。
> 已修：庫存模組的「狀態大小寫」崩潰（後端大寫 `AVAILABLE` vs 前端小寫表）+ Vite proxy（`/api`→8000）。

逐模組要走一遍（開 DevTools Network/Console 對齊）：

- **收貨 ReceivingModule** + `api/receiving.ts`：scan/receive/iqc/list 的欄位與後端回傳對齊；狀態值大小寫。
- **庫存 InventoryModule**：✅ 主要已修，但 adjust/split 互動未測。
- **揀貨 PickingModule** + allocate/wave/confirm：response 欄位（`strategy_used`、`allocation_details`、`location` 可為 null）對齊；狀態值。
- **出貨 ShippingModule / 流程**：confirm/packing-list 欄位對齊。
- **追溯 TraceabilityModule**：把內建範例條碼換成真實搜尋；forward/backward response 欄位對齊。
- **Dashboard**：多半接假資料 / 彙總數字，需確認資料來源。

**共通陷阱**：後端所有狀態值都是**大寫**（`AVAILABLE` / `PENDING` / `PICKED` / `QC_HOLD`…），前端對照表多是小寫 → 每個有 status badge 的模組都要正規化 + 加 fallback（照 InventoryModule 的修法）。

---

## D. 整合 / 基礎債

- **import 路徑收斂**（Stage F 會標 warning）：`get_db` 目前被從 5 個路徑 import（`app.db.session` / `app.db` / `app.dependencies` / `app.database` / `app.api.deps`），`settings` 從 2 個。功能無害（都是 re-export shim），但建議統一成單一正源 `app.db.session.get_db`，其餘改成薄 re-export 或直接改 import。
- **錯誤處理 / 輸入驗證**：多數 endpoint 只有 happy-path；缺數量為負、重複收貨、超收等邊界處理。
- **測試覆蓋**：目前只有一支 e2e 主線腳本。spec 附錄 A 有 FIFO/FEFO 單元 + 整合 + 性能測試，待補。

---

## E. 正式上線才需要（spec Phase 2–4 藍圖）

- 並發 / 庫存鎖（避免同批被重複配貨；spec 性能測試提到並發無死鎖）
- ESD 管控區 / MSL 濕敏到期邏輯（schema 有欄位，業務邏輯未落地）
- 隔離區（QUARANTINE）流程
- Redis / Celery 任務佇列（目前未使用）
- Docker 部署實測（compose 已有，前端 build、nginx）
- 稽核日誌 / 報表（追溯報表 UI）

---

## 建議的補齊順序（由近到遠）

1. **A1 上架寫回 location**（小修、立刻讓 location 不再 null）
2. **C 前端逐模組對齊**到能完整點完一輪 → 這就到「可展示」門檻
3. **B 補測試**把已寫的 adjust/split/wave/backward 驗起來
4. **A2 PO 驗證 + A4 標籤** → 往「內部試營運」靠
5. **A3 認證 + A6 客戶主檔 + E 硬化** → 往「正式上線」靠

> 每一項都建議：開一輪 B-Web → 貼 change_request（含 schema.sql 聲明 + spec 章節）→ 跑完用 `test_e2e_flow.py` 實測 → commit。
