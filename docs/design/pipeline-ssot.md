# Pipeline 可信與報告 SSOT

**North star（產品目標，唔等同「可以發布」）：**  
`POST /api/search` 產出的 **`RiskReport` 係用戶可查證、可對照來源嘅單一真相（SSOT）** — 可靠、前後一致，而唔係只得一句 LLM 摘要。

**政策 A（不變）：** 未過 L1 的 Serp hit **唔**送 LLM。SSOT 唔靠「送更多 raw 入模型」充數。

---

## 用戶應能從一份 report 回答

| # | 問題 | SSOT 要求 |
|---|------|-----------|
| 1 | 查緊邊個？ | `queryEcho`、`searchLabelUsed`、`nameAlignment`、MWC 匹配狀態一致；UI「本次查證範圍」同 API 相同 |
| 2 | 憑咩講？ | 每句摘要可對應 **structured evidence**（URL／摘錄／match 理由）或明確「今次檢索內無可引用討論」；**唔**用 narrative 代替列表 |
| 3 | 唔肯定時 | `evaluation` 雙軌 + `dataSaturation`；`grade`／`confidence` 由 **`risk-report-calibration-v2.ts`** mirror；MWC+零糾紛 → **中性 C** + `sparse`（唔寫「無風險」；B+ 已棄用，評級命名 scope 另定） |

**LLM：** 摘要與 highlight **不得**成為唯一真相；校準 v2 在 M2 之後裁定 grade／`evaluation`／summary（DEC-0007；2.1.x 見 `risk-report-calibration.ts`）。

---

## 技術 SSOT（已具備）

- **單一路徑：** `runSearchPipeline` → `report-schema.ts` → cache（`reportVersion` miss 舊形狀）
- **本次查證範圍（DEC-0015）：** 名冊有對上，而且 `queryEcho` 同 `entity.displayName` 喺去掉空白同全形之後唔同，報告藍底標題下先顯示「你輸入…／名冊名稱…」。呢行係現有欄位嘅呈現，唔加新 JSON 欄位，所以唔因此改 `REPORT_VERSION`。
- **量度：** `pnpm eval:report-quality`（golden）、`pnpm eval:report-quality --live`（[`report-quality-live.json`](../../scripts/fixtures/report-quality-live.json)）、`pnpm eval:search-evidence`（retrieval）、`pnpm mwc:spot-check`
- **誠實層（Phase 2）：** 零 highlight 唔 A/B/D–F；bound 與 themes／summary 一致（[`pipeline-trust-phase-2.md`](../plans/pipeline-trust-phase-2.md)）

---

## 與 north star 嘅差距（刻意記錄，避免自滿）

- 多數 case **`highlights.length === 0`** → 用戶 **冇可逐條點開嘅討論 SSOT**，只有計數與摘要
- Gold dispute case（如源始）可能 **`boundHitCount === 0`** → report 只代表「今次 L1 未綁定」，唔代表網上無公開討論
- 同名／弱相關 bound hit 可能 **有 bound、無 highlight** — 需 evidence 列表或更嚴 L1（DEC 驅動）
- **公開連結：** `retrievalEvidence` 可以短過 `boundHitCount`。分檔仍用 L1 全數；連結清單只留具體經驗、糾紛、有細節嘅讚揚，或新聞／法庭／名冊訊號（`public-link-signal.ts`）。純提問、招聘、清單文唔展示。討論摘要仍由 LLM 睇完整 L1；純提問本身無可引用事件，唔會因此產生摘要。

**M1（DEC-0006）：** `signals.retrievalEvidence[]` — pipeline 從 L1 hits 填入；API/UI 全開放。  
**M2：** highlight URL ⊆ L1 hits（`highlight-evidence-alignment.ts`）。  
**M3/M4：** L1 括號 + **NFKC 數字**（MWC 全形２１ ↔ 論壇「21」）；live eval `goldEvidenceUrlSubstrings`（源始等 gold case）。

---

## 達標定義（建議用作 DEC／驗收）

1. **Gold dispute 集（N 條）：** `boundHitCount ≥ 1` **且** report 含 ≥1 條可點擊／structured evidence，摘要只可引用該 evidence  
2. **零討論集（M 條）：** grade ≤ C、confidence low、無「無風險」語、明確檢索範圍  
3. **重跑：** 同一 fingerprint + `refresh` 在 documented Serp 波動外，evidence 集合唔應無解釋地漂移  

發布前人工表：[`checklists/report-quality-human-signoff.md`](../checklists/report-quality-human-signoff.md)（補充 SSOT，唔代替 evidence 驗收）。
