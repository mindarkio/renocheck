# DEC-0004: Trustworthy report fields and launch open access

- **Status:** accepted
- **Date:** 2026-10-13

## Context

Users need to verify **who** was searched, **what evidence** backed the summary, and **when uncertainty applies** (policy A: no unfiltered Serp hits to the LLM). Production also preferred user `companyName` over MWC for Serp labels, conflicting with `docs/design/search-evidence.md` §3. Premium stripping hid `contractChecklist` when there were zero highlights; launch phase should not gate URLs or checklist.

## Options

| Option | Pros | Cons |
|--------|------|------|
| A — UI copy only | Small diff | Serp still wrong label; cache stale shape |
| B — Schema + MWC-first Serp + open API + `reportVersion` cache bump | Auditable, aligned with design | Schema migration; old cache misses |

## Decision

**B.**

- **`reportVersion`:** `2.0.0` (`REPORT_VERSION`); cached reports without matching version are ignored (cache miss).
- **Entity:** `queryEcho`, `searchLabelUsed`, `nameAlignment` (`match` \| `mwc_authoritative` \| `user_only` \| `ambiguous`).
- **Signals:** `boundHitCount` (post-L1), `contractChecklist` (always present); `serpHitCount` unchanged (raw merged).
- **Serp/L1 label:** When MWC row exists, use `mwc.company_name` via `resolveAuthoritativeSearchLabel`.
- **MWC ambiguity:** `companyName` lookup with `limit(2)` → `ambiguous` + force `confidence` to at least `low`.
- **Launch:** No premium stripping; full `RiskReport` from API. Monetization deferred; `premium` optional field deprecated for new writes.

## Consequences

- `entity-report-context.ts`, `lookupMwcWithMeta`, ReportCard「本次查證範圍」, `pnpm eval:report-quality` (mock golden by default).
- Reversal: revert schema fields; lower `REPORT_VERSION` handling; restore strip if paywall returns.

## Triggers to reconsider

- Paywall launch → new DEC for which fields are gated (must not hide entity transparency).

## Appendix A — Phase 2 grading calibration (2026-10-13)

**Superseded for grading outcomes by [DEC-0007 Appendix A](DEC-0007-dual-track-v2-2-0.md)** when `reportVersion >= 2.2.0`. Below remains historical for 2.0.x–2.1.x.

Implemented in `risk-report-calibration.ts` (post-LLM, **downgrade only**):

- `highlights.length === 0` → grade set to **C** (no A/B without evidence, no D–F)
- `boundHitCount === 0` and `serpHitCount > 0` → capped at **C**
- **D–F** only if `highlights.length >= 2` and a dispute-related theme (超支/爛尾/糾紛/投訴/苦主/溝通/工程質素)
- Themes: strip「未檢出相關討論」when `boundHitCount > 0` or `llmHitCount > 0` or highlights present
- `llmHitCount > 0` and no highlights → `confidence` low + neutral summary override (≤120 字)
- Zero highlights and `boundHitCount === 0`: replace summaries that imply「無風險／暫無風險」with cautious copy (P2-E live review)

Human review: product owner sign-off on launch PR implementing P2-A (grading logic change per `compliance-legal`).
