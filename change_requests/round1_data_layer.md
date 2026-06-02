# Round 1 — 資料層基礎 (SQLAlchemy Models + DB Infra)

> 餵給 Pipeline **B-Web**。這是後端 Python 輪，請先讀「⚠️ 全輪共通注意事項」。

---

## ⚠️ 全輪共通注意事項（每輪都適用）

1. **Pipeline B 不產 DB migration。** 它只會寫 ORM model 程式碼，不會幫你建表。每一輪動到資料庫前，**先手動把對應的 `CREATE TABLE` SQL 跑進 PostgreSQL**（本輪見下方 D 段）。
2. **B-Web 的 RAG 索引與驗證是針對 TypeScript**（索引 `.ts/.tsx/.js/.jsx`，驗證 `tsc + vitest`）。`.py` 不會進 RAG，`tsc/vitest` 也不會驗 Python。因此後端輪的 change_request **直接附上 spec 對應章節原文**補足 RAG，且產出後**自行跑 `pytest` / 啟動 FastAPI 驗證**，不要倚賴 Pipeline 的 validate 節點。
3. **每輪執行前先開 branch + commit**（見 D 段）。
4. **檔案數控制 1–10**。若 Planner 認為過多，依本檔「子批次」建議再切。

---

## A. 現有專案摘要（給 Pipeline 確認）

- **Tech stack**：後端 FastAPI（Python 3.11），前端 Vite + React + TS + shadcn/MUI。
- **後端現況**：`backend/app/` 只有 `main.py` 與 `api/v1/receiving.py`（stub）。**沒有 models、db、config、services、core**。
- **前端現況**：`frontend/src/app/` 已有各模組殼（Receiving 有 List/Detail + typed client + React Query；Picking/Inventory/Traceability/Dashboard 為殼）。
- 本輪**只動後端**，建立全系統的資料層基礎，是後續所有輪的依賴。

---

## B. change_request spec（複製貼上給 Pipeline B-Web）

```
Build the SQLAlchemy data layer and DB infrastructure for the FastAPI backend. Backend currently only has app/main.py and app/api/v1/receiving.py — there are no models, db session, or config yet. Create them per the WMS spec section 4.1 (PostgreSQL schema).

New files:
- backend/app/db/base.py — SQLAlchemy declarative Base + metadata
- backend/app/db/session.py — engine + SessionLocal from DATABASE_URL, get_db() dependency
- backend/app/config/settings.py — pydantic Settings reading DATABASE_URL, REDIS_URL, CLAUDE_API_KEY, SECRET_KEY from .env
- backend/app/api/deps.py — get_db (re-export) + get_current_user stub
- backend/app/models/__init__.py — import all models so Base.metadata is complete
- backend/app/models/warehouse.py — Warehouse, StorageLocation, LocationStatus
- backend/app/models/item.py — Item
- backend/app/models/vendor.py — Vendor, BarcodePattern, VendorItem
- backend/app/models/inventory.py — InventoryLot
- backend/app/models/transaction.py — InventoryTransaction
- backend/app/models/order.py — PurchaseOrder, POLine, SalesOrder, SOLine, PickTask

Modify:
- backend/app/main.py — import models package so metadata loads; keep existing receiving router registration

Requirements / behavior:
- Map EVERY column, type, CHECK constraint, default, FK, and the GENERATED quantity_available column exactly as defined in the SQL schema below. Use SQLAlchemy 2.0 style (Mapped / mapped_column).
- inventory_lots.quantity_available is a STORED generated column — map it as a read-only Column(Computed(...)) or a non-writable attribute; do not let the ORM try to INSERT it.
- self-referential FKs: storage_locations.parent_location_id, inventory_lots.parent_lot_id.
- Use JSONB for contact_info, field_mapping, validation_rules, quantity_conversion, customer_avl, raw_scan_data.
- Do NOT generate any Alembic migration file (the DB schema is created manually via SQL).
- Do NOT touch the frontend.

[在這裡貼上 spec 第 4.1 節「完整 Schema (PostgreSQL)」整段 SQL，從 CREATE EXTENSION 到第 8 節初始資料，作為欄位定義的唯一依據]
```

> 註：把 spec §4.1 的 SQL 整段貼進上面標示處，Pipeline 才能精準對齊欄位（RAG 索引不到 spec）。

---

## C. 影響分析

- **新增**：`db/`, `config/`, `models/` 共約 10 個檔；`api/deps.py`。
- **修改**：`main.py`（只加 import，不動既有路由）。
- **不影響**：前端、既有 `receiving.py` 路由。
- **下游依賴**：Round 2–4 全部依賴本輪的 models，必須先完成。

---

## D. 安全建議 + 先建 DB

```bash
cd ~/projects/wms
git checkout -b feature/round1-data-layer
git add -A && git commit -m "checkpoint before round1"

# 1) 啟動 DB（spec 第 10 節 docker-compose 已有 db 服務）
docker compose -f docker/docker-compose.yml up -d db

# 2) 手動建表：把 spec 第 4.1 節整段 SQL 存成 schema.sql 後執行
#    （Pipeline B 不會幫你做這步）
psql postgresql://wms_user:wms_password@localhost:5433/wms_semiconductor -f schema.sql
```

---

## E. 執行指令

```bash
# Streamlit：開 launcher → 選 B-Web → 專案路徑填 ~/projects/wms → 貼上 B 段 change_request → Run
cd ~/projects/ai-pipeline-v8
.venv/bin/streamlit run launcher.py

# 或 CLI：
cd ~/projects/ai-pipeline-v8
source .venv/bin/activate
python run.py b-web '（貼上 B 段 change_request）' ~/projects/wms
```

**產出後自行驗證**（B-Web 不驗 Python）：

```bash
cd ~/projects/wms/backend
python -c "from app.models import *; from app.db.base import Base; print(len(Base.metadata.tables), 'tables mapped')"
```

預期印出表數（warehouses、storage_locations、location_status、items、vendors、barcode_patterns、vendor_items、inventory_lots、inventory_transactions、purchase_orders、po_lines、sales_orders、so_lines、pick_tasks）。

---

## 子批次（若 Planner 嫌檔案多，可拆兩次跑）

- **1a**：`db/base.py`、`db/session.py`、`config/settings.py`、`api/deps.py`、`models/__init__.py`、`models/warehouse.py`、`models/item.py`、`models/vendor.py`
- **1b**：`models/inventory.py`、`models/transaction.py`、`models/order.py` + `main.py` import
