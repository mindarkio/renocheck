# DEC-0008: Serper as primary web search provider

- **Status:** ACCEPTED
- **Date:** 2026-10-14

## Context

Production uses Google organic SERP via **SerpAPI** (`SERPAPI_KEY`). Cost per search (Q1×pages + Q2 + Q3 + brand retry) is high; quota exhaustion blocks pipeline. **Serper** (`google.serper.dev`) offers lower per-query pricing for the same query strings.

## Decision

- **Primary:** `SERPER_API_KEY` → Serper POST `/search` when set.
- **Fallback:** `SERPAPI_KEY` when Serper unset, or when `SERP_PROVIDER=serpapi`.
- **Override:** `SERP_PROVIDER=serper|serpapi` forces provider when the matching key exists.
- **Unchanged:** Q1/Q2/Q3/brand-host query strings, L1, Policy A, page counts (`SERP_PAGE_COUNT`, etc.), `gl`/`hl` via `SERP_GL` / `SERP_HL` (default `hk` / `zh-HK`). SerpAPI-only `SERP_GOOGLE_DOMAIN` still applies to SerpAPI path.

## Performance expectation

**Not guaranteed identical** to SerpAPI — both proxy Google; rank/snippet variance is normal. Validate with `pnpm eval:search-evidence` and `pnpm eval:report-quality --live` after switching keys.

## Consequences

- `src/lib/search-provider.ts` + dual fetch in `web-search.ts`; logs include `provider`.
- `.env.example`: `SERPER_API_KEY` documented; remove or empty `SERPAPI_KEY` in prod to avoid accidental double billing.
- Reversal: unset `SERPER_API_KEY` or set `SERP_PROVIDER=serpapi`.
