# Stage C — 可直接複製貼上的 change_request（一輪一個模組）

> 每輪流程：`cd ~/projects/wms && git add -A && git commit -m "checkpoint before CX"` → `rm -rf .rag-index` → launcher **Fresh Start** → 貼下面對應整段 → 跑完開前端那個模組看 Console 沒崩。
> 庫存模組（InventoryModule）與收貨模組（C1）已對齊，不在此清單。

---

## C2 — 揀貨 + 出貨模組（複製整段）

```
Align the Picking module (which also drives shipping) to the REAL backend response shapes. Backend is the source of truth — do NOT change backend code, do NOT invent endpoints.

Files to modify (only these):
- frontend/src/app/components/PickingModule.tsx
- frontend/src/app/components/picking/AllocationResult.tsx

Rules:
- Backend STATUS values are UPPERCASE: pick task status ∈ {PENDING,PICKED,CONFIRMED,CANCELLED}; sales order status ∈ {OPEN,ALLOCATED,PICKED,SHIPPED,CLOSED,CANCELLED}. Normalize with String(x).toLowerCase() before any status→badge lookup and always provide a fallback for unknown statuses (never index a config map by a possibly-undefined key).
- `location` fields may be null — render a dash, never assume a string.

Backend endpoints + exact response shapes:
  POST /api/v1/picking/allocate (body {so_number}) ->
    { soNumber, strategy_used, requestedQty, allocatedQty,
      results:[ {line_number, success, tasks_created, allocated_qty,
                 allocation_details:[ {rank, internalSku, internalLotNumber, internalBarcode, vendorLotCode, qty, receiveDate, location(nullable)} ], error} ],
      details:[ ...same item shape as allocation_details... ] }
  GET  /api/v1/picking/wave -> [ {sequence, location(nullable), internalSku, internalLotNumber, internalBarcode, vendorLotCode, pickQty, receiveDate, expiryDate, status, soNumber} ]
  POST /api/v1/picking/confirm (body {task_id, picked_qty, picker}) -> { status, message }
  GET  /api/v1/picking/tasks -> [ {task_id, so_line_id, lot_id, from_location_id, pick_qty, status} ]
  POST /api/v1/shipping/confirm (body {so_number, shipper}) -> { status, message, details:[ {internalLotNumber, qty, location(nullable)} ] }
  GET  /api/v1/shipping/packing-list/{so_number} -> { soNumber, items:[ {sku, lots:[ {internalLotNumber, internalSku, qty, location, receiveDate} ]} ] }
  GET  /api/v1/shipping/pending -> [ {so_number, customer_name, total_lines, total_qty, status} ]

Behavior:
- AllocationResult.tsx renders allocatedQty + the details[] rows (use strategy_used for the strategy label).
- The pick wave list reads the array above and shows each task's status via the normalized badge.
- Confirm-pick then confirm-shipment then show the packing list (lots are already in FIFO order).
- Do not require auth headers.
```

---

## C3 — 追溯模組（複製整段）

```
Align the Traceability module to the REAL backend response shapes, and remove the hardcoded sample barcodes that auto-fire and 404. Backend is the source of truth — do NOT change backend code.

Files to modify (only this):
- frontend/src/app/components/TraceabilityModule.tsx

Rules:
- Only query the backend when the user submits a non-empty search value; do NOT fire requests for built-in example strings on mount.
- A 404 means "no lot/barcode found" — show a friendly empty state, do not crash.
- Status values are UPPERCASE — normalize before any badge lookup, with a fallback.

Backend endpoints + exact response shapes:
  GET /api/v1/trace/forward?query=<internal_barcode | internal_lot_number | vendor_lot_code>
      -> { barcode, type,
           supplier:{name, vendorLotCode, dateCode, receiveDate, poNumber, qty},
           receiving:{date, inspector, iqcResult, internalSku, internalLotNumber, internalBarcode},
           inventory:{location, currentQty, reservedQty},
           shipments:[ {soNumber, customer, shipDate, qty, status} ] }
  GET /api/v1/trace/backward?internal_barcode=<internal_barcode>
      -> { internalBarcode, internalLotNumber, vendorLotCode, vendorDateCode, supplierName, originalBarcode }

Behavior:
- Forward search renders the supplier / receiving / inventory / shipments sections from the shape above.
- Backward search renders the 6 fields above.
- Do not require auth headers.
```

---

## C4 — Dashboard 模組（複製整段）

```
Make the Dashboard module show real numbers derived from existing endpoints instead of hardcoded mock data, and clearly label any number that has no backing endpoint. Backend is the source of truth — do NOT change backend code, do NOT invent endpoints.

Files to modify (only this):
- frontend/src/app/components/DashboardModule.tsx

Available endpoints to aggregate from (no dedicated dashboard API exists):
  GET /api/v1/inventory/lots -> array of lots; each has lot_status (UPPERCASE) and quantity_on_hand.
       Use this to compute counts/sums by lot_status (e.g. AVAILABLE / QC_HOLD / QUARANTINE totals).
  GET /api/v1/picking/tasks   -> array of pick tasks; each has status (PENDING/PICKED/...). Count PENDING.
  GET /api/v1/shipping/pending -> array of {so_number, customer_name, total_lines, total_qty, status}. Count of pending shipments.

Rules:
- Normalize UPPERCASE statuses with String(x).toLowerCase() before grouping; never index a map by a possibly-undefined key.
- For any tile that has NO backing endpoint, either remove it or render it with a visible "—" / "mock" marker rather than a fabricated number.
- Be defensive: if a fetch fails or returns empty, show 0 / empty state, do not crash.

Behavior:
- Fetch the three endpoints above (React Query is fine), compute the summary tiles, and render them.
- Do not require auth headers.
```

---

完成全部後，整個 UI 應該能從收貨點到追溯一路走通。每輪跑完記得 commit。

## C1（已完成，存檔備查）

```
Align the Receiving frontend module to the REAL backend response shapes. Backend is the source of truth — do NOT change backend code, do NOT invent endpoints.

Files to modify (only these):
- frontend/src/app/components/ReceivingModule.tsx
- frontend/src/app/components/receiving/ReceivingList.tsx
- frontend/src/app/components/receiving/ReceivingDetail.tsx
- frontend/src/app/api/receiving.ts

Rules:
- All backend STATUS values are UPPERCASE: lot_status ∈ {AVAILABLE,RESERVED,QC_HOLD,QUARANTINE,EXPIRED,SHIPPED}; iqc_result ∈ {PASS,FAIL,PENDING}. Normalize with String(x).toLowerCase() AND always provide a fallback badge for unknown statuses.
- Map backend payload field names in api/receiving.ts (the client), not scattered across components.

Backend endpoints + exact response shapes (prefix /api/v1/receiving):
  POST /scan   -> { success, parsed:{vendorPn,qty,lotCode,dateCode}, patternUsed }
  POST /receive (body {po_number, barcode, vendor_id, qty}) -> { success, lotId, internalLotNumber, internalBarcode, labelUrl }
  POST /iqc (body {lotId, result, inspector, notes?}) -> { success, status, suggestedLocation }
  GET  /list?po_number=&status= -> { items:[ {lot_id, po_number(null), vendor_name, internal_sku, internal_lot_number, internal_barcode, vendor_pn, vendor_lot_code, vendor_date_code, original_barcode, description, quantity_on_hand, unit, lot_status, receive_date, location_code, iqc_result, iqc_date, iqc_inspector, quality_notes} ], total }
  GET  /{lot_id} -> a single object with the same fields as items[]
  POST /print-label (body {lot_id}) -> { success, zpl, printed }

Behavior:
- The list/table reads items[] and shows lot_status via the normalized badge.
- Receive flow: scan → receive → iqc; show suggestedLocation after IQC PASS.
- Do not require auth headers.
```
