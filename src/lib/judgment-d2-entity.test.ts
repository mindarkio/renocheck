import { describe, expect, it } from "vitest";
import { classifyDefendantEntity } from "./judgment-d2-entity";

describe("classifyDefendantEntity", () => {
  it("treats 有限公司 as company", () => {
    expect(classifyDefendantEntity("名富工程服務有限公司")).toBe("company");
  });

  it("flags short CJK name as natural person", () => {
    expect(classifyDefendantEntity("鍾灼偉")).toBe("natural_person");
  });

  it("treats 經營 as sole proprietor (Aaron v3 drop)", () => {
    expect(classifyDefendantEntity("楊國聰經營新寶燈飾裝修工程公司")).toBe(
      "sole_proprietor",
    );
  });

  it("flags spaced English personal names", () => {
    expect(classifyDefendantEntity("MIU YUK KWONG")).toBe("natural_person");
  });
});
