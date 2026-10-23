import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { GUIDES, relatedGuides } from "@/lib/guides";
import GuidePage from "./page";

const STATIC_ROUTES = new Set([
  "/",
  "/about",
  "/faq",
  "/guides",
  "/how-it-works",
  "/legal/disclaimer",
  "/quote",
]);

function text(fragment: string): string {
  return fragment
    .replace(/<[^>]+>/g, "")
    .replace(/&quot;/g, '"')
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

describe("guide page render", () => {
  for (const guide of GUIDES) {
    it(`${guide.slug}: inline links resolve and FAQ JSON-LD equals visible Q&A`, async () => {
      const html = renderToStaticMarkup(
        await GuidePage({ params: Promise.resolve({ slug: guide.slug }) }),
      );
      expect(html).not.toMatch(/\]\(\//);
      for (const [, href] of html.matchAll(/<a [^>]*href="(\/[^"#]*)"/g)) {
        const ok =
          STATIC_ROUTES.has(href ?? "") ||
          GUIDES.some((g) => href === `/guides/${g.slug}`);
        expect(ok, href).toBe(true);
      }
      for (const m of guide.answer.matchAll(/\]\((\/[^)\s]*)\)/g)) {
        expect(html).toContain(`href="${m[1]}"`);
      }
      const graph = [
        ...html.matchAll(/<script type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g),
      ].flatMap(([, raw]) => {
        const data = JSON.parse(raw ?? "{}") as { "@graph"?: Array<Record<string, unknown>> };
        return data["@graph"] ?? [data];
      });
      const faq = graph.find((node) => node["@type"] === "FAQPage") as
        | { mainEntity: Array<{ name: string; acceptedAnswer: { text: string } }> }
        | undefined;
      const relatedHtml = html.split("相關指南").at(-1) ?? "";
      const relatedHrefs = [...relatedHtml.matchAll(/href="(\/guides\/[^"]+)"/g)].map(
        ([, href]) => href,
      );
      expect(relatedHrefs).toEqual(
        relatedGuides(guide.slug).map((item) => `/guides/${item.slug}`),
      );
      expect(relatedHrefs).not.toContain(`/guides/${guide.slug}`);
      const dts = [...html.matchAll(/<dt[^>]*>([\s\S]*?)<\/dt>/g)].map(([, v]) => text(v ?? ""));
      const dds = [...html.matchAll(/<dd[^>]*>([\s\S]*?)<\/dd>/g)].map(([, v]) => text(v ?? ""));
      if (!guide.faqs?.length) {
        expect(faq).toBeUndefined();
        expect(dts).toHaveLength(0);
        return;
      }
      expect(faq?.mainEntity.map((q) => [q.name, q.acceptedAnswer.text])).toEqual(
        dts.map((q, i) => [q, dds[i]]),
      );
      expect(dts).toEqual(guide.faqs.map((item) => item.question));
    });
  }
});
