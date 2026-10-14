# DEC-0010: User-facing risk bands (方案 A) and「良好」准入

- **Status:** ACCEPTED
- **Date:** 2026-10-14
- **Amendment (2026-10-14):** User-facing enum **繁體**；第四檔由「良好」改為 **`未見負面摘要`**；產品文案避免「信用」，改「風險參考」；`DISCLAIMER_VERSION` 1.1.0。
- **Supersedes (display only):** DEC-0007 Appendix A / `displayGradeZh` as **primary** user label; `overallGrade` A–F remains internal until a later DEC removes it.

## Context

Owners need a **single readable risk label** (繁中), not A–F school-style grades. Quiet cases must **not** read as positive (no B+ / no「无负面=好」).「良好」may be shown but only with **evidence of praise and no dispute** in bound retrieval. Inspiration: **credit-bureau style tiering** (clear gates, thin file ≠ good) — **not** a TransUnion report or credit score.

## Decision

### User-facing primary label

Expose **`evaluation.riskBandZh`** (enum below). Report UI **header + 綜合參考** use `riskBandZh`; A–F may remain in API for compatibility but are not primary copy.

| `riskBandZh` | User meaning |
|--------------|--------------|
| `风险偏高` | Multiple or severe verifiable dispute signals in scope |
| `风险中等` | Some dispute-related signals; not severe tier |
| `中性` | Search in scope did not support a positive or negative reputation conclusion |
| `良好` | Verifiable **praise** in scope and **no** dispute signals (strict gate) |

### Hard rules

1. **No bound → always `中性`**  
   `boundHitCount === 0` ⇒ `riskBandZh` **must** be `中性`, regardless of MWC match, `serpHitCount`, or official registration. MWC is shown only under **官方資質**, not via「良好」or lower risk.

2. **「良好」enabled at launch** with deterministic + calibration gates (Appendix A). No praise evidence ⇒ **must not** assign `良好`.

3. **No implied endorsement**  
   Copy must not state「无风险」「放心选用」「推荐」. `良好` =「检索范围内见赞扬、未见纠纷提及」，非品质保证。

4. **Not TU / not credit**  
   All surfaces: reference to **public sources** only; disclaimer that this is **not** a credit report or TU rating.

### Internal mapping (v1)

Calibration v2 (or successor) computes `riskBandZh` **after** L1 evidence counts and highlight/dispute signals:

| Condition (evaluated in order) | `riskBandZh` |
|--------------------------------|--------------|
| `boundHitCount === 0` | `中性` |
| Dispute: severe matrix row OR ≥3 dispute-bound hits OR highlights meet severe rules | `风险偏高` |
| Dispute: active/moderate (bound dispute and/or highlights) | `风险中等` |
| Praise gate passes (Appendix A) and no dispute | `良好` |
| Else (bound > 0, no dispute, no praise) | `中性` |

`overallGrade` A–F may mirror bands for cache/tests until DEC retires letter grades:

| `riskBandZh` | Suggested `overallGrade` (internal) |
|--------------|-----------------------------------|
| 风险偏高 | D–F (by severity) |
| 风险中等 | C |
| 中性 | C |
| 良好 | B |

(Display must **not** show B+ optimism for quiet MWC; band text wins.)

### Schema (target)

```ts
riskBandZh: z.enum(["风险偏高", "风险中等", "中性", "良好"])
```

Optional: `riskBandConfidence` or reuse `evaluation.confidence` with band-specific copy.

### Implementation order (engineering)

1. `praise-signals.ts` (or `search-evidence-filter`) — `boundHitsHavePraiseSignal`, `countBoundPraiseSignals`  
2. `risk-band-calibration.ts` — single function `resolveRiskBandZh(...)` called from pipeline after v2 calibration  
3. `report-schema` + `ReportCard` — primary label = `riskBandZh`  
4. Gold: add/update fixture with synthetic praise snippet; quiet cases assert `riskBandZh === "中性"`  
5. Retire primary UI use of `displayGradeZh` / A–F header

### Compliance copy (minimum)

- `良好` tooltip/banner: 「仅反映本次检索范围内公开讨论摘要，不包括未收录来源，不构成推荐。」  
- Footer/disclaimer: unchanged MVP legal page; add one line on non-credit nature if legal approves.

## Appendix A —「良好」准入

**All required:**

| # | Rule |
|---|------|
| A1 | `boundHitCount >= 1` |
| A2 | `boundDisputeHitCount === 0` (same dispute pattern as calibration v2 snippets) |
| A3 | `boundPraiseHitCount >= 1` (title+snippet match praise lexicon v0) |
| A4 | If only LLM highlights (no praise in snippet), highlight must cite praise **and** URL ∈ bound set |
| A5 | Single praise hit ⇒ `confidence` **low**; label may show「良好（公开赞扬较少）」via `riskBandDetailZh` optional field |

**Praise lexicon v0 (substring, NFKC-normalized):**

`推荐`, `讚`, `赞`, `好評`, `好评`, `滿意`, `满意`, `用心`, `準時`, `准时`, `手工好`, `做工仔細`, `信得过`, `信得過`, `靠谱`, `靠譜`, `專業`, `专业`

(Exclude sarcasm handling in MVP; human review via retrieval links.)

**Explicit exclusions:**

- MWC registration alone  
- Company website / ads in SERP without third-party praise  
-「未检出投诉」  
- Generic「裝修公司」listing text without praise directed at entity

## Appendix B — TU-style principles (non-binding)

| Principle | Renocheck |
|-----------|-----------|
| Thin / no file ≠ high score | No bound ⇒ `中性` |
| Tier gates documented | This DEC + gold |
| Negatives weigh heavily | Dispute overrides praise |
| Separate「insufficient data」| `中性` + low confidence |

## Consequences

- DEC-0007 UI reliance on B+ / sparse optimism **deprecated** for user header.  
- `pnpm eval:report-quality` expectations gain `riskBandZh` where stable.  
- New praise lexicon changes require DEC appendix or version bump `praiseLexiconVersion`.

## Reversal cost

Medium — schema + UI + calibration; mapping table removable.

## Triggers to reconsider

- User research:四档仍难懂 → merge 中等/中性  
- Abuse: SEO praise spam → tighten L1 or praise sources allowlist  
- Legal:「良好」word banned → rename to「未见负面赞扬」tier

## Sign-off

- [x] Product / owner（2026-10-14，方案 A）  
- [x] Engineering（2026-10-14，`riskBandZh` + calibration + UI）  
- [x] Legal direction（2026-10-14）：弱化第四檔、去「信用」、繁體統一、B2C 責任限制；`/legal/disclaimer` 1.1.x（營運聯絡：hello@renocheck.homes）
