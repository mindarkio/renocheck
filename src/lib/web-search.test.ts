import { afterEach, describe, expect, it, vi } from "vitest";
import {
  buildEntitySearchQueries,
  buildPhoneAnchorQuery,
  buildWebSearchQuery,
  buildWebSearchQueryLoose,
  countPlannedSerpRequests,
  fetchWebSearchHitsForEntity,
  planEntityWebSearches,
  serpRequestBudget,
} from "./web-search";

describe("buildWebSearchQuery", () => {
  it("includes threads sites in Q1", () => {
    const q = buildWebSearchQuery({ companyName: "測試公司" });
    expect(q).toContain("threads.net");
    expect(q).toContain("threads.com");
  });
  it("uses MWC company name when search is phone-only", () => {
    const q = buildWebSearchQuery(
      { phone: "91234567" },
      { mwcCompanyName: "雅達居裝修傢俬工程公司" },
    );
    expect(q).toContain("雅達居裝修傢俬工程公司");
    expect(q).not.toContain("91234567");
  });

  it("prefers MWC company name when registered (DEC-0004)", () => {
    const q = buildWebSearchQuery(
      { companyName: "用戶輸入名" },
      { mwcCompanyName: "名冊名" },
    );
    expect(q).toContain("名冊名");
    expect(q).not.toContain("用戶輸入名");
  });
});

describe("buildPhoneAnchorQuery", () => {
  it("quotes phone and avoids banned Serp terms", () => {
    const q = buildPhoneAnchorQuery("92805455");
    expect(q).toContain('"92805455"');
    expect(q).toContain("裝修");
    expect(q).not.toContain("黑店");
  });
});

describe("buildEntitySearchQueries", () => {
  it("returns Q1 and loose Q2 (production)", () => {
    const [q1, q2] = buildEntitySearchQueries({ companyName: "甲公司" });
    expect(q1).toContain("site:lihkg.com");
    expect(q1).toContain('"甲公司"');
    expect(q2).not.toContain("site:lihkg.com");
    expect(q2).not.toMatch(/^"甲公司"/);
    expect(q2).toContain("甲公司");
  });

  it("Q1 uses halfwidth 創建21 phrase for MWC fullwidth name", () => {
    const q1 = buildWebSearchQuery(
      { companyName: "創建 2 1 顧問有限公司" },
      { mwcCompanyName: "創建２１顧問有限公司" },
    );
    expect(q1).toContain('"創建21顧問有限公司"');
    expect(q1).not.toContain("２１");
  });

  it("loose Q2 uses brand phrase for 源始 (forum copy omits 有限公司)", () => {
    const q2 = buildEntitySearchQueries({
      companyName: "源始（國際）設計及裝修有限公司",
    })[1];
    expect(q2).toContain("源始（國際）設計及裝修公司");
    expect(q2).not.toContain('"源始" "國際"');
  });
});

describe("typed brand and register English name queries", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  const branded = {
    companyName: "齊來設計",
  };
  const mwc = {
    mwcCompanyName: "齊來設計居+屋有限公司",
    mwcCompanyNameEn: "Dimensions Interiors Limited",
  };

  it("quotes '+', '&', '/', and parentheses and adds one alias query inside the budget", () => {
    const q1 = buildWebSearchQuery(branded, mwc);
    const q2 = buildWebSearchQueryLoose(branded, mwc);
    expect(q1).toContain('"齊來設計居+屋有限公司"');
    expect(q2).toContain('"齊來設計居+屋"');
    expect(q2).not.toMatch(/[^"]齊來設計居\+屋[^"]/);

    expect(buildWebSearchQueryLoose({ companyName: "A & B 工程有限公司" })).toContain(
      '"A & B 工程"',
    );
    expect(buildWebSearchQueryLoose({ companyName: "甲/乙工程有限公司" })).toContain(
      '"甲/乙工程"',
    );
    expect(buildWebSearchQueryLoose({ companyName: "測試(香港)工程有限公司" })).toContain(
      '"測試(香港)工程"',
    );

    const baseline = planEntityWebSearches({ companyName: "甲公司" });
    const planned = planEntityWebSearches(branded, mwc);
    expect(baseline.find((step) => step.id === "q1")?.pages).toBe(2);
    expect(planned.map((step) => step.id)).toEqual(["q1", "q2", "alias"]);
    expect(planned.find((step) => step.id === "q1")?.pages).toBe(1);
    expect(countPlannedSerpRequests(baseline)).toBe(serpRequestBudget(false));
    expect(countPlannedSerpRequests(planned)).toBe(serpRequestBudget(false));
    expect(countPlannedSerpRequests(baseline)).toBe(3);
    expect(countPlannedSerpRequests(planned)).toBe(3);
    const alias = planned.find((step) => step.id === "alias")?.query ?? "";
    expect(alias).toContain('"齊來設計"');
    expect(alias).toContain('"Dimensions Interiors Limited"');
    expect(alias).toContain("OR");

    const withPhone = planEntityWebSearches(
      { companyName: "齊來設計", phone: "91234567" },
      mwc,
    );
    expect(countPlannedSerpRequests(withPhone)).toBe(serpRequestBudget(true));
    expect(countPlannedSerpRequests(withPhone)).toBe(4);
    expect(withPhone.map((step) => step.id)).toEqual(["q1", "q2", "alias", "q3"]);
  });

  it("does not add a query for a generic typed fragment", () => {
    const planned = planEntityWebSearches(
      { companyName: "設計" },
      { mwcCompanyName: "齊來設計居+屋有限公司" },
    );
    expect(planned.map((step) => step.id)).toEqual(["q1", "q2"]);
    expect(planned.some((step) => step.query.includes('"設計"'))).toBe(false);
    expect(planned.find((step) => step.id === "q1")?.pages).toBe(2);
  });

  it("folds the alias into Q2 when there is no spare Serp page", () => {
    vi.stubEnv("SERP_PAGE_COUNT", "1");
    const planned = planEntityWebSearches(branded, mwc);
    expect(planned.map((step) => step.id)).toEqual(["q1", "q2"]);
    expect(countPlannedSerpRequests(planned)).toBe(serpRequestBudget(false));
    expect(planned.find((step) => step.id === "q2")?.query).toContain('"齊來設計"');
    expect(planned.find((step) => step.id === "q2")?.query).toContain(
      '"Dimensions Interiors Limited"',
    );
  });

  it("issues the same number of provider calls with or without the alias", async () => {
    vi.stubEnv("SERPER_API_KEY", "test-key-not-real");
    vi.stubEnv("SERP_PROVIDER", "serper");
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ organic: [] }), { status: 200 }),
    );
    vi.stubGlobal("fetch", fetchMock);
    vi.spyOn(console, "info").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});

    await fetchWebSearchHitsForEntity({ companyName: "甲公司" });
    const baselineCalls = fetchMock.mock.calls.length;
    fetchMock.mockClear();
    await fetchWebSearchHitsForEntity(branded, mwc);
    expect(fetchMock.mock.calls.length).toBe(baselineCalls);
    expect(baselineCalls).toBe(3);

    const queries = fetchMock.mock.calls.map((call) => {
      const url = String(call[0]);
      expect(url).not.toContain("renocheck.homes");
      expect(url).toContain("google.serper.dev");
      const init = call[1] as RequestInit;
      return JSON.parse(String(init.body)).q as string;
    });
    expect(queries.some((q) => q.includes('"齊來設計"'))).toBe(true);
    expect(queries.some((q) => q.includes('"齊來設計居+屋"'))).toBe(true);
    expect(queries.some((q) => q.includes('"Dimensions Interiors Limited"'))).toBe(true);
  });
});

