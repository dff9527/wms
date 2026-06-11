# WMS — 未完成事項清單

> 更新時間:2026-06-11(第二次)。以「現況實測」為基準(沙盒行為驗證 32/32 + 本機 e2e 36/36 全綠)。
> 歷史:2026-06-03 版的 A1–A6、B、C 區已全部完成;Stage D(Cline 任務包,見 `change_requests/stage_D_cline_tasks.md`)、Stage E(設計型六項)、Stage F(硬化+測試)已完成並驗證。

---

## 0. 工作流提醒(沿用)

1. **先 commit**:沒 commit 的東西會被 pipeline 的 `git stash` 洗掉。
2. 每輪後跑 `backend/tests/test_e2e_flow.py`(5433)。**注意:e2e 現在需要 DB 裡有 `users` 表**(`change_requests/stage_A3_A6_tables.sql`),測試會自建 `e2e-admin` 帳號並登入。
3. 真相來源仍是 `change_requests/schema.sql`(DB snake_case;前端 camelCase 只是回傳整形)。

---

## ✅ 已完成且實測通過(不用再做)

**主流程**:收貨(含 PO 驗證/超收擋下)→ 強制換標(print-label 前 IQC PASS 會被 400 擋)→ IQC → 上架寫回 location(PUT_AWAY 交易)→ 庫存查詢/調整/拆帶 → FIFO/FEFO 配貨 → 揀貨確認 → 出貨(lot 歸零轉 SHIPPED)→ 裝箱單 → 正/逆向追溯。

**Stage D(2026-06-11,Cline)**
- D1:vendors router 掛載;learn_pattern scalar bug 修復 + regex 預驗證;出貨歸零轉 SHIPPED
- D2:wave 回傳 task_id,前端揀貨確認改用真正的 task_id
- D3:confirm_pick 冪等(重複確認 400)+ picked_qty 驗證(>任務量/>庫存/≤0 擋下)
- D4:全部業務路由掛 JWT(`/health`、`/auth/login` 開放);e2e 補登入與 401 負向檢查
- D5:前端登入頁 + axios Authorization + 401 interceptor;重新整理後以 `/auth/me` 還原使用者

**Stage E(2026-06-11,Claude)**
- 客戶 AVL 配貨過濾(`customer_avl.approved_vendors` + 行項 `required_vendor_id`/`required_date_code`)
- MSL → `expiry_date`(收貨時計算,J-STD-033 密封 12 個月)→ FEFO 真正可動;過期批次永不配出
- 配貨全有全無:不足整單 rollback、成功轉 ALLOCATED、重複 allocate 400
- ROHM multi_scan_mode 多段條碼解析(換行分隔自動組合)
- putaway 重寫:隔離區排除、IC 強制 ESD 倉、MSL 上限、allowed_item_types、N+1 改彙總查詢
- 修復:`AllocationDetail.vendorLotCode` 允許 None(原本沒原廠批號的批次會 500)

**操作流程變更**:`requires_relabeling=TRUE` 的供應商(seed 中的 TI),收貨後必須先列印標籤才能 IQC PASS。

**Stage F(2026-06-11,Claude)**
- 並發鎖:allocate/_confirm_pick/adjust/split 的 lot 查詢全部加 `with_for_update()`(PG 生效,防超賣/重複扣帳)
- executed_by 串接:receive/IQC/pick/ship/adjust/split 的操作者一律取自 JWT(`get_current_user`),不再信任 request body
- 角色權限:IQC 限 `admin`/`qc`;adjust/split 限 `admin`/`supervisor`;其餘已登入即可(`require_role` 正式啟用)
- 測試補齊:`test_fifo_picking.py` 重寫救活(3 tests);`test_fifo_performance.py` 新增(spec 附錄 A.3,1000 lots 配 5000 件實測 27ms < 1s);前端 vitest 上線(`npm test`,auth.ts 9 tests:login/logout/initAuth/fetchCurrentUser/401 interceptor)

**操作注意**:要執行 IQC 的帳號 role 必須是 `qc` 或 `admin`;調帳/拆帶要 `supervisor` 或 `admin`。

---

## A. 第二階段功能(需要加欄位/表,做之前先手動改 schema)

### A1. MSL 拆封後 floor life 追蹤
- **現況**:expiry_date 以「密封包裝 12 個月」計(`core/warehouse/receiving.py` 的 `MSL_SEALED_SHELF_LIFE_DAYS`)。拆封後的 168h/72h floor life 無法追蹤。
- **要做**:`inventory_lots` 加 `bag_opened_at`;拆封時依 MSL 等級重算 expiry_date;烘烤(bake)流程重置。
- ⚠️ 需新增欄位。

### A2. 儲位容量檢核
- **現況**:putaway 不做容量檢查(舊版把 capacity_kg 跟件數比,單位錯誤,已移除)。
- **要做**:`items` 加單件重量/體積 → putaway 換算後與 capacity_kg/capacity_cbm 比較;或改用 `location_status.current_occupancy_pct`。
- ⚠️ 需新增欄位。

### A3. 換標記錄正式欄位
- **現況**:label_printed_at 暫存在 `inventory_lots.raw_scan_data`(JSONB)。
- **要做**:升級為正式欄位或獨立 label_prints 表(含列印次數、操作者)。

### A4. 換標「重印/作廢」管理、ZPL 實機列印驗證(`ZEBRA_PRINTER_IP` 目前未接實機)。

---

## B. 上線前硬化(spec Phase 2–4)

- ~~並發/庫存鎖~~ ✅ Stage F 完成
- ~~角色權限~~ ✅ Stage F 完成(粒度可再細化,目前三級:admin / qc / supervisor+operator)
- ~~executed_by 串接~~ ✅ Stage F 完成
- **使用者管理 API**:目前建帳號/改密碼要直接操作 DB,缺 CRUD 端點(適合開 Cline 任務)。
- **並發實測**:鎖已加但沒有並發整合測試(多執行緒同時 allocate 驗證無超賣/無死鎖)。
- **Redis / Celery**:requirements 有、完全未使用(標籤列印佇列、AI 學習非同步化是合理用途)。
- **Docker 部署實測**:compose 寫好沒跑過;`VITE_API_URL` 與前端相對路徑的關係要驗(auth.ts 已改走相對路徑,其他模組本來就是)。
- **anthropic SDK 版本**:requirements.txt 鎖 `anthropic==0.7.0`,但 learner.py 用 messages API,需升版(本機 venv 裝的是新版所以能動,requirements 要同步)。
- **稽核報表 / 追溯報表 UI**;trace forward 的 `poNumber`/`shipDate` 仍是空字串(可從 RECEIVE/SHIP 交易補)。

---

## C. 測試債

- ~~test_fifo_picking.py 救活~~ ✅(3 tests,連 5433,自動清理)
- ~~spec 附錄 A 性能測試~~ ✅(`test_fifo_performance.py`)
- ~~前端零自動化測試~~ ✅ vitest 起步(auth.ts 9 tests;`npm test`)
- 前端元件測試還很薄:六個 Module 都沒有 render 測試(需要 @testing-library/react + mock 較多,投報率中等)。
- 並發整合測試(見 B 區)。

---

## 建議順序

1. **B 使用者管理 API**(每次建帳號都要下 Python 太痛)
2. **B Docker 部署實測** → 內部試營運門檻
3. **B 並發整合測試**(鎖的有效性實證)
4. **A 第二階段欄位**(floor life、容量、換標正式欄位)→ 正式上線
5. C 前端元件測試(有餘裕再做)
