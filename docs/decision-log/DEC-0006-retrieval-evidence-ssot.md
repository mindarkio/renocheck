# DEC-0006: Deterministic retrieval evidence on RiskReport (M1 SSOT)

- **Status:** accepted
- **Date:** 2026-10-13

## Context

Users need a **verifiable SSOT**: URLs and excerpts for L1-bound hits, not only `boundHitCount` and LLM `summaryZh`. Policy A unchanged — evidence comes from **post-L1** hits only.

## Decision

- **`reportVersion`:** `2.1.0`; cache miss on older versions.
- **`signals.retrievalEvidence[]`** (required, may be empty): `url`, `title`, `snippetExcerpt` (truncated), `matchedToken` — filled in **pipeline** from `filterWebSearchHitsForLlm` output, not from LLM.
- **Launch:** Full array in API and `ReportCard` (DEC-0004 open access).
- **M2:** `enforceHighlightEvidenceAlignment` — `highlights[].url` must ⊆ L1 hit URLs; rejected URLs log `highlight_url_rejected`.

## Consequences

- `buildRetrievalEvidence` in `search-evidence-filter.ts`; pipeline merges after LLM.
- `pnpm eval:report-quality` may assert `minRetrievalEvidence` on live/golden fixtures.

## Reversal

Remove field; bump or lower `REPORT_VERSION` handling per DEC-0004 pattern.
