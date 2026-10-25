import { describe, expect, it } from "vitest";
import robots from "@/app/robots";
import { SITE_DISAMBIGUATION_LINE } from "@/lib/constants";
import { LLMS_TXT } from "@/lib/llms-txt";
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

    const text = await response.text();
    expect(text).toBe(LLMS_TXT);
    expect(text).toContain(SITE_DISAMBIGUATION_LINE);
    expect(text).toContain("Hong Kong-only");
    expect(text).toContain("zh-HK");
    expect(text).toContain("MWC");
    expect(text).toContain("public-record summaries");
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
