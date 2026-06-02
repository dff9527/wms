-- ============================================
-- 5 家供應商 + 條碼解析規則種子資料
-- 來源：WMS_Development_Spec.md §5.1
-- 用法：psql <DATABASE_URL> -f change_requests/seed_patterns.sql
-- 前置：先跑 schema.sql
-- 注意：regex_rule 內含反斜線，需 standard_conforming_strings=on（PG 預設）
--       才會原樣存入，供 Python re 使用。
-- ============================================

SET standard_conforming_strings = on;

-- 供應商主檔（含換標需求）
INSERT INTO vendors (vendor_code, vendor_name, vendor_type, default_barcode_format, requires_relabeling) VALUES
('TI',     'Texas Instruments',    'MANUFACTURER', '1D_HYBRID',         TRUE),
('ST',     'STMicroelectronics',   'MANUFACTURER', 'GS1_DATAMATRIX',    TRUE),
('ROHM',   'ROHM Semiconductor',   'MANUFACTURER', 'CODE128',           TRUE),
('IFX',    'Infineon Technologies','MANUFACTURER', '2D_DATAMATRIX',     TRUE),
('MURATA', 'Murata Manufacturing', 'MANUFACTURER', 'CODE39_QR',         TRUE)
ON CONFLICT (vendor_code) DO NOTHING;

-- 條碼解析規則（依 vendor_code 取得 vendor_id，避免硬編 ID）

-- 規則 1: TI（1P料號 1T數量 9D批號）
INSERT INTO barcode_patterns (vendor_id, pattern_name, regex_rule, field_mapping, validation_rules, priority)
SELECT vendor_id, 'TI_STANDARD',
       '^1P(?P<part_number>[A-Z0-9]{10,15})1T(?P<quantity>\d+)9D(?P<date_code>\w+)$',
       '{"part_number": "vendor_pn", "quantity": "qty", "date_code": "lot_code"}'::jsonb,
       '{"part_number": "^[A-Z]{2,4}\\d{4,6}[A-Z]{2,4}$", "date_code": "^\\d{4}W\\d{2}$"}'::jsonb,
       10
FROM vendors WHERE vendor_code = 'TI'
ON CONFLICT (vendor_id, pattern_name) DO NOTHING;

-- 規則 2: ST（GS1 DataMatrix，\x1d 為 GS 分隔符）
INSERT INTO barcode_patterns (vendor_id, pattern_name, regex_rule, field_mapping, validation_rules, priority)
SELECT vendor_id, 'ST_GS1',
       '\[?\)?>06(?:\x1d|;)1P(?P<part_number>STM[A-Z0-9]+)(?:\x1d|;)1T(?P<quantity>\d+)(?:\x1d|;)Q(?P<quantity_unit>\d+)(?P<date_code>\d{4}[A-Z]\d{2})',
       '{"part_number": "vendor_pn", "quantity": "qty", "date_code": "lot_code"}'::jsonb,
       '{"part_number": "^STM32[FHLG]\\d{3}[A-Z]{2}[TU]\\d$", "date_code": "^\\d{4}[A-Z]\\d{2}$"}'::jsonb,
       10
FROM vendors WHERE vendor_code = 'ST'
ON CONFLICT (vendor_id, pattern_name) DO NOTHING;

-- 規則 3: ROHM（Code 128，多段組合）
INSERT INTO barcode_patterns (vendor_id, pattern_name, regex_rule, field_mapping, validation_rules, priority, multi_scan_mode, scan_sequence)
SELECT vendor_id, 'ROHM_CODE128',
       '^(?P<part_number>R\d{7})[-\s]?LOT:(?P<lot_code>\d{6})[-\s]?QTY:(?P<quantity>\d+)$',
       '{"part_number": "vendor_pn", "lot_code": "lot_code", "quantity": "qty"}'::jsonb,
       '{"part_number": "^R\\d{7}$", "lot_code": "^\\d{6}$"}'::jsonb,
       10,
       TRUE,
       ARRAY['part_number', 'lot_code', 'quantity']
FROM vendors WHERE vendor_code = 'ROHM'
ON CONFLICT (vendor_id, pattern_name) DO NOTHING;

-- 規則 4: Infineon（2D DataMatrix）
INSERT INTO barcode_patterns (vendor_id, pattern_name, regex_rule, field_mapping, validation_rules, priority)
SELECT vendor_id, 'IFX_DATAMATRIX',
       '>P:(?P<part_number>[A-Z0-9]+)>Q:(?P<quantity>\d+)>D:(?P<date_code>\d{4}-\d{2})>L:(?P<lot_code>[A-Z0-9]+)',
       '{"part_number": "vendor_pn", "quantity": "qty", "date_code": "date_code", "lot_code": "lot_code"}'::jsonb,
       '{"part_number": "^[A-Z]{2,3}[DP]?\\d{2,4}[A-Z]\\d{3}[A-Z]{2}$", "date_code": "^\\d{4}-\\d{2}$"}'::jsonb,
       10
FROM vendors WHERE vendor_code = 'IFX'
ON CONFLICT (vendor_id, pattern_name) DO NOTHING;

-- 規則 5: Murata（Code39/QR，含 K/M 數量換算）
INSERT INTO barcode_patterns (vendor_id, pattern_name, regex_rule, field_mapping, validation_rules, quantity_conversion, priority)
SELECT vendor_id, 'MURATA_MLCC',
       '^(?P<part_number>GRM[A-Z0-9]{12,15})/(?P<date_code>\d{6})/(?P<quantity>\d+[KM]?)$',
       '{"part_number": "vendor_pn", "date_code": "lot_code", "quantity": "qty_raw"}'::jsonb,
       '{"part_number": "^GRM[0-9]{3}[A-Z][0-9]{2}[A-Z][0-9]{3}[A-Z]{2}[0-9A-Z]$", "date_code": "^\\d{6}$"}'::jsonb,
       '{"K": 1000, "M": 1000000}'::jsonb,
       10
FROM vendors WHERE vendor_code = 'MURATA'
ON CONFLICT (vendor_id, pattern_name) DO NOTHING;

-- 驗證：應印出 5 列
-- SELECT v.vendor_code, p.pattern_name FROM barcode_patterns p JOIN vendors v USING (vendor_id) ORDER BY v.vendor_code;
