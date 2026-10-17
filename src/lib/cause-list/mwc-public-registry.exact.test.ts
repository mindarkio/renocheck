import { describe, expect, it } from "vitest";
import { corporateRegistryFromRegistersCsv } from "./mwc-public-registry";

const PERSON = "SYNTHETIC PERSON GAMMA";

describe("corporateRegistryFromRegistersCsv", () => {
  it("indexes limited companies and drops sole-proprietor name columns", () => {
    const csv = [
      "REGISTRATION_NUMBER,REGISTRATION_TYPE,ENGLISH_NAME,CHINESE_NAME,ENGLISH_COMPANY_NAME,CHINESE_COMPANY_NAME",
      `MWC000001,MWC,${PERSON},合成人丙,FICTIVE WIDGET LIMITED,示例器件有限公司`,
      "MWC000002,MWC,SYNTHETIC PERSON DELTA,合成人丁,,",
      "GBC1,GBC,SKIP,不收,OTHER LIMITED,其他有限公司",
    ].join("\n");

    const registry = corporateRegistryFromRegistersCsv(csv);
    expect(registry).toEqual([
      {
        id: "MWC000001",
        namesEn: ["FICTIVE WIDGET LIMITED"],
        namesZh: ["示例器件有限公司"],
      },
    ]);
    const blob = JSON.stringify(registry);
    expect(blob).not.toContain(PERSON);
    expect(blob).not.toContain("合成人");
    expect(blob).not.toContain("DELTA");
  });
});
