# DEC-0007: Dual-track evaluation, Q3 phone Serp, RiskReport 2.2.0

- **Status:** ACCEPTED
- **Date:** 2026-10-14
- **Plan:** [`pipeline-v2.2.0-practical-landing.md`](../plans/pipeline-v2.2.0-practical-landing.md)

## Context

`reportVersion` 2.1.0 fixed honesty (retrieval SSOT, zero-highlight caps) but **MWC-registered + zero public dispute** still shows **grade C**, which users read as “medium risk.” Product goal: separate **compliance** vs **reputation**, expose **data saturation**, and support **phone-anchor** retrieval without policy A breach.

## Options

| Option | Pros | Cons |
|--------|------|------|
| A — UI copy only | Small diff | Does not change API semantics |
| B — `evaluation` block + calibration v2 + optional Q3 | Addresses C black hole; traceable SSOT | Schema bump; grading sign-off; +1 Serp when phone present |
| C — New `target` schema rename | Clean names | Breaking API/UI |

## Decision

**B.** Keep `entity`; add `evaluation`; mirror top-level `grade` / `confidence`.

### Schema (`reportVersion: 2.2.0`)

- Cache miss on `reportVersion !== 2.2.0` (same pattern as DEC-0004/0006).
- Required `evaluation`: `overallGrade`, `displayGradeZh?`, `confidence`, `dataSaturation`, `complianceTrack`, `reputationTrack`.
- `licenseStatus`: `active | not_found | ambiguous` only (no `expired` until MWC has expiry data).
- `signals.retrievalEvidence[].matchReason`: `entity_token | phone_anchor`.
- `signals.actionableClauses[]` (may be empty); launch **open** with checklist (DEC-0004).
- Optional highlight fields: `incidentType`, `approxYear`, `factSummary`.
- `entity.normalizedPhone` when user supplied phone (no extra logging of full number).

**Mirror:** `report.grade === evaluation.overallGrade` and `report.confidence === evaluation.confidence` (calibration v2 is sole authority).

**Display:** `displayGradeZh` may show B+ / C+ while `overallGrade` stays A–F.

### Serp Q3 (production)

- **When:** normalized 8-digit HK phone present on input (with or without company name).
- **Not when:** company/BR only — product may prompt user to add phone for better coverage.
- **Query:** quoted phone + renovation/risk terms; **no** 「黑店」 in Serp strings (`renocheck-product`).
- **Budget:** +1 page (10 results), third try/catch in `fetchWebSearchHitsForEntity`; total Serp requests still capped per existing env (e.g. ≤4).

### L1

- OR: existing entity tokens (+ `entityL1MustIncludeAny` where defined) **or** full normalized phone in title/snippet/url.
- Policy A unchanged: only L1-bound hits to LLM.

### Calibration

- Replace `calibrateLlmRiskSlice` as **sole** grade path with **`calibrateEvaluation` v2** (see Appendix A).
- **Supersedes** DEC-0004 Appendix A for grading outcomes (themes/summary honesty rules may be merged into v2).
- Keep: no 「無風險」on zero evidence; D–F require verified highlights thresholds; M2 URL ⊆ L1.

### Compliance

- MWC + no dispute → may be **overallGrade B**, `dataSaturation: sparse` — UI must say **未檢出公開糾紛**, not “safe.”
- **Human sign-off** required on grading matrix + user-facing Badge copy before production promote (`compliance-legal`).

## Consequences

- Implement per plan PRs P1–P6; update `MVP.md`, `pipeline-ssot.md`, live/golden eval fixtures.
- DEC-0003: Q3 amendment documented in plan; Q2 conjunctive quotes unchanged.
- DEC-0006: `matchReason` on evidence rows.

## Reversal

- Lower `REPORT_VERSION` handling; remove `evaluation`; restore calibration v1; disable Q3 in `buildEntitySearchQueries`.

## Triggers to reconsider

- MWC import adds class/expiry → extend `licenseStatus` / `registrationClass` via new DEC.
- Serp quota or noise from Q3 → tighten phone match or reduce pages.

---

## Appendix A — Calibration matrix (v2.2.0)

Deterministic layer after LLM + M2. LLM `disputeLevel` / counts are **inputs**, not final authority.

| Condition | overallGrade | displayGradeZh (typical) | confidence | dataSaturation | disputeLevel |
|-----------|--------------|---------------------------|------------|----------------|--------------|
| MWC active, bound=0, hl=0 | B | B+ | medium | sparse | none_detected |
| No MWC, bound=0, hl=0 | C | C | low | unindexed | none_detected |
| bound≥1, hl=0 | C | C+ | low | moderate | none_detected |
| hl=1, all >2y ago | C | C | medium | moderate | historical_isolated |
| hl=1, recent (≤2y) | C | C | medium | moderate | active_concerning |
| hl=2, recent dispute | D | D | high | rich | active_concerning |
| hl≥3 or severe pattern | E–F | per severity | high | rich | severe |

- **Recent:** `approxYear` parseable and within 2 years of report `generatedAt`; unknown year excluded from `recentDisputeCount`.
- **D–F:** at least **2** verified highlights (post-M2) with dispute `incidentType` or dispute themes unless table row says hl=1 recent → C only.
- **summaryZh:** calibration may override; no implied「無風險」when saturation is `sparse` or `unindexed`.

*Supersedes DEC-0004 Appendix A (uniform C on zero highlights).*

---

## Appendix B — Product defaults (plan §10, formalized 2026-10-14)

| # | Decision | ACCEPTED default |
|---|----------|------------------|
| 1 | **Q3 Serp trigger** | Run when **normalized 8-digit HK phone** is present on input (may run alongside company-name queries). |
| 2 | **B+ / C+ display** | **`evaluation.displayGradeZh`** for presentation; **`evaluation.overallGrade`** (and mirrored `grade`) remain **A–F** only. |
| 3 | **Entity naming** | **Keep `entity`** (no `target` rename); optional `entity.normalizedPhone` when user supplied phone. |
| 4 | **MWC class / expiry** | **Out of scope for v2.2.0**; `licenseStatus` is **`active | not_found | ambiguous`**; show `registration_no` from MWC when matched. `registrationClass` and `expired` deferred until import or new DEC. |

P1 implements schema + `evaluation` skeleton; calibration v2 (Appendix A outcomes) lands in **P5**.
