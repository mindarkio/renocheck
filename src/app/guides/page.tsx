import type { Metadata } from "next";
import Link from "next/link";
import {
  ContentCard,
  ContentPage,
  ContentPageLead,
  ContentPageNav,
  ContentPageTitle,
} from "@/components/ContentPage";
import { GuideDisclaimer } from "@/components/GuideDisclaimer";
import { JsonLd } from "@/components/JsonLd";
import { breadcrumbJsonLd } from "@/lib/breadcrumb-jsonld";
import { GUIDES } from "@/lib/guides";
import { pageMetadata } from "@/lib/site-metadata";
import { getSiteUrl } from "@/lib/site-url";
import { brandSectionTitleClass } from "@/lib/ui-surfaces";

export const metadata: Metadata = pageMetadata({
  path: "/guides",
  title: "業主裝修指南",
  description:
    "香港業主裝修實用指南：點樣查裝修公司牌照、小型工程級別、裝修合約清單、報價點睇、商業登記查冊，以及裝修爛尾追討步驟。",
});

const NAV_LINKS = [
  { href: "/", label: "查裝修公司" },
  { href: "/how-it-works", label: "點樣運作" },
  { href: "/faq", label: "常見問題" },
] as const;

export default function GuidesIndexPage() {
  const base = getSiteUrl();
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "CollectionPage",
        name: "業主裝修指南",
        url: `${base}/guides`,
        inLanguage: "zh-HK",
        hasPart: GUIDES.map((g) => ({
          "@type": "Article",
          headline: g.title,
          url: `${base}/guides/${g.slug}`,
        })),
      },
      breadcrumbJsonLd([
        { name: "首頁", path: "/" },
        { name: "業主裝修指南", path: "/guides" },
      ]),
    ],
  };

  return (
    <ContentPage>
      <JsonLd data={jsonLd} />
      <ContentCard>
        <ContentPageTitle>業主裝修指南</ContentPageTitle>
        <ContentPageLead>
          委聘裝修公司前後最常遇到嘅問題，整理自屋宇署、消委會、司法機構等官方資料。
        </ContentPageLead>
        <ul className="mt-6 divide-y divide-border/60">
          {GUIDES.map((g) => (
            <li key={g.slug} className="py-4 first:pt-0 last:pb-0">
              <h2 className={brandSectionTitleClass}>
                <Link href={`/guides/${g.slug}`} className="hover:underline">
                  {g.title}
                </Link>
              </h2>
              <p className="mt-1 text-sm leading-[1.7] text-muted-foreground">
                {g.description}
              </p>
            </li>
          ))}
        </ul>
        <GuideDisclaimer />
        <ContentPageNav links={NAV_LINKS} />
      </ContentCard>
    </ContentPage>
  );
}
