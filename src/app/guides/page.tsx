import type { Metadata } from "next";
import Link from "next/link";
import { BookOpen, CalendarDays } from "lucide-react";
import {
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
import { surfaceCardClass } from "@/lib/ui-surfaces";

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
    <main className="flex min-h-0 flex-1 flex-col px-4 pb-12 pt-5 sm:px-6 sm:pb-16 sm:pt-7">
      <JsonLd data={jsonLd} />
      <div className="mx-auto w-full max-w-5xl">
        <header className="mx-auto max-w-[584px] text-center sm:mb-2">
          <ContentPageTitle>業主裝修指南</ContentPageTitle>
          <ContentPageLead>
            委聘裝修公司前後最常遇到嘅問題，整理自屋宇署、消委會、司法機構等官方資料。
          </ContentPageLead>
        </header>
        <ul className="mt-6 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3">
          {GUIDES.map((g) => (
            <li key={g.slug} className="min-w-0">
              <Link
                href={`/guides/${g.slug}`}
                className={`${surfaceCardClass} group flex h-full flex-col overflow-hidden transition-shadow hover:shadow-[0_2px_14px_rgba(32,33,36,0.12)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40`}
              >
                <div className="bg-primary px-3 py-3 text-primary-foreground sm:px-5 sm:py-4">
                  <span className="inline-flex max-w-full items-center gap-1 truncate rounded-full border border-primary-foreground/25 bg-primary-foreground/12 px-2 py-0.5 text-[10px] font-medium sm:px-2.5 sm:text-[11px]">
                    <BookOpen className="size-3 shrink-0" aria-hidden />
                    {g.category}
                  </span>
                  <h2 className="mt-2 line-clamp-3 break-words text-[13px] font-semibold leading-snug sm:text-base">
                    {g.title}
                  </h2>
                </div>
                <div className="flex flex-1 flex-col px-3 py-3 sm:px-5 sm:py-4">
                  <p className="line-clamp-3 text-xs leading-[1.65] text-foreground/80 sm:line-clamp-4 sm:text-sm">
                    {g.description}
                  </p>
                  <p className="mt-auto flex items-center gap-1 pt-3 text-[11px] text-muted-foreground sm:text-xs">
                    <CalendarDays className="size-3 shrink-0" aria-hidden />
                    <time dateTime={g.dateModified}>{g.dateModified}</time>
                  </p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
        <div className="mx-auto mt-8 max-w-[584px]">
          <GuideDisclaimer />
          <ContentPageNav links={NAV_LINKS} />
        </div>
      </div>
    </main>
  );
}
