# Decision log (DEC)

Significant technical or product decisions that are hard to infer from git alone.

## When to write a DEC

- Change search provider (Serper / SerpAPI / Google CSE — see DEC-0008)
- Change `RiskReport` / grading schema（e.g. DEC-0010 risk bands）
- New PII fields or retention policy
- Stack deviation from default (see `architecture` rule)
- Public launch, pricing, or legal copy strategy

## Filename

`DEC-NNNN-short-kebab-title.md` (e.g. `DEC-0001-lightweight-governance.md`)

## Template

```markdown
# DEC-NNNN: Title

- **Status:** accepted | superseded
- **Date:** YYYY-MM-DD

## Context

## Options

| Option | Pros | Cons |
|--------|------|------|
| A | | |
| B | | |

## Decision

## Consequences

## Reversal cost

## Triggers to reconsider
```

IDs are never reused. Superseded DECs stay in place; link to the replacement.
