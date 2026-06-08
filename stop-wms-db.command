#!/bin/bash
# 雙擊停止 WMS Postgres（資料保留在 volume，不會刪）。
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
cd "$(dirname "$0")/docker"
echo "⏹ 停止 WMS Postgres ..."
docker compose stop db
echo "✅ 已停止（資料仍保留，下次雙擊 start 即可恢復）"
echo ""
echo "（此視窗可關閉）"
