-- ============================================
-- 半導體 WMS 資料庫 Schema（可直接執行版）
-- 來源：WMS_Development_Spec.md §4.1
-- PostgreSQL 15+
-- 用法：psql <DATABASE_URL> -f change_requests/schema.sql
-- 注意：vendor / barcode_patterns 種子資料移到 seed_patterns.sql
-- ============================================

-- 啟用擴充套件
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
CREATE EXTENSION IF NOT EXISTS "btree_gin";

-- ============================================
-- 1. 倉庫與儲位管理
-- ============================================

CREATE TABLE warehouses (
    warehouse_id SERIAL PRIMARY KEY,
    warehouse_code VARCHAR(10) UNIQUE NOT NULL,
    warehouse_name VARCHAR(100) NOT NULL,
    location VARCHAR(200),
    is_esd_controlled BOOLEAN DEFAULT FALSE,
    temperature_range VARCHAR(20),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE storage_locations (
    location_id SERIAL PRIMARY KEY,
    warehouse_id INT REFERENCES warehouses(warehouse_id),
    location_code VARCHAR(20) UNIQUE NOT NULL,
    location_type VARCHAR(10) CHECK (location_type IN ('ZONE', 'AISLE', 'RACK', 'SHELF', 'BIN')),
    parent_location_id INT REFERENCES storage_locations(location_id),
    capacity_kg DECIMAL(10,2),
    capacity_cbm DECIMAL(10,3),
    msl_level INT CHECK (msl_level BETWEEN 1 AND 6),
    allowed_item_types TEXT[],
    is_quarantine BOOLEAN DEFAULT FALSE,
    barcode VARCHAR(50),
    created_at TIMESTAMP DEFAULT NOW()
);

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

CREATE TABLE items (
    item_id SERIAL PRIMARY KEY,
    internal_sku VARCHAR(50) UNIQUE NOT NULL,
    item_type VARCHAR(20) CHECK (item_type IN ('IC', 'RESISTOR', 'CAPACITOR', 'CONNECTOR', 'OTHER')),
    description TEXT,
    manufacturer VARCHAR(100),
    mpq INT,
    spq INT,
    base_unit VARCHAR(10) DEFAULT 'PCS',
    msl_level INT CHECK (msl_level BETWEEN 1 AND 6),
    rohs_compliant BOOLEAN DEFAULT TRUE,
    reach_compliant BOOLEAN DEFAULT TRUE,
    safety_stock INT DEFAULT 0,
    reorder_point INT DEFAULT 0,
    abc_category CHAR(1) CHECK (abc_category IN ('A', 'B', 'C')),
    lot_control_required BOOLEAN DEFAULT TRUE,
    date_code_required BOOLEAN DEFAULT TRUE,
    coc_required BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE vendors (
    vendor_id SERIAL PRIMARY KEY,
    vendor_code VARCHAR(20) UNIQUE NOT NULL,
    vendor_name VARCHAR(100) NOT NULL,
    vendor_type VARCHAR(20) CHECK (vendor_type IN ('MANUFACTURER', 'DISTRIBUTOR', 'BROKER')),
    iso9001_certified BOOLEAN DEFAULT FALSE,
    iatf16949_certified BOOLEAN DEFAULT FALSE,
    default_barcode_format VARCHAR(50),
    requires_relabeling BOOLEAN DEFAULT TRUE,
    quality_rating CHAR(1) CHECK (quality_rating IN ('A', 'B', 'C', 'D')),
    on_time_delivery_rate DECIMAL(5,2),
    contact_info JSONB,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE barcode_patterns (
    pattern_id SERIAL PRIMARY KEY,
    vendor_id INT REFERENCES vendors(vendor_id),
    pattern_name VARCHAR(50) NOT NULL,
    regex_rule TEXT NOT NULL,
    field_mapping JSONB NOT NULL,
    priority INT DEFAULT 0,
    validation_rules JSONB,
    multi_scan_mode BOOLEAN DEFAULT FALSE,
    scan_sequence TEXT[],
    quantity_conversion JSONB,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(vendor_id, pattern_name)
);

CREATE TABLE vendor_items (
    mapping_id SERIAL PRIMARY KEY,
    vendor_id INT REFERENCES vendors(vendor_id),
    vendor_pn VARCHAR(100) NOT NULL,
    internal_sku VARCHAR(50) REFERENCES items(internal_sku),
    barcode_pattern_id INT REFERENCES barcode_patterns(pattern_id),
    approval_status VARCHAR(20) DEFAULT 'APPROVED'
        CHECK (approval_status IN ('APPROVED', 'PENDING', 'REJECTED')),
    preferred_vendor BOOLEAN DEFAULT FALSE,
    latest_unit_price DECIMAL(10,4),
    currency VARCHAR(3) DEFAULT 'USD',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(vendor_id, vendor_pn)
);

-- ============================================
-- 3. 庫存與追溯管理
-- ============================================

CREATE TABLE inventory_lots (
    lot_id SERIAL PRIMARY KEY,
    internal_sku VARCHAR(50) REFERENCES items(internal_sku) NOT NULL,
    internal_barcode VARCHAR(100) UNIQUE NOT NULL,
    internal_lot_number VARCHAR(50) NOT NULL,
    vendor_id INT REFERENCES vendors(vendor_id),
    vendor_pn VARCHAR(100),
    vendor_lot_code VARCHAR(50),
    vendor_date_code VARCHAR(20),
    original_barcode VARCHAR(200),
    quantity_on_hand INT NOT NULL CHECK (quantity_on_hand >= 0),
    quantity_reserved INT DEFAULT 0 CHECK (quantity_reserved >= 0),
    quantity_available INT GENERATED ALWAYS AS (quantity_on_hand - quantity_reserved) STORED,
    unit VARCHAR(10),
    location_id INT REFERENCES storage_locations(location_id),
    manufacture_date DATE,
    receive_date TIMESTAMP DEFAULT NOW(),
    expiry_date DATE,
    lot_status VARCHAR(20) DEFAULT 'AVAILABLE'
        CHECK (lot_status IN ('AVAILABLE', 'RESERVED', 'QC_HOLD', 'QUARANTINE', 'EXPIRED', 'SHIPPED')),
    iqc_result VARCHAR(10) CHECK (iqc_result IN ('PASS', 'FAIL', 'PENDING')),
    iqc_date TIMESTAMP,
    iqc_inspector VARCHAR(50),
    quality_notes TEXT,
    coc_file_path VARCHAR(500),
    msds_file_path VARCHAR(500),
    parent_lot_id INT REFERENCES inventory_lots(lot_id),
    split_from_transaction_id INT,
    raw_scan_data JSONB,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    CONSTRAINT check_reserved_qty CHECK (quantity_reserved <= quantity_on_hand)
);

CREATE TABLE inventory_transactions (
    transaction_id SERIAL PRIMARY KEY,
    transaction_type VARCHAR(20) NOT NULL
        CHECK (transaction_type IN ('RECEIVE', 'PUT_AWAY', 'PICK', 'SHIP', 'ADJUST', 'SPLIT', 'MERGE', 'RETURN', 'SCRAP')),
    lot_id INT REFERENCES inventory_lots(lot_id),
    quantity_change INT NOT NULL,
    quantity_before INT,
    quantity_after INT,
    from_location_id INT REFERENCES storage_locations(location_id),
    to_location_id INT REFERENCES storage_locations(location_id),
    reference_type VARCHAR(20),
    reference_number VARCHAR(50),
    executed_by VARCHAR(50) NOT NULL,
    executed_at TIMESTAMP DEFAULT NOW(),
    device_id VARCHAR(50),
    notes TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

-- ============================================
-- 4. 訂單管理
-- ============================================

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

CREATE TABLE sales_orders (
    so_id SERIAL PRIMARY KEY,
    so_number VARCHAR(50) UNIQUE NOT NULL,
    customer_id INT,                         -- 需客戶主檔（第二階段），目前無 FK
    order_date DATE NOT NULL,
    required_delivery_date DATE,
    status VARCHAR(20) DEFAULT 'OPEN'
        CHECK (status IN ('OPEN', 'ALLOCATED', 'PICKED', 'SHIPPED', 'CLOSED', 'CANCELLED')),
    customer_avl JSONB,
    lot_selection_rule VARCHAR(20) DEFAULT 'FIFO'
        CHECK (lot_selection_rule IN ('FIFO', 'FEFO', 'CUSTOMER_SPECIFIED')),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE so_lines (
    so_line_id SERIAL PRIMARY KEY,
    so_id INT REFERENCES sales_orders(so_id) ON DELETE CASCADE,
    line_number INT NOT NULL,
    internal_sku VARCHAR(50) REFERENCES items(internal_sku),
    ordered_qty INT NOT NULL,
    allocated_qty INT DEFAULT 0,
    picked_qty INT DEFAULT 0,
    shipped_qty INT DEFAULT 0,
    required_date_code VARCHAR(20),
    required_vendor_id INT REFERENCES vendors(vendor_id),
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(so_id, line_number)
);

CREATE TABLE pick_tasks (
    task_id SERIAL PRIMARY KEY,
    so_line_id INT REFERENCES so_lines(so_line_id),
    lot_id INT REFERENCES inventory_lots(lot_id),
    pick_qty INT NOT NULL,
    status VARCHAR(20) DEFAULT 'PENDING'
        CHECK (status IN ('PENDING', 'PICKED', 'CONFIRMED', 'CANCELLED')),
    assigned_to VARCHAR(50),
    picked_at TIMESTAMP,
    from_location_id INT REFERENCES storage_locations(location_id),
    created_at TIMESTAMP DEFAULT NOW()
);

-- ============================================
-- 5. 追溯視圖
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

-- ============================================
-- 6. 索引優化
-- ============================================

CREATE INDEX idx_inventory_sku ON inventory_lots(internal_sku);
CREATE INDEX idx_inventory_status ON inventory_lots(lot_status);
CREATE INDEX idx_inventory_location ON inventory_lots(location_id);
CREATE INDEX idx_inventory_vendor ON inventory_lots(vendor_id);
CREATE INDEX idx_inventory_barcode ON inventory_lots(internal_barcode);
CREATE INDEX idx_inventory_vendor_lot ON inventory_lots(vendor_lot_code) WHERE vendor_lot_code IS NOT NULL;
CREATE INDEX idx_inventory_available ON inventory_lots(quantity_available) WHERE lot_status = 'AVAILABLE';

CREATE INDEX idx_transaction_lot ON inventory_transactions(lot_id);
CREATE INDEX idx_transaction_type ON inventory_transactions(transaction_type);
CREATE INDEX idx_transaction_date ON inventory_transactions(executed_at DESC);
CREATE INDEX idx_transaction_reference ON inventory_transactions(reference_type, reference_number);

CREATE INDEX idx_po_number ON purchase_orders(po_number);
CREATE INDEX idx_po_vendor ON purchase_orders(vendor_id);
CREATE INDEX idx_po_status ON purchase_orders(status);
CREATE INDEX idx_so_number ON sales_orders(so_number);
CREATE INDEX idx_so_status ON sales_orders(status);

CREATE INDEX idx_pattern_vendor ON barcode_patterns(vendor_id);
CREATE INDEX idx_pattern_active ON barcode_patterns(is_active);

CREATE INDEX idx_item_description_trgm ON items USING gin (description gin_trgm_ops);
CREATE INDEX idx_barcode_field_mapping ON barcode_patterns USING gin (field_mapping);
CREATE INDEX idx_inventory_raw_data ON inventory_lots USING gin (raw_scan_data);

-- FIFO/FEFO 查詢優化（spec §6.3.4，Round 4 需要）
CREATE INDEX idx_inventory_fifo ON inventory_lots(internal_sku, receive_date)
    WHERE lot_status = 'AVAILABLE';
CREATE INDEX idx_inventory_fefo ON inventory_lots(internal_sku, expiry_date)
    WHERE lot_status = 'AVAILABLE' AND expiry_date IS NOT NULL;
CREATE INDEX idx_inventory_vendor_sku ON inventory_lots(vendor_id, internal_sku)
    WHERE lot_status = 'AVAILABLE';

-- ============================================
-- 7. 觸發器（自動更新時間戳）
-- ============================================

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

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
-- 8. 結構性初始資料（倉庫/儲位）
--    供應商與條碼規則 → 見 seed_patterns.sql
-- ============================================

INSERT INTO warehouses (warehouse_code, warehouse_name, is_esd_controlled) VALUES
('WH01', '主倉庫', TRUE),
('QC01', 'IQC 檢驗區', FALSE),
('QR01', '隔離區', FALSE);

INSERT INTO storage_locations (warehouse_id, location_code, location_type) VALUES
(1, 'A', 'ZONE'),
(1, 'A-01', 'AISLE'),
(1, 'A-01-R1', 'RACK');
