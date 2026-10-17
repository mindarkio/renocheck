# D2 漏網 review（2026-10-17 final）

## 對數（167 − X + Y = 最終）

| 來源 | 數值 | 備註 |
|------|------|------|
| **Baseline keep** | **167** | 2026-10-16 舊 `judgment-d2-keep.json`（`d2-prior-keep-drops.json` → `priorKeepCount`） |
| **X（自 167 剔除）** | **88** | 舊 keep 成員、現行 **drop**（`droppedFromPrior` 與現行 keep 無交集） |
| **Y（新加 keep）** | **0** | 現行 **79** 宗均屬原 167 集合；**無**新案號淨增 |
| **算式** | **167 − 88 = 79** | 79 + 88 = 167 ✓ |
| **`d2:filter-candidates`（2026-10-17）** | keep **79** / drop **817** / review **1** | `--dry-run`，897 candidates |
| **Remote `legalref-lrs-ju`** | **79** | Supabase `official_legal_events` count [Certain 2026-10-17] |

**過程備忘（唔改算式）：** 首輪漏網 dry-run 曾 **78** keep；修補行業排除／`mwc_plaintiff_only_pass` 等後曾 **86** 入庫；**CACV 131/2005** 由 `weak_renovation_signal` 改 **`owners_corporation_vs_contractor`**；LDBM 收緊 **−7** → **79**。

### 規則修補後「加返」代表（仍屬 167 內，唔計 Y）

| caseRef | 原因 |
|---------|------|
| CACV 131/2005 | 首輪 `droppedFromPrior` 曾跌出；現 **`owners_corporation_vs_contractor` keep** |
| HCSA 57/2024 等 5 宗 | [`judgment-d2-keep-162-to-167.md`](./judgment-d2-keep-162-to-167.md) — `mwc_plaintiff_only_pass` 收窄 |

### 第二輪 LDBM 剔除（7，86→79）

| caseRef | reason |
|---------|--------|
| LDBM 211/2014 | `ldbm_oc_applicant_defendant_not_contractor` |
| LDBM 334/2007 | 同上 |
| LDBM 36/2004 | 同上 |
| LDBM 291/2019 | 同上 |
| LDBM 151/2020 | 同上 |
| LDBM 152/2020 | 同上 |
| LDBM 3/2015 | 同上 |

**仍 keep 嘅 LDBM：** LDBM 6/1998（被告 成龍工程有限公司，含工程字眼）。

### X：88 宗仍 drop（自 167 跌出、唔在現行 keep）— reason 分佈

| drop reason | 宗數 |
|-------------|------|
| `defendant_not_engineering_trade` | 40 |
| `natural_person_defendant` | 30 |
| `defendant_entity_unknown` | 8 |
| `defendant_work_injury_context` | 5 |
| `defendant_property_management` | 3 |
| `defendant_vehicle_industry` | 1 |
| `defendant_estate_agent` | 1 |

詳細案號：`scripts/output/d2-prior-keep-drops.json` → `droppedFromPrior`（**88** 宗與現行 keep 無交集；**1** 宗 CACV 131 已恢復）。

### 78→86 階段「新加」代表（規則修補後 keep，唔喺首輪 78 清單）

見 [`judgment-d2-keep-162-to-167.md`](./judgment-d2-keep-162-to-167.md)（`mwc_plaintiff_only_pass` **+5**）及 leak 修補後 **sole prop / company 工程字** 案件；重跑 filter 後以 `judgment-d2-keep.json` 為準。

---

## 點解會入咗 keep（根因，首輪）

| 機制 | 說明 |
|------|------|
| `company_defendant` | 英文自然人被誤分類為 `company` |
| `force_keep_allowlist` | CACV 131/2005 曾免閘（已移除；改 OC v 承建商） |
| `renovationRelevantSuggested` + profile | LRS profile 令 DCCJ 跳過被告工程字檢查 |
| 缺行業排除 | 車輛／地產／物管／工傷／業權租務未 drop |

## 本輪 code 規則（2026-10-17 跟進）

| 規則 | 行為 |
|------|------|
| **CACV** | 個人英文原告 **唔** 因無「裝修合約」敘述而當工傷 drop；被告 **有** 工傷字眼 → drop；否則 **`review`**（`cacv_personal_plaintiff_review`）。**業主立案法團 v 裝修公司** 上訴 → **`owners_corporation_vs_contractor` keep** |
| **TENANCY_TITLE_RE / WORK_INJURY_RE** | 只睇 **被告名**（唔掃 `partiesLine` 全文） |
| **LDBM + IOC 申請人** | 被告無工程字 → `ldbm_oc_applicant_defendant_not_contractor` |

```bash
pnpm d2:filter-candidates --dry-run
pnpm d2:filter-candidates --dry-run --report-prior-keep-drops   # 需先備份 keep 作 prior
```
