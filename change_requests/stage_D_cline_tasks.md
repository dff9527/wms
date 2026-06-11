# Stage D — Cline (qwen3-coder-next) 任務包

> 產生時間:2026-06-11。依據沙盒實測結果(28 項檢查,8 項 FAIL)整理。
> 用法:**一個任務開一個新 Cline session**,整段 prompt 貼上。做完一個 → `git add -A && git commit` → 跑 `python tests/test_e2e_flow.py`(5433)→ 再開下一個。
> 順序:D1 → D2 → D3 → D4 → D5(D5 依賴 D4)。
> 全部完成後交回給 Claude 複檢,再由 Claude 做剩餘設計型工作(AVL 過濾、MSL/expiry_date、配貨回滾、multi-scan、putaway 評分、強制換標)。

---

## D1 — 後端小修包(三個獨立小 bug)

```
你是資深 Python/FastAPI 工程師。修以下三個 bug,除指定檔案外不要動任何其他檔案,不要重構、不要加新功能、不要改格式。DB 欄位一律 snake_case,狀態值一律大寫。

【Bug 1】vendors router 沒掛進 app
檔案:backend/app/main.py
現況:backend/app/api/v1/vendors.py 有 router(prefix="/vendors"),但 main.py 沒 include,前端打 GET /api/v1/vendors 回 404。
修法:在 main.py 加上
    from app.api.v1.vendors import router as vendors_router
    app.include_router(vendors_router, prefix="/api/v1")
放在 barcodes_router 那行附近,寫法比照 barcodes_router。

【Bug 2】learn_pattern 儲存時 crash
檔案:backend/app/services/barcode_service.py,函式 learn_pattern()
現況:max_priority 用了 .scalar_subquery(),它回傳的是 SQL 子查詢物件不是數值,後面 (max_priority or 0) + 1 直接拋
"Boolean value of this clause is not defined"。
修法:把取 max_priority 那段改成真正取值:
    from sqlalchemy import func
    max_priority = (
        db.query(func.max(BarcodePattern.priority))
        .filter(BarcodePattern.vendor_id == vendor.vendor_id)
        .scalar()
    )
    new_priority = (max_priority or 0) + 1
另外:在建立 new_pattern 之前,加上 regex 驗證(這個檔案頂部已 import re):
    try:
        re.compile(inference_result["regex_rule"])
    except re.error as e:
        raise ValueError(f"AI 推斷的 regex 無效: {e}")

【Bug 3】出貨後 lot_status 沒更新
檔案:backend/app/core/warehouse/shipping.py,函式 confirm_shipment()
現況:出貨確認後 lot_status 留在 'AVAILABLE',規格要求轉 'SHIPPED'。
修法:在處理每個 task 的迴圈裡(task.status = 'CONFIRMED' 之後),加:
    if lot.quantity_on_hand == 0:
        lot.lot_status = 'SHIPPED'
注意:只有 quantity_on_hand 歸零才改;部分出貨剩餘庫存的 lot 維持 'AVAILABLE'。

【驗收】
1. python -c "from app.main import app" 不報錯(在 backend/ 下執行)
2. cd backend && python tests/test_e2e_flow.py 全部 PASS
3. 只 diff 到這三個檔案
```

---

## D2 — 揀貨波次回傳 task_id + 前端改用真正的 task_id

```
你是全端工程師。修一個前後端對齊 bug,只改下面兩個檔案,不要重構、不要動其他模組。

【背景】
GET /api/v1/picking/wave 的回傳項目沒有 task_id,前端只好拿 sequence(波次內流水號)當 task_id 打 POST /api/v1/picking/confirm。一旦有多張 SO 同時揀貨,sequence 和真正的 task_id 對不上,會確認到錯誤的任務。

【後端】backend/app/core/warehouse/picking.py,函式 generate_pick_wave()
在 wave.append({...}) 的 dict 裡加一個欄位(放在 "sequence" 後面):
    "task_id": task.task_id,

【前端】frontend/src/app/components/PickingModule.tsx
1. PickWaveTask 介面(或對應 type)加 taskId: number。
2. fetchPickWave 的 response.data.map(...) 裡加 taskId: item.task_id。
3. handleConfirmAllocation 裡 POST /api/v1/picking/confirm 的 body,把 task_id: task.sequence 改成 task_id: task.taskId,並刪掉旁邊那段「use sequence as fallback」的 NOTE 註解。

【注意】
- 後端回傳是 snake_case (task_id),前端 state 用 camelCase (taskId),只在 map 的地方轉。
- 不要動 PickingModule 其他邏輯(配貨、出貨、裝箱單)。

【驗收】
1. cd backend && python tests/test_e2e_flow.py 全部 PASS
2. cd frontend && npx tsc --noEmit 無錯誤
3. 只 diff 到這兩個檔案
```

---

## D3 — confirm_pick 冪等性與數量驗證

```
你是資深 Python 工程師。修一個會造成庫存錯帳的 bug,只改兩個檔案,不要重構。

【背景】
backend/app/core/warehouse/picking.py 的 confirm_pick() 沒有檢查任務狀態:同一個 task_id 重複呼叫會重複扣 quantity_on_hand(實測 2000→1000 被多扣一次)。也沒驗證 picked_qty。

【修改】backend/app/core/warehouse/picking.py,函式 confirm_pick()
在取得 task 並確認存在之後、開始扣帳之前,依序加入三個檢查:

    if task.status != 'PENDING':
        raise ValueError(f"Pick Task {task_id} 狀態為 {task.status},不可重複確認")

    picked = int(picked_qty)
    if picked <= 0:
        raise ValueError("picked_qty 必須為正整數")
    if picked > task.pick_qty:
        raise ValueError(f"實揀數量 {picked} 超過任務數量 {task.pick_qty}")
    if picked > lot.quantity_on_hand:
        raise ValueError(f"實揀數量 {picked} 超過現有庫存 {lot.quantity_on_hand}")

注意:函式裡原本就有一行 picked = int(picked_qty),把它移除(改用上面這段,不要重複定義)。

【修改】backend/app/api/v1/picking.py,函式 confirm_pick()
現況:except ValueError 一律回 404。但「狀態不可重複確認 / 數量錯誤」應該是 400。
修法:區分兩種錯誤——
    except ValueError as e:
        msg = str(e)
        if "not found" in msg:
            raise HTTPException(status_code=404, detail=msg)
        raise HTTPException(status_code=400, detail=msg)
(engine 裡 task 不存在的訊息是 "Pick Task {task_id} not found",維持原文不要改。)

【驗收】
1. cd backend && python tests/test_e2e_flow.py 全部 PASS
2. 手動驗證:對同一 task_id 連打兩次 POST /api/v1/picking/confirm,第二次必須回 400,且 lot 的 quantity_on_hand 只被扣一次
3. 只 diff 到這兩個檔案
```

---

## D4 — 業務路由掛上 JWT 認證 + e2e 測試補登入

```
你是資深 FastAPI 工程師。把已經寫好的 JWT 認證掛到業務路由上,並更新 e2e 測試。只改 backend/app/main.py 和 backend/tests/test_e2e_flow.py 兩個檔案。

【背景】
app/api/deps.py 已有完整的 get_current_user(JWT 驗證),/api/v1/auth/login 也能用,但目前只有 customers router 有掛,其他業務 API 全部裸奔(不帶 token 也回 200)。

【修改 1】backend/app/main.py
為以下 router 加上 router 層級的認證依賴:receiving、inventory、picking、shipping、traceability、barcodes。
方式:在 include_router 時加 dependencies 參數,例如:
    from fastapi import Depends
    from app.api.deps import get_current_user
    app.include_router(receiving_v1.router, prefix="/api/v1/receiving", dependencies=[Depends(get_current_user)])
其餘五個比照。注意:
- auth_router 和 /health、/api/v1/ping 絕對不要掛(登入入口必須維持開放)。
- customers_router 已經在自己檔案裡掛了,不要重複掛。
- vendors_router 也掛上(若 D1 已合併,main.py 裡會有它)。

【修改 2】backend/tests/test_e2e_flow.py
測試現在會因 401 全掛,需要補登入流程:
1. 在 seed_master_data() 裡,idempotent 地建立測試帳號(寫法比照其他 seed):
    from app.models.user import User
    from app.core.security import hash_password
    if not db.query(User).filter(User.username == "e2e-admin").first():
        db.add(User(username="e2e-admin", password_hash=hash_password("e2e-test-pw"), role="admin", is_active=True))
2. 在 main() 開頭(seed 之後、第一個 API 呼叫之前)登入並設定全域 header:
    r = client.post("/api/v1/auth/login", json={"username": "e2e-admin", "password": "e2e-test-pw"})
    assert r.status_code == 200, f"login failed: {r.text}"
    client.headers.update({"Authorization": f"Bearer {r.json()['access_token']}"})
3. 加一個負向檢查(登入步驟前):
    r_noauth = client.get("/api/v1/inventory/lots")
    check("unauthenticated request rejected (401)", r_noauth.status_code == 401, r_noauth.status_code)
   注意這個檢查要在 client.headers.update 之前做。

【驗收】
1. cd backend && python tests/test_e2e_flow.py 全部 PASS(含新的 401 檢查)
2. 不帶 token 打 /api/v1/inventory/lots 回 401;/health 和 /api/v1/auth/login 不需要 token
3. 只 diff 到這兩個檔案
※ 做完這個任務後,前端會因為沒帶 token 而全部 401,這是預期的——下一個任務 D5 會補前端。
```

---

## D5 — 前端登入整合(依賴 D4)

```
你是資深 React/TypeScript 工程師。為前端加上最小可用的 JWT 登入整合。目標檔案:frontend/src/app/App.tsx + 新增 frontend/src/app/api/auth.ts。盡量不動六個 Module 元件。

【背景】
後端業務 API 已全部要求 Authorization: Bearer <token>(POST /api/v1/auth/login 取得,body 為 {"username","password"},回 {"access_token","token_type"})。前端目前完全沒有 auth,所有 axios 呼叫都會 401。Header 上「操作員: 王小明」是寫死的。

【需求】
1. 新增 frontend/src/app/api/auth.ts:
   - login(username, password):POST /api/v1/auth/login,成功後把 token 存 localStorage('wms_token'),並呼叫 axios.defaults.headers.common['Authorization'] = `Bearer ${token}`
   - logout():清 localStorage 與 axios default header
   - initAuth():app 啟動時從 localStorage 還原 token 到 axios default header,回傳是否已登入
   - 設定一個 axios response interceptor:遇到 401 時清除 token 並導回登入畫面(可用簡單的全域 callback 或 window.location.reload)
2. 修改 App.tsx:
   - 啟動時呼叫 initAuth();未登入時 render 一個簡單的登入表單(帳號、密碼、錯誤訊息、登入按鈕,Tailwind 樣式跟現有風格一致即可),登入成功後才 render 現有的整個系統畫面
   - Header 的「操作員: 王小明」改成顯示登入的 username,旁邊加一個登出按鈕呼叫 logout()
【限制】
- 不要引入新的套件(只用現有的 axios / react / lucide-react / tailwind)
- 不要動六個 Module 元件的內部邏輯(interceptor 在 axios 全域層處理)
- 不要做註冊、忘記密碼、角色管理

【驗收】
1. cd frontend && npx tsc --noEmit 無錯誤
2. npm run dev 後:未登入顯示登入頁;登入成功(可用 e2e 帳號或 DB 裡的使用者)後六個模組正常載入,Network 看得到 Authorization header;按登出回到登入頁
```

---

## 完成後回報清單(貼回給 Claude)

- [ ] D1–D5 各自的 commit hash
- [ ] `python tests/test_e2e_flow.py` 最終輸出(PASS/FAIL 各幾項)
- [ ] `npx tsc --noEmit` 結果
- [ ] 有偏離 prompt 的地方(模型自己加的東西)請列出

Claude 複檢後接手的剩餘工作(不要讓 Cline 做):
1. 客戶 AVL / required_vendor / required_date_code 配貨過濾(spec 核心賣點)
2. MSL → expiry_date 計算,讓 FEFO 真正可用
3. allocate 部分配貨回滾 + SO 轉 ALLOCATED + 重複 allocate 防呆
4. ROHM multi_scan_mode 多段條碼解析
5. putaway 評分修正(capacity 單位、ESD/MSL/隔離區)
6. requires_relabeling 強制換標流程
