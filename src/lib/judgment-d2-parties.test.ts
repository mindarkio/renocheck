import { describe, expect, it } from "vitest";
import {
  defaultDefendantPartyLabel,
  splitPartiesLine,
} from "./judgment-d2-parties";

describe("splitPartiesLine", () => {
  it("splits Chinese 對", () => {
    const s = splitPartiesLine("郭振強及另一人 對 陳國新經營燊記裝修水電工程");
    expect(s?.right).toBe("陳國新經營燊記裝修水電工程");
    expect(defaultDefendantPartyLabel(s!)).toBe(s!.right);
  });

  it("splits v", () => {
    const s = splitPartiesLine("A v B");
    expect(s?.left).toBe("A");
    expect(s?.right).toBe("B");
  });
});
