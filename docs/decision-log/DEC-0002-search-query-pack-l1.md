# DEC-0002: Search query pack (Q1+Q2) and L1 entity binding

- **Status:** accepted
- **Date:** 2026-03-25

## Context

Production used a single Serp query (Q1) and sent all organic hits to the LLM, causing high `serpHitCount` with `discussionCount: 0`. Eval showed Q2 helps recall on some fixtures; L1 filtering is specified in `docs/design/search-evidence.md` but was not implemented.

## Options

| Option | Pros | Cons |
|--------|------|------|
| A — Q1 only, prompt-only fix | No extra Serp cost | Does not fix junk hits |
| B — Q1+Q2 merge, L1 filter, 4 Serp req/search | Better recall + less LLM noise; same budget as Q1×2 pages | More code; L1 may drop posts without company name in snippet |
| C — Q3/aliases in production | Higher recall on edge cases | Exceeds 4-request budget; needs another DEC |

## Decision

**B.** Production runs Q1 then Q2 sequentially (each `SERP_PAGE_COUNT` pages, default 2 → 4 Serp requests total). Q1 `site:` includes `threads.net` / `threads.com`. Before LLM: soft L0 host ordering + hard L1 token match + cap (`SERP_LLM_HIT_CAP`, default 15). If Q2 fails after Q1 succeeded, log and continue with Q1 results only; if Q1 fails entirely, `serp_failed`.

**serpHitCount contract:** `signals.serpHitCount` = merged deduped **raw** organic count (UI「已檢視…條」). LLM receives **filtered** hits only.

**Token heuristics:** At most 1–2 hard-coded alias rules for eval-validated cases (e.g. 良心裝修 → 良心裝修佬). Not a merchant blacklist table.

**Compliance:** No change to `/legal/*`. Product copy remains neutral public-summary wording; fixtures are retrieval eval only, not accusations.

## Consequences

- `fetchWebSearchHitsForEntity`, `search-evidence-filter`, `search-entity-labels` in `src/lib/`.
- Eval script gains **Prod** column (production path + L1); Q3 remains eval-only experiment.
- Reversal: revert pipeline to single Q1 and remove L1 filter.

## Reversal cost

Low–medium: one pipeline revert; cached reports may need refresh.

## Triggers to reconsider

- Prod eval mustInclude &lt; 1/2 on dispute fixtures for two consecutive weeks.
- Serp 503 rate forces sequential pages or budget increase (new DEC).
