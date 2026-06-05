# Stage C — 前端逐模組對齊後端

> 餵給 Pipeline **B-Web**（前端是 B-Web 強項，驗證完整）。前置見 `REMAINING_WORK.md` §0。
> ⚠️ 檔案多，**建議照模組拆成 5 輪**（每輪 1 個模組 + 其 api client）。下面 B 段是「總契約」，每輪只貼相關段落。

## A. 現況
各前端模組的欄位名/狀態值跟後端回傳對不上（pipeline 各輪 RAG 看不到彼此）。已修：Inventory 狀態大小寫崩潰 + Vite proxy。其餘模組待對齊。

## B. change_request（依模組挑相關段落貼上）

### 共通規則（每輪都貼）
```
Align this frontend module to the REAL backend response shapes below. The backend
is the source of truth. Rules:
- All backend STATUS values are UPPERCASE: lot_status ∈ {AVAILABLE,RESERVED,QC_HOLD,QUARANTINE,EXPIRED,SHIPPED};
  pick task status ∈ {PENDING,PICKED,CONFIRMED,CANCELLED}; iqc_result ∈ {PASS,FAIL,PENDING}.
  Normalize with String(x).toLowerCase() before any status->badge lookup, and ALWAYS provide a
  fallback badge for unknown statuses (never index a config map by a possibly-undefined key).
- Backend payload field names are exactly as listed; map them in the api/*.ts client, not scattered in components.
- Do not change backend code. Do not invent endpoints not listed.
```

### 後端實際回傳契約（真相來源）
```
RECEIVING (prefix /api/v1/receiving)
  POST /scan   -> { success, parsed:{vendorPn,qty,lotCode,dateCode}, patternUsed }
  POST /receive-> { success, lotId, internalLotNumber, internalBarcode, labelUrl }
  POST /iqc    -> { success, status, suggestedLocation }
  GET  /list   -> { items:[ {lot_id, po_number(null), vendor_name, internal_sku, internal_lot_number,
                    internal_barcode, vendor_pn, vendor_lot_code, vendor_date_code, original_barcode,
                    description, quantity_on_hand, unit, lot_status, receive_date, location_code,
                    iqc_result, iqc_date, iqc_inspector, quality_notes} ], total }
  GET  /{lot_id} -> single object same shape as items[]

INVENTORY (prefix /api/v1/inventory)
  GET /lots -> [ {lot_id, internal_sku, internal_barcode, internal_lot_number, vendor_pn,
                  quantity_on_hand, quantity_reserved, location_code, lot_status, iqc_result,
                  manufacture_date, expiry_date} ]
  GET /lots/{lot_id} -> single same shape
  POST /adjust { lotId, quantityChange, reason? }    POST /split { parentLotId, quantityToSplit }

PICKING (prefix /api/v1/picking)
  POST /allocate { so_number } -> { soNumber, strategy_used, requestedQty, allocatedQty,
        results:[ {line_number, success, tasks_created, allocated_qty,
                   allocation_details:[ {rank, internalSku, internalLotNumber, internalBarcode,
                                         vendorLotCode, qty, receiveDate, location(nullable)} ], error} ],
        details:[ ...same as allocation_details... ] }
  GET  /wave -> [ {sequence, location(nullable), internalSku, internalLotNumber, internalBarcode,
                   vendorLotCode, pickQty, receiveDate, expiryDate, status, soNumber} ]
  POST /confirm { task_id, picked_qty, picker } -> { status, message }
  GET  /tasks -> [ {task_id, so_line_id, lot_id, from_location_id, pick_qty, status} ]

SHIPPING (prefix /api/v1/shipping)
  POST /confirm { so_number, shipper } -> { status, message, details:[ {internalLotNumber, qty, location(nullable)} ] }
  GET  /packing-list/{so_number} -> { soNumber, items:[ {sku, lots:[ {internalLotNumber, internalSku, qty, location, receiveDate} ]} ] }
  GET  /pending -> [ {so_number, customer_name, total_lines, total_qty, status} ]

TRACE (prefix /api/v1/trace)
  GET /forward?query=<internal_barcode|internal_lot_number|vendor_lot_code>
      -> { barcode, type, supplier:{name,vendorLotCode,dateCode,receiveDate,poNumber,qty},
           receiving:{date,inspector,iqcResult,internalSku,internalLotNumber,internalBarcode},
           inventory:{location,currentQty,reservedQty}, shipments:[ {soNumber,customer,shipDate,qty,status} ] }
  GET /backward?internal_barcode=<...>
      -> { internalBarcode, internalLotNumber, vendorLotCode, vendorDateCode, supplierName, originalBarcode }
```

### 每輪只動的檔（建議拆輪）
```
C1 Receiving : frontend/src/app/components/ReceivingModule.tsx + receiving/*.tsx + api/receiving.ts
C2 Picking   : frontend/src/app/components/PickingModule.tsx + picking/AllocationResult.tsx
C3 Shipping  : frontend/src/app/components/ (shipping 相關) 
C4 Trace     : frontend/src/app/components/TraceabilityModule.tsx (移除內建範例條碼，改真實搜尋)
C5 Dashboard : frontend/src/app/components/DashboardModule.tsx (確認資料來源；無對應 API 的數字標為 mock 或接彙總)
```

## C. 影響
純前端。每輪 2–4 檔，符合 B-Web 1–10 限制。

## D. 前置 / 驗證
```bash
cd ~/projects/wms && git add -A && git commit -m "checkpoint before C" && rm -rf .rag-index
# 跑完：兩邊起起來，逐模組點，開 DevTools Network/Console 不應再有 undefined 崩潰或欄位 mismatch
cd backend && uvicorn app.main:app --reload         # 8000
cd frontend && npm run dev                          # 5173, /api proxy 已設
```
