# K 系列 — 各模組「編輯 / 刪除(作廢)」分階段 ticket

> 目標:凡是有「新增」的模組,都要能編輯與刪除。刪除一律走**軟刪除 / 作廢狀態**(不真的 DELETE 資料),且編輯/刪除都要有**真正的權限管控**。
> 主力 agent:**35B**(每張票切小);標註 ⚠️ 的因檔案大/邏輯複雜,建議改用 **coder-next**。

---

## 權限模型(必讀)

**只有後端的 `require_role(...)` 是真正的安全關卡。** 前端的 `getRole()` 只是把按鈕/選單藏起來(UX),擋不住直接打 API,**不可當成權限控管**。因此:

- 每個會改資料的 endpoint(新增/編輯/刪除/作廢)**都必須在後端明確掛角色檢查**,不要寫「比照現有權限」(現有權限不一致、且有路由根本沒保護)。
- 角色基準(本系統):`admin` > `supervisor` > `qc` > `operator`。
  - **刪除 / 作廢** → `require_role("admin")`(僅管理員)
  - **編輯** → `require_role("admin")`(demo 階段先收緊成管理員;日後要放寬再加角色)
- 前端:刪除/編輯按鈕用 `getRole()` 控制顯示(`import { getRole } from '../api/auth'`),純為 UX。

**現有權限現況(掃描結果,K0 要修)**
| 路由 | 現況 |
|---|---|
| users / inventory(adjust,split) | 已用 `require_role` ✅ |
| customers / purchase_orders / picking / receiving | 多半只有 `get_current_user`(登入即可,無角色檢查) |
| **barcodes** | **完全無 auth — 連登入都不用** ⚠️ 必修 |

---

## K0 — 權限基線修補(最先做,純後端)

**後端**
1. `barcodes.py`:router 目前 `APIRouter(prefix="/barcodes")` 沒有任何 auth。為**會改資料的** endpoint 補上權限:
   - `POST /patterns`、`PATCH /patterns/{id}`、(K1 會加的)`DELETE /patterns/{id}` → `Depends(require_role("admin"))`
   - `POST /parse`、`POST /learn`、`GET /patterns` 至少要 `Depends(get_current_user)`(登入)
2. 快速複查其餘路由:凡是 POST/PATCH/DELETE 而目前只有 `get_current_user` 或全開的,確認是否該升級(本系列新加的 endpoint 一律照「權限模型」掛 `require_role`)。

**驗收**:未帶 token 打 `POST /barcodes/patterns` 應回 401/403(修前是 200);`black .`;不動前端。

**Agent:35B**

---

## 共用慣例(每張票都適用)

**刪除 = 軟刪除 / 作廢(不真刪資料)**
- 有 `is_active` 的表(customers、barcode_patterns):刪除 = `is_active = false`。
- 有 `status` 的表(purchase_orders、sales_orders、pick_tasks):刪除 = `status = "CANCELLED"`。
- 有 `lot_status` 的表(inventory_lots):刪除 = `lot_status = "VOID"`。
- 清單預設隱藏已作廢/停用項目;加「顯示已作廢」開關還原檢視(比照 UserAdminModule 的「顯示已停用」)。

**權限**(見上方權限模型)
- 後端:edit/delete 一律 `Depends(require_role("admin"))`。
- 前端:按鈕只在 `getRole() === 'admin'` 顯示。

**API 路徑**:結尾斜線比照各資源既有慣例(如 customers 帶 `/`),避免 307 掉 Authorization。

**UI 一致性**:用既有 `components/ui/` 元件;編輯用 dialog、刪除用確認 dialog(比照 UserAdminModule);icon 編輯=Pencil、刪除=Trash2。

**每張票驗收(固定)**
1. `npx tsc --noEmit` 無錯誤
2. `npm run lint` 無 error
3. `npm test` 全綠
4. 後端:`black .`;手動打新 endpoint,並**驗證權限**(admin token 成功、非 admin / 無 token 被擋)
5. 只 diff 該票指定的檔
6. 回報:commit hash、tsc/test 結果、權限測試結果、有無偏離 prompt

---

## K1 — 條碼規則 編輯 + 刪除(K0 之後做)

**後端** `backend/app/api/v1/barcodes.py`
- 編輯:`PATCH /patterns/{pattern_id}` 已存在 → **補上 `Depends(require_role("admin"))`**,確認可改 pattern_name / regex_rule / field_mapping / priority。
- 新增:`DELETE /patterns/{pattern_id}` → `require_role("admin")` → 設 `is_active = false`,回 200。

**前端** `BarcodeRuleModule.tsx`
- 規則清單每列加「編輯」dialog +「刪除」(admin only 確認框)。
- 預設隱藏 `is_active = false` 的規則 +「顯示已停用」開關。

**Agent:35B**

---

## K2 — 客戶管理 編輯 + 刪除

**後端** `backend/app/api/v1/customers.py`
- 新增:`PATCH /customers/{customer_id}` → `require_role("admin")` → 改 customer_name、approved_avl、is_active。
- 新增:`DELETE /customers/{customer_id}` → `require_role("admin")` → 設 `is_active = false`。

**前端** `CustomerModule.tsx`
- 每列「編輯」dialog +「刪除」(admin only)。預設隱藏停用 +「顯示已停用」開關。

**Agent:35B**

---

## K3 — 採購單 編輯 + 作廢

**後端** `backend/app/api/v1/purchase_orders.py`
- 新增:`PATCH /{po_id}` → `require_role("admin")`(開放備註/供應商等;已收貨明細不開放改)。
- 新增:`POST /{po_id}/cancel` → `require_role("admin")` → `status = "CANCELLED"`。

**前端**(採購單清單目前在 ReceivingModule 的 open-PO 區)
- 每列「編輯 / 作廢」;admin only;預設隱藏 CANCELLED。

**Agent:35B**(後端);前端 ⚠️ 視插入點複雜度,必要時 coder-next

---

## K4 — 銷售訂單 編輯 + 作廢  ⚠️

**後端** `backend/app/api/v1/picking.py`(sales_orders)
- 新增:`PATCH /orders/{so_id}` → `require_role("admin")`(改 customer/備註;已揀/出貨不改數量)。
- 新增:`POST /orders/{so_id}/cancel` → `require_role("admin")` → `status = "CANCELLED"`(已配貨需先釋放配貨,見下方 demo 取捨)。

**前端** `PickingModule.tsx`(**1300+ 行大檔**)— 訂單清單每列「編輯 / 作廢」。

**Agent:⚠️ coder-next**(大檔 + 配貨釋放邏輯)

---

## K5 — 揀貨波次 編輯 + 作廢  ⚠️

**後端** `backend/app/api/v1/picking.py`(pick_tasks)
- 新增:`POST /tasks/{task_id}/cancel` → `require_role("admin")` → `status = "CANCELLED"`(已 PICKED 需庫存回沖,見 demo 取捨)。
- 編輯建議僅限 PENDING 任務。

**前端** `PickingModule.tsx`(大檔)— 任務清單每列操作。

**Agent:⚠️ coder-next**

---

## K6 — 庫存明細 編輯 + 作廢  ⚠️

**後端** `backend/app/api/v1/inventory.py`(inventory_lots)
- 新增:`PATCH /lots/{lot_id}` → `require_role("admin")`(改 location/備註等非數量欄位)。
- 新增:`POST /lots/{lot_id}/void` → `require_role("admin")` → `lot_status = "VOID"`(數量回沖需寫 inventory_transaction,見 demo 取捨)。

**前端** `InventoryModule.tsx` — 批次詳情/清單加「編輯 / 作廢」。

**Agent:⚠️ coder-next**(涉及交易紀錄與追溯)

---

## K7 — 收貨清單 作廢  ⚠️

**後端** `backend/app/api/v1/receiving.py`
- 新增作廢:把對應 inventory_lot 設 `lot_status = "VOID"` + 回沖 → `require_role("admin")`。
- 已 IQC PASS / 已上架是否允許作廢需定義規則。

**前端** `ReceivingModule.tsx` — 收貨清單每列「作廢」(admin only)。

**Agent:⚠️ coder-next**

---

## 建議執行順序

1. **K0**(權限基線,純後端,先修 barcodes 裸奔)→ 35B。
2. **K1、K2**(master data,is_active 軟刪除,低風險)→ 35B。
3. **K3**(採購單,status 作廢,中等)→ 35B。
4. **K4–K7**(交易型,牽涉配貨釋放/庫存回沖/追溯)→ coder-next,逐張小心,每張完成後跑完整驗收 + 人工確認庫存與追溯沒被破壞。

> **demo 取捨(K4–K7)**:若「作廢」要正確回沖庫存,本質是業務邏輯題,不只是加 endpoint。demo 階段若只需「狀態改 CANCELLED/VOID + 清單隱藏」、**不要求庫存連動**,可在各票註明「僅改狀態,不做庫存回沖」以大幅簡化(並清楚這是 demo 簡化、上線前要補回沖)。
