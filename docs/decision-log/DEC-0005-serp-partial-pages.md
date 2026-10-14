# DEC-0005: Serp per-page partial success (P2-D)

- **Status:** accepted
- **Date:** 2026-10-13

## Context

`fetchSerpOrganicHits` used `Promise.all` over pages; one failing page (timeout, HTTP error) aborted the entire query and often the full search (`serp_failed`), even when page 0 had results.

## Decision

- Fetch Serp pages **sequentially** with **per-page try/catch**.
- Log `serp_page_failed` per failure; log `serp_partial` when `pages_ok > 0` and `pages_failed > 0`.
- Throw `serp_failed` only when **all** requested pages for that query fail (`pages_ok === 0`).
- `fetchWebSearchHitsForEntity`: Q1 and Q2 each wrapped in try/catch (Q2 behavior unchanged); Q1 total failure no longer blocks Q2.

## Consequences

- Fewer整單 503 on transient Serp/page errors; may return fewer organic hits than full pagination.
- Reversal: restore `Promise.all` strict fail-fast in `fetchSerpOrganicHits`.

## Out of scope

- Extra Serp requests beyond DEC-0002/0003 budget.
