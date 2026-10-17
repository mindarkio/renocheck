# D1 全量候選 → D2 清洗（產品方向）

**狀態：** active（2026-10-16，owner 確認）  
**North star：** 用戶 search 時，**盡量**已有一份完整、經 D2 入庫嘅判詞索引；唔靠 beta 查詢才補案。  
**SSOT 流程：** [judgment-ingestion-execution.md](./judgment-ingestion-execution.md)

---

## 策略（兩段式）

| 階段 | 做咩 | 產物 | 唔做咩 |
|------|------|------|--------|
| **D1** | 用已定 LRS profile **盡量拎齊** hit（HTML → parse → 去重 `caseRef`） | `judgment-candidates.json`（gitignore） | 唔入 DB；唔判「裝修相關」；唔寫要點 |
| **D2** | 規則 + 人手（可選 DEC-0013 LLM 草稿）清洗 → import-ready seed | `judgments-seed.local.json` → `import:judgments` | 唔改 user runtime 即時爬 LRS |

**「全部相關」嘅操作定義（避免誤會）：**

- **[Certain]** D1「全量」= **已定義 keyword／片語 profile 下，LRS 列示嘅 Judgments 盡量爬完**（Tier **A + B**），唔包括：
  - Tier **C** 單字「裝修」3266 hit（只作抽樣，見 `lrs-ingestion-profiles.json`）
  - 16,000 MWC **逐名 parties 搜** → **[J5 計劃](./judgment-j5-mwc-parties-coverage.md)**（`pnpm j5:build-queue` / `j5:fetch-parties`）
- **[Likely]** 合併去重後候選 **數百～約一千** `caseRef` 量級（視 LRS 重疊）；**唔**等於每間 MWC 都有紀錄。
- **產品文案** 仍係「**在本次已匯入的公開判詞紀錄中**」— D1 大 ≠ 用戶輸入 100% hit。

---

## 同舊 PoC 嘅分別

| | PoC `d1:tier-a` | 全量 `d1:crawl-relevant` |
|--|-----------------|---------------------------|
| Tier | A only | **A + B** |
| 分頁 | `--max-pages=6`，且硬 cap 8 | `--max-pages=full`（按 `observedHitsJu` ÷ 10，cap 80／profile） |
| 候選 | ~60 | 目標 **盡量完整** profile 覆蓋 |
| DB | 15 宗 D2 已入庫 | **D1 完成後** 再分批 D2→import |

Owner beta 確認表 #5（暫唔加 seed）→ **改為：** 先完成 D1 候選池，再按 D2 批次擴 DB（唔再等 beta 查詢驅動）。

---

## 命令

```bash
# 1) 發現 URL（repo 內）
pnpm discover:judgments

# 2) Playwright 存 HTML（Tier A+B，全 profile 頁數策略）
pnpm d1:fetch-relevant
# 或單 profile：pnpm lrs:save-search-pages --profile-id=phrase-裝修工程 --max-pages=full

# 3) 合併去重候選
pnpm d1:build-candidates

# 一鍵 D1
pnpm d1:crawl-relevant
```

**運維：** 長跑（例如「裝修工程」~75 頁）；建議本機 headed 失敗時 `--headed`；遵守 Judiciary ToS／限速（腳本內 ~1.5s）。

**驗收（D1 done for this phase）：**

- [ ] `judgment-candidates.json` 去重 `caseRef` **>> 60**（記錄實際數字於本檔 changelog）
- [ ] 每條有 `caseRef` + `partiesLine`（`judgmentUrl` 盡量有）
- [ ] Spot-check 記錄 precision（延續 `judgment-d1-spot-check-*.md`）

**之後 D2：** 見 execution 計劃 § D2 — 刑事 prefix 剔除、裝修相關標記、`hearingKeyPointsZh`、分批 import。

---

## Changelog

| 日期 | 備註 |
|------|------|
| 2026-10-16 | 策略確認；加 `d1:crawl-relevant`、`--max-pages=full`、`--tier=A,B` |
| 2026-10-16 | 本機 crawl 完成：**174** 去重 `caseRef`（並行兩次 crawl，見 run 記錄） — [`judgment-d1-crawl-run-2026-10-16.md`](./judgment-d1-crawl-run-2026-10-16.md) |
