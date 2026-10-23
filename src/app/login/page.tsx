import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import {
  ContentCard,
  ContentPage,
  ContentPageLead,
  ContentPageTitle,
} from "@/components/ContentPage";
import { SignInForm } from "@/components/SignInForm";
import {
  ACCOUNT_DELETE_CLOSED_ZH,
  LOGIN_LEAD_ZH,
  LOGIN_TITLE_ZH,
  LOGIN_UNAVAILABLE_ZH,
  QUOTE_BACK_TO_CHECKLIST_ZH,
} from "@/lib/quote-analysis/copy";
import { safeNextPath } from "@/lib/request-guards";
import { contentLinkClass } from "@/lib/ui-surfaces";
import { isQuoteAnalysisFlagOn } from "@/lib/quote-analysis/config";
import { isSupabaseAuthConfigured } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: LOGIN_TITLE_ZH,
  robots: { index: false, follow: false },
};

export const instant = false;

type PageProps = {
  searchParams: Promise<{ next?: string }>;
};

export default async function LoginPage({ searchParams }: PageProps) {
  await connection();
  const params = await searchParams;
  const nextPath = safeNextPath(params.next);
  const ready = isQuoteAnalysisFlagOn() && isSupabaseAuthConfigured();

  return (
    <ContentPage>
      <ContentCard>
        <ContentPageTitle>{LOGIN_TITLE_ZH}</ContentPageTitle>
        <ContentPageLead>{ready ? LOGIN_LEAD_ZH : LOGIN_UNAVAILABLE_ZH}</ContentPageLead>
        {ready ? (
          <SignInForm nextPath={nextPath} />
        ) : (
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            {ACCOUNT_DELETE_CLOSED_ZH.split("hello@renocheck.homes")[0]}
            <a href="mailto:hello@renocheck.homes" className={contentLinkClass}>
              hello@renocheck.homes
            </a>
            {ACCOUNT_DELETE_CLOSED_ZH.split("hello@renocheck.homes")[1]}
          </p>
        )}
        <p className="mt-6 text-sm">
          <Link href="/quote" className={`inline-flex min-h-11 items-center ${contentLinkClass}`}>
            {QUOTE_BACK_TO_CHECKLIST_ZH}
          </Link>
        </p>
      </ContentCard>
    </ContentPage>
  );
}
