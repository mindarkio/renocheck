import { describe, expect, it } from "vitest";
import robots from "@/app/robots";
import { SITE_DISAMBIGUATION_LINE } from "@/lib/constants";
import { LLMS_TXT } from "@/lib/llms-txt";
import { RISK_BAND_METER_LEVELS } from "@/lib/risk-band-display";
import { CACHE_TTL_MS } from "@/lib/search-cache";
import { config as proxyConfig } from "@/proxy";
import { GET } from "./route";

function ruleList(value: string | string[] | undefined): string[] {
  if (value == null) return [];
  return Array.isArray(value) ? value : [value];
}

describe("/llms.txt", () => {
  it("returns 200 text/plain with the Hong Kong scope and the UK denial", async () => {
    const response = GET();
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toMatch(/^text\/plain\b/);
    expect(response.headers.get("cache-control")).toBe("public, max-age=86400");

    const text = await response.text();
    expect(text).toBe(LLMS_TXT);
    expect(text).toContain(SITE_DISAMBIGUATION_LINE);
    expect(text).toContain("Hong Kong-only");
    expect(text).toContain("zh-HK");
    expect(text).toContain("MWC");
    expect(text).toContain("Reports summarise publicly available information");
    expect(text).not.toMatch(/public-record summaries|verified official/i);
    expect(text).toContain("Not user-generated reviews or a forum.");
    expect(text).toContain("Not a credit report");
    expect(text).toContain("Not a contractor matching");
    expect(text).toContain("Not legal advice");
    expect(text).toContain("Not a renovation cost estimator");
    expect(text).toContain("Not an expert consultation service");
    expect(text).toContain("Not a UK service. This website is not renocheck.co.uk.");
    expect(text).toContain("https://renocheck.homes/");
    expect(text).toContain("- /about — about the project");
    expect(text).toContain("- /how-it-works — methodology");
    expect(text).not.toMatch(/https?:\/\/(www\.)?renocheck\.co\.uk/i);
    expect(text).not.toContain("報價審核");
    expect(text).not.toMatch(/quote review/i);
    expect(text).not.toMatch(/\/quote\/(upload|analyses)|\bPDF\b/i);
  });

  it("pins the approved zh-HK line (change only with owner sign-off)", () => {
    expect(SITE_DISAMBIGUATION_LINE).toBe(
      "Renocheck 裝修點評係香港獨立網站，同英國 renocheck.co.uk 無關。",
    );
  });

  it("matches the code: cache TTL and risk band labels", () => {
    const days = CACHE_TTL_MS / (24 * 60 * 60 * 1000);
    expect(LLMS_TXT).toContain(`about **${days} days**`);
    const bandLine = LLMS_TXT.split("\n").find((line) =>
      line.startsWith("Reports use Traditional Chinese risk reference bands"),
    );
    let from = 0;
    for (const band of RISK_BAND_METER_LEVELS) {
      const at = bandLine?.indexOf(band, from) ?? -1;
      expect(at, band).toBeGreaterThanOrEqual(from);
      from = at + band.length;
    }
  });

  it("is not caught by the proxy matcher", () => {
    for (const pattern of proxyConfig.matcher) {
      expect("/llms.txt".startsWith(pattern.split("/:")[0])).toBe(false);
    }
  });

  it("is allowed by robots.txt", () => {
    const rules = robots().rules;
    const list = Array.isArray(rules) ? rules : [rules];
    const allow = list.flatMap((rule) => ruleList(rule.allow));
    const disallow = list.flatMap((rule) => ruleList(rule.disallow));
    expect(allow.some((rule) => "/llms.txt".startsWith(rule))).toBe(true);
    expect(disallow.some((rule) => "/llms.txt".startsWith(rule))).toBe(false);
  });
});
