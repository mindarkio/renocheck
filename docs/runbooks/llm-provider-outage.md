# Runbook: company-report LLM provider outage

Company reports only (DEC-0013 **D23**). Quote analysis is a different provider and **never falls back** to Gemini or the AI Gateway.

`src/lib/llm-model.ts` uses Gemini when `GOOGLE_GENERATIVE_AI_API_KEY` (or `GOOGLE_GENERATIVE_AI_KEY`) is set. If that key is absent and `AI_GATEWAY_API_KEY` or `VERCEL_OIDC_TOKEN` is set, it uses AI Gateway `openai/gpt-4o-mini`. Production on 2026-10-20 was on Gemini (`llmProvider` `google/gemini-3.5-flash-lite`). The Gateway path is pre-approved spend for this incident only.

## When to use this

Gemini returns **401** or **403**, or Google has suspended the prod key, and `/api/search` is failing with `llm_failed`.

## Steps

1. Aaron **removes** `GOOGLE_GENERATIVE_AI_API_KEY` from Vercel Production (rotating it does not trigger the fallback), then **redeploys Production** (Deployments → latest Production → Redeploy). Env changes apply only to new deployments. Pre-approved spend (D23). Do not paste any key into chat, logs or a PR.
2. Check `GET /api/health`. `llmProvider` should leave `google/…` and show the Gateway label (`gateway/openai/gpt-4o-mini`) once the Google key is unset and a Gateway credential is present. Check **presence** of `AI_GATEWAY_API_KEY` or OIDC only. Do not read the value.
3. When Gemini is usable again, Aaron restores `GOOGLE_GENERATIVE_AI_API_KEY` (and `GEMINI_MODEL` if Production relies on it), then redeploys Production. Confirm `/api/health` `llmProvider` is back on `google/…`.

## Do not

- Point quote analysis at this fallback. If Azure is down, quote analysis stays paused or returns `quote_llm_unavailable`. See [quote-provider-paused.md](quote-provider-paused.md).
- Change grading, disclaimer text, or `REPORT_VERSION` as part of the switch.
