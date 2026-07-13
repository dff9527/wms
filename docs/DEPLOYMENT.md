# WMS 部署

## 必要環境變數

- `SECRET_KEY`：JWT 簽章密鑰。`DEBUG=false` 時不可使用預設值，否則服務會在啟動階段以 `RuntimeError` 終止。
- `DEBUG`：本機預設 `true`；正式環境設為 `false`。
- `CORS_ORIGINS`：允許的前端 origin，以逗號分隔，例如 `https://wms.example.com,https://admin.example.com`。
- `DATABASE_URL`：PostgreSQL 連線字串。

## 資料庫備份

主機需安裝與 PostgreSQL 相容的 `pg_dump`。備份腳本使用 custom format，預設寫入專案的 `backups/`，並自動只保留最新 14 份：

```bash
DATABASE_URL='postgresql://user:password@db:5432/wms' \
BACKUP_DIR='/var/backups/wms' \
./scripts/backup_db.sh
```

cron 每天 02:15 執行範例（將輸出與錯誤交給 syslog/cron mail）：

```cron
15 2 * * * cd /opt/wms && DATABASE_URL='postgresql://user:password@db:5432/wms' BACKUP_DIR='/var/backups/wms' ./scripts/backup_db.sh
```

密碼不應直接留在共用 crontab；正式環境可使用權限為 `0600` 的環境檔或 PostgreSQL `.pgpass`。

## 資料庫還原

還原前先停止會寫入資料庫的 backend，並確認目標資料庫正確。custom format 以 `pg_restore` 還原：

```bash
pg_restore \
  --clean \
  --if-exists \
  --no-owner \
  --no-acl \
  --dbname='postgresql://user:password@db:5432/wms' \
  /var/backups/wms/wms_20260713_021500.dump
```

還原完成後執行 `alembic upgrade head`，再啟動 backend 並檢查 `/health`。
