# Phase roadmap (governance and engineering)

## MVP (current)

- **Governance:** `docs/MVP.md` + DEC for major forks; ~10 Cursor rules.
- **Tech:** Next.js, Supabase, Serp/CSE, Gemini for company reports (prod `gemini-3.5-flash-lite`, Gateway `gpt-4o-mini` only if the Google key is absent), `search_cache`, `/api/search`. Quote analysis is Azure OpenAI, not this path (DEC-0013).
- **Tests:** schema, phone normalize, search handler unit tests.
- **Not yet:** payments (quote credits via Airwallex HPP come with DEC-0013 F5), E2E suite, SBOM, MRL numbering, zip handoff packages.

## V2 triggers

Start when **paid unlock (Stripe)** or **public marketing launch** is committed.

| Area | Add |
|------|-----|
| Requirements | `docs/requirements/MRL.md` with `RNCK-REQ-nnn` |
| **Company intelligence** | Persistent **entity** (phone / BR / name resolution) decoupled from `mwc_contractors`; **risk assessment snapshots** (grade, confidence, signals) over time; **extended history** (Track 1 legal events per [`track1-official-extensions-roadmap.md`](track1-official-extensions-roadmap.md) v1.0–v1.2, plus curated web-signal archives with retention/ToS policy). MVP `search_cache` remains ephemeral; V2 defines what is durable vs re-fetched on search |
| Payments | `payments` flow + scoped rule or DEC |
| Quality | E2E (Playwright or similar), dependency audit |
| Supply chain | SBOM on release |
| Abuse | WAF / rate limits DEC (Vercel Firewall) |
| Observability | Optional `observability` rule: Sentry, PII-safe logging |

## V3 triggers

B2B badge, contractor appeals, richer audit log, optional multi-agent lock docs.

## Anti-pattern

Do not import V2/V3 capabilities early for “enterprise feel” — see `architecture` YAGNI section.
