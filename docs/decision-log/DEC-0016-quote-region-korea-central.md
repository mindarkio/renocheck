# DEC-0016: Quote-analysis Azure region moves to Korea Central

- **Status:** accepted — Aaron, 2026-10-27.
- **Date:** 2026-10-27
- **Supersedes:** the region part of [DEC-0013](DEC-0013-quote-analysis-and-feedback.md) (D31). The rest of DEC-0013 stays.

## Context

DEC-0013 D31 placed the quote-analysis Azure OpenAI resource in Japan East. Azure denied the Japan East quota increase (no capacity, 2026-10-25) and approved Korea Central (2026-10-27). Southeast Asia was the backup. [Aaron-reported, 2026-10-27; Azure quota request IDs not recorded here] Aaron approved the disclaimer wording change and the `DISCLAIMER_VERSION` bump on 2026-10-27.

## Options

| Option | Pros | Cons |
|--------|------|------|
| Stay on Japan East | — | Azure denied the quota increase (no capacity, 2026-10-25). |
| Korea Central | Azure approved the quota (2026-10-27). | — |
| Southeast Asia | Named backup. | Not the region Azure approved. |

## Decision

The quote-analysis Azure OpenAI resource moves from Japan East to Korea Central.

- Foundry resource: `renocheck-quote-korea-resource`
- Project: `renocheck-quote-korea`
- Resource group: `renocheck-prod`
- Model: `gpt-6-luna`, Global Standard

The user-facing disclaimer parenthetical changes from `（資源位於日本東部；個別請求可能在該模型可供使用的任何 Azure 地區處理）` to `（資源位於南韓中部；個別請求可能在該模型可供使用的任何 Azure 地區處理）`. `DISCLAIMER_VERSION` goes 1.2.5 → 1.2.6. `REPORT_VERSION` stays 2.7.0.

## Consequences

- The region sentence in DEC-0013 D31 and the Japan East text in `docs/plans/PRF-quote-analysis-plan.md` are historical. Both files point here and are otherwise unchanged.
- The live disclaimer, the DPIA (processing line, balancing test, transfer row, abuse-monitoring storage), the quote-provider pause runbook, and the draft consent storage sentence name Korea Central (南韓 for the consent sentence).

## Follow-ups (before `QUOTE_ANALYSIS_ENABLED` is on in Production)

- Production `AZURE_OPENAI_ENDPOINT`, `AZURE_OPENAI_API_KEY` and `AZURE_OPENAI_DEPLOYMENT` point at `renocheck-quote-korea-resource`. Code does not tie the disclaimer to the endpoint, so a Japan East endpoint left in env would make the copy wrong.
- Re-read the `gpt-6-luna` Global Standard price for a Korea Central resource. `QUOTE_INPUT_USD_PER_MILLION` and `QUOTE_OUTPUT_USD_PER_MILLION` still carry the DEC-0013 numbers. [Unverified for Korea Central]
- Confirm the DPIA transfer mechanism (UK adequacy regulations for the Republic of Korea). [Likely; verify]
- Name the dev resource. DEC-0013 kept separate prod and dev resources and keys; this decision names only the prod resource.

## Reversal

Move the resource back and restore the Japan East disclaimer parenthetical, with a new disclaimer version and Aaron's approval.

## Triggers to reconsider

- Korea Central quota is later denied. Southeast Asia was the backup.
