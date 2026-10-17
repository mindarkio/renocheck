# D1 gate（2026-10-16）

**判定：** **Gold recall PASS** → 可進入 **D2 cleaning fine-tune**（唔代表全港零漏）。

| 檢查 | 結果 |
|------|------|
| 被告 gold seed（11）⊆ `judgment-candidates.json` | **11/11**（`pnpm d1:audit-gold`） |
| Keyword crawl Tier A+B + 裝修工程 75 頁 | Done |
| 案號 backfill（gold 缺漏） | `pnpm d1:backfill-gold` |
| Rebuild 保留 gold | `judgment-candidates-gold-backfill.json` + `build:judgment-candidates` |

**候選規模：** ~181 `caseRef`（build 後以 `judgment-candidates.json` 為準）。

**仍係界外（唔阻塞 D2）：** 全 MWC 被告覆蓋、Parties 軸、全 LRS 749 hit 逐條核對。

**命令：** `pnpm d1:gate`（backfill + audit）
