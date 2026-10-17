import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  lrsRowToCandidateFields,
  parseLrsSearchResultHtml,
  parseLrsSearchResultMeta,
} from "./parse-lrs-search-html";

const FIXTURE = resolve(
  process.cwd(),
  "scripts/fixtures/lrs-search-result-sample.html",
);

describe("parseLrsSearchResultHtml", () => {
  const html = readFileSync(FIXTURE, "utf8");

  it("parses result meta", () => {
    expect(parseLrsSearchResultMeta(html)).toEqual({
      resultCount: 2,
      totalPages: 1,
    });
  });

  it("parses judgment rows and skips rows without judgment date", () => {
    const rows = parseLrsSearchResultHtml(html);
    expect(rows).toHaveLength(1);
    expect(rows[0].caseRef).toBe("HCSA 64/2017");
    expect(rows[0].eventDate).toBe("2017-06-01");
    expect(rows[0].partiesLine).toContain("示例裝修");
    expect(rows[0].database).toBe("Judgments");
    expect(rows[0].neutralCitation).toBe("[2017] HKSC 100");
  });

  it("builds judgment detail URL from DIS query", () => {
    const rows = parseLrsSearchResultHtml(html);
    const candidate = lrsRowToCandidateFields(rows[0], {
      lrsListingUrl: "https://legalref.judiciary.hk/lrs/common/search/search_result.jsp?test=1",
      profileId: "phrase-裝修工程",
      tier: "A",
      fetchedAt: "2026-10-16T12:00:00.000Z",
    });
    expect(candidate.judgmentUrl).toContain("search_result_detail_frame.jsp?DIS=100001");
  });
});
