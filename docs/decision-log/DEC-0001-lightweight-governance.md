# DEC-0001: Lightweight governance for MVP

- **Status:** accepted
- **Date:** 2026-10-12

## Context

MindArk generic AI prompt (rev4) defines full MRL/KB, `Ver_*` folders, and heavy change control. Renocheck MVP targets ~2 weeks to validate search quality and willingness to pay.

## Options

| Option | Pros | Cons |
|--------|------|------|
| A — Full rev4 structure | Maximum audit trail | Slow; mismatched with git-native Next.js workflow |
| B — Lightweight: `MVP.md` + DEC + Cursor rules | Fast; enough traceability for solo/small team | V2 needs migration to `RNCK-REQ-nnn` MRL |
| C — No written governance | Fastest | High drift risk; compliance mistakes |

## Decision

**B.** Specification of record: `docs/MVP.md`. Major forks: `docs/decision-log/DEC-*.md`. Cursor rules encode engineering and compliance guardrails. Full MRL/KB deferred to V2 per `docs/phases/V2-roadmap.md`.

## Consequences

- Agents and humans start from `AGENTS.md` + rules, not rev4 folder tree.
- Formal handoffs / external audit: also read `docs/ai-agent/AI-Agent-Generic-Prompt-20260827-rev4.txt`.

## Reversal cost

Medium: importing historical DECs into MRL rows if switching to full traceability.

## Triggers to reconsider

- Second engineer full-time on repo; paid launch; regulatory inquiry; B2B badge program.
