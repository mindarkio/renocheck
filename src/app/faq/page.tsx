import type { Metadata } from "next";
import { pageMetadata } from "@/lib/site-metadata";
import {
  ContentCard,
  ContentPage,
  ContentPageNav,
  ContentPageTitle,
} from "@/components/ContentPage";
import { JsonLd } from "@/components/JsonLd";
import { FAQ_ITEMS } from "@/lib/faq-content";
import { brandSectionTitleClass } from "@/lib/ui-surfaces";

export const metadata: Metadata = pageMetadata({
  path: "/faq",
  title: "常見問題",
  description:
    "香港業主裝修常見問題：點查裝修公司牌照、小型工程級別、裝修爛尾追討、小額錢債上限、合約與報價，以及 Renocheck 風險參考點運作。",
});

const NAV_LINKS = [
  { href: "/", label: "返回搜尋" },
  { href: "/quote", label: "報價自查清單" },
  { href: "/guides", label: "裝修指南" },
  { href: "/how-it-works", label: "點樣運作" },
  { href: "/legal/disclaimer", label: "免責聲明" },
] as const;

export default function FaqPage() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    inLanguage: "zh-HK",
    mainEntity: FAQ_ITEMS.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: item.answer,
      },
    })),
  };

  return (
    <ContentPage>
      <JsonLd data={jsonLd} />
      <ContentCard>
        <ContentPageTitle>常見問題</ContentPageTitle>
        <dl className="mt-6 divide-y divide-border/60">
          {FAQ_ITEMS.map((item) => (
            <div key={item.question} className="py-4 first:pt-0 last:pb-0">
              <dt className={brandSectionTitleClass}>
                {item.question}
              </dt>
              <dd className="mt-2 text-sm leading-[1.7] text-muted-foreground">
                {item.answer}
              </dd>
            </div>
          ))}
        </dl>
        <ContentPageNav
          links={NAV_LINKS}
          linkClassName="inline-flex min-h-11 items-center"
        />
      </ContentCard>
    </ContentPage>
  );
}
