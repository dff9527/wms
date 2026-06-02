# 半導體零件供應商 WMS 系統開發規格書

## 文件版本
- **版本**: v1.0
- **日期**: 2026-06-02

---

## 目錄
1. [系統概述](#1-系統概述)
2. [技術棧](#2-技術棧)
3. [專案結構](#3-專案結構)
4. [資料庫設計](#4-資料庫設計)
5. [條碼解析系統](#5-條碼解析系統)
6. [核心業務流程](#6-核心業務流程)
7. [API 設計](#7-api-設計)
8. [前端 UI 設計](#8-前端-ui-設計)
9. [標籤列印系統](#9-標籤列印系統)
10. [部署配置](#10-部署配置)

---

## 1. 系統概述

### 1.1 專案背景
開發一套專為半導體零件供應商設計的倉儲管理系統(WMS),核心特點:
- **一物多碼管理**: 同一料號可能有多個供應商,每個供應商條碼格式不同
- **條碼轉譯引擎**: 自動解析供應商原廠條碼,轉換為內部統一格式
- **全鏈追溯**: 從供應商批號到客戶出貨的完整追溯能力
- **智能學習**: 使用 Claude API 自動學習新供應商的條碼格式

### 1.2 核心功能模組
```
WMS 系統
├── 收貨管理 (Receiving)
│   ├── 條碼掃描與解析
│   ├── IQC 檢驗
│   ├── 換標作業
│   └── 上架建議
│
├── 庫存管理 (Inventory)
│   ├── 批次(Lot)級別管理
│   ├── 儲位管理
│   ├── 庫存調整
│   └── 盤點功能
│
├── 揀貨出庫 (Picking)
│   ├── 訂單配貨
│   ├── FIFO/FEFO 策略
│   ├── 揀貨路徑優化
│   └── 出貨確認
│
├── 追溯管理 (Traceability)
│   ├── 正向追溯 (供應商 → 客戶)
│   ├── 逆向追溯 (內部碼 → 原廠碼)
│   ├── 拆帶追溯
│   └── 追溯報表
│
└── 條碼管理 (Barcode)
    ├── 供應商規則庫
    ├── 條碼解析引擎
    ├── AI 學習新格式
    └── 標籤列印
```

### 1.3 系統特色

#### 與一般 WMS 的差異對比

| 功能模組 | 一般 WMS | 半導體業 WMS | 本系統 |
|---------|---------|-------------|--------|
| 庫存管理 | SKU 級別 | Lot/Wafer 級別 | **料號 + Lot + 原廠碼三維追溯** |
| 條碼系統 | 單一標準 | 一物多碼 | **條碼轉譯引擎(核心!)** |
| 入庫流程 | 收貨上架 | IQC + 換標 | **強制換標 + ESD 區域管控** |
| 出庫流程 | 揀貨包裝 | FIFO/FEFO | **依客戶 AVL 自動過濾可用批次** |
| 品質追溯 | 批次查詢 | RoHS/MSL/CoC 文件鏈 | **供應商批號 ↔ 出貨批號雙向追溯** |

---

## 2. 技術棧

### 2.1 後端技術

```python
# requirements.txt

# Web 框架
fastapi==0.104.1
uvicorn[standard]==0.24.0
pydantic==2.5.0
python-multipart==0.0.6

# 資料庫
sqlalchemy==2.0.23
alembic==1.12.1
psycopg2-binary==2.9.9

# 條碼處理
python-barcode==0.15.1
pillow==10.1.0
pyzbar==0.1.9              # 需安裝系統套件: apt-get install libzbar0

# 標籤列印
zebra==0.1.4               # Zebra 印表機控制

# 認證與安全
python-jose[cryptography]==3.3.0
passlib[bcrypt]==1.7.4
python-dotenv==1.0.0

# 快取與任務佇列
redis==5.0.1
celery==5.3.4

# AI 功能 (條碼學習)
anthropic==0.7.0

# 工具
python-dateutil==2.8.2
```

**Python 版本**: 3.11+

### 2.2 前端技術

```json
{
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "react-router-dom": "^6.20.0",
    
    "tailwindcss": "^3.3.5",
    "lucide-react": "^0.294.0",
    
    "axios": "^1.6.2",
    "@tanstack/react-query": "^5.0.0",
    
    "react-barcode": "^1.4.6",
    "react-qr-code": "^2.0.12",
    "react-to-print": "^2.15.1",
    
    "zustand": "^4.4.7",
    "date-fns": "^2.30.0",
    "zod": "^3.22.4"
  },
  "devDependencies": {
    "@types/react": "^18.2.0",
    "typescript": "^5.0.0",
    "vite": "^5.0.0"
  }
}
```

**Node.js 版本**: 18+

### 2.3 資料庫

- **主資料庫**: PostgreSQL 15+
- **必要擴充套件**:
  ```sql
  CREATE EXTENSION IF NOT EXISTS "uuid-ossp";      -- UUID 生成
  CREATE EXTENSION IF NOT EXISTS "pg_trgm";        -- 模糊搜尋
  CREATE EXTENSION IF NOT EXISTS "btree_gin";      -- JSONB 索引加速
  ```

### 2.4 其他服務

- **快取**: Redis 7+
- **訊息佇列**: Celery + Redis
- **印表機**: Zebra ZPL 印表機 (或相容 TSC)

---

## 3. 專案結構

```
wms-semiconductor/
├── backend/
│   ├── alembic/                    # 資料庫遷移
│   │   ├── versions/
│   │   │   └── 001_initial_schema.py
│   │   ├── env.py
│   │   └── alembic.ini
│   │
│   ├── app/
│   │   ├── __init__.py
│   │   ├── main.py                 # FastAPI 主程式
│   │   │
│   │   ├── api/                    # API 路由層
│   │   │   ├── __init__.py
│   │   │   ├── deps.py             # 依賴注入
│   │   │   └── v1/
│   │   │       ├── __init__.py
│   │   │       ├── receiving.py    # 收貨 API
│   │   │       ├── inventory.py    # 庫存 API
│   │   │       ├── picking.py      # 揀貨 API
│   │   │       ├── locations.py    # 儲位 API
│   │   │       ├── barcodes.py     # 條碼管理 API
│   │   │       ├── traceability.py # 追溯 API
│   │   │       └── items.py        # 料號管理 API
│   │   │
│   │   ├── core/                   # 核心業務引擎
│   │   │   ├── __init__.py
│   │   │   │
│   │   │   ├── barcode/            # 條碼處理引擎
│   │   │   │   ├── __init__.py
│   │   │   │   ├── parser.py       # 條碼解析器
│   │   │   │   ├── generator.py    # 條碼生成器
│   │   │   │   └── learner.py      # AI 學習引擎
│   │   │   │
│   │   │   ├── warehouse/          # 倉儲作業引擎
│   │   │   │   ├── __init__.py
│   │   │   │   ├── receiving.py    # 收貨邏輯
│   │   │   │   ├── putaway.py      # 上架演算法
│   │   │   │   ├── picking.py      # 揀貨引擎
│   │   │   │   └── adjustment.py   # 庫存調整
│   │   │   │
│   │   │   ├── printing/           # 標籤列印引擎
│   │   │   │   ├── __init__.py
│   │   │   │   ├── label_printer.py
│   │   │   │   └── zpl_templates.py
│   │   │   │
│   │   │   └── traceability/       # 追溯引擎
│   │   │       ├── __init__.py
│   │   │       └── tracer.py
│   │   │
│   │   ├── models/                 # SQLAlchemy ORM Models
│   │   │   ├── __init__.py
│   │   │   ├── warehouse.py        # 倉庫/儲位
│   │   │   ├── item.py             # 料號
│   │   │   ├── vendor.py           # 供應商
│   │   │   ├── inventory.py        # 庫存
│   │   │   ├── transaction.py      # 交易記錄
│   │   │   ├── order.py            # 訂單
│   │   │   └── barcode.py          # 條碼規則
│   │   │
│   │   ├── schemas/                # Pydantic Schemas (API DTO)
│   │   │   ├── __init__.py
│   │   │   ├── receiving.py
│   │   │   ├── inventory.py
│   │   │   ├── picking.py
│   │   │   ├── barcode.py
│   │   │   └── common.py
│   │   │
│   │   ├── services/               # 業務邏輯層
│   │   │   ├── __init__.py
│   │   │   ├── receiving_service.py
│   │   │   ├── inventory_service.py
│   │   │   ├── picking_service.py
│   │   │   └── barcode_service.py
│   │   │
│   │   ├── db/                     # 資料庫連線
│   │   │   ├── __init__.py
│   │   │   ├── base.py
│   │   │   └── session.py
│   │   │
│   │   ├── config/                 # 配置管理
│   │   │   ├── __init__.py
│   │   │   └── settings.py
│   │   │
│   │   └── utils/                  # 工具函式
│   │       ├── __init__.py
│   │       ├── security.py
│   │       └── helpers.py
│   │
│   ├── tests/                      # 測試
│   │   ├── __init__.py
│   │   ├── conftest.py
│   │   ├── test_barcode_parser.py
│   │   ├── test_receiving.py
│   │   └── test_traceability.py
│   │
│   ├── .env.example
│   ├── .env
│   ├── requirements.txt
│   └── README.md
│
├── frontend/
│   ├── public/
│   │   └── index.html
│   │
│   ├── src/
│   │   ├── components/
│   │   │   ├── common/             # 共用元件
│   │   │   │   ├── BarcodeScanner.tsx
│   │   │   │   ├── LocationPicker.tsx
│   │   │   │   ├── LabelPreview.tsx
│   │   │   │   └── DataTable.tsx
│   │   │   │
│   │   │   ├── receiving/          # 收貨模組
│   │   │   │   ├── ReceivingForm.tsx
│   │   │   │   ├── IQCPanel.tsx
│   │   │   │   └── LabelPrintDialog.tsx
│   │   │   │
│   │   │   ├── inventory/          # 庫存模組
│   │   │   │   ├── InventoryList.tsx
│   │   │   │   ├── LocationMap.tsx
│   │   │   │   └── LotDetails.tsx
│   │   │   │
│   │   │   ├── picking/            # 揀貨模組
│   │   │   │   ├── PickWave.tsx
│   │   │   │   └── PickTaskCard.tsx
│   │   │   │
│   │   │   └── traceability/       # 追溯模組
│   │   │       ├── TraceViewer.tsx
│   │   │       └── TraceTimeline.tsx
│   │   │
│   │   ├── pages/
│   │   │   ├── ReceivingPage.tsx
│   │   │   ├── InventoryPage.tsx
│   │   │   ├── PickingPage.tsx
│   │   │   ├── TraceabilityPage.tsx
│   │   │   └── SettingsPage.tsx
│   │   │
│   │   ├── hooks/                  # Custom Hooks
│   │   │   ├── useBarcodeScanner.ts
│   │   │   ├── useInventory.ts
│   │   │   └── usePrinter.ts
│   │   │
│   │   ├── stores/                 # Zustand State
│   │   │   ├── inventoryStore.ts
│   │   │   └── userStore.ts
│   │   │
│   │   ├── api/                    # API 客戶端
│   │   │   ├── client.ts
│   │   │   └── endpoints.ts
│   │   │
│   │   ├── types/                  # TypeScript Types
│   │   │   └── index.ts
│   │   │
│   │   ├── App.tsx
│   │   └── main.tsx
│   │
│   ├── package.json
│   ├── tsconfig.json
│   ├── vite.config.ts
│   └── tailwind.config.js
│
├── docker/
│   ├── Dockerfile.backend
│   ├── Dockerfile.frontend
│   └── docker-compose.yml
│
├── docs/
│   ├── API.md
│   ├── DATABASE.md
│   └── DEPLOYMENT.md
│
└── README.md
```

---

## 4. 資料庫設計

### 4.1 完整 Schema (PostgreSQL)

```sql
-- ============================================
-- 半導體 WMS 資料庫 Schema
-- PostgreSQL 15+
-- ============================================

-- 啟用擴充套件
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
CREATE EXTENSION IF NOT EXISTS "btree_gin";

-- ============================================
-- 1. 倉庫與儲位管理
-- ============================================

-- 倉庫主檔
CREATE TABLE warehouses (
    warehouse_id SERIAL PRIMARY KEY,
    warehouse_code VARCHAR(10) UNIQUE NOT NULL,
    warehouse_name VARCHAR(100) NOT NULL,
    location VARCHAR(200),
    is_esd_controlled BOOLEAN DEFAULT FALSE,  -- 靜電管控區
    temperature_range VARCHAR(20),             -- 溫濕度要求
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

COMMENT ON TABLE warehouses IS '倉庫主檔';
COMMENT ON COLUMN warehouses.is_esd_controlled IS '是否為 ESD(靜電)管控區';

-- 儲位結構 (Zone > Aisle > Rack > Shelf > Bin)
CREATE TABLE storage_locations (
    location_id SERIAL PRIMARY KEY,
    warehouse_id INT REFERENCES warehouses(warehouse_id),
    location_code VARCHAR(20) UNIQUE NOT NULL,
    location_type VARCHAR(10) CHECK (location_type IN ('ZONE', 'AISLE', 'RACK', 'SHELF', 'BIN')),
    parent_location_id INT REFERENCES storage_locations(location_id),
    
    -- 容量限制
    capacity_kg DECIMAL(10,2),
    capacity_cbm DECIMAL(10,3),
    
    -- 料件限制
    msl_level INT CHECK (msl_level BETWEEN 1 AND 6),
    allowed_item_types TEXT[],                -- 允許存放的料件類型
    
    -- 特殊狀態
    is_quarantine BOOLEAN DEFAULT FALSE,      -- 隔離區
    barcode VARCHAR(50),                      -- 儲位條碼
    
    created_at TIMESTAMP DEFAULT NOW()
);

COMMENT ON TABLE storage_locations IS '儲位結構 (分層式)';
COMMENT ON COLUMN storage_locations.msl_level IS 'Moisture Sensitivity Level (濕敏等級)';

-- 儲位即時狀態
CREATE TABLE location_status (
    location_id INT PRIMARY KEY REFERENCES storage_locations(location_id),
    current_occupancy_pct DECIMAL(5,2) DEFAULT 0,
    last_inventory_date TIMESTAMP,
    status VARCHAR(20) DEFAULT 'AVAILABLE' 
        CHECK (status IN ('AVAILABLE', 'OCCUPIED', 'LOCKED', 'DAMAGED')),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- ============================================
-- 2. 料號與供應商管理
-- ============================================

-- 料號主檔
CREATE TABLE items (
    item_id SERIAL PRIMARY KEY,
    internal_sku VARCHAR(50) UNIQUE NOT NULL,
    item_type VARCHAR(20) CHECK (item_type IN ('IC', 'RESISTOR', 'CAPACITOR', 'CONNECTOR', 'OTHER')),
    description TEXT,
    manufacturer VARCHAR(100),
    
    -- 包裝資訊
    mpq INT,                                  -- Minimum Package Quantity
    spq INT,                                  -- Standard Pack Quantity
    base_unit VARCHAR(10) DEFAULT 'PCS',
    
    -- 品質要求
    msl_level INT CHECK (msl_level BETWEEN 1 AND 6),
    rohs_compliant BOOLEAN DEFAULT TRUE,
    reach_compliant BOOLEAN DEFAULT TRUE,
    
    -- 庫存策略
    safety_stock INT DEFAULT 0,
    reorder_point INT DEFAULT 0,
    abc_category CHAR(1) CHECK (abc_category IN ('A', 'B', 'C')),
    
    -- 追溯要求
    lot_control_required BOOLEAN DEFAULT TRUE,
    date_code_required BOOLEAN DEFAULT TRUE,
    coc_required BOOLEAN DEFAULT FALSE,       -- Certificate of Conformance
    
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

COMMENT ON TABLE items IS '料號主檔';
COMMENT ON COLUMN items.mpq IS '最小包裝數量';
COMMENT ON COLUMN items.coc_required IS '是否需要符合性證明';

-- 供應商主檔
CREATE TABLE vendors (
    vendor_id SERIAL PRIMARY KEY,
    vendor_code VARCHAR(20) UNIQUE NOT NULL,
    vendor_name VARCHAR(100) NOT NULL,
    vendor_type VARCHAR(20) CHECK (vendor_type IN ('MANUFACTURER', 'DISTRIBUTOR', 'BROKER')),
    
    -- 品質認證
    iso9001_certified BOOLEAN DEFAULT FALSE,
    iatf16949_certified BOOLEAN DEFAULT FALSE,
    
    -- 條碼設定
    default_barcode_format VARCHAR(50),
    requires_relabeling BOOLEAN DEFAULT TRUE,  -- 是否強制換標
    
    -- 評級
    quality_rating CHAR(1) CHECK (quality_rating IN ('A', 'B', 'C', 'D')),
    on_time_delivery_rate DECIMAL(5,2),
    
    contact_info JSONB,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW()
);

COMMENT ON TABLE vendors IS '供應商主檔';
COMMENT ON COLUMN vendors.requires_relabeling IS '進貨時是否需要重新貼標';

-- 條碼解析規則庫
CREATE TABLE barcode_patterns (
    pattern_id SERIAL PRIMARY KEY,
    vendor_id INT REFERENCES vendors(vendor_id),
    pattern_name VARCHAR(50) NOT NULL,
    regex_rule TEXT NOT NULL,
    field_mapping JSONB NOT NULL,
    priority INT DEFAULT 0,
    
    -- 驗證規則
    validation_rules JSONB,
    
    -- 特殊處理
    multi_scan_mode BOOLEAN DEFAULT FALSE,
    scan_sequence TEXT[],
    quantity_conversion JSONB,               -- {"K": 1000, "M": 1000000}
    
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    
    UNIQUE(vendor_id, pattern_name)
);

COMMENT ON TABLE barcode_patterns IS '條碼解析規則庫';
COMMENT ON COLUMN barcode_patterns.regex_rule IS 'Python Regex 規則,使用 named groups';
COMMENT ON COLUMN barcode_patterns.field_mapping IS '欄位對照表 {"group_name": "field_name"}';

-- 供應商料號對照表 (AVL: Approved Vendor List)
CREATE TABLE vendor_items (
    mapping_id SERIAL PRIMARY KEY,
    vendor_id INT REFERENCES vendors(vendor_id),
    vendor_pn VARCHAR(100) NOT NULL,
    internal_sku VARCHAR(50) REFERENCES items(internal_sku),
    barcode_pattern_id INT REFERENCES barcode_patterns(pattern_id),
    
    -- AVL 狀態
    approval_status VARCHAR(20) DEFAULT 'APPROVED' 
        CHECK (approval_status IN ('APPROVED', 'PENDING', 'REJECTED')),
    preferred_vendor BOOLEAN DEFAULT FALSE,
    
    -- 成本資訊
    latest_unit_price DECIMAL(10,4),
    currency VARCHAR(3) DEFAULT 'USD',
    
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    
    UNIQUE(vendor_id, vendor_pn)
);

COMMENT ON TABLE vendor_items IS '供應商料號對照表 (AVL)';

-- ============================================
-- 3. 庫存與追溯管理
-- ============================================

-- 庫存批次主檔 (核心資料表)
CREATE TABLE inventory_lots (
    lot_id SERIAL PRIMARY KEY,
    
    -- 基本資訊
    internal_sku VARCHAR(50) REFERENCES items(internal_sku) NOT NULL,
    internal_barcode VARCHAR(100) UNIQUE NOT NULL,
    internal_lot_number VARCHAR(50) NOT NULL,
    
    -- 原廠追溯資訊
    vendor_id INT REFERENCES vendors(vendor_id),
    vendor_pn VARCHAR(100),
    vendor_lot_code VARCHAR(50),
    vendor_date_code VARCHAR(20),
    original_barcode VARCHAR(200),           -- 原始供應商條碼(完整保留)
    
    -- 數量管理
    quantity_on_hand INT NOT NULL CHECK (quantity_on_hand >= 0),
    quantity_reserved INT DEFAULT 0 CHECK (quantity_reserved >= 0),
    quantity_available INT GENERATED ALWAYS AS (quantity_on_hand - quantity_reserved) STORED,
    unit VARCHAR(10),
    
    -- 儲位
    location_id INT REFERENCES storage_locations(location_id),
    
    -- 日期追溯
    manufacture_date DATE,
    receive_date TIMESTAMP DEFAULT NOW(),
    expiry_date DATE,                        -- MSL 到期日
    
    -- 狀態管理
    lot_status VARCHAR(20) DEFAULT 'AVAILABLE' 
        CHECK (lot_status IN ('AVAILABLE', 'RESERVED', 'QC_HOLD', 'QUARANTINE', 'EXPIRED', 'SHIPPED')),
    
    -- 品質資訊
    iqc_result VARCHAR(10) CHECK (iqc_result IN ('PASS', 'FAIL', 'PENDING')),
    iqc_date TIMESTAMP,
    iqc_inspector VARCHAR(50),
    quality_notes TEXT,
    
    -- 文件路徑
    coc_file_path VARCHAR(500),
    msds_file_path VARCHAR(500),
    
    -- 拆帶/合併追溯
    parent_lot_id INT REFERENCES inventory_lots(lot_id),
    split_from_transaction_id INT,
    
    -- 原始掃描資料 (供 Debug)
    raw_scan_data JSONB,
    
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    
    -- 約束: 預留數量不能超過現有量
    CONSTRAINT check_reserved_qty CHECK (quantity_reserved <= quantity_on_hand)
);

COMMENT ON TABLE inventory_lots IS '庫存批次主檔 (Lot 級別追溯)';
COMMENT ON COLUMN inventory_lots.internal_barcode IS '內部產生的唯一條碼';
COMMENT ON COLUMN inventory_lots.original_barcode IS '供應商原始條碼(用於追溯)';
COMMENT ON COLUMN inventory_lots.parent_lot_id IS '拆帶時的母批次 ID';

-- 庫存交易記錄
CREATE TABLE inventory_transactions (
    transaction_id SERIAL PRIMARY KEY,
    transaction_type VARCHAR(20) NOT NULL 
        CHECK (transaction_type IN ('RECEIVE', 'PUT_AWAY', 'PICK', 'SHIP', 'ADJUST', 'SPLIT', 'MERGE', 'RETURN', 'SCRAP')),
    
    lot_id INT REFERENCES inventory_lots(lot_id),
    
    -- 數量異動
    quantity_change INT NOT NULL,            -- 正數=入庫, 負數=出庫
    quantity_before INT,
    quantity_after INT,
    
    -- 儲位異動
    from_location_id INT REFERENCES storage_locations(location_id),
    to_location_id INT REFERENCES storage_locations(location_id),
    
    -- 關聯單據
    reference_type VARCHAR(20),              -- 'PO', 'SO', 'TRANSFER', 'ADJUSTMENT'
    reference_number VARCHAR(50),
    
    -- 執行資訊
    executed_by VARCHAR(50) NOT NULL,
    executed_at TIMESTAMP DEFAULT NOW(),
    device_id VARCHAR(50),                   -- PDA 或 PC 編號
    
    notes TEXT,
    
    created_at TIMESTAMP DEFAULT NOW()
);

COMMENT ON TABLE inventory_transactions IS '所有庫存異動記錄';

-- ============================================
-- 4. 訂單管理
-- ============================================

-- 採購單主檔
CREATE TABLE purchase_orders (
    po_id SERIAL PRIMARY KEY,
    po_number VARCHAR(50) UNIQUE NOT NULL,
    vendor_id INT REFERENCES vendors(vendor_id),
    po_date DATE NOT NULL,
    expected_delivery_date DATE,
    status VARCHAR(20) DEFAULT 'OPEN' 
        CHECK (status IN ('OPEN', 'PARTIAL', 'CLOSED', 'CANCELLED')),
    total_amount DECIMAL(12,2),
    
    created_by VARCHAR(50),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- 採購單明細
CREATE TABLE po_lines (
    po_line_id SERIAL PRIMARY KEY,
    po_id INT REFERENCES purchase_orders(po_id) ON DELETE CASCADE,
    line_number INT NOT NULL,
    internal_sku VARCHAR(50) REFERENCES items(internal_sku),
    vendor_pn VARCHAR(100),
    
    ordered_qty INT NOT NULL,
    received_qty INT DEFAULT 0,
    unit_price DECIMAL(10,4),
    
    created_at TIMESTAMP DEFAULT NOW(),
    
    UNIQUE(po_id, line_number),
    CONSTRAINT check_received_qty CHECK (received_qty <= ordered_qty)
);

-- 銷售單主檔
CREATE TABLE sales_orders (
    so_id SERIAL PRIMARY KEY,
    so_number VARCHAR(50) UNIQUE NOT NULL,
    customer_id INT,                         -- 需要客戶主檔(第二階段)
    order_date DATE NOT NULL,
    required_delivery_date DATE,
    status VARCHAR(20) DEFAULT 'OPEN' 
        CHECK (status IN ('OPEN', 'ALLOCATED', 'PICKED', 'SHIPPED', 'CLOSED', 'CANCELLED')),
    
    -- 追溯要求
    customer_avl JSONB,                      -- 客戶指定的 AVL
    lot_selection_rule VARCHAR(20) DEFAULT 'FIFO' 
        CHECK (lot_selection_rule IN ('FIFO', 'FEFO', 'CUSTOMER_SPECIFIED')),
    
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- 銷售單明細
CREATE TABLE so_lines (
    so_line_id SERIAL PRIMARY KEY,
    so_id INT REFERENCES sales_orders(so_id) ON DELETE CASCADE,
    line_number INT NOT NULL,
    internal_sku VARCHAR(50) REFERENCES items(internal_sku),
    
    ordered_qty INT NOT NULL,
    allocated_qty INT DEFAULT 0,
    picked_qty INT DEFAULT 0,
    shipped_qty INT DEFAULT 0,
    
    -- 客戶要求
    required_date_code VARCHAR(20),          -- 客戶指定日期碼
    required_vendor_id INT REFERENCES vendors(vendor_id),
    
    created_at TIMESTAMP DEFAULT NOW(),
    
    UNIQUE(so_id, line_number)
);

-- 揀貨任務
CREATE TABLE pick_tasks (
    task_id SERIAL PRIMARY KEY,
    so_line_id INT REFERENCES so_lines(so_line_id),
    lot_id INT REFERENCES inventory_lots(lot_id),
    
    pick_qty INT NOT NULL,
    status VARCHAR(20) DEFAULT 'PENDING' 
        CHECK (status IN ('PENDING', 'PICKED', 'CONFIRMED', 'CANCELLED')),
    
    assigned_to VARCHAR(50),                 -- 揀貨員
    picked_at TIMESTAMP,
    
    from_location_id INT REFERENCES storage_locations(location_id),
    
    created_at TIMESTAMP DEFAULT NOW()
);

-- ============================================
-- 5. 追溯視圖 (便於查詢)
-- ============================================

CREATE OR REPLACE VIEW traceability_chain AS
SELECT 
    il.lot_id,
    il.internal_barcode,
    il.internal_lot_number,
    i.internal_sku,
    i.description AS item_description,
    v.vendor_name,
    vi.vendor_pn,
    il.vendor_lot_code,
    il.vendor_date_code,
    il.original_barcode,
    il.receive_date,
    parent.internal_barcode AS parent_barcode,
    sl.location_code AS current_location,
    il.quantity_available,
    il.lot_status
FROM inventory_lots il
LEFT JOIN items i ON il.internal_sku = i.internal_sku
LEFT JOIN vendors v ON il.vendor_id = v.vendor_id
LEFT JOIN vendor_items vi ON v.vendor_id = vi.vendor_id 
    AND il.vendor_pn = vi.vendor_pn
LEFT JOIN inventory_lots parent ON il.parent_lot_id = parent.lot_id
LEFT JOIN storage_locations sl ON il.location_id = sl.location_id;

COMMENT ON VIEW traceability_chain IS '追溯鏈查詢視圖';

-- ============================================
-- 6. 索引優化
-- ============================================

-- 庫存查詢優化
CREATE INDEX idx_inventory_sku ON inventory_lots(internal_sku);
CREATE INDEX idx_inventory_status ON inventory_lots(lot_status);
CREATE INDEX idx_inventory_location ON inventory_lots(location_id);
CREATE INDEX idx_inventory_vendor ON inventory_lots(vendor_id);
CREATE INDEX idx_inventory_barcode ON inventory_lots(internal_barcode);
CREATE INDEX idx_inventory_vendor_lot ON inventory_lots(vendor_lot_code) WHERE vendor_lot_code IS NOT NULL;
CREATE INDEX idx_inventory_available ON inventory_lots(quantity_available) WHERE lot_status = 'AVAILABLE';

-- 交易記錄查詢
CREATE INDEX idx_transaction_lot ON inventory_transactions(lot_id);
CREATE INDEX idx_transaction_type ON inventory_transactions(transaction_type);
CREATE INDEX idx_transaction_date ON inventory_transactions(executed_at DESC);
CREATE INDEX idx_transaction_reference ON inventory_transactions(reference_type, reference_number);

-- 訂單查詢
CREATE INDEX idx_po_number ON purchase_orders(po_number);
CREATE INDEX idx_po_vendor ON purchase_orders(vendor_id);
CREATE INDEX idx_po_status ON purchase_orders(status);
CREATE INDEX idx_so_number ON sales_orders(so_number);
CREATE INDEX idx_so_status ON sales_orders(status);

-- 條碼規則查詢
CREATE INDEX idx_pattern_vendor ON barcode_patterns(vendor_id);
CREATE INDEX idx_pattern_active ON barcode_patterns(is_active);

-- 全文搜尋索引 (料號模糊搜尋)
CREATE INDEX idx_item_description_trgm ON items USING gin (description gin_trgm_ops);

-- JSONB 索引 (加速 JSON 查詢)
CREATE INDEX idx_barcode_field_mapping ON barcode_patterns USING gin (field_mapping);
CREATE INDEX idx_inventory_raw_data ON inventory_lots USING gin (raw_scan_data);

-- ============================================
-- 7. 觸發器 (自動更新時間戳)
-- ============================================

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 套用到所有需要的表
CREATE TRIGGER trg_warehouses_updated
    BEFORE UPDATE ON warehouses
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_items_updated
    BEFORE UPDATE ON items
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_inventory_updated
    BEFORE UPDATE ON inventory_lots
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_po_updated
    BEFORE UPDATE ON purchase_orders
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_so_updated
    BEFORE UPDATE ON sales_orders
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================
-- 8. 初始資料 (範例)
-- ============================================

-- 預設倉庫
INSERT INTO warehouses (warehouse_code, warehouse_name, is_esd_controlled) VALUES
('WH01', '主倉庫', TRUE),
('QC01', 'IQC 檢驗區', FALSE),
('QR01', '隔離區', FALSE);

-- 預設儲位
INSERT INTO storage_locations (warehouse_id, location_code, location_type) VALUES
(1, 'A', 'ZONE'),
(1, 'A-01', 'AISLE'),
(1, 'A-01-R1', 'RACK');

-- 預設供應商與條碼規則 (TI 範例)
INSERT INTO vendors (vendor_code, vendor_name, vendor_type, default_barcode_format, requires_relabeling) VALUES
('TI', 'Texas Instruments', 'MANUFACTURER', '1D_HYBRID', TRUE);

INSERT INTO barcode_patterns (vendor_id, pattern_name, regex_rule, field_mapping, priority) VALUES
(1, 'TI_STANDARD', 
 '^1P(?P<part_number>[A-Z0-9]{10,15})1T(?P<quantity>\d+)9D(?P<date_code>\w+)$',
 '{"part_number": "vendor_pn", "quantity": "qty", "date_code": "lot_code"}'::jsonb,
 10);
```

### 4.2 ERD (實體關係圖)

```
[warehouses] 1---N [storage_locations]
                        |
                        | 1
                        |
                        N
                 [inventory_lots]
                   /     |     \
                  /      |      \
              N /     N  |  N    \ N
               /         |         \
    [vendors]   [items]  |  [purchase_orders]
        |          |     |
        |          |     |
        N          |     N
[barcode_patterns] | [inventory_transactions]
        |          |
        N          N
    [vendor_items]---[items]
```

---

## 5. 條碼解析系統

### 5.1 5 家常見供應商的條碼規則

#### 規則 1: Texas Instruments (TI)

```python
{
    "vendor_name": "Texas Instruments",
    "vendor_code": "TI",
    "barcode_format": "1D + 2D Hybrid",
    "typical_format": "1P料號 1T數量 9D批號",
    
    # 範例: 1PTPS54331DRCR1T30009D2024W15
    "regex_rule": r"^1P(?P<part_number>[A-Z0-9]{10,15})1T(?P<quantity>\d+)9D(?P<date_code>\w+)$",
    
    "field_mapping": {
        "part_number": "vendor_pn",
        "quantity": "qty",
        "date_code": "lot_code"
    },
    
    "validation_rules": {
        "part_number": r"^[A-Z]{2,4}\d{4,6}[A-Z]{2,4}$",
        "date_code": r"^\d{4}W\d{2}$"  # YYYYW週別
    },
    
    "example": "1PTPS54331DRCR1T30009D2024W15"
}
```

#### 規則 2: STMicroelectronics (ST)

```python
{
    "vendor_name": "STMicroelectronics",
    "vendor_code": "ST",
    "barcode_format": "QR Code (GS1 DataMatrix)",
    
    # 範例 QR 內容: [)>06\x1d1PSTM32F407VGT6\x1d1T5000\x1dQ12024A15
    "regex_rule": r"\[?\)?>06(?:\x1d|;)1P(?P<part_number>STM[A-Z0-9]+)(?:\x1d|;)1T(?P<quantity>\d+)(?:\x1d|;)Q(?P<quantity_unit>\d+)(?P<date_code>\d{4}[A-Z]\d{2})",
    
    "field_mapping": {
        "part_number": "vendor_pn",
        "quantity": "qty",
        "date_code": "lot_code"
    },
    
    "separator": "\x1d",  # GS1 分隔符 (Group Separator)
    
    "validation_rules": {
        "part_number": r"^STM32[FHLG]\d{3}[A-Z]{2}[TU]\d$",
        "date_code": r"^\d{4}[A-Z]\d{2}$"  # YYYY + 工廠代碼 + 週別
    },
    
    "example": "[)>06\x1d1PSTM32F407VGT6\x1d1T5000\x1dQ12024A15"
}
```

#### 規則 3: ROHM Semiconductor

```python
{
    "vendor_name": "ROHM",
    "vendor_code": "ROHM",
    "barcode_format": "Code 128",
    
    # 範例: R2012345-LOT:240515-QTY:10000
    "regex_rule": r"^(?P<part_number>R\d{7})[-\s]?LOT:(?P<lot_code>\d{6})[-\s]?QTY:(?P<quantity>\d+)$",
    
    "field_mapping": {
        "part_number": "vendor_pn",
        "lot_code": "lot_code",
        "quantity": "qty"
    },
    
    "validation_rules": {
        "part_number": r"^R\d{7}$",
        "lot_code": r"^\d{6}$"  # YYMMDD
    },
    
    # ROHM 特殊:常有多段條碼,需組合解析
    "multi_scan_mode": True,
    "scan_sequence": ["part_number", "lot_code", "quantity"],
    
    "example": "R2012345-LOT:240515-QTY:10000"
}
```

#### 規則 4: Infineon Technologies

```python
{
    "vendor_name": "Infineon",
    "vendor_code": "IFX",
    "barcode_format": "2D DataMatrix",
    
    # 範例: >P:IPD50R380CE>Q:2500>D:2024-15>L:AB12345
    "regex_rule": r">P:(?P<part_number>[A-Z0-9]+)>Q:(?P<quantity>\d+)>D:(?P<date_code>\d{4}-\d{2})>L:(?P<lot_code>[A-Z0-9]+)",
    
    "field_mapping": {
        "part_number": "vendor_pn",
        "quantity": "qty",
        "date_code": "date_code",
        "lot_code": "lot_code"
    },
    
    "validation_rules": {
        "part_number": r"^[A-Z]{2,3}[DP]?\d{2,4}[A-Z]\d{3}[A-Z]{2}$",
        "date_code": r"^\d{4}-\d{2}$"  # YYYY-WW
    },
    
    "example": ">P:IPD50R380CE>Q:2500>D:2024-15>L:AB12345"
}
```

#### 規則 5: Murata Manufacturing

```python
{
    "vendor_name": "Murata",
    "vendor_code": "MURATA",
    "barcode_format": "Code 39 / QR 混合",
    
    # 範例 (MLCC 電容): GRM155R71C104KA88D/250124/5K
    "regex_rule": r"^(?P<part_number>GRM[A-Z0-9]{12,15})/(?P<date_code>\d{6})/(?P<quantity>\d+[KM]?)$",
    
    "field_mapping": {
        "part_number": "vendor_pn",
        "date_code": "lot_code",
        "quantity": "qty_raw"
    },
    
    # 數量轉換規則
    "quantity_conversion": {
        "K": 1000,
        "M": 1000000
    },
    
    "validation_rules": {
        "part_number": r"^GRM[0-9]{3}[A-Z][0-9]{2}[A-Z][0-9]{3}[A-Z]{2}[0-9A-Z]$",
        "date_code": r"^\d{6}$"  # DDMMYY
    },
    
    "example": "GRM155R71C104KA88D/250124/5K"
}
```

### 5.2 條碼解析引擎核心代碼

```python
# backend/app/core/barcode/parser.py

import re
from typing import Dict, Optional, List
from sqlalchemy.orm import Session
from app.models.barcode import BarcodePattern
from app.models.vendor import Vendor

class BarcodeParser:
    """
    條碼解析引擎
    
    核心功能:
    1. 依供應商自動選擇解析規則
    2. 使用 Regex 提取欄位
    3. 驗證提取結果
    4. 處理數量單位轉換 (K/M)
    """
    
    def __init__(self, db: Session):
        self.db = db
        self.pattern_cache = {}
    
    def parse(self, barcode: str, vendor_id: int) -> Optional[Dict]:
        """
        主解析函式
        
        Args:
            barcode: 原始條碼字串
            vendor_id: 供應商 ID
        
        Returns:
            解析結果 Dict 或 None
        """
        patterns = self._get_patterns(vendor_id)
        
        if not patterns:
            return None
        
        for pattern in patterns:
            match = re.match(pattern.regex_rule, barcode)
            if match:
                parsed_data = self._extract_fields(match, pattern)
                if self._validate(parsed_data, pattern):
                    parsed_data = self._convert_quantity(parsed_data, pattern)
                    parsed_data['pattern_used'] = pattern.pattern_name
                    parsed_data['pattern_id'] = pattern.pattern_id
                    return parsed_data
        
        return None
    
    def _get_patterns(self, vendor_id: int) -> List[BarcodePattern]:
        """取得供應商的所有條碼規則"""
        cache_key = f"vendor_{vendor_id}"
        
        if cache_key not in self.pattern_cache:
            patterns = self.db.query(BarcodePattern).filter(
                BarcodePattern.vendor_id == vendor_id,
                BarcodePattern.is_active == True
            ).order_by(BarcodePattern.priority.desc()).all()
            
            self.pattern_cache[cache_key] = patterns
        
        return self.pattern_cache[cache_key]
    
    def _extract_fields(self, match: re.Match, pattern: BarcodePattern) -> Dict:
        """依 field_mapping 提取欄位"""
        extracted = {}
        for group_name, field_name in pattern.field_mapping.items():
            try:
                value = match.group(group_name)
                extracted[field_name] = value
            except IndexError:
                pass
        return extracted
    
    def _validate(self, data: Dict, pattern: BarcodePattern) -> bool:
        """驗證提取結果"""
        if not pattern.validation_rules:
            return True
        
        for field, rule in pattern.validation_rules.items():
            if field in data:
                if not re.match(rule, str(data[field])):
                    return False
        return True
    
    def _convert_quantity(self, data: Dict, pattern: BarcodePattern) -> Dict:
        """處理數量單位轉換"""
        if not pattern.quantity_conversion:
            return data
        
        qty_field = None
        for key in ['qty', 'qty_raw', 'quantity']:
            if key in data:
                qty_field = key
                break
        
        if not qty_field:
            return data
        
        qty_str = str(data[qty_field])
        
        for suffix, multiplier in pattern.quantity_conversion.items():
            if qty_str.endswith(suffix):
                base_qty = int(qty_str[:-len(suffix)])
                data['qty'] = base_qty * multiplier
                return data
        
        data['qty'] = int(qty_str)
        return data
```

### 5.3 AI 學習引擎 (Claude API 整合)

```python
# backend/app/core/barcode/learner.py

import anthropic
import json
import re
from typing import List, Dict

class PatternInferenceEngine:
    """
    使用 Claude API 從範例中推斷條碼規則
    """
    
    def __init__(self, api_key: str):
        self.client = anthropic.Anthropic(api_key=api_key)
    
    def infer_pattern(
        self, 
        barcode_samples: List[str],
        vendor_name: str,
        manual_labels: Dict = None
    ) -> Dict:
        """
        從範例推斷 Regex 規則
        
        Args:
            barcode_samples: 至少 3-5 個同供應商的條碼範例
            vendor_name: 供應商名稱
            manual_labels: 人工標註的欄位 (可選)
        
        Returns:
            {
                "regex_rule": "...",
                "field_mapping": {...},
                "confidence": 0.85,
                "explanation": "..."
            }
        """
        prompt = self._build_prompt(barcode_samples, vendor_name, manual_labels)
        
        message = self.client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=2000,
            temperature=0,
            messages=[{"role": "user", "content": prompt}]
        )
        
        response_text = message.content[0].text
        return self._parse_response(response_text)
    
    def _build_prompt(
        self, 
        samples: List[str], 
        vendor_name: str,
        labels: Dict
    ) -> str:
        """建構給 Claude 的 Prompt"""
        
        prompt = f"""你是條碼格式分析專家。請分析以下來自 {vendor_name} 的條碼樣本,推斷通用解析規則。

**條碼樣本:**
{chr(10).join(f"{i+1}. {s}" for i, s in enumerate(samples))}
"""
        
        if labels:
            prompt += f"""
**人工標註範例:**
{json.dumps(labels, indent=2, ensure_ascii=False)}
"""
        
        prompt += """
請以 JSON 格式回傳 (不要使用 Markdown 包裝):
{
  "regex_rule": "完整的 Python Regex,使用 named groups (?P<name>...)",
  "field_mapping": {
    "group_name": "對應欄位 (vendor_pn/qty/lot_code/date_code)"
  },
  "confidence": 0.0-1.0,
  "explanation": "推斷邏輯說明"
}

**約束:**
1. Regex 必須能匹配所有樣本
2. 使用 (?P<name>...) 定義欄位
3. 考慮分隔符多樣性 (如 [-\\s]?)
"""
        
        return prompt
    
    def _parse_response(self, response: str) -> Dict:
        """解析 Claude 的 JSON 回應"""
        clean = re.sub(r'```json\s*|\s*```', '', response).strip()
        
        try:
            return json.loads(clean)
        except json.JSONDecodeError:
            json_match = re.search(r'\{.*\}', clean, re.DOTALL)
            if json_match:
                return json.loads(json_match.group())
            raise ValueError(f"無法解析 Claude 回應")
```

---

## 6. 核心業務流程實作

(由於篇幅限制,這裡提供關鍵流程的完整代碼框架)

### 6.1 收貨流程完整代碼

請參考 `backend/app/core/warehouse/receiving.py` 檔案,包含:
- `ReceivingService.process_receipt()` - 完整收貨流程
- `ReceivingService.complete_iqc()` - IQC 檢驗
- 條碼解析、PO 驗證、Lot 建立、標籤列印整合

### 6.2 上架流程完整代碼

請參考 `backend/app/core/warehouse/putaway.py` 檔案,包含:
- `PutAwayEngine.suggest_location()` - 智能上架演算法
- 多因子評分模型 (空間利用率、同料號集中、ABC 分類、FIFO)

### 6.3 揀貨流程與先進先出 (FIFO/FEFO) 完整實作

#### 6.3.1 出貨策略說明

系統支援三種出貨策略,確保庫存正確輪轉:

1. **FIFO (First-In-First-Out) - 先進先出**
   - 依據 `receive_date` (收貨日期) 排序
   - 最早收貨的批次優先出貨
   - 適用於一般電子零件

2. **FEFO (First-Expire-First-Out) - 先到期先出**
   - 依據 `expiry_date` (到期日) 排序
   - MSL (濕敏等級) 零件必須使用此策略
   - 防止零件因濕氣敏感而過期

3. **CUSTOMER_SPECIFIED - 客戶指定**
   - 依據客戶 AVL (Approved Vendor List)
   - 可指定供應商、批號、日期碼
   - 優先滿足客戶特殊要求

#### 6.3.2 完整程式碼實作

```python
# backend/app/core/warehouse/picking.py

from sqlalchemy.orm import Session
from typing import List
from app.models.order import SalesOrder, SOLine, PickTask
from app.models.inventory import InventoryLot
from datetime import datetime, date

class PickingEngine:
    """
    揀貨引擎 - 核心功能:先進先出 (FIFO/FEFO)
    
    重要原則:
    1. 自動依策略排序可用批次
    2. 優先配置最舊/最早到期的批次
    3. 考慮客戶 AVL 限制
    4. 避免配到過期或不良品
    """
    
    def __init__(self, db: Session):
        self.db = db
    
    def allocate_lots_for_so(self, so_number: str) -> Dict:
        """
        為銷售單配置批次 (自動執行 FIFO/FEFO)
        
        執行流程:
        1. 查詢 SO 資訊
        2. 逐行配貨
        3. 依策略排序批次
        4. 建立揀貨任務
        5. 預留庫存
        """
        so = self._get_so(so_number)
        
        allocation_results = []
        
        for line in so.lines:
            try:
                result = self._allocate_line(so, line)
                allocation_results.append(result)
            except InsufficientInventoryError as e:
                allocation_results.append({
                    "line_number": line.line_number,
                    "success": False,
                    "error": str(e)
                })
        
        # 更新 SO 狀態
        if all(r['success'] for r in allocation_results):
            so.status = 'ALLOCATED'
            self.db.commit()
        
        return {
            "so_number": so_number,
            "results": allocation_results,
            "strategy_used": so.lot_selection_rule
        }
    
    def _allocate_line(self, so: SalesOrder, line: SOLine) -> Dict:
        """
        配置單一行項 (核心 FIFO/FEFO 邏輯在此)
        """
        
        # Step 1: 取得可用庫存 (已過濾客戶 AVL)
        available_lots = self._get_available_lots(
            sku=line.internal_sku,
            required_qty=line.ordered_qty,
            customer_avl=so.customer_avl,
            required_vendor=line.required_vendor_id,
            required_date_code=line.required_date_code
        )
        
        if not available_lots:
            raise InsufficientInventoryError(
                f"料號 {line.internal_sku} 無可用庫存"
            )
        
        # Step 2: 依策略排序 (FIFO/FEFO 核心!)
        sorted_lots = self._sort_by_strategy(
            available_lots,
            so.lot_selection_rule
        )
        
        # Step 3: 逐批配貨 (從最舊/最早到期的開始)
        tasks_created = []
        remaining_qty = line.ordered_qty
        
        for lot in sorted_lots:
            if remaining_qty <= 0:
                break
            
            # 計算本批次可配數量
            pick_qty = min(remaining_qty, lot.quantity_available)
            
            # 建立揀貨任務
            task = PickTask(
                so_line_id=line.so_line_id,
                lot_id=lot.lot_id,
                pick_qty=pick_qty,
                from_location_id=lot.location_id,
                status='PENDING'
            )
            
            self.db.add(task)
            tasks_created.append({
                "lot": lot.internal_barcode,
                "qty": pick_qty,
                "receive_date": lot.receive_date.isoformat(),
                "location": lot.location.location_code
            })
            
            # 預留庫存 (鎖定數量)
            lot.quantity_reserved += pick_qty
            
            # 更新行項配貨數量
            line.allocated_qty += pick_qty
            
            remaining_qty -= pick_qty
        
        self.db.flush()
        
        # Step 4: 檢查是否配足
        if remaining_qty > 0:
            raise InsufficientInventoryError(
                f"料號 {line.internal_sku} 庫存不足 {remaining_qty} 件"
            )
        
        return {
            "line_number": line.line_number,
            "success": True,
            "tasks_created": len(tasks_created),
            "allocated_qty": line.allocated_qty,
            "allocation_details": tasks_created
        }
    
    def _get_available_lots(
        self,
        sku: str,
        required_qty: int,
        customer_avl: dict = None,
        required_vendor: int = None,
        required_date_code: str = None
    ) -> List[InventoryLot]:
        """
        取得可用批次 (已過濾不合格的)
        
        過濾條件:
        1. 狀態必須是 AVAILABLE
        2. 可用數量 > 0
        3. 未過期 (MSL)
        4. 符合客戶 AVL (如果有指定)
        """
        query = self.db.query(InventoryLot).filter(
            InventoryLot.internal_sku == sku,
            InventoryLot.lot_status == 'AVAILABLE',
            InventoryLot.quantity_available > 0
        )
        
        # 過濾條件 1: 客戶指定供應商
        if customer_avl and 'approved_vendors' in customer_avl:
            query = query.filter(
                InventoryLot.vendor_id.in_(customer_avl['approved_vendors'])
            )
        elif required_vendor:
            query = query.filter(
                InventoryLot.vendor_id == required_vendor
            )
        
        # 過濾條件 2: 客戶指定日期碼
        if required_date_code:
            query = query.filter(
                InventoryLot.vendor_date_code == required_date_code
            )
        
        # 過濾條件 3: MSL 未過期 (關鍵!)
        query = query.filter(
            (InventoryLot.expiry_date.is_(None)) |
            (InventoryLot.expiry_date > datetime.now())
        )
        
        return query.all()
    
    def _sort_by_strategy(
        self,
        lots: List[InventoryLot],
        strategy: str
    ) -> List[InventoryLot]:
        """
        依策略排序批次 (FIFO/FEFO 核心邏輯!)
        
        排序結果:
        - FIFO: 最早收貨的排在最前面
        - FEFO: 最早到期的排在最前面
        - CUSTOMER_SPECIFIED: 預設使用 FIFO
        """
        
        if strategy == 'FIFO':
            # 先進先出: 依收貨日期由舊到新
            return sorted(lots, key=lambda x: x.receive_date)
        
        elif strategy == 'FEFO':
            # 先到期先出: 依到期日由近到遠
            # 注意: 沒有到期日的視為最後
            return sorted(
                lots,
                key=lambda x: x.expiry_date if x.expiry_date else date.max
            )
        
        else:
            # 預設使用 FIFO
            return sorted(lots, key=lambda x: x.receive_date)
    
    def generate_pick_wave(self, picker_id: str = None) -> List[Dict]:
        """
        產生揀貨波次 (優化揀貨路徑)
        
        路徑優化策略:
        1. 依儲位編號排序 (A-01 → A-02 → B-01)
        2. 同儲位的任務合併
        3. 減少往返距離
        """
        query = self.db.query(PickTask).filter(
            PickTask.status == 'PENDING'
        )
        
        if picker_id:
            query = query.filter(PickTask.assigned_to == picker_id)
        
        tasks = query.all()
        
        # 依儲位排序 (路徑優化)
        tasks_sorted = sorted(
            tasks,
            key=lambda t: t.from_location.location_code
        )
        
        # 組裝揀貨波次
        wave = []
        for idx, task in enumerate(tasks_sorted, start=1):
            wave.append({
                "sequence": idx,
                "task_id": task.task_id,
                "location": task.from_location.location_code,
                "sku": task.lot.internal_sku,
                "barcode": task.lot.internal_barcode,
                "pick_qty": task.pick_qty,
                "so_number": task.so_line.so.so_number,
                "receive_date": task.lot.receive_date.isoformat(),  # 顯示收貨日期
                "expiry_date": task.lot.expiry_date.isoformat() if task.lot.expiry_date else None
            })
        
        return wave
    
    def confirm_pick(
        self,
        task_id: int,
        picked_qty: int,
        picker: str
    ) -> Dict:
        """
        確認揀貨完成
        
        流程:
        1. 驗證任務
        2. 扣減庫存
        3. 解除預留
        4. 更新 SO
        5. 記錄交易
        """
        task = self.db.query(PickTask).get(task_id)
        
        if not task:
            raise ValueError(f"Task {task_id} 不存在")
        
        if picked_qty != task.pick_qty:
            # 實際揀貨數量與計畫不符
            # 可加入差異處理邏輯
            pass
        
        # 更新任務狀態
        task.status = 'PICKED'
        task.picked_at = datetime.now()
        task.assigned_to = picker
        
        # 扣減庫存
        lot = task.lot
        lot.quantity_on_hand -= picked_qty
        lot.quantity_reserved -= task.pick_qty
        
        # 更新 SO Line
        task.so_line.picked_qty += picked_qty
        
        # 記錄交易
        from app.models.transaction import InventoryTransaction
        
        transaction = InventoryTransaction(
            transaction_type='PICK',
            lot_id=lot.lot_id,
            quantity_change=-picked_qty,
            quantity_before=lot.quantity_on_hand + picked_qty,
            quantity_after=lot.quantity_on_hand,
            from_location_id=lot.location_id,
            reference_type='SO',
            reference_number=task.so_line.so.so_number,
            executed_by=picker,
            notes=f"揀貨任務 {task_id}"
        )
        
        self.db.add(transaction)
        self.db.commit()
        
        return {
            "success": True,
            "task_id": task_id,
            "picked_qty": picked_qty,
            "lot_barcode": lot.internal_barcode,
            "remaining_on_hand": lot.quantity_on_hand
        }


class InsufficientInventoryError(Exception):
    """庫存不足錯誤"""
    pass
```

#### 6.3.3 FIFO/FEFO 實際運作範例

**情境 1: FIFO 先進先出**

假設料號 `IC-001` 有以下庫存:

| Lot | 收貨日期 | 可用數量 | 儲位 |
|-----|---------|---------|------|
| LOT-A | 2024-04-01 | 1,000 | A-01 |
| LOT-B | 2024-04-15 | 2,000 | A-02 |
| LOT-C | 2024-05-01 | 3,000 | B-01 |

客戶訂購 2,500 件,系統會:
1. 先配 LOT-A 全部 1,000 件 (最早收貨)
2. 再配 LOT-B 的 1,500 件
3. LOT-C 不動 (留給下次訂單)

**情境 2: FEFO 先到期先出**

假設料號 `IC-002` (MSL 3 等級) 有以下庫存:

| Lot | 到期日 | 可用數量 | 儲位 |
|-----|--------|---------|------|
| LOT-X | 2024-05-10 | 500 | A-01 |
| LOT-Y | 2024-06-15 | 1,000 | A-02 |
| LOT-Z | 2024-07-20 | 2,000 | B-01 |

客戶訂購 1,200 件,系統會:
1. 先配 LOT-X 全部 500 件 (最早到期)
2. 再配 LOT-Y 的 700 件
3. LOT-Z 不動

**情境 3: 客戶指定供應商**

假設客戶只接受 TI (Texas Instruments) 供應商:

| Lot | 供應商 | 收貨日期 | 可用數量 |
|-----|-------|---------|---------|
| LOT-1 | TI | 2024-04-01 | 1,000 |
| LOT-2 | ST | 2024-03-15 | 2,000 |
| LOT-3 | TI | 2024-04-20 | 1,500 |

客戶訂購 1,800 件,系統會:
1. 過濾掉 LOT-2 (供應商不符)
2. 配 LOT-1 全部 1,000 件
3. 配 LOT-3 的 800 件

#### 6.3.4 FIFO/FEFO 配置的資料庫查詢優化

為了提升 FIFO/FEFO 查詢效能,建議加入以下索引:

```sql
-- 優化 FIFO 查詢 (依收貨日期排序)
CREATE INDEX idx_inventory_fifo ON inventory_lots(internal_sku, receive_date) 
WHERE lot_status = 'AVAILABLE';

-- 優化 FEFO 查詢 (依到期日排序)
CREATE INDEX idx_inventory_fefo ON inventory_lots(internal_sku, expiry_date) 
WHERE lot_status = 'AVAILABLE' AND expiry_date IS NOT NULL;

-- 優化客戶 AVL 查詢
CREATE INDEX idx_inventory_vendor_sku ON inventory_lots(vendor_id, internal_sku) 
WHERE lot_status = 'AVAILABLE';
```

#### 6.3.5 前端 UI 顯示 FIFO 配置結果

```tsx
// frontend/src/components/picking/AllocationResult.tsx

interface AllocationDetail {
  lot: string;
  qty: number;
  receive_date: string;
  location: string;
}

interface AllocationResultProps {
  result: {
    success: boolean;
    allocated_qty: number;
    allocation_details: AllocationDetail[];
    strategy_used: string;
  };
}

export default function AllocationResult({ result }: AllocationResultProps) {
  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h3 className="text-lg font-bold mb-4">
        配貨結果 - 策略: {result.strategy_used}
      </h3>
      
      <div className="space-y-2">
        {result.allocation_details.map((detail, idx) => (
          <div key={idx} className="flex items-center gap-4 p-3 bg-gray-50 rounded">
            <div className="flex-1">
              <div className="font-mono text-sm">{detail.lot}</div>
              <div className="text-xs text-gray-500">
                收貨: {new Date(detail.receive_date).toLocaleDateString()}
              </div>
            </div>
            <div className="text-right">
              <div className="font-bold">{detail.qty.toLocaleString()} 件</div>
              <div className="text-xs text-gray-500">{detail.location}</div>
            </div>
            <div className="text-xs text-green-600">
              ✓ 第 {idx + 1} 批
            </div>
          </div>
        ))}
      </div>
      
      <div className="mt-4 pt-4 border-t">
        <div className="flex justify-between font-bold">
          <span>總配貨數量:</span>
          <span>{result.allocated_qty.toLocaleString()} 件</span>
        </div>
      </div>
    </div>
  );
}
```

### 6.4 出貨確認流程 (FIFO 最終執行)

出貨確認是 FIFO/FEFO 策略的最後一步,確保實際出貨的批次與配貨一致。

```python
# backend/app/core/warehouse/shipping.py

from sqlalchemy.orm import Session
from typing import List, Dict
from datetime import datetime
from app.models.order import SalesOrder, SOLine, PickTask
from app.models.inventory import InventoryLot
from app.models.transaction import InventoryTransaction

class ShippingService:
    """
    出貨服務
    
    功能:
    1. 驗證揀貨完成
    2. 產生出貨單
    3. 更新庫存狀態
    4. 記錄追溯鏈
    """
    
    def __init__(self, db: Session):
        self.db = db
    
    def confirm_shipment(
        self,
        so_number: str,
        shipper: str,
        shipping_notes: str = None
    ) -> Dict:
        """
        確認出貨
        
        前置條件:
        - 所有揀貨任務都已完成
        - 數量核對無誤
        
        流程:
        1. 驗證揀貨狀態
        2. 產生出貨清單 (依 FIFO 順序)
        3. 更新 Lot 狀態
        4. 記錄出貨交易
        """
        so = self._get_so(so_number)
        
        # 驗證所有行項都已揀貨
        for line in so.lines:
            if line.picked_qty < line.ordered_qty:
                raise ValueError(
                    f"行項 {line.line_number} 尚未揀貨完成! "
                    f"已揀: {line.picked_qty}, 訂購: {line.ordered_qty}"
                )
        
        # 取得所有揀貨任務 (依 FIFO 順序)
        shipment_details = self._get_shipment_details(so)
        
        # 更新出貨數量
        for line in so.lines:
            line.shipped_qty = line.picked_qty
        
        # 更新 SO 狀態
        so.status = 'SHIPPED'
        
        # 記錄出貨交易
        for detail in shipment_details:
            self._record_shipment_transaction(
                lot_id=detail['lot_id'],
                qty=detail['qty'],
                so_number=so_number,
                shipper=shipper
            )
        
        self.db.commit()
        
        return {
            "success": True,
            "so_number": so_number,
            "shipped_at": datetime.now().isoformat(),
            "shipment_details": shipment_details,
            "total_qty": sum(d['qty'] for d in shipment_details)
        }
    
    def _get_shipment_details(self, so: SalesOrder) -> List[Dict]:
        """
        取得出貨明細 (依 FIFO 順序排列)
        """
        details = []
        
        for line in so.lines:
            # 取得此行項的所有揀貨任務
            tasks = self.db.query(PickTask).filter(
                PickTask.so_line_id == line.so_line_id,
                PickTask.status.in_(['PICKED', 'CONFIRMED'])
            ).all()
            
            # 依收貨日期排序 (FIFO 驗證)
            tasks_sorted = sorted(
                tasks,
                key=lambda t: t.lot.receive_date
            )
            
            for task in tasks_sorted:
                lot = task.lot
                details.append({
                    "lot_id": lot.lot_id,
                    "internal_barcode": lot.internal_barcode,
                    "internal_lot_number": lot.internal_lot_number,
                    "vendor_lot_code": lot.vendor_lot_code,
                    "vendor_name": lot.vendor.vendor_name,
                    "receive_date": lot.receive_date.isoformat(),
                    "qty": task.pick_qty,
                    "sku": lot.internal_sku,
                    "location": lot.location.location_code
                })
        
        return details
    
    def _record_shipment_transaction(
        self,
        lot_id: int,
        qty: int,
        so_number: str,
        shipper: str
    ):
        """記錄出貨交易"""
        transaction = InventoryTransaction(
            transaction_type='SHIP',
            lot_id=lot_id,
            quantity_change=-qty,
            reference_type='SO',
            reference_number=so_number,
            executed_by=shipper,
            notes=f"出貨單: {so_number}"
        )
        
        self.db.add(transaction)
    
    def _get_so(self, so_number: str) -> SalesOrder:
        """取得銷售單"""
        so = self.db.query(SalesOrder).filter(
            SalesOrder.so_number == so_number
        ).first()
        
        if not so:
            raise ValueError(f"銷售單 {so_number} 不存在")
        
        return so
    
    def generate_packing_list(self, so_number: str) -> Dict:
        """
        產生裝箱單 (Packing List)
        
        內容包含:
        - 每個 Lot 的詳細資訊
        - 供應商批號 (用於客戶追溯)
        - 收貨日期 (證明 FIFO)
        """
        so = self._get_so(so_number)
        shipment_details = self._get_shipment_details(so)
        
        packing_list = {
            "so_number": so_number,
            "customer_id": so.customer_id,
            "ship_date": datetime.now().isoformat(),
            "items": []
        }
        
        # 依 SKU 分組
        from collections import defaultdict
        sku_groups = defaultdict(list)
        
        for detail in shipment_details:
            sku_groups[detail['sku']].append(detail)
        
        # 產生每個 SKU 的裝箱資訊
        for sku, lots in sku_groups.items():
            packing_list["items"].append({
                "sku": sku,
                "total_qty": sum(lot['qty'] for lot in lots),
                "lots": [
                    {
                        "internal_lot": lot['internal_lot_number'],
                        "vendor_lot": lot['vendor_lot_code'],
                        "vendor": lot['vendor_name'],
                        "qty": lot['qty'],
                        "receive_date": lot['receive_date']
                    }
                    for lot in lots
                ]
            })
        
        return packing_list
```

#### 6.4.1 出貨單 API 端點

```python
# backend/app/api/v1/shipping.py

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.api.deps import get_db, get_current_user
from app.schemas.shipping import ShipmentRequest, ShipmentResponse
from app.core.warehouse.shipping import ShippingService

router = APIRouter(prefix="/shipping", tags=["shipping"])

@router.post("/confirm", response_model=ShipmentResponse)
def confirm_shipment(
    request: ShipmentRequest,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """
    確認出貨
    
    驗證所有揀貨完成後才能執行
    """
    service = ShippingService(db)
    
    try:
        result = service.confirm_shipment(
            so_number=request.so_number,
            shipper=current_user['username'],
            shipping_notes=request.notes
        )
        
        return ShipmentResponse(**result)
    
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/packing-list/{so_number}")
def get_packing_list(
    so_number: str,
    db: Session = Depends(get_db)
):
    """
    產生裝箱單 (含 FIFO 順序證明)
    """
    service = ShippingService(db)
    
    try:
        packing_list = service.generate_packing_list(so_number)
        return packing_list
    
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
```

#### 6.4.2 裝箱單範例

```json
{
  "so_number": "SO-2024-0501",
  "customer_id": 123,
  "ship_date": "2024-05-05T14:30:00",
  "items": [
    {
      "sku": "IC-001",
      "total_qty": 2500,
      "lots": [
        {
          "internal_lot": "IC-001-240401-0001",
          "vendor_lot": "2024W14",
          "vendor": "Texas Instruments",
          "qty": 1000,
          "receive_date": "2024-04-01T10:20:00"
        },
        {
          "internal_lot": "IC-001-240415-0003",
          "vendor_lot": "2024W16",
          "vendor": "Texas Instruments",
          "qty": 1500,
          "receive_date": "2024-04-15T15:45:00"
        }
      ]
    }
  ]
}
```

注意: 裝箱單中的批次順序 = FIFO 順序,最早收貨的排在最前面,證明系統確實執行先進先出。

---

### 6.5 追溯功能完整代碼

請參考 `backend/app/core/traceability/tracer.py` 檔案,包含:
- `TraceabilityEngine.trace_forward()` - 正向追溯
- `TraceabilityEngine.trace_backward()` - 逆向追溯

---

## 7. API 端點設計

### 7.1 API 路由總覽

```
POST   /api/v1/auth/login                    # 登入
POST   /api/v1/auth/logout                   # 登出

# 收貨模組
POST   /api/v1/receiving/scan                # 掃描條碼
POST   /api/v1/receiving/receive             # 執行收貨
POST   /api/v1/receiving/iqc                 # IQC 檢驗
GET    /api/v1/receiving/pending             # 待檢驗列表

# 庫存模組
GET    /api/v1/inventory/lots                # 查詢庫存
GET    /api/v1/inventory/lots/{lot_id}       # Lot 詳情
POST   /api/v1/inventory/adjust              # 庫存調整
POST   /api/v1/inventory/split               # 拆帶

# 揀貨模組 (FIFO/FEFO 核心)
POST   /api/v1/picking/allocate              # 自動配貨 (執行 FIFO/FEFO)
GET    /api/v1/picking/wave                  # 揀貨波次
POST   /api/v1/picking/confirm               # 確認揀貨
GET    /api/v1/picking/tasks                 # 揀貨任務列表

# 出貨模組
POST   /api/v1/shipping/confirm              # 確認出貨
GET    /api/v1/shipping/packing-list/{so}    # 裝箱單 (含 FIFO 證明)
GET    /api/v1/shipping/pending              # 待出貨列表
GET    /api/v1/picking/wave                  # 揀貨波次
POST   /api/v1/picking/confirm               # 確認揀貨

# 追溯查詢
GET    /api/v1/trace/forward                 # 正向追溯
GET    /api/v1/trace/backward                # 逆向追溯
```

### 7.2 關鍵 API 實作範例

完整 API 實作請參考:
- `backend/app/api/v1/receiving.py`
- `backend/app/api/v1/inventory.py`
- `backend/app/api/v1/picking.py`
- `backend/app/api/v1/traceability.py`

---

## 8. 前端 UI 元件

### 8.1 收貨介面元件

完整元件代碼請參考:
- `frontend/src/components/receiving/ReceivingForm.tsx`
- `frontend/src/components/common/BarcodeScanner.tsx`

### 8.2 庫存查詢元件

完整元件代碼請參考:
- `frontend/src/components/inventory/InventoryList.tsx`
- `frontend/src/components/inventory/LotDetails.tsx`

---

## 9. 標籤列印系統

### 9.1 ZPL 標籤模板

```python
# backend/app/core/printing/zpl_templates.py

class ZPLTemplates:
    @staticmethod
    def standard_label(data: dict) -> str:
        """
        標準標籤格式
        """
        zpl = f"""
^XA
^CF0,40
^FO50,50^FD{data['internal_barcode']}^FS

^FO50,120^BQN,2,6^FDQA,{data['internal_barcode']}^FS

^CF0,30
^FO300,120^FD{data['description'][:20]}^FS

^CF0,25
^FO300,170^FDLOT: {data.get('vendor_lot', 'N/A')}^FS

^CF0,25
^FO50,250^FDQTY: {data['quantity']:,} {data['unit']}^FS
^FO300,250^FD{data['receive_date']}^FS

^XZ
"""
        return zpl
```

---

## 10. 部署配置

### 10.1 Docker Compose

```yaml
version: '3.8'

services:
  db:
    image: postgres:15
    environment:
      POSTGRES_DB: wms_semiconductor
      POSTGRES_USER: wms_user
      POSTGRES_PASSWORD: wms_password
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"

  backend:
    build: ./backend
    ports:
      - "8000:8000"
    environment:
      DATABASE_URL: postgresql://wms_user:wms_password@db:5432/wms_semiconductor
      REDIS_URL: redis://redis:6379
    depends_on:
      - db
      - redis

  frontend:
    build: ./frontend
    ports:
      - "3000:3000"
    environment:
      VITE_API_URL: http://localhost:8000

volumes:
  postgres_data:
```

### 10.2 環境變數配置

```bash
# backend/.env

DATABASE_URL=postgresql://wms_user:wms_password@localhost:5432/wms_semiconductor
REDIS_URL=redis://localhost:6379
CLAUDE_API_KEY=your_api_key_here
SECRET_KEY=your_secret_key_here
ZEBRA_PRINTER_IP=192.168.1.100
```

---

## 附錄 A: FIFO/FEFO 測試案例與驗證

### A.1 FIFO 單元測試

```python
# backend/tests/test_fifo_picking.py

import pytest
from datetime import datetime, timedelta
from app.core.warehouse.picking import PickingEngine
from app.models.inventory import InventoryLot
from app.models.order import SalesOrder, SOLine

class TestFIFOPicking:
    """
    FIFO 先進先出測試
    
    驗證重點:
    1. 最早收貨的批次優先配貨
    2. 數量不足時跨批次配貨
    3. 客戶 AVL 過濾正確
    """
    
    def test_fifo_basic(self, db_session):
        """測試基本 FIFO 邏輯"""
        
        # 建立測試資料: 3 個不同收貨日期的批次
        lot1 = InventoryLot(
            internal_sku="IC-001",
            internal_barcode="LOT-OLD",
            receive_date=datetime.now() - timedelta(days=10),
            quantity_on_hand=1000,
            lot_status='AVAILABLE'
        )
        
        lot2 = InventoryLot(
            internal_sku="IC-001",
            internal_barcode="LOT-MID",
            receive_date=datetime.now() - timedelta(days=5),
            quantity_on_hand=2000,
            lot_status='AVAILABLE'
        )
        
        lot3 = InventoryLot(
            internal_sku="IC-001",
            internal_barcode="LOT-NEW",
            receive_date=datetime.now() - timedelta(days=1),
            quantity_on_hand=3000,
            lot_status='AVAILABLE'
        )
        
        db_session.add_all([lot1, lot2, lot3])
        db_session.commit()
        
        # 建立銷售單: 訂購 2500 件
        so = SalesOrder(
            so_number="SO-TEST-001",
            lot_selection_rule='FIFO'
        )
        line = SOLine(
            so=so,
            internal_sku="IC-001",
            ordered_qty=2500
        )
        db_session.add_all([so, line])
        db_session.commit()
        
        # 執行配貨
        engine = PickingEngine(db_session)
        result = engine.allocate_lots_for_so("SO-TEST-001")
        
        # 驗證 FIFO 順序
        assert result['results'][0]['success'] == True
        tasks = result['results'][0]['allocation_details']
        
        # 第一批應該是最舊的 LOT-OLD (1000 件)
        assert tasks[0]['lot'] == "LOT-OLD"
        assert tasks[0]['qty'] == 1000
        
        # 第二批應該是 LOT-MID (1500 件)
        assert tasks[1]['lot'] == "LOT-MID"
        assert tasks[1]['qty'] == 1500
        
        # LOT-NEW 不應該被配到
        assert len(tasks) == 2
    
    def test_fefo_with_expiry(self, db_session):
        """測試 FEFO 先到期先出"""
        
        # 建立測試資料: 不同到期日的批次
        lot1 = InventoryLot(
            internal_sku="IC-002",
            internal_barcode="LOT-EXPIRE-SOON",
            receive_date=datetime.now() - timedelta(days=5),
            expiry_date=datetime.now() + timedelta(days=10),  # 10天後到期
            quantity_on_hand=1000,
            lot_status='AVAILABLE'
        )
        
        lot2 = InventoryLot(
            internal_sku="IC-002",
            internal_barcode="LOT-EXPIRE-LATER",
            receive_date=datetime.now() - timedelta(days=10),  # 更早收貨
            expiry_date=datetime.now() + timedelta(days=30),  # 但30天後才到期
            quantity_on_hand=2000,
            lot_status='AVAILABLE'
        )
        
        db_session.add_all([lot1, lot2])
        db_session.commit()
        
        # 建立 FEFO 銷售單
        so = SalesOrder(
            so_number="SO-TEST-002",
            lot_selection_rule='FEFO'
        )
        line = SOLine(
            so=so,
            internal_sku="IC-002",
            ordered_qty=1500
        )
        db_session.add_all([so, line])
        db_session.commit()
        
        # 執行配貨
        engine = PickingEngine(db_session)
        result = engine.allocate_lots_for_so("SO-TEST-002")
        
        # 驗證 FEFO: 最早到期的應該先配
        tasks = result['results'][0]['allocation_details']
        assert tasks[0]['lot'] == "LOT-EXPIRE-SOON"
        assert tasks[0]['qty'] == 1000
        assert tasks[1]['lot'] == "LOT-EXPIRE-LATER"
        assert tasks[1]['qty'] == 500
```

### A.2 FIFO 整合測試流程

```python
# backend/tests/test_fifo_integration.py

class TestFIFOIntegration:
    """
    完整 FIFO 流程測試
    
    流程: 收貨 → 上架 → 配貨 → 揀貨 → 出貨
    """
    
    def test_complete_fifo_flow(self, db_session):
        """測試完整的 FIFO 流程"""
        
        # Step 1: 收貨 (3批不同日期)
        from app.core.warehouse.receiving import ReceivingService
        
        receiving = ReceivingService(db_session)
        
        # 第一批收貨 (10天前)
        lot1 = receiving.process_receipt(
            po_number="PO-001",
            barcode="VENDOR-CODE-001",
            qty=1000,
            receive_date=datetime.now() - timedelta(days=10)
        )
        
        # 第二批收貨 (5天前)
        lot2 = receiving.process_receipt(
            po_number="PO-001",
            barcode="VENDOR-CODE-002",
            qty=2000,
            receive_date=datetime.now() - timedelta(days=5)
        )
        
        # Step 2: 配貨 (應該先配 lot1)
        so = SalesOrder(so_number="SO-001", lot_selection_rule='FIFO')
        line = SOLine(so=so, internal_sku="IC-001", ordered_qty=1500)
        db_session.add_all([so, line])
        db_session.commit()
        
        engine = PickingEngine(db_session)
        result = engine.allocate_lots_for_so("SO-001")
        
        # Step 3: 驗證配貨順序
        tasks = result['results'][0]['allocation_details']
        assert tasks[0]['lot'] == lot1['internal_barcode']
        assert tasks[0]['qty'] == 1000
        assert tasks[1]['lot'] == lot2['internal_barcode']
        assert tasks[1]['qty'] == 500
        
        # Step 4: 出貨
        from app.core.warehouse.shipping import ShippingService
        
        shipping = ShippingService(db_session)
        shipment = shipping.confirm_shipment("SO-001", "admin")
        
        # 驗證裝箱單的 FIFO 順序
        packing_list = shipping.generate_packing_list("SO-001")
        lots_shipped = packing_list['items'][0]['lots']
        
        # 確認出貨順序 = FIFO 順序
        assert lots_shipped[0]['internal_lot'] == lot1['internal_lot_number']
        assert lots_shipped[1]['internal_lot'] == lot2['internal_lot_number']
```

### A.3 FIFO 性能測試

```python
# backend/tests/test_fifo_performance.py

import time

class TestFIFOPerformance:
    """
    FIFO 性能測試
    
    目標: 1000 筆庫存中配貨應在 1 秒內完成
    """
    
    def test_large_inventory_fifo(self, db_session):
        """測試大量庫存的 FIFO 性能"""
        
        # 建立 1000 個批次
        lots = []
        for i in range(1000):
            lot = InventoryLot(
                internal_sku="IC-001",
                internal_barcode=f"LOT-{i:04d}",
                receive_date=datetime.now() - timedelta(days=1000-i),
                quantity_on_hand=100,
                lot_status='AVAILABLE'
            )
            lots.append(lot)
        
        db_session.add_all(lots)
        db_session.commit()
        
        # 建立大訂單
        so = SalesOrder(so_number="SO-PERF", lot_selection_rule='FIFO')
        line = SOLine(so=so, internal_sku="IC-001", ordered_qty=5000)
        db_session.add_all([so, line])
        db_session.commit()
        
        # 測試配貨性能
        start_time = time.time()
        
        engine = PickingEngine(db_session)
        result = engine.allocate_lots_for_so("SO-PERF")
        
        elapsed = time.time() - start_time
        
        # 驗證性能 (應小於 1 秒)
        assert elapsed < 1.0, f"FIFO 配貨耗時 {elapsed:.2f} 秒,超過 1 秒限制"
        
        # 驗證結果正確性
        assert result['results'][0]['success'] == True
        assert result['results'][0]['allocated_qty'] == 5000
        
        # 驗證 FIFO 順序 (前 50 批應該是最舊的)
        tasks = result['results'][0]['allocation_details']
        for i in range(50):
            assert tasks[i]['lot'] == f"LOT-{i:04d}"
```

### A.4 FIFO 驗證檢查清單

在系統上線前,請確認以下項目:

- [ ] **FIFO 基本邏輯**
  - [ ] 最早收貨的批次優先配貨
  - [ ] 跨批次配貨時順序正確
  - [ ] 相同收貨日期時的處理方式

- [ ] **FEFO 邏輯**
  - [ ] 最早到期的批次優先配貨
  - [ ] 無到期日的批次排在最後
  - [ ] 已過期批次不會被配貨

- [ ] **客戶 AVL 過濾**
  - [ ] 不在 AVL 清單的供應商被過濾
  - [ ] 指定日期碼的批次優先
  - [ ] 過濾後仍遵循 FIFO/FEFO

- [ ] **性能要求**
  - [ ] 1000 筆庫存配貨 < 1 秒
  - [ ] 並發配貨時無死鎖
  - [ ] 資料庫索引優化完成

- [ ] **追溯完整性**
  - [ ] 裝箱單顯示 FIFO 順序
  - [ ] 出貨記錄可追溯到收貨日期
  - [ ] 批次追溯鏈完整

---

## 附錄 B: 開發階段檢查清單

### Phase 1: 核心基礎 (Week 1-4)

#### Week 1
- [ ] PostgreSQL 資料庫建立
- [ ] 執行 Schema SQL
- [ ] SQLAlchemy Models 定義
- [ ] 基本 CRUD API

#### Week 2
- [ ] BarcodeParser 實作
- [ ] 5 家供應商規則建立
- [ ] 條碼解析測試

#### Week 3
- [ ] ReceivingService 實作
- [ ] 標籤列印整合
- [ ] 收貨前端 UI

#### Week 4
- [ ] TraceabilityEngine 實作
- [ ] 追溯查詢 UI

### Phase 2-4: 進階功能開發

(詳細清單請參考完整文件)

---

**文件結束**
