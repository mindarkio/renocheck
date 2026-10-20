# DEC-0013: Quote analysis and private report feedback

- **Status:** accepted — Aaron, 2026-10-20.
- **Date:** 2026-10-20
- **Plan:** [`PRF-quote-analysis-plan.md`](../plans/PRF-quote-analysis-plan.md) Rev 6.2 (蟲 PASS on Rev 6 for F0/F1)
- **Related:** [`DPIA-quote-analysis.md`](../privacy/DPIA-quote-analysis.md) (DRAFT, unsigned), [`quote-azure-1.md`](../consent/quote-azure-1.md) (DRAFT, D3a), [`llm-provider-outage.md`](../runbooks/llm-provider-outage.md), [`quote-provider-paused.md`](../runbooks/quote-provider-paused.md)

Certainty labels follow `advisor-conduct`: **[Certain]** was checked in this repo or on an official page cited in the plan; **[Likely]** still needs a check; **[Unverified]** was not confirmed. This DEC does not change live disclaimer copy, grading, or `DISCLAIMER_VERSION`.

## Context

Company search is the shipped product. Two additions were sitting outside the scope gate:

- AI reading of a renovation quote (photos or PDF) was listed as V2 / out of scope.
- A 👍/👎 on a report could be read as user-generated content, which MVP excludes.

Aaron locked the provider, the spend cap, the controller, and the payment provider on 2026-10-20 (plan §0 and §13). Later PRs (F1–F6) need this DEC so they pass the scope gate.

Company reports stay on the existing Gemini path. Quote analysis is a separate provider, key, and code path, with no fallback onto Gemini or the AI Gateway.

## Options

| Option | Pros | Cons |
|--------|------|------|
| A — Leave quote review in V2; no rating | No new PII, no new provider | The requested feature stays blocked by the scope gate |
| B — Quote analysis in current scope; rating is private product feedback, not UGC | Matches Aaron's D15; rating is not shown to other users | Needs a DPIA, consent, a spend cap, and a new table |
| C — Public ratings on company pages | Social proof | UGC accusations; conflicts with MVP §2.4 and `compliance-legal` |

## Decision

**Option B.**

### Scope

- AI quote analysis moves from V2 into current scope (D15). It flags missing or vague quote items only. It does not judge price fairness and it does not grade the contractor.
- Report rating is **private product feedback**, not UGC (D15). One vote per report per device. Comments are not displayed publicly. There is no admin UI in v1; Aaron reads rows with the service role. Aaron confirmed on 2026-10-20 that the form collects only the rating and an optional free-text comment, so RenoCheck can see how to do better. It does not ask for a name, a phone number, or other personal data.
- Company search stays free and unlimited. `/api/search`, `RiskReport`, grading, and `REPORT_VERSION` (`2.6.0`) are unchanged by this decision.

### Pricing model

- **2 free quote analyses per device per Hong Kong calendar day**, then paid credits (D1: price TBD).
- Payment provider is **Airwallex**, not Stripe: Hosted Payment Page, one-off, no customer accounts (plan §5.2, Rev 6.2). Card data stays at Airwallex.
- `QUOTE_PAYMENTS_ENABLED` stays off until F5. There is no payment code in the F0/F1 PRs.

### Provider

**[Certain, Aaron 2026-10-20, D3 and D31]** Quote analysis uses **Azure OpenAI in Microsoft Foundry Models: `gpt-6-luna`, Global Standard deployment, resource in Japan East**, on Aaron's own pay-as-you-go Azure subscription.

Verbatim from the locked decision (plan §0 item 2b / §13 D31):

> Quote analysis uses Azure OpenAI (`gpt-6-luna`, Global Standard, Japan East) on Aaron's own pay-as-you-go Azure subscription, with separate prod/dev resources and keys, Azure budget alerts and a locked US$1/day app-side cap. Company reports stay on Gemini unchanged.

- Company reports keep `resolveRiskReportModel()` in `src/lib/llm-model.ts`. Production `GET /api/health` on 2026-10-20 reported `llmProvider` `google/gemini-3.5-flash-lite` (the `GEMINI_MODEL` override; the code default when the Google key is set and `GEMINI_MODEL` is unset is `gemini-3.5-flash`). If `GOOGLE_GENERATIVE_AI_API_KEY` is absent, that resolver falls back to AI Gateway `openai/gpt-4o-mini`.
- Quote analysis **never** falls back to Gemini, the AI Gateway, or OpenAI direct. Missing Azure env or an Azure outage returns 503 `quote_llm_unavailable`.
- **Separate prod and dev Azure resources and keys** (plan §14.1): `renocheck-quote-prod` and `renocheck-quote-dev`, both Japan East, in separate resource groups. The prod key is a Vercel Sensitive env var, Production only, never Preview. Rotate every 90 days (Key 2 → Vercel → Key 1).
- **TPM (D35b):** prod deployment **50K TPM**, dev **20K TPM**, set explicitly. F2 may adjust from the `x-ratelimit-*` headers.
- **Azure Monitor metric alert (D35b):** on the prod resource, processed tokens > 2M in 1 hour, **or** 429 count > 20 in 15 minutes, emailed to Aaron.
- **Azure budget alerts (D35):** alerts only, they do not stop spend. Prod resource group **US$35/month**, dev resource group **US$5/month**, at 50%, 80%, and 100% actual plus 100% forecast.
- Planned dependency **`@ai-sdk/azure`** (D34), pinned to the major that matches installed `ai@7`. It is **not** added in F0 or F1. `@ai-sdk/openai` is not added. No other new AI provider package.

### Spend

- **Locked US$1/day app-side cap** for quote analysis (D36, Aaron 2026-10-20). The day is the HKT calendar day. When the cap is reached, quote analysis pauses for the rest of that HKT day and auto-resumes at HKT midnight. Company reports are unaffected.
- **Free/paid split inside the US$1 (D36b):** free analyses stop at **US$0.80**; **US$0.20** stays available for paid credits. The US$1.00 lock is unchanged.
- Cost is actual usage tokens × price constants, with a reserve-before-call on a single daily row (plan §14.2). Raising the cap needs Aaron.
- Azure pay-as-you-go has **no hard spend cap** [Certain, plan §7, S-A9/S-A10]. Budgets alert only, with about 8–24h lag. The app cap is the hard stop for app traffic.
- **Leaked-key worst case (D35b):** a leaked key bypasses the app cap. It is bounded by the deployment TPM. At prod 50K TPM: 50,000 × 1,440 minutes = 72M tokens/day. At the `gpt-6-luna` Global price below (US$0.10 / 1M input, US$0.50 / 1M output) that is about **US$7/day if the day is all input** and about **US$36/day if the day is all output**. Detection is the metric alert, then key rotation (plan §14.1).

### Microsoft data facts

Read **2026-10-19/20** from the official pages cited in plan §6.4 (notes in the plan; the working file `azure-openai-check.md` is not in this repo). Labels are **[Certain from those pages]** unless marked.

| Fact | Source |
|------|--------|
| Prompts and outputs are not available to OpenAI or other customers, are not used to train or improve models, and are not used to improve Microsoft or third-party products without permission. Microsoft hosts the models, which do not interact with services operated by OpenAI. | [S-A1 data, privacy, and security](https://learn.microsoft.com/en-us/azure/ai-foundry/responsible-ai/openai/data-privacy) |
| Global Standard may process a request in any geography where the model is deployed (outside HK, possibly any Azure region). Data at rest, including the abuse-monitoring store and any stored Responses state, stays in the resource geography (Japan for Japan East). | [S-A1](https://learn.microsoft.com/en-us/azure/ai-foundry/responsible-ai/openai/data-privacy), [S-A4 deployment types](https://learn.microsoft.com/en-us/azure/ai-foundry/openai/how-to/deployment-types) |
| No Hong Kong (East Asia) region for Azure OpenAI. | [S-A6 region availability](https://learn.microsoft.com/en-us/azure/foundry/foundry-models/concepts/models-sold-directly-by-azure-region-availability) |
| Abuse monitoring is automated by default. Human review is by authorised Microsoft employees (SAW, JIT) when content is flagged, when prompts and completions are part of a potentially abusive pattern, or when automated review is below confidence or unavailable. Microsoft is processor. The store is in the resource geography. Severe or repeated abuse can throttle or suspend the resource after email notice, except in severe cases. | [S-A1](https://learn.microsoft.com/en-us/azure/ai-foundry/responsible-ai/openai/data-privacy), [S-A2 abuse monitoring](https://learn.microsoft.com/en-us/azure/ai-foundry/openai/concepts/abuse-monitoring) |
| Responses API keeps response data for 30 days by default. `@ai-sdk/azure` defaults `store` to true, so quote analysis must send `store: false` and test it. | [Responses how-to](https://learn.microsoft.com/en-us/azure/foundry/openai/how-to/responses) (30-day sentence verified in docs by 蟲 2026-10-19, plan Rev 6.1 L2). SDK default is [Likely, S-X1], not re-verified by 蟲. |
| `gpt-6-luna` Global (Japan East meter): **US$0.10 input / US$0.50 output per 1M tokens**, cached input US$0.01. | Azure Retail Prices API, read 2026-10-20 (plan §7, S-A7 `https://prices.azure.com/api/retail/prices`) |
| Microsoft Products and Services DPA, Product Terms, and Universal License Terms for Generative AI Services apply through the Azure subscription. Accepted at sign-up; no separate form (D32). | S-A1, [S-A3 limited access](https://learn.microsoft.com/en-us/azure/ai-foundry/responsible-ai/openai/limited-access) |
| Modified abuse monitoring is a Limited Access form for customers managed by a Microsoft account team or an eligible program. Not assumed for v1 (D33). | S-A3 |
| No OpenAI-style "supported countries" exclusion was found for Azure OpenAI. Azure lists Hong Kong as a commercially available market. **R6 is retired** with D31. | S-A3; plan §6.4 (S-A11, S-A13) |

**Abuse-monitoring retention: [Unverified].** Neither S-A1 nor S-A2 states a period (蟲 re-checked 2026-10-19). A historical legal page said "up to thirty (30) days" (plan S-A15). Consent and the future §八 copy use the honest form: the current public docs do not state a period; older docs said up to 30 days (D38). Do not state "最多 30 日" as a current limit.

**Still unverified (plan §14.5; close in F2/F3 or before F6, do not treat as settled):**

- Exact `@ai-sdk/azure` option names (`store`, `reasoningEffort`, `strictJsonSchema`, `imageDetail`) and the SDK's default `store: true`.
- `gpt-6-luna` image tokens per photo and PDF tokens per page, and whether base64 PDF input works on the Azure Responses API for this model.
- Strict JSON schema acceptance, refusal shape, and `content_filter` shape.
- Azure error-code mapping (429, 401/403, `DeploymentNotFound`).
- A dev-resource `GET /openai/v1/responses/{id}` returns 404 after a `store: false` smoke.
- Real per-request TPM from `x-ratelimit-*` headers.
- Whether the `x-ms-region` response header is present.
- Re-read of the Japan East Global price before code constants are set.
- Quota tier of the new subscription for `gpt-6-luna` Global Standard.
- Before F6: abuse-monitoring retention (re-check); Product Terms have no clause against serving HK end users; contracting Microsoft entity for MindArk IO Ltd; UK adequacy for Japan; UK IDTA or Addendum in the Microsoft, Vercel, Supabase, and Airwallex terms.
- Airwallex items in plan §14.5 (account country, scoped keys, access-token TTL, HPP payer-email, AlipayHK fee, card minimum, role for payer data, current HK fee schedule).
- Southeast Asia `gpt-6-luna` meter (not used; Japan East was chosen).
- ICO registration **reference** (the fee is paid; the reference number is not in this repo).

### Residual risks

Recorded so later PRs do not drop them. Detail is plan §14.4 and §6.4.

| Risk | What remains |
|------|----------------|
| **R2** (company reports only, pre-existing) | Gemini API terms: paid services only when making API clients available to users in the EEA, Switzerland, or the UK. `/api/search` serves those visitors on the free key. **D22: accepted.** If the key is suspended, follow [`llm-provider-outage.md`](../runbooks/llm-provider-outage.md) (D23). |
| **R3** Third-party data on quotes | The uploader cannot consent for other people on the quote. Training use is excluded, so the PDPO DPP3 "new purpose" concern largely falls away. Cross-border processing (any Azure region; storage in Japan) and abuse-monitoring storage with an unstated retention period remain. The consent box does not cure this for third parties. Reducing what is sent (tip, crop/mask) is the mitigation. |
| **R5** (company reports only, pre-existing) | Gemini lists no HK availability. Unchanged. **D22: accepted.** |
| **R7** Retention | Abuse-monitoring storage in Japan; period not stated in current docs. Human review is possible when content is flagged, part of a possibly abusive pattern, or below automated confidence. Disclosed in the DRAFT consent. |
| **R8** No hard Azure spend cap | Controls: US$1/day app cap, per-attempt reservations, `maxRetries: 0`, 300 calls/day, explicit TPM, metric alert, budget alerts. A leaked key bypasses the app cap (about US$7–36/day at 50K TPM). |
| **R9** Quota on a new subscription | `gpt-6-luna` may need a quota request. Until it is granted, quote analysis cannot launch. The `gpt-4.1-mini` fallback needs Aaron's OK (D37). It is not automatic. |
| **R10** Global Standard processing location | Requests may be processed in any Azure region. Only data at rest is in Japan. Disclosed. Moving to an APAC Data Zone model costs about 10× and needs a new consent version. |
| **R11** Azure abuse enforcement | Severe findings can throttle or suspend the resource or subscription. Quote analysis fails closed. Company reports are unaffected. |
| **R12** UK GDPR | Controller is MindArk IO Ltd. The DPIA (with the LIA), Art 14(5)(b), transfer mechanisms, and the ICO fee must be done before F6. The fee is paid (D39). The DPIA in this change is still unsigned. |
| ~~R6~~ | HK not on OpenAI's supported-country list. **Retired by D31.** |

### Governance

- **D20 controller / operator = MindArk IO Ltd**, a UK registered company, trading as RenoCheck. UK GDPR applies to all RenoCheck processing (UK GDPR Art 3(1)) alongside the HK PDPO for HK users. Company no. **17141212**. Registered office (Companies House, checked 2026-10-20): `Office 18282, 182-184 High Street North, East Ham, London, E6 2JA, United Kingdom`.
- **D28 contact:** hello@renocheck.homes, post title 「個人資料事務負責人」, plus that registered office.
- **D22:** company reports' existing Gemini free-tier exposure (EEA/UK/CH paid-only clause, and HK not an available Gemini region) is **accepted** and recorded here. Quote analysis does not add to it.
- **D23:** the AI Gateway fallback **for company reports only** is pre-approved, including the spend. Runbook: [`llm-provider-outage.md`](../runbooks/llm-provider-outage.md). Quote analysis never falls back.
- **D32:** Microsoft DPA, Product Terms, and Universal License Terms for Generative AI Services are accepted with the Azure subscription at sign-up. Aaron confirms the contracting Microsoft entity and the billing entity (MindArk IO Ltd) in Cost Management + Billing before F6. Notices name "Microsoft Azure".
- **D34:** `@ai-sdk/azure` is approved to add in F2/F3, not in this PR.
- **D39:** Aaron has **paid** MindArk IO Ltd's ICO data protection fee (2026-10-20). Tier 1 is £52/year, or £47 by direct debit ([ICO fee page](https://ico.org.uk/for-organisations/data-protection-fee/data-protection-fee/), read 2026-10-20). The registration reference is blank until Aaron fills it in the DPIA.
- **D8 (feedback):** `report_feedback` rows are kept **12 months**, then purged. The purge ships with F1 (Vercel Cron). Quote-usage and quote-analysis retention in the plan (30 days / 180 days) stay as plan defaults until Aaron confirms them for those tables.
- **D16 (M1):** the `report_feedback` migration and rollback are files only until Aaron applies them. They are not part of this docs PR.

## Consequences

- `docs/MVP.md` and `.cursor/rules/renocheck-product.mdc` no longer list AI quote review or private rating as out of scope. Public UGC stays out of scope.
- `.cursor/rules/llm-prompts.mdc` and `docs/MVP.md` describe Gemini in production, with the Gateway fallback only when the Google key is absent.
- F1 may add private rating with `FEEDBACK_ENABLED` off by default. F2–F6 follow the plan. F6 still needs Aaron's sign-off on `/legal` copy, a `DISCLAIMER_VERSION` bump, and a signed DPIA before flags go on.
- Live `/legal/*`, grading, and `REPORT_VERSION` do not change with this DEC.

## Reversal cost

- Before F3 merges: delete this DEC and restore the out-of-scope lines. No schema and no provider account required by this file.
- After quote rows or feedback rows exist: turn the flags off, then drop tables only with the paired rollback and Aaron's OK (data loss).

## Triggers to reconsider

- Aaron rejects the DEC text, the consent text (D3a), or the controller identity.
- `gpt-6-luna` misses the eval thresholds (D19) or quota is refused (D37).
- Microsoft changes training, abuse-monitoring, or region facts before F6.
- The US$1/day cap is hit often enough that Aaron wants a different number (the lock does not move without him).
- A leaked Azure key, or a Gateway fallback that runs longer than an incident.
