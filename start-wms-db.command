#!/bin/bash
# 雙擊啟動 WMS Postgres（port 5434）。第一次啟動會自動建表 + 種子資料。
set -e
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
cd "$(dirname "$0")/docker"

echo "▶ 啟動 WMS Postgres (localhost:5434) ..."
docker compose up -d db

echo "⏳ 等待資料庫就緒 ..."
until docker compose exec -T db pg_isready -U wms_user -d wms_semiconductor >/dev/null 2>&1; do
  sleep 1
done

# 只有在 vendors 表不存在（=空 DB）時才初始化，避免重跑報錯
HAS_SCHEMA=$(docker compose exec -T db psql -U wms_user -d wms_semiconductor -tAc \
  "SELECT to_regclass('public.vendors') IS NOT NULL;" 2>/dev/null | tr -d '[:space:]')

if [ "$HAS_SCHEMA" != "t" ]; then
  echo "🌱 首次啟動 — 載入 schema + 種子資料 ..."
  docker compose exec -T db psql -v ON_ERROR_STOP=1 -U wms_user -d wms_semiconductor < ../change_requests/schema.sql
  docker compose exec -T db psql -v ON_ERROR_STOP=1 -U wms_user -d wms_semiconductor < ../change_requests/stage_A3_A6_tables.sql
  docker compose exec -T db psql -v ON_ERROR_STOP=1 -U wms_user -d wms_semiconductor < ../change_requests/seed_patterns.sql
  echo "✅ 初始化完成（vendors + barcode_patterns + users/customers 表）"
else
  echo "✅ 資料庫已有資料，略過初始化"
fi

echo ""
echo "✅ WMS DB 就緒：postgresql://wms_user:wms_password@localhost:5434/wms_semiconductor"
echo "   後端 backend/.env 已指向 5434，直接啟動 uvicorn 即可。"
echo ""
echo "（此視窗可關閉）"
