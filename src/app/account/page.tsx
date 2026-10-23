import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { AccountActions } from "@/components/AccountActions";
import {
  ContentCard,
  ContentPage,
  ContentPageLead,
  ContentPageTitle,
} from "@/components/ContentPage";
import {
  ACCOUNT_DELETE_BODY_ZH,
  ACCOUNT_DELETE_HEADING_ZH,
  ACCOUNT_EMAIL_LABEL_ZH,
  ACCOUNT_SIGNED_OUT_PROMPT_ZH,
  ACCOUNT_SIGN_IN_LINK_ZH,
  ACCOUNT_TITLE_ZH,
} from "@/lib/quote-analysis/copy";
import { contentLinkClass } from "@/lib/ui-surfaces";
import { getAuthUser } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: ACCOUNT_TITLE_ZH,
  robots: { index: false, follow: false },
};

export const instant = false;

export default async function AccountPage() {
  await connection();
  const user = await getAuthUser();

  return (
    <ContentPage>
      <ContentCard>
        <ContentPageTitle>{ACCOUNT_TITLE_ZH}</ContentPageTitle>
        {user ? (
          <>
            <ContentPageLead>
              {ACCOUNT_EMAIL_LABEL_ZH}：{user.email ?? "—"}
            </ContentPageLead>
            <h2 className="mt-8 text-sm font-semibold text-primary">
              {ACCOUNT_DELETE_HEADING_ZH}
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              {ACCOUNT_DELETE_BODY_ZH}
            </p>
            <AccountActions />
          </>
        ) : (
          <>
            <ContentPageLead>{ACCOUNT_SIGNED_OUT_PROMPT_ZH}</ContentPageLead>
            <p className="mt-4 text-sm">
              <Link
                href="/login?next=/account"
                className={`inline-flex min-h-11 items-center ${contentLinkClass}`}
              >
                {ACCOUNT_SIGN_IN_LINK_ZH}
              </Link>
            </p>
          </>
        )}
      </ContentCard>
    </ContentPage>
  );
}
