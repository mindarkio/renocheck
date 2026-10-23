import { describe, expect, it } from "vitest";
import { metadata } from "@/app/quote/analyses/[id]/page";
import { metadata as quoteMetadata } from "@/app/quote/page";
import robots from "@/app/robots";
import sitemap from "@/app/sitemap";
import { QUOTE_RESULT_ROBOTS } from "@/lib/quote-analysis/copy";

describe("quote result indexing", () => {
  it("marks result pages noindex and leaves /quote indexable", () => {
    expect(metadata.robots).toEqual(QUOTE_RESULT_ROBOTS);
    expect(metadata.robots).toEqual({ index: false, follow: false });
    expect(quoteMetadata.robots).toEqual({ index: true, follow: true });

    const rules = robots().rules;
    const list = Array.isArray(rules) ? rules : [rules];
    const disallow = list.flatMap((rule) =>
      rule.disallow == null
        ? []
        : Array.isArray(rule.disallow)
          ? rule.disallow
          : [rule.disallow],
    );
    expect(disallow).toContain("/quote/analyses");
    expect(disallow).not.toContain("/quote");

    const urls = sitemap().map((entry) => entry.url);
    expect(urls.some((url) => url.includes("/quote/analyses"))).toBe(false);
    expect(urls.some((url) => url.endsWith("/quote"))).toBe(true);
  });
});
