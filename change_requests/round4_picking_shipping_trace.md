# Round 4 — 揀貨 FIFO/FEFO + 出貨 + 追溯 (Engine + API + Tests + 前端串接)

> 餵給 Pipeline **B-Web**。依賴 Round 1–3。共通注意事項見 `round1_data_layer.md` 開頭 ⚠️。

---

## A. 現有專案摘要

- Round 1–3 已備妥 models、`InventoryLot` 寫入、收貨/庫存 API。
- 前端 `PickingModule.tsx`、`TraceabilityModule.tsx` 為殼，尚無 `picking/AllocationResult.tsx`。
- 本輪完成系統核心價值：FIFO/FEFO 配貨、出貨裝箱單（FIFO 證明）、雙向追溯。

---

## B. change_request spec（複製貼上）

```
Implement picking (FIFO/FEFO allocation), shipping, and traceability, with API + unit tests, and wire the frontend Picking/Traceability modules. Models and inventory writes exist from rounds 1–3. Follow WMS spec sections 6.3, 6.4, 6.5, 7.1, and appendix A tests.

New backend files:
- backend/app/core/warehouse/picking.py — class PickingEngine(db): allocate_lots_for_so(so_number) → per SO line, get available lots (filter status/qty/expiry/customer AVL), sort by strategy (FIFO=receive_date, FEFO=expiry_date, CUSTOMER_SPECIFIED→FIFO), create PickTasks, reserve qty; generate_pick_wave(picker?) path-optimized by location_code; confirm_pick(task_id, picked_qty, picker) → decrement on-hand, release reserve, write PICK transaction. Use the exact reference implementation in spec 6.3.2.
- backend/app/core/warehouse/shipping.py — class ShippingService(db): confirm_shipment(so_number, shipper) (requires all lines picked), generate_packing_list(so_number) (lots in FIFO order = proof). Spec 6.4.
- backend/app/core/traceability/__init__.py
- backend/app/core/traceability/tracer.py — class TraceabilityEngine(db): trace_forward(vendor_lot/internal) supplier→customer, trace_backward(internal_barcode) internal→original vendor barcode. Spec 6.5; can query the traceability_chain view.
- backend/app/schemas/picking.py, backend/app/schemas/shipping.py — request/response DTOs.
- backend/app/api/v1/picking.py — /picking: POST /allocate, GET /wave, POST /confirm, GET /tasks.
- backend/app/api/v1/shipping.py — /shipping: POST /confirm, GET /packing-list/{so_number}, GET /pending.
- backend/app/api/v1/traceability.py — /trace: GET /forward, GET /backward.
- backend/tests/test_fifo_picking.py — port spec appendix A.1 (test_fifo_basic, test_fefo_with_expiry).

New frontend files:
- frontend/src/app/components/picking/AllocationResult.tsx — render allocation_details (lot, qty, receive_date, location) per spec 6.3.5, using existing shadcn components instead of raw Tailwind divs.

Modify backend:
- backend/app/main.py — register picking, shipping, traceability routers.

Modify frontend:
- frontend/src/app/components/PickingModule.tsx — call POST /api/v1/picking/allocate, show AllocationResult; list pick wave.
- frontend/src/app/components/TraceabilityModule.tsx — call /api/v1/trace/forward + /backward, render the chain.

Behavior:
- FIFO/FEFO sorting is the core invariant — earliest receive_date / earliest expiry_date first; lots with no expiry sort last in FEFO; expired lots excluded.
- packing list lot order MUST equal FIFO order.
- Do NOT generate a migration. The FIFO/FEFO indexes (spec 6.3.4) are created manually via SQL (see D).

[在這裡貼上 spec §6.3.2（picking.py）、§6.4（shipping.py）、§7.1 路由、附錄 A.1 測試碼整段，作為實作依據]
```

---

## C. 影響分析

- **新增後端**：`core/warehouse/{picking,shipping}.py`、`core/traceability/tracer.py`、`schemas/{picking,shipping}.py`、`api/v1/{picking,shipping,traceability}.py`、`tests/test_fifo_picking.py`（~9）。
- **新增前端**：`picking/AllocationResult.tsx`。
- **修改**：`main.py`、`PickingModule.tsx`、`TraceabilityModule.tsx`。
- ⚠️ 接近 10 檔，**建議拆 4a 後端 / 4b 前端**。
- **依賴**：本輪需 `sales_orders/so_lines/pick_tasks`（Round 1 已建 model，但**DB 表與索引要先手動建**，見 D）。

---

## D. 安全建議 + FIFO/FEFO 索引

```bash
cd ~/projects/wms
git checkout -b feature/round4-picking-shipping-trace
git add -A && git commit -m "checkpoint before round4"

# 建 FIFO/FEFO 查詢索引（spec §6.3.4，Pipeline 不會建）
psql postgresql://wms_user:wms_password@localhost:5432/wms_semiconductor <<'SQL'
CREATE INDEX IF NOT EXISTS idx_inventory_fifo ON inventory_lots(internal_sku, receive_date) WHERE lot_status='AVAILABLE';
CREATE INDEX IF NOT EXISTS idx_inventory_fefo ON inventory_lots(internal_sku, expiry_date) WHERE lot_status='AVAILABLE' AND expiry_date IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_inventory_vendor_sku ON inventory_lots(vendor_id, internal_sku) WHERE lot_status='AVAILABLE';
SQL
```

> Debug 提醒（呼應 briefing）：附錄 A 的測試是 FIFO/FEFO 行為的 oracle。若 Pipeline 的 debug 迴圈想改測試來「過關」，請確認它沒有違反「最早收貨/到期先出」這個 domain invariant——該修的是 production code，不是 test。

---

## E. 執行指令

```bash
cd ~/projects/ai-pipeline-v8 && source .venv/bin/activate
python run.py b-web '（貼上 B 段 change_request，或子批次版本）' ~/projects/wms
```

**自行驗證**（B-Web 不跑 pytest）：

```bash
cd ~/projects/wms/backend && pytest tests/test_fifo_picking.py -v   # 須全綠
uvicorn app.main:app --reload                                       # 測 /picking/allocate、/shipping/packing-list
cd ~/projects/wms/frontend && npm run dev                           # Picking 顯示 AllocationResult、Traceability 顯示追溯鏈
```

---

## 子批次（建議照此拆）

- **4a 後端**：`core/warehouse/{picking,shipping}.py`、`core/traceability/tracer.py`、`schemas/*`、`api/v1/{picking,shipping,traceability}.py`、`tests/test_fifo_picking.py`、`main.py`
- **4b 前端**：`picking/AllocationResult.tsx`、`PickingModule.tsx`、`TraceabilityModule.tsx`
