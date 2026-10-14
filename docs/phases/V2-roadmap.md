# Phase roadmap (governance and engineering)

## MVP (current)

- **Governance:** `docs/MVP.md` + DEC for major forks; ~10 Cursor rules.
- **Tech:** Next.js, Supabase, Serp/CSE, gpt-4o-mini, `search_cache`, `/api/search`.
- **Tests:** schema, phone normalize, search handler unit tests.
- **Not yet:** Stripe, E2E suite, SBOM, MRL numbering, zip handoff packages.

## V2 triggers

Start when **paid unlock (Stripe)** or **public marketing launch** is committed.

| Area | Add |
|------|-----|
| Requirements | `docs/requirements/MRL.md` with `RNCK-REQ-nnn` |
| **Company intelligence** | Persistent **entity** (phone / BR / name resolution) decoupled from `mwc_contractors`; **risk assessment snapshots** (grade, confidence, signals) over time; **extended history** (Phase 1.5 official sources e.g. court/customs stubs, curated web-signal archives with retention/ToS policy). MVP `search_cache` remains ephemeral; V2 defines what is durable vs re-fetched on search |
| Payments | `payments` flow + scoped rule or DEC |
| Quality | E2E (Playwright or similar), dependency audit |
| Supply chain | SBOM on release |
| Abuse | WAF / rate limits DEC (Vercel Firewall) |
| Observability | Optional `observability` rule: Sentry, PII-safe logging |

## V3 triggers

B2B badge, contractor appeals, richer audit log, optional multi-agent lock docs.

## Anti-pattern

Do not import V2/V3 capabilities early for “enterprise feel” — see `architecture` YAGNI section.
