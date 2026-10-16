import { getSiteUrl } from "./site-url";

export function breadcrumbJsonLd(items: { name: string; path: string }[]) {
  const base = getSiteUrl();
  return {
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: item.path === "/" ? `${base}/` : `${base}${item.path}`,
    })),
  };
}
