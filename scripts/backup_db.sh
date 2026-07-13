#!/usr/bin/env bash
set -euo pipefail

backup_dir="${BACKUP_DIR:-$(pwd)/backups}"
database_url="${DATABASE_URL:-postgresql://wms_user:wms_password@localhost:5433/wms_semiconductor}"
timestamp="$(date +%Y%m%d_%H%M%S)"
backup_file="${backup_dir}/wms_${timestamp}.dump"

mkdir -p "$backup_dir"
pg_dump --format=custom --no-owner --no-acl --file="$backup_file" "$database_url"

# 只保留依檔名排序後最新的 14 份 WMS 備份。
mapfile_supported=false
if type mapfile >/dev/null 2>&1; then
  mapfile_supported=true
fi

if "$mapfile_supported"; then
  mapfile -t old_backups < <(find "$backup_dir" -maxdepth 1 -type f -name 'wms_*.dump' -print | sort -r | tail -n +15)
  if ((${#old_backups[@]})); then
    rm -- "${old_backups[@]}"
  fi
else
  find "$backup_dir" -maxdepth 1 -type f -name 'wms_*.dump' -print \
    | sort -r \
    | tail -n +15 \
    | while IFS= read -r old_backup; do rm -- "$old_backup"; done
fi

printf '%s\n' "$backup_file"
