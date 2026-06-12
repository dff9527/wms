# Stage J — 客戶管理 + UI 細節(驗收回饋)

> 產生時間:2026-06-12。前置:**先做完 Stage I 的 I6、I7** 再做這裡。
> 已由 Claude 直接修掉:「+ 新增訂單」按鈕 icon 與文字重複的「+」。

---

## J1 — 客戶管理(SO 表單內快速新增 + 客戶清單頁)

```
你是全端前端工程師。客戶的後端 API 已存在,補 UI。不要動後端。

【後端現況(已可用,先讀 backend/app/api/v1/customers.py 與 schemas/customer.py 確認)】
- GET  /api/v1/customers/        → [{customer_id, customer_code, customer_name, approved_avl, is_active}]
- POST /api/v1/customers/        → body {customer_code, customer_name, approved_avl?, is_active?}
  成功 201;customer_code 重複時的錯誤碼打一次實際請求確認再寫錯誤處理
- 注意路徑結尾的斜線:router 是 prefix /api/v1/customers + route "/",
  一律用 `/api/v1/customers/`(帶斜線)避免 307 redirect 掉 Authorization header

【需求 1】PickingModule 的新增訂單 dialog:
- 客戶下拉旁加一顆小按鈕「新增客戶」→ 展開 inline 兩欄位(客戶代碼、客戶名稱)+ 確認
- POST 成功後:重新抓客戶清單、自動選取剛建立的客戶、收合 inline 表單
- 失敗顯示後端 detail;欄位空白前端先擋

【需求 2】新增 frontend/src/app/components/CustomerModule.tsx + App.tsx 加「客戶管理」分頁:
- 表格:客戶代碼 / 客戶名稱 / 啟用狀態(GET /api/v1/customers/)
- 「新增客戶」dialog:代碼 + 名稱 → POST
- 空清單顯示「尚無客戶資料」
- (AVL 編輯不在此次範圍,表格不用顯示 approved_avl)

【驗收】
1. npx tsc --noEmit 無錯誤;npm test 全綠
2. 手動:客戶管理頁建客戶 → 揀貨頁新增訂單的下拉看得到;
   或直接在 SO dialog 內 inline 新增 → 自動選取
3. 只 diff 到 PickingModule.tsx、CustomerModule.tsx(新)、App.tsx
```

---

## J2 — 按鈕/圖示一致性掃描(小)

```
你是前端工程師。掃 frontend/src/app/components/*.tsx 所有 <button>:
1. 文字開頭是「+ 」且旁邊已有 <Plus> icon 的 → 移除文字裡的「+ 」
   (「+ 新增明細」「+ 新增採購單」這類沒有 icon 的保留)
2. 統一:主要動作按鈕都帶 icon(新增=Plus、列印=Printer、確認=CheckCircle),
   只調 icon,不改任何邏輯、不改顏色與排版
【驗收】npx tsc --noEmit;npm test;只 diff 元件檔的 JSX,不碰 handler
```

---

## 提醒:Stage I 還剩 I6(庫存匯出 CSV + 調整/拆帶 UI)、I7(角色感知 UI + 使用者管理頁 + 改密碼),
做完 I6/I7 再進 J。完成後一樣回報 commit hash + 測試輸出給 Claude 複檢。
