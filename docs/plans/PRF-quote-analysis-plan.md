# PRF: Quote analysis + suggested reply (A) and report rating/feedback (B): implementation PLAN

- Status: [Rev6.1] **蟲 PASS on Rev 6; F0/F1 may start.** **PLAN for review (蟲 → Aaron). No code, no PR, no migration applied.**
- Written 2026-10-20 against `mindarkio/renocheck` main @ `e3cb8dc` (read-only via GitHub API).
- Every user-facing string in this file is a **DRAFT**. Nothing ships until Aaron approves the wording. (Standing rule: no disclaimer, grading or wording changes without his OK.)
- **Rev 2 (2026-10-20, Aaron):** the Gemini key stays on the **free (Unpaid) tier**. The original quote file is still sent to Gemini, and users must give explicit consent before upload (§6, §8.4). Rev 3 reopened this; **Rev 4 supersedes it** (quote analysis moves to OpenAI paid API).
- **Rev 3 (2026-10-20, after 蟲 review FAIL: 7 Must / 12 Should / 10 Low, `/workspace/renocheck-review/PRF-plan-review.md`):**
  - Applied: Musts M3–M7, all consent fixes (S7), Shoulds S1–S12 and Lows L1–L10, with each change tagged `[Rev3 Mx/Sx/Lx]`.
  - Musts M1 and M2 (isolated Google project, circuit breaker, Gateway runbook, UK/EEA/CH 451 geo-gate) and residual risks R1/R2/R4/R5 depend on Aaron's **pending** tier choice. [Superseded in Rev 4] They were moved into the **conditional §14 "Free-tier path (if Aaron keeps free tier)"**, so the section can be kept or dropped whole.
  - D21 is resolved: Vercel is on a paid plan (Aaron, 2026-10-19). D20–D30 are folded into §13 with recommended defaults.
- **Rev 4 (2026-10-20 10:51 BST, Aaron decided D3):** quote analysis uses **Aaron's own OpenAI API key (paid, pay-as-you-go)**, not free-tier Gemini. **Company reports stay on the existing Gemini key/provider, unchanged.** Changes are tagged `[Rev4 …]`:
  - §3.3 rewritten for OpenAI (`OPENAI_API_KEY`, separate OpenAI project, Responses API `store:false`, inline base64 image/PDF, strict JSON-schema output, no Files API, 45s abort kept).
  - §6.4, §7, §8.3 (privacy line, §八 item 3, 3a PICS) and §8.4 (consent `quote-openai-1`) rewritten from **official OpenAI pages read 2026-10-20** (sources in §6.4/§7).
  - The old free-tier §14 (unbilled Google project, UK/EEA/CH 451 geo-gate, Gemini-suspension breaker, R1/R2/R4) is **removed** and replaced by a generic **§14 Provider operations** (separate key/project, budget circuit breaker, monitoring, D29 prod smoke).
  - **New risk R6:** Hong Kong is **not** on OpenAI's supported-countries list (§14.4). This needs Aaron's explicit decision (D31).
  - §13 updated: D3 resolved; new D31–D35.
  - [Superseded in Rev 5] The OpenAI-direct provider specifics and R6 are replaced by Azure OpenAI (below).
- **Rev 5 (2026-10-20 11:45 BST, Aaron decided D31 = (b)):** quote analysis uses **Azure OpenAI in Microsoft Foundry Models**: `gpt-6-luna`, **Global Standard** deployment, resource in **Japan East**, on Aaron's own pay-as-you-go Azure subscription. Company reports stay on Gemini, unchanged. Aaron also **locked a US$1/day app-side spend cap** (D36). Changes are tagged `[Rev5 …]`; findings and sources are in `/workspace/renocheck-review/azure-openai-check.md` (official Microsoft pages, read 2026-10-20):
  - §3.3 is rewritten for `@ai-sdk/azure`:
    - `createAzure` with `AZURE_RESOURCE_NAME`, `AZURE_API_KEY` and `QUOTE_AZURE_DEPLOYMENT`;
    - Responses API, with **`store:false` mandatory and tested**;
    - strict JSON schema, inline base64 image/PDF, 45s abort and the error-log allowlist;
    - no fallback to Gemini or OpenAI direct.
  - Rewritten with Microsoft facts: §6.4, §7 (Azure Retail Prices API), §8.3 (privacy line, §八 item 3, 3a) and §8.4 (consent `quote-azure-1`, all DRAFT).
  - §10 risks, §11 env checklist, §12 F0/F3 and §13 are updated: D31 resolved, D32–D35 rewritten, D36 locked cap, D37 quota fallback.
  - §14 is rewritten:
    - Aaron's Azure setup checklist;
    - the US$1/day cap with reserve-before-call;
    - new risks R8–R11, with R6 retired;
    - §14.5, the unverified items for F2/F3.
- **Rev 6 (2026-10-20 12:00 BST, after 蟲's Rev 5 review FAIL: 2 Must / 9 Should / 7 Low, `/workspace/renocheck-review/PRF-plan-review-rev5.md`):** all applied, tagged `[Rev6 …]`. Aaron's locked decisions are unchanged: Azure `gpt-6-luna` Global Standard in Japan East, US$1/day, 2 free/day, no login, photos/PDF only, delete the original, no price judgment.
  - **N-M1 UK GDPR:**
    - D20 is closed as MindArk IO Ltd (UK) = controller, pending Aaron's confirmation.
    - New §6 item 9 covers lawful basis incl. an LIA for third-party data, Art 14(5)(b), transfers, processors, the DPIA (drafted in F0, completed before F6) and the ICO fee.
    - Controller identity and the complaint channel are added to the notices; F5/F6 gates are updated.
  - **N-M2 retries:**
    - `maxRetries: 0`; the only retry is ours (5xx/network only), with reserve/settle per attempt.
    - Test: exactly one fetch per attempt.
  - **Shoulds:**
    - S1: R2 in §14.4; the D23 runbook `docs/runbooks/llm-provider-outage.md` planned in F0.
    - S2: single-row daily spend counter with a conditional UPDATE, DB-computed HKT day, idempotent settle, 180s stale→spent sweep, free usage stops at US$0.80.
    - S3: explicit TPM (prod 50K / dev 20K) and an Azure Monitor metric alert.
    - S4: runtime `store:false` fetch guard.
    - S5: corrected consent/§八/PICS wording.
    - S6: Sensitive env and 90-day rotation.
    - S7: paid credits kept on pause.
    - S8: no retry on 429, plus a short soft pause.
    - S9: Stripe UK vs HK.
  - **Lows L1–L7.**
  - **New decisions** D35b, D36b, D38, D39 (D40 closed: `quote-azure-1` was never shown).
- **Rev 6.1 (2026-10-20 12:20 BST, after 蟲's Rev 6 review PASS: 0 Must / 4 Should / 4 Low, `/workspace/renocheck-review/PRF-plan-review-rev6.md`; F0/F1 may start):** all applied, tagged `[Rev6.1 …]`. All are in the PR-F3 cap path or wording; F0/F1 are unaffected and Aaron's locked decisions are unchanged.
  - S1: the 20% paid reserve now also applies to the 300-call ceiling inside `reserve_quote_spend`.
  - S2: the N-M2 retry test is split into four consistent cases.
  - S3: new `begin_quote_retry` (attempt 2 inherits the slot) and `note_quote_provider_status` (pause setters); slots counted by distinct `request_id`.
  - S4: the sweep uses `for update skip locked` and books stale rows from any earlier day to their own day.
  - L1: argument and row-found checks in `reserve_quote_spend`. L2: 30-day Responses retention marked [Certain]. L3: data portability in §八 3a rights. L4: `request_id` no longer declared `unique` on its own.
- **Rev 6.2 (2026-10-20 12:30 BST, Aaron):** tagged `[Rev6.2 …]`.
  - **D39 CLOSED:** Aaron has paid the ICO data protection fee.
  - **Payments move from Stripe to Airwallex.** §5.2 is rewritten: Hosted Payment Page; server-side PaymentIntent with `request_id`/`merchant_order_id`; `x-timestamp`+`x-signature` HMAC webhook; sandbox vs production hosts; HK vs UK fees; data location. Official URLs are cited, with [Certain]/[Likely]/[Unverified] marks.
  - Also updated: §3 modules/routes, M3 `quote_payments`, §6 item 9 transfers/processors, §7, §8.3 (DRAFT copy), §10 risks, §11 tests and env checklist, §12 F5/F6, §13 D1/D2/D20/D27, §14.
  - The generic design is unchanged: credits, recovery code, idempotent webhook, pay-before-upload, fail-closed price.
- Certainty labels follow the repo's `advisor-conduct` rule: [Certain] means I verified it in the repo or on an official page, [Likely] means strong inference that still needs a check, [Guessing] means an assumption.

---

## 0. Locked decisions (Aaron, 2026-10-20) and how this plan honours them

| # | Decision | Where in plan |
|---|----------|---------------|
| 1 | Accept photos (including phone shots) and PDF only. No Excel or Word. | §3.2 |
| 2 | Delete the original file right after analysis and never store it. Keep only an anonymised result with names, phones and addresses stripped. | §3.2, §6 |
| 2b | ~~(Rev 2) Stay on the free Gemini tier.~~ ~~[Rev4] OpenAI direct~~ → **[Rev5 D31] Quote analysis uses Azure OpenAI (`gpt-6-luna`, Global Standard, Japan East) on Aaron's own pay-as-you-go Azure subscription, with separate prod/dev resources and keys, Azure budget alerts and a locked US$1/day app-side cap. Company reports stay on Gemini unchanged.** Send the original file. A required, unticked-by-default consent checkbox before upload says: the file goes to Microsoft Azure and is processed outside HK (possibly in any Azure region), with data stored in Japan; it isn't used for training and isn't accessible to OpenAI; Microsoft acts as our processor; [Rev6 S5] abuse monitoring may store flagged content or content in a possibly abusive pattern, with possible human review, and the retention period isn't stated in current docs (historically up to 30 days). The controller is MindArk IO Ltd (D20). | §2, §3.3, §6, §8.4, §14 |
| 2c | [Rev3 M7] **Definition of "original" (原檔):** the quote's *content* is **not redacted by RenoCheck**. There is no server-side masking before the AI provider (Azure OpenAI, [Rev5]). It does **not** mean the original bytes. Photos are **always** re-encoded in the browser before upload (resize ≤2000 px, JPEG q≈0.8, which drops EXIF/GPS/XMP), then the user's optional crop/masks are applied. The server rejects images that still carry EXIF. PDFs are sent byte-for-byte, including their metadata (L1). | §3.2 |
| 3 | No login. 2 free quote analyses per device per day, then pay per extra analysis (price TBD). | §5 |
| 4 | Company search stays free and unlimited. Quote analysis: 2 free per day, then paid. | §5 (`/api/search` untouched) |
| 5 | Flag only missing or vague items. No judgment on price fairness. Checklist to be approved. | §8.1 |
| 6 | One polite, pointed Cantonese WhatsApp message with a copy button. | §8.2 |
| 7 | Extract the company name and offer a one-click RenoCheck company report. | §2, §3.5 |
| 8 | 👍/👎 plus an optional comment on both surfaces. Bottom slide-in card (end of report, or ~40s), shown once per report per device, plus a fixed block at the bottom. Needs a DB table with RLS, service-role only. | §9, §4 (M1) |
| 9 | New quote-analysis disclaimer, marked DRAFT. | §8.3 |
| 10 | [Rev5 D36] **US$1/day app-side spend cap** for quote analysis. When it's reached, quote analysis pauses for the rest of the HKT day with a friendly message and auto-resumes at HKT midnight. Company reports are unaffected. Cost is tracked from actual usage tokens × price, with reserve-before-call. | §7, §14.2 |

---

## 1. What the repo looks like today (facts this plan builds on)

All items below are [Certain], read at `e3cb8dc` unless marked otherwise.

- **Framework:** Next.js `16.4.0` (App Router, `cacheComponents: true`, `partialPrefetching: true`), React `19.3.0`, Tailwind 4, zod 3, `ai` `^7.0.138` with `@ai-sdk/google` and `@ai-sdk/gateway`, `@supabase/supabase-js`, pnpm 10, Node ≥22.15.
  - `AGENTS.md` warns that this Next version breaks training-data assumptions. Cursor must read `node_modules/next/dist/docs/` before adding routes or pages.
- **Hosting:** `vercel.json` has `regions: ["sin1"]`. `/api/search` exports `maxDuration = 60`. The Vercel Functions request/response body limit is **4.5 MB**, and oversize requests get 413 `FUNCTION_PAYLOAD_TOO_LARGE` (https://vercel.com/docs/functions/limitations).
- **LLM:** `src/lib/llm-model.ts` picks Gemini direct when `GOOGLE_GENERATIVE_AI_API_KEY` is set (`GEMINI_MODEL` override, default `gemini-3.5-flash`). Otherwise it falls back to AI Gateway `openai/gpt-4o-mini`.
  - **Prod right now:** `GET https://renocheck.homes/api/health` → `"llmProvider":"google/gemini-3.5-flash-lite"` (checked 2026-10-20).
  - [Rev4, Certain from `package.json` @ e3cb8dc] `@ai-sdk/openai` is **not** installed (only `ai`, `@ai-sdk/google`, `@ai-sdk/gateway`). ~~Quote analysis needs it as a new dependency~~ [Rev5] Quote analysis needs **`@ai-sdk/azure`** instead (also not installed; D34). Company reports keep using `llm-model.ts` untouched.
  - Doc drift: `.cursor/rules/llm-prompts.mdc` and `docs/MVP.md` still say gpt-4o-mini. Fix this in PR-F0.
  - The pipeline uses one `generateObject` call with a zod schema (`llm-risk-report.ts`).
- **Pipeline budget:** `search-pipeline.ts` has `PIPELINE_BUDGET_MS = 50_000` and `LLM_RESERVE_MS = 20_000`. The LLM call is aborted at the deadline and the route returns 503 `llm_failed`. The quote route copies this pattern.
- **Rate limiting:** `src/lib/rate-limit.ts` is an **in-memory** Map, 30 requests per 60s per IP from `x-forwarded-for`. It is per-instance, not durable, and not shared across Fluid instances, so it **cannot** enforce a daily quota. The quota must live in the DB (§5).
- **Caching:** the `search_cache` table holds 7-day reports keyed by a 32-hex fingerprint, with a 10-minute TTL for degraded reports. A known open issue is the check-then-upsert race in `setCachedReport`, so the new quota claim must be a single atomic SQL statement or function.
- **Supabase:** server only, through `getSupabaseAdmin()` (service role, bypasses RLS).
  - Tables: `mwc_contractors`, `search_cache`, `search_events`, `official_legal_events`.
  - Migration pattern to copy: `20261018140000_mwc_contractors_service_role_only.sql`. It runs `revoke all … from anon, authenticated` and `grant select, insert, update, delete … to service_role`, keeps RLS on with **no policies**, and pairs with a manual `supabase/rollbacks/*.down.sql` that never revokes service_role.
  - Functions copy the `search_path` hardening from `20261017145500_official_legal_events_hearing_guard_search_path.sql`.
  - Region: ap-southeast-1.
  - **No Supabase Storage in use today.**
- **Report page:** `src/app/report/[fingerprint]/page.tsx` renders the client component `ReportView`, which reads `sessionStorage` and then `GET /api/report/[fp]`. `ReportView` contains `ReportCard`, then the 「新搜尋」 CTA.
  - `ReportCard.tsx` ends with sections in this order: checklist, next steps, 呢份報告查唔到乜, 官方來源, then `<aside aria-label="報告免責">`.
  - `LegalEventsTable.tsx` (PR #25) is the a11y reference: caption, `scope=col`, and a focusable `role=region` scroll wrapper.
  - Copy SSOT is `src/lib/report-trust-copy-zh.ts`. It includes `REPORT_TRUST_FORBIDDEN_ZH` (高風險, 小心, 保證, 安全, 可靠, 放心, 有問題 …) plus a negated allowlist, and tests enforce both. **All new copy must pass that list.**
- **`SearchForm.tsx`** posts to `/api/search`, writes `sessionStorage['renocheck:report:'+fp]` and `router.push('/report/'+fp)`. It has **no URL prefill**, so the one-click company report needs a small extracted helper (§3.5).
- **Tests and eval:**
  - vitest runs `src/**/*.test.ts(x)`. `setupFiles: src/test/strip-secret-env.ts` strips secrets, and tests never hit Supabase.
  - jsdom and @testing-library/react are available. Playwright 1.52 is a devDependency, used for LRS scripts.
  - Eval scripts follow `scripts/eval-*.ts`. Golden mode is CI-friendly. `--live` mode needs local `pnpm dev`, and `refresh` only works when `NODE_ENV=development`.
  - The `pnpm test:d2` prod-ref gate is the model for "refuse prod".
- **Governance:**
  - `renocheck-product.mdc` and `MVP.md` list **"AI quote PDF review" as V2/out of scope** and **"用戶發帖、評分、留言" as out of scope**.
  - The scope gate says a new feature needs a **DEC**, and AGENTS.md says pricing/launch needs a DEC. So PR-F0 adds DEC-0013.
  - `compliance-legal.mdc` requires human sign-off for `/legal/*`.
  - `DISCLAIMER_VERSION = "1.2.0"`, `REPORT_VERSION = "2.6.0"`. Rating does **not** change the RiskReport shape, so there is **no REPORT_VERSION bump**.

---

## 2. User flow

### A. Quote analysis (new route `/quote`, linked from landing and report page)

1. The user opens `/quote`. The page calls `GET /api/quote/quota`, which also sets the device cookie if missing. It shows 「今日仲有 X 次免費分析」 (DRAFT).
   - If X = 0 and the user has no paid credit, it shows the pay card **before** upload (§5.3). This avoids losing the selected file across the [Rev6.2] Airwallex payment-page redirect.
2. The user picks files: up to **5 photos**, or **1 PDF**. Before the button the page shows:
   - The privacy line (§8.3).
   - The cover-your-details tip (§8.4b), shown prominently above the file picker.
   - [Rev3 M4] An optional **crop step** for each photo (§6.2), plus the PDF note.
   - The **required consent checkbox** (§8.4a), unticked by default. [Rev3 S7] 「開始分析」 stays **enabled**. Submitting unticked shows the error and moves focus to the checkbox.
   - The checkbox is per analysis: no "remember me", re-shown every time.
3. The browser validates type and size, converts photos to JPEG and compresses them (§3.2), then shows thumbnails or the PDF name.
4. The user presses 「開始分析」 and the browser sends `POST /api/quote/analyze` (multipart). The request includes a client-generated `requestId` (UUID, saved to sessionStorage first, [Rev3 S3]) and `consentVersion` (e.g. `"quote-azure-1"`, [Rev5]) and `consent: true`. The server rejects with 400 `consent_required` if the flag is missing or the version isn't the current `QUOTE_CONSENT_VERSION`. The server, not the client, records the consent timestamp. The progress UI follows the SearchProgress pattern: 「讀取報價單 → 對照檢查清單 → 整理建議回覆」 (DRAFT).
5. The server takes these steps:
   1. Validate the input.
   2. Atomically claim a free slot or consume a paid credit.
   3. Make one Azure OpenAI vision `generateObject` call ([Rev5], §3.3).
   4. Redact PII in the output.
   5. Store the anonymised result.
   6. Drop the bytes, since they only ever existed in memory.
   7. Return the result.
6. [Rev3 S3] If the connection drops, or on reload, the client calls `GET /api/quote/result?requestId=…` and offers 「顯示上次分析結果」 (DRAFT).
7. The result page (same route, client state plus sessionStorage, **no shareable URL**) shows:
   - The DRAFT disclaimer banner at the top.
   - The extracted company name with a button **「免費查呢間公司嘅 RenoCheck 報告」** (DRAFT, one click).
   - 「要問清楚嘅項目」: ❌ missing and ⚠️ vague items, each with a short reason and a redacted evidence quote from the quote.
   - 「已寫清楚」: ✅ items, collapsed.
   - A suggested WhatsApp reply in a read-only textarea with **「複製訊息」**. It reuses the `CopyCompanyNameButton` pattern, including the 「已複製」 state.
   - The fixed rating block at the bottom, plus the slide-in card (§9).
   - [Rev3 M4] If `sensitiveSeen` flags are set: 「留意：上載內容似乎包括身份證號碼／簽名／銀行戶口，下次上載前可以遮住」 (DRAFT).
8. If `isQuotation=false` (the upload is not a quote, bounded by S12 in §3.3), the page shows 「睇落唔似報價單，請上載裝修報價單相片或 PDF」 (DRAFT). Slot handling is an open decision (D12).

### B. Rating (both surfaces)

- On a company report or quote result, the slide-in appears when the user reaches the end of the content or after about 40s of visible time, whichever comes first, and only once per report per device.
- The user can tap 👍/👎, optionally type a comment, then 送出. Or they can dismiss with ✕, Esc, or 「唔使喇」.
- The fixed block at the bottom is always there and works the same way. If the user already rated, it shows 「多謝你嘅意見」 (DRAFT) and the slide-in never shows.

---

## 3. Architecture

### 3.1 New modules (all server code under `src/lib/quote/`, single-call pattern, no agents/RAG)

| File | Role |
|------|------|
| `quote/schema.ts` | Zod `quoteAnalysisSchema` (LLM slice) plus the `QuoteAnalysisResult` API shape and `QUOTE_ANALYSIS_VERSION = "1.0.0"` |
| `quote/checklist.ts` | Approved checklist SSOT: id, labelZh, what counts as present/vague, `replyQuestionZh`, `appliesWhen` |
| `quote/prompt.ts` | `QUOTE_ANALYSIS_SYSTEM_PROMPT` (versioned constant, like `prompts/risk-report.ts`) |
| `quote/file-validation.ts` | Magic-byte sniffing, size/count limits, PDF page count guard |
| `quote/redact-pii.ts` | Deterministic redaction of model output (HK phones, emails, HKID-like, address patterns, honorific names) |
| `quote/build-reply.ts` | Deterministic WhatsApp message from approved per-item questions, with no LLM free text |
| `quote/analyze.ts` | Orchestrator: budget, abort, LLM call, bind to checklist, redact, result |
| `quote/quota.ts` | Device/IP hashing, calls to the atomic claim/release RPCs |
| [Rev6.2] `quote/airwallex.ts` (PR-F5) | Access token, PaymentIntent create/retrieve, webhook HMAC verify, credit redeem |
| `feedback/*` (PR-F1) | Feedback validation, redaction, insert |
| `device-id.ts` | `rc_did` cookie read/issue, shared by quota and feedback. [Rev3 S11] It is set only on interaction (feedback POST, opening `/quote`), never on a plain report view |
| `quote/log.ts` | [Rev3 M3] The only logger for quote/feedback routes. Allowlisted fields only (§6.3) |
| `client-ip.ts` | [Rev3 S4] Vercel client IP plus IPv6 /64 normalisation |
| `db-guard.ts` | [Rev3 M6] `assertNotProdDbOutsideProd()` (§11) |

Routes:
- `src/app/api/quote/quota/route.ts` (GET)
- `src/app/api/quote/analyze/route.ts` (POST, `maxDuration = 60`)
- `src/app/api/quote/result/route.ts` (GET, [Rev3 S3]):
  - Bound to the device (`device_hash` must match), TTL 24h, looked up by `requestId`.
  - Rebuilds the result from the stored `items` (statuses + reasonCodes) and the deterministic reply builder.
  - Evidence excerpts are not stored, so it shows 「（原文摘錄只喺第一次顯示）」 (DRAFT).
- `src/app/api/quote/redeem/route.ts` (POST, PR-F5, [Rev3 S1] recovery code)
- `src/app/api/quote/checkout/route.ts` (POST, PR-F5)
- [Rev6.2] `src/app/api/airwallex/webhook/route.ts` (POST, PR-F5)
- `src/app/api/feedback/route.ts` (POST)

Page: `src/app/quote/page.tsx`, a thin shell like `report/[fingerprint]/page.tsx` that renders the client `QuoteAnalyzer`. Metadata `robots: index:false` is open decision D18, since a landing-style entry page may want indexing.

### 3.2 Upload path and the 4.5 MB body limit

**Recommended (v1): client-side compression, then send straight to the function. No storage at all.**

- **Photos:**
  - [Rev3 M7] **Always** re-encoded in the browser; raw camera bytes are never uploaded.
    - Decode with `createImageBitmap`/canvas, honouring EXIF orientation.
    - Apply the user's optional crop and masks (§6.2).
    - Resize so the long edge is ≤ 2000 px, then re-encode as JPEG at q≈0.8. The canvas re-encode **drops EXIF, GPS, XMP and device serials**.
  - [Likely] Phone photos of an A4 page come out around 300–900 KB.
  - HEIC from iPhone: Safari can decode it to canvas. [Likely] Desktop Chrome/Firefox cannot decode HEIC, so they get the clear error 「請改用 JPG／PNG 或者直接用手機相機影」 (DRAFT).
  - Allowed source types: JPEG, PNG, WebP, HEIC/HEIF. Max 5 images.
- **PDF:**
  - Sent byte-for-byte. Max **4.0 MB**, leaving margin under 4.5 MB for multipart overhead, and max **6 pages**.
  - [Rev3 focus 5] Pages are counted best-effort by scanning for `/Type /Page` objects; no parser dependency. [Rev5] Azure OpenAI bills the extracted text plus one image per page, and the 4 MB / 6-page caps bound cost anyway.
  - [Rev3 L1] PDF Info/XMP metadata (Author is often a person's name) is sent as-is. This is disclosed in the collection statement (§8.3 3a). Stripping it needs a PDF dependency, so it's deferred (D10).
  - [Rev3 M4] PDFs can't be cropped or masked in the browser without a renderer dependency. The PDF picker shows 「PDF 會原檔傳送；如果有個人資料，建議改為影相再裁剪」 (DRAFT).
  - Encrypted or password PDFs are rejected.
  - Oversize PDFs get 「PDF 太大，可以影相上載」 (DRAFT).
- **Total request size:** ≤ 4.2 MB. Checked on the client and re-checked on the server through `content-length` and the actual bytes (413 → friendly error).
- **Server:**
  - `await req.formData()`, then sniff magic bytes. Accepted signatures: JPEG `FF D8 FF`, PNG `89 50 4E 47`, WebP `RIFF….WEBP`, PDF `%PDF-`. Filename and MIME are ignored.
  - [Rev3 M7] Images must not contain EXIF. Reject with 400 `exif_not_stripped` if any of these is present:
    - a JPEG APP1 segment `FF E1` whose payload starts `Exif\0\0`;
    - a PNG `eXIf` chunk;
    - a WebP `EXIF` chunk.
    - Unit test with fixtures.
    - This catches a stale or modified client sending camera bytes.
  - Bytes live only in function memory as `Uint8Array`. They are **never** written to disk, Supabase Storage or logs.
  - [Rev5] Bytes go to Azure OpenAI **inline as base64** in the Responses request (image data URL for photos, `file_data` for PDFs). **Never** upload via the Files API, which stores files until they're deleted. `store:false` is always set (§3.3).
  - After the response, the references go out of scope, so there is nothing to delete.
  - Decision 2's "delete immediately" is met by never persisting anything.
- **Fallback for >4 MB PDFs (deferred, open decision D10):**
  - Supabase Storage private bucket, `createSignedUploadUrl` (single-use, short-lived), and the function downloads the object.
  - `remove()` runs in `finally`, with an hourly sweeper deleting objects older than 15 min as a safety net.
  - This needs a bucket migration and moves the file outside the function, which is a weaker privacy story.
  - Recommendation: **do not build in v1.**

### 3.3 OCR/vision via Azure OpenAI [Rev5 D31; replaces the Rev 4 OpenAI-direct section]

Sources for this section are `/workspace/renocheck-review/azure-openai-check.md` (S-A1…S-A15, read 2026-10-20) and S-X1 (`@ai-sdk/azure` docs, not Microsoft).

- **Split by feature.**
  - Quote analysis calls **Azure OpenAI in Microsoft Foundry Models**: model `gpt-6-luna`, **Global Standard** deployment, on a resource in **Japan East**, paid pay-as-you-go on Aaron's own Azure subscription.
  - Company reports keep `resolveRiskReportModel()` and Gemini **unchanged**. The two paths share no key, resolver or fallback.
  - **No fallback.** If the quote env is missing or Azure is down, quote analysis returns 503 `quote_llm_unavailable`. It **never** falls back to Gemini, the AI Gateway or OpenAI direct, because the consent names Microsoft Azure only.
  - [Rev5] Tests assert:
    - `src/lib/llm-model.ts` never reads `AZURE_*` and never imports `@ai-sdk/azure`;
    - `src/lib/quote/*` never imports `llm-model.ts`, `@ai-sdk/openai`, `@ai-sdk/google` or `@ai-sdk/gateway`.
- **Provider module.** One server-only module, `src/lib/quote/provider.ts`, builds the provider explicitly so nothing else picks the key up implicitly. The default `azure` instance is never used.
  - `createAzure({ resourceName: process.env.AZURE_RESOURCE_NAME, apiKey: process.env.AZURE_API_KEY })` (S-X1).
  - The URL is `https://{resource}.openai.azure.com/openai/v1/…`.
  - The model is `quoteAzure(process.env.QUOTE_AZURE_DEPLOYMENT, { modelId: 'gpt-6-luna' })`. That uses the **Responses API by default**, and `modelId` keeps capability detection correct when the deployment name differs.
- **One structured call** (no separate OCR vendor):
  - `generateObject({ model, schema: quoteAnalysisSchema, system, messages: [{ role:'user', content:[text, ...file parts] }], abortSignal, maxOutputTokens: 4000, maxRetries: 0, providerOptions: { azure: { store: false, reasoningEffort: 'low', strictJsonSchema: true } } })`.
  - [Rev6 N-M2] **SDK-level retries are disabled (`maxRetries: 0`).** `ai@7.0.138` `generateObject` defaults to `maxRetries: 2`, which would hide up to 2 extra billed calls inside one reservation (蟲 review, installed code).
    - The **only** retry is ours (§3.4). It runs only for `provider_unavailable` (5xx/network).
    - It **never** runs for `provider_rate_limited` (429; tell the user to retry later) or for `content_filter`/400.
    - Each attempt has its own `quote_usage` row (`attempt` 1/2), its own reservation and settle (§14.2), and counts once against the call ceiling.
  - [Likely, verify against the installed `@ai-sdk/azure` types in F2] The option names are `store`, `reasoningEffort` and `strictJsonSchema` under `providerOptions.azure` (the `openai` key is also accepted), plus per-part `imageDetail`.
- **`store:false` is mandatory, tested, and [Rev6 S4] enforced at runtime.**
  - [Rev6.1 L2] Azure's Responses API keeps response data for 30 days by default ([Certain], https://learn.microsoft.com/en-us/azure/foundry/openai/how-to/responses: "By default, response data is retained for 30 days.", read 2026-10-19). `@ai-sdk/azure` defaults `store` to **true** (S-X1).
  - Stored Responses, completions and Assistants data sit in the resource's geography (S-A1, [Certain]).
  - F2/F3 add a mock-fetch test asserting the outgoing body has `"store": false`, no `file_id`, no `background` and a generic `filename`. Any change that drops `store:false` fails CI.
  - **No Files API.** **No background mode.** **No `previousResponseId`.**
  - [Rev6 S4] **Runtime guard.** `provider.ts` passes `createAzure({ …, fetch: guardedFetch })`. `guardedFetch` parses the outgoing JSON body and **throws `provider_bad_request` before sending** unless:
    - `body.store === false`;
    - there is no `background`, `previous_response_id` or `file_id`;
    - any `filename` is `quote.pdf`.
  - F3 tests both the guard and the real SDK body.
  - After the F3 smoke on the **dev** resource, a `GET /openai/v1/responses/{id}` must return 404. The response `id` is never logged.
  - Azure has no resource-level switch to disable Responses storage, so this guard is the only server-side enforcement point.
  - [Rev6 L5] Use only GA API surfaces (`/openai/v1/responses`). No preview features or preview API versions without a consent re-check, because the data-privacy page says preview features "may employ different privacy practices".
- **Env and keys.** Aaron sets them in Vercel himself. Agents never read `.env` and check only presence (e.g. a `/api/health` boolean).
  - `AZURE_RESOURCE_NAME`: the **prod** resource (Japan East) in Production, and a **separate dev** resource in Preview/Development.
  - `AZURE_API_KEY`: that resource's key. Prod and dev keys are separate. [Rev6 S6] It's a Vercel **Sensitive** env var: the prod key is Production-only and never in Preview. Rotate every 90 days via Key 2 → Vercel → Key 1 (§14.1).
  - `QUOTE_AZURE_DEPLOYMENT`: the deployment name, e.g. `quote-gpt-6-luna`.
  - The model id `gpt-6-luna` is a code constant (`QUOTE_MODEL_ID`), so the §7 price constants stay in sync. Changing it means a re-eval and Aaron's OK.
  - Entra ID / `tokenProvider` isn't used in v1. Keys are simpler on Vercel.
- **Dependency:** `@ai-sdk/azure` is new and needs Aaron's OK (D34).
  - Use the major that matches `ai@7` (same `@ai-sdk/provider` major as the installed `@ai-sdk/google`) [Likely, verify with pnpm].
  - `@ai-sdk/openai` is **not** added.
- **Deployment type and data location** [Certain, S-A1/S-A4/S-A6]:
  - Global Standard may process a request "in any geography where the relevant model is deployed".
  - Data at rest stays in the resource's geography (Japan for a Japan East resource). That includes the abuse-monitoring store and any stored state.
  - There is **no East Asia (Hong Kong) region** for any Azure OpenAI model.
  - `gpt-6-luna` is Global Standard only in APAC; it has no APAC Data Zone deployment.
  - Japan East was chosen because it has a confirmed `gpt-6-luna` Global price meter (S-A7). Southeast Asia is listed in the docs but has no meter [Unverified].
- **Images** [Certain, S-A5: `gpt-6-luna` takes text + image input]:
  - Sent inline as base64 data URLs (JPEG from our client).
  - `detail`: `high` by default. The eval decides whether `original` is worth it (D3b).
- **PDFs** [Likely, S-A8 snippet and S-X1]:
  - Vision models on the Responses API accept a base64 `file_data` PDF. The model gets extracted text plus an image of each page. Limits are under 50 MB per file and 50 MB combined.
  - The AI SDK sends a `file` part with `mediaType: 'application/pdf'`, on the Responses API only.
  - Send `filename: "quote.pdf"`, never the user's filename.
  - F2 verifies with a synthetic fixture.
- **Structured output** [Likely, verify in F2]:
  - The AI SDK turns the zod schema into a strict JSON schema. Strict mode needs every property `required`, so optional fields become `.nullable()`.
  - Some keywords (e.g. `maxLength`) may not be enforced. The server-side caps (S5) stay authoritative.
  - A refusal maps to `provider_refused`. A content-filter block maps to `provider_content_filtered`, because Azure applies default guardrails [Likely].
  - In both cases the slot is released (within the release cap) and the user sees the generic retry message.
- **Model (D3b):** `gpt-6-luna` (Azure model version 2026-09-22, S-A5). It is Aaron's choice, as the cheapest model.
  - `gpt-5.6-luna` (Global, $0.20 / $1.20) stays an eval-only challenger. It's used only if `gpt-6-luna` fails the eval thresholds, and needs Aaron's OK.
  - `gpt-4.1-mini` is the quota fallback (§14.1), also only with Aaron's OK.
- **Reasoning and output budget:**
  - `gpt-6-luna` is a reasoning model. Reasoning tokens bill as output and count toward the cap.
  - Settings: `reasoningEffort: 'low'` (try `'none'` in the eval) and `maxOutputTokens: 4000`.
- **Error classes** (Azure → our status; see §14.2) [Likely; codes to verify in F3]. **Never log the raw error** (§6.3 M3 allowlist; `APICallError.requestBodyValues` holds the base64 file).
  - 400 with code `content_filter` → `provider_content_filtered`; any other 400 → `provider_bad_request`
  - 401 / 403 / 404 `DeploymentNotFound` → `provider_denied` (config or key problem)
  - 429 (TPM/RPM quota) → `provider_rate_limited`. [Rev6 S8] Handling:
    - **No retry** in the request (N-M2). Release the slot (within the release cap).
    - Log `retry_after_s` (integer from the header, allowlisted).
    - **≥5 × 429 in 5 minutes** → a 10-minute **soft pause** (`paused_until` on the daily row, §4 M2) with the paused copy, so we don't hammer the deployment.
  - 5xx, network or our abort → `provider_unavailable` (the only class our single retry may follow, if >25s of budget remains).
  - [Rev6 L2] Allowlist-log the `x-ms-region` response header (if present) as `processed_region`. It's evidence for R10 and the DPIA.
- **Output contract (LLM slice, zod):**
  - `isQuotation: boolean`
  - `companyNameZh?`, `companyNameEn?` (business names only), `brNumber?` (8-digit pattern), `quoteDate?` (YYYY-MM-DD or null)
  - `items: Array<{ id: ChecklistId (enum), status: "clear" | "vague" | "missing" | "not_applicable", evidence?: string (zod ≤200 chars, verbatim excerpt from the quote; server truncates to 80, [Rev3 S5/L5]), reasonCode: enum }>`
  - [Rev3 M4] `sensitiveSeen: { idNumber: boolean, signature: boolean, bankAccount: boolean }`. It's an after-the-fact user warning only, and the analysis row stores only the three flags.
  - Each id appears exactly once. Validation fills missing ids as `missing` with `reasonCode: "not_returned"`. This is shown neutrally and the eval tracks it.
  - **No free-text paragraphs from the model reach the user.** Explanations come from approved per-item copy keyed by `reasonCode`. This keeps wording under Aaron's control and limits prompt-injection impact (§10).
- [Rev3 S5] **Free-text field hardening:**
  - **`companyNameZh/En`:**
    - First the PII redactor runs (S6).
    - Then: trim, cap at ≤60 characters, and strip control, zero-width and bidi characters (U+200B–U+200F, U+202A–U+202E, U+2066–U+2069).
    - It must contain 有限公司/公司/工程/Limited/Ltd/Co., must have no URL, email or phone, and must not match the honorific-name pattern. Otherwise it's dropped and the user just sees the editable field.
  - **`brNumber`:** must match `^\d{8}$` exactly.
  - **`evidence`:**
    - Sanitised as above, URLs stripped, truncated to 80, then redacted.
    - Rendered only as React text inside a `<q>` labelled 「報價單原文」, and never put into the WhatsApp reply.
    - It isn't run through `REPORT_TRUST_FORBIDDEN_ZH`, since it's the quote's own words. Our labels around it are.
- [Rev3 S12] **`isQuotation=false`** is accepted only if `items` is empty or all `not_applicable`. Otherwise it's treated as a quote. The eval has 2 borderline fixtures (an invoice and a contract excerpt).
- [Rev3 S5] **Isolation invariant (with test):** nothing from quote analysis or feedback is ever:
  - written to `search_cache`;
  - passed into `/api/search` beyond the user-confirmed name or BR;
  - used in any LLM prompt;
  - used as a grading input.
  A test scans the grading/calibration modules and `search-pipeline.ts` for imports from `quote/` or `feedback/` and fails if it finds any.
- **Price fairness:** the schema has **no** price fields. The prompt tells the model to ignore amounts except to judge whether a unit or quantity is stated.

### 3.4 Timeouts within the 60s function

| Stage | Budget |
|-------|--------|
| formData parse + magic bytes + PDF page count | ≤ 2s |
| Quota claim RPC (Supabase, sin1 → ap-southeast-1) | ≤ 2s |
| Azure OpenAI call (`abortSignal`) [Rev5] | aborted at **T+45s** (`QUOTE_LLM_DEADLINE_MS`) |
| Bind + redact + build reply | < 100 ms |
| Insert anonymised result + finalize usage | ≤ 2s |
| Whole route | `QUOTE_PIPELINE_BUDGET_MS = 50_000`, `maxDuration = 60` |

- On our own deadline abort or a server-side provider failure: release the free slot (or leave the paid credit unconsumed) and return 503 `quote_llm_failed` with copy 「分析暫時失敗，今次唔會計你次數，請稍後再試」 (DRAFT). [Rev3 S2] Releases are bounded: at most 2 per device per HKT day, and a client disconnect never releases (§4 M2).
- Retries: [Rev6 N-M2] SDK retries are **off** (`maxRetries: 0`). We allow at most 1 retry of our own:
  - only after `provider_unavailable` (5xx/network), and only if more than 25s of budget remains;
  - never after 429, `content_filter`/400 or our own deadline abort;
  - the retry takes its own `quote_usage` attempt row, reservation and settle.

### 3.5 One-click company report

- Extract `submitCompanySearch(input): Promise<{fingerprint}>` from `SearchForm.tsx`. It wraps the fetch, the 429/503 handling and the sessionStorage write. `SearchForm` and the quote result then share it.
- Preference: `brNumber` if one was extracted (the `br` search is more precise), otherwise `companyNameZh ?? companyNameEn`.
- The button shows the name it will search. A secondary link, 「名唔啱？自己改」 (DRAFT), focuses an inline editable field. Then it routes to `/report/{fp}`.
- Company search stays free and unlimited because `/api/search` is untouched. The existing 30/min IP limit still applies.
- Nothing about the quote is passed to `/api/search` beyond the company name or BR.

### 3.6 Feature flags (env, read server-side)

- `QUOTE_ANALYSIS_ENABLED`: default off in prod until launch. The route returns 404 and the page shows 「即將推出」 (DRAFT) or is hidden.
- `QUOTE_PAYMENTS_ENABLED`: default off. When off, the user sees 「今日免費次數已用完，聽日再試」 (DRAFT).
- `FEEDBACK_ENABLED`: [Rev3 S8] defaults to **off in code**. The route returns 503 if the flag is off or the table is missing. Flip it in Vercel only after M1 is applied (§4 deploy order).
- [Rev4] ~~Region gate for EEA/UK/CH~~ removed: it was a Gemini free-tier rule. [Rev5] No region gate for Azure either; HK users are served (D31).
- `QUOTE_PROVIDER_PAUSED` (optional manual kill switch) plus the automatic US$1/day cap and breaker in §14.2 ([Rev5] D36).

---

## 4. Data model: three separate migrations, each needing Aaron's approval

All three migrations follow the `20261018140000` pattern:
- RLS enabled, no policies.
- `revoke all … from anon, authenticated`; grant DML to `service_role` only.
- Any function: `security invoker`, `set search_path = ''`, `revoke execute … from public, anon, authenticated`, `grant execute … to service_role`.
- A paired manual rollback in `supabase/rollbacks/` plus a row in its README.
- No seed data, no PII.

[Rev3 S8] **Deploy order for every migration PR:**
1. Merge the code with the feature flag **off by default in code**.
2. Deploy and confirm prod is healthy.
3. Pre-apply checks:
   - Supabase Reports → Disk IO budget below 50% over the last 24h.
   - `get_advisors` (security + performance) clean for the existing tables.
   - The Supabase GitHub integration / branching auto-deploy is confirmed **off**, so a merge never applies migrations.
4. Aaron OKs, then apply off-peak (HKT late evening).
5. Run `get_advisors` again; there must be no new RLS or permission warnings.
6. Flip the flag in Vercel.

Rollback runs in reverse: flag off first, then the down migration only if necessary.

Migration testing: **no Docker on Aaron's Mac.** Run `supabase start` + `db reset` in the cloud agent or on the box (Linux), or on a free-tier dev project. Never `db push` to prod without Aaron's explicit OK.

### M1: `YYYYMMDDHHMMSS_report_feedback.sql` (PR-F1)

```sql
create table public.report_feedback (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  surface text not null check (surface in ('company_report','quote_analysis')),
  report_ref text not null check (report_ref ~ '^[0-9a-f]{32}$' or report_ref ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'), -- fingerprint or quote analysis uuid [Rev6.3 L7]
  report_version text check (report_version is null or char_length(report_version) <= 32), -- REPORT_VERSION or QUOTE_ANALYSIS_VERSION at time of rating [Rev6.3 L7]
  rating text not null check (rating in ('up','down')),
  comment text check (comment is null or char_length(comment) <= 500),  -- server-redacted; C0/C1 control + bidi chars stripped before insert [Rev3 L3]
  placement text not null check (placement in ('slide_in','inline')),
  device_hash text not null check (device_hash ~ '^[0-9a-f]{64}$'), -- HMAC(rc_did); never raw cookie [Rev6.3 L7]
  unique (surface, report_ref, device_hash) -- one vote per report per device; upsert allows changing vote
);
create index report_feedback_created_at_idx on public.report_feedback (created_at desc);
create index report_feedback_ref_idx on public.report_feedback (surface, report_ref);
alter table public.report_feedback enable row level security;
revoke all on table public.report_feedback from anon, authenticated;
grant select, insert, update, delete on table public.report_feedback to service_role;
```

The rollback is `drop table public.report_feedback;` (data loss, so it is marked EMERGENCY).

- [Rev3 S11] The `report_feedback` purge ships in F1: a pg_cron job if it's available on the free plan, otherwise `/api/cron/purge` with `CRON_SECRET` on a daily Vercel Cron. Retention follows D8.
- [Rev3 L3] Any CSV export prefixes `'` to cells starting with `= + - @`, to block formula injection.

### M2: `YYYYMMDDHHMMSS_quote_analysis_usage.sql` (PR-F3)

- `quote_usage`: one row per analysis attempt. [Rev3] New columns: `request_id uuid not null` (S3; [Rev6.1 L4] uniqueness is `unique (request_id, attempt)`, see below) and `provider_called boolean not null default false` (S2). The `status` check list gains `provider_bad_request`, `provider_denied`, `provider_rate_limited`, `provider_unavailable`, and `provider_refused`, plus [Rev5] `provider_content_filtered` and `quote_paused` (cap reached, so no provider call is made). ~~`provider_budget_exhausted`~~ is dropped, since Azure has no `insufficient_quota`. The classes are defined in §3.3 / §14.2. [Rev6 S2/N-M2] New content-free columns: `attempt smallint not null default 1`, `reserved_day date`, `reserved_micro_usd bigint`, `est_cost_micro_usd bigint`, `settled_at timestamptz`, `price_source_date date` (L7) and `processed_region text` (L2).
  - `request_id` uniqueness becomes `unique (request_id, attempt)`.
  - The spend cap lives in the single-row-per-day `quote_spend_daily` table below, **not** in sums over `quote_usage`.
  - Columns: `id uuid pk`, `created_at`, `day_hkt date not null`, `device_hash text not null`, `ip_hash text not null`, `kind text check in ('free','paid')`, `status text check in ('claimed','succeeded','failed','not_quote')`, `analysis_id uuid null`.
  - (Rev 2) `consent_version text not null` (e.g. `quote-azure-1`, [Rev5]) and `consent_at timestamptz not null` (server time when the request was accepted). No PII: these are tied only to the hashed device/IP already on the row. This is our record that the user agreed to the consent text for that upload.
  - `claim_quote_slot` gains `p_consent_version text` and writes both columns; the route refuses to call it without valid consent.
  - Index on `(day_hkt, device_hash)` and `(day_hkt, ip_hash)`.
- `quote_analyses`: the anonymised result only.
  - Columns: `id uuid pk` (also used as feedback `report_ref`), `created_at`, `analysis_version text`, `model_label text`, `input_kind text check in ('images','pdf')`, `page_count smallint`.
  - `items jsonb` holds `[{id,status,reasonCode}]` with **no evidence text stored**. Evidence excerpts are returned to the user once and never persisted.
  - `missing_count smallint`, `vague_count smallint`.
  - `company_name text null`: only stored if it matches a limited-company pattern (有限公司/Limited), since sole-proprietor trade names can be personal names. This is open decision D9.
  - `company_fingerprint text null`: the `buildSearchFingerprint` of the name, so we can later join to `search_cache` stats without storing more.
- Function `public.claim_quote_slot(p_device_hash text, p_ip_hash text, p_day date, p_device_limit int, p_ip_limit int, p_global_limit int) returns uuid`:
  - It runs a single `insert … select … where (count for device/day where status in ('claimed','succeeded','not_quote')) < p_device_limit and (ip count) < p_ip_limit and (global count) < p_global_limit returning id`.
  - It uses `pg_advisory_xact_lock(hashtext(p_device_hash))` to serialise per device (free-slot counting only; [Rev6] spend is serialised by the `quote_spend_daily` row lock). This makes it atomic and avoids the `setCachedReport` race class.
  - It returns null when over the limit.
- Function `public.release_quote_slot(p_id uuid)` sets `status='failed'`. Failed rows don't count toward the device/IP limits.
- [Rev3 S2] **Counting rules:**
  - `claim_quote_slot` counts `status in ('claimed','succeeded','not_quote')`, but treats `claimed` rows older than 120s as failed. A hard kill at `maxDuration` skips `finally`, so this stops the user losing a slot.
  - A separate **provider-call ceiling** counts every provider attempt, failed ones included ([Rev6] now `quote_spend_daily.calls`, incremented per attempt in `reserve_quote_spend`). Default (D26): **300 provider calls/day**, plus the [Rev5] **locked US$1/day spend cap** (D36, §14.2), whichever trips first. Azure's quota is far above our needs: Tier 1 `gpt-6-luna` Global Standard is 1,000 RPM / 1M TPM (S-A12).
  - [Rev6.1 S1] The paid reserve applies on both axes inside `reserve_quote_spend`: free attempts stop at 80% of `call_limit` (240 of 300) and at `free_cap_micro_usd` (US$0.80); paid attempts may use the full 300 calls and US$1.00 (D26, D36b). `claim_quote_slot` no longer takes `p_paid_reserve`.
  - Releases happen only on server-side provider failure classes or our own deadline abort. A client disconnect after the provider call started does **not** release (don't wire `req.signal` to release).
  - At most 2 releases per device per HKT day; after that, failures count.
  - [Rev6.1 S3] `claim_quote_slot` counts slots by **distinct `request_id`**, so a retry row never takes a second slot.
  - A paid credit allows at most 3 attempts (provider failure or `not_quote`) before it is consumed.
- [Rev3 L2] Use the two-key advisory lock `pg_advisory_xact_lock(4242, hashtext(p_device_hash))` so it doesn't share a namespace with other locks. The IP and global caps are documented as approximate (± concurrency).
- [Rev6 S2] **Daily spend counter (replaces the Rev 5 "sum + global advisory lock" cap mechanics).**
  - One row per HKT day, updated with a conditional `UPDATE`. The row lock on that single row serialises all devices globally.
  - The day comes from the DB clock, never from the app.
  - Settle is idempotent and books to the reservation's day.
  - Stale reservations older than 180s are swept to spent (fail-safe).
  - Free usage stops at US$0.80, leaving US$0.20 for paid credits (D36b).
  - 蟲's paste-ready SQL, adapted for the 429 soft pause:
```sql
create table public.quote_spend_daily (
  day_hkt            date primary key,
  cap_micro_usd      bigint not null default 1000000,   -- US$1.00 (D36, code constant mirrored here)
  free_cap_micro_usd bigint not null default 800000,    -- paid reserve: free usage stops at US$0.80 (D36b)
  reserved_micro_usd bigint not null default 0 check (reserved_micro_usd >= 0),
  spent_micro_usd    bigint not null default 0 check (spent_micro_usd >= 0),
  calls              int    not null default 0,
  call_limit         int    not null default 300,
  paused_reason      text,                               -- e.g. 'provider_denied' (rest of day / manual reset)
  paused_until       timestamptz                         -- [Rev6 S8] 10-min soft pause after 5x429 in 5 min
);
-- RLS on, no policies; revoke all from anon, authenticated; grant DML to service_role (20261018140000 pattern).

-- quote_usage gains: attempt smallint not null default 1, reserved_day date,
--   reserved_micro_usd bigint, est_cost_micro_usd bigint, settled_at timestamptz,
--   price_source_date date, processed_region text; unique (request_id, attempt).

create or replace function public.reserve_quote_spend(p_usage_id uuid, p_reserve bigint, p_kind text)
returns boolean language plpgsql security invoker set search_path = '' as $$
declare v_day date := (now() at time zone 'Asia/Hong_Kong')::date;  -- DB clock, not app
begin
  if p_reserve is null or p_reserve <= 0 or p_kind not in ('free','paid') then  -- [Rev6.1 L1]
    raise exception 'bad_reserve_args';
  end if;
  insert into public.quote_spend_daily(day_hkt) values (v_day) on conflict do nothing;
  perform public.sweep_quote_reservations(v_day);                      -- convert stale ones first
  update public.quote_spend_daily
     set reserved_micro_usd = reserved_micro_usd + p_reserve, calls = calls + 1
   where day_hkt = v_day
     and paused_reason is null
     and (paused_until is null or paused_until < now())
     and calls < case when p_kind = 'paid' then call_limit else (call_limit * 4) / 5 end  -- D26: 20% paid reserve [Rev6.1 S1]
     and spent_micro_usd + reserved_micro_usd + p_reserve
         <= case when p_kind = 'paid' then cap_micro_usd else free_cap_micro_usd end;
  if not found then return false; end if;                 -- row lock on the single row = global serialisation
  update public.quote_usage
     set reserved_day = v_day, reserved_micro_usd = p_reserve, provider_called = true
   where id = p_usage_id and settled_at is null;
  if not found then raise exception 'usage_row_missing'; end if;  -- [Rev6.1 L1] rolls back the counter increment
  return true;
end $$;

create or replace function public.settle_quote_spend(p_usage_id uuid, p_actual bigint)  -- p_actual null = usage missing
returns void language plpgsql security invoker set search_path = '' as $$
declare r record;
begin
  select reserved_day, reserved_micro_usd into r
    from public.quote_usage where id = p_usage_id and settled_at is null for update;
  if not found then return; end if;                        -- idempotent: already settled or swept
  update public.quote_spend_daily
     set reserved_micro_usd = reserved_micro_usd - r.reserved_micro_usd,
         spent_micro_usd    = spent_micro_usd + coalesce(p_actual, r.reserved_micro_usd)
   where day_hkt = r.reserved_day;                         -- book to the day it was reserved
  update public.quote_usage
     set est_cost_micro_usd = coalesce(p_actual, r.reserved_micro_usd), settled_at = now()
   where id = p_usage_id;
end $$;

create or replace function public.sweep_quote_reservations(p_day date)
returns void language plpgsql security invoker set search_path = '' as $$
-- [Rev6.1 S4] skip locked: no deadlock between concurrent sweeps; stale rows from earlier days book to their own day.
begin
  with stale as (
    select id, reserved_day, reserved_micro_usd
      from public.quote_usage
     where reserved_day <= p_day and settled_at is null and reserved_micro_usd is not null
       and created_at < now() - interval '180 seconds'          -- > maxDuration 60s + margin
     for update skip locked                                   -- concurrent sweeps/settles never block or deadlock
  ), done as (
    update public.quote_usage u
       set est_cost_micro_usd = s.reserved_micro_usd, settled_at = now(),
           status = case when u.status = 'claimed' then 'failed' else u.status end
      from stale s where u.id = s.id
    returning s.reserved_day, s.reserved_micro_usd
  )
  update public.quote_spend_daily d
     set reserved_micro_usd = d.reserved_micro_usd - t.total,
         spent_micro_usd    = d.spent_micro_usd + t.total     -- conservative: stale = spent
    from (select reserved_day, sum(reserved_micro_usd) total from done group by reserved_day) t
   where d.day_hkt = t.reserved_day;
end $$;
-- revoke execute … from public, anon, authenticated; grant execute … to service_role (all three).

-- [Rev6.1 S3] Attempt 2 of the same request: inherits the slot, never counts as a new slot.
create or replace function public.begin_quote_retry(p_usage_id uuid) returns uuid
language plpgsql security invoker set search_path = '' as $$
declare v_id uuid;
begin
  insert into public.quote_usage (request_id, attempt, day_hkt, device_hash, ip_hash, kind, status, consent_version, consent_at)
  select request_id, 2, day_hkt, device_hash, ip_hash, kind, 'claimed', consent_version, consent_at
    from public.quote_usage where id = p_usage_id and attempt = 1 and status = 'provider_unavailable'
  on conflict (request_id, attempt) do nothing
  returning id into v_id;
  return v_id;                      -- null = no retry allowed
end $$;

-- [Rev6.1 S3] Pause triggers, called after an attempt is finalised; counts come from quote_usage, not app memory.
create or replace function public.note_quote_provider_status(p_status text) returns void
language plpgsql security invoker set search_path = '' as $$
declare v_day date := (now() at time zone 'Asia/Hong_Kong')::date;
begin
  if p_status = 'provider_rate_limited' and (select count(*) from public.quote_usage
       where status = 'provider_rate_limited' and created_at > now() - interval '5 minutes') >= 5 then
    update public.quote_spend_daily set paused_until = now() + interval '10 minutes' where day_hkt = v_day;
  elsif p_status = 'provider_denied' and (select count(*) from public.quote_usage
       where status = 'provider_denied' and created_at > now() - interval '10 minutes') >= 3 then
    update public.quote_spend_daily set paused_reason = 'provider_denied' where day_hkt = v_day;
  end if;
end $$;
-- revoke execute … from public, anon, authenticated; grant execute … to service_role (both).
```
  - `claim_quote_slot` keeps the per-device/IP free-slot logic. Its `p_day` argument is **ignored** in favour of the DB-computed HKT day (Rev6 S2). The provider-call ceiling moves to `quote_spend_daily.calls`.
  - Refunds and payment-provider ([Rev6.2] Airwallex) events never touch `quote_spend_daily`, because the provider cost was incurred.
- [Rev3 S7] **Consent evidence aggregate:** `quote_consent_daily(day_hkt date, consent_version text, count int, primary key(day_hkt, consent_version))`. It's incremented in the same transaction as the claim, has no device hash, and outlives the `quote_usage` purge. Retention is D30.
- Retention (open decision D8): a scheduled delete of `quote_usage` older than 30 days and `quote_analyses` older than 180 days.
  - [Likely] `pg_cron` on the Supabase free plan works, but needs verifying. Fallback: a Vercel Cron route `/api/cron/purge` protected by `CRON_SECRET`, using a Vercel cron entry in `vercel.json`.

### M3: `YYYYMMDDHHMMSS_quote_payments.sql` (PR-F5)

- `quote_payments`:
  - `id uuid pk` (= credit id, = [Rev6.2] Airwallex `merchant_order_id` and create `request_id`), `created_at`
  - [Rev6.2] `provider text not null default 'airwallex'`, `provider_intent_id text unique` (Airwallex PaymentIntent `int_…`)
  - `amount_hkd_cents int not null`, `currency text default 'hkd'`
  - `status text check in ('pending','paid','consumed','refunded','expired')`
  - `device_hash text not null`, `paid_at`, `consumed_at`, `analysis_id uuid null`, `expires_at timestamptz` (proposal: paid_at + 30 days, D13)
- **No email, name or card data.** [Rev6.2] Airwallex holds those.
- [Rev3 S1] Also: `last_event_id text` (webhook dedupe); `recovery_code_hash text` (sha256 of a separate 10-character Crockford base32 code, ~50 bits, single redeem); `attempts smallint default 0` (max 3, S2).
- [Rev3 L4] `create index on public.quote_payments (device_hash, status, paid_at);`
- Function `public.consume_quote_credit(p_device_hash text) returns uuid` runs an atomic `update … set status='consumed' … where id = (select id … where device_hash=… and status='paid' and expires_at>now() order by paid_at limit 1 for update skip locked) returning id`.
- Function `public.unconsume_quote_credit(p_id uuid)` handles LLM failure.

---

## 5. Quota and payment design

### 5.1 Identity without login

| Signal | How | Weakness |
|--------|-----|----------|
| Device id | `rc_did`: random 128-bit, set by the server on first `/api/quote/quota` or `/api/feedback`. `HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=1y`. The DB stores only `HMAC_SHA256(QUOTE_HASH_SECRET, rc_did)`. | Incognito, clearing cookies or switching browser gives a fresh device. Accepted for a v1 that is cost-capped. |
| IP | [Rev3 S4] Vercel's `x-real-ip`, or `ipAddress(req)` from `@vercel/functions` (new dependency, needs Aaron's OK, D11c). Never trust a client-supplied leftmost `x-forwarded-for` if the site ever sits behind another proxy. IPv6 is normalised to its **/64** prefix and IPv4-mapped IPv6 to IPv4 before the HMAC; unit tests cover each case. The DB stores `HMAC(QUOTE_HASH_SECRET, ip + day_hkt)`, so it changes daily and can't track across days. | HK mobile carriers and offices share IPs behind CGNAT, so a tight IP cap blocks real users. The cap is a loose backstop only. |
| Global | Site-wide daily free cap. | Protects the LLM bill if the device and IP caps are bypassed at scale. |

Proposed limits (open decision D11):
- Device: **2 free per HK calendar day** (locked).
- IP: **6 free per day**.
- Global: **300 free per day** ([Rev5] spend is bounded by the locked US$1/day cap, D36).
- Burst: in-memory 5 requests/min per IP on `/api/quote/analyze`, on top of the existing helper.
- Optional: Cloudflare Turnstile (free) on the analyze button if abuse shows up. That adds a third-party script and needs approval (D11b).

The day boundary is `Asia/Hong_Kong` midnight.

[Rev4] ~~Google RPD / Pacific-midnight note~~ removed: [Rev5] Azure PAYG has no free-tier RPD. Our own quotas and spend ceiling reset at HKT midnight. ~~Region gate~~ removed (§3.6).

### 5.2 Payment: Airwallex Hosted Payment Page, one-off, no accounts [Rev6.2]

- [Rev6.2] **Provider is Airwallex, not Stripe** (Aaron, 2026-10-20). The generic design is unchanged: credits, pay-before-upload, the recovery code, the idempotent webhook and fail-closed price. Only the provider calls change. Sources were read 2026-10-20. [Certain] means read on an official Airwallex page or PDF; [Likely] means it came from a search summary or a third-party page; [Unverified] means not confirmed.
- **Product choice (D2):** Airwallex offers Payment Links, Plugins, Hosted Payment Page (HPP), Embedded Elements (incl. Drop-in), Mobile SDK and Native API. Links, HPP and Elements are all PCI-DSS **SAQ A** ([Certain], https://www.airwallex.com/docs/payments/online-payments/online-payments-overview).
  - **Recommended: Hosted Payment Page.** It redirects the shopper to an Airwallex-hosted page, is the "low coding" option, and supports one-off guest checkout ([Certain], https://www.airwallex.com/docs/payments/online-payments/hosted-payment-page). It is closest to the old Stripe Checkout flow: the server sets the amount, we bind the order id, and nothing card-related touches our pages.
  - Payment Links are meant for no-code links (invoices, chat, QR) ([Certain], https://www.airwallex.com/docs/payments/payment-links/payment-links-via-web-app). Not chosen: we want a per-order server-side amount and order binding. Keep it as a fallback if the HPP client script is refused (D2); there is a `payment_link.paid` webhook ([Certain], payments-webhooks page below).
  - Drop-in Element embeds checkout in our page using Airwallex.js and a server-created PaymentIntent ([Certain], https://www.airwallex.com/docs/payments/integration-options/web-checkout/drop-in-element). Not chosen: it's more UI code for no user benefit here.
- **Flow (HPP):**
  1. The server gets an access token: `POST {AIRWALLEX_BASE}/api/v1/authentication/login` with `x-client-id` and `x-api-key` headers, then `Authorization: Bearer` ([Certain], sandbox page below). The token is cached in memory for its lifetime [Unverified TTL; verify in F5].
  2. `POST /api/quote/checkout`:
     - Creates a `quote_payments` row (`pending`).
     - Calls `POST /api/v1/pa/payment_intents/create` with `request_id = payment.id` (idempotency), `amount` (**decimal major units, e.g. 20.00, not cents** [Certain: the docs' payload example shows `"amount": 16.66`]), `currency: 'HKD'` and `merchant_order_id = payment.id`.
     - Stores the intent id `int_…` and returns `{intent_id, client_secret}` ([Likely], https://www.airwallex.com/docs/payments/get-started/using-payments-intent-api, via search summary).
     - The amount is always decided server-side.
  3. The browser calls Airwallex.js `redirectToCheckout({intent_id, client_secret, currency, country_code:'HK', successUrl:'/quote?paid=1'})` [Likely, from the guest-checkout guide via search summary; the guest-checkout page returned HTTP 500 when fetched]. `methods[]` can restrict the payment methods ([Certain], HPP page).
  4. `POST /api/airwallex/webhook` verifies the signature (below). On `payment_intent.succeeded` it marks the row `paid`. It is idempotent on the intent id and the event id. The docs say not to fulfil from the return redirect alone [Likely].
  5. On return, `/quote?paid=…` calls `GET /api/quote/quota?intent=…` as a webhook-latency fallback. The server retrieves the PaymentIntent (`GET /api/v1/pa/payment_intents/{id}` [Likely]) and checks `status === 'SUCCEEDED'`, amount, currency and `merchant_order_id === row.id`. It may only move `pending→paid`, never create a row. The page then shows 「已付款：可以分析 1 份報價單」 (DRAFT).
  6. Analyze consumes the credit atomically (M3). If the LLM fails, the credit is unconsumed and the user can retry.
- **Pay before upload:** the paywall shows before file selection, so the payment redirect never loses a selected file.
- **Lost cookie:** [Rev3 S1] the success screen shows a **separate 10-character Crockford base32 recovery code**, not derived from the payment UUID (that's the `merchant_order_id` visible in Airwallex). Copy: 「如果換咗機／清咗 cookie，可以用呢個 code」 (DRAFT).
  - Only `sha256(code)` is stored.
  - Single redeem; redeem is rate-limited to 5/hour per device and IP; the code expires with the credit.
  - Open decision D13.
- [Rev6.2] **Airwallex hardening** (replaces Rev 3's Stripe hardening; same intent):
  - **Webhook signature** ([Certain], https://www.airwallex.com/docs/developer-tools/webhooks/listen-for-webhook-events):
    - Headers are `x-timestamp` (Unix **milliseconds**) and `x-signature`, the hex HMAC-SHA256 of `x-timestamp` (as received) **followed by the raw body**, keyed with that notification URL's own secret.
    - Read the raw body with `await req.text()`. Verify **before** parsing, compare with `crypto.timingSafeEqual` (equal-length check first), then reject if `|now − x-timestamp| > 300,000 ms`. The docs leave the window to us.
    - Return `200` quickly; Airwallex retries on non-200 or timeout ([Certain]).
    - Test events are signed with the key in their `client-secret-key` header ([Certain]), so tests use a fixture secret.
    - No official verification helper is assumed. The check is ~10 lines of `node:crypto` ([Likely]: a third-party guide says `@airwallex/node-sdk` has no inbound-signature helper).
    - Dedupe on the event `id` via `last_event_id`. Return 2xx for unhandled event names.
  - **Events handled** ([Certain] names from https://www.airwallex.com/docs/payments/reference/payments-webhooks):
    - `payment_intent.succeeded` → `paid`.
    - `payment_intent.cancelled` → `expired`.
    - `payment_intent.payment_failed`, `payment_intent.requires_customer_action` and `payment_attempt.*` → log only.
    - `refund.settled` → `refunded`.
    - `payment_dispute.*` → log only.
    - `fraud.merchant_notified` → log and alert Aaron (the docs say to refund and hold delivery).
  - **Every paid transition** checks `round(intent.amount × 100) === row.amount_hkd_cents`, `intent.currency === 'HKD'` and `intent.merchant_order_id === row.id`, through a conditional `update … where status='pending'`.
  - **Create idempotency:** `request_id = payment.id`. The pay button is disabled while the request is in flight.
  - **Environment guard:**
    - Sandbox and production are separate, with separate keys and hosts: `https://api.sandbox.airwallex.com/api/v1/` vs `https://api.airwallex.com/api/v1/` ([Certain], https://www.airwallex.com/docs/developer-tools/sandbox-environment).
    - `AIRWALLEX_ENV` must be `sandbox` unless `VERCEL_ENV==='production'` **and** `QUOTE_PAYMENTS_LIVE=1`. The base URL is derived only from it.
    - [Unverified] whether keys carry an environment prefix, so the guard uses the env var, not a key prefix.
    - Prefer a **scoped/restricted API key** limited to Payments if Airwallex offers one [Unverified; check in the web app under Account > Developer > API keys].
  - A missing or invalid `QUOTE_PRICE_HKD_CENTS` (non-integer, or below the method minimum [Unverified for cards; AlipayHK min HK$0.10, Certain]) turns payments **off** (fail closed).
  - **Card-testing cost:** Airwallex charges the gateway fee **per attempted or actual transaction** ([Certain], both fee schedules). So keep the checkout rate limit of 5/hour per device, and add 30/hour per IP.
  - **Unused or expired credits:** refundable on request within 30 days, manually in the Airwallex web app (D27 default). There is a refund fee (HK$2.35 / £0.20) and the original fee is not assumed returned [Unverified].
  - [Rev3 L8] **Reverting F5:** if payments are switched off while paid credits are outstanding, consume still works, because the flag gates only checkout. Otherwise refund via Airwallex.
- **Email:** [Unverified] whether HPP asks the payer for an email. We never pass or store one.
- **Sandbox testing:** create a sandbox account. Use the entity name "Sandbox Business" for any extra sandbox accounts, or onboarding stays "In review" ([Certain], sandbox page). Test card `4035501000000008` = success ([Likely], https://www.airwallex.com/docs/payments/test-and-go-live/test-card-numbers, via search summary). Sandbox files are deleted after 90 days.
- **Dependencies and setup:**
  - Server calls use plain `fetch` (no server SDK needed).
  - HPP's `redirectToCheckout` needs the Airwallex.js client package, [Likely] `@airwallex/components-sdk`. This needs Aaron's OK under the AGENTS "new dependency" rule (D2). If refused, use the Payment Links API (server-only redirect URL) [Unverified API fields].
  - Env vars: `AIRWALLEX_CLIENT_ID`, `AIRWALLEX_API_KEY` (Sensitive), `AIRWALLEX_WEBHOOK_SECRET` (Sensitive), `AIRWALLEX_ENV`, `QUOTE_PRICE_HKD_CENTS`, `QUOTE_PAYMENTS_LIVE`.
  - Aaron enables Online Payments on the account held by MindArk IO Ltd (D2/D20) and registers the webhook URL. The docs recommend allow-listing Airwallex webhook IPs for sandbox [Certain]. Everything stays in **sandbox** until launch approval.
- **Fees (D2; all exclusive of VAT/GST; [Certain] unless marked):**
  - **Airwallex (Hong Kong) Limited**: Fee Schedule HK, 28 Mar 2025 (https://assets.ctfassets.net/e6wv1zvbwa49/4mQkKOjPROAFTtN7bRU5gY/77904191f4234c47c3c0079b97273e6d/Clean_-_2025.03.27_-_HK_-_Fee_Schedule.docx.pdf) and https://www.airwallex.com/en-hk/pricing.
    - Cards: gateway HK$2.35 per attempted or actual transaction (incl. fraud and 3DS), plus 3.30% domestic or 3.60% international.
    - WeChat Pay: HK$2.00 gateway + 1.00%.
    - Alipay/AlipayHK: HK$2.00 gateway + method fee **[Unverified: not in the schedule; see https://www.airwallex.com/hk/online-payments-capability]**.
    - Refund HK$2.35; chargeback HK$140 (tier 1).
    - [Unverified] whether a monthly plan fee applies to Online Payments only; the pricing page mentions per-organisation monthly plan fees.
    - Note: that schedule PDF is dated March 2025; re-read before F5.
  - **Airwallex UK (UK and Switzerland customers)**: Fee Schedule UK, 05 Aug 2026 (https://assets.ctfassets.net/e6wv1zvbwa49/5jTFyq4llcqHXg4sXJwWej/0a70833ee9b588b52a638d62e9d7f440/CLEAN_-_2026.08.05_-_UK_Fee_Schedule__UK_and_Switzerland_customers___v5_.docx.pdf) and https://www.airwallex.com/en-uk/pricing.
    - Gateway £0.20 per attempted or actual transaction.
    - Cards: UK 1.30%, EEA 2.40%, **international 3.15% (= HK cards)**, Amex 2.40%.
    - Local methods: £0.20 + method fee.
    - Settlement: foreign-currency settlement 1.00% (non-GBP settled as is) **or** FX conversion 2.00%.
    - Refund £0.20; chargeback £15.
    - **WeChat Pay:** for a UK-registered business it processes only EUR/GBP/CNY, and "Only HK and SG registered businesses are able to accept payments from CN and HK versions of the WeChat app" ([Certain], https://www.airwallex.com/docs/payments/payment-methods/apac/wechat-pay). So **no WeChat Pay for HK users on a UK account.**
    - **AlipayHK:** available to UK merchants, processing HKD and settling GBP ([Certain], https://www.airwallex.com/docs/payments/payment-methods/apac/alipay-hk); method fee [Unverified].
  - **Which account a UK Ltd gets** [Unverified]: Airwallex onboards by the business's country of registration, so MindArk IO Ltd most likely gets an **Airwallex UK** account. An HK account would need an HK entity. Confirm with Aaron's existing Airwallex setup (D2).
- **Price: placeholder `HK$[TBD]`.** Fee illustration for HK-issued cards, not a recommendation. UK figures assume £1 ≈ HK$10 [assumption] and 1% foreign-currency settlement (FX conversion to GBP would be 2%):

  | Price | HK account (3.30% + HK$2.35) | UK account (3.15% + 1% + £0.20 ≈ HK$2.00) | LLM cost (§7, ≈HK$0.1–0.2) |
  |------:|-----:|-----:|-----:|
  | HK$10 | HK$2.68 | ≈HK$2.42 | ≈HK$0.1–0.2 |
  | HK$15 | HK$2.85 | ≈HK$2.62 | ≈HK$0.1–0.2 |
  | HK$20 | HK$3.01 | ≈HK$2.83 | ≈HK$0.1–0.2 |
  | HK$30 | HK$3.34 | ≈HK$3.25 | ≈HK$0.1–0.2 |

  The fixed per-attempt gateway fee dominates at low prices, and failed attempts also pay it.
- **Data processing location** ([Certain], Airwallex Global Customer Privacy Policy v6, 2026-02-26, https://assets.ctfassets.net/e6wv1zvbwa49/6zfth37fc8aEAq9cbN0H6P/b3a83910ca28e335b14d909a38f2451b/-Clean-_-_Global_-_Global_Privacy_Policy__v6__2026.02.26.docx.pdf):
  - Airwallex "primarily host[s] personal information in Singapore, Belgium, the Netherlands, Japan, Australia, Malaysia, and the United States, depending on your location".
  - It may transfer data elsewhere (affiliates, partners, service providers), using EU SCCs and the **UK IDTA** where applicable.
  - Airwallex's role for payer data (independent controller vs processor) is [Unverified]. Check the Online Payment Terms / DPA in F0 (DPIA) and before F5.
- **Pre-launch legal:** before taking money we need short terms covering the refund policy (proposal: AI failure → automatic no-charge retry; otherwise email hello@renocheck.homes within 7 days). That wording also needs Aaron's approval (D14).

---

## 6. Privacy and PII handling

1. **What the user uploads** [Rev3 per 蟲 focus 1]:
   - the customer's own name, flat address and phone;
   - **third parties' data**: contractor staff names and mobiles, signatures and company chops, bank account and holder name, previous-project or other residents' addresses, occasionally an attached HKID copy;
   - in photos, EXIF GPS and device serials (removed by M7).
2. **Minimise before upload [Rev3 M4/M7]:** this is the only lever that reduces what reaches the AI provider (Azure OpenAI, [Rev5]).
   - **Tip (§8.4b)** asks users to cover or crop **their own and other people's** names, phones, addresses, signatures, ID numbers and bank accounts, and to photograph only the works/terms/payment pages.
   - **v1 (PR-F4): crop step for photos.**
     - One rectangle crop per image (drag handles, keyboard-adjustable), defaulting to the full image. The canvas re-encode bakes it in, so nothing extra is sent.
     - Optional **遮蓋** (filled black rectangles) in the same canvas. If the UI effort is too high for v1, ship crop only (D24).
   - **PDFs** are sent byte-for-byte with the note in §3.2 suggesting photos plus crop instead.
   - **After-the-fact flags** (`sensitiveSeen`, §3.3) warn the user for next time. This does **not** prevent disclosure to Microsoft Azure, which has already happened. On-device OCR before upload was considered and rejected for v1 (large wasm, weak Chinese OCR).
   - EXIF, GPS and XMP are always removed by the re-encode, and the server rejects EXIF (§3.2).
3. **In transit:** browser → Vercel sin1 function memory → Azure OpenAI, Japan East resource, Global Standard ([Rev5] inline base64, Responses `store:false`). Nothing goes to disk, Supabase Storage, Sentry or logs.
   - Log lines contain only `{event, analysis_id, input_kind, pages, bytes, ms, status, model}`.
   - Add a unit test asserting the analyze route never `console.*`s the payload or model output, using a spy.
   - [Rev3 M3] **Error logging (REQUIRED):**
     - The existing `/api/search` catch logs `String(e)` and `cause.message`. The quote and feedback routes must **not** copy that.
     - In the installed AI SDK, a schema-validation failure carries `Value: ${JSON.stringify(value)}`, which is the **entire unredacted model output**. `APICallError.requestBodyValues` holds the request body with the **inline base64 file**.
     - The quote routes never log `String(e)`, `e.message`, `e.cause` or the error object. They log only `{event, code, errorName, statusCode?, isRetryable?, ms, analysis_id}` through `quote/log.ts`, with `errorName` from an allowlist (`AI_APICallError`, `AI_NoObjectGeneratedError`, `AI_TypeValidationError`, `AbortError`, …).
     - Every quote and feedback handler has a top-level `try/catch` that never rethrows, so Next.js never prints a provider error object.
     - AI SDK `experimental_telemetry` stays disabled for quote calls.
     - If Sentry or a log drain is ever added, `/api/quote/*` must be excluded or scrubbed (`beforeSend` drops `request.data`, `extra` and the exception message). Today the repo has no Sentry SDK.
     - Sentinel tests are in §11.
4. **LLM provider data use: Azure OpenAI [Rev5 D31; replaces the Rev 4 OpenAI-direct facts]**
   - Read 2026-10-20. Labels are [Certain from the pages] unless marked. Full notes and URLs are in `azure-openai-check.md`.
   - Sources:
     - S-A1 data, privacy and security for Azure OpenAI: https://learn.microsoft.com/en-us/azure/ai-foundry/responsible-ai/openai/data-privacy
     - S-A2 abuse monitoring: https://learn.microsoft.com/en-us/azure/ai-foundry/openai/concepts/abuse-monitoring
     - S-A3 limited access: https://learn.microsoft.com/en-us/azure/ai-foundry/responsible-ai/openai/limited-access
     - S-A4 deployment types: https://learn.microsoft.com/en-us/azure/ai-foundry/openai/how-to/deployment-types
     - S-A6 region availability: https://learn.microsoft.com/en-us/azure/foundry/foundry-models/concepts/models-sold-directly-by-azure-region-availability
   - **Training and OpenAI access** (S-A1):
     - Prompts and outputs are **not available to OpenAI** or to other customers.
     - They are not used to train or improve any models, and not used to improve Microsoft or third-party products, without permission.
     - Microsoft hosts the models, which "do NOT interact with any services operated by OpenAI".
   - **Processing location** (S-A1, S-A4):
     - Global Standard may process a request in any geography where the model is deployed. So it's **outside HK, possibly any Azure region**.
     - Data at rest stays in the resource's geography, which is **Japan** for our Japan East resource. That includes the abuse-monitoring store and any stored Responses state.
     - There is no Hong Kong (East Asia) region for Azure OpenAI (S-A6).
   - **Abuse monitoring** (S-A1, S-A2):
     - Automated review (classifiers and LLMs) by default.
     - **Human review** [Rev6 S5, verified by 蟲 2026-10-19] is done by authorised Microsoft employees through secure access workstations (SAW) with just-in-time (JIT) access. It can happen when:
       - content is flagged;
       - prompts and completions are "part of a potentially abusive pattern of use";
       - automated review falls below confidence thresholds or is unavailable.
       So it is **not only** for flagged content.
     - Microsoft acts as **processor** for MindArk IO Ltd under the Microsoft DPA (D32).
     - The data store is in the resource's geography.
     - Severe or repeated abuse can lead to throttling or suspension, after an email notice with a chance to remediate (except severe cases).
     - **Retention period: not stated on the current docs [Unverified]** (蟲 re-checked 2026-10-19: neither page states one). The historical legal page said "up to thirty (30) days" (S-A15). [Rev6 S5 / D38] Consent and §八 now say 「現時公開文件冇寫明保存期（以往文件寫最多 30 日）」. That keeps Aaron's figure as historical, not as a stated limit. Re-check before F6.
   - **Modified abuse monitoring (MAM):** a Limited Access form, available only to customers "managed by a Microsoft account team or under an eligible program" (S-A3). [Likely] Aaron isn't eligible, so it isn't assumed for v1 (D33).
   - **Stored state:**
     - Responses API with `store:false` (§3.3). If anything were stored, it would sit in Japan, encrypted, and be deletable (S-A1).
     - No Files API, no Assistants.
   - **Contract / DPA:** the Microsoft Products and Services DPA, the Product Terms and the Universal License Terms for Generative AI Services apply through the Azure subscription (S-A1, S-A3). They're accepted at sign-up, with no separate form (D32). The contracting Microsoft entity for a UK customer is [Unverified]; Aaron checks it in the Azure billing account.
   - **Hong Kong market:** no OpenAI-style "supported countries" exclusion was found in the Azure OpenAI docs.
     - "All Azure customers are eligible" for models sold by Azure (S-A3).
     - Azure lists Hong Kong as a commercially available market (S-A11).
     - Microsoft HK serves HK customers via non-HK regions (S-A13; S-A14 secondary).
     - The Product Terms weren't read in full [Unverified]. **R6 (OpenAI unsupported territory) is retired with D31.**
   - **Mitigations that hold:**
     - required consent with a versioned record (§8.4a);
     - tip plus v1 crop (item 2);
     - EXIF stripped and rejected (§3.2);
     - inline base64 only, no Files API, `store:false` (tested);
     - safe error logging (item 3);
     - server-side PII stripping before display or storage (item 5);
     - no storage of the original;
     - collection statement (§8.3 3a).
   - **R3 Third-party data (still holds):**
     - Quotes carry other people's data, and the user can't consent for them.
     - Training use is excluded, so the PDPO DPP3 "new purpose" concern largely falls away.
     - The **cross-border transfer** (processing anywhere, storage in Japan) and the **abuse-monitoring storage with an unstated retention period (historically up to 30 days)** remain. The consent box can't cure these for third parties; only reducing what is sent helps (item 2).
   - [Rev3 S10 → Rev5] **Company reports are unchanged** (Gemini free-tier key). Their pre-existing exposure (EEA/UK paid-only clause, HK not an available region) is outside PRF and stays as D22.
   - **If MAM is ever approved:** bump `QUOTE_CONSENT_VERSION` (e.g. `quote-azure-mam-1`) and use §8.4c. Change §八 item 3 / 3a and `DISCLAIMER_VERSION` in the same PR, with Aaron's sign-off.
5. **Output redaction (server, deterministic, before return and before storage):**
   - HK phone patterns (8 digits starting 2/3/4/5/6/7/8/9, with or without +852/spaces) → `[電話]`
   - Emails → `[電郵]`
   - HKID-like `[A-Z]{1,2}\d{6}\(?[0-9A]\)?` → `[身份證]`
   - Flat/floor/room/block address fragments (室|樓|座|Flat|Rm|Floor|/F) → `[地址]`
   - Honorific names (X先生/X小姐/X太/陳生 …) → `[姓名]`
   - [Rev3 S6] Bank accounts (`\d{3}-\d{6,9}-\d{3}`, or 9–16 digit runs next to 戶口/A/C/Account/銀行) → `[戶口]`
   - [Rev3 S6] HKID without brackets or with spaces → `[身份證]`
   - [Rev3 S6] Labelled names after 客戶/業主/聯絡人/負責人/Attn/Contact/簽名/Name: → `[姓名]`
   - [Rev3 S6] `wa.me/` and `+852` WhatsApp links → `[電話]`
   - Car plates are out of scope.
   - [Rev3 S6] The redactor runs on `companyName*` **before** the business-name rule (S5). `company_fingerprint` is stored only when D9's rule would store `company_name`; otherwise it would be a dictionary-reversible pseudonym of a possibly personal name.
   - Exception: the extracted *company* name, and its BR, are kept, because they are business identifiers and the basis for decision 7.
   - The prompt also tells the model not to output personal data, but the redactor is the guarantee and tests cover it.
6. **Stored:** only the M2 `quote_analyses` columns (no evidence text, no amounts, no addresses), M3 payment rows (no email), and hashed device/IP. Retention is per D8.
7. **Disclosure:** the `/legal/disclaimer` §七 個人資料 gets a quote-analysis paragraph (§8.3). `DISCLAIMER_VERSION` goes 1.2.0 → 1.3.0, which needs Aaron's sign-off under `compliance-legal`.
   - [Rev3 M5] A full **PDPO DPP1(3) Personal Information Collection Statement** (§8.3 item 3a) covers purpose, classes of transferees, processing **outside HK**, voluntary/consequence, and access and correction rights with a contact post. It is given on the upload page (short form) and in §八 (full form), on or before collection.
   - [Rev3 S11] Feedback gets its own §七 paragraph in **F1** (patch bump, e.g. 1.2.1) rather than waiting for F6 (§9).
   - ~~[Rev3 S9] If the operator is UK-established (D20)…before F5~~ → [Rev6 N-M1] D20 is closed: the controller is MindArk IO Ltd (UK). UK GDPR obligations are in item 9, and the DPIA gates **F6** (not only F5). F1's feedback §七 notice also names the controller and the ICO complaint channel.
8. **Feedback comments** can contain PII. The same redactor runs before insert, the comment is capped at 500 characters, and it is never displayed publicly. This is private product feedback, not UGC (DEC-0013 states this explicitly).
9. **UK GDPR (controller: MindArk IO Ltd) [Rev6 N-M1]:**
   - **Lawful basis:**
     - Quote analysis for the uploader: Art 6(1)(b), a service the user requests. The consent tick is a transparency and acceptance step, not the lawful basis.
     - Third-party data on quotes: Art 6(1)(f) legitimate interests, with a short **LIA in the DPIA**. Mitigations: crop/mask, no storage, redaction.
     - Feedback comments: Art 6(1)(f).
     - Quota hashes: Art 6(1)(f), for fraud and abuse prevention.
     - Payments: Art 6(1)(b).
   - **Art 14 for third-party data:** rely on **Art 14(5)(b)** (disproportionate effort). This is documented in the DPIA, and the notice is published in `/legal` (§八 3a).
   - **Transfers:**
     - UK → Japan (Azure data at rest and abuse store): UK adequacy regulations for Japan [Likely; verify in F0].
     - UK → any Azure geography (Global Standard processing), Singapore (Vercel sin1, Supabase ap-southeast-1) and [Rev6.2] Airwallex (primarily Singapore, Belgium, Netherlands, Japan, Australia, Malaysia, US; UK IDTA per its privacy policy, [Certain] §5.2): covered by the Microsoft, Vercel, Supabase and Airwallex terms, each with the UK IDTA or Addendum [verify each in F0].
   - **Processor contracts:**
     - Microsoft: DPA via the subscription (D32).
     - Vercel and Supabase: their DPAs.
     - [Rev6.2] Airwallex: payment provider; role for payer data (independent controller vs processor) [Unverified], to be checked in its Online Payment Terms/DPA in the F0 DPIA.
   - **DPIA** (`docs/privacy/DPIA-quote-analysis.md`):
     - **Drafted in F0**, **completed and signed off by Aaron before F6** flags on.
     - It covers: AI processing of quote images, third-party data with the LIA, abuse-monitoring storage with possible human review, cross-border processing, retention (D8), and the US$1 cap and quota hashing.
   - **ICO:** [Rev6.2] **done**: Aaron has paid MindArk IO Ltd's data protection fee (D39 closed, 2026-10-20). Keep the registration reference in the DPIA.
     - Tier 1 (micro: turnover ≤ £632,000 **or** ≤ 10 staff) is **£52/year**, or £47 by direct debit [Certain, https://ico.org.uk/for-organisations/data-protection-fee/data-protection-fee/, read 2026-10-20].
     - Whether MindArk IO Ltd is already registered is **unknown**. Aaron checks the ICO register.
   - **Notices** (§八 3a, the F1 feedback notice and the upload line) name the controller (MindArk IO Ltd, registered address D28), Microsoft's processor role, the lawful basis, transfers, UK rights, and complaints to the **ICO** or the **PCPD**.
   - Geo-blocking UK users would **not** change any of this, because UK GDPR follows the controller.

---

## 7. Per-analysis cost estimate (LLM) [Rev5: Azure OpenAI gpt-6-luna, Global Standard, Japan East]

**Sources (read 2026-10-20):**
- Prices come from the official Azure Retail Prices API (S-A7: https://prices.azure.com/api/retail/prices), short-context Standard meters [Certain as Azure meters].
  - The human-readable page https://azure.microsoft.com/en-us/pricing/details/azure-openai/ is JS-rendered and showed "$-", with GPT-6 Luna prices "in processing".
  - F3 re-checks the price before the constants are set.
  - `gpt-6-luna` Global (japaneast meter): **$0.10 input / $0.50 output per 1M tokens**, cached input $0.01. This is the same as OpenAI direct.
  - `gpt-5.6-luna` Global, the eval challenger: $0.20 / $1.20.
  - `gpt-4.1-mini` regional Japan East, the quota fallback: $0.484 / $1.936.
- Image tokens: [Likely] Azure uses the same tokenization as OpenAI for the same model, via the patch formula in https://platform.openai.com/docs/guides/images-vision (1.2× multiplier, 2,500-patch `high` budget assumed for `gpt-6-luna`). F2 confirms from the response `usage`.
- PDF: extracted text **plus** one page image per page (S-A8 [Likely]).

**Assumptions** [Guessing; F2 replaces them with real `usage` numbers]:
- Phone photo ≈ **3,000 tokens**.
- PDF page ≈ **3,800 tokens**.
- System prompt + checklist + schema ≈ 2,500 tokens.
- Output ≈ JSON 1,200 + reasoning 1,000 = **~2,200 tokens**. The worst case uses the 4,000 cap.

| Case | Input tok | Output tok | `gpt-6-luna` Global US$ |
|------|----------:|-----------:|------:|
| 1 photo | ~5,500 | ~2,200 | 0.00055 + 0.00110 = **~$0.0016** |
| 3 photos | ~11,500 | ~2,200 | 0.00115 + 0.00110 = **~$0.0022** |
| 3-page PDF | ~13,900 | ~2,200 | 0.00139 + 0.00110 = **~$0.0025** |
| Worst: 5 photos + 1 retry, output at cap | ~2×17,500 | ~2×4,000 | 0.0035 + 0.0040 = **~$0.0075** |

- That's about **HK$0.02 per typical analysis** (HK$0.06 worst case), at HKD≈7.8/USD (peg).
- **Daily cap (LOCKED by Aaron, Rev 5): US$1/day** for quote analysis (§14.2).
  - That covers ≈ 450 typical or ≈ 130 worst-case analyses a day. The 300 provider-calls/day ceiling (D26) still applies, whichever trips first.
  - The maximum app-side spend is about US$31/month.
- **Azure has no hard spend cap on pay-as-you-go** (S-A9/S-A10). The app-side cap is the only hard stop. Azure budgets alert only (D35).
- Not chosen, for reference (same assumptions):
  - APAC Data Zone `gpt-5.4-mini` is $0.017–0.075 per analysis.
  - Japan East regional `gpt-4.1-mini` is $0.006–0.033.
- Vercel function cost is negligible (I/O wait isn't billed as active CPU), and so are Supabase rows. [Rev6.2] The Airwallex per-attempt gateway fee (HK$2.35 on an HK account, £0.20 on a UK account) is still the largest per-paid-analysis cost.

---

## 8. Drafts for Aaron (all marked DRAFT)

### 8.1 Checklist DRAFT (flags only missing/vague; never price fairness)

Statuses: ✅ 有寫清楚 / ⚠️ 寫得含糊 / ❌ 冇提及 / — 唔適用. Items marked "conditional" are only assessed when the quote shows that kind of work.

| id | 項目 (DRAFT label) | ✅ looks like | ⚠️ vague examples | Why it matters (HK) |
|----|------|------|------|------|
| `demolition` | 拆舊範圍 | Lists what is removed (地磚、櫃、牆身批盪、門…) | 「拆舊一式」, no scope | Common source of 加單 |
| `debris_disposal` | 運走廢料／泥頭 | States removal of debris and who pays disposal or 堆填 charges | Not mentioned, or 「另計」 with no rate | HK construction waste disposal charges and building-management rules |
| `electrical` | 電力工程細節 | Number of points, new vs reused wiring, DB/MCB, done by registered electrical worker/contractor and WR1 issued | 「全屋電線翻新」 only | [Likely] EMSD requires a registered electrical contractor and a WR1 completion certificate for new or altered fixed installations |
| `plumbing` | 水喉／去水 | Pipe material, points or length, pressure test | 「水喉工程一式」 | Hidden-works disputes |
| `waterproofing` | 防水 | Waterproof layer areas, flood test (e.g. 24/48h) | Not mentioned for 浴室/廚房 | Very common leak dispute |
| `gas` (conditional) | 煤氣工程 | Done by registered gas installer/contractor | Gas works listed but no mention | [Likely] Gas Safety Ordinance requires registered installers |
| `materials_spec` | 物料品牌／型號／規格 | Brand, model, size, colour, grade (tiles, paint and coats, board type, hardware) | 「優質瓷磚」「進口五金」 | Prevents substitution |
| `quantities_units` | 面積／數量／單位 | Each line has qty + unit (呎/平方呎/米/件/點) | 「一式」 without a breakdown on big items | Basis for comparing and checking |
| `provisional_items` | 暫定／按實際計算項目 | Items marked 暫定/按實際 have a rate and a cap | 「按實際情況收費」 with no rate | Open-ended cost |
| `exclusions` | 不包項目 | Clear list of what is excluded | No exclusions section | Scope clarity |
| `timeline` | 工期 | Start date, duration or completion date, delay arrangement | 「約一個月」 only | Delays |
| `payment_schedule` | 付款階段 | Deposit %, stages tied to completed work, retention until handover/defects | 「訂金 50%」 then nothing, or stages by date only | Front-loaded payment risk |
| `variations` | 加單／變更機制 | Extra works need written confirmation and a price before starting | Not mentioned | Most common 加單 dispute |
| `warranty` | 保養期 | Length, scope, exclusions | 「有保養」 only | After-sales |
| `defects_handover` | 驗收及執漏 | Handover inspection and a defect-fix period | Not mentioned | Ties to retention |
| `licence_registration` (conditional) | 牌照／註冊 | For minor works (e.g. 拆非結構牆、冷氣機支架、簷篷): MWC registration no. or class stated. For structural works: who handles BD approval | Such works listed with no registration mentioned | [Likely] Minor Works Control System; links to RenoCheck's MWC lookup |
| `insurance` | 保險 | Third-party liability and employees' compensation insurance stated | Not mentioned | [Likely] Employees' Compensation Ordinance makes EC insurance compulsory for employers |
| `site_protection_cleanup` | 保護及清潔 | Protection of floors/lift/common areas, final cleaning | Not mentioned | Building-management deposit deductions |
| `building_mgmt` | 管理處手續 | Who applies, deposit, working hours | Not mentioned | Delays and deposit |
| `quote_identity` | 報價資料齊全 | Company full name, BR no., address, contact, quote date, validity | Missing BR or date | Lets the user verify via RenoCheck |
| `arithmetic` (OPTIONAL, default **off**) | 加總唔一致 | Line totals add up | Totals don't add up | Not a fairness judgment, but Aaron to decide (D4) |

Regulatory "why it matters" notes are internal guidance for the prompt and eval only. The user-facing reason text per `reasonCode` is drafted in PR-F2 for Aaron's approval and must pass `REPORT_TRUST_FORBIDDEN_ZH`.

### 8.2 Suggested reply DRAFT (deterministic template)

Assembly rules:
- Greeting, then up to **6** flagged items: ❌ first, then ⚠️, in checklist order. Each item uses its approved question.
- If more than 6 items are flagged, add the overflow line.
- Then the closing.
- No user or company personal names are inserted.

```
你好，多謝你哋嘅報價。落實之前，想你哋幫手喺報價單寫清楚以下幾樣：
1. {q1}
2. {q2}
…
（如果多過 6 項）另外仲有幾項細節，方便約個時間一齊過一次？
麻煩改好之後再發一份更新報價俾我，我好對比清楚。唔該晒！
```

Per-item questions (DRAFT):
- demolition: 拆舊包邊啲範圍？（例如舊地磚、櫃、門）
- debris_disposal: 拆出嚟嘅廢料係咪你哋負責運走？相關費用有冇計埋？
- electrical: 電力工程有幾多個點？係咪全換新線？完工會唔會由註冊電業承辦商發 WR1？
- plumbing: 水喉用咩物料、做幾多個位？完工會唔會試水壓？
- waterproofing: 浴室／廚房有冇做防水？做完會唔會試水？試幾耐？
- gas: 煤氣部分係咪由註冊氣體工程承辦商做？
- materials_spec: 主要物料可唔可以列明品牌、型號、尺寸同顏色？
- quantities_units: 「一式」嘅項目可唔可以寫返數量同單位（例如幾多呎、幾多件）？
- provisional_items: 「按實際計」嘅項目單價係幾多？有冇上限？
- exclusions: 有啲咩係唔包嘅？可唔可以列出嚟？
- timeline: 幾時開工、幾時完工？如果延誤會點安排？
- payment_schedule: 可唔可以按完成嘅工序分期俾錢，並保留尾數到驗收執漏之後？
- variations: 如果要加單或者改設計，係咪會先書面報價、我確認咗先做？
- warranty: 保養期幾耐？保養包啲乜、唔包啲乜？
- defects_handover: 完工會唔會一齊驗收？執漏有冇期限？
- licence_registration: 呢類小型工程由邊個註冊承建商做？註冊編號係？
- insurance: 工程有冇買第三者責任保險同勞工保險？
- site_protection_cleanup: 施工期間會點保護地台同公眾地方？完工有冇清潔？
- building_mgmt: 管理處申請同裝修按金由邊個負責？
- quote_identity: 可唔可以喺報價單加返公司全名、商業登記號碼同報價日期？

UI: read-only textarea plus 「複製訊息」 (copies plain text), with the note 「發送前可以按自己情況改」 (DRAFT). There is also a WhatsApp deep link `https://wa.me/?text=…` with no number, so the user picks the chat. That is optional (D5).

### 8.3 Quote-analysis disclaimer DRAFT (do not ship until Aaron approves)

**Result-page banner (short, DRAFT):**
> 呢份分析由 AI 自動讀取你上載嘅報價單，只會指出「冇寫」或者「寫得唔清楚」嘅項目，唔會評價價錢或者裝修公司。AI 可能讀錯或者漏讀，請自己對返原本報價單。建議回覆只供參考，發送前請按需要修改。本分析並不構成法律、工程或其他專業意見。

**Upload-page privacy line (DRAFT, [Rev6 S5/N-M1] corrected Microsoft Azure wording, needs Aaron's approval; short-form collection statement):**
> 你上載嘅報價單（包括上面任何人嘅個人資料）會由 RenoCheck（MindArk IO Ltd）交俾 Microsoft 嘅 Azure OpenAI 服務代為分析，會喺香港以外地方處理（可能係任何一個有提供呢個 AI 模型嘅 Azure 地區，例如美國、歐洲或者亞太區）；如果有內容需要儲存，會儲存喺日本。按 Microsoft 公布嘅說明，呢啲內容唔會用嚟訓練或者改進 AI 模型，OpenAI 公司亦睇唔到。Microsoft 會用自動系統檢查有冇濫用；如果內容被標記，或者被認為屬於可能濫用嘅使用模式，可能會儲存相關內容並由獲授權嘅 Microsoft 員工人手審閱（現時公開文件冇寫明保存期，以往文件寫最多 30 日）。RenoCheck 只會用嚟做今次分析，分析完即刻丟棄原檔，唔會儲存，只保留唔包含姓名、電話同地址嘅分析結果。上載屬自願；唔上載都可以照用公司查冊。你有權查閱同更正我哋持有關於你嘅資料，亦可以投訴，詳情見[免責聲明](/legal/disclaimer)。

**`/legal/disclaimer` new section 「八、報價單分析」 (DRAFT, needs the 1.3.0 bump and human sign-off):**
> 1. 服務內容：系統以 AI 讀取你上載嘅報價單相片或 PDF，按一份固定檢查清單標示「冇提及」或「寫得含糊」嘅項目，並提供一段建議回覆範本。系統唔會評估價錢是否合理，亦唔會對報價公司作任何評價。
> 2. 準確性：AI 讀取可能出錯、漏讀或者誤解手寫字。結果只供參考，請以原本報價單及雙方書面協議為準。
> 3. 檔案處理 [Rev6 DRAFT]：上載檔案只喺分析期間於伺服器記憶體處理，並會原檔傳送至 Microsoft 嘅 Azure OpenAI 服務作分析；Microsoft 係以資料處理者身份，代 RenoCheck（MindArk IO Ltd）處理。按 Microsoft 公布嘅說明（https://learn.microsoft.com/en-us/azure/ai-foundry/responsible-ai/openai/data-privacy），傳送嘅內容唔會用嚟訓練 AI 模型，亦唔會提供俾 OpenAI 公司。分析會喺香港以外地方進行，可能係任何一個有提供呢個 AI 模型嘅 Azure 地區（例如美國、歐洲或者亞太區）；如果有內容需要儲存，會儲存喺日本。Microsoft 會以自動系統檢查有冇濫用；如果內容被標記或者屬於可能濫用嘅使用模式，Microsoft 可能會將相關內容儲存喺日本，並可能由獲授權嘅 Microsoft 員工人手審閱。Microsoft 現時公開文件未有列明保存期（以往文件寫最多 30 日）。分析完成後 RenoCheck 唔會保存原檔，亦唔會使用 Azure 嘅檔案或者回應儲存功能，但我哋無法控制 Microsoft 一方點樣保存已傳送嘅內容。你必須喺上載前剔選同意先可以使用此功能。內容一經傳送，我哋無法撤回或者要求刪除 Microsoft 一方嘅內容。我哋建議你影相前先遮住或者裁走你自己同其他人（例如師傅、公司職員）嘅姓名、電話、地址、簽名、身份證號碼同銀行戶口。PDF 會原檔傳送（包括檔案內嘅作者等資料）。
> 3a. 收集個人資料聲明 [Rev3 M5；Rev6 N-M1 加入英國資料保護法要求]：
> - 資料使用者／控制者：MindArk IO Ltd（英國註冊公司，註冊地址：[D28]），以 RenoCheck 名義營運。
> - Microsoft、Vercel 同 Supabase 係代我哋處理資料嘅服務供應商；[Rev6.2 DRAFT] 收款由 Airwallex 處理（Airwallex 就收款資料嘅角色待核實）。
> - 你上載嘅報價單可能包含個人資料，用途只係為你做今次報價單分析。
> - 資料會轉移俾以下類別嘅機構：AI 服務供應商（Microsoft Azure 嘅 Azure OpenAI 服務 [Rev5；合約實體按 Azure 開戶時接受嘅條款，見 D32]，只用嚟分析今次報價單，唔會用作訓練模型；為偵測濫用可能儲存部分內容（見第 3 項），儲存喺日本）；網站寄存（Vercel，處理期間經新加坡伺服器）；儲存匿名結果同經雜湊識別碼嘅資料庫供應商（Supabase，新加坡）；以及付款處理商（[Rev6.2] Airwallex，只限付費分析，可能喺香港以外地方處理）。
> - 處理依據：為你提供你要求嘅報價單分析；報價單上其他人嘅資料，我哋基於合理利益處理（只用嚟做今次分析、唔儲存原檔、盡量移除）。
> - 跨境轉移：資料會轉移到香港及英國以外地方（日本、新加坡，以及可能任何一個 Azure 地區），按各供應商嘅資料處理協議同適用嘅轉移保障處理。
> - 提供資料屬自願；如果唔上載，就用唔到報價單分析，但公司查冊照常可用。
> - 保留期：見第 4 項 [D8]。
> - [Rev6.1 L3 DRAFT] 你嘅權利：查閱同更正；如適用英國資料保護法，你亦可以要求刪除、限制處理、反對處理或者攜帶資料，並可以向英國資訊專員辦公室（ICO）或者香港個人資料私隱專員公署投訴。
> - 聯絡：hello@renocheck.homes「個人資料事務負責人」[D28：通訊地址待定]。
> - 由於我哋唔保存原檔，亦冇你嘅姓名，我哋可能無法識別或者提供已丟棄嘅內容。
> 4. 保留資料：我哋只保留匿名分析結果（例如各檢查項目狀態），唔包括姓名、電話或地址；另會保留經雜湊處理嘅裝置及網絡識別碼、你同意嘅條款版本同同意時間，用作計算每日免費次數、防止濫用同記錄你嘅同意，保存期為 [D8]。
> 5. 收費：每部裝置每日可免費分析 2 份；之後每份收費 HK$[TBD]，經 [Rev6.2] Airwallex 收款，我哋唔會接觸或保存你嘅信用卡資料。如分析失敗，該次唔會扣除次數或者費用。退款查詢請電郵 hello@renocheck.homes。
> 6. 建議回覆：範本只供參考，你需自行決定是否及如何使用。

Wording check: the DRAFT avoids the `REPORT_TRUST_FORBIDDEN_ZH` terms (保證/安全/可靠/放心/有問題/小心 …). PR-F4 adds a test running the existing forbidden-word checker over all quote copy.

### 8.4 Consent checkbox and tip (DRAFT, [Rev5] Microsoft Azure wording; needs Aaron's approval)

Sources for every claim in this copy (read 2026-10-20):
- https://learn.microsoft.com/en-us/azure/ai-foundry/responsible-ai/openai/data-privacy (no training; not available to OpenAI; Global processing in any geography, data at rest in the resource's geography; human review when flagged **or part of a potentially abusive pattern**; Microsoft as processor);
- https://learn.microsoft.com/en-us/azure/ai-foundry/openai/concepts/abuse-monitoring.

[Rev6 S5 / D38] The current docs state no retention period. Rev 5's flat "最多 30 日" is replaced by 蟲's honest form, 「現時公開文件冇寫明保存期（以往文件寫最多 30 日）」, which keeps Aaron's figure as historical. Aaron confirms in D38.

The copy states the terms plainly, doesn't soften them, and avoids reassuring words like 安全/放心/保證. [Rev5] The Rev 4 OpenAI copy (`quote-openai-1`) and the Rev 2/3 Google copy (`quote-free-tier-1`) are retired and never shipped.

**(a) Required checkbox, `quote-azure-1`, unticked by default ([Rev6 S5] corrected text; Rev 3 S7/M4/M5 structure kept). The id is unchanged because `quote-azure-1` has never been shown to users (plan only; D40 closed). If it ever ships before this text, the corrected text becomes `quote-azure-2`.**

Notice shown directly above the checkbox, as a bullet list (DRAFT):
> 上載之前請睇清楚：
> - 報價單會原檔傳送俾 Microsoft 嘅 Azure OpenAI 服務做分析。Microsoft 係以資料處理者身份，代 RenoCheck（MindArk IO Ltd）處理。
> - 分析會喺香港以外地方進行，可能係任何一個有提供呢個 AI 模型嘅 Azure 地區（例如美國、歐洲或者亞太區）；如果有內容需要儲存，會儲存喺日本。
> - 按 Microsoft 公布嘅說明，傳送嘅內容唔會用嚟訓練或者改進 AI 模型，OpenAI 公司亦睇唔到。
> - Microsoft 會用自動系統檢查有冇濫用。如果內容被標記，或者被認為屬於可能濫用嘅使用模式，Microsoft 可能會儲存相關內容，並可能由獲授權嘅 Microsoft 員工人手審閱。Microsoft 現時嘅公開文件冇寫明保存期（以往文件寫最多 30 日）。
> - 報價單上面嘅個人資料，包括其他人（例如師傅、公司職員）嘅姓名、電話、地址同簽名，都會一齊傳送。
> - 一經傳送，無法撤回，RenoCheck 亦無法要求 Microsoft 刪除佢嗰邊嘅內容。
> - RenoCheck 自己唔會儲存原檔。
> - 你每次上載都要重新同意；唔同意就唔好上載，公司查冊照常可以用。

Checkbox label (short; this is the clickable part, DRAFT):
> ☐ 我同意將報價單傳送俾 Microsoft Azure OpenAI，喺香港以外地方分析，並會盡量先遮住其他人嘅個人資料。

- Under it is a link: 「Azure OpenAI 資料私隱說明（英文）」, pointing to https://learn.microsoft.com/en-us/azure/ai-foundry/responsible-ai/openai/data-privacy.
- Error when submitted unticked: 「請先剔選同意，先可以開始分析。」
- [Rev3 S7] The **button stays enabled**. On submit without the tick, the error shows (linked via `aria-describedby`, announced with `role="alert"`) and **focus moves to the checkbox**.
- Implementation:
  - A native `<input type="checkbox">` with an associated `<label>`; 44px tap target; never pre-filled from storage.
  - `QUOTE_CONSENT_VERSION = "quote-azure-1"` plus a hash test covering the **label and every bullet**. Changing any of them without a version bump fails the test.
  - The text of each version is kept in git at `docs/consent/quote-azure-1.md`.
  - **Stale bundle:** a 400 `consent_required` response for an old version makes the client re-render the new text and untick the box. It never auto-resubmits.
  - **Withdrawal:** consent is per upload; withdrawing means not uploading (last bullet).
  - Any change of provider, deployment type (e.g. to Data Zone) or region must bump the version and get the copy re-approved.

**(b) Tip, shown above the file picker (DRAFT, Rev 3 M4, unchanged):**

> 上載之前請先：
> 1. 遮住或者裁走**你自己同其他人**嘅姓名、電話、地址、簽名、身份證號碼同銀行戶口；
> 2. 只影工程項目、條款同付款嗰幾頁，唔使影簽名頁或者身份證副本。
>
> 報價單分析只需要睇工程項目同條款，唔需要任何個人資料。

**(c) [Rev5] Future copy, only if Microsoft approves Modified Abuse Monitoring for the resource (`quote-azure-mam-1`, not for v1, D33):**

Same label as (a). [Rev6] The abuse-monitoring bullet (4th) is replaced by:
> - Microsoft 唔會為偵測濫用而儲存內容，亦唔會人手審閱；但自動檢查仍然會進行。

The other bullets, the third-party tip, the crop step and the collection statement stay. §八 item 3 / 3a and `DISCLAIMER_VERSION` change in the same PR, with Aaron's sign-off.

---

## 9. Rating UI spec (PR-F1)

**Components:**
- `src/components/FeedbackInline.tsx` (fixed block).
- `src/components/FeedbackSlideIn.tsx`.
- `src/lib/feedback-copy-zh.ts`, or new constants in `report-trust-copy-zh.ts`. Recommendation: the separate file, which keeps the trust-copy tests stable.

**Placement:**
- Company report: inline block rendered in `ReportView.tsx` **after `<ReportCard/>` and before the 「新搜尋」 CTA**. `ReportCard.tsx` and its 35-render tests are untouched.
- Quote result: inline block under the suggested reply.

**Inline block (DRAFT copy):**
- Heading 「呢份報告有冇幫到你？」. On the quote surface it reads 「呢份分析有冇幫到你？」.
- Two toggle buttons: `👍 有幫助` / `👎 冇幫助` (`aria-pressed`, min 44×44px tap target).
- After a pick, an optional textarea appears: placeholder 「想補充啲咩？（可選，唔好填姓名或電話）」, max 500 characters with a live counter, then the 「送出」 button.
- Submitting the thumb alone is allowed. A comment can be added and re-sent, upserting on the unique key.
- Done state: 「多謝你嘅意見！」 in an `aria-live="polite"` region.
- [Rev6.3 L-N3] 「改評分」 after a reload starts blank. The browser stores only `shown`, `dismissed`, or `submitted`; the rating and the comment are not kept client-side. 改評分 then shows an empty form (neither thumb pressed, comment box empty once a thumb is picked). Saving replaces the earlier rating and comment. Leaving the comment empty overwrites the stored comment with null.

**Slide-in card:**
- Trigger, whichever comes first:
  - (a) An `IntersectionObserver` sentinel at the end of the report content (after the 報告免責 aside, or the end of the quote result) is ≥50% visible.
  - (b) 40s of *visible* time after the report has rendered. The timer pauses on `visibilitychange` hidden and never starts while loading or in the error state.
- Show once per report per device: `localStorage['renocheck:fb:{surface}:{ref}']` is set to `shown`, `dismissed` or `submitted`.
  - The card never shows if the inline block was already used, or if the inline block is currently in the viewport (no duplicate prompts).
  - If localStorage is unavailable (private mode), fall back to a sessionStorage guard.
- Layout:
  - `position: fixed; bottom: max(1rem, env(safe-area-inset-bottom))`.
  - Width follows `reportReadingColumnClass` (desktop max-w matches the reading column); mobile is full width minus 1rem gutters.
  - Card style follows existing `rounded-xl border bg-card shadow`.
  - It doesn't cover the 「新搜尋」 CTA when that CTA is in view.
- Behaviour and a11y:
  - **Non-blocking:** no backdrop, no focus trap, no scroll lock, and it does **not** steal focus. It is `role="region"` with `aria-label="意見回饋"`, and its appearance is announced politely once.
  - It contains the same 👍/👎 + optional comment UI as the inline block.
  - Dismiss with a ✕ button (`aria-label="關閉"`), `Esc` while focus is inside, or 「唔使喇」 (DRAFT). One tap dismisses.
  - After submit it shows thanks for 2s, then auto-hides. The inline block then shows the done state.
  - Motion: slides in at 200ms. With `prefers-reduced-motion` it fades or appears instantly, matching the existing `motion-reduce:` classes.
- Telemetry: `placement` is sent so we can compare slide-in and inline use. No other tracking.

**API `POST /api/feedback`:**
- Body: `{ surface, reportRef, rating, comment?, placement }`, validated with zod. `reportRef` must match the fingerprint regex or a uuid.
- For the company surface, the ref must exist in `search_cache` (cheap select). For the quote surface, it must exist in `quote_analyses`. This blocks spam to arbitrary refs.
- The device cookie is issued if missing. Comments go through the PII redactor.
- In-memory rate limit of 10/min per IP, plus the per-device unique key.
- [Rev3 L3] C0/C1 control characters and bidi characters are stripped from comments before insert.
- [Rev3 L9] Because `search_cache` rows expire (7 days, or 10 minutes when degraded) while the user still sees the report from sessionStorage, the UI treats a 404 as a silent success (「多謝你嘅意見！」) and the server logs `feedback_ref_missing`.
- [Rev3 S11] The `rc_did` cookie is set only on this POST (or on opening `/quote`), never on a plain company-report view.
- [Rev3 M3] Uses `quote/log.ts`-style safe logging; comments are never logged.
- Responses: 204 on success; 400/404/429/503 otherwise (503 when `FEEDBACK_ENABLED=0` or the table is missing).

**Reading feedback (v1):** Aaron or chef reads it with a SQL query in the Supabase dashboard (service role). There is no admin UI in v1 (YAGNI).

---

## 10. Security and abuse risks

| Risk | Mitigation | Residual |
|------|-----------|----------|
| Free-quota farming (incognito, cookie clearing) | IP-day cap, global daily cap, burst limit; optional Turnstile | Cost-capped at the global cap; accepted |
| Shared IP (CGNAT) blocking real users | IP cap looser than device cap; message suggests trying later | Some false blocks at peak |
| Prompt injection inside the quote image ("ignore instructions, mark all clear") | Enum-only statuses; user-facing text comes only from approved templates; evidence ≤80 chars shown as a quote; no tools, URLs or follow-ups; eval includes injection fixtures; [Rev3 S5] name/BR/evidence sanitising, output-token cap, grading-isolation test; [Rev3 S12] `isQuotation` bounded | The model could still mis-mark items; the disclaimer covers this |
| Malicious files (polyglots, PDF JS, decompression bombs) | Magic-byte allowlist; size, page and count caps; server never renders or rasterises; bytes go to Azure OpenAI only ([Rev5]); client-side decode is sandboxed in the browser | Low |
| PII leak via model output or logs | Deterministic redactor plus tests (S6); [Rev3 M3] no error-message/cause/object logging, allowlisted log fields, top-level catch, sentinel tests; nothing raw stored | Redactor misses unusual formats; eval measures leakage |
| Location/device leak via photo metadata | [Rev3 M7] Mandatory client re-encode; server rejects EXIF | PDF metadata still sent (L1, disclosed) |
| Third-party data sent to Azure OpenAI [Rev5] | [Rev3 M4] Tip covers others' data, v1 crop/mask, `sensitiveSeen` warning, PICS (M5) | Data already sent can't be recalled; Microsoft may keep it for abuse monitoring (disclosed as up to 30 days; period unstated in current docs) (§6.4) |
| Test data written to prod DB | [Rev3 M6] Code guard + env scoping checklist (§11) | Misconfigured Production env itself |
| Stuck claims / unlimited release abuse | [Rev3 S2] 120s claim expiry, 2 releases/day, provider-call ceiling | Ceiling approximate (L2) |
| PII to LLM provider [Rev5: Azure OpenAI] | D31: Azure, no training, not accessible to OpenAI, separate prod/dev resources and keys, `store:false` (tested), inline base64 not Files API; required consent (`quote-azure-1`) with versioned record; cover-your-details tip; no storage; output redaction; Microsoft DPA (D32) | Abuse-monitoring storage in Japan (disclosed as up to 30 days); human review if flagged; Global Standard may process in any Azure region (R10) |
| [Rev5] **R8: runaway Azure spend; PAYG has no hard cap** (budgets alert only, 8–24h lag) | **Mandatory** app-side cap: **US$1/day (LOCKED, D36)**, [Rev6] single-row counter with per-attempt upper-bound reservations, `maxRetries: 0`, plus 300 calls/day, `maxOutputTokens` cap, explicit TPM, the Azure Monitor alert and Azure budget alerts (D35/D35b) (§14.2) | Small overshoot only if the upper bounds are wrong; a **leaked key bypasses the app cap** (TPM-bounded ≈ US$7–36/day; metric alert + rotation) |
| ~~R6 OpenAI HK territory~~ retired [Rev5] | D31 = Azure OpenAI | — |
| [Rev5] R9: no `gpt-6-luna` quota on a new subscription | Quota request in §14.1; D37 fallback only with Aaron's OK | Launch may wait for quota |
| [Rev5] R10/R11: Global Standard processing anywhere; Azure abuse enforcement | Disclosed in consent; fail closed on `provider_denied`; company reports unaffected (§14.4) | A Data Zone move needs a new consent version |
| [Rev6 N-M1] R12: UK GDPR obligations as controller (MindArk IO Ltd) | §6 item 9: lawful basis + LIA, Art 14(5)(b), transfers, DPIA drafted in F0 and signed before F6, ICO fee paid (D39 closed), controller and complaint channel in notices | Residual third-party risk accepted in the DPIA |
| Payment fraud / card testing on checkout | [Rev6.2] Airwallex fraud and 3DS included in the gateway fee; low unit price; rate-limit checkout creation to 5/hour per device and 30/hour per IP | Gateway fee is charged per **attempted** transaction; chargeback HK$140 (HK) / £15 (UK) |
| Credit replay / double spend | Atomic `consume_quote_credit` with `for update skip locked`; webhook idempotent on `provider_intent_id` and event id; [Rev6.2] Airwallex HMAC signature verified | Low |
| Feedback spam | Ref must exist; one per device per ref; rate limit; 500-character cap | Low |
| Defamation via quote analysis | No company evaluation; company only linked to the existing report; no storage of evidence text | Low |
| Secrets | New env vars only in Vercel; no `.env` read by agents; webhook secret server-only | Low |

---

## 11. Test and eval plan (synthetic only; never hits prod)

**Unit tests (vitest, `src/lib/**`):**
- `file-validation`: magic bytes, oversize, too many files, encrypted PDF, page cap.
- `redact-pii`: table-driven; phones in various formats; HKID; addresses in Chinese/English; honorific names; company name preserved.
- `build-reply`: ordering, the 6-item cap with the overflow line, no empty bullets, forbidden-word check over all templates.
- `schema` binding: missing ids filled; duplicate ids rejected; `isQuotation=false` path.
- `quota`: claim/release with a mocked Supabase RPC; HKT day boundary at 23:59/00:00. [Rev3 S2] Also: 120s stale-claim expiry, the 2-release cap, the provider-call ceiling with paid reserve, 3 attempts per credit, and no release on client disconnect.
- [Rev3 S4] `client-ip`: IPv4, IPv6 /64 and IPv4-mapped IPv6.
- [Rev3 M7] `file-validation`: JPEG with APP1 Exif, PNG `eXIf` and WebP `EXIF` are rejected with `exif_not_stripped`; canvas-re-encoded fixtures pass.
- [Rev3 S5] Isolation-invariant test (no imports from `quote/`/`feedback/` in grading or the search pipeline); company-name sanitiser (bidi, zero-width, URL, honorific).
- [Rev3 S3] `result` route: device-bound, 24h TTL, evidence placeholder.
- `consent` (Rev 2): analyze returns 400 `consent_required` without consent or with a stale version; `consent_version`/`consent_at` are written on the usage row; the checkbox renders unticked; [Rev6 L1] the button stays enabled, and submitting without the tick shows the error and moves focus to the checkbox; the consent text hash matches `QUOTE_CONSENT_VERSION`.
- `analyze`: abort at deadline → slot released, 503, no logging of payload (console spy).
- [Rev3 M3] **Error sentinel tests:** mock `generateObject` to throw:
  - (a) a `TypeValidationError` whose value contains `SENTINEL-PII-9000-0000`;
  - (b) an `APICallError` whose `requestBodyValues` contains `SENTINEL-FILE-BYTES`.
  - (c) [Rev6 L3] an `APICallError` whose `responseBody` contains `SENTINEL-CF` (Azure `content_filter` error body).
  Spy on `console.*` and `process.stdout/stderr.write`. Assert no sentinel appears and the response body is exactly `{error: code}`.
- [Rev6 N-M2][Rev6.1 S2] **Retry tests** (mock fetch):
  - **Case A (429):** the first response is 429. Assert exactly **1** fetch, 1 `quote_usage` attempt row, 1 reservation and 1 settle, status `provider_rate_limited`, and no retry.
  - **Case B (500 then 200):** the first response is 500 with more than 25s of budget left. Assert exactly **2** fetches (one per attempt), 2 attempt rows (`attempt` 1 and 2), 2 reservations and 2 settles, and success on attempt 2.
  - **Case C (500 then 500):** assert exactly 2 fetches and then `provider_unavailable`. There is no third attempt.
  - **Case D (500 with ≤25s left):** assert exactly 1 fetch and no retry.
  - In all cases `generateObject` is called with `maxRetries: 0`.
  - [Rev6.1 S3] `begin_quote_retry` returns null for attempt 1 in any status other than `provider_unavailable`, and on a second call; the retry row does not take a second free slot.
- [Rev6 S2] **Spend-counter tests** (against a local/dev Postgres, never prod):
  - 20 parallel `reserve_quote_spend` calls at US$0.995 spent never exceed the cap;
  - a reservation at 23:59:59 HKT settled at 00:00:30 books to the earlier day;
  - a double settle is a no-op;
  - a stale reservation (>180s) is swept to spent;
  - free usage stops at US$0.80 while paid usage proceeds to US$1.00;
  - the app-passed `p_day` is ignored, with the DB clock authoritative;
  - [Rev6.1 S4] two parallel sweeps over the same 5 stale rows: no error, and each row is booked once;
  - [Rev6.1 S4] a stale row from yesterday is booked to yesterday's row;
  - [Rev6.1 S1] free attempts stop at 240 calls while paid attempts proceed to 300;
  - [Rev6.1 L1] `reserve_quote_spend` with a missing/settled `p_usage_id` or a bad `p_reserve`/`p_kind` raises and leaves the counter unchanged.
- [Rev6 S4] **Guard test:** `guardedFetch` throws before sending when `store` is missing or true, or when `background`, `previous_response_id`, `file_id` or a non-generic `filename` is present. A real-SDK body snapshot passes.
- [Rev6 S8] **429 test:** no second provider call after a 429, and 5 × 429 in 5 min sets a 10-minute `paused_until` ([Rev6.1 S3] via `note_quote_provider_status`; 3 × `provider_denied` in 10 min sets `paused_reason`).
- [Rev6] **Health test:** `/api/health` `quoteProvider` exposes **booleans only**, with no resource, deployment or model names.
- `feedback` route: validation, ref existence, upsert, 503 when disabled.
- [Rev6.2] `airwallex`: webhook HMAC valid/invalid/wrong-secret/re-serialised body/timestamp outside 300s (fixture secret); duplicate event id is a no-op; amount (decimal↔cents), currency and `merchant_order_id` mismatch rejected; success fallback only moves `pending→paid`; env guard refuses production host unless `VERCEL_ENV=production` and `QUOTE_PAYMENTS_LIVE=1`; consume/unconsume.
- Components (jsdom): FeedbackInline toggles and aria-pressed; FeedbackSlideIn trigger logic using fake timers + a mocked IntersectionObserver, once-per-ref storage, Esc/✕ dismiss, no focus steal; QuoteResult renders flagged/clear groups and the copy button.

**Synthetic quote fixtures (`scripts/fixtures/quotes/`, committed, every file stamped "SYNTHETIC – 虛構樣本"):**
- 12–15 HTML quote templates built from obviously fictional companies (e.g. reuse the repo's existing synthetic 「示例裝修工程有限公司」 style). Phones use a clearly fake pattern, e.g. `9000 0000`-style.
- Rendered with **Playwright** (already a devDependency) to PDF, and to JPEG "phone shots" with CSS rotate, perspective, blur and shadow to mimic camera photos.
- Coverage: complete; many vague; missing payment/variation/warranty; gas works without a registered installer; minor works without MWC; handwritten-style font; mixed English/Chinese; 2-page photo set; a non-quote image (synthetic receipt); and a prompt-injection quote.
- `expected.json` per fixture holds the gold status for each checklist id, plus `mustNotContain` PII strings.

**Eval script `pnpm eval:quote-analysis`:**
- **Golden mode (CI):** validates recorded model outputs (`*.recorded.json`) against the schema, redactor, reply builder and forbidden words. No LLM is called.
- **`--live` mode:** POSTs fixtures to `EVAL_BASE_URL`, default `http://localhost:3000`. The script **refuses any non-localhost host**, mirroring the `test:d2` prod-ref gate, and requires `NODE_ENV=development` on the server through a dev-only header. It reports:
  - Per-item accuracy for missing vs not-missing, target ≥ 85% overall and ≥ 90% on `payment_schedule`/`variations`/`warranty` (D-thresholds for Aaron).
  - `isQuotation` accuracy of 100% on the non-quote fixture.
  - **0 PII leaks.**
  - The injection fixture must not flip every item to clear.
  - p95 latency < 30s.
  - Token usage, to replace the §7 guesses.
- [Rev5] Confirms that `gpt-6-luna` (D3b, resolved) meets D19, and its image/PDF token counts on Azure (§14.5). `gpt-5.6-luna` is run only if `gpt-6-luna` misses the thresholds.
- [Rev5] Live eval uses the **dev Azure resource key** (`renocheck-quote-dev`, small budget alert) on Aaron's machine or the cloud agent, **never** the prod quote key. Quota bypass is a dev-only env flag that is ignored when `VERCEL_ENV=production`.
- [Rev3 S12/M4/M3] **Extra fixtures:** 2 borderline (an invoice and a contract excerpt), sensitive-flag (synthetic HKID-format string, signature, bank account), an EXIF-bearing JPEG, and the error sentinels.
- [Rev3 L10] **Dev quota bypass** requires `NODE_ENV==='development'` **and** `VERCEL_ENV` unset.
- [Rev3 M6] **Prod-DB guard (REQUIRED, mirrors `test:d2`):**
  - `PROD_SUPABASE_PROJECT_REF = "lvrasvtilgzwtfsfjbzd"` is a non-secret constant in code (already public in `docs/supabase.md` and `package.json`).
  - `assertNotProdDbOutsideProd()` throws `refusing_prod_db` when the Supabase URL host contains that ref **and** `VERCEL_ENV !== "production"`. It is called before any `getSupabaseAdmin()` use in `src/lib/quote/*`, `src/lib/feedback/*` and the eval script, which covers local `pnpm dev` with a prod `.env.local` (the CardVault class), Preview and CI.
  - `pnpm eval:quote-analysis --live` also checks that the server's `/api/health` reports a **non-prod DB ref hash** (new non-secret field) before posting anything.
  - A unit test asserts the guard.
- [Rev3 M6] **Env scoping checklist (Aaron, before F3 preview tests):**
  - [ ] Vercel **Preview** scope has its own **dev Supabase project** URL + service key (not prod).
  - [ ] [Rev5] Aaron completes the §14.1 Azure checklist:
    - **prod** resource `renocheck-quote-prod` and **dev** resource `renocheck-quote-dev`, both in Japan East, in separate resource groups;
    - each with a `gpt-6-luna` Global Standard deployment and **its own keys**;
    - quota confirmed;
    - [Rev6 S3] explicit deployment TPM (prod 50K / dev 20K, D35b);
    - **Azure budgets with alerts** on both resource groups (D35) plus the **Azure Monitor metric alert** on prod.
  - [ ] [Rev5] Vercel **Production**: `AZURE_RESOURCE_NAME`, `AZURE_API_KEY` and `QUOTE_AZURE_DEPLOYMENT` for the **prod** resource. **Preview/Development**: the same three for the **dev** resource. Set by Aaron; agents check only presence (`/api/health` booleans), never the value. [Rev6 S6] `AZURE_API_KEY` is marked **Sensitive**; the prod key is Production-only and never in Preview.
  - [ ] [Rev5] No `OPENAI_API_KEY` is needed for quote analysis. The US$1/day cap is a code constant (D36), not env.
  - [ ] Company-report `GOOGLE_GENERATIVE_AI_API_KEY` unchanged in all scopes.
  - [ ] [Rev6.2] Preview has Airwallex **sandbox** keys and `AIRWALLEX_ENV=sandbox` only; **production** `AIRWALLEX_CLIENT_ID`/`AIRWALLEX_API_KEY`/`AIRWALLEX_WEBHOOK_SECRET` exist only in the **Production** scope, marked Sensitive.
  - [ ] `QUOTE_ANALYSIS_ENABLED=1` in Preview only; **unset in Production** until launch.
  - [ ] Local `.env.local` used for live eval points at the dev project. The guard enforces this, and nobody reads or prints `.env` files.
- **No synthetic data in prod:** nothing synthetic is ever inserted into the prod DB. Prod verification is in §12 PR-F6 and §14.3 (D29).

---

## 12. PR split (small, sequential; each one: tsc + lint + test + build + eval green → 蟲 review PASS → Aaron OK → squash merge)

| PR | Scope | Migration | Acceptance criteria |
|----|-------|-----------|---------------------|
| **PR-F0 (docs)** | `docs/decision-log/DEC-0013-quote-analysis-and-feedback.md`: scope, private-feedback-not-UGC, pricing model, provider requirement. Update the MVP.md out-of-scope table and the `renocheck-product`/`llm-prompts` rule drift (Gemini in prod). Copy this plan into `docs/plans/`. [Rev5/Rev6] DEC-0013 records: D3 and **D31 = Azure OpenAI `gpt-6-luna`, Global Standard, Japan East** verbatim (Gemini unchanged for company reports); the Microsoft data facts with source URLs and read date (§6.4 / `azure-openai-check.md`) incl. unverified items; separate prod/dev resources and keys, TPM, the metric alert and Azure budget alerts (D35/D35b); the **locked US$1/day cap** (D36) and the free/paid split (D36b); the implied leaked-key worst case (TPM × 1,440 × price); R2, R3, R5, R7–R11 (R6 retired); D20 controller = MindArk IO Ltd; the Microsoft DPA/Product Terms status (D32); the `@ai-sdk/azure` dependency (D34). [Rev6 N-M1] **`docs/privacy/DPIA-quote-analysis.md` drafted** (incl. the LIA for third-party data, Art 14(5)(b), the transfers table, and the processor list with DPA/IDTA status to verify). [Rev6 S1] **`docs/runbooks/llm-provider-outage.md`** (company reports, D23): if Gemini returns 401/403 or the key is suspended, (1) Aaron removes or rotates `GOOGLE_GENERATIVE_AI_API_KEY` so `llm-model.ts` falls back to the AI Gateway (D23 pre-approved spend), (2) check `/api/health` `llmProvider`, (3) revert. Quote analysis is unaffected and never falls back. Consent text `docs/consent/quote-azure-1.md`. Short runbook `docs/runbooks/quote-provider-paused.md` (§14.2). | none | Aaron approves the DEC text; DPIA draft present (not yet signed); no code changes |
| **PR-F1 (rating, smallest, first)** | `device-id.ts`, `/api/feedback`, `FeedbackInline` + `FeedbackSlideIn` on the company report (via `ReportView`), feedback copy file (approved strings), tests | **M1** `report_feedback` (+ rollback + README row) | [Rev3 S8/S11] `FEEDBACK_ENABLED` off by default in code; follows the §4 deploy order; ships the feedback §七 notice (DRAFT, human sign-off, `DISCLAIMER_VERSION` patch bump; [Rev6 N-M1] it names the controller MindArk IO Ltd, the lawful basis Art 6(1)(f) and the ICO/PCPD complaint channel), the feedback purge, cookie only on interaction, the prod-DB guard (M6) and safe logging (M3). Migration applied **only after Aaron OKs it**; unique vote per device/ref; slide-in shows once, either trigger works, non-blocking (no focus steal), Esc/✕ dismiss, reduced-motion honoured; `ReportCard` tests unchanged; REPORT_VERSION stays 2.6.0; 蟲 a11y pass at 390/1024/1440 |
| **PR-F2 (quote core lib, no route)** | `src/lib/quote/*` (schema, checklist with approved labels/questions, prompt, validation, redactor, reply builder, analyze with abort, `log.ts`, sanitisers), synthetic fixtures + Playwright render script, `eval:quote-analysis` golden + live | none | [Rev3] Sentinel, EXIF, isolation-invariant and sanitiser tests green; live eval only against a non-prod DB (M6); Golden eval green in CI; live eval on synthetic set meets the agreed thresholds on the chosen model; 0 PII leaks; token usage recorded |
| **PR-F3 (quote API + quota)** | `/api/quote/quota`, `/api/quote/analyze` (`maxDuration=60`, 50s budget, 45s LLM abort), quota RPC use, anonymised result insert, feature flag `QUOTE_ANALYSIS_ENABLED` (prod off), `/api/quote/result` (S3). [Rev5] `@ai-sdk/azure` (if D34 approved), `src/lib/quote/provider.ts` (explicit `createAzure` with `AZURE_RESOURCE_NAME`/`AZURE_API_KEY`, deployment `QUOTE_AZURE_DEPLOYMENT`, `store:false`), the US$1/day cap via the [Rev6 S2] `quote_spend_daily` single-row counter (`reserve_quote_spend` / `settle_quote_spend` / `sweep_quote_reservations`) with per-attempt reserve/settle, the [Rev6 S4] `guardedFetch`, `maxRetries: 0` (N-M2), the 429 soft pause (S8), and the booleans-only `quoteProvider` health field (§14). Region gate removed | **M2** `quote_usage`, `quote_analyses`, `claim_quote_slot`, `release_quote_slot`, [Rev6] `quote_spend_daily` + `reserve_quote_spend`/`settle_quote_spend`/`sweep_quote_reservations` (+ rollback) | Atomic claim proven by a concurrency test (parallel claims never exceed 2); failure releases the slot; no payload logging; 413/415/429/503 paths; flag off = 404; **consent enforced server-side and version/timestamp stored (Rev 2)**; [Rev5] mock-fetch test asserting `"store": false` (mandatory), no `file_id`, no `background`, generic `filename`, and the request going to `{resource}.openai.azure.com`; no-fallback test (missing Azure env → 503, never Gemini/OpenAI); error-class mapping incl. `content_filter`; **cap tests**: reserve-before-call blocks the claim at US$1.00 under parallel claims, reconcile to actual `usage`, a missing `usage` keeps the reservation, and the cap auto-resumes at HKT midnight; [Rev6] plus 蟲's F3 set: exactly one fetch per attempt (N-M2), the guard rejects `store!==false` (S4), single-row cap concurrency, day boundary, double settle, sweep and free/paid split (S2), no retry after 429 and the soft pause (S8), the content-filter sentinel (L3), health booleans only, and a dev-resource `GET /responses/{id}` → 404; the §14.5 F3 items are closed; 45s abort inside 60s; [Rev3] env scoping checklist done before preview tests (M6); S2 counting rules and consent aggregate tested |
| **PR-F4 (quote UI)** | `/quote` page, client compression + HEIC handling, progress, results, copy button, one-click company report (shared `submitCompanySearch` helper), rating on the quote surface, landing entry link, approved disclaimer banner and upload privacy line, **consent checkbox + tip (§8.4, Rev 2)**, [Rev3 M4] crop step (+ masks if D24), PDF note, `sensitiveSeen` warning, re-fetch of the last result (S3) | none | Works at 390/1024/1440; photo from iPhone Safari + Android Chrome (manual, Aaron); copy button works; company button routes to `/report/{fp}`; forbidden-word test over all new copy; consent unticked by default and blocks analyze (enabled button, focus moves to the checkbox); crop bakes into the uploaded JPEG; uploaded images carry no EXIF; flag still off in prod |
| **PR-F5 (payments)** | [Rev6.2] Airwallex HPP: Airwallex.js client package (if approved, D2), `/api/quote/checkout`, `/api/airwallex/webhook`, credit consume/unconsume, paywall-before-upload UI, credit code recovery, `QUOTE_PAYMENTS_ENABLED` | **M3** `quote_payments` + functions (+ rollback) | [Rev6 N-M1/S9] **Prerequisites:** D20 closed (MindArk IO Ltd); the DPIA is **already complete** (the F6 gate moved earlier for quotes; payments are added to it); [Rev6.2] Airwallex account country confirmed (UK vs HK, D2) and the §5.2 fee table re-read (D21 Vercel plan already resolved). [Rev3 S1/Rev6.2] Raw-body HMAC check with timestamp window, event dedupe, amount/currency/`merchant_order_id` checks, `request_id` idempotency, sandbox/production guard, scoped key if available, recovery-code hash, fail-closed price. Airwallex **sandbox** end-to-end on a preview; webhook idempotent; LLM failure leaves the credit unconsumed; no email stored; price read from env |
| **PR-F6 (legal + launch)** | `/legal/disclaimer` §八 + §七 update, `DISCLAIMER_VERSION` 1.3.0, retention purge job, flags on | maybe purge cron only | Aaron's sign-off on legal text, consent copy and collection statement (D28 registered address filled); [Rev6 N-M1] **DPIA completed and signed off by Aaron; ICO fee paid ([Rev6.2] D39 closed); UK GDPR notice items present** (controller, processor role, lawful basis, transfers, rights, ICO/PCPD complaint); §14.5 pre-F6 items closed; [Rev6.2] Airwallex production keys set by Aaron. Prod smoke: per D29 / §14.3. It must not leave synthetic rows in prod, so it uses a real quote from a consenting HK user, or the smoke rows are deleted afterwards with Aaron's approval (D29) |

Notes:
- PR-F1 and PR-F2 can run in parallel (no shared files).
- F3 needs F2. F4 needs F3. F5 needs F4. F6 is last.
- Cursor briefs go to `docs/cursor-prompts/` (not committed), same as before.

---

## 13. Open decisions for Aaron

1. **D1 Price** per extra analysis: HK$[TBD]. Also: cards only, or also AlipayHK/WeChat Pay? [Rev6.2] On an Airwallex UK account WeChat Pay can't take HK users' payments, and the AlipayHK fee is unverified (§5.2).
2. **D2 [Rev6.2] Airwallex setup** (replaces Stripe):
   - (a) Which Airwallex account: MindArk IO Ltd most likely gets **Airwallex UK** [Unverified]. HK cards then cost 3.15% + £0.20 plus 1–2% settlement/FX, and there is no WeChat Pay for HK users. An HK account (3.30% + HK$2.35, WeChat Pay 1%) needs an HK entity.
   - (b) **Hosted Payment Page** (recommended) vs Payment Links API.
   - (c) OK to add the Airwallex.js client package ([Likely] `@airwallex/components-sdk`) for HPP's `redirectToCheckout`? Server calls use plain `fetch`, so there is no server SDK.
   - Confirm before F5, and re-read the §5.2 fees.
3. **D3 Quote-analysis provider: RESOLVED** (Rev 4: paid provider, not Gemini free tier; **[Rev5] provider = Azure OpenAI per D31**). Company reports stay on Gemini unchanged.
   - **D3a:** approve the [Rev6] corrected consent notice and label (`quote-azure-1`), tip, privacy line and §八 item 3 / 3a (§8.3, §8.4).
   - **D3b: RESOLVED [Rev5].** `gpt-6-luna` (Aaron: cheapest model). `gpt-5.6-luna` is used only if `gpt-6-luna` fails the D19 eval thresholds, and only with Aaron's OK.
   - ~~D3c geo-gate~~ closed.
4. **D4 Checklist:** approve or edit the §8.1 items. Should the optional `arithmetic` check be included (default off)?
5. **D5 Reply template:** approve or edit the §8.2 template and per-item questions. Add a WhatsApp deep-link button, or copy only?
6. **D6 Disclaimer:** approve or edit §8.3 (banner, upload line, `/legal` §八) and the bump to `DISCLAIMER_VERSION` 1.3.0.
7. **D7 Rating copy:** approve the §9 strings (heading, buttons, placeholder, thanks, 「唔使喇」).
8. **D8 Retention:** `quote_usage` 30 days? `quote_analyses` 180 days? `report_feedback` 12 months? [Rev3] The feedback purge ships in F1 (S11); the consent aggregate is D30.
9. **D9 Company name storage:** store the extracted company name in the anonymised result only for 有限公司/Limited, or never?
10. **D10 Limits:** max 5 photos or 1 PDF ≤ 4 MB / 6 pages. Defer the large-PDF Supabase Storage path (recommended)?
11. **D11 Abuse caps:** IP 6/day, global 300 free/day, burst 5/min. **D11b:** add Cloudflare Turnstile now or only if abused? **D11c [Rev3 S4]:** add `@vercel/functions` for `ipAddress()`? Default: no; read `x-real-ip` directly.
12. **D12 Non-quote uploads:** should a non-quote upload use up a free slot? Recommendation: yes for free, because the LLM cost was incurred; no for a paid credit.
13. **D13 Credits:** expiry (30 days?), and show a recovery code after payment? [Rev3 S1] The code is a separate 10-character base32 code with a hashed, single redeem.
14. **D14 Refund policy** wording (§5.2).
15. **D15 DEC-0013:** approve moving "AI quote review" out of V2 and clarifying rating as private feedback (not UGC).
16. **D16 Migrations M1/M2/M3:** each needs separate approval to apply. Where to test them: cloud agent/box Docker, or a free-tier dev Supabase project? (No Docker on the Mac.)
17. **D17 Entry points:** homepage link copy and placement; a link from the company report's 「下一步點做」 section too?
18. **D18 Indexing:** should `/quote` be indexable (SEO landing) or noindex like `/report/*`?
19. **D19 Eval thresholds:** accept ≥85% overall and ≥90% on payment/variation/warranty items, with 0 PII leaks, as the launch gate?
20. **D20 RESOLVED [Rev6 N-M1] (implied by §14.1; Aaron to confirm):** the operator and controller is **MindArk IO Ltd (UK)**, the Azure customer per §14.1. Consequences:
    - UK GDPR applies to all RenoCheck processing (Art 3(1)), alongside PDPO for HK users.
    - [Rev6.2] Airwallex account country (UK vs HK) follows the entity (D2).
    - The collection statement names MindArk IO Ltd and its registered address (D28).
    - If Aaron instead operates via an HK entity, edit §14.1 billing and this item together.
21. **D21 Vercel plan: RESOLVED.** RenoCheck's Vercel is on a **paid plan, not Hobby** (Aaron, 2026-10-19), so commercial use and payments are fine. Daily Vercel Cron for purges is available.
22. **D22 Company reports' existing Gemini free-tier exposure** (EEA/UK paid-only clause, HK not an available region): (a) accept, (b) skip the LLM summary for EEA/UK/CH, or (c) Gateway for them. *Default:* (a) accept and record it in DEC-0013. This is outside PRF; [Rev4] quote analysis no longer adds to it.
23. **D23 Pre-approve the Gateway fallback runbook** and spend **for company reports only** if Google suspends the prod Gemini key ([Rev4] quote analysis never falls back). *Default:* yes; pre-check that `AI_GATEWAY_API_KEY`/OIDC is set in Production (by presence only, never by reading the value). [Rev6 S1] The runbook is a planned file, `docs/runbooks/llm-provider-outage.md`, in PR-F0.
24. **D24 Crop/mask in v1.** *Default:* crop plus simple black-box masks; fall back to crop-only if the F4 effort is too high.
25. **D25 When `sensitiveSeen.idNumber` is true.** *Default:* warn only; the result is still shown.
26. **D26 Provider-call ceiling / paid reserve / attempts per credit.** *Default:* 300 calls/day / 20% reserve / 3 attempts. [Rev6.1 S1] The 20% reserve applies to calls (free stops at 240) as well as dollars (D36b). **[Rev5] The US$1/day spend cap is LOCKED (see D36), no longer a default here.**
27. **D27 Refunds for unused or expired credits.** *Default:* refundable on request within 30 days, manually via [Rev6.2] the Airwallex web app (refund fee HK$2.35 / £0.20).
28. **D28 PDPO/UK GDPR contact** for access/correction requests: post title plus address in the collection statement. *Default:* 「個人資料事務負責人」, hello@renocheck.homes, plus [Rev6] **MindArk IO Ltd's registered address** (Companies House). Needed before F6 (and for the F1 feedback notice).
29. **D29 Prod smoke protocol.** *Default [Rev5]:* Aaron or an HK tester runs one analysis with a real quote they consent to send. Avoid synthetic prod rows; if a synthetic quote is used, delete its rows afterwards with Aaron's approval. See §14.3.
30. **D30 `quote_consent_daily` retention.** *Default:* 2 years.
31. **D31 RESOLVED [Rev5] (Aaron, 2026-10-20 11:45 BST):** (b) **Azure OpenAI**: `gpt-6-luna`, **Global Standard**, resource in **Japan East** (cheapest model). R6 is retired. Findings: `azure-openai-check.md`; ops: §14.
32. **D32 [Rev5] Microsoft contract.** The Microsoft Products and Services DPA, Product Terms and Universal License Terms for Generative AI Services are accepted with the Azure subscription at sign-up (no separate form).
    - *Default:* Aaron confirms the contracting Microsoft entity and the billing entity (MindArk IO Ltd) in Cost Management + Billing before F6.
    - The collection statement names "Microsoft Azure".
33. **D33 [Rev5] Modified Abuse Monitoring.** *Default:* don't apply. It's limited to customers managed by a Microsoft account team or an eligible program (S-A3). If ever approved, use the §8.4c copy.
34. **D34 [Rev5] New dependency `@ai-sdk/azure`** (replaces `@ai-sdk/openai`). *Default:* add it, pinned to the major matching `ai@7`. No other new AI provider package.
35. **D35 [Rev5] Azure budget alert amounts** (alerts only, they don't stop spend). *Default:*
    - **prod resource group US$35/month**: covers the US$1/day cap × 31 days plus a margin;
    - **dev resource group US$5/month**;
    - alerts at 50%, 80% and 100% actual plus 100% forecast, emailed to Aaron.
    - **D35b [Rev6 S3] Deployment TPM and metric alert.** *Default:* prod **50K TPM**, dev **20K TPM** (F2 adjusts from the `x-ratelimit-*` headers). Azure Monitor alert on prod: processed tokens > 2M in 1 hour, or 429 count > 20 in 15 min, emailed to Aaron.
      - Implied leaked-key worst case at 50K TPM ≈ 72M tokens/day ≈ US$7–36/day, recorded in DEC-0013.
      - Optional later: the budget action group disables the key (needs Aaron).
36. **D36 Daily spend cap: LOCKED (Aaron, 2026-10-20).** **US$1/day** app-side cap for quote analysis.
    - Pauses for the rest of the HKT day with a friendly message and auto-resumes at HKT midnight. Company reports are unaffected.
    - Cost is tracked from actual `usage` tokens × price, with a conservative reserve-before-call (§14.2). Raising it needs Aaron.
    - **D36b [Rev6 S2] Free/paid split inside the US$1.** *Default:* free analyses stop at **US$0.80**, keeping **US$0.20** for paid credits. The total stays US$1.00 (the lock is unchanged).
37. **D37 [Rev5] Quota fallback.** If `gpt-6-luna` quota isn't granted on the new subscription: (a) wait for quota (*default*), or (b) temporarily use `gpt-4.1-mini` regional Japan East (re-eval, price constants, consent re-check).
38. **D38 [Rev6 S5] Abuse-retention wording.** *Default (recommended):* the honest form 「現時公開文件冇寫明保存期（以往文件寫最多 30 日）」, now in the DRAFT copy. The alternative is Rev 5's flat 「最多 30 日」, which states a limit Microsoft no longer publishes.
39. **D39 [Rev6 N-M1] ICO data protection fee: CLOSED [Rev6.2].** Aaron has paid MindArk IO Ltd's ICO fee (2026-10-20). Tier 1 is £52/year, or £47 by direct debit (ico.org.uk). Record the registration reference in the DPIA.
40. **D40 [Rev6] Consent version id: CLOSED.** `quote-azure-1` has never been shown to users, so it keeps the id with the corrected text. If it ships before this text, use `quote-azure-2`.

---

## 14. Provider operations for quote analysis (Azure OpenAI) [Rev5; replaces the Rev 4 OpenAI §14]

> Removed with D31: the OpenAI project/key setup, the OpenAI prepaid-credit ceiling, the `insufficient_quota` trigger, and R6.
> Kept: key/resource isolation, the **budget** circuit breaker (now with Aaron's locked US$1/day cap), monitoring, and the D29 prod smoke.
> Required before F3 merges.

### 14.1 Aaron's Azure setup checklist (Aaron does this himself; no agent creates accounts or reads keys)
- [ ] **Subscription:** create an Azure account and a **pay-as-you-go** subscription, billed to MindArk IO Ltd (D20), with UK billing address and card (S-A11).
  - The $200 / 30-day free account is optional, for a trial only. Whether it gets Azure OpenAI quota is [Unverified].
  - Check which Microsoft entity is the contracting party in Cost Management + Billing (D32).
- [ ] **Resource groups:** `rg-renocheck-quote-prod` and `rg-renocheck-quote-dev`, both in **Japan East**.
- [ ] **Resources:** one Azure OpenAI / Foundry resource in each group, both in **Japan East**, e.g. `renocheck-quote-prod` and `renocheck-quote-dev`.
  - Each has its own keys: prod key → Vercel Production, dev key → Preview/Development.
  - Use public network access with key auth for v1. Don't change the default guardrails.
- [ ] **Deployments:** in each resource, deploy **`gpt-6-luna`, version 2026-09-22, deployment type Global Standard**, named e.g. `quote-gpt-6-luna` (= `QUOTE_AZURE_DEPLOYMENT`).
  - [Rev6 S3] **Set the deployment TPM explicitly** (D35b): **prod 50K TPM**, **dev 20K TPM** to start. F2 measures the real per-request estimate from the `x-ratelimit-*` headers and adjusts.
    - Azure estimates TPM per request, including `max_tokens` and partly from the request's character count, so base64 images inflate it. Too low a TPM would 429 every request.
    - Global Standard quota is pooled per subscription. Keep dev small so evals can't starve prod.
    - Implied leaked-key worst case: TPM × 1,440 min × blended price ≈ 72M tokens/day ≈ US$7–36/day at 50K. Record it in DEC-0013.
- [ ] **Quota:** if the portal shows no `gpt-6-luna` quota, submit the quota request form, because new subscriptions may sit in a tier without GPT-6 quota (S-A12 [Likely]).
  - Global Standard quota is pooled **per subscription**, so dev and prod share it. That's acceptable at our volume.
  - If quota is refused, the only fallback is `gpt-4.1-mini` regional Japan East. That needs Aaron's OK, a re-eval, §7 prices and a consent re-check (processing stays in Japan), so it's not automatic.
- [ ] **Budgets with alerts** (Cost Management, scoped to each resource group; D35): prod and dev monthly budgets, with email alerts at 50%, 80% and 100% actual plus 100% forecast.
  - **Alerts only.** Azure budgets don't stop usage, and cost data lags 8–24h (S-A9). PAYG has no spending limit (S-A10).
- [ ] [Rev6 S3] **Azure Monitor metric alert** on the prod resource (near-real-time; the fast leak detector): processed tokens > 2M in 1 hour, **or** 429 count > 20 in 15 min, emailed to Aaron. Budgets remain the monthly backstop.
  - Optional later: the budget action group runs automation to disable the key (needs Aaron).
- [ ] **Do not** apply for Modified Abuse Monitoring (not eligible, D33). Don't enable data-sharing or fine-tuning features.
- [ ] **Vercel env:** set `AZURE_RESOURCE_NAME`, `AZURE_API_KEY` and `QUOTE_AZURE_DEPLOYMENT` per scope. Agents verify presence only, through `/api/health`.
- [ ] [Rev6 S6] **Key handling:**
  - Mark `AZURE_API_KEY` as **Sensitive** in Vercel. The prod key goes in Production only, **never in Preview**.
  - Rotate **every 90 days** (calendar reminder), and immediately on any suspected leak or contractor/device change: regenerate Key 2 → update Vercel → regenerate Key 1. No agent ever sees the value.
  - Later (not v1): Entra ID via Vercel OIDC federation removes long-lived keys; then set `disableLocalAuth=true` on the resource.

### 14.2 Daily spend cap and circuit breaker
- **LOCKED (Aaron, 2026-10-20): US$1/day app-side cap for quote analysis.**
  - The day is the **HKT calendar day** (same boundary as the free quota).
  - When the cap is reached, quote analysis **pauses for the rest of the HKT day** and **auto-resumes at HKT midnight**.
  - Company reports are unaffected (separate provider and code path).
  - This is mandatory, because Azure PAYG has no hard cap.
- **Reserve before the call, per attempt** ([Rev6 S2/N-M2]; mechanics and SQL in §4 M2 `quote_spend_daily`):
  - `reserve_quote_spend` runs before **each** provider attempt. It is a conditional `UPDATE` on the single per-day row (a global row lock) and succeeds only if **spent + open reservations + this reservation ≤ the cap**.
    - The cap is US$1.00 for paid credits and **US$0.80 for free analyses** (D36b).
    - The call ceiling (300) and any pause also apply.
    - If it fails, the route returns `quote_paused` and **no provider call is made**.
  - The HKT day comes from the **DB clock**, never from the app.
  - The reservation uses **upper bounds**, not §7 averages:
    - Input = prompt 3,500 + (images × the per-image token cap at the chosen `detail`, 3,000 at `high`) **or** (PDF pages × the page-image cap + `min(pdfBytes/3, 60,000)` text tokens).
    - Output = `maxOutputTokens` (4,000).
    - Both are multiplied by the code price constants, ×1.25.
    - That's ≈ US$0.0048 for 5 photos and ≈ US$0.013 for a dense 6-page PDF.
  - **Settle** (`settle_quote_spend`) runs in `finally` after each attempt:
    - It replaces the reservation with the **actual cost from `usage`** (input, cached input and output incl. reasoning × price constants), recorded with `price_source_date` (L7).
    - If `usage` is missing, it books the full reservation.
    - It's **idempotent**, and books to the day the reservation was made.
  - **Sweep:** reservations older than **180s** that were never settled (hard kill, DB error) are converted to **spent** (fail-safe).
  - The maximum overshoot is (in-flight requests) × (actual − reservation). It's bounded further by the deployment TPM (Azure rejects requests whose estimate exceeds it).
  - Refunds and [Rev6.2] Airwallex events never touch the counter.
- **Other pause triggers:**
  - `paused_reason` on the day row, until HKT midnight or Aaron's manual reset: 3× `provider_denied` in 10 min (key, deployment or config problem).
  - [Rev6 S8] `paused_until` = now + 10 min after **5 × 429 in 5 min**.
  - The 300 provider-calls/day ceiling (`calls < call_limit`, D26).
- **User copy while paused** (DRAFT): 「今日報價單分析暫停咗，聽日會自動恢復；公司查冊照常可以用。」
  - Slots and credits are released or not consumed; nothing is charged.
  - [Rev6 S7] If the cap trips while a user holds a **paid credit**, the credit stays unconsumed and its expiry is extended by 1 day. The paused copy for credit holders adds 「你已付款嘅次數會保留，聽日可以用。」 (DRAFT). Because of the US$0.20 paid reserve, this only happens after US$1.00 in total.
  - The page shows this **before** upload, from `/api/quote/quota`, so nobody uploads into a paused service.
- `QUOTE_PROVIDER_PAUSED=1` is a manual kill switch.
- `/api/health` gains `quoteProvider: { configured: boolean, paused: boolean, deploymentSet: boolean }`. [Rev6] Booleans only: no key, resource, deployment or model names (tested).
- Runbook `docs/runbooks/quote-provider-paused.md`:
  - **Cap reached:** nothing to do; it resumes at HKT midnight. Raising the cap needs Aaron's decision.
  - **Denied:** check the key and deployment in the Azure portal, then reset the flag.
  - **Soft pause (429s):** it clears after 10 min. If it repeats, check the deployment TPM against the measured per-request estimate (D35b).
  - **Metric alert fired:** check Azure Monitor. If it's a suspected key leak, rotate the keys at once (§14.1).
  - There's **no fallback provider**.

### 14.3 Prod smoke (D29)
- After F6 flags on, Aaron or an HK tester runs **one** analysis with a real quote they consent to send.
- Check:
  - the result renders;
  - the `quote_usage` row shows `succeeded`, `consent_version = quote-azure-1` and a sane `est_cost`;
  - Azure Monitor metrics on `renocheck-quote-prod` show the call;
  - the reservation was released and replaced by the actual cost (`quote_spend_daily` matches the row);
  - [Rev6] `processed_region` is logged if the `x-ms-region` header is present.
- No synthetic rows in prod. If a synthetic quote is used, delete its rows afterwards with Aaron's approval.

### 14.4 Residual risks to record in DEC-0013
- **R3 Third-party data:** see §6.4.
- **R7 Retention:** abuse-monitoring storage in Japan, period not stated in the current docs [Unverified]. [Rev6 S5] We disclose "not stated now; historically up to 30 days" (D38). Human review is possible when content is flagged, part of a potentially abusive pattern, or below automated confidence thresholds. Disclosed in the consent and §八.
- **R8 No hard spend cap on Azure PAYG:** budgets are monthly, alert only, evaluated every 24h with 8–24h lag (S-A9/S-A10).
  - Controls: the US$1/day app cap with per-attempt upper-bound reservations on a single-row counter (§14.2), `maxRetries: 0`, and the 300 calls/day ceiling.
  - [Rev6 S3] A **leaked key bypasses the app cap**. It is bounded only by the deployment TPM (≈ US$7–36/day worst case at 50K) and detected by the Azure Monitor metric alert, then key rotation.
- **R9 Quota on a new subscription:** `gpt-6-luna` may need a quota request. Until it's granted, quote analysis can't launch. The fallback model needs Aaron's OK (§14.1).
- **R10 Global Standard processing location:** requests may be processed in any Azure region; only data at rest is in Japan. That's disclosed. Moving to an APAC Data Zone model would cost about 10× and needs a new consent version.
- **R11 Azure abuse enforcement:** severe abuse findings can throttle or suspend the resource or subscription (S-A2). Quote analysis fails closed; company reports are unaffected.
- **R5 (company reports only, pre-existing):** Gemini lists no HK availability. Unchanged; D22.
- [Rev6 S1] **R2 (company reports only, pre-existing):** the Gemini API terms say "You may use only Paid Services when making API Clients available to users in the European Economic Area, Switzerland, or the United Kingdom". `/api/search` serves those visitors on the free key. D22 default: accept and record it. If the Gemini key is suspended, follow `docs/runbooks/llm-provider-outage.md` (D23).
- [Rev6 N-M1] **R12 UK GDPR compliance:** the controller is MindArk IO Ltd. The DPIA (with the LIA), Art 14(5)(b), transfer mechanisms and the ICO fee must all be done before F6 (§6 item 9).
- ~~R6 HK not on OpenAI's supported list~~: **retired by D31** (Rev 5).

### 14.5 Unverified items to close in F2/F3 (keep until each is ticked)
- [ ] F2: exact `@ai-sdk/azure` major and option names (`store`, `reasoningEffort`, `strictJsonSchema`, `imageDetail`) under `providerOptions.azure`.
- [ ] F2: `gpt-6-luna` image tokens per photo (1.2× / 2,500-patch assumption) and PDF tokens per page, from real `usage`.
- [ ] F2: base64 PDF input works on the Azure Responses API for `gpt-6-luna` (S-A8 read from a snippet only).
- [ ] F2: the strict JSON schema is accepted; check `.nullable()` handling and the refusal / `content_filter` shapes.
- [ ] F3: Azure error codes (`content_filter`, 429 quota, 401/403, `DeploymentNotFound`) and their mapping (§3.3).
- [ ] F3: the Responses API honours `store:false`: [Rev6 S4] a dev-resource `GET /openai/v1/responses/{id}` → 404 after the smoke. Also confirm the default 30-day retention fact (verified in docs by 蟲 2026-10-19).
- [ ] F2: the real per-request TPM estimate from the `x-ratelimit-*` headers, to set the deployment TPM (D35b).
- [ ] F3: whether the `x-ms-region` response header is present (L2).
- [ ] F2: the `@ai-sdk/azure` default `store:true` claim (S-X1; not re-verified by 蟲).
- [ ] F3: the `gpt-6-luna` Japan East Global price is re-read from the Retail Prices API / pricing page before the constants are set.
- [ ] F3: the quota tier of the new subscription and the quota for `gpt-6-luna` Global Standard.
- [ ] Before F6:
  - abuse-monitoring retention period (re-check the docs; keep "up to 30 days" if still unstated);
  - Product Terms / Generative AI terms have no clause against serving HK end users;
  - contracting Microsoft entity for MindArk IO Ltd;
  - [Rev6 N-M1] UK adequacy for Japan; the UK IDTA/Addendum in the Microsoft, Vercel, Supabase and [Rev6.2] Airwallex terms;
  - [Rev6.2] Airwallex: account country, scoped API keys, access-token TTL, HPP payer-email behaviour, AlipayHK fee, card minimum amount, its role for payer data, and the current HK fee schedule (March 2025 PDF);
  - ~~the ICO register status of MindArk IO Ltd (D39)~~ [Rev6.2] closed: fee paid;
  - the DPIA signed off.
- [ ] Southeast Asia `gpt-6-luna` meter anomaly (not used; Japan East chosen).
