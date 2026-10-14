# Release gold set（驗收用，非 runtime 配置）

**用途：** 發版或改 pipeline／L1／校準前後，用固定查詢代表 **類行為**，防倒退。  
**唔係：** 全港名冊逐間驗證；API **唔讀** 本表。

## 自動驗收

| 命令 | 做咩 |
|------|------|
| `pnpm eval:report-quality` | Golden JSON（無 Serp/LLM） |
| `pnpm eval:search-evidence` | 檢索／L1（`search-evidence.json`） |
| `pnpm eval:report-quality --live --gate` | Live gold **blocking** 集（要 `pnpm dev` + keys） |
| `pnpm eval:report-quality --live` | 全部 live（含 stretch） |

Fixture：`scripts/fixtures/report-quality-live.json`（`goldTier`）、`scripts/fixtures/search-evidence.json`。

人工補充：[`checklists/report-quality-human-signoff.md`](../checklists/report-quality-human-signoff.md)（10 條）。

## Blocking 集（發版 gate）

| id | 類別 | 守住咩 |
|----|------|--------|
| `create21-mwc` | dispute / L1 NFKC | bound≥3；`風險偏高`；唔可「未檢出糾紛」；FB/LIHKG URL |
| `conscientious-renovation` | dispute | bound≥1；`風險偏高` |
| `fictional-empty` | quiet | 虛構；unindexed；`中性` |
| `fei-wong-mwc` | quiet + MWC | 零 bound → `中性`（唔用 B+／未見負面摘要） |
| `fei-wong-phone` | entity | 電話→名冊名搜尋 |
| `wai-king` | quiet + MWC | 弱討論；中性 C |
| `sham-tak-mwc` | ambiguous name | bound≥1；≤C；`風險中等` |

## Stretch（唔阻塞發版，但要跟進）

| id | 原因 |
|----|------|
| `yuanshi-international` | 品牌检索仍 hard；Serp 波動大。單跑：`--live --case yuanshi-international` |
| `nam-hing-mwc` | 「南興」短名易误绑；中性 C 期望，L1 待收紧 |

## 改 gold 嘅規矩

1. 新 case 必須標 `goldTier` + `label` 說明 **類行為**。  
2. Dispute case 盡量加 `goldEvidenceUrlSubstrings`（人工開過 URL 再寫）。  
3. 改期望要同步 [DEC-0009](../decision-log/DEC-0009-release-gold-set-acceptance.md) 或 amend DEC。
