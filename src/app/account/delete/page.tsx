import type { Metadata } from "next";
import { redirect } from "next/navigation";
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
} from "@/lib/quote-analysis/copy";
import { getAuthUser } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: ACCOUNT_DELETE_HEADING_ZH,
  robots: { index: false, follow: false },
};

export const instant = false;

export default async function DeleteAccountPage() {
  await connection();
  const user = await getAuthUser();
  if (!user) redirect("/login?next=/account/delete");

  return (
    <ContentPage>
      <ContentCard>
        <ContentPageTitle>{ACCOUNT_DELETE_HEADING_ZH}</ContentPageTitle>
        <ContentPageLead>{ACCOUNT_DELETE_BODY_ZH}</ContentPageLead>
        <AccountActions part="danger" />
      </ContentCard>
    </ContentPage>
  );
}
