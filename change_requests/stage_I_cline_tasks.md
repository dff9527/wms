# Stage I — 操作流程補完(UX 巡檢結果)

> 產生時間:2026-06-11。由 Claude 以操作員動線走查六個模組後整理。
> 用法:一個任務開一個新 Cline session,做完 commit → `python tests/test_e2e_flow.py` + `npm test` + `npx tsc --noEmit`。
> 順序:I1(斷流程,最急)→ I2 → I3 → I4 → I5 → I6 → I7。完成後交回 Claude 複檢。

## 巡檢結論(為什麼有這些任務)

操作員視角走一遍「收貨→上架→接單→配貨→揀貨→出貨」,目前的斷點:

| # | 問題 | 嚴重度 |
|---|------|--------|
| 1 | 收貨頁「列印標籤」按鈕**沒接 API**。強制換標供應商(TI)未列印前 IQC 會被 400 擋,流程死路 | 🔴 斷流程 |
| 2 | **沒有採購單管理**。收貨必須對 PO,但 UI 無法建 PO → 新料要收貨只能下 SQL | 🔴 斷流程 |
| 3 | **銷售訂單無法新增**。揀貨頁只能看,不能建單 → 出貨流程無法從 UI 發起 | 🔴 斷流程 |
| 4 | 「開始揀貨」是死按鈕;現況點訂單卡=直接配貨,「確認配貨」一鍵把 確認揀貨+出貨 全做完,操作員沒有逐批掃描確認的步驟,誤觸就直接出貨 | 🟠 危險動線 |
| 5 | 「列印揀貨單」死按鈕;裝箱單/出貨單也無法列印 | 🟠 缺功能 |
| 6 | 庫存無匯出;調整/拆帶 API 存在但 **UI 完全沒有入口** | 🟠 缺功能 |
| 7 | 角色沒反映在 UI:operator 看得到 IQC/調帳按鈕,按了才吃 403;使用者管理 API(G1)沒有畫面;改密碼(H1)沒有畫面 | 🟡 體驗 |

---

## I1 — 收貨「列印標籤」接上 API(斷流程修復)

```
你是資深 React/TypeScript 工程師。修復收貨流程的死按鈕。只改 ReceivingModule.tsx 與
hooks/useReceivingQueries.ts(若需要加 hook),不要動後端。

【背景】
- 後端 POST /api/v1/receiving/print-label {lot_id} 已可用,回 {success, zpl, printed}。
  呼叫它會在後端記錄「已換標」;強制換標供應商的批次「未列印前 IQC PASS 會回 400」。
- frontend/src/app/api/receiving.ts 已有 printLabel(lotId) 函式。
- ReceivingModule.tsx 裡「列印標籤」<button>(Printer icon 那顆)沒有 onClick。
- 流程位置:確認收貨成功後會顯示「已接收批次 #id」,旁邊有 列印標籤 + IQC 表單。

【需求】
1. 「列印標籤」按鈕接 printLabel(receivedLotId):
   - 呼叫中顯示 loading(沿用模組現有的 Loader2 樣式)
   - 成功後:顯示綠色提示「標籤已產生」+ 一個可展開的 ZPL 內容區塊(<pre> 等寬字型,
     高度限制 max-h-40 overflow-auto),並在旁邊提供「瀏覽器列印」按鈕:開新視窗
     window.open 後 document.write 一個簡單頁面(批次號、內部條碼、數量、ZPL 原文)
     再呼叫 print()。response.printed 為 true 時額外顯示「已送出至標籤機」。
   - 失敗顯示紅色錯誤訊息。
2. 加一個 state 記錄此批次「已列印」;未列印前,IQC 的「完成 IQC」按鈕 disabled,
   並在按鈕下方顯示說明文字:「此供應商要求換標,請先列印內部標籤」。
   (簡化:不分供應商,一律要求先列印再 IQC——這與後端 TI 的行為一致,且對不需換標
   的供應商也無害。)
3. IQC 完成後沿用現有 reset 邏輯,「已列印」state 一併重置。

【驗收】
1. npx tsc --noEmit 無錯誤;npm test 全綠
2. 手動:收貨 → IQC 按鈕為 disabled → 列印標籤 → IQC 變可按 → PASS 成功(不再 400)
3. 只 diff 到指定檔案
```

---

## I2 — 採購單管理(backend + 收貨頁子區)

```
你是全端工程師。補上採購單(PO)的建立與查詢,讓收貨流程可以從 UI 從零開始。
DB 欄位 snake_case;狀態大寫;參考 change_requests/schema.sql 的 purchase_orders / po_lines。

【後端】新增 backend/app/api/v1/purchase_orders.py
    router = APIRouter(prefix="/api/v1/purchase-orders", tags=["purchase-orders"])
    (在 main.py 掛上,dependencies=[Depends(get_current_user)],寫法比照其他 router)

    GET ""        → 最近 100 筆 PO,每筆:{poNumber, vendorId, vendorName, poDate,
                    status, lines: [{lineNumber, internalSku, vendorPn, orderedQty, receivedQty}]}
                    (vendorName 用 join 或批次查 vendors;參考 picking.py 的 list_orders 寫法)
    POST ""       → 建立 PO:
                    body: {"poNumber": str, "vendorId": int,
                           "lines": [{"internalSku": str, "vendorPn": str, "orderedQty": int}]}
                    驗證:poNumber 不重複(409)、vendorId 存在(400)、lines 非空、
                    orderedQty > 0、internalSku 存在於 items(400,訊息含是哪個 SKU)。
                    po_date 用今天,status='OPEN',line_number 從 1 編。回 201 + 同 GET 單筆格式。

    另外在同檔案加一個輕量端點(SO/PO 表單的料號下拉要用):
    GET /api/v1/items → [{internalSku, description}](獨立 router 或掛在此檔皆可,
    路徑必須正好是 /api/v1/items,limit 500)

【前端】frontend/src/app/components/ReceivingModule.tsx
    收貨清單標題列右側加「+ 新增採購單」按鈕 → 開 dialog(樣式比照庫存的批次詳情 dialog):
    - 採購單號(文字輸入)
    - 供應商(下拉,GET /api/v1/vendors)
    - 明細列(可動態加減列):料號(下拉,GET /api/v1/items,顯示 sku + description)、
      供應商料號(文字)、數量(數字)
    - 送出 → POST /api/v1/purchase-orders;成功關 dialog 顯示成功提示;409/400 顯示後端 detail
    手動輸入區的「採購單號」欄位改成下拉:GET /api/v1/purchase-orders 過濾 status in
    (OPEN, PARTIAL) 的單號(保留可手動輸入的彈性:用 <input list> + <datalist>)。

【測試】backend/tests/test_e2e_flow.py:把 seed_master_data() 裡直接 db.add(PurchaseOrder...)
    的段落「保留」,另在 main() 加一段:用 API 建一張 PO(獨特單號 PO-E2E-API-{ts})→ 200/201;
    重複建同號 → 409;用它收一筆貨 → 200。

【驗收】
1. python tests/test_e2e_flow.py 全 PASS;npx tsc --noEmit 無錯誤
2. UI 能完整走:建 PO → 用該 PO 收貨
```

---

## I3 — 銷售訂單建立(backend + 揀貨頁 dialog)

```
你是全端工程師。讓揀貨頁可以建立銷售訂單。參考 schema.sql 的 sales_orders / so_lines。

【後端】backend/app/api/v1/picking.py 加:
    POST /api/v1/picking/orders
    body: {"soNumber": str, "customerId": int | null,
           "strategy": "FIFO" | "FEFO",
           "lines": [{"internalSku": str, "orderedQty": int}]}
    驗證:soNumber 不重複(409)、strategy 在白名單(400)、lines 非空、orderedQty > 0、
    internalSku 存在(400)。customerId 有給時必須存在於 customers(400)。
    order_date 今天、status='OPEN'、lot_selection_rule=strategy。
    回 201 + 與 GET /picking/orders 單筆相同的格式(soNumber/customer/orderDate/status/
    totalLines/totalQty/strategy)。

【前端】frontend/src/app/components/PickingModule.tsx
    「銷售訂單」標題列右側加「+ 新增訂單」→ dialog:
    - 訂單編號(文字)
    - 客戶(下拉,GET /api/v1/customers/,可留空;customers 回傳是 CustomerOut snake_case,
      打開 backend/app/schemas/customer.py 確認欄位名再寫)
    - 配貨策略(FIFO / FEFO 下拉,預設 FIFO)
    - 明細列(動態加減):料號(下拉 GET /api/v1/items)、數量
    - 送出成功 → 關 dialog + fetchSalesOrders() 刷新卡片;失敗顯示後端 detail
    注意:卡片目前「點卡片=執行配貨」,新增 dialog 不要破壞這個行為。

【測試】test_e2e_flow.py 的 main() 加:API 建 SO(SO-E2E-API-{ts},訂購量小於現有庫存)
    → 201;allocate 它 → 200。

【驗收】同 I2 標準。
```

---

## I4 — 揀貨動線重做:開始揀貨 → 逐任務確認 → 出貨

```
你是資深前端工程師。重整 PickingModule 的揀貨動線,消除「一鍵配貨+揀貨+出貨」的危險設計。
只改 PickingModule.tsx(後端 API 都已存在,不要動後端)。

【現況問題】
- 「開始揀貨」按鈕沒有任何功能
- 「確認配貨」(handleConfirmAllocation)把所有 PENDING 任務逐一 confirm 後立刻
  confirm_shipment——操作員沒有逐批核對的機會

【目標動線】
  選訂單卡 → 配貨(現有 handleAllocate,不動)→ 波次表出現任務
  → 按「開始揀貨」進入揀貨模式
  → 揀貨模式下,每列 PENDING 任務出現:實揀數量輸入框(預設=pickQty)+「確認」按鈕,
    按下打 POST /api/v1/picking/confirm {task_id, picked_qty, picker 可省略傳空字串}
    (後端 picker 取自 JWT,body 值會被忽略)
    成功該列變 PICKED 樣式;400 時把後端 detail 顯示在該列下方
  → 當波次中不再有 PENDING 任務時,顯示「確認出貨」按鈕(綠色、明顯),
    按下才呼叫現有 handleConfirmShipment → 成功後顯示裝箱清單(現有邏輯)
  → 「離開揀貨模式」按鈕隨時可退出(不影響已確認的任務)

【實作要求】
- 移除 handleConfirmAllocation 的「自動 confirm 全部 + 自動出貨」邏輯;
  「確認配貨」按鈕改名為「重新整理波次」或直接移除(配貨成功本來就會刷新波次)
- 揀貨模式用一個 boolean state;不要引入新套件
- 每列的確認要 disabled 處理重複點擊

【驗收】
1. npx tsc --noEmit;npm test 全綠
2. 手動:配貨 → 開始揀貨 → 逐列確認(改一列數量為部分數量試 400 路徑)→ 全部完成
   → 確認出貨 → 裝箱清單出現
```

---

## I5 — 列印:揀貨單 / 裝箱單(瀏覽器列印)

```
你是前端工程師。把兩個列印功能做成「開新視窗 + window.print()」的可列印 HTML。
只改 PickingModule.tsx,可新增一個共用的 utils/printWindow.ts。

1. 新增 frontend/src/app/utils/printWindow.ts:
   export function printHtml(title: string, bodyHtml: string): void
   - window.open('', '_blank') → document.write 完整 HTML(內嵌簡單列印樣式:
     黑白、表格框線、12px 字、@media print 隱藏按鈕)→ focus + print()
2. 「列印揀貨單」接上:把目前 pickWave 渲染成表格(序號/儲位/料號/內部批號/內部條碼/
   供應商批號/揀貨量/狀態),標題含日期時間。沒有任務時按鈕 disabled。
3. 裝箱清單區塊加「列印裝箱單」按鈕:渲染 packingList(訂單號/SKU 分組/各 lot 的
   內部批號/數量/收貨日期),標題「裝箱單 Packing List」+ 訂單號 + 日期。

【驗收】npx tsc --noEmit;手動:兩顆按鈕各開出可列印視窗,內容正確。
```

---

## I6 — 庫存匯出 CSV + 調整/拆帶 UI

```
你是前端工程師。只改 InventoryModule.tsx,可新增 utils/exportCsv.ts。後端 API 已存在,不要動後端。

1. 新增 frontend/src/app/utils/exportCsv.ts:
   export function exportCsv(filename: string, headers: string[], rows: (string|number)[][]): void
   - 產 CSV 字串(值含逗號/引號要跳脫,前置 ﻿ BOM 讓 Excel 正確顯示中文)
   - Blob + URL.createObjectURL + <a download> 觸發下載
2. 庫存搜尋列旁加「匯出 CSV」按鈕:把目前篩選後顯示中的資料匯出
   (欄位:料號/內部批號/內部條碼/供應商批號/儲位/可用量/預留量/收貨日期/MSL/狀態,
   檔名 inventory_YYYYMMDD.csv)。無資料時 disabled。
3. 批次詳情 dialog 底部加兩個操作(後端限 supervisor/admin,403 時顯示「權限不足」):
   - 「數量調整」:展開小表單(調整量:可正負整數、原因:文字)→
     POST /api/v1/inventory/adjust {lotId, quantityChange, reason}
     (api/inventory.ts 已有 adjustLot 函式與 useAdjustLotMutation hook,直接用 hook)
   - 「拆帶」:展開小表單(拆出數量:正整數)→ splitLot,用 useSplitLotMutation
   成功後關表單;React Query 的 invalidate 已寫好會自動刷新清單;400/403 顯示後端 detail。

【驗收】npx tsc --noEmit;npm test;手動:匯出開啟正常、調整/拆帶各走一次成功與 400 路徑。
```

---

## I7 — 角色感知 UI + 使用者管理頁 + 改密碼

```
你是資深前端工程師。把角色反映到 UI,並補 G1/H1 後端 API 的畫面。

【前置知識】
- 登入後 GET /api/v1/auth/me 回 {user_id, username, full_name, role}
- auth.ts 的 fetchCurrentUser/getCurrentUser 已存好 currentUser(含 role);
  login() 成功後目前沒存 role——順手改成 login 成功後呼叫一次 fetchCurrentUser()
- 角色:admin / qc / supervisor / operator
- 後端權限:IQC 限 admin,qc;adjust/split 限 admin,supervisor;/api/v1/users 限 admin

【需求 1】角色感知(以 getCurrentUser()?.role 判斷):
- ReceivingModule:role 不在 (admin,qc) → IQC 表單區塊整個換成提示
  「IQC 檢驗需要品管(qc)或管理員權限」
- InventoryModule:role 不在 (admin,supervisor) → 詳情 dialog 不顯示調整/拆帶按鈕
- App.tsx header:操作員名字旁顯示角色中文(admin=管理員 qc=品管 supervisor=主管
  operator=作業員)

【需求 2】使用者管理(僅 admin 看得到):
- App.tsx 的 Tabs 加「使用者管理」分頁(role==='admin' 才渲染 trigger 與 content)
- 新增 components/UserAdminModule.tsx:
  - 表格:GET /api/v1/users(帳號/姓名/角色/啟用狀態)
  - 「新增使用者」dialog:帳號/密碼(min 8)/角色下拉/姓名 → POST /api/v1/users,
    409、400 顯示後端 detail
  - 每列操作:啟用/停用 toggle(PATCH is_active)、改角色(下拉直接 PATCH)、
    「重設密碼」dialog(POST /api/v1/users/{id}/password)
  - 對自己那列:停用與改角色的控制項 disabled(後端也會擋)

【需求 3】改自己的密碼:
- header 登出鈕旁加「改密碼」→ dialog(舊密碼/新密碼 min 8/確認新密碼,兩次不一致
  前端先擋)→ POST /api/v1/auth/me/password;400 顯示「舊密碼不正確」
  (此端點是 Stage H1 做的;若還沒做 H1,先做 H1)

【驗收】
1. npx tsc --noEmit;npm test 全綠
2. 手動:operator 帳號登入看不到使用者管理分頁、IQC 區顯示權限提示;
   admin 能新增使用者、重設密碼;自己改密碼成功後重登有效
```

---

## 完成後回報清單(貼回給 Claude)

- [ ] I1–I7 commit hash(一任務一 commit)
- [ ] `python tests/test_e2e_flow.py` 輸出
- [ ] `npm test`、`npx tsc --noEmit` 結果
- [ ] 有偏離 prompt 的地方請列出
- [ ] 哪些 UI 細節覺得不順手,回報給 Claude 做第二輪 UX 調整
