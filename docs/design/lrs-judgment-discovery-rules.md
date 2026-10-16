# LRS 判詞 D1 發現規則（Track 1）

**狀態：** draft（2026-10-16 瀏覽器實測 `legalref.judiciary.hk`）  
**相關：** [judgment-ingestion-execution.md](../plans/judgment-ingestion-execution.md)、[DEC-0012](../decision-log/DEC-0012-track1-court-judgments-v1-0-0.md)、`scripts/config/lrs-ingestion-profiles.json`

## 實測結論（[Certain] 當日瀏覽器 session）

| 查詢 | `txtselectopt` | DB | Result found |
|------|----------------|-----|--------------|
| 裝修 | 1 anywords | JU | 3266 |
| 裝修 | 1 + JU,RV,RS,PD | all | 3266（與 JU-only 實質相同） |
| HKSCT 裝修 | 1 anywords | all | 3284（多 ~18 條 PD；**唔**等於小額錢債審裁處篩選） |
| 裝修工程 | 3 phrase | JU | 749 |
| 滲水 | 1 | JU | 19 |
| 室內工程 | 1 | JU | 19 |
| 工程合約 | 1 | JU | 389 |
| 翻新 | 1 | JU | 414 |

**[Certain]** 單獨 `curl` / Node `fetch` 多數**唔**會得到 `Result: N found`（要瀏覽器 session）；離線 adapter 預期要 **Playwright** 或人手開 URL。

**[Certain] 案號直查（2026-10-16）：** `txtselectopt=4` + `txtSearch=HCSA59/2014`（無空格）+ `selDatabase=JU` → `buildLrsCaseNumberSearchResultUrl` / `pnpm lrs:discover-case --case=…`。

## URL 參數（進階搜尋 → `search_result.jsp`）

| 參數 | 用途 |
|------|------|
| `stem=1` | 詞干（預設開） |
| `txtselectopt` | `1` 任一字、`2` 任序、`3` 完整片語 |
| `txtSearch` | 主全文欄（配合 `txtselectopt`） |
| `selDatabase=JU` | **只 Judgments**（D1 預設；唔包 PD） |
| `selallct=1` | 法院級別全選（預設） |
| `selSchct=DC` 等 | 單一法院級別（**[Likely]** 要唔設 `selallct`；未完整掃 param 矩陣） |

表單欄位對照（POST/iframe 提交用）：

| 欄位 | 搜尋類型 |
|------|----------|
| `txtSearch` + `txtselectopt=1` | any words |
| `txtSearch2` + `txtselectopt2=3` | phrase |
| `txtSearch` + `txtselectopt=7` | parties（Parties of Judgment；GET 可用） |
| `txtSearch10` + `txtselectopt10=12` | case number |

**[Certain]** 在 `txtSearch` 加 `HKSCT` / `DCCJ` **唔**會取代法院 checkbox；只係多一個全文關鍵字。

## D1 查詢策略（機器可讀：`lrs-ingestion-profiles.json`）

1. **Tier A（先爬）** — 片語 `裝修工程`、關鍵字 `室內工程`、`滲水`（命中量 ≤~750，可分页）。
2. **Tier B** — `工程合約`、`翻新`、`承辦商`。
3. **Tier C** — 單字 `裝修`：**只取前 N 頁**作探索，**唔**全量 import。

**停用：** `courtTerms` 拼入 `txtSearch`（舊 `discover:judgments` 行為）；改用結果頁 **case number 前綴**篩選。

## 結果頁解析規則（`parse-lrs-search-html` / D2 前）

每條 hit 應抽出：

- `caseRef` — 如 `HCSA64/2017`、`DCCJ4239/2022`（regex：`[A-Z]{2,6}\d+/\d{4}`）
- `neutralCitation` — 如 `[2021] HKCA 470`（可選）
- `judgmentDate` — `Date: dd/mm/yyyy`
- `partiesLine` — 下一行中文／英文訴訟方
- `database` — 必須 `Judgments`
- `judgmentUrl` — case ref 旁 PDF/HTML 鏈（adapter 再抓 `href`）

**丟棄：**

- `Database: Practice Directions` 或標題 **綜合實務指示**（無 case ref）
- `Reasons for Verdict` / `Reasons for Sentence`（D1 只 `selDatabase=JU` 已避開大部份）

**優先保留（裝修糾紛相關 [Likely]）：** 前綴 `HCSA`、`DCCJ`、`LDPD`、`LDBM`；高院民事 `HCA` / 人身傷亡 `HCPI` 視 D2 要點再判。

**降權／通常非目標：** 刑事上訴 `CACC`、簡易程序 `HCMA`、區院刑事 `DCCC`（民事索償多為 `DCCJ`）。

**去重：** `caseRef` + neutral citation；同一案多個上訴版本保留**最新判決日**一條入候選清單。

## 命中量護欄

- 單一 profile `observedHitsJu` > **500** → 日志 warning，預設 **cap pages**（見 profile `maxPagesDefault`）。
- 禁止因 D1 全量爬取 3000+ 條直接入庫；必經 D2 分類 gate（DEC-0013）。

## 實作指向

- URL 生成：`src/lib/lrs-search-url.ts` → `pnpm discover:judgments`
- 下一步：`parse-lrs-search-html.ts` + Playwright fetch（限速、Judiciary ToS）
- 人手驗證：開 `scripts/output/judgment-source-urls.json` 任一 Tier A URL，對照上表 hit 數是否仍同階數量級
