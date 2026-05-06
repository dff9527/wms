# Cursor 修改指令 - 收貨介面批號架構調整

## 問題說明

目前收貨清單介面的「批號」欄位只顯示供應商批號 (vendor_lot_code),缺少內部批號 (internal_lot_number) 和內部條碼 (internal_barcode) 的顯示,不符合系統設計的三層識別碼架構。

## 三層識別碼架構

系統設計採用三層識別碼:

```
第一層: internal_sku (內部料號)
  ↓ 料件代碼,固定不變,識別「什麼料」
  例: IC-001

第二層: internal_lot_number (內部批號)  
  ↓ 批次代碼,每批不同,識別「哪一批」,用於 FIFO 排序
  例: IC-001-240501-0001

第三層: internal_barcode (內部條碼)
  ↓ 可掃描的唯一識別碼
  例: 240501-IC001-0001-W15

額外追溯: vendor_lot_code (供應商批號)
  ↓ 原廠追溯用
  例: TI2024W15A
```

---

## 修改任務清單

### ✅ 任務 1: 修改前端 UI - 收貨清單表格

**檔案位置:** `frontend/src/components/receiving/ReceivingList.tsx`

**修改內容:**

將表格欄位從:
```
採購單號 | 供應商 | 料號 | 批號 | 數量 | 狀態 | 操作
```

改為:
```
採購單號 | 供應商 | 內部料號 | 內部批號 | 內部條碼 | 供應商批號 | 數量 | 狀態 | 操作
```

**欄位對照:**

| 顯示名稱 | 資料庫欄位 | 範例值 | 說明 |
|---------|-----------|--------|------|
| 採購單號 | po_number | PO-2024-0501 | - |
| 供應商 | vendor_name | Texas Instruments | - |
| 內部料號 | internal_sku | IC-001 | 料件代碼 |
| 內部批號 | internal_lot_number | IC-001-240501-0001 | 批次追溯碼 |
| 內部條碼 | internal_barcode | 240501-IC001-0001-W15 | 掃描識別用 |
| 供應商批號 | vendor_lot_code | TI2024W15A | 原廠追溯用 |
| 數量 | quantity_on_hand | 5,000 PCS | - |
| 狀態 | lot_status | 待收貨/IQC檢驗中/已完成 | - |

**樣式要求:**

- 內部條碼使用 `font-mono` 字體 (等寬字體)
- 內部批號使用粗體顯示
- 狀態使用顏色標籤:
  - 待收貨: 灰色
  - IQC檢驗中: 黃色
  - 已完成: 綠色

---

### ✅ 任務 2: 修改後端 API - 收貨清單查詢

**檔案位置:** `backend/app/api/v1/receiving.py`

**端點:** `GET /api/v1/receiving/list`

**修改返回資料結構:**

```python
# 舊的返回結構 (缺少內部批號和條碼)
{
  "items": [
    {
      "po_number": "PO-2024-0501",
      "vendor_name": "Texas Instruments",
      "item_sku": "TI-7805",  # ← 這是供應商料號
      "lot_code": "TI2024W15A",  # ← 這是供應商批號
      "quantity": 5000,
      "status": "待收貨"
    }
  ]
}

# 新的返回結構 (完整三層架構)
{
  "items": [
    {
      "po_number": "PO-2024-0501",
      "vendor_name": "Texas Instruments",
      
      # 三層識別碼
      "internal_sku": "IC-001",
      "internal_lot_number": "IC-001-240501-0001",
      "internal_barcode": "240501-IC001-0001-W15",
      
      # 供應商追溯資訊
      "vendor_pn": "TI-7805",
      "vendor_lot_code": "TI2024W15A",
      "vendor_date_code": "2024W15",
      
      "quantity_on_hand": 5000,
      "unit": "PCS",
      "lot_status": "AVAILABLE",
      "receive_date": "2024-05-01T10:20:00"
    }
  ]
}
```

**修改 SQL 查詢:**

```python
# backend/app/api/v1/receiving.py

@router.get("/list")
def get_receiving_list(
    po_number: str = None,
    status: str = None,
    db: Session = Depends(get_db)
):
    query = db.query(InventoryLot).join(
        Vendor, InventoryLot.vendor_id == Vendor.vendor_id
    ).join(
        Item, InventoryLot.internal_sku == Item.internal_sku
    )
    
    if po_number:
        query = query.filter(...)
    
    if status:
        query = query.filter(InventoryLot.lot_status == status)
    
    lots = query.all()
    
    return {
        "items": [
            {
                "lot_id": lot.lot_id,
                "po_number": lot.purchase_order.po_number,
                "vendor_name": lot.vendor.vendor_name,
                
                # 三層識別碼 (必須包含)
                "internal_sku": lot.internal_sku,
                "internal_lot_number": lot.internal_lot_number,
                "internal_barcode": lot.internal_barcode,
                
                # 供應商追溯
                "vendor_pn": lot.vendor_pn,
                "vendor_lot_code": lot.vendor_lot_code,
                "vendor_date_code": lot.vendor_date_code,
                
                "quantity_on_hand": lot.quantity_on_hand,
                "unit": lot.unit,
                "lot_status": lot.lot_status,
                "receive_date": lot.receive_date.isoformat()
            }
            for lot in lots
        ]
    }
```

---

### ✅ 任務 3: 修改 TypeScript 型別定義

**檔案位置:** `frontend/src/types/receiving.ts`

```typescript
// 舊的型別定義 (不完整)
interface ReceivingItem {
  poNumber: string;
  vendorName: string;
  itemSku: string;  // ← 模糊,不清楚是內部還是供應商料號
  lotCode: string;  // ← 模糊,不清楚是內部還是供應商批號
  quantity: number;
  status: string;
}

// 新的型別定義 (明確三層架構)
interface ReceivingItem {
  lotId: number;
  poNumber: string;
  vendorName: string;
  
  // 三層識別碼
  internalSku: string;         // 內部料號
  internalLotNumber: string;   // 內部批號
  internalBarcode: string;     // 內部條碼
  
  // 供應商追溯資訊
  vendorPn: string;            // 供應商料號
  vendorLotCode: string;       // 供應商批號
  vendorDateCode?: string;     // 供應商日期碼 (可選)
  
  quantityOnHand: number;
  unit: string;
  lotStatus: 'QC_HOLD' | 'AVAILABLE' | 'QUARANTINE';
  receiveDate: string;
}
```

---

### ✅ 任務 4: 修改收貨詳情頁面

**檔案位置:** `frontend/src/pages/ReceivingDetailPage.tsx`

**需要顯示的完整資訊:**

```tsx
// 收貨詳情卡片佈局
<div className="grid grid-cols-2 gap-4">
  {/* 左欄: 內部資訊 */}
  <div className="space-y-3">
    <h3 className="font-bold text-lg">內部追溯資訊</h3>
    
    <div>
      <label className="text-sm text-gray-500">內部料號</label>
      <div className="font-mono text-lg">{item.internalSku}</div>
    </div>
    
    <div>
      <label className="text-sm text-gray-500">內部批號</label>
      <div className="font-bold text-lg">{item.internalLotNumber}</div>
    </div>
    
    <div>
      <label className="text-sm text-gray-500">內部條碼</label>
      <div className="font-mono text-lg bg-gray-100 p-2 rounded">
        {item.internalBarcode}
      </div>
      {/* 顯示條碼圖片 */}
      <Barcode value={item.internalBarcode} />
    </div>
  </div>
  
  {/* 右欄: 供應商資訊 */}
  <div className="space-y-3">
    <h3 className="font-bold text-lg">供應商追溯資訊</h3>
    
    <div>
      <label className="text-sm text-gray-500">供應商名稱</label>
      <div className="text-lg">{item.vendorName}</div>
    </div>
    
    <div>
      <label className="text-sm text-gray-500">供應商料號</label>
      <div className="font-mono">{item.vendorPn}</div>
    </div>
    
    <div>
      <label className="text-sm text-gray-500">供應商批號</label>
      <div className="font-mono">{item.vendorLotCode}</div>
    </div>
    
    <div>
      <label className="text-sm text-gray-500">供應商日期碼</label>
      <div className="font-mono">{item.vendorDateCode || 'N/A'}</div>
    </div>
  </div>
</div>
```

---

### ✅ 任務 5: 更新資料庫查詢索引 (可選,性能優化)

**檔案位置:** `backend/alembic/versions/xxx_add_lot_indexes.py`

```sql
-- 加速內部批號查詢
CREATE INDEX idx_inventory_lot_number ON inventory_lots(internal_lot_number);

-- 加速內部條碼查詢 (掃描槍常用)
CREATE INDEX idx_inventory_barcode ON inventory_lots(internal_barcode);

-- 加速供應商批號查詢 (追溯常用)
CREATE INDEX idx_inventory_vendor_lot ON inventory_lots(vendor_lot_code) 
WHERE vendor_lot_code IS NOT NULL;
```

---

## 驗收標準

修改完成後,請確認:

### 前端驗收:
- [ ] 收貨清單表格顯示 8 個欄位 (採購單號/供應商/內部料號/內部批號/內部條碼/供應商批號/數量/狀態)
- [ ] 內部條碼使用等寬字體 (font-mono)
- [ ] 內部批號使用粗體顯示
- [ ] 點擊「詳情」可看到完整的三層識別碼資訊
- [ ] 狀態使用顏色標籤區分

### 後端驗收:
- [ ] API 返回包含 internal_sku, internal_lot_number, internal_barcode 三個欄位
- [ ] API 返回包含 vendor_pn, vendor_lot_code, vendor_date_code 供應商追溯欄位
- [ ] 查詢速度正常 (< 500ms)

### 資料完整性驗收:
- [ ] 收貨時自動生成內部批號 (格式: IC-001-240501-0001)
- [ ] 收貨時自動生成內部條碼 (格式: 240501-IC001-0001-W15)
- [ ] 保留供應商原始批號 (vendor_lot_code)
- [ ] 所有批號都可追溯

---

## 參考文件

請參考以下文件了解完整架構:

1. **WMS_Development_Spec.md** - 第 4.1 節 資料庫 Schema (inventory_lots 表)
2. **WMS_Development_Spec.md** - 第 6.1 節 收貨流程與批號生成
3. **WMS_Development_Spec.md** - 第 6.3 節 FIFO/FEFO 邏輯 (使用 internal_lot_number 排序)

---

## 常見問題 FAQ

**Q1: 為什麼需要三層識別碼?**

A: 
- internal_sku: 識別料件 (所有批次共用)
- internal_lot_number: 識別批次 (FIFO 排序依據)
- internal_barcode: 掃描識別 (倉庫作業用)

**Q2: vendor_lot_code 還需要保留嗎?**

A: 需要!這是原廠追溯的關鍵,客戶投訴時需要回溯到供應商批號。

**Q3: 內部批號的格式可以改嗎?**

A: 可以,但建議保持 `{SKU}-{日期}-{流水號}` 結構,因為:
- SKU: 方便人眼識別
- 日期: FIFO 排序依據
- 流水號: 確保唯一性

---

## 實作步驟建議

建議按照以下順序實作:

1. **先修改後端 API** (確保資料正確返回)
2. **再修改 TypeScript 型別** (確保型別安全)
3. **最後修改前端 UI** (確保顯示正確)
4. **測試完整流程** (收貨 → 顯示 → 追溯)

Good luck! 🚀
