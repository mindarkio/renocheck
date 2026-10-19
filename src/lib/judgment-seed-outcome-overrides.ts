/** Human-verified outcome_hint for seed / summary dry-run (Track 1 ops). */

import { normalizeCaseRefKey } from "./judgment-d2-v3d-rules";
import type { OutcomeHint } from "./outcome-hint";

/**
 * Key = normalizeCaseRefKey(caseRef).
 * Appeal leave refused → follow first-instance outcome (see judgment-summary-draft prompt).
 */
const OUTCOME_BY_CASE: Record<string, OutcomeHint> = {
  "HCSA57/2024": "defendant_liable",
  "DCCJ3193/2017": "partial",
  "HCSA28/2016": "defendant_liable",
  "HCSA62/2012": "defendant_liable",
  "DCCJ5926/2005": "defendant_liable",
  "HCLA23/2024": "defendant_liable",
  "HCLA24/2024": "defendant_liable",
  "HCLA25/2024": "defendant_liable",
  "HCLA26/2024": "defendant_liable",
};

export function seedOutcomeOverride(caseRef: string): OutcomeHint | undefined {
  return OUTCOME_BY_CASE[normalizeCaseRefKey(caseRef)];
}

export function applySeedOutcomeOverride(
  caseRef: string,
  fromDraft: OutcomeHint,
): OutcomeHint {
  return seedOutcomeOverride(caseRef) ?? fromDraft;
}
