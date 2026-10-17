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

1. **用途**：名冊供公眾查閱以符合《建築物條例》；須遵守 [DATA.GOV.HK 使用條款](https://data.gov.hk/tc-help/usage.html) 及相關開放數據牌照（再使用須標示來源）。
2. **個人資料**：屋宇署搜尋頁註明名冊內個人資料**不得用於其他目的**（*All personal data found therein should not be used for any other purposes*）。Renocheck 離線解析：**不將獨資／個人承建商姓名寫入 log 或比對輸出**，僅保留公司名與註冊編號（見 `parse.ts`）。
3. **非 BR／非工程紀錄**：此 CSV 為屋宇署註冊，**不是**公司註冊處 BR 或 BRAVO 工程紀錄（見 `docs/sourcedata/README.md`）。

## 本地副本

- 開發用固定副本：`docs/sourcedata/registers_full_list.csv`（供 `pnpm import:mwc` 與無網路測試）。
- 抓取腳本寫入：`.cache/bd-register/registers_full_list.csv`（gitignored）。
