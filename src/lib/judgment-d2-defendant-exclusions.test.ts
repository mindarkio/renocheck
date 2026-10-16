import { describe, expect, it } from "vitest";
import { defendantRenovationScopeDropReason } from "./judgment-d2-defendant-exclusions";

describe("defendantRenovationScopeDropReason", () => {
  it("drops vehicle and estate agent defendants", () => {
    expect(
      defendantRenovationScopeDropReason({
        caseRef: "DCCJ 774/2019",
        defendantLabel: "車之城有限公司",
        plaintiffLabel: "王玉蘭",
        partiesLine: "王玉蘭 對 車之城有限公司",
        entityKind: "company",
      }),
    ).toBe("defendant_vehicle_industry");

    expect(
      defendantRenovationScopeDropReason({
        caseRef: "DCCJ 2965/2011",
        defendantLabel: "家居地產(香港)有限公司",
        plaintiffLabel: "周筱平",
        partiesLine: "周筱平 對 家居地產(香港)有限公司",
        entityKind: "company",
      }),
    ).toBe("defendant_estate_agent");
  });

  it("drops work injury employer context", () => {
    expect(
      defendantRenovationScopeDropReason({
        caseRef: "CACV 28/2018",
        defendantLabel: "松美工程公司僱主許重暖及另一人",
        plaintiffLabel: "李成足",
        partiesLine: "李成足 對 松美工程公司僱主許重暖及另一人",
        entityKind: "company",
      }),
    ).toBe("defendant_work_injury_context");
  });

  it("keeps IOC v contractor without engineering keyword on defendant", () => {
    expect(
      defendantRenovationScopeDropReason({
        caseRef: "CACV 131/2005",
        defendantLabel: "GORDON TSO & CO LTD",
        plaintiffLabel: "THE INCORPORATED OWNERS OF THE COLONNADES",
        partiesLine:
          "THE INCORPORATED OWNERS OF THE COLONNADES 訴 GORDON TSO & CO LTD",
        entityKind: "company",
      }),
    ).toBeNull();
  });
});
