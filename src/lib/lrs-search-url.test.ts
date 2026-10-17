import { describe, expect, it } from "vitest";
import {
  buildLrsCaseNumberSearchResultUrl,
  buildLrsDualFieldSearchResultUrl,
  buildLrsPartiesSearchResultUrl,
  buildLrsSearchResultUrl,
} from "./lrs-search-url";

describe("buildLrsSearchResultUrl", () => {
  it("builds JU-only phrase search for 裝修工程", () => {
    const url = buildLrsSearchResultUrl({
      keyword: "裝修工程",
      mode: "phrase",
    });
    expect(url).toContain("txtselectopt=3");
    expect(url).toContain("txtSearch=");
    expect(url).toContain("selDatabase=JU");
    expect(url).not.toContain("selDatabase=PD");
    expect(url).toContain("selallct=1");
  });

  it("builds parties search for company name", () => {
    const url = buildLrsPartiesSearchResultUrl("名富工程服務有限公司");
    expect(url).toContain("txtselectopt=7");
    expect(url).toContain("txtSearch=");
    expect(url).toContain("selDatabase=JU");
  });

  it("builds case number search for HCSA59/2014", () => {
    const url = buildLrsCaseNumberSearchResultUrl("HCSA 59/2014");
    expect(url).toContain("txtselectopt=4");
    expect(url).toContain("txtSearch=HCSA59%2F2014");
    expect(url).toContain("selDatabase=JU");
  });

  it("builds dual-field DCCJ + 裝修 JU search", () => {
    const url = buildLrsDualFieldSearchResultUrl({
      txtSearch: "DCCJ",
      txtSearch2: "裝修",
    });
    expect(url).toContain("txtSearch=DCCJ");
    expect(url).toContain("txtSearch2=");
    expect(url).toContain("selDatabase=JU");
  });

  it("omits selallct when courtLevel set", () => {
    const url = buildLrsSearchResultUrl({
      keyword: "裝修",
      courtLevel: "DC",
    });
    expect(url).toContain("selSchct=DC");
    expect(url).not.toContain("selallct=1");
  });
});
