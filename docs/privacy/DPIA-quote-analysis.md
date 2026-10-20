# DPIA: quote analysis and report feedback

**DRAFT, not signed. Aaron signs before F6.** Do not turn `QUOTE_ANALYSIS_ENABLED` or production feedback on against this draft.

- **Date:** 2026-10-20
- **Controller:** MindArk IO Ltd (UK), company no. 17141212, trading as RenoCheck
- **Registered office:** Office 18282, 182-184 High Street North, East Ham, London, E6 2JA, United Kingdom (Companies House, checked 2026-10-20)
- **Contact:** hello@renocheck.homes, 「個人資料事務負責人」
- **Decision:** [DEC-0013](../decision-log/DEC-0013-quote-analysis-and-feedback.md) (proposed)
- **Plan:** [PRF-quote-analysis-plan.md](../plans/PRF-quote-analysis-plan.md) Rev 6.2, §6 item 9
- **Author of this draft:** engineering write-up for Aaron. This is not a legal opinion and not a signature.

UK GDPR applies because the controller is established in the UK, alongside the HK PDPO for users in Hong Kong. Geo-blocking UK users would not remove that.

## 1. Processing description

Two processes. Neither is live from this document.

**Quote analysis (later PRs, flag off until F6).** A user uploads up to 5 photos or 1 PDF of a renovation quote. The browser re-encodes photos (EXIF dropped). The server holds the bytes only in function memory, sends them inline to Azure OpenAI (`gpt-6-luna`, Global Standard, Japan East resource) with Responses `store: false`, redacts personal data in the model output, returns an anonymised checklist, and does not store the original file. What a quote can contain: the customer's name, flat address, and phone; other people's names and mobiles (contractor staff); signatures and chops; bank account and holder name; other addresses; occasionally an HKID image. Photos' EXIF GPS is removed before upload. PDF metadata is sent as-is (disclosed).

**Report feedback (F1, `FEEDBACK_ENABLED` off until Aaron applies M1 and the privacy notice ships).** A user may send 👍/👎 and an optional comment (≤500 characters) about a company report. Stored: rating, redacted comment, surface, report ref (32-hex cache fingerprint), report version, placement (`slide_in` or `inline`), and `HMAC_SHA256(QUOTE_HASH_SECRET, rc_did)`. The raw device cookie is not stored. Comments are not shown to other users. Not UGC.

**Not in this processing:** company-report search text sent to Gemini (pre-existing; D22 accepted in DEC-0013). This DPIA does not re-open that path except to note it is separate.

## 2. Lawful bases

The upload checkbox is a transparency and acceptance step. It is not the UK GDPR lawful basis.

| Processing | Basis | Note |
|------------|--------|------|
| Quote analysis for the uploader | Art 6(1)(b) — steps for a service the user asks for | The user requests the analysis |
| Third-party data on the quote | Art 6(1)(f) — legitimate interests | Short LIA below |
| Feedback rating and comment | Art 6(1)(f) | Improve reports. Not published |
| Quota and device hashes | Art 6(1)(f) | Fraud and abuse prevention; daily free quota |
| Payments (Airwallex, later) | Art 6(1)(b) | The paid credit the user buys |

### LIA — third-party data on quotes (draft)

**Purpose.** Read a quote the user chose to upload, including names and numbers of people who are not the user, only so the checklist can be produced for that user.

**Necessity.** The quote content is the input. RenoCheck does not mask it before Azure (the "original" is the content, not the camera bytes). A server-side mask would still have to read the same data. The practical reduction is on the user's side: the tip, the photo crop/mask, and photographing terms pages rather than signature or ID pages.

**Balancing.** Those other people have not asked for this service and do not expect their details to go to an AI provider in Japan (processing possibly in any Azure region). Weight against the interest: no RenoCheck copy of the original, output redaction before display or storage, `store: false`, no Files API, no training use by Microsoft's published terms, and a required unticked checkbox that tells the uploader other people's data will be sent. Weight for the risk: the checkbox cannot consent for them; abuse monitoring may store content and a person at Microsoft may review it; the retention period is not stated in current Microsoft docs.

**Draft conclusion.** Legitimate interests is the proposed basis, with the residual risk accepted only when Aaron signs this DPIA. Until then the feature stays off. This LIA is not a determination by a lawyer.

## 3. Art 14(5)(b) — third-party data

People named on a quote are not the user. Art 14 would normally require a privacy notice to them. **Proposed reliance: Art 14(5)(b)** (impossible or disproportionate effort).

- RenoCheck does not keep the original, so it often cannot identify or contact them after the request.
- Contacting them would itself reveal that someone asked for a quote review.
- The classes of data and the transferees are described in the future `/legal` collection statement (§八 3a in the plan) so the information is published.

This reliance is documented here for Aaron. It is not in force until he signs and the public notice ships (F6). F1's feedback notice is separate and is about the person who submits feedback, who is the data subject, so Art 14 does not apply to that person.

## 4. Transfers

Each mechanism is **verify**. Do not treat a row as closed.

| Destination | What moves | Mechanism | Status |
|-------------|------------|-----------|--------|
| Azure Japan (data at rest, abuse-monitoring store, any stored state) | Quote bytes and model output, for the request | UK adequacy regulations for Japan | **verify** [Likely; not confirmed in this draft] |
| Any Azure geography (Global Standard processing) | The same request, transiently | Microsoft DPA / UK IDTA or Addendum, as incorporated in the Azure subscription | **verify** |
| Vercel `sin1` (Singapore) | Request body in function memory, including the upload | Vercel DPA; UK IDTA or Addendum | **verify** |
| Supabase `ap-southeast-1` (Singapore) | Anonymised quote result (later), hashed device id, feedback row. Not the original file | Supabase DPA; UK IDTA or Addendum | **verify** |
| Airwallex (primarily Singapore, Belgium, the Netherlands, Japan, Australia, Malaysia, and the United States, per its Global Customer Privacy Policy v6, 2026-02-26) | Payer data for a credit. RenoCheck does not store card numbers | Airwallex terms; policy cites EU SCCs and the UK IDTA | **verify** |

Airwallex policy URL (read via the plan, 2026-10-20): https://assets.ctfassets.net/e6wv1zvbwa49/6zfth37fc8aEAq9cbN0H6P/b3a83910ca28e335b14d909a38f2451b/-Clean-_-_Global_-_Global_Privacy_Policy__v6__2026.02.26.docx.pdf

## 5. Processors

| Party | Role | Contract | Status |
|-------|------|----------|--------|
| Microsoft (Azure OpenAI) | Processor for quote content (D32) | Products and Services DPA, Product Terms, Universal License Terms for Generative AI, accepted at Azure sign-up. No separate form. Contracting entity for a UK customer is [Unverified] | **verify** — Aaron checks Cost Management + Billing before F6 |
| Vercel | Processor (hosting, `sin1`) | Vercel DPA | **verify** UK IDTA / Addendum |
| Supabase | Processor (database, `ap-southeast-1`) | Supabase DPA | **verify** UK IDTA / Addendum |
| Airwallex | Payment provider for quote credits | Online Payment Terms / DPA. Whether Airwallex is an independent controller or a processor for payer data is [Unverified] | **verify** before F5 |

No other processor is added for F0/F1. There is no Sentry SDK in the repo today.

## 6. Abuse monitoring and possible human review

Microsoft reviews requests with automated classifiers and models. Authorised Microsoft employees may review content when it is flagged, when it is part of a possibly abusive pattern, or when automation is below confidence or unavailable (not only flagged content). Storage is in the resource geography (Japan). **Retention period: not stated on the current docs [Unverified]** (checked 2026-10-19). Older material said up to 30 days. Severe or repeated abuse can throttle or suspend the resource.

Modified abuse monitoring is not requested (D33). If it is ever approved, the consent version, §八, and `DISCLAIMER_VERSION` change together, with Aaron's sign-off.

RenoCheck cannot delete Microsoft's copy after send. The DRAFT consent says that.

## 7. Retention (D8)

| Data | Period | How it ends |
|------|--------|-------------|
| Original quote bytes | Not stored | Dropped when the function returns |
| `report_feedback` | **12 months** (locked for feedback) | Daily purge. F1 adds `/api/cron/purge-feedback`. Aaron applies M1 himself |
| `quote_usage` | Plan default 30 days — not separately locked in the F0 brief | Later purge |
| `quote_analyses` (anonymised result, no evidence text) | Plan default 180 days | Later purge |
| `quote_consent_daily` (counts only, no device hash) | Plan default 2 years (D30) | Later |
| Payment rows | No card data. Expiry of a credit is an open product decision (D13, proposal 30 days) | Airwallex holds payer data under its policy |

## 8. US$1 cap and quota hashing

- App-side cap **US$1 per HKT day** for quote analysis (D36). Free use stops at US$0.80; US$0.20 remains for paid credits (D36b). Pause copy and resume are in [`quote-provider-paused.md`](../runbooks/quote-provider-paused.md).
- The cap limits how many quote files are sent to Azure. It does not limit company-report Gemini spend.
- Device id `rc_did` is a random 128-bit cookie (`HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=1 year`). The database stores only `HMAC_SHA256(QUOTE_HASH_SECRET, rc_did)`. For quota, the IP hash is `HMAC(QUOTE_HASH_SECRET, ip + day_hkt)` so it changes daily (plan §5.1). The secret is absent → the route fails closed. Agents check presence only, never the value.
- Hashes are for the quota and for one vote per device. They are not used to build a public profile.

## 9. Feedback (Art 6(1)(f))

Purpose: see whether a report helped, and optional free text, to improve the product. Interests: product quality. The person submits it themselves. Mitigations: flag off by default; not public; ≤500 characters; C0/C1 and bidi characters stripped; phone, email, HKID-like, and honorific-name redaction before insert; comments not logged; 12-month delete; service-role only (RLS on, no policies).

The F1 privacy notice is drafted in that PR description for Aaron. It is **not** committed to `/legal` here. `DISCLAIMER_VERSION` stays `1.2.0` until he approves a follow-up (proposed patch `1.2.1`). `FEEDBACK_ENABLED` stays off until that notice ships and M1 is applied.

## 10. ICO

**Fee: paid** by Aaron for MindArk IO Ltd (D39, 2026-10-20).

- Tier 1 (micro: turnover ≤ £632,000 or ≤ 10 staff): £52/year, or £47 by direct debit. Source: https://ico.org.uk/for-organisations/data-protection-fee/data-protection-fee/ (read 2026-10-20).
- **Registration reference:** _Aaron fills this in._ It is not in the repo. Whether the register entry was already live before the fee is unknown to this draft.

## 11. Necessity and proportionality (draft)

Quote analysis is optional. Company search works without it. The file is not kept. The model is the cheapest Aaron chose, with a US$1/day cap. Feedback is optional, one row per device per report, and deleted after 12 months.

Residual risks R2, R3, R5, R7–R12 are in DEC-0013. R6 is retired.

## 12. Sign-off

| | Name | Date | Signature |
|--|------|------|-----------|
| Controller (Aaron, for MindArk IO Ltd) | | | **Not signed** |
| Review before F6 flags on | | | |

Signing this draft means the LIA, Art 14(5)(b) reliance, and the transfer rows have been accepted or updated. It does not by itself publish `/legal` copy.
