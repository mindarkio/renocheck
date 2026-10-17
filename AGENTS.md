# Renocheck — agent context

**Product:** HK renovation contractor risk search (owner-defense, not a marketplace).

## Start here

1. [`docs/MVP.md`](docs/MVP.md) — scope, data model, API contract  
1b. [`docs/design/search-evidence.md`](docs/design/search-evidence.md) — Track 2 retrieval / evidence（實作前）  
1c. [`docs/design/pipeline-ssot.md`](docs/design/pipeline-ssot.md) — pipeline 可靠與報告 SSOT（north star）  
1d. [`docs/plans/pipeline-v2.2.0-practical-landing.md`](docs/plans/pipeline-v2.2.0-practical-landing.md) — v2.2.0 雙軌評分／Q3／校準（draft）  
1e. [`docs/phases/track1-official-extensions-roadmap.md`](docs/phases/track1-official-extensions-roadmap.md) — Track 1 法律延伸 v1.0.0 判詞／v1.1.0 海關／v1.2.0 清盤  
1f. [`docs/plans/judgment-ingestion-execution.md`](docs/plans/judgment-ingestion-execution.md) — 判詞來源獲取與 DB 入庫（D1–D3 執行 SSOT）  
1g. [`docs/plans/judgment-j5-mwc-parties-coverage.md`](docs/plans/judgment-j5-mwc-parties-coverage.md) — J5：~16k MWC Parties 軸  
1h. [`docs/plans/track1-v1-0-execution.md`](docs/plans/track1-v1-0-execution.md) — Renocheck 1.0 判詞實作計劃（P0–P7）  
2. [Notion spec](https://app.notion.com/p/3f63e97febe9809ebb29c1fb43c3c331)  
3. [`docs/phases/V2-roadmap.md`](docs/phases/V2-roadmap.md) — what not to build early  
4. [`docs/development.md`](docs/development.md) — `pnpm dev` / test  
4b. [`docs/supabase.md`](docs/supabase.md) — project ref、link、env  
5. [`docs/ui-principles.md`](docs/ui-principles.md) — tokens and tone 
5b. [`docs/design/brand-identity.md`](docs/design/brand-identity.md) — logo 色板與 VI（`public/logo/overview.png`）  

**Work order:** MVP.md → relevant `.cursor/rules/` → code.

## YAGNI (summary)

1. Simplest path that satisfies MVP — stack changes need DEC or explicit approval.  
2. New npm dependency: state pain point and why built-in/platform is insufficient.  
3. Abstract on 3rd repetition or documented V2 need only.

Full text: `architecture` rule.

## Cursor rules index

| Rule | alwaysApply | Globs | Focus |
|------|-------------|-------|--------|
| `advisor-conduct` | yes | — | Critical advisor, certainty labels |
| `agent-execution` | yes | — | Test/validate after code; plan → self-review → execute |
| `pipeline-ssot` | yes | — | Report as user-verifiable SSOT |
| `renocheck-product` | yes | — | Scope, HK copy, monetization hooks |
| `compliance-legal` | yes | — | PDPO, snippets/ToS, human review gates |
| `security-secrets` | yes | — | Secrets, RLS, fingerprints |
| `architecture` | yes | — | YAGNI, pipeline, layout |
| `api-routes` | no | `src/app/api/**/*.ts` | `/api/search`, errors, premium strip |
| `llm-prompts` | no | `src/**/*.{ts,tsx}` | Single structured LLM call, grading |
| `software-engineering` | no | `src,supabase,scripts` | Schema, deps, MVP tests |
| `database-supabase` | no | `supabase/**` | Migrations, RLS |
| `release-verification` | no | `package.json`, `.github/**` | Pre-prod checklist |
| `frontend-ui` | no | `src/**/*.{tsx,jsx}` | Tokens, routes, a11y baseline |
| `testing` | no | `**/*.{test,spec}.ts` | Synthetic fixtures, schema sync |

Formal external handoff / audit: also read [`docs/ai-agent/AI-Agent-Generic-Prompt-20260827-rev4.txt`](docs/ai-agent/AI-Agent-Generic-Prompt-20260827-rev4.txt).

## When to write a DEC

See [`docs/decision-log/README.md`](docs/decision-log/README.md). Examples: search provider swap, grading schema, new PII, stack deviation, launch/pricing.

Plans: [`seo-aeo-geo-optimization.md`](docs/plans/seo-aeo-geo-optimization.md)（SEO／AEO／GEO；域名 renocheck.homes）。

Recorded: [`DEC-0001-lightweight-governance.md`](docs/decision-log/DEC-0001-lightweight-governance.md), [`DEC-0002-search-query-pack-l1.md`](docs/decision-log/DEC-0002-search-query-pack-l1.md), [`DEC-0003-serp-q2-loose-short-entity.md`](docs/decision-log/DEC-0003-serp-q2-loose-short-entity.md), [`DEC-0004-trustworthy-report-open-access.md`](docs/decision-log/DEC-0004-trustworthy-report-open-access.md), [`DEC-0005-serp-partial-pages.md`](docs/decision-log/DEC-0005-serp-partial-pages.md), [`DEC-0006-retrieval-evidence-ssot.md`](docs/decision-log/DEC-0006-retrieval-evidence-ssot.md), [`DEC-0007-dual-track-v2-2-0.md`](docs/decision-log/DEC-0007-dual-track-v2-2-0.md), [`DEC-0008-serper-primary-search-provider.md`](docs/decision-log/DEC-0008-serper-primary-search-provider.md), [`DEC-0009-release-gold-set-acceptance.md`](docs/decision-log/DEC-0009-release-gold-set-acceptance.md)（[`release-gold-set.md`](docs/design/release-gold-set.md)）, [`DEC-0010-risk-band-display-grading.md`](docs/decision-log/DEC-0010-risk-band-display-grading.md)（[`risk-band-grading.md`](docs/design/risk-band-grading.md)）, [`DEC-0011-mwc-public-register-names.md`](docs/decision-log/DEC-0011-mwc-public-register-names.md), [`DEC-0012-track1-court-judgments-v1-0-0.md`](docs/decision-log/DEC-0012-track1-court-judgments-v1-0-0.md).

## Hype / scope traps (quick map)

| Trap | Rule |
|------|------|
| Matching, UGC, B2B badge | `renocheck-product` |
| Microservices, queues, 2nd pipeline | `architecture` |
| Trendy packages | `software-engineering` |
| Multi-agent / RAG for one search | `llm-prompts` |
| Early SBOM / full E2E | `V2-roadmap` + `software-engineering` |

## Release checklist (before production)

- [ ] `pnpm lint` / `pnpm test` / `pnpm build` pass  
- [ ] `.env.local` from `.env.example`; no secrets in git  
- [ ] Supabase migrations + RLS reviewed (when DB wired)  
- [ ] `disclaimerVersion` on reports; `/legal/disclaimer` reviewed if copy changed  
- [ ] Smoke: `GET /api/health`; `POST /api/search` returns valid `RiskReport` (when API wired)  

See `release-verification` rule when editing CI / `package.json`.

## Before first deploy

- Supabase migrations + MWC import  
- `SERPER_API_KEY` (preferred) or `SERPAPI_KEY`; optional Google CSE env vars  
- AI Gateway / provider key  
- Disclaimer page at `/legal/disclaimer`

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
