# 司法判詞來源清單（Track 1 v1.0）

DEC-0012 要求可追溯來源；**唔**鎖死單一域名。

| 來源 | 用途 | 更新頻率（概略） | ToS／備註 |
|------|------|------------------|-----------|
| [司法機構法律參考系統](https://legalref.judiciary.hk/) | 刊憲判詞主連結 | 不定期 | 商業使用須法律確認（私人研究條款） |
| [judiciary.hk 判詞](https://www.judiciary.hk/zh/judgments_legal_reference/judgments.html) | 入口／核對 | 不定期 | 同上 |
| [HKLII](https://www.hklii.hk/) | 索引與連結（含 HKSCT、勞資等） | 不定期 | 遵守站方使用條款；唔 mirror 全文 |
| [司法機構 Daily Cause List](https://www.judiciary.hk/zh/court_services_facilities/daily_cause_list.html) | **Phase 3** 離線發現（**小額錢債** 主渠道；先 archive、後日更 cron） | 每日 | 產品僅深度連結；自動抓取見 DEC-0012 Phase 3 |

### D0.3 狀態（2026-10-16）

| 項 | 說明 |
|----|------|
| 產品用法 | 離線入庫 → DB lookup；報告展示 **要點 + `sourceUrl`**，唔提供判詞全文下載 |
| Beta | 內測／preview 可接受；**大規模商業推廣前** 建議法律顧問確認 LRS 私人研究／商業使用條款 |
| 負責人確認 | **Done** 2026-10-16 — [`owner-attestation-track1-beta.md`](../checklists/owner-attestation-track1-beta.md) |

PoC seed：`scripts/fixtures/judgments-seed.json`（合成）。真實案：`scripts/fixtures/judgments-seed.local.json`（建議 gitignore）或 private ops。

匯入：`pnpm import:judgments`（需 `SUPABASE_SERVICE_ROLE_KEY`）。

**批量發現與入庫（離線，唔係 user search；唔用 Serp）：** 見 [`judgment-ingestion-execution.md`](../plans/judgment-ingestion-execution.md) — `pnpm discover:judgments` → … → `pnpm import:judgments`。
