# N 系列 — Codex / Cursor 任務分派表(第二輪,L 驗收後遺留項)

> 依據:2026-07-13 L 系列驗收後的缺口盤點(對照 `WMS_Review_Report.md`)。
> 分派原則同前:**Codex = 跨層/schema/演算法/除錯;Cursor = 模式已確立、UI、機械性**。
> 固定驗收(每張票):`npx tsc --noEmit`、`npm run lint` 0 error、`npm test` 全綠;後端 `black .` + 本機 e2e(`python tests/test_e2e_flow.py`,5433);只 diff 指定檔;回報 commit hash。
> ERP 串接不在本表(等正航回覆後另開)。

---

## 票列表

| # | 任務 | Owner | 依賴 |
|---|---|---|---|
| N1 | 退貨 + 補貨 UI | **Cursor** | — |
| N2 | 客戶 AVL 維護 UI | **Cursor** | — |
| N3 | PickingModule 拆分(第二輪) | **Cursor** | N1 後(避免衝突) |
| N4 | 上線硬化(CORS/SECRET/logging/備份) | **Codex** | — |
| N5 | ZPL 實機列印驗證 | **Codex**(需 Jerry 配合) | — |
| N6 | MSL6 簡化 + 品保備注開放 | **Codex** | — |
| N7 | 揀貨路徑優化(spike) | **Codex** | N3 後 |

---

## N1 — 退貨 + 補貨 UI(Cursor)

後端已完成(L3/L4),前端零入口。**不要動後端。**

**退貨**(`POST /api/v1/returns/customer`、`/supplier`,body `{lotId, quantity, reason, reference?}`):
- InventoryModule 批次詳情 dialog 加「客退」「退供應商」按鈕
- 客退:僅 `SHIPPED` 批次顯示(後端會擋非 SHIPPED,400 detail 直接顯示);任何登入角色可用
- 退供:僅 `admin`/`supervisor` 顯示(`getRole()`),數量不可超過可用量(前端先擋,後端也會擋)
- 表單:數量、原因(必填)、參考單號(選填);成功 toast + 重新抓清單

**補貨**(`GET /api/v1/replenishment/tasks`、`POST /generate`、`POST /tasks/{id}/complete`、`PUT /locations/{id}/rule`):
- 新增 `ReplenishmentModule.tsx` + sidebar「補貨管理」(作業分組,icon=`PackagePlus`)
- 任務清單表格(狀態 OPEN/COMPLETED badge)+「產生補貨任務」按鈕(admin/supervisor)+ 每列「完成」按鈕
- 「儲位規則設定」dialog(admin only):選儲位、SKU、min/max;max ≤ min 前端先擋
- 完成失敗(409「inventory changed」)顯示後端 detail 並提示重新產生

**驗收**:固定項 + 手動:退供非 supervisor 帳號看不到按鈕;補貨 complete 後任務轉 COMPLETED 且庫存頁儲位已變。
只 diff:InventoryModule.tsx、ReplenishmentModule.tsx(新)、App.tsx、api/(新增 returns.ts / replenishment.ts)。

---

## N2 — 客戶 AVL 維護 UI(Cursor)

後端 `PATCH /api/v1/customers/{id}`(admin)已存在。**先打一次實際請求確認 `approved_avl` 可透過 PATCH 更新**(CustomerUpdate schema 若沒含此欄位,僅回報、不要自己改後端)。

- CustomerModule 每列加「AVL 設定」(admin only):dialog 顯示該客戶核可供應商清單
- 供應商來源 `GET /api/v1/vendors`(checkbox 多選)→ PATCH `approved_avl`
- 表格加一欄顯示已核可供應商數量(如「3 家」)
- 提示文案:「未設定 AVL = 不過濾,配貨時所有供應商批次皆可用」(這是後端現行邏輯,照實寫)

**驗收**:固定項 + 手動:設定 AVL 後,揀貨配貨只配得到核可供應商的批次(建測試 SO 驗證)。
只 diff:CustomerModule.tsx、api/customers 相關檔。

---

## N3 — PickingModule 拆分第二輪(Cursor)

L7 只抽了 dialogs,主檔仍 1,276 行。目標 ≤ 600 行。

- 依區塊抽子元件到 `components/picking/`:訂單清單表格、配貨結果區、揀貨任務卡、出貨確認區(實際切法以現檔結構為準,先讀再拆)
- **嚴禁改邏輯**:state 全部留在 PickingModule,子元件收 props;不改 handler、不改 API 呼叫、不改樣式
- 型別放 `picking/types.ts`(已存在,擴充)

**驗收**:固定項 + smoke test 全綠 + 手動走一次完整揀貨流程(配貨→確認→出貨)行為不變。只 diff picking/ 目錄 + PickingModule.tsx。

---

## N4 — 上線硬化(Codex)

1. **CORS 可配置**:`allow_origins` 改讀環境變數 `CORS_ORIGINS`(逗號分隔,預設維持 localhost 兩個),compose 加對應變數
2. **SECRET_KEY 強制**:非 DEBUG 模式下若 SECRET_KEY 是預設值 → 啟動即 fail-fast(RuntimeError),錯誤訊息說明如何設定;compose 註解同步更新
3. **結構化 logging**:uvicorn access log 外,業務層加 JSON logger(時間/使用者/動作/lot_id),至少覆蓋:收貨、IQC、出貨、調整、盤點審核、退貨。用 stdlib logging,不引新套件
4. **備份**:`scripts/backup_db.sh`(pg_dump + 保留 14 份輪替)+ `docs/DEPLOYMENT.md` 補備份/還原章節與 cron 範例

**驗收**:固定項 + 手動:預設 SECRET_KEY 且 `DEBUG=false` 時啟動失敗;`CORS_ORIGINS` 設自訂網域後 preflight 通過;backup script 實跑產出 dump。

---

## N5 — ZPL 實機列印驗證(Codex + Jerry)

⚠️ **需要 Jerry 提供**:Zebra 印表機 IP(`ZEBRA_PRINTER_IP`)、標籤紙規格(寬高 mm)。

1. 先讀 `core/printing/label_printer.py` 與 `zpl_templates.py`,加「離線預覽」端點:`GET /api/v1/receiving/labels/{lot_id}/preview` 回傳 ZPL 原文(可貼到 labelary.com 目視驗證,不用實機也能先驗版面)
2. 實機接通後:列印一張實際標籤,校正尺寸/字型/條碼可掃性;修 template 到掃描槍讀得到內部條碼為止
3. 列印失敗(印表機離線)要回 503 + 明確訊息,不可讓收貨流程 500

**驗收**:固定項 + 實機列印的標籤用收貨頁掃描可正確解析;印表機拔線時列印回 503、收貨其他功能不受影響。

---

## N6 — MSL6 簡化 + 品保備注開放(Codex,小票)

決策(Jerry 2026-07-13):客戶的料不做打件,MSL6 不需系統強制烘烤;特殊處理需求改由品保備注管理。

1. `inventory_service.py`:`MSL_FLOOR_LIFE_HOURS` 移除 `6: 24`;MSL6 開袋不自動設 expiry_date,回應加 `"note": "MSL6 請依品保指示處理"`
2. **quality_notes 開放品保**:`PATCH /lots/{lot_id}` 目前 `require_role("admin")` → 拆出獨立端點 `PATCH /lots/{lot_id}/quality-notes`,`require_role("admin", "supervisor", "qc")`,只能改 quality_notes 一個欄位(原 PATCH 維持 admin)
3. 前端:InventoryModule 批次詳情顯示 quality_notes + qc/supervisor/admin 可編輯(小 textarea + 儲存)

**驗收**:固定項 + qc 帳號可改備注、不能改儲位;MSL6 批次開袋後 expiry_date 不變。

---

## N7 — 揀貨路徑優化 spike(Codex,低優先)

先做**排序**不做圖論:配貨產生的 pick tasks 依儲位代碼結構(Zone→Aisle→Rack)排序輸出,讓揀貨員走最少回頭路。

1. wave/任務清單回傳按 location_code 自然排序(注意 `A-10` vs `A-2`,要 natural sort)
2. 揀貨任務卡照此順序渲染,加序號「第 n 站/共 N 站」
3. 真正的路徑演算法(S 形/最短路徑)寫進 spike 報告 `change_requests/N7_picking_route_notes.md`,不實作

**驗收**:固定項 + 建 3 個不同儲位的任務,回傳順序符合 natural sort。

---

## 執行順序

1. 並行:Cursor N1 + N2;Codex N4 + N6
2. N1 合併後 → Cursor N3;Codex N5(等 Jerry 提供印表機資訊,可先做離線預覽部分)
3. 最後 N7
4. 完成回報 commit hash + 測試輸出,交 Claude 複檢

## 共通提醒(貼進每個 prompt)

- 先 commit 再開工;schema 變更一律走 alembic revision(不要直接改 schema.sql)
- DB snake_case、前端 camelCase;API 結尾斜線比照各資源既有慣例
- 權限:前端 `getRole()` 只是 UX,真正的關卡在後端 `require_role(...)`
- 只 diff 票內指定檔;不要順手重構、不要加未要求的功能
