# Round 2 — 條碼解析引擎 (Parser / Generator / Learner + API + 前端掃描)

> 餵給 Pipeline **B-Web**。依賴 Round 1 的 models。共通注意事項見 `round1_data_layer.md` 開頭 ⚠️。

---

## A. 現有專案摘要

- Round 1 已建立 `models/vendor.py`（含 `BarcodePattern`、`Vendor`、`VendorItem`）。
- 後端尚無 `core/`、`schemas/`、`services/barcode_service.py`、`api/v1/barcodes.py`。
- 前端尚無共用 `BarcodeScanner` 元件（spec §8.1 列為待建）。
- 本輪建立「條碼轉譯引擎」——本系統的核心特色（spec §1.3）。

---

## B. change_request spec（複製貼上）

```
Implement the barcode translation engine and its API, plus a frontend barcode scanner component. The SQLAlchemy models Vendor / BarcodePattern / VendorItem already exist in backend/app/models/vendor.py. Follow WMS spec sections 5.1–5.3.

New backend files:
- backend/app/core/barcode/__init__.py
- backend/app/core/barcode/parser.py — class BarcodeParser(db). parse(barcode, vendor_id): pick patterns by priority desc, regex match, extract via field_mapping, validate via validation_rules, convert K/M quantities via quantity_conversion. (Use the exact reference implementation in spec 5.2.)
- backend/app/core/barcode/generator.py — generate internal_barcode + ZPL-ready payload from a parsed lot (internal SKU + lot number); see spec 9.1 ZPLTemplates for the label fields.
- backend/app/core/barcode/learner.py — class PatternInferenceEngine(api_key) using the anthropic SDK to infer a regex rule + field_mapping from sample barcodes (spec 5.3). Read CLAUDE_API_KEY from settings.
- backend/app/schemas/barcode.py — pydantic: ScanRequest{barcode, vendor_id}, ParseResult{vendor_pn, qty, lot_code?, date_code?, pattern_used}, LearnRequest{vendor_name, samples[], manual_labels?}, LearnResult.
- backend/app/services/barcode_service.py — orchestrate parser + persistence of new patterns from learner.
- backend/app/api/v1/barcodes.py — router prefix /barcodes: POST /parse (single barcode), POST /learn (infer + optionally save pattern), GET /patterns?vendor_id=.

New frontend file:
- frontend/src/app/components/common/BarcodeScanner.tsx — controlled input that captures a scanned/typed barcode string and emits onScan(barcode); keyboard-wedge friendly (submit on Enter). Use existing shadcn Input/Button. No camera.

Modify:
- backend/app/main.py — register the barcodes router under /api/v1.

Behavior:
- parser must be data-driven (rules come from barcode_patterns table), not hard-coded per vendor.
- /parse returns 422 when no pattern matches.
- Do NOT generate a migration. Do NOT change the DB schema.

[在這裡貼上 spec 第 5.1、5.2、5.3 節整段（5 家供應商規則 + parser.py + learner.py），作為實作依據]
```

---

## C. 影響分析

- **新增後端**：`core/barcode/*`（4）、`schemas/barcode.py`、`services/barcode_service.py`、`api/v1/barcodes.py`（共 ~7）。
- **新增前端**：`components/common/BarcodeScanner.tsx`（1）。
- **修改**：`main.py`（註冊路由）。
- **依賴**：Round 1 models。`learner.py` 需 `anthropic` 套件與 `CLAUDE_API_KEY`。
- **下游**：Round 3 收貨流程會用 `BarcodeParser` 與 `BarcodeScanner`。

---

## D. 安全建議 + 種子資料

```bash
cd ~/projects/wms
git checkout -b feature/round2-barcode-engine
git add -A && git commit -m "checkpoint before round2"

# 確認 requirements 有 anthropic / pyzbar（spec §2.1），缺則補
# backend/.env 需有 CLAUDE_API_KEY

# 種入 5 家供應商與條碼規則（Pipeline 不會自動 seed）
# 依 spec §4.1 第 8 節 + §5.1 的 5 條 regex，寫成 seed_patterns.sql 後：
psql postgresql://wms_user:wms_password@localhost:5432/wms_semiconductor -f seed_patterns.sql
```

> 安全提醒：`regex_rule` 來自資料表，`parser.py` 用 `re.match` 動態套用。種入規則時避免不受信任來源的 regex（ReDoS 風險）；`learner.py` 產出的規則先人工 review 再存。

---

## E. 執行指令

```bash
cd ~/projects/ai-pipeline-v8 && source .venv/bin/activate
python run.py b-web '（貼上 B 段 change_request）' ~/projects/wms
```

**自行驗證**：

```bash
cd ~/projects/wms/backend
# 用 spec §5.1 的範例條碼測 TI 規則
python -c "
from app.db.session import SessionLocal
from app.core.barcode.parser import BarcodeParser
db=SessionLocal()
print(BarcodeParser(db).parse('1PTPS54331DRCR1T30009D2024W15', vendor_id=1))
"
# 前端：npm run dev 後確認 BarcodeScanner 可掛載、Enter 觸發 onScan
```

---

## 子批次（可選）

- **2a 後端引擎**：`core/barcode/*` + `schemas/barcode.py` + `services/barcode_service.py` + `api/v1/barcodes.py` + `main.py`
- **2b 前端**：`BarcodeScanner.tsx`（B-Web 在此最擅長，驗證完整）
