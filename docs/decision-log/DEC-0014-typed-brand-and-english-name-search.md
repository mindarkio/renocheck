# DEC-0014: Typed brand and register English name in search

- **Status:** accepted
- **Date:** 2026-10-25
- **Amends:** query budget note in [DEC-0002](DEC-0002-search-query-pack-l1.md) and [DEC-0003](DEC-0003-serp-q2-loose-short-entity.md)

## Context

After an MWC hit, web search used only the Chinese legal name and that name with「有限公司」removed. L1 bound the legal name or a 6-character prefix of it. A typed brand such as 齊來設計 for 齊來設計居+屋有限公司 never became a query or an anchor, and the unquoted `+` in Q2 was not a literal match. English register names were not searched, and the 6-character prefix chopped them. Contains-lookup returned whichever row Postgres sent first.

## Decision

Keep the default Serp HTTP budget (Q1×2 + Q2×1 = 3, plus Q3×1 when a phone is present). When a distinctive typed brand and/or a register English name exists, add **one** alias query and drop Q1 from 2 pages to 1. If `SERP_PAGE_COUNT` is already 1, put the alias phrases into Q2's entity part as one flat OR group instead of adding a request.

- Typed text is an alias only when it is a substring of the matched legal name (Chinese or English), the register lookup was **not ambiguous** (only one row contains the input), and it is not a generic fragment (under 4 CJK characters, under 6 Latin characters, or only trade words such as 裝修 / 設計 / 工程 / 家居 / 建築 / 機電, Simplified forms included, before or after removing「有限公司」). A Latin-only typed alias must equal the whole register English name without its legal suffix (Limited / Ltd). This keeps another firm's posts from binding to the one row we picked.
- Names containing `+`, `&`, or `/` are quoted in Q2 so Google matches them literally. Parentheses keep the DEC-0003 conjunctive form because `looseEntityCoreTerms` already turns them into spaces.
- English names are not truncated to 6 characters. L1 and public-link matching are case-insensitive.
- The register `company_name_en`, when present and not itself only trade words, is an alias phrase and an L1 anchor.
- When several register rows contain the input, keep a single row: exact match, then prefix match, then shortest `company_name`. `ambiguous` stays true whenever two or more rows match. No picker UI.

No change to `REPORT_VERSION`, `DISCLAIMER_VERSION`, grading, prompts, or user-facing copy.

## Consequences

- Default company-name search stays at 3 Serp requests. With a phone it stays at 4. The alias replaces Q1's second page rather than adding a call.
- Contains ranking reads at most 20 rows. When that window is full, exact and prefix are queried again and merged. The globally shortest name among more than 20 contains-matches is not guaranteed.

### Index not added

`ILIKE '%term%'` cannot use the existing btree on `company_name` / `company_name_en`. A later change could add `pg_trgm` GIN indexes on `lower(company_name)` and `lower(company_name_en)` plus an SQL `ORDER BY` (exact, then prefix, then `char_length(company_name)`) so ranking does not depend on a 20-row window. This change does not migrate.

## Reversal

Remove the alias step in `planEntityWebSearches` and return `rows[0]` from the contains lookup.

## Triggers to reconsider

- Alias queries crowd out useful Q1 second-page results on the gold set.
- Generic-fragment misses a real short brand often enough to widen the floor.
