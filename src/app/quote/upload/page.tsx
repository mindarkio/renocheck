import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import {
  ContentCard,
  ContentPage,
  ContentPageLead,
  ContentPageTitle,
} from "@/components/ContentPage";
import { QuoteAnalysisForm } from "@/components/QuoteAnalysisForm";
import { isQuoteAnalysisAvailable } from "@/lib/quote-analysis/config";
import {
  QUOTE_ACCOUNT_LINK_ZH,
  QUOTE_GUIDE_LINK_ZH,
  QUOTE_UNAVAILABLE_ZH,
  QUOTE_UPLOAD_LEAD_ZH,
  QUOTE_UPLOAD_TITLE_ZH,
} from "@/lib/quote-analysis/copy";
import { contentLinkClass } from "@/lib/ui-surfaces";
import { getAuthUser } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: QUOTE_UPLOAD_TITLE_ZH,
  robots: { index: false, follow: false },
};

export const instant = false;

export default async function QuoteUploadPage() {
  await connection();
  const available = isQuoteAnalysisAvailable();
  const user = available ? await getAuthUser() : null;

  return (
    <ContentPage>
      <ContentCard>
        <ContentPageTitle>{QUOTE_UPLOAD_TITLE_ZH}</ContentPageTitle>
        {available ? (
          <>
            <ContentPageLead>{QUOTE_UPLOAD_LEAD_ZH}</ContentPageLead>
            {user ? (
              <p className="mt-4 text-sm">
                <Link
                  href="/account"
                  className={`inline-flex min-h-11 items-center ${contentLinkClass}`}
                >
                  {QUOTE_ACCOUNT_LINK_ZH}
                </Link>
              </p>
            ) : null}
            <QuoteAnalysisForm signedIn={Boolean(user)} />
          </>
        ) : (
          <ContentPageLead>{QUOTE_UNAVAILABLE_ZH}</ContentPageLead>
        )}
        <p className="mt-6 text-sm">
          <Link href="/quote" className={`inline-flex min-h-11 items-center ${contentLinkClass}`}>
            {QUOTE_GUIDE_LINK_ZH}
          </Link>
        </p>
      </ContentCard>
    </ContentPage>
  );
}
