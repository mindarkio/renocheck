# D2 覆蓋目標 — MWC 作被告（owner 2026-10-16）

**狀態：** active（產品方向；實作跟 D2）  
**North star：** 盡量覆蓋 **名冊內 MWC 作被告** 嘅公開判詞紀錄；**原告** 唔作覆蓋目標（可唔入庫／唔展示）。

**輸入 raw：** [`judgment-d1-crawl-run-2026-10-16.md`](./judgment-d1-crawl-run-2026-10-16.md) — **174** `caseRef` 候選（會再增）。

---

## 覆蓋定義（可驗收）

| 要 | 唔要 |
|----|------|
| 某 MWC（BR／登記名／可核對 alias）在公開判詞中為 **被告**（或審裁處慣用「被申索人／答辯人」等 → 對應 `defendant`） | MWC 為 **原告**（追客戶款等）— **pass**，唔計入覆蓋 KPI |
| 與委聘承辦商情境相關（裝修／工程合約／滲水等 — D2 規則定稿） | 刑事、純勞資、業主立案法團對外（除非被告係 MWC 承辦商） |
| 一宗案 → 一條或多條 DB 行（每個 **match 到嘅 MWC 被告** 一行） | 暗示「全港每一宗針對 MWC 嘅官司已齊」 |

**誠實界 [Certain]：** 仍會 miss — 判詞用經營名、唔喺 MWC、拼寫差、D1 未收錄嘅案。目標係 **高 recall 被告+MWC**，唔係法律上「零漏」。

---

## DEC-0012

**2026-10-16 已 amend：** 入庫／lookup **僅被告**；原告 pass — 見 DEC-0012 §4、Appendix B.2。執行細則：[`judgment-d2-cleaning.md`](./judgment-d2-cleaning.md)。

---

## 建議 pipeline（唔靠 keyword 代表公司）

```text
D1  案件池（keyword 只負責「搵案」，唔負責「MWC 歸屬」）
      ↓
D2a 每宗：caseRef、parties 結構化、揀 **被告方** 字串
D2b 被告方 ↔ mwc_contractors：
      1) br_normalized 精確（判詞或 enrich）
      2) company_name_normalized / 經營名 / lookupAliases
      3) 弱 match → 唔入庫（DEC-0012）
D2c 僅 partyRole=defendant + renovationRelevant → seed → import
D2d（audit）未 match 任何案的 MWC 子集 → 可選 LRS Parties forward（分批），只保留被告命中
```

**Keyword 仍會 miss 案**；補 recall 靠 **加大 D1 池** + **D2b 對名** + **audit forward**，唔靠「裝修」一字涵蓋全港。

---

## KPI（內部）

| 指標 | 方向 |
|------|------|
| Recall（gold 清單） | 已知 MWC 被告案（人手 gold）在 DB 命中率 ↑ |
| Precision | 入庫行 `partyRole=defendant` 且 MWC match 可解釋 |
| 原告比例 | 入庫應 ~0（除非之後改 scope） |

Gold 可從 183 候選 + 現有 15 seed 被告案擴充。

---

## 現有 15 seed

燊記類 **原告** 案（如 HCSA 59/2014）在 **新 scope** 下可 **剔除或標記不 import**；保留 **被告** 案（如 HCSA 57/2024）。重跑 D2 時一併清理。

---

## 下一步（工程）

1. **J5 主軌** — [`judgment-j5-mwc-parties-coverage.md`](./judgment-j5-mwc-parties-coverage.md)（`pnpm j5:build-queue` → `j5:fetch-parties` → build → D2 import）  
2. **D1 keyword 副軌** — 補齊 Tier A+B HTML，擴候選池  
3. D2 批次 `import-keep` + review queue；覆蓋 KPI 用 gold／spot，唔用 DB 行數 =16k
