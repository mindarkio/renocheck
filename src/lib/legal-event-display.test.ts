import { describe, expect, it } from "vitest";
import {
  judgmentCategoryLabelZh,
  outcomeHintLabelZh,
} from "./legal-event-display";
import type { OutcomeHint } from "./legal-event-schema";
import { REPORT_TRUST_FORBIDDEN_ZH } from "./report-trust-copy-zh";

const OUTCOME_HINTS: OutcomeHint[] = [
  "defendant_liable",
  "partial",
  "defendant_not_liable",
  "procedural_only",
  "unclear",
];

describe("legal-event-display copy", () => {
  it("employment_renovation label and outcome hints avoid forbidden substrings", () => {
    const labels = [
      judgmentCategoryLabelZh("employment_renovation"),
      ...OUTCOME_HINTS.map((h) => outcomeHintLabelZh(h)),
    ];
    for (const text of labels) {
      for (const banned of REPORT_TRUST_FORBIDDEN_ZH) {
        expect(text).not.toContain(banned);
      }
    }
  });
});
