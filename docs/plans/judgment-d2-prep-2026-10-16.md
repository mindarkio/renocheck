# D2 prep 快照（2026-10-16）

**一鍵：** `pnpm d1-d2:pull`（D1 全量 crawl + build + gold gate + D2 filter）

| 產物 | 路徑 |
|------|------|
| Raw 候選 | `scripts/output/judgment-candidates.json` |
| Gold backfill | `scripts/output/judgment-candidates-gold-backfill.json` |
| D2 全隊列 | `scripts/output/judgment-d2-queue.json` |
| D2 keep | `scripts/output/judgment-d2-keep.json` |
| 日誌 | `scripts/output/d1-d2-pull-2026-10-16.log` |

**D1 gate：** `pnpm d1:audit-gold` → **11/11** 被告 gold；候選 **151** `caseRef`。

**D2 filter（同次 pull）：** keep **3** · drop 140 · review **8** → 見 `judgment-d2-queue.json`。

**下一步 D2：** 人手處理 `review` + `keep` 寫要點 → 合併 seed → import。
