# Stage G — Cline (qwen3-coder-next) 任務包

> 產生時間:2026-06-11。前置:Stage D/E/F 已完成(e2e 36/36 全綠)。
> 用法:**一個任務開一個新 Cline session**,整段 prompt 貼上。做完一個 → commit → 跑
> `python tests/test_e2e_flow.py`(5433)→ 再開下一個。順序 G1 → G2 → G3。
> 全部完成後交回給 Claude 複檢。

---

## G1 — 使用者管理 API(全部限 admin)

```
你是資深 FastAPI 工程師。為 WMS 加上使用者管理 API。只新增/修改下列檔案,不要重構其他程式。
DB 欄位 snake_case;角色固定四種:'admin'、'qc'、'supervisor'、'operator'。

【背景】
- users 表已存在(欄位:user_id, username, password_hash, full_name, role, is_active,參考 backend/app/models/user.py)
- JWT 認證已可用:app/api/deps.py 有 get_current_user 和 require_role(*roles)
- 密碼雜湊:app/core/security.py 的 hash_password()
- 現在建帳號要手動下 Python,目標是給 admin 一組 CRUD 端點

【新增 1】backend/app/schemas/user.py
    from pydantic import BaseModel, Field
    ALLOWED_ROLES = {"admin", "qc", "supervisor", "operator"}

    class UserCreate(BaseModel):
        username: str = Field(min_length=3, max_length=50)
        password: str = Field(min_length=8)
        role: str
        full_name: str | None = None

    class UserUpdate(BaseModel):       # 部分更新
        role: str | None = None
        full_name: str | None = None
        is_active: bool | None = None

    class PasswordReset(BaseModel):
        new_password: str = Field(min_length=8)

    class UserResponse(BaseModel):     # 絕對不可包含 password_hash
        user_id: int
        username: str
        full_name: str | None = None
        role: str
        is_active: bool
        model_config = {"from_attributes": True}

【新增 2】backend/app/api/v1/users.py
    router = APIRouter(prefix="/api/v1/users", tags=["users"],
                       dependencies=[Depends(require_role("admin"))])

    GET    ""                    → 全部使用者,List[UserResponse]
    POST   ""                    → 建帳號:role 必須在 ALLOWED_ROLES 否則 400;
                                   username 重複回 409;密碼用 hash_password();回 201 + UserResponse
    PATCH  "/{user_id}"          → 更新 role/full_name/is_active;role 同樣驗證;
                                   不存在回 404;回 UserResponse
    POST   "/{user_id}/password" → 重設密碼(hash 後存);不存在回 404;回 {"success": true}

    防呆:PATCH 把自己(current_user)的 is_active 設 False 或改掉自己的 admin role 時回 400
    「不可停用/降權自己」。需要在 router 層之外另取 current_user:
        current_user: dict = Depends(require_role("admin"))  放在這兩個 endpoint 的參數即可。

【修改 3】backend/app/main.py
    from app.api.v1.users import router as users_router
    app.include_router(users_router)
    (router 自帶 prefix 與 admin 限制,不要再包 dependencies)

【修改 4】backend/tests/test_e2e_flow.py — 在 main() 的最後面追加一段(沿用 check() 寫法):
    1. POST /api/v1/users 建 {"username":"e2e-op","password":"e2e-op-pw1","role":"operator"} → 201(若 409 表示前次殘留,先 PATCH is_active=true 視為通過)
    2. GET /api/v1/users → 200 且清單含 e2e-op
    3. 用 e2e-op 登入 → 200;用它的 token 打 POST /api/v1/inventory/adjust → 403(operator 無權)
    4. 用 e2e-op 的 token 打 GET /api/v1/users → 403(非 admin)
    5. admin 對 e2e-op POST /password 改成 "e2e-op-pw2" → 用新密碼登入 200、舊密碼 401

【驗收】
1. cd backend && python tests/test_e2e_flow.py 全部 PASS(含新段落)
2. 回應 JSON 任何地方都不可出現 password_hash
3. 只 diff 到上述四個檔案
```

---

## G2 — 衛生包(依賴版本 + utcnow 棄用)

```
你是資深 Python 工程師。做兩件純機械性的清理,不要動任何業務邏輯。

【任務 1】backend/requirements.txt
- `anthropic==0.7.0` 改成 `anthropic>=0.40,<1.0`
  (learner.py 用的是 client.messages.create,0.7.0 根本沒有這個 API)
- `passlib[bcrypt]==1.7.4` 那行下面加一行 `bcrypt==4.0.1`
  (bcrypt 4.1+ 移除 __about__,passlib 1.7.4 會噴 "error reading bcrypt version" 警告)

【任務 2】消除 datetime.utcnow() 棄用警告(Python 3.12)
1. 新增 backend/app/utils/time.py:
       from datetime import datetime, timezone

       def utcnow() -> datetime:
           """Naive UTC now — datetime.utcnow() 的無警告替代,語意完全相同。
           DB 欄位是 TIMESTAMP WITHOUT TIME ZONE,必須維持 naive。"""
           return datetime.now(timezone.utc).replace(tzinfo=None)
   (若 backend/app/utils/ 不存在就建立,含空的 __init__.py;若已存在不要動其他檔案)
2. 用 grep 找出 backend/app 與 backend/tests 下所有 `datetime.utcnow()` 呼叫,
   逐檔把呼叫處改成 `utcnow()` 並加 import:`from app.utils.time import utcnow`。
   ⚠️ 只改「呼叫處」,不要改字串、註解;不要把 datetime import 拿掉(其他地方還在用)。

【驗收】
1. grep -rn "datetime.utcnow()" backend/app backend/tests → 0 筆
2. cd backend && python -c "from app.main import app" 成功
3. python tests/test_e2e_flow.py 全部 PASS 且不再出現 utcnow DeprecationWarning
4. pip install -r requirements.txt 在 .venv 裡裝得起來(任務 1 的版本)
```

---

## G3 — 前端六個 Module 的 render smoke 測試

```
你是資深 React/TypeScript 測試工程師。為六個業務模組補 render smoke 測試。
現況:vitest + happy-dom 已裝好(vitest.config.ts 存在,npm test 可跑,
src/app/api/auth.test.ts 是現成範例)。

【步驟 1】安裝(寫進 devDependencies):
    npm install -D @testing-library/react @testing-library/jest-dom

【步驟 2】新增 src/app/components/__tests__/modules.smoke.test.tsx
要求:
- vi.mock('axios') :get/post 一律回 resolved 空資料
  (get → { data: [] };針對 /receiving/list 回 { data: { items: [], total: 0 } })
- DashboardModule 與 Receiving 相關 hook 用了 @tanstack/react-query:
  測試要包 QueryClientProvider(new QueryClient({ defaultOptions: { queries: { retry: false } } }))
- 對每個模組各寫一個 it:render 不拋例外,且畫面上找得到該模組的標題文字:
    DashboardModule      → 任一統計卡標題(如「總庫存量」)
    ReceivingModule      → 「條碼掃描與解析」
    InventoryModule      → 模組主標題(打開檔案確認實際文字)
    PickingModule        → 模組主標題(同上)
    TraceabilityModule   → 模組主標題(同上)
    BarcodeRuleModule    → 模組主標題(同上)
- 斷言用 await screen.findByText(...)(資料載入是 async)
- 如果某個模組 mock 成本過高(例如依賴瀏覽器 API),可以 it.skip 並寫一行註解說明原因,
  但最多只允許 skip 一個。

【限制】
- 不要改六個 Module 本身的程式碼;測試遷就元件,不是反過來
- 不要裝 jsdom(已用 happy-dom)

【驗收】
1. cd frontend && npm test → auth 的 9 個 + 新增至少 5 個全部綠
2. npx tsc --noEmit 無錯誤
3. 只新增測試檔與 package.json/package-lock.json 的 devDependencies
```

---

## 完成後回報清單(貼回給 Claude)

- [ ] G1–G3 commit hash
- [ ] `python tests/test_e2e_flow.py` 輸出(PASS/FAIL 數)
- [ ] `npm test` 輸出
- [ ] 有偏離 prompt 的地方請列出
