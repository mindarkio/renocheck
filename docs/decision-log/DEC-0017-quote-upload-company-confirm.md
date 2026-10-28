# DEC-0017: Quote upload first, then confirm the company name

- **Status:** proposed — pending owner approval. Not accepted.
- **Date:** 2026-10-28

## Context

Quote analysis existed behind login. The owner wants upload to be the main path, with company search kept on the homepage. The company or business name on the quote is needed to start that search. Personal names, phones, addresses, signatures, and bank accounts stay out of the model output.

The extracted company name and the name the user confirms are retained with the `quote_analyses` row for 180 days or until account deletion, whichever is earlier. Personal data is not stored. The disclaimer sentence that describes that retention is **proposed wording**. It is not owner-approved.

## Options

| Option | Pros | Cons |
|--------|------|------|
| Keep login before the file picker | Session exists before any bytes are chosen | The owner asked for the file first |
| Upload first, inline OTP, name only in the browser | The file is not sent before auth. The name is not a new database column | A reload drops the file and the extracted name |
| Store the company name on `quote_analyses` | The result page could reload with the name filled in | The owner said not to retain it. That would need a migration |

## Decision

- `/quote/upload` stays reachable while logged out when analysis is available. The visitor picks the PDF, then completes the existing email OTP on the same page. After verify, the page submits the file already in memory.
- The PDF is not written to localStorage, IndexedDB, or the server before authentication. `POST /api/quote/analyze` still requires a session and the existing daily limits.
- If the page reloads after a file was chosen, the page asks for the file again. The pending flag in sessionStorage is only `"1"`.
- The model may return `companyName` (the contracting company or business name, or null). Checklist rows stay `{ id, status }`. The extracted name and the name the user confirms are retained on that user's `quote_analyses` row for 180 days or until account deletion, whichever is earlier. Personal data is not stored. The name is not logged. The user confirms or edits it before any company search. That search is written to `search_cache` and `search_events` like any other search.
- Confirming runs the existing company-name search, including the register picker, the too-many prompt, the three-character personal-name gate, the 記/號 trade-suffix rule, rate limits, and the 100-character cap.
- `DISCLAIMER_VERSION` goes 1.2.6 → 1.2.7. `REPORT_VERSION` stays 2.7.0. The report shape did not change.
- Company-name columns and the anonymous spend hold are migrations the owner applies manually. There is no sealed result and no seal-nonce column.

## Consequences

- Default OTP redirect with no safe `next` is `/quote/upload`. A safe `next` is still honoured. An unsafe `next` falls back to `/quote/upload`.
- Homepage, header, `/quote`, and `/account` follow the same availability check: flag, Azure configuration, and the shared daily budget. A failed budget read leaves the entry available; the analyse route still enforces the cap.
- The search cache, if the user confirms, is the existing company-search cache. That is separate from `quote_analyses`.

## Reversal cost

Remove the confirm step and the `companyName` field, point the default redirect back at `/account`, and bump the disclaimer again if the privacy sentence is withdrawn.

## Triggers to reconsider

- The owner rejects the proposed privacy sentence.
- The name needs to survive a reload. That needs an explicit decision to store it, and a migration.
