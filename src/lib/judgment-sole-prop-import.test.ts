import { describe, expect, it } from "vitest";
import { legalRowMatchesSearchLabel } from "./judgment-lookup-match";
import { resolveImportCompanyFields } from "./judgment-sole-prop-import";

const homelandDefendant =
  "李志祥及潘欣怡經營HOMELAND CIVIL ENGINEERING COMPANY（木子水禾田工程公司）";

describe("sole proprietorship import + lookup", () => {
  const shaped = resolveImportCompanyFields({
    companyNameNormalized: homelandDefendant,
    partyNames: [
      "CHONG KEI SHU t/a TAT SHING CIVIL ENGINEERING CO（達成土木工程公司）",
      homelandDefendant,
    ],
    lookupAliases: [
      "HOMELAND CIVIL ENGINEERING COMPANY",
      "木子水禾田工程公司",
    ],
  });

  const row = {
    company_name_normalized: shaped.companyNameNormalized,
    lookup_aliases: shaped.lookupAliases,
    topic_tags: shaped.topicTags,
  };

  it("stores trade in company_name_normalized, not owner names", () => {
    expect(shaped.companyNameNormalized).toContain("HOMELAND");
    expect(shaped.companyNameNormalized).not.toContain("李志祥");
    expect(shaped.topicTags).toContain("sole_proprietorship");
  });

  it("does not match owner personal names", () => {
    expect(legalRowMatchesSearchLabel("李志祥及潘欣怡", row)).toBe(false);
    expect(legalRowMatchesSearchLabel("CHONG KEI SHU", row)).toBe(false);
  });

  it("matches trade name via lookup_aliases", () => {
    expect(legalRowMatchesSearchLabel("木子水禾田工程公司", row)).toBe(true);
    expect(legalRowMatchesSearchLabel("HOMELAND CIVIL ENGINEERING", row)).toBe(
      true,
    );
  });

  it("fails import when sole prop trade cannot be parsed", () => {
    expect(() =>
      resolveImportCompanyFields({
        companyNameNormalized: "陳大文",
        partyNames: ["原告", "陳大文"],
      }),
    ).not.toThrow();
    expect(() =>
      resolveImportCompanyFields({
        companyNameNormalized: "陳大文經營",
        partyNames: ["原告", "陳大文經營"],
      }),
    ).toThrow(/sole_proprietor_trade_parse_failed/);
  });
});
