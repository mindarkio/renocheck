import type { Metadata } from "next";
import {
  ContentCard,
  ContentPage,
  ContentPageLead,
  ContentPageNav,
  ContentPageTitle,
} from "@/components/ContentPage";
import { JsonLd } from "@/components/JsonLd";
import { QuoteSelfCheck } from "@/components/QuoteSelfCheck";
import {
  QUOTE_PAGE_DESCRIPTION_ZH,
  QUOTE_PAGE_LEAD_ZH,
  QUOTE_PAGE_NAV,
  QUOTE_PAGE_TITLE_ZH,
  buildQuotePageJsonLd,
} from "@/lib/quote-selfcheck";
import { pageMetadata } from "@/lib/site-metadata";
import { getSiteUrl } from "@/lib/site-url";

export const metadata: Metadata = {
  ...pageMetadata({
    path: "/quote",
    title: QUOTE_PAGE_TITLE_ZH,
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
        <ContentPageLead>{QUOTE_PAGE_LEAD_ZH}</ContentPageLead>
        <QuoteSelfCheck />
        <ContentPageNav
          links={QUOTE_PAGE_NAV}
          linkClassName="inline-flex min-h-11 items-center"
        />
      </ContentCard>
    </ContentPage>
  );
}
