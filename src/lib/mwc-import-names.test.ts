import { describe, expect, it } from "vitest";
import { mwcStoredNames } from "./mwc-import-names";

describe("mwcStoredNames", () => {
  it("keeps the Chinese display name and stores the English name", () => {
    expect(
      mwcStoredNames({
        CHINESE_COMPANY_NAME: "恆偉工程公司",
        ENGLISH_COMPANY_NAME: "HANG WAI ENGINEERING LIMITED",
      }),
    ).toEqual({
      company_name: "恆偉工程公司",
      company_name_en: "HANG WAI ENGINEERING LIMITED",
    });
  });

  it("leaves company_name_en null when the register row has no English name", () => {
    expect(
      mwcStoredNames({
        CHINESE_COMPANY_NAME: "合成測試工程",
        ENGLISH_COMPANY_NAME: "  ",
      }),
    ).toEqual({
      company_name: "合成測試工程",
      company_name_en: null,
    });
  });

  it("stores an English-only company in both columns and strips html breaks", () => {
    expect(
      mwcStoredNames({
        ENGLISH_COMPANY_NAME: "OMYL<br>ENGINEERING LIMITED",
        REGISTRATION_NUMBER: "MWC-9",
      }),
    ).toEqual({
      company_name: "OMYL ENGINEERING LIMITED",
      company_name_en: "OMYL ENGINEERING LIMITED",
    });
  });
});
