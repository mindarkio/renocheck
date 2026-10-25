import { describe, expect, it } from "vitest";
import sitemap from "@/app/sitemap";
import { FAQ_ITEMS } from "@/lib/faq-content";
import { LLMS_TXT } from "@/lib/llms-txt";
import { HOME_DESCRIPTION } from "@/lib/site-metadata";
import { buildSiteJsonLd } from "@/lib/site-jsonld";

const SITE = "https://renocheck.homes";

describe("site JSON-LD disambiguation", () => {
  const graph = buildSiteJsonLd(SITE)["@graph"];
  const website = graph.find((node) => node["@type"] === "WebSite");
  const organization = graph.find((node) => node["@type"] === "Organization");
  const webApp = graph.find((node) => node["@type"] === "WebApplication");
  const alternateNames = [
    "裝修點評",
    "Renocheck 香港",
    "Renocheck 裝修點評",
    "renocheck.homes",
  ];

  it("marks the organization as Hong Kong and distinct from renocheck.co.uk", () => {
    expect(organization?.areaServed.name).toBe("Hong Kong");
    expect(organization?.disambiguatingDescription).toBe(
      "Hong Kong-only (zh-HK) public-record risk-reference search for renovation contractors. Not affiliated with renocheck.co.uk (UK). No expert consultation or cost estimates.",
    );
    expect(webApp?.inLanguage).toBe("zh-HK");
    expect(webApp?.areaServed.name).toBe("Hong Kong");
    expect(HOME_DESCRIPTION.endsWith("只服務香港。")).toBe(true);
  });

  it("adds Hong Kong alternate names on Organization and WebSite without sameAs", () => {
    expect(website?.alternateName).toEqual(alternateNames);
    expect(organization?.alternateName).toEqual(alternateNames);
    expect(website).not.toHaveProperty("sameAs");
    expect(organization).not.toHaveProperty("sameAs");
    expect(webApp).not.toHaveProperty("sameAs");
  });
});

describe("FAQ service-area item", () => {
  it("places the approved disambiguation question second", () => {
    expect(FAQ_ITEMS[1]?.question).toBe(
      "Renocheck 係邊度嘅服務？同 renocheck.co.uk 有冇關係？",
    );
    expect(FAQ_ITEMS[1]?.answer).toBe(
      "Renocheck（裝修點評，renocheck.homes）只服務香港，提供香港裝修承辦商的公開資料風險參考搜尋。我們不提供專家諮詢、裝修估價或代搵師傅服務。英國的 renocheck.co.uk 是另一間公司，與本網站無任何關係。",
    );
  });
});

describe("sitemap content dates", () => {
  it("sets lastModified on the home, about, and faq pages to the copy change date", () => {
    const dates = new Map(
      sitemap().map((entry) => {
        const pathname = new URL(entry.url).pathname;
        return [pathname === "" ? "/" : pathname, entry.lastModified] as const;
      }),
    );
    expect(dates.get("/")).toBe("2026-10-22");
    expect(dates.get("/about")).toBe("2026-10-22");
    expect(dates.get("/faq")).toBe("2026-10-22");
  });
});

describe("llms.txt disambiguation", () => {
  it("names renocheck.co.uk in the service-area section", () => {
    const text = LLMS_TXT;
    expect(text).toContain("renocheck.co.uk");
    expect(text).toContain(
      "## Service area & disambiguation\n\nRenocheck (renocheck.homes) serves Hong Kong only, in Traditional Chinese (zh-HK). It does not offer expert consultation, renovation cost estimates, or builder matching. It is not affiliated with RenoCheck (renocheck.co.uk), a separate UK company.",
    );
    expect(text).not.toContain("報價審核");
    expect(text).not.toMatch(/quote review/i);
  });
});

describe("site JSON-LD node ids", () => {
  it("gives every node a unique @id and links to existing nodes", () => {
    const graph = buildSiteJsonLd(SITE)["@graph"];
    const ids = graph.map((node) => node["@id"]);
    expect(ids).toEqual([`${SITE}/#website`, `${SITE}/#org`, `${SITE}/#webapp`]);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
