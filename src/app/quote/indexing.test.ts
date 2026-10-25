import { describe, expect, it } from "vitest";
import robots from "@/app/robots";
import { LLMS_TXT } from "@/lib/llms-txt";
import sitemap from "@/app/sitemap";
import { metadata } from "@/app/quote/page";
import {
  QUOTE_PAGE_DESCRIPTION_ZH,
  QUOTE_PAGE_META_TITLE_ZH,
  QUOTE_PAGE_TITLE_ZH,
} from "@/lib/quote-selfcheck";
import { getSiteUrl } from "@/lib/site-url";

describe("/quote indexing", () => {
  it("exports index, follow metadata with a canonical quote URL", () => {
    expect(QUOTE_PAGE_TITLE_ZH).toBe("報價自查清單");
    expect(QUOTE_PAGE_META_TITLE_ZH).toBe(
      "裝修報價單自查清單｜報價陷阱 20 項逐項對",
    );
    expect(metadata.title).toBe(QUOTE_PAGE_META_TITLE_ZH);
    expect(metadata.description).toBe(QUOTE_PAGE_DESCRIPTION_ZH);
    expect(metadata.description).toContain("報價單");
    expect(metadata.description).toContain("報價陷阱");
    const ogTitle =
      metadata.openGraph && "title" in metadata.openGraph
        ? metadata.openGraph.title
        : undefined;
    const twitterTitle =
      metadata.twitter && "title" in metadata.twitter
        ? metadata.twitter.title
        : undefined;
    expect(ogTitle).toBe(`${QUOTE_PAGE_META_TITLE_ZH} · Renocheck`);
    expect(twitterTitle).toBe(`${QUOTE_PAGE_META_TITLE_ZH} · Renocheck`);
    expect(metadata.alternates).toEqual({ canonical: "/quote" });
    expect(metadata.robots).toEqual({ index: true, follow: true });
    expect(metadata.description).not.toMatch(/報價審核|人工智能|\bAI\b/);
  });

  it("lists /quote in the sitemap and does not disallow it", () => {
    const entry = sitemap().find((item) => item.url === `${getSiteUrl()}/quote`);
    expect(entry?.lastModified).toBe("2026-10-23");
    expect(entry?.url.endsWith("/quote")).toBe(true);

    const rules = robots().rules;
    const list = Array.isArray(rules) ? rules : [rules];
    const allow = list.flatMap((rule) =>
      rule.allow == null ? [] : Array.isArray(rule.allow) ? rule.allow : [rule.allow],
    );
    const disallow = list.flatMap((rule) =>
      rule.disallow == null
        ? []
        : Array.isArray(rule.disallow)
          ? rule.disallow
          : [rule.disallow],
    );
    expect(allow).toContain("/");
    expect(disallow).not.toContain("/quote");
    expect(disallow).not.toContain("/quote/");
  });

  it("describes /quote in llms.txt without claiming automated analysis", () => {
    const text = LLMS_TXT;
    expect(text).toContain(
      "- /quote — quotation self-check list (missing or vague items only; does not judge price)",
    );
    const quoteLine = text.split("\n").find((line) => line.startsWith("- /quote"));
    expect(quoteLine).toBeDefined();
    expect(quoteLine).not.toMatch(/AI|人工智能|報價審核|quote review/i);
  });
});