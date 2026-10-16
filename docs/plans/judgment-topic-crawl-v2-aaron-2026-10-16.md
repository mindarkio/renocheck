# Topic crawl v2（Aaron 2026-10-16）

**狀態：** active  
**DEC：** DEC-0012 amendment 2026-10-16 (b)  
**J5：** PAUSED — see [`judgment-j5-mwc-parties-coverage.md`](./judgment-j5-mwc-parties-coverage.md)

## 進度（2026-10-16）

| 步驟 | 候選 `caseRef` | D2 keep | seed / `official_legal_events` |
|------|----------------|---------|----------------------------------|
| D1 全量（11 profiles） | 285 | 116 | 121（+107 vs PoC 14） |
| Topic v2 首批（hca/dccj/cacv 等） | 329 (+44) | 138 (+22) | 143 (+22） |
| Topic v2 補齊（裝修公司、工程合約、cacv） | **384** | 166 | 178 |
| **D2 v3 收緊**（2026-10-16 晚） | 384 | 72 keep · 113 review · 199 drop | 遠端曾 72（本地 v3b 見下） |
| **D2 v3d**（2026-10-16 夜） | 384 | **49** keep · **127** review · **208** drop | 遠端 **49** `legalref-lrs-ju` + 2 fixture |

D2 v3b：`company_defendant_v3b` — DCCJ/HCA/LDBM 須 parties／profile／**被告名**裝修或工程信號（唔用寬鬆 renovation 捷徑）；LDPD 仍用合約／欠款規則。Review CSV：`pnpm d2:export-review-csv` → `scripts/output/judgment-d2-review.csv`。

- `pnpm lrs:probe-keywords`：`&nbsp;` entity 解析已修；**建議再跑一輪**更新 `lrs-keyword-probe.json`（上一輪仍全 `null`）。
- Ops：`--profile-id` 時唔再預設 filter tier A only（`lrs-save-search-pages.ts`）。
- D2 **review 174** 未入庫（自然人／独资／parties 未 parse 等）。

## 策略

- Topic keyword × court prefix（LRS dual-field）+ 片語；hit >500 再考慮 **年份分片**（未實作則 browser 驗證後加）。
- D2 **`company_defendant_v2`**：公司被告 keep；MWC optional enrich；自然人／独资 → review。
- 單線 Playwright、batch、遇非 200／異常頁停跑報告。
- **唔** search-time LRS；**唔** push main without Aaron OK.

## 命令

```bash
pnpm lrs:probe-keywords          # browser hit counts → output JSON
pnpm discover:judgments
pnpm lrs:save-search-pages --profile-id=... --max-pages=full
pnpm build:judgment-candidates
pnpm d2:prep && pnpm d2:import-keep
```
