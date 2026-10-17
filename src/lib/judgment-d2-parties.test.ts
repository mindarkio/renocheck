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

  it("splits when 對 has no space before closing bracket", () => {
    const line =
      "CHONG KEI SHU t/a TAT SHING CIVIL ENGINEERING CO（達成土木工程公司）對 LI CHI CHEUNG and POON t/a HOMELAND CIVIL ENGINEERING COMPANY";
    const s = splitPartiesLine(line);
    expect(s?.left).toContain("TAT SHING");
    expect(s?.right).toContain("HOMELAND");
  });
});
