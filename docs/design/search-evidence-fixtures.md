# Search evidence 評估集（7 條）

配合 `pnpm eval:search-evidence` 使用。資料為 **公開查詢字串** 與 **人工核實的 gold 連結**，唔構成對任何公司或個人的指控。

**主要驗收欄：`Prod`**（同 API：`fetchWebSearchHitsForEntity` + L1，`serpPageCount()` 頁數）。Q1/Q2/Q1+Q2 為對照；**Q3** 為實驗（唔計必達）。

## 欄位

| 欄位 | 意思 |
|------|------|
| `mustIncludeInResults` | 若有值：至少一條搜尋結果的 title+snippet+url **包含** 該字串，該策略算 **召回成功** |
| `mustExcludeTextInResults` | 若有值：結果中 **唔應** 出現該字串（虛構公司測試） |
| `goldEvidenceUrls` | 人工確認曾出現公開討論／報道摘要的 URL（或可用 substring）；eval 只 **報告** 有冇命中，唔改 pass 條件 |
| `goldEvidenceNote` | 合規用語備註（fixtures JSON 內） |
| `null` | 唔強制召回；腳本只報 hit 數 |

## 有公開糾紛／討論提及的 gold case（2 條）

1. **conscientious-renovation** — `良心裝修顧問有限公司`；論壇長文討論工程質素（[LIHKG thread/3049015](https://lihkg.com/thread/3049015)）。召回字串：`良心裝修`（全名未必出現在 snippet）。
2. **yuanshi-international** — `源始（國際）設計及裝修有限公司`；Threads 公開分享及報章摘錄曾用「源始（國際）設計及裝修」表述。召回字串：`源始（國際）`（現行 Q1/Q2 可能仍未命中，作改 query 前的 regression）。

## 對照 case

- **nam-hing** — MWC 實體名；唔再強制召回（與論壇常用字串易混淆）。
- **sham-tak-mwc** / **wai-king** / **fei-wong** — 零或弱討論對照。
- **fictional-empty** — 虛構名。

改 fixture：編輯 [`scripts/fixtures/search-evidence.json`](../../scripts/fixtures/search-evidence.json)。

產品 north star（SSOT）：[`pipeline-ssot.md`](pipeline-ssot.md)。

## 報告質量門檻（DEC-0004）

- **對用戶可信（產品）：** `ReportCard` 查證範圍、`boundHitCount` vs `serpHitCount` 文案、全開放 checklist — 用 `pnpm eval:report-quality` 驗 golden（[`report-quality-golden.json`](../../scripts/fixtures/report-quality-golden.json)）。
- **對內 retrieval：** 本檔 `mustInclude` 分數 — **唔等於** 用戶端準確率；連兩周 Prod &lt;1/2 見 DEC-0002。
- **Live 回歸：** `pnpm eval:report-quality --live`（[`report-quality-live.json`](../../scripts/fixtures/report-quality-live.json)）；手動／weekly，食 Serp/LLM quota；唔納入 default CI。可 `--case <id>` 跑單條。
- **名冊對照：** `pnpm mwc:spot-check` — dispute fixture（良心／源始）**不在** MWC 名冊時 `mwcMatched: false` 為預期；見 `docs/development.md` §MWC 與 fixture。
