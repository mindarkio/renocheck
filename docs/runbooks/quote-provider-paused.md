# Runbook: quote analysis paused

Quote analysis only (plan §14.2, DEC-0013). Company reports keep running. There is **no fallback provider** for quotes.

The cap is **US$1 per HKT calendar day** (D36). Free analyses stop at **US$0.80**; **US$0.20** stays for paid credits (D36b). The day boundary is `Asia/Hong_Kong` midnight, from the database clock once F3 exists.

`/api/health` will gain `quoteProvider` booleans only (`configured`, `paused`, `deploymentSet`). No resource name, deployment name, or key. That field is not in the F0/F1 code.

## What each pause means

| State | Meaning | What to do |
|-------|---------|------------|
| Cap reached (`quote_paused`, spent + reservations at the cap) | App-side US$1 day cap (or the US$0.80 free sub-cap for a free attempt). No Azure call is made. | Nothing. It **auto-resumes at HKT midnight**. Raising the cap needs Aaron. Do not edit the constant in a hurry. |
| `paused_reason = provider_denied` | 3 × `provider_denied` in 10 minutes (key, deployment, or config). Stays for the rest of the HKT day unless Aaron resets the flag. | Check the key and the `gpt-6-luna` Global Standard deployment on the Japan East resource in the Azure portal. Fix, then clear `paused_reason` on that day's `quote_spend_daily` row. |
| Soft pause (`paused_until`, about 10 minutes) | 5 × HTTP 429 in 5 minutes (TPM/RPM). | Wait. It clears when `paused_until` passes. If it repeats, compare deployment TPM (prod 50K / dev 20K, D35b) with the measured per-request estimate. |
| Call ceiling | 300 provider calls that HKT day (free attempts stop earlier, at 80% of the ceiling). | Resumes at HKT midnight with the new day row. |
| `QUOTE_PROVIDER_PAUSED=1` | Manual kill switch. | Aaron sets it in Vercel. Unset it to allow calls again. The daily cap still applies. |

While paused, the product copy (still DRAFT) tells the user quote analysis is paused until tomorrow and company search still works. A paid credit is not consumed by a pause; the plan extends its expiry by one day if the cap trips while they hold a credit (F5).

## Key rotation

Do this immediately on a suspected leak, and every 90 days.

1. In Azure, regenerate **Key 2** on that resource (prod and dev are separate).
2. Aaron updates `AZURE_API_KEY` in the matching Vercel scope only. Prod key: Production, Sensitive, never Preview.
3. Regenerate **Key 1** so the old key is dead.
4. If the metric alert fired (processed tokens > 2M in 1 hour, or 429 count > 20 in 15 minutes), treat it as a possible leak until Azure Monitor shows otherwise. A leaked key bypasses the US$1 app cap and is bounded by TPM (about US$7–36/day at 50K TPM). See DEC-0013.

No agent reads the key. Presence only, via `/api/health` booleans, once those exist.
