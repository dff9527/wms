# Stage A2 + A4 — PO 驗證 + 標籤列印 (ZPL)

> 餵給 Pipeline **B-Web**。前置見 `REMAINING_WORK.md` §0。建議拆成 A2、A4 兩輪。
> 後端 Python 輪：產出後自行 uvicorn + pytest 驗證。

## A. 現況
- 收貨**不驗 PO**（`process_receipt` 裡 PO 檢查被註解成 mock）。
- `/print-label` 回 501；`core/printing/` 不存在。

---

## B1. change_request — A2 PO 驗證（複製貼上）
```
Make receiving validate against the purchase order instead of accepting any po_number.
DB is the source of truth (schema.sql, snake_case):
- purchase_orders: po_id, po_number (unique), vendor_id, status ('OPEN'|'PARTIAL'|'CLOSED'|'CANCELLED').
- po_lines: po_line_id, po_id (FK), line_number, internal_sku, vendor_pn, ordered_qty, received_qty.

In backend/app/core/warehouse/receiving.py process_receipt(), after resolving internal_sku
from the AVL, BEFORE creating the lot:
1. Look up the PurchaseOrder by po_number; 400 if not found or status in ('CLOSED','CANCELLED').
2. Find a matching po_line on that PO where internal_sku matches (and vendor_pn if present) and
   received_qty < ordered_qty; 400 with a clear message if none.
3. After the lot + RECEIVE transaction are created, increment that po_line.received_qty by quantity;
   if all lines are fully received set purchase_orders.status='CLOSED', else 'PARTIAL'.
Keep everything in the existing single commit; raise HTTPException(400, detail=...) on any mismatch.

Constraints: no DB migration (tables already exist), no frontend changes. Reuse models in
app/models/order.py (PurchaseOrder, POLine).

Note for testing: there is no endpoint to create POs yet — the e2e test must seed a PurchaseOrder
+ POLine via SessionLocal before calling /receive. Add that seeding to test_e2e_flow.py.

[貼上 spec §6.1 收貨流程 + §4.1 的 purchase_orders / po_lines 欄位定義]
```

## B2. change_request — A4 標籤列印 ZPL（複製貼上）
```
Implement ZPL label generation per spec §9 and wire the print-label endpoint.

New files:
- backend/app/core/printing/__init__.py
- backend/app/core/printing/zpl_templates.py — class ZPLTemplates with standard_label(data: dict) -> str
  producing the ZPL string per spec 9.1 (fields: internal_barcode, description, vendor_lot, quantity,
  unit, receive_date). Pure string building, no I/O.
- backend/app/core/printing/label_printer.py — class LabelPrinter: render(lot) -> zpl string by pulling
  the lot's fields; optional send_to_printer(zpl, printer_ip) that opens a TCP socket to
  settings.ZEBRA_PRINTER_IP:9100 (guard with try/except, do not fail the request if printing is unavailable).

Modify:
- backend/app/api/v1/receiving.py — replace the 501 /print-label stub: accept {lot_id}, load the lot,
  render ZPL, and return { success, zpl, printed: bool }. Only attempt the socket send when
  settings.ZEBRA_PRINTER_IP is set; otherwise return printed=false with the zpl string for preview.

Constraints: no DB change, no frontend change. Read settings via app.config.settings.

[貼上 spec §9 ZPL 模板整段]
```

## C. 影響
- A2：改 `core/warehouse/receiving.py`（+ e2e 種 PO）。
- A4：新增 `core/printing/*`、改 `api/v1/receiving.py`。

## D. 前置 / 驗證
```bash
cd ~/projects/wms && git add -A && git commit -m "checkpoint before A2/A4" && rm -rf .rag-index
# A2 驗證：先在 DB 種一張 PO（或讓 e2e 種），未對應 PO 的收貨應回 400；對應的應成功並累加 received_qty
# A4 驗證：POST /api/v1/receiving/print-label {lot_id} 應回 zpl 字串
cd backend && source .venv/bin/activate && python tests/test_e2e_flow.py
```
