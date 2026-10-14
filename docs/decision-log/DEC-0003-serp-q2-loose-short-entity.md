# DEC-0003: Production Q2 loose short-entity query

- **Status:** accepted
- **Date:** 2026-03-25
- **Supersedes:** Q2 portion of DEC-0002 (quoted broad Q2 in production only)

## Context

Eval showed quoted full-name Q2 rarely surfaces forum gold (e.g. LIHKG thread ids) and fails on bracketed legal names (源始（國際）). Q3 loose query improved recall on some fixtures but was eval-only.

## Decision

**Production Q2** uses **unquoted short entity** terms (`buildWebSearchQueryLoose`), not `buildWebSearchQueryBroad`.

**Page budget (default):** Q1 = `SERP_PAGE_COUNT` (default 2 pages); Q2 = `SERP_Q2_PAGES` (default **1** page). Total ≤4 Serp requests when `SERP_PAGE_COUNT=2`.

**Eval:** Legacy strategies Q1/Q2/Q1+Q2 still use quoted Q2 (`buildWebSearchQueryBroad`) for regression; **Prod** column uses production pack.

**L1:** Match tokens for 源始 use bracket variants only — **not** bare `源始` (avoids 物種源始／源始火花). `entityL1MustIncludeAny` requires 國際／設計及裝修 company phrasing in snippet.

## Consequences

- Better chance of matching how posts name companies; may increase noise — L1 + LLM unchanged.
- Reversal: restore `buildWebSearchQueryBroad` in `buildEntitySearchQueries`.

## Amendment (2026-10-13, M3)

When `looseEntityCoreTerms` yields **≥2** tokens, production Q2 uses **conjunctive quoted** tokens (e.g. `"源始" "國際" "設計及裝修" 裝修 …`) to cut off-topic Serp on ambiguous loose queries. Single-token cores unchanged.

**2026-10-14 amendment:** Labels containing **源始** use `resolveBrandSerpSearchPhrase` → `"源始（國際）設計及裝修公司"` for Q1/Q2 (forum/news copy omits「有限公司」); conjunctive Q2 skipped for that brand. L1 tokens/anchors include `…設計及裝修公司` variants. Serp uses `google_domain=google.com.hk` by default (`SERP_GOOGLE_DOMAIN` override).

## Out of scope

- Third production query, CSE, scraping.
