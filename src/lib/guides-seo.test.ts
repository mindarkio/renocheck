import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import sitemap from "@/app/sitemap";
import { GUIDES, getGuide, guideFaqJsonLd, type Guide } from "@/lib/guides";
import { getSiteUrl } from "@/lib/site-url";

const NEW_GUIDES = [
  {
    slug: "renovation-contract-clauses-hong-kong",
    title: "裝修合約範本同條款注意事項（香港）",
  },
  {
    slug: "renovation-quote-timing-compare-three",
    title: "裝修報價要幾耐？點樣比較 3 份報價",
  },
  {
    slug: "renovation-warning-signs-without-blacklist",
    title: "點樣分辨裝修黑店（唔靠黑名單）",
  },
] as const;

const OFFICIAL_HOSTS = new Set([
  "www.bd.gov.hk",
  "www.consumer.org.hk",
  "www.judiciary.hk",
  "www.info.gov.hk",
  "btp.etax.ird.gov.hk",
  "www.cr.gov.hk",
  "www.ird.gov.hk",
  "www.labour.gov.hk",
]);

function guideCorpus(guide: Guide): string {
  return [
    guide.title,
    guide.description,
    guide.answer,
    ...guide.sections.flatMap((section) => [
      section.heading,
      ...(section.paragraphs ?? []),
      ...(section.bullets ?? []),
    ]),
    ...(guide.faqs ?? []).flatMap((item) => [item.question, item.answer]),
  ].join("\n");
}

describe("2026-10-23 SEO guides", () => {
  const guides = NEW_GUIDES.map((item) => {
    const guide = getGuide(item.slug);
    expect(guide, item.slug).toBeDefined();
    return guide as Guide;
  });

  it("uses the approved titles and links to /quote and search", () => {
    for (const [index, guide] of guides.entries()) {
      expect(guide.title).toBe(NEW_GUIDES[index]?.title);
      expect(guide.datePublished).toBe("2026-10-23");
      expect(guide.dateModified).toBe("2026-10-23");
      const corpus = guideCorpus(guide);
      expect(corpus).toContain("](/quote)");
      expect(corpus).toContain("](/)");
      expect(corpus).not.toMatch(/報價審核|專家諮詢|renocheck\.co\.uk|唔提供報價|不提供報價/);
      expect(corpus).not.toMatch(/\d+\s*%|港幣|HK\$|\$\d/);
      expect(corpus).not.toMatch(/https?:\/\/(?!www\.|btp\.)/);
    }
  });

  it("cites only https official hosts and emits FAQ JSON-LD from the visible Q&A", () => {
    for (const guide of guides) {
      expect(guide.faqs?.length).toBeGreaterThanOrEqual(2);
      for (const source of guide.sources) {
        const url = new URL(source.url);
        expect(url.protocol).toBe("https:");
        expect(OFFICIAL_HOSTS.has(url.hostname)).toBe(true);
      }
      expect(guideFaqJsonLd(guide)).toEqual({
        "@type": "FAQPage",
        inLanguage: "zh-HK",
        mainEntity: guide.faqs?.map((item) => ({
          "@type": "Question",
          name: item.question,
          acceptedAnswer: { "@type": "Answer", text: item.answer },
        })),
      });
    }
    for (const guide of GUIDES) {
      if (!NEW_GUIDES.some((item) => item.slug === guide.slug)) {
        expect(guide.faqs).toBeUndefined();
        expect(guideFaqJsonLd(guide)).toBeNull();
      }
    }
  });

  it("lists the guides in the sitemap and llms.txt without a blacklist site", () => {
    const entries = sitemap();
    for (const item of NEW_GUIDES) {
      const entry = entries.find(
        (row) => row.url === `${getSiteUrl()}/guides/${item.slug}`,
      );
      expect(entry?.lastModified).toBe("2026-10-23");
    }
    const text = readFileSync(path.join(process.cwd(), "public/llms.txt"), "utf8");
    for (const item of NEW_GUIDES) {
      expect(text).toContain(
        `https://renocheck.homes/guides/${item.slug} — ${item.title}`,
      );
    }
    const corpus = guides.map(guideCorpus).join("\n");
    expect(corpus).not.toMatch(/黑店網|blacklist\.|名富|陳師傅/);
    expect(text).not.toMatch(/黑店網|blacklist\./i);
  });

  it("has no duplicate sitemap or llms.txt URLs and /guides is never older than a guide", () => {
    const entries = sitemap();
    const urls = entries.map((row) => row.url);
    expect(new Set(urls).size).toBe(urls.length);
    const hub = entries.find((row) => row.url === `${getSiteUrl()}/guides`);
    const newest = GUIDES.map((g) => g.dateModified).sort().at(-1) ?? "";
    expect(String(hub?.lastModified) >= newest).toBe(true);
    const text = readFileSync(path.join(process.cwd(), "public/llms.txt"), "utf8");
    const llmsUrls = text
      .split("\n")
      .filter((line) => line.startsWith("- https://"))
      .map((line) => line.split(" ")[1]);
    expect(new Set(llmsUrls).size).toBe(llmsUrls.length);
  });
});
