import { describe, expect, it } from "vitest";
import { courtFromCaseRef } from "./court-from-case-ref";

const PREFIXES = {
  HCSA: "Small Claims Tribunal",
  DCCJ: "District Court",
};

describe("courtFromCaseRef", () => {
  it("matches longest prefix", () => {
    expect(courtFromCaseRef("HCSA 64/2017", PREFIXES)).toBe(
      "Small Claims Tribunal",
    );
    expect(courtFromCaseRef("DCCJ4239/2022", PREFIXES)).toBe("District Court");
  });
});
