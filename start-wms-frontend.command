#!/bin/bash
# 雙擊啟動 WMS 前端畫面（http://localhost:5173）。關閉視窗即停止。
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
# 若用 nvm 安裝 node，載入它
[ -s "$HOME/.nvm/nvm.sh" ] && . "$HOME/.nvm/nvm.sh"
cd "$(dirname "$0")/frontend"

if ! command -v npm >/dev/null 2>&1; then
  echo "❌ 找不到 npm/node —— 請先安裝 Node.js（或確認 nvm 已設定）。"
  echo "（此視窗可關閉）"; exit 1
fi

if [ ! -d node_modules ]; then
  echo "📦 首次啟動 — 安裝前端套件 (npm install)，請稍候 ..."
  npm install
fi

echo "▶ 啟動 WMS 前端 → http://localhost:5173"
echo "   要看畫面：瀏覽器開 http://localhost:5173"
echo "   要停止：直接關閉這個視窗，或按 Ctrl+C"
echo ""
exec npm run dev
