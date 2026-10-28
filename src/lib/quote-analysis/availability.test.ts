import { describe, expect, it } from "vitest";
import { quoteBudgetIsFull } from "@/lib/quote-analysis/availability";
import { reserveMicroUsd } from "@/lib/quote-analysis/config";

describe("quote upload availability", () => {
  it("treats a full shared daily budget as closed and a missing row as open", () => {
    expect(quoteBudgetIsFull(null)).toBe(false);
    expect(quoteBudgetIsFull({ spent: 0, reserved: 0, calls: 0 })).toBe(false);
    const reserve = reserveMicroUsd(1);
    expect(
      quoteBudgetIsFull({ spent: 800_000 - reserve + 1, reserved: 0, calls: 0 }),
    ).toBe(true);
    expect(quoteBudgetIsFull({ spent: 0, reserved: 0, calls: 300 })).toBe(true);
  });
});
