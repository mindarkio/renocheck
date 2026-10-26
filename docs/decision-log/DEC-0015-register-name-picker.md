# DEC-0015: Register name picker before the report

- **Status:** accepted
- **Date:** 2026-10-26
- **Supersedes:** the "No picker UI" sentence in [DEC-0014](DEC-0014-typed-brand-and-english-name-search.md). The rest of DEC-0014 (alias query budget, English register names, contains ranking) stays.

## Context

A typed company name that contains several Buildings Department register rows still ran one report. The heading became one register name. The typed text was stored on `entity.queryEcho` and was not shown. The only signal was the chip **政府名冊需再核實**. Very short, generic, and personal-name queries were not stopped before lookup. `/legal/disclaimer`, `/how-it-works`, and the FAQ already refer to a heading **本次查證範圍** that the report did not render.

Approved by Aaron on 2026-10-26.

## Decision

Company-name search, after the box is read as a company name (phones and BR numbers skip this):

1. Short or generic text (under 4 Chinese characters, except a 3-character personal name and a 3-character name containing 記、行 or 號 with no trade word such as 水電 or 工程; under 6 Latin letters; or only the existing trade-word list) asks for the full name. No register lookup and no report.
2. A likely personal name asks for a company or trading name. No lookup and no web search until the user continues. English names of 2–3 words with a listed surname or a title (`Mr` / `Mrs` / `Ms` / `Miss`), Chinese names of 1–3 characters plus 生／太／先生／小姐／太太／師傅, and a Chinese name of exactly 3 characters and no trade word are all blocked the same way and add the text link **呢個係公司全名，繼續查**, which then continues as a company search. **記**, **行**, and **號** count as trade characters for this gate only, so a three-character name such as 李錦記 is searched as a company and is not a personal name. They are not added to the generic-alias list. Two-character names with no title stay on the short-name prompt. `南興` is not a person.
3. `經營`, `trading as`, and `t/a` search only the trading name after those words, and only when that part still passes the rules above. `trading as` and `t/a` count only as whole words (`Smart/Advance` is not `t/a`). `經營` counts only when the text before it is empty or reads as a personal name, because register names also contain it (`物業經營管理有限公司`).
4. Otherwise look up the register (at most the existing 20-row window):
   - 0 rows: today's report.
   - 1 row: today's report, plus the typed-versus-register line when the strings differ.
   - 2–8 rows: a picker. The report starts only after a choice. An exact register name that is also contained in longer names still shows the picker, with **同你輸入一樣** on the exact row.
   - 9 or more, or a full 20-row window: ask for the full name. No list and no report.
5. Each picker row shows the published Chinese name (for an `MWC(W)` individual registration, that published name), the English name when it differs, and **註冊編號**. Never phone, authorised signatory, or district.
6. After an explicit pick, the report uses that registration number, `ambiguous` is false, and the chip is **政府名冊有登記**. The big heading stays the register name. The server re-runs the same register lookup for the typed name and accepts the number only when that lookup would show a picker (2–8 rows, window not full) and lists that number. Any other number fails the search and nothing is cached.
7. When a register row was used and the typed text is not that register name (spaces and full-width characters ignored), the blue header shows the heading **本次查證範圍** and the line **你輸入「{輸入}」／名冊名稱「{名冊}」**. If either name contains 「／」 or `/`, use the two-sentence form **你輸入「{輸入}」。報告用名冊名稱「{名冊}」。** Phone and BR searches use the same line when the heading became a register company name, with only the phone or BR number as {輸入}. No register row: do not add the line.
8. Copy is the recommended column from the 2026-10-26 spec: picker, too-many, short/generic, personal-name, loading **正在對照屋宇署名冊…**, error **名冊暫時對唔到，請稍後再試。** with **再試一次**, and the screen-reader labels **揀一間名冊上嘅公司** and **正在對照屋宇署名冊**. The too-many body does not offer a registration-number search: it ends at **請輸入報價單或合約上嘅公司全名。** The heading stays **請輸入公司全名**. No other approved sentence is changed.
9. The register preview uses its own rate-limit bucket: the same in-memory 5-per-minute limiter as search, under the key `register-preview:` + the IP. It does not spend a search slot, and it needs no secret or database table. A body with a non-null `preview` uses this bucket (any value other than `"register"` is refused); `preview: null` is an ordinary search and spends a search slot. Pressing Enter on a focused picker row runs **查呢間** for that row. While a report request is in flight, further 查呢間 or Enter presses are ignored.
10. `companyName` is at most 100 characters, in the request schema and on the input.

`DISCLAIMER_VERSION` stays 1.2.5. `/legal/*`, `/how-it-works`, and the FAQ are not edited in this change. `REPORT_VERSION` stays 2.7.0 because the line is rendered from `queryEcho`, `displayName`, and `official.mwcMatched`. The chosen registration number is part of the search fingerprint, not a new report field. A search with a pick uses a JSON-encoded fingerprint so typed text cannot reproduce it; searches without a pick keep their existing fingerprints. No database migration.

## Consequences

- Direct `POST /api/search` without `mwcRegistrationNo` still auto-picks one row and keeps `ambiguous` when several rows match (DEC-0014 ranking). The product UI does not do that for 2–8 matches.
- A two-word English brand that ends in a listed surname and has no trade word is still stopped first (`Lee Garden`, `Wong Kee`). The continue link lets that search go on as a company name. A surname missing from the list is a miss, not a block. `周大福` has none of 記、行、號, so it stays on the personal-name prompt with the same link.
- Contains ranking still reads at most 20 rows. A full window is treated as too many, not as a partial picker.

## Reversal

Remove the pre-report gate in the search form, stop sending `preview: "register"` and `mwcRegistrationNo`, and hide the scope line. DEC-0014's single-row ranking then applies to every company-name search again.

## Triggers to reconsider

- Real 3-character trading names are blocked often enough that the continue link is not enough.
- The 2–8 picker band is too narrow or too wide on the live register.
- The surname list blocks a brand that owners search often.
