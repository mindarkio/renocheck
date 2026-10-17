import { describe, expect, it } from "vitest";
import {
  HEARING_SUMMARY_AUTO_PLACEHOLDER_ZH,
  hearingSummaryPendingForEvent,
} from "./judgment-hearing-summary";

describe("hearingSummaryPendingForEvent", () => {
  it("shows points for ai_verified when points exist", () => {
    expect(
      hearingSummaryPendingForEvent(["已核對要點"], "ai_verified"),
    ).toBe(false);
  });

  it("hides points when only placeholders and no verified source", () => {
    expect(
      hearingSummaryPendingForEvent(
        [HEARING_SUMMARY_AUTO_PLACEHOLDER_ZH],
        undefined,
      ),
    ).toBe(true);
  });

  it("does not use human_verified review_status semantics", () => {
    expect(
      hearingSummaryPendingForEvent(
        [HEARING_SUMMARY_AUTO_PLACEHOLDER_ZH],
        "llm_draft",
      ),
    ).toBe(true);
  });
});
