# J5 — ~16k MWC 被告判詞覆蓋（owner 2026-10-16）

**狀態：** **PAUSED**（2026-10-16 Aaron — topic crawl 建庫優先；code 保留）  
**North star：** 用戶查任一 **MWC／MWC(W)** 時，若司法機構 LRS 有 **該名冊主體作被告** 的刊憲 Judgments，盡量已在 `official_legal_events` 可 lookup。

**誠實界 [Certain]：** 唔等於 16,000 行 DB；多數 MWC **零**刊憲民事判詞。目標係 **有官司且已刊憲 → 高 recall**，文案仍係「在本次已匯入紀錄中」。

---

## 決定（雙軌，並行）

| 軌 | 做咩 | 解決咩 | 唔指望咩 |
|----|------|--------|----------|
| **D1 keyword（既有）** | Tier A+B 全頁 + 去重 | 裝修／工程 **主題** 案池（百～千 `caseRef`） | 每間 MWC 一宗 |
| **J5 parties（主軌）** | 對 `mwc_contractors` **逐名** LRS Parties 搜（`txtselectopt=7`） | MWC 被告官司 **橫向覆蓋** | 一次跑完唔阻塞 MVP |

**入庫仍只走 D2 → seed → `import:judgments`。** J5 只擴 **候選池**；被告 + MWC match + 合規要點 gate 唔變（DEC-0012）。

---

## 執行順序

1. **J5-0** `pnpm j5:build-queue` — 由 Supabase 匯出搜尋隊列（`scripts/output/j5-mwc-party-queue.json`，gitignore）。
2. **J5-1** `pnpm j5:fetch-parties --limit=…` — Playwright 限速 batch；HTML → `lrs-html/`；進度 `j5-mwc-party-progress.json`。
3. **D1 merge** `pnpm build:judgment-candidates` — 合併 keyword + J5 HTML + gold backfill。
4. **D2** `pnpm d2:prep` → 批次 `d2:import-keep` + 人手 review queue。
5. **重複 2–4** 直至 queue 清空或達運維 cap（每日請求上限 DEC／ops 另記）。

**限速 [Likely]：** 初期 **≤30 parties 搜／小時**（可調）；全量 16k ≈ **數週** 離線，唔影響 runtime search。

---

## KPI（內部）

| 指標 | 方向 |
|------|------|
| Queue 完成率 | `processed / total` MWC |
| 候選增量 | J5 新 `caseRef`／merge 後總數 |
| D2 keep 率 | keep ÷ 候選（precision） |
| Gold／spot MWC 被告 | 已知案在 DB 命中率 |
| DB `official_legal_events` | 被告行數 ↑（非目標 =16k） |

---

## 命令

```bash
pnpm j5:build-queue
pnpm j5:fetch-parties --limit=20          # pilot
pnpm build:judgment-candidates
pnpm d2:prep && pnpm d2:import-keep     # 有新 keep 時
```

---

## 相關

- [judgment-d1-full-crawl.md](./judgment-d1-full-crawl.md)（keyword 軌）
- [judgment-d2-mwc-defendant-scope.md](./judgment-d2-mwc-defendant-scope.md)
- [lrs-judgment-discovery-rules.md](../design/lrs-judgment-discovery-rules.md)（Parties 欄位）
