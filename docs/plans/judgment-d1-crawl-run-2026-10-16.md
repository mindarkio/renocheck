# D1 crawl-relevant 執行記錄（2026-10-16）

**命令：** `pnpm d1:crawl-relevant`（Tier A+B，`--max-pages=full`）  
**環境：** 本機 Playwright（headless）  
**狀態：** **成功**（exit 0；曾並行跑兩次 `d1:crawl-relevant`，以最後 build 為準）

| 項 | 值 |
|----|-----|
| 開始（UTC） | 2026-10-16T14:59:50Z |
| 結束（UTC） | 2026-10-16T15:11:23Z |
| 耗時 | ~11.5 分鐘 |
| 本次存 HTML 頁 | 186 |
| manifest 總 entries | 194 |
| 解析 HTML 檔 | 221 |
| **候選行數** | **174**（`generatedAt` 2026-10-16T15:13:07Z） |
| **去重 `caseRef`** | **174** |
| 對照 PoC | ~59–60 → **174**（約 3×）；另一次並行 build 曾出 **183**，以現行 JSON 為準 |

**產物（gitignore）：** `scripts/output/judgment-candidates.json`、`scripts/output/lrs-html/`、`scripts/output/lrs-fetch-manifest.json`

### 按 `discoveredFrom.profileId`（行數，可重疊案會只保留一條）

| profileId | 行數 |
|-----------|------|
| phrase-裝修工程 | 43 |
| anywords-翻新 | 36 |
| anywords-工程合約 | 31 |
| anywords-承辦商 | 18 |
| hcsa-裝修 | 17 |
| anywords-室內工程 | 12 |
| anywords-滲水 | 9 |
| dccj-裝修 | 8 |
| hcsa-_-p6 | 8 |
| case-number-HCSA59-2014-p1 | 1 |

**備註：** `hcsa-_-p6` / 舊 HTML 檔名可能來自先前 PoC manifest 合併；D2 以 `caseRef` 去重即可。

### 失敗 profile

無（log 內無 `lrs_save_profile_failed`）。

### 下一步

D2 清洗與 reverse match MWC（見 owner 討論）；**未** `import:judgments`。
