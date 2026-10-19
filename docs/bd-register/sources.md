# 屋宇署註冊承建商名冊（Phase 4 離線）

## 官方資料集

| 項目 | 內容 |
|------|------|
| **Dataset** | [DATA.GOV.HK — Registers of Buildings Department](https://data.gov.hk/tc-data/dataset/hk-bd-opendata-registers-of-buildings-department) |
| **Resource（完整列表 CSV）** | [Full list（resource id `121faadb-83a3-4ecd-b348-e65c177ec950`）](https://data.gov.hk/en-data/dataset/hk-bd-opendata-registers-of-buildings-department/resource/121faadb-83a3-4ecd-b348-e65c177ec950) |
| **下載 URL（PSI 靜態檔）** | `https://static.data.gov.hk/bd/opendata/registers/registers_full_list.csv` |
| **欄位字典** | [data_dictionary_registers.docx](https://static.data.gov.hk/bd/opendata/registers/data_dictionary_registers.docx) |
| **更新頻率** | 每週一、四（dataset 標示 *Every Monday and Thursday*） |
| **格式** | CSV（單檔涵蓋 AP／RI／GBC／SC／MWC 等所有名冊行） |

## Renocheck 關注的承建商類別（`REGISTRATION_TYPE`）

| 代碼 | 名冊 |
|------|------|
| `MWC` | 小型工程承建商（公司） |
| `MWC(W)` | 小型工程承建商（個人）— **解析輸出僅保留註冊編號，不輸出人名** |
| `GBC` | 一般建築承建商 |
| `SC(D)` / `SC(F)` / `SC(SF)` / `SC(V)` / `SC(GI)` | 註冊專門承建商（拆卸／地基／平整／通風／地質勘探等） |

線上查閱（非批量下載）：[註冊專業人士或承建商搜尋](https://www.bd.gov.hk/tc/resources/online-tools/registers-search/registrationsearch.html)。

## 使用條款與合規重點

1. **用途**：名冊供公眾查閱以符合《建築物條例》；須遵守 [DATA.GOV.HK 條款及細則](https://data.gov.hk/tc/terms-and-conditions) 及相關開放數據牌照（再使用須標示來源）。
2. **個人資料**：屋宇署搜尋頁註明名冊內個人資料**不得用於其他目的**（*All personal data found therein should not be used for any other purposes*），僅限《建築物條例》相關用途。Renocheck 離線解析：**不將獨資／個人承建商姓名寫入 log、錯誤訊息或比對輸出**；`MWC(W)` 與非 limited 公司行只保留註冊編號（見 `parse.ts`）。
3. **非 BR／非工程紀錄**：此 CSV 為屋宇署註冊，**不是**公司註冊處 BR 或 BRAVO 工程紀錄（見 `docs/sourcedata/README.md`）。
4. **來源標示（再使用）**：報告或對外說明引用名冊摘錄時，須標示：**資料來源：屋宇署，經 DATA.GOV.HK 提供**／**Source: Buildings Department, via DATA.GOV.HK**（並註明擷取日期，見 `.cache/bd-register/registers_full_list.meta.json` 的 `retrieved_at`）。
5. **`FLAG` 欄**（見官方 data dictionary）：其他字元存為 `flag`；值 **`@` = 已申請續期**（過咗 `EXPIRY_DATE` 仍視為有效直至處理完成），解析為 `renewalPending: true`（唔寫入 `flag`）。全量 CSV 行數隨 fetch 變動；離線統計（21,076 行）曾見 **`@` = 161**、空白 = 20,915、**無** `%` 等其他值（以當次 `.cache` 為準，見 `registers_full_list.meta.json` 的 `retrieved_at`）。
6. **HTTP 下載**：`pnpm bd-register:fetch` 使用 `Accept: text/csv`、120s timeout、binary 寫檔；收到非 CSV（例如 403 XML）**唔**寫入 `.cache/`。部分海外出口曾見 **403 AccessDenied**；須在**香港網絡**驗證 PSI URL 可用性（本 repo 未鎖定「已確認可用」日期，以營運 fetch 成功為準）。
7. **`robots.txt`**：BD 嘅 checkRobotsAllowsFetch 遇到 robots.txt 非 2xx（例如 403）仍然視為允許；Judiciary cause-list 規則唔同，見第 8 點。
8. Judiciary robots：主域 e-services.judiciary.hk/robots.txt 5xx／網絡錯誤時，只限 Wayback backfill 改看 www.e-services.judiciary.hk（最多 3 次 redirect，只准 https、預設 port、e-services.judiciary.hk／www.e-services.judiciary.hk 兩個 host）；live 抓取一律以主域為準（RFC 9309 §2.3.1.4）。批准：Aaron 2026-10-18。主域恢復後即以主域為準。

## 本地副本（gitignored）

| 路徑 | 用途 |
|------|------|
| `.cache/bd-register/registers_full_list.csv` | `pnpm bd-register:fetch` 最新下載；`pnpm import:mwc` 讀取 |
| `.cache/bd-register/registers_full_list.baseline.csv` | MWC dry-run 基線（首次或更新基線：`cp` candidate → baseline） |
| `.cache/bd-register/registers_full_list.meta.json` | 擷取 metadata（`url`、`retrieved_at`、`sha256` 等） |

上述路徑均套用 **7 日 TTL**（`assertCacheFileFresh`）。勿 commit 完整 CSV；本地用完可刪 `.cache/bd-register/`。

單元測試：`src/lib/bd-register/fixtures/registers.fixture.csv`（合成資料；header 與官方 23 欄一致）。

## 報告官方連結（PR-BC；人手核實）

以下 URL 用於 `src/lib/report-trust-copy-zh.ts`（UI 常數，唔寫入 `RiskReport`）。核實方式：`curl -sL -o /dev/null -w "%{http_code}"` 期望 **2xx**（2026-10-18，RenoCheck smoke）。

| 用途 | URL | `verified_at` |
|------|-----|---------------|
| 公司註冊處電子服務（查冊入口） | `https://www.e-services.cr.gov.hk/` | 2026-10-18 |
| 政府一站通 BR 查詢 | `https://www.gov.hk/tc/residents/taxes/etax/services/brn_enquiry.htm` | 2026-10-18 |
| 破產管理署：強制性清盤紀錄查冊 | `https://www.oro.gov.hk/cht/our_services/electronic_services/compulsory.html` | 2026-10-18 |
| 屋宇署註冊承建商搜尋 | `https://www.bd.gov.hk/tc/resources/online-tools/registers-search/registrationsearch.html` | 2026-10-18 |
| 屋宇署小型工程（誰可進行） | `https://www.bd.gov.hk/tc/building-works/minor-works/minor-works-items/who-can-carry-out-minor-works/index.html` | 2026-10-18 |
| 屋宇署指定豁免工程 | `https://www.bd.gov.hk/tc/building-works/minor-works/designated-exempted-works/index.html` | 2026-10-18 |
| 屋宇署 BRAVO 樓宇紀錄 | `https://www.bd.gov.hk/tc/resources/online-tools/BRAVO-online-building-records/index.html` | 2026-10-18 |
| 司法機構審訊案件表（e-services） | `https://e-services.judiciary.hk/dcl/index.jsp?lang=tc` | 2026-10-18 |

**備註：** `https://www.judiciary.hk/zh/court_services_facilities/daily_cause_list.html` 於 2026-10-18 smoke 返 **404**；產品改用 **e-services** 入口（見上表）。`lang=tc` 為語言參數，**唔**預填公司名。

## 公司註冊處開放數據 API（PR-CR；2026-10-18 核實）

| 項目 | 內容 |
|------|------|
| **資料集** | Registered Office Address of **Live Local Companies**（只涵蓋存續本地公司） |
| **入口** | [data.cr.gov.hk](https://data.cr.gov.hk/) |
| **Local JSON endpoint** | `https://data.cr.gov.hk/cr/api/api/v1/api_builder/json/local/search` |
| **查詢參數** | `query[0][key1]` + `query[0][key2]` + `query[0][key3]` + `format=json` |
| **按編號** | `key1=Brn`, `key2=equal`, `key3=<值>` |
| **按名稱** | `key1=Comp_name`, `key2=begins_with`, `key3=<前綴>`（**僅前綴**，唔支援 contains） |
| **無結果** | HTTP **400**，JSON `{"status":400,"message":"No result found."}` |
| **Auth** | 無 |
| **Timeout（產品）** | 單次 lookup 總預算 10s（`CR_LOOKUP_BUDGET_MS`，`cr-registry-lookup.ts`）；同網搜並行，見 `search-pipeline.ts` Promise.all |
| **Throttle（產品）** | 每個 serverless instance ≤1 req/s（非全域；`throttle.ts` 串行化）。接受理由：DATA.GOV.HK 無全域配額文件，instance 級節流避免單一冷啟動打爆上游。 |
| **條款** | [DATA.GOV.HK 使用條款及細則](https://data.gov.hk/tc/terms-and-conditions) — **容許商業用途**（須標示來源） |

### `Brn` 欄位（同稅務局 BR 是否一致未核實）

`Brn` 主要係 **8 位數字**，少數係 **`C` + 7 位**；8 位值同稅務局商業登記號頭 8 位係咪一致 **未核實**。產品暫時只對 `^C\d{7}$` 用 `Brn equal`。日後若用 8 位做 `equal`，只可以做正面 match；HTTP 400 **唔可以**觸發 C.2c alert。純稅務局 8 位 BR 搜尋 **唔** 呼叫 `Brn equal`，改以公司名稱 `begins_with`（如有）或唔發出會產生 `not_found` 嘅查詢。

### `Comp_name` begins_with（中／英）

2026-10-18 smoke：`begins_with` 對 **中文前綴**（例 `香港樂群`）及 **英文前綴**（例 `HONG KONG FORTUNATE`）均返回 JSON 陣列；同一公司中英記錄在同一結果集內以不同欄位呈現。

### 回傳欄位（`fields_seen`）

`Brn`, `Chinese_Company_Name`, `English_Company_Name`, `Address_of_Registered_Office`, `Company_Type`, `Date_of_Incorporation`（`DD-MM-YYYY`）、`Re-domiciliation_Date`

**未有：** 解散／剔除 `status`、`dissolved`、公司改名日期或改名歷史 → 產品 **唔** 做解散提示或「近期改名」提示。

### Rate limit

官網無明文 quota；2026-10-18 連續 5 次 BR lookup 均 HTTP 200。產品仍以 ≤1 req/s + 10 分鐘 in-memory cache（只存已 map 嘅 schema 欄位，**唔** cache 地址或 API 原始 row）為上限。
