# WMS 全面 Review 報告

> 日期:2026-07-13。基準:現有 codebase(K1 commit `40db3c4`)+ `REMAINING_WORK.md` + 競品/整合公開資料。
> 四個面向:①功能缺口 ②正航/ERP 串接規劃 ③競品比較 ④Senior UX/UI review。

---

## 1. 功能缺口分析(依優先序)

以下為**實際掃描 codebase 確認**的缺口(非僅文件推測):

### P0 — 核心倉儲功能缺漏(競品標配、我們沒有)

| 缺口 | 現況證據 | 建議 |
|---|---|---|
| **盤點(Cycle Count / 全盤)** | backend 完全無盤點相關 API/邏輯(spec 1.2 有列但未實作) | 新增 `cycle_counts` 表 + 盤點單流程:凍結儲位 → 盲盤輸入 → 差異審核(supervisor)→ 產生 ADJUST 交易。這是 ERP 串接的前置(盤點結果要回拋) |
| **移倉/儲位調撥(Transfer)** | API 層無 transfer/調撥端點;上架後儲位無法異動,只能 adjust 歸零再收一次(會破壞追溯鏈) | 新增 `POST /inventory/lots/{id}/move`:驗證目標儲位規則(沿用 putaway 的 ESD/MSL/隔離檢核)+ 寫 MOVE 交易 |
| **退貨流程(客退 RMA / 退供應商)** | 無任何 return 相關路由 | 客退:入隔離區 + 重新 IQC;退供:出庫交易 + 追溯標記。半導體零件商客退驗真(AS6496 授權通路完整監管鏈)是加分項 |
| **補貨(Replenishment)** | 無 | 揀貨區 min/max 觸發補貨任務(若目前是單一揀貨區可延後) |

### P1 — REMAINING_WORK 既列且應完成(正式上線門檻)

- **MSL 拆封後 floor life**(A1):`bag_opened_at` + 依 MSL 等級重算 + bake 重置。這是半導體 WMS 的核心賣點,目前只做到密封 12 個月,**差異化尚未完整**。
- **儲位容量檢核**(A2)、**換標正式欄位/重印作廢管理**(A3/A4)、**ZPL 實機驗證**。
- **Docker 部署實測**、**anthropic SDK 版本同步**、**admin 改自己密碼端點**。
- **K 系列權限基線**:`barcodes.py` 曾完全無 auth(K0),main.py 現已掛 `get_current_user`,但 K2+ 各模組編輯/刪除仍待補。

### P2 — 系統面缺口(codebase 掃描新發現)

| 缺口 | 說明 |
|---|---|
| **無 DB migration 機制** | spec 寫 alembic,實際 `backend/alembic` 不存在,真相是手動維護 `schema.sql`。上線後 schema 演進(A1/A2 都要加欄位)會很痛,建議盡早導入 alembic 並以現有 schema 做 baseline |
| **無稽核/報表 UI** | 交易記錄有寫(RECEIVE/PUT_AWAY/SHIP…)但沒有查詢介面;trace forward 的 `poNumber`/`shipDate` 仍空字串 |
| **無告警機制** | 即將到期批次(FEFO 有算 expiry_date)、MSL 超時、庫存低於安全量——資料都在,缺主動通知(Dashboard 卡片/email) |
| **Redis/Celery 掛名未用** | 標籤列印佇列、AI 學習非同步化、未來 ERP 拋轉重試都是合理用途;若短期不用建議先從 requirements 移除 |
| **後端全量回傳** | `/inventory/lots` 無分頁,lot 數量成長後前端會拖垮(見 UX 章節) |

---

## 2. ERP 串接規劃(正航優先、其他 ERP 可替換)

### 2.1 正航提供的介接方式(官方資料)

正航 ERP 與 WMS 以 **webservice 無縫接軌**,官方支援三種方式:
1. **API 直接串接**:JSON 格式,系統接收後回饋處理成功與否(T 系列/T8/T9)。
2. **Excel 匯入匯出 + 自動拋轉**:針對無 API 的模組,設定間隔時間自動匯入。
3. **資料庫直連**:開放 DB 權限直接讀寫,綁定主機 IP 控管資安。

正航官方的 ERP↔WMS 整合範圍:採購收貨、收貨檢驗入庫、儲位間調撥、盤點——**注意:調撥與盤點正是我們 P0 缺口,不先補齊就沒有東西可以跟 ERP 對接**。

### 2.2 建議架構:Adapter Pattern + Outbox

```
backend/app/integrations/
├── base.py          # ERPAdapter 抽象介面(不綁死正航)
├── chi/             # ChiERPAdapter(正航,第一個實作)
│   ├── client.py    # JSON webservice client
│   └── mapping.py   # 欄位對應(正航單別/單號 ↔ WMS)
└── sync/
    ├── inbound.py   # ERP → WMS:採購單、品號主檔、供應商、銷售訂單
    ├── outbound.py  # WMS → ERP:收貨回拋、出貨回拋、調整/盤點回拋
    └── outbox.py    # 事件外送表(重試、冪等)
```

**資料流向設計**(業界標準做法):

| 方向 | 單據 | 觸發 | 備註 |
|---|---|---|---|
| ERP → WMS | 採購單(PO) | 排程輪詢或 ERP 拋轉 | 取代目前手建 PO;`purchase_orders` 加 `erp_doc_no` |
| ERP → WMS | 品號/供應商/客戶主檔 | 每日同步 + 差異更新 | **主檔以 ERP 為準**(master data governance),WMS 只補倉儲屬性(MSL、ESD、AVL) |
| ERP → WMS | 銷售訂單(SO) | 即時 | 取代手建 SO |
| WMS → ERP | 收貨單(GRN) | IQC PASS 後 | 帶 lot 明細 |
| WMS → ERP | 出貨確認 | ship 完成後 | 帶批號 → ERP 開發票/銷貨單 |
| WMS → ERP | 庫存調整/盤點差異 | 審核後 | 會計科目影響大,務必走審核 |

**落地要點**:
- **Outbox pattern**:業務交易與「待拋轉事件」同 transaction 寫入,背景 worker(這裡 Celery 就有用了)重試拋轉,失敗進 dead-letter 人工處理。避免「WMS 出貨了但 ERP 沒收到」的資料不一致。
- **冪等鍵**:每筆拋轉帶 WMS 交易 ID,ERP 端重複收到不重複入帳;反向同理。
- **對帳報表**:每日 WMS 庫存 vs ERP 庫存差異表,是導入期活下來的關鍵。
- **不要選 DB 直連**:正航雖提供,但版本升級即斷、無驗證層,只當最後手段。
- 現有 schema 幾乎不用大改:PO/SO/交易表都在,主要是加 `erp_doc_no`/`erp_synced_at` 欄位 + outbox 表。

### 2.3 需要跟正航確認的問題清單

1. 客戶用的正航版本(T8/T9/一號)?API 授權是否另計價?
2. PO/SO 是否支援「ERP 主動推送」還是只能 WMS 輪詢?
3. 收貨/出貨回拋對應正航哪張單別?批號欄位長度限制(我們內部批號格式要相容)?
4. 品號主檔異動通知機制(新品號/停用)?
5. 測試環境(沙盒帳套)能否提供?

---

## 3. 競品比較

### 3.1 定位圖

| 產品 | 定位 | 與本系統關係 |
|---|---|---|
| **鼎新 WMS**(digiwin) | 台灣製造業主流,強在 ERP(Workflow/TIPTOP)生態、PDA 掃碼、電子標籤、供應商協同 | 最直接競品:客戶若已用鼎新 ERP 幾乎會被綁定 |
| **正航 WMS 模組** | 與正航 ERP webservice 整合,涵蓋收貨/檢驗/調撥/盤點 | 微妙:既是串接對象也是競品。我們的價值主張=「比原廠模組更懂半導體零件」 |
| **EasyWare、集志、瑞高 iWMS、天心** | 台灣通用型 WMS,條碼/RFID/PDA 為主 | 功能廣但無半導體 domain 深度 |
| **NetSuite WMS / RF-SMART** | 雲端 ERP 內建 WMS,wave picking、cycle count、mobile RF 完整 | 功能基準線參考 |
| **Manhattan / Blue Yonder** | 大型 3PL/零售級 | 非同一量級,不需對標 |

### 3.2 功能矩陣(✅有 △部分 ✗無)

| 功能 | 本系統 | 鼎新/正航等台系 | NetSuite 級 |
|---|---|---|---|
| 條碼轉譯引擎(一物多碼) | ✅ **獨有核心** | ✗(單一標準碼) | ✗ |
| AI 學習新供應商條碼格式 | ✅ **獨有** | ✗ | ✗ |
| MSL/FEFO/過期批次管控 | △(密封期有、floor life 無) | ✗~△ | △ |
| 客戶 AVL 配貨過濾 | ✅ 差異化 | ✗ | ✗ |
| 正逆向批號追溯 | ✅ | △ | △ |
| 強制換標 + ESD 管控 | ✅ 差異化 | ✗ | ✗ |
| 盤點 | ✗ | ✅ | ✅ |
| 儲位調撥 | ✗ | ✅ | ✅ |
| PDA/行動裝置作業 | ✗(桌面網頁) | ✅(核心賣點) | ✅ |
| Wave/批次揀貨 | △(有 wave 概念、無多單合波) | △ | ✅ |
| 補貨/RMA | ✗ | △ | ✅ |
| KPI 儀表板/報表 | △(Dashboard 半數卡片「尚未提供」) | ✅ | ✅ |
| ERP 整合 | ✗(本次規劃) | ✅ 原生 | ✅ 原生 |
| 電子標籤(PTL)/RFID | ✗ | ✅ | △ |

### 3.3 策略結論

**護城河明確**:條碼轉譯 + AI 學習 + MSL/AVL/換標,是所有台系競品都沒有的半導體 domain 深度——行銷與 demo 應該全壓在這裡。
**短板也明確**:盤點、調撥、PDA、報表是客戶評估 WMS 的「入場券」,沒有會直接被踢出比較清單。優先順序建議:**盤點 → 調撥 → ERP 串接 → PDA 響應式介面 → 報表**。PTL/RFID 屬硬體綁定,除非客戶指名不必先做。

---

## 4. Senior UX/UI Review

### 4.1 資訊架構與導航(影響最大)

1. **頂部 Tabs 已達 8 個,不可擴展**:加上盤點/調撥/報表後必然溢出。建議改**左側 sidebar**(`components/ui/sidebar.tsx` 已存在未用),並分組:作業(收貨/庫存/揀貨)、查詢(追溯/報表)、設定(條碼規則/客戶/使用者)。
2. **無 URL 路由**:`react-router-dom` 在 package.json 但 App.tsx 用 `useState('dashboard')` 管 tab——重新整理回總覽、無法把「這批貨的追溯結果」用連結傳給同事、瀏覽器返回鍵失效。改用 router 管 tab + 查詢參數(如 `/trace?lot=xxx`)。
3. **Icon 語意錯誤**:客戶管理用 `Package`(與收貨重複)、使用者管理用 `Search`。應為 `Users`/`UserCog`、客戶用 `Building2`。

### 4.2 倉儲作業場景適配(WMS 特有、最關鍵)

4. **桌面優先 vs 現場作業矛盾**:收貨/揀貨/上架的實際使用者拿的是 PDA 或平板+掃描槍。競品全都主打 PDA。短期:針對收貨/揀貨頁做響應式+大觸控目標(≥44px)+**掃描框自動聚焦、掃描後自動送出**;長期:獨立的行動作業介面(scan-first、單手操作、每步驟聲音/震動回饋)。
5. **掃描錯誤回饋**:現場環境吵雜、人員不會盯螢幕,解析失敗只有畫面文字不夠——需要聲音提示(成功/失敗不同音)+ 全螢幕色塊閃爍。
6. **鍵盤動線**:桌面掃描槍模擬鍵盤輸入,所有作業表單應支援 Enter 逐欄推進、不需碰滑鼠。

### 4.3 資料呈現與效能

7. **庫存表無分頁/虛擬捲動**:`InventoryModule` 全量抓 lots、前端過濾。千筆以上會卡。後端加分頁+搜尋參數,前端用 server-side pagination(`ui/pagination.tsx` 已存在)。
8. **無欄位排序**:庫存/PO 清單皆無 column sort;倉庫人員常要「照收貨日排」找最舊批次。
9. **Dashboard 誠實但空洞**:「尚未提供」虛線卡片(今日收貨、趨勢、最近活動)在 demo 給客戶看時是扣分項。資料其實都在 `inventory_transactions`,補 3 個彙總端點即可全部點亮——**投報率最高的一項**。

### 4.4 一致性與回饋

10. **Toast 只有 ReceivingModule 用**:其他模組成功/失敗用 inline 文字或 dialog,行為不一致。統一用 sonner:成功=toast、破壞性操作=confirm dialog(K 系列已定調 Pencil/Trash2,對的方向)。
11. **破壞性操作保護**:調整/拆帶目前按了就送。調整量為負且大於現有量、拆帶等於全量等邊界,應顯示「調整後餘量預覽」再確認。
12. **巨型元件債**:PickingModule 1,337 行、BarcodeRuleModule 997 行——UX 迭代速度會被拖慢,建議依 dialog/表單拆子元件(先拆最常改的 PickingModule)。
13. **中英混排**:狀態 badge「可用 (Available)」風格不一,建議中文為主、原始碼值放 tooltip。
14. **登入頁**:已有 loading/error 處理,加「Caps Lock 提示」與密碼顯示切換即可,不需 remember me(倉庫共用工作站反而是資安風險)。

### 4.5 做得好的(保留)

空狀態與錯誤 banner 齊全、Mock 資料誠實標示、角色感知 UI(admin 才見使用者管理)、401 自動登出、改密碼獨立 dialog、CSV 匯出命名帶日期。這些基本功比多數內部系統紮實。

---

## 5. 建議路線圖(整合四個面向)

| 階段 | 內容 | 理由 |
|---|---|---|
| **短期(1–2 週)** | Dashboard 點亮 3 端點、庫存分頁+排序、sidebar+router、統一 toast、K 系列權限完成 | 低成本高感知,demo 立即有感 |
| **中期(1 個月)** | 盤點模組、儲位調撥、alembic 導入、MSL floor life(A1) | ERP 串接前置 + 補齊競品入場券 |
| **ERP 串接(1–1.5 個月)** | integrations 層 + outbox + 正航 adapter(先 PO 同步與出貨回拋兩條線)、對帳報表 | 按 2.2/2.3 執行,先向正航確認問題清單 |
| **後續** | PDA 響應式作業介面、RMA/退貨、報表中心、告警 | 依客戶回饋排序 |

---

## Sources

- [正航:ERP 與 WMS 介接](https://www.chi.com.tw/blog/ewmsiconnect)
- [正航:API 是什麼?怎麼串接?](https://www.chi.com.tw/blog/wiapiaconnect)
- [正航:倉儲管理 WMS 整合解決方案](https://www.chi.com.tw/wmsis)
- [正航:API 介接如何提升企業營運效率](https://www.chi.com.tw/blog/apiicoe)
- [鼎新:智能倉庫物流方案](https://www.digiwin.com/tw/dsc/industry4/smartFactory.html)
- [鼎新就享知:智慧倉儲 WMS 管理](https://www.digiknow.com.tw/knowledge/6729766b3357b)
- [WMS modules and features checklist (explorewms)](https://www.explorewms.com/complete-wms-modules-and-features-checklist.html)
- [NetSuite WMS: Mobile RF & Wave Picking](https://www.houseblend.io/articles/netsuite-wms-setup-wave-picking)
- [ERP-WMS Integration Guide (DCKAP)](https://www.dckap.com/blog/erp-wms-integration/)
- [WMS ERP Integration Best Practices (Finale)](https://www.finaleinventory.com/warehouse-management-system-software/wms-erp-integration)
- [Semiconductor traceability standards: JEP160 / AS6496](https://www.wevolver.com/article/evolving-standards-in-semiconductor-traceability)
- [EasyWare WMS](https://fis.com.tw/product/easyware-wms-warehouse-logistics/) / [瑞高 iWMS](https://www.regalscan.com.tw/solutions/detail/32) / [天心條碼管理](https://www.attnerp.com.tw/ai-manufacturing-ai-wms/)
