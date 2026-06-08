# Stage C5 — 條碼規則管理頁（供應商規則庫）

> 對應 spec §1.2「供應商規則庫」、§5.3「AI 學習新格式」。
> 目標：operator 在一個新系統裡，能在 UI 上**新增供應商、查看/新增/停用條碼規則、貼樣本讓 AI 學習、即時測試解析**，不必再手動 INSERT SQL。
>
> ⚠️ 這一輪跟 C1–C4 不同：**需要後端先補端點**（Python，pipeline_b_web 不索引 .py）。所以分兩段：
> 1. **後端前置**（手動套用，或走能寫 Python 的路徑）
> 2. **前端 paste block**（給 pipeline_b_web 跑）
> 先做完後端前置並確認 `/api/v1/barcodes/patterns` 與 `/api/v1/vendors` 都通，再跑前端。

---

## 第 1 段：後端前置（手動／Python pipeline）

現況缺口：
- `app/api/v1/barcodes.py` 的 router **沒有掛進 `main.py`**（所以 `/api/v1/barcodes/*` 目前 404）。
- 沒有「列出供應商」端點（前端下拉現在是寫死的 TI/ST/ON，且 ON 對到 DB 的 ROHM，是錯的）。
- `/barcodes` 只有 AI `learn`，**沒有手動新增規則**的端點，也沒有停用規則。

需要新增/修改（只動這些，不要重構既有邏輯）：

### 1a. 掛上 barcodes router — `app/main.py`
```python
from app.api.v1.barcodes import router as barcodes_router
...
app.include_router(barcodes_router, prefix="/api/v1")   # 變成 /api/v1/barcodes/*
```
（注意 barcodes.py 內 router 已自帶 prefix="/barcodes"，所以這裡只加 /api/v1。）

### 1b. 新增供應商列表端點 — 新檔 `app/api/v1/vendors.py`
```
GET /api/v1/vendors -> [ {vendor_id, vendor_code, vendor_name, is_active} ]
```
- 直接 query `Vendor` model，依 vendor_id 排序。
- 掛進 main.py：`app.include_router(vendors_router, prefix="/api/v1")`。

### 1c. 手動新增 / 停用規則 — 擴充 `app/api/v1/barcodes.py` + service
新增端點：
```
POST   /api/v1/barcodes/patterns
       body { vendor_id, pattern_name, regex_rule, field_mapping(JSON), validation_rules(JSON, optional), priority(int, default 100) }
       行為：驗證 regex 可編譯（re.compile，不可編譯回 400）→ INSERT barcode_patterns(is_active=true) → 回新建的 row。
       回 { pattern_id, vendor_id, pattern_name, is_active }

PATCH  /api/v1/barcodes/patterns/{pattern_id}
       body { is_active: bool }
       行為：切換 is_active（停用/啟用）。回 { pattern_id, is_active }
```
- regex 一律 `re.compile()` 驗證，編不過回 400，**絕不**把未驗證字串存進 DB（避免 ReDoS / 解析時炸掉）。
- service 函式放 `app/services/barcode_service.py`：`create_pattern(db, payload)`、`set_pattern_active(db, pattern_id, is_active)`。
- 對應 schema 放 `app/schemas/barcode.py`：`CreatePatternRequest`、`PatternOut`。

### 1d. 後端驗收（端點都通才往下）
```bash
# vendors
curl -s localhost:8000/api/v1/vendors | python3 -m json.tool
# patterns 列表（barcodes router 已掛上）
curl -s localhost:8000/api/v1/barcodes/patterns | python3 -m json.tool
# 手動新增一條（測試用，之後可刪）
curl -s -X POST localhost:8000/api/v1/barcodes/patterns -H 'Content-Type: application/json' \
  -d '{"vendor_id":1,"pattern_name":"TEST_RULE","regex_rule":"^TEST(?P<part_number>\\d+)$","field_mapping":{"vendor_pn":"part_number"}}' \
  | python3 -m json.tool
```

---

## 第 2 段：前端頁面（複製整段給 pipeline_b_web）

```
Build a new "Barcode Rule Management" admin module for the semiconductor WMS frontend, and wire it into the top navigation. Backend is the source of truth — do NOT change backend code, do NOT invent endpoints beyond the ones listed.

Files to create/modify (only these):
- frontend/src/app/components/BarcodeRuleModule.tsx   (new — the page; default export)
- frontend/src/app/api/barcodes.ts                    (new — typed axios client)
- frontend/src/app/App.tsx                            (add one nav tab — see exact wiring below)

Nav wiring in App.tsx (it uses @radix-ui/react-tabs with TabsTrigger/TabsContent keyed by a string `value`; activeTab state already exists):
- import BarcodeRuleModule from './components/BarcodeRuleModule';
- import one more lucide-react icon, e.g. ScanLine, alongside the existing { Package, Warehouse, TruckIcon, Search, BarChart3 } import.
- Add a new <TabsTrigger value="barcode-rules" ...> labelled 條碼規則 with the icon, using the SAME className string as the other triggers.
- Add a matching <TabsContent value="barcode-rules" className="size-full p-0"><BarcodeRuleModule /></TabsContent>.
- Place the new tab last (after 追溯管理). Do NOT change the other tabs or the default activeTab.

API client convention (api/barcodes.ts) — match the other clients exactly:
- `const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';`
- one exported async function per endpoint, each wrapped in try/catch that rethrows with the backend `detail` message.

Backend endpoints + exact response shapes:
  GET   /api/v1/vendors
        -> [ {vendor_id, vendor_code, vendor_name, is_active} ]
  GET   /api/v1/barcodes/patterns?vendor_id=<optional>
        -> [ {pattern_id, vendor_id, pattern_name, regex_rule, field_mapping, validation_rules, priority, is_active} ]
  POST  /api/v1/barcodes/patterns
        body { vendor_id, pattern_name, regex_rule, field_mapping(object), validation_rules?(object), priority?(number) }
        -> { pattern_id, vendor_id, pattern_name, is_active }   (400 if regex invalid)
  PATCH /api/v1/barcodes/patterns/{pattern_id}
        body { is_active: boolean } -> { pattern_id, is_active }
  POST  /api/v1/barcodes/parse
        body { barcode, vendor_id } -> { vendor_pn, qty, lot_code, date_code, pattern_used }   (422 if no match)
  POST  /api/v1/barcodes/learn
        body { vendor_id, samples: string[], save_pattern: boolean }
        -> the inferred pattern result (503 if AI key missing — handle gracefully)

Layout (three sections on one page):
1. Vendor selector at top: a <select> populated from GET /api/v1/vendors (vendor_name as label, vendor_id as value). NEVER hardcode the vendor list. Selecting a vendor filters the patterns list and pre-fills vendor_id in the forms below.
2. Patterns table: rows from GET /api/v1/barcodes/patterns?vendor_id=. Columns: pattern_name, regex_rule (monospace, truncate with title tooltip), priority, is_active (badge). Each row has a toggle button that calls PATCH to flip is_active, then refetches.
3. Two tabs below the table:
   a. "手動新增規則": a form (pattern_name, regex_rule, field_mapping as a key/value editor or raw JSON textarea, optional priority) -> POST. On 400 show the backend detail (invalid regex) inline; on success clear form + refetch table.
   b. "AI 學習": a textarea for sample barcodes (one per line) + a "學習並儲存" button -> POST /learn with save_pattern=true; show the inferred regex; on 503 show "AI 服務未設定（缺 CLAUDE_API_KEY）" gracefully; on success refetch table.
4. Always-visible "測試解析" box at the bottom: one barcode input + the selected vendor_id -> POST /api/v1/barcodes/parse; show parsed fields on success, "此條碼不符合任何規則" on 422. Do NOT crash on non-2xx.

Rules:
- Status/boolean badges: normalize and always provide a fallback; never index a config map by a possibly-undefined key.
- All requests go to API_BASE_URL (import.meta.env.VITE_API_URL || 'http://localhost:8000'), same pattern as the other api/*.ts clients.
- Every axios call wrapped in try/catch; surface backend `detail` text, never a raw "Request failed with status code N".
- Do not require auth headers.
```

---

## 跑法（跟前面一致）
1. 先做完「第 1 段後端前置」，跑 1d 的 curl 全部通。
2. `cd ~/projects/wms && git add -A && git commit -m "checkpoint before C5"`
3. `rm -rf .rag-index` → launcher **Fresh Start** → 貼「第 2 段」整段。
4. 跑完開「條碼規則」分頁：選供應商→看規則列表→手動新增一條→測試解析→（有 key 的話）試 AI 學習。
5. 通過後 commit。
