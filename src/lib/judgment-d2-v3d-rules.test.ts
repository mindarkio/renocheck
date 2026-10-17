import { describe, expect, it } from "vitest";
import {
  isEngineeringCompanyPlaintiffOnly,
  isForceKeepCaseRef,
  normalizeCaseRefKey,
} from "./judgment-d2-v3d-rules";

describe("judgment-d2-v3d-rules", () => {
  it("normalizes force-keep refs", () => {
    expect(normalizeCaseRefKey("CACV 82/2015")).toBe("CACV82/2015");
    expect(isForceKeepCaseRef("HCSA18/2025")).toBe(true);
  });

  it("drops engineering plaintiff only pattern", () => {
    expect(
      isEngineeringCompanyPlaintiffOnly(
        "其士(建築)有限公司",
        "中俊投資有限公司",
      ),
    ).toBe(true);
    expect(
      isEngineeringCompanyPlaintiffOnly(
        "名富裝修工程有限公司",
        "仁禮大廈業主立案法團",
      ),
    ).toBe(true);
  });
});
