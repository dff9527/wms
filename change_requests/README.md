# WMS × Pipeline B-Web — 分輪執行指南

把 `WMS_Development_Spec.md` 拆成 4 輪餵給 Pipeline B-Web 的完整工作包。

## 檔案清單

| 檔案 | 用途 |
|------|------|
| `round1_data_layer.md` | 第 1 輪：SQLAlchemy models + db/config |
| `round2_barcode_engine.md` | 第 2 輪：條碼解析引擎 + API + 前端掃描 |
| `round3_receiving_inventory.md` | 第 3 輪：收貨 + 庫存 + 前端串接 |
| `round4_picking_shipping_trace.md` | 第 4 輪：揀貨 FIFO/FEFO + 出貨 + 追溯 + 測試 |
| `schema.sql` | 從 spec §4.1 抽出的可執行建表 SQL（含 FIFO/FEFO 索引） |
| `seed_patterns.sql` | 5 家供應商 + 條碼規則種子資料（spec §5.1） |

另已補進專案：`backend/requirements.txt`（補齊 SQLAlchemy/anthropic 等缺漏依賴）、`backend/.env.example`。

## 執行順序

```bash
# 0) 一次性：環境準備
cd ~/projects/wms
cp backend/.env.example backend/.env        # 填入 CLAUDE_API_KEY / SECRET_KEY
docker compose -f docker/docker-compose.yml up -d db
psql postgresql://wms_user:wms_password@localhost:5433/wms_semiconductor -f change_requests/schema.sql
psql postgresql://wms_user:wms_password@localhost:5433/wms_semiconductor -f change_requests/seed_patterns.sql
cd backend && pip install -r requirements.txt   # pyzbar 需先 apt-get install libzbar0

# 1~4) 依序跑每一輪
#   - 開該輪的 .md，照 B 段把 change_request 連同 spec 對應章節原文貼進 Pipeline B-Web
#   - 跑完照 E 段自行驗證，git diff 確認後再 commit
```

每輪都依賴前一輪，**必須照順序**。Round 1 是地基。

## 三個務必記住的限制

1. **Pipeline B 不建表也不產 migration。** 所以 `schema.sql` 是資料庫的唯一真實來源，必須先手動跑。
2. **B-Web 是 TypeScript 導向**：`.py` 不進 RAG、`tsc/vitest` 不驗 Python。後端輪的 change_request 要附 spec 原文，產出後自己跑 `pytest` / `uvicorn` 驗證。
3. **每輪先開 branch + commit**（Pipeline 直接覆寫檔案、不出 PR）。

## ⚠️ 還沒處理、之後要補的缺口

- **Model ↔ schema.sql 漂移風險**：Pipeline B 改 ORM model 時不會同步改 DB。日後若加欄位，要自己手動 `ALTER TABLE`，否則 model 與實表會對不上。建議每輪後比對一次。
- **客戶主檔（第二階段）**：`sales_orders.customer_id` 目前沒有 FK 對應表，spec 標為第二階段。Round 4 出貨/裝箱單會用到 `customer_id`，先以整數佔位。
- **認證**：spec §7.1 有 `/auth/login`，但無實作細節。Round 1 的 `get_current_user` 只是 stub，正式上線前要補真正的 JWT 驗證（`python-jose` / `passlib` 已列入 requirements）。
- **標籤列印（spec §9 ZPL）**：Round 2 的 generator 只產 payload，實際 Zebra 印表機整合（`ZEBRA_PRINTER_IP`）尚未排入 4 輪，需要時另開一輪。
- **Redis / Celery**：spec 列為快取與任務佇列，目前 4 輪未使用，requirements 中標為選用。
