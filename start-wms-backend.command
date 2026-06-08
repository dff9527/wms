#!/bin/bash
# 雙擊啟動 WMS 後端 API（http://localhost:8000）。關閉視窗即停止。
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
cd "$(dirname "$0")/backend"

if [ ! -x .venv/bin/uvicorn ]; then
  echo "❌ 找不到 backend/.venv —— 請先建立虛擬環境並安裝套件。"
  echo "（此視窗可關閉）"; exit 1
fi

# 釋放被占用的 8000，避免 address already in use
lsof -ti :8000 | xargs kill -9 2>/dev/null || true

echo "▶ 啟動 WMS 後端 → http://localhost:8000  （API 文件: /docs）"
echo "   連線資料庫: 5434（確認已雙擊 start-wms-db）"
echo "   要停止：直接關閉這個視窗，或按 Ctrl+C"
echo ""
exec .venv/bin/uvicorn app.main:app --port 8000 --reload
