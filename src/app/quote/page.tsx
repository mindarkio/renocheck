import type { Metadata } from "next";
import {
  ContentCard,
  ContentPage,
  ContentPageLead,
  ContentPageNav,
  ContentPageTitle,
} from "@/components/ContentPage";
import { JsonLd } from "@/components/JsonLd";
import { QuoteGuideArticle } from "@/components/QuoteGuideArticle";
import {
  QUOTE_GUIDE_DATE,
  QUOTE_PAGE_DESCRIPTION_ZH,
  QUOTE_PAGE_LEAD_ZH,
  QUOTE_PAGE_META_TITLE_ZH,
  QUOTE_PAGE_NAV,
  QUOTE_PAGE_TITLE_ZH,
  buildQuotePageJsonLd,
} from "@/lib/quote-selfcheck";
import { pageMetadata } from "@/lib/site-metadata";
import { getSiteUrl } from "@/lib/site-url";

export const metadata: Metadata = {
  ...pageMetadata({
    path: "/quote",
    title: QUOTE_PAGE_META_TITLE_ZH,
    description: QUOTE_PAGE_DESCRIPTION_ZH,
  }),
  robots: { index: true, follow: true },
};

export default function QuotePage() {
  return (
    <ContentPage>
      <JsonLd data={buildQuotePageJsonLd(getSiteUrl())} />
      <ContentCard>
        <ContentPageTitle>{QUOTE_PAGE_TITLE_ZH}</ContentPageTitle>
        <p className="mt-2 text-xs text-muted-foreground">
          更新日期：<time dateTime={QUOTE_GUIDE_DATE}>{QUOTE_GUIDE_DATE}</time>
        </p>
        <ContentPageLead>{QUOTE_PAGE_LEAD_ZH}</ContentPageLead>
        <QuoteGuideArticle />
        <ContentPageNav
          links={QUOTE_PAGE_NAV}
          linkClassName="inline-flex min-h-11 items-center"
        />
      </ContentCard>
    </ContentPage>
  );
}
