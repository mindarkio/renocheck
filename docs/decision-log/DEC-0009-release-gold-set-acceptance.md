# DEC-0009: Release gold set for pipeline acceptance

- **Status:** ACCEPTED
- **Date:** 2026-10-14

## Context

Pipeline SSOT（`docs/design/pipeline-ssot.md`）需要可回歸的驗收，但 MWC 名冊規模唔允許逐公司 gold。創建21 類 L1 漏绑曾導致誤導性 B+。

## Decision

- Adopt `scripts/fixtures/report-quality-live.json`（`goldTier: blocking | stretch`）為 **release gate** 代表集。
- **Blocking：** 7 cases（見 `docs/design/release-gold-set.md`）；發版前 `pnpm eval:report-quality --live --gate` 全過。
- **Stretch：** `yuanshi-international`、`nam-hing-mwc` — 跟進 retrieval／短名 L1，唔阻塞 gate。
- **Retrieval-only gold：** `scripts/fixtures/search-evidence.json`；`pnpm eval:search-evidence` 在改 L1/query 後跑。
- **Golden（offline）：** `report-quality-golden.json`；CI 默認 `pnpm eval:report-quality`。
- **Human：** E3 signoff 10 條仍需要，唔由 JSON 代替。



## Acceptance criteria（blocking live）

- 每 case `expect` 字段通過（見 eval 腳本）。
- Dispute 代表（`create21-mwc`、`conscientious-renovation`）：`minBoundHits` 達標；禁誤導摘要句。
- Quiet 代表：零 bound → **中性 C** + `riskBandZh: 中性`（DEC-0010）；唔用 B+／未見負面摘要（讚揚檔）。
- Serp 波動：URL gold 用 **substring**，唔鎖死單一 permalink。



## Consequences

- 改 L1／校準／query pack → 更新 fixture 或本 DEC。
- Runtime **唔** 讀取 gold JSON。



## Reversal cost

Low — 刪 `--gate` 或降 case 數（需記錄原因）。

## Triggers to reconsider

- `REPORT_VERSION` 變更、搜尋供應商 DEC、grading schema DEC。
- Stretch case 連續 4 週 `--live` 通過 → 可升為 blocking。



## Sign-off

- [x] Product / owner  - aaron 2026-10-14
- [x] Engineering  - aaron 2026-10-14