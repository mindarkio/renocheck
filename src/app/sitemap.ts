import type { MetadataRoute } from "next";
import { GUIDES } from "@/lib/guides";
import { getSiteUrl } from "@/lib/site-url";

/** Bump the date when a page's content materially changes. */
const STATIC_PAGES: ReadonlyArray<{ path: string; lastModified: string }> = [
  { path: "/", lastModified: "2026-10-22" },
  { path: "/about", lastModified: "2026-10-22" },
  { path: "/faq", lastModified: "2026-10-22" },
  { path: "/quote", lastModified: "2026-10-22" },
  { path: "/how-it-works", lastModified: "2026-10-16" },
  { path: "/legal/disclaimer", lastModified: "2026-10-22" },
  { path: "/guides", lastModified: "2026-10-23" },
  ...GUIDES.map((g) => ({ path: `/guides/${g.slug}`, lastModified: g.dateModified })),
];

export default function sitemap(): MetadataRoute.Sitemap {
  const base = getSiteUrl();
  return STATIC_PAGES.map(({ path, lastModified }) => ({
    url: path === "/" ? `${base}/` : `${base}${path}`,
    lastModified,
    changeFrequency: path === "/" ? "weekly" : "monthly",
    priority: path === "/" ? 1 : 0.7,
  }));
}
