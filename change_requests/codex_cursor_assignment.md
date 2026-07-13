# Codex / Cursor 任務分派表(短期 → 中期 → 後續)

> 依據:`WMS_Review_Report.md` 路線圖。ERP 串接階段**不在本表**(另行處理)。
> 分派原則:**Codex = 跨層/含 schema/演算法/風險高;Cursor = 模式已確立、機械性、UI 微調**。
> 每張票沿用 K 系列固定驗收:`npx tsc --noEmit`、`npm run lint`、`npm test` 全綠;後端 `black .` + e2e(`backend/tests/test_e2e_flow.py`,5433);只 diff 指定檔;回報 commit hash。

---

## 短期(1–2 週)

| # | 任務 | Owner | 範圍與備註 | 依賴 |
|---|---|---|---|---|
| S1 | **Sidebar + react-router 導航重構**:8 個 tabs 改左側 sidebar(用現成 `ui/sidebar.tsx`),分組=作業/查詢/設定;tab state 改 URL 路由(`/receiving`、`/trace?lot=xxx`),重整保留頁面、返回鍵可用 | **Codex** | App.tsx 大改、影響全部模組掛載,風險最高 | — |
| S2 | **Dashboard 點亮 3 個端點**:後端 `GET /api/v1/dashboard/today-receiving`、`/daily-trend`(近 14 天收發量,聚合 `inventory_transactions`)、`/recent-activities`(最近 20 筆交易);前端移除「尚未提供」虛線卡改接真資料 | **Codex** | 跨層 + SQL 聚合;交易表已有資料 | — |
| S3 | **庫存 server-side 分頁+排序**:`GET /inventory/lots` 加 `page/page_size/sort_by/order/search` 參數;前端 InventoryModule 改 server-side(用現成 `ui/pagination.tsx`),搜尋改打後端 | **Codex** | API contract 變更,Dashboard 也吃同端點要一起驗 | — |
| S4 | **K 系列權限票(K2–K6)**:各模組編輯/刪除(軟刪除),完全照 `K_edit_delete_tickets.md` 既定模式(K1 已示範) | **Cursor** | 模式已確立、逐票機械複製;後端 `require_role("admin")` 照抄 K0/K1 寫法 | — |
| S5 | **統一 toast**:所有模組成功/失敗改用 sonner(現只 ReceivingModule 用);破壞性操作一律 confirm dialog | **Cursor** | 純前端、機械替換,不改 handler 邏輯 | — |
| S6 | **Icon 語意修正**:客戶管理 `Package`→`Building2`、使用者管理 `Search`→`Users`;順掃全站 icon 重複 | **Cursor** | 一次 diff 完 | S1 後做(避免衝突) |
| S7 | **登入頁小改**:Caps Lock 提示 + 密碼顯示切換(Eye/EyeOff) | **Cursor** | 純 UI | — |
| S8 | **狀態 badge 中英混排清理**:中文為主、原始碼值放 tooltip | **Cursor** | 純 UI | — |

## 中期(約 1 個月)

| # | 任務 | Owner | 範圍與備註 | 依賴 |
|---|---|---|---|---|
| M1 | **alembic 導入**:以現有 `change_requests/schema.sql` 做 baseline revision,之後所有 schema 變更走 migration | **Codex** | 基礎設施;**M2–M5 都要加欄位,必須先做** | — |
| M2 | **盤點模組**:`cycle_counts`/`cycle_count_lines` 表;流程=建盤點單(選儲位/料號範圍)→ 凍結 → 盲盤輸入 → 差異審核(`require_role("supervisor")`)→ 產生 ADJUST 交易;前端新分頁 | **Codex** | 全新跨層模組 + 併發鎖(`with_for_update`)| M1 |
| M3 | **儲位調撥**:`POST /inventory/lots/{id}/move`,重用 putaway 檢核(ESD/MSL/隔離/allowed_item_types)+ 寫 MOVE 交易;前端庫存 dialog 加「調撥」 | **Codex** | 動到核心庫存邏輯 | M1 |
| M4 | **MSL floor life(A1)**:`inventory_lots.bag_opened_at`;拆封 API 依 MSL 等級重算 expiry_date;bake 流程重置;FEFO/過期邏輯自動生效 | **Codex** | 核心 domain 邏輯,規格見 REMAINING_WORK A1 | M1 |
| M5 | **容量檢核(A2)+ 換標正式欄位(A3/A4)**:items 加單件重量/體積 → putaway 容量比對;label_prints 表(列印次數/操作者/重印/作廢) | **Codex** | schema + 演算法 | M1 |
| M6 | **admin 改自己密碼端點** + **anthropic SDK 版本同步**(requirements 升版對齊 learner.py) | **Cursor** | 兩個小修,一票做完 | — |
| M7 | **trace forward 補 poNumber/shipDate**:從 RECEIVE/SHIP 交易 join 回填(現為空字串) | **Cursor** | 單檔後端修補,邏輯簡單 | — |
| M8 | **Docker 部署實測**:`docker compose up --build` 跑通,修 nginx proxy/`VITE_API_URL` 相關問題 | **Codex** | 除錯性質、問題不可預期 | S1–S3 合併後 |

## 後續(依客戶回饋排序)

| # | 任務 | Owner | 範圍與備註 | 依賴 |
|---|---|---|---|---|
| L1 | **PDA 響應式作業介面**:收貨/揀貨 scan-first 流程(掃描框自動聚焦、Enter 推進、大觸控目標 ≥44px、單手操作) | **Codex** | UX 重設計,非機械調整 | S1 |
| L2 | **掃描聲音/視覺回饋**:成功/失敗不同音效 + 全螢幕色塊閃爍(Web Audio API) | **Cursor** | 獨立小功能,接在解析結果 callback | L1 |
| L3 | **RMA/退貨流程**:客退(入隔離+重 IQC)、退供應商(出庫交易+追溯標記) | **Codex** | 全新跨層模組 | M1 |
| L4 | **補貨(Replenishment)**:揀貨區 min/max 觸發補貨任務 | **Codex** | 演算法 + 新流程 | M3 |
| L5 | **告警後端**:即將到期批次、MSL 超時、低於安全量 → `GET /api/v1/alerts` | **Codex** | 業務規則判斷 | M4 |
| L6 | **告警/報表 UI**:Dashboard 告警卡片 + 報表中心(交易/稽核查詢表格、CSV 匯出,沿用 exportCsv) | **Cursor** | 後端就緒後純表格 UI,模式同現有清單頁 | L5、S3 |
| L7 | **巨型元件拆分**:PickingModule(1337 行)→ 依 dialog/表單拆子元件;再 BarcodeRuleModule(997 行) | **Cursor** | 機械抽取、**嚴禁改邏輯**,驗收=smoke test 全綠 + 行為不變 | S5 後 |

---

## 執行順序建議

1. **並行起跑**:Codex 做 S1;Cursor 做 S4(K 系列)+ S5/S7/S8。
2. S1 合併後 → Cursor 補 S6;Codex 續 S2、S3。
3. 中期由 **M1(alembic)開頭**,M2–M5 才能安全加欄位;Cursor 並行 M6/M7。
4. 每票完成回報 commit hash + 測試輸出,由 Claude 複檢(沿用現有工作流)。

## 給兩邊 agent 的共通提醒(貼進每個 prompt)

- 先 commit 再開工(pipeline 會 `git stash`);真相來源是 `change_requests/schema.sql`(M1 後改為 alembic)。
- DB snake_case、前端 camelCase(回傳整形)。
- API 結尾斜線比照既有慣例,避免 307 掉 Authorization。
- 前端 `getRole()` 只是 UX,**真正的權限一律在後端 `require_role(...)`**。
- 只 diff 票內指定檔;不要順手重構。
