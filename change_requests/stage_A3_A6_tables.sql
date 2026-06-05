-- Stage A3 + A6 新增資料表（B-Web 不產 migration，手動先建）
-- 用法：psql <DATABASE_URL> -f change_requests/stage_A3_A6_tables.sql

-- A3 認證：使用者表
CREATE TABLE IF NOT EXISTS users (
    user_id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    password_hash VARCHAR(200) NOT NULL,
    full_name VARCHAR(100),
    role VARCHAR(20) DEFAULT 'operator' CHECK (role IN ('admin', 'operator', 'viewer')),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW()
);

-- A6 客戶主檔
CREATE TABLE IF NOT EXISTS customers (
    customer_id SERIAL PRIMARY KEY,
    customer_code VARCHAR(20) UNIQUE NOT NULL,
    customer_name VARCHAR(100) NOT NULL,
    approved_avl JSONB,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW()
);

-- 驗證：應列出 users 與 customers
-- \dt users customers
