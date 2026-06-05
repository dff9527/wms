# Stage A3 + A6 — 認證/權限 + 客戶主檔

> 餵給 Pipeline **B-Web**。前置見 `REMAINING_WORK.md` §0。建議拆成 A3、A6 兩輪。
> ⚠️ **兩者都需要新增資料表**。B-Web 不產 migration——**先手動跑下面的 CREATE TABLE SQL**，再跑 pipeline。

## A. 現況
- 認證：`api/deps.py` 的 `get_current_user()` 回寫死 stub，無登入/權限。
- 客戶：`sales_orders.customer_id` 是裸 int，無客戶表。

---

## D0. 先手動建表（兩輪各自的前置）

```bash
# A3 users 表
psql postgresql://wms_user:wms_password@localhost:5433/wms_semiconductor <<'SQL'
CREATE TABLE IF NOT EXISTS users (
    user_id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    password_hash VARCHAR(200) NOT NULL,
    full_name VARCHAR(100),
    role VARCHAR(20) DEFAULT 'operator' CHECK (role IN ('admin','operator','viewer')),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW()
);
SQL

# A6 customers 表
psql postgresql://wms_user:wms_password@localhost:5433/wms_semiconductor <<'SQL'
CREATE TABLE IF NOT EXISTS customers (
    customer_id SERIAL PRIMARY KEY,
    customer_code VARCHAR(20) UNIQUE NOT NULL,
    customer_name VARCHAR(100) NOT NULL,
    approved_avl JSONB,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW()
);
SQL
```

---

## B1. change_request — A3 認證（複製貼上）
```
Add JWT auth and replace the get_current_user stub. A `users` table now exists
(user_id, username unique, password_hash, full_name, role in {admin,operator,viewer}, is_active).
DB is the source of truth; all columns snake_case.

New files:
- backend/app/models/user.py — User model mapping the users table.
- backend/app/schemas/auth.py — LoginRequest{username,password}, TokenResponse{access_token,token_type},
  UserOut{user_id,username,full_name,role}.
- backend/app/core/security.py — passlib bcrypt hash/verify; create_access_token(sub, role) and
  decode_access_token using python-jose with settings.SECRET_KEY (HS256, exp ~8h).
- backend/app/api/v1/auth.py — router prefix /api/v1/auth: POST /login (verify password_hash,
  return TokenResponse; 401 on bad creds), POST /logout (stateless: 200), GET /me (current user).

Modify:
- backend/app/api/deps.py — replace get_current_user with a real dependency that reads the
  Authorization: Bearer token, decodes it, loads the User, 401 if invalid/inactive. Keep returning a
  dict {username, role} so existing callers keep working. Add an optional require_role(role) helper.
- backend/app/main.py — register the auth router. Import app.models.user so metadata loads.

Also add models import for User in app/models/__init__.py.

Constraints: do NOT generate a migration (users table created manually). Do NOT touch the frontend.
Seed an admin user idempotently is NOT required here (do it via SQL/test).

[貼上 spec §7.1 的 auth 路由清單]
```

## B2. change_request — A6 客戶主檔（複製貼上）
```
Add a customer master and surface customer names. A `customers` table now exists
(customer_id, customer_code unique, customer_name, approved_avl JSONB, is_active).
sales_orders.customer_id already holds an int referencing customer_id (no FK change needed).

New files:
- backend/app/models/customer.py — Customer model mapping the customers table.
- backend/app/schemas/customer.py — CustomerOut / CustomerCreate.
- backend/app/api/v1/customers.py — router prefix /api/v1/customers: GET / (list), POST / (create),
  GET /{customer_id}.

Modify:
- backend/app/main.py — register customers router; import app.models.customer.
- backend/app/models/__init__.py — import Customer.
- backend/app/core/traceability/tracer.py — in trace_forward, resolve the SO's customer_id to a
  customer_name via the customers table and put it in shipments[].customer (currently the raw id).
- backend/app/api/v1/shipping.py — in /pending, resolve so.customer_id -> customer_name (currently str(id)).

Constraints: do NOT generate a migration (customers table created manually). Do NOT touch the frontend
in this round (frontend customer display can follow in a Stage C pass).

[貼上 spec §1.2 / §6.3 中與客戶 AVL 相關的段落 + §4.1 sales_orders 欄位]
```

## C. 影響
- A3：新增 `models/user.py`、`schemas/auth.py`、`core/security.py`、`api/v1/auth.py`；改 `api/deps.py`、`main.py`、`models/__init__.py`。需 `users` 表。
- A6：新增 `models/customer.py`、`schemas/customer.py`、`api/v1/customers.py`；改 `main.py`、`models/__init__.py`、`tracer.py`、`api/v1/shipping.py`。需 `customers` 表。

## E. 前置 / 驗證
```bash
# 1) 先跑上面 D0 的 CREATE TABLE
cd ~/projects/wms && git add -A && git commit -m "checkpoint before A3/A6" && rm -rf .rag-index
# 2) 跑 pipeline
# 3) 驗證
cd backend && source .venv/bin/activate
#   A3: 用 SQL 種一個 user（bcrypt hash），POST /api/v1/auth/login 取 token，帶 token 打 /me
#   A6: POST /api/v1/customers 建客戶，把 sales_order.customer_id 指過去，trace forward 應顯示 customer_name
python tests/test_e2e_flow.py
```

> 提醒：A3 上線後，其他端點若要強制登入，需要在路由加 `Depends(get_current_user)`；建議先讓 auth 可用、再逐步套用到各端點，避免一次打斷現有流程與 e2e 測試。
