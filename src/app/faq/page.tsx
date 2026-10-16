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
    "Renocheck 裝修點評：如何查裝修公司、風險參考分檔、快取、是否信貸報告等常見問題。",
});

const NAV_LINKS = [
  { href: "/", label: "返回搜尋" },
  { href: "/how-it-works", label: "點樣運作" },
  { href: "/legal/disclaimer", label: "免責聲明" },
] as const;

export default function FaqPage() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
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
        <ContentPageNav links={NAV_LINKS} />
      </ContentCard>
    </ContentPage>
  );
}
