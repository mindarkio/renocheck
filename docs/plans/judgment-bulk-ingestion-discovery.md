# Track 1 判詞 — 批量建庫（索引）

**執行細節 SSOT：** [`judgment-ingestion-execution.md`](./judgment-ingestion-execution.md)（來源獲取 → 候選 → 入庫 → 驗證）。

本頁只保留三階摘要與快速命令。

## Serp 政策

`SERPER_API_KEY` / SerpAPI **只**服務 user `POST /api/search`（Track 2）。判詞 D1 **唔**用 Serp。見 [`scripts/ingestion/SERP-RESERVED-FOR-USERS.md`](../../scripts/ingestion/SERP-RESERVED-FOR-USERS.md)。

## 三階

| 階 | 做咩 | 產出 |
|----|------|------|
| **D1 發現** | LRS 直連（URL → fetch → parse） | `judgment-candidates.json` |
| **D2 篩選** | 規則 + 可選 LLM 草稿 + 人工 gate | `judgments-seed.local.json` |
| **D3 入庫** | `pnpm import:judgments` | `official_legal_events` |
| **Phase 3 排期表**（v1.0 後） | Daily Cause List：先 **archive**，後 **日更 cron**；**小額錢債** 主渠道 | 見 [`judgment-ingestion-execution.md`](./judgment-ingestion-execution.md) §4 Phase 3 |

## 快速命令

```bash
pnpm discover:judgments
pnpm import:judgments --file=scripts/fixtures/judgments-seed.local.json
pnpm legal:lookup-smoke
```

LRS 規則：[`docs/design/lrs-judgment-discovery-rules.md`](../design/lrs-judgment-discovery-rules.md)
