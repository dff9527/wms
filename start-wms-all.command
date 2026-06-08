#!/bin/bash
# 一鍵啟動整個 WMS：資料庫 + 後端 + 前端，各自開一個終端機視窗，最後自動開瀏覽器。
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
DIR="$(dirname "$0")"

echo "🚀 啟動 WMS 全部服務 ..."

echo "  1/3 資料庫 (5434) ..."
open "$DIR/start-wms-db.command"
sleep 8                     # 等 DB 起來

echo "  2/3 後端 API (8000) ..."
open "$DIR/start-wms-backend.command"
sleep 4

echo "  3/3 前端 (5173) ..."
open "$DIR/start-wms-frontend.command"
sleep 6                     # 等 vite 編譯

echo "🌐 開啟瀏覽器 http://localhost:5173"
open "http://localhost:5173"

echo ""
echo "✅ 三個服務各自在獨立視窗啟動中。"
echo "   若瀏覽器顯示空白，等幾秒前端編譯完成後重新整理即可。"
echo "（此視窗可關閉，服務在另外三個視窗繼續跑）"
