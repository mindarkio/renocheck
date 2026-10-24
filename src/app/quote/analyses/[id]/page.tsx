import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import {
  ContentCard,
  ContentPage,
  ContentPageLead,
  ContentPageTitle,
} from "@/components/ContentPage";
import { QUOTE_STATUS_OPTIONS } from "@/lib/quote-selfcheck";
import { isQuoteAnalysisFlagOn } from "@/lib/quote-analysis/config";
import {
  QUOTE_BACK_TO_CHECKLIST_ZH,
  QUOTE_RESULT_LEAD_ZH,
  QUOTE_RESULT_MISSING_ZH,
  QUOTE_RESULT_ROBOTS,
  QUOTE_RESULT_TITLE_ZH,
  QUOTE_UNAVAILABLE_ZH,
} from "@/lib/quote-analysis/copy";
import {
  quoteFindingText,
  quoteItemLabel,
  type StoredQuoteItem,
} from "@/lib/quote-analysis/schema";
import { contentLinkClass } from "@/lib/ui-surfaces";
import {
  createSupabaseServerClient,
  getAuthUser,
} from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: QUOTE_RESULT_TITLE_ZH,
  robots: QUOTE_RESULT_ROBOTS,
};

export const instant = false;

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const STATUSES = new Set(["clear", "vague", "missing", "na"]);

function readItems(value: unknown): StoredQuoteItem[] | null {
  if (!Array.isArray(value)) return null;
  const items: StoredQuoteItem[] = [];
  for (const row of value) {
    if (!row || typeof row !== "object") return null;
    const record = row as { id?: unknown; status?: unknown };
    if (typeof record.id !== "string" || typeof record.status !== "string") return null;
    if (!STATUSES.has(record.status)) return null;
    items.push({
      id: record.id,
      status: record.status as StoredQuoteItem["status"],
    });
  }
  return items;
}

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function QuoteAnalysisResultPage({ params }: PageProps) {
  await connection();
  if (!isQuoteAnalysisFlagOn()) {
    return (
      <ContentPage>
        <ContentCard>
          <ContentPageTitle>{QUOTE_RESULT_TITLE_ZH}</ContentPageTitle>
          <ContentPageLead>{QUOTE_UNAVAILABLE_ZH}</ContentPageLead>
          <p className="mt-6 text-sm">
            <Link href="/quote" className={`inline-flex min-h-11 items-center ${contentLinkClass}`}>
              {QUOTE_BACK_TO_CHECKLIST_ZH}
            </Link>
          </p>
        </ContentCard>
      </ContentPage>
    );
  }
  const { id: rawId } = await params;
  const id = rawId.toLowerCase();
  const user = UUID_RE.test(id) ? await getAuthUser() : null;
  const supabase = user ? await createSupabaseServerClient() : null;
  const loaded = supabase
    ? await supabase
        .from("quote_analyses")
        .select("items")
        .eq("id", id)
        .maybeSingle()
    : { data: null };
  const items = loaded.data ? readItems(loaded.data.items) : null;
  const mark = new Map(QUOTE_STATUS_OPTIONS.map((option) => [option.id, option.mark]));

  return (
    <ContentPage>
      <ContentCard>
        <ContentPageTitle>{QUOTE_RESULT_TITLE_ZH}</ContentPageTitle>
        {items ? (
          <>
            <ContentPageLead>{QUOTE_RESULT_LEAD_ZH}</ContentPageLead>
            <ol className="mt-6 space-y-4">
              {items.map((item) => (
                <li key={item.id} className="text-sm leading-relaxed">
                  <p className="font-medium text-foreground">
                    <span aria-hidden="true">{mark.get(item.status) ?? "—"} </span>
                    {quoteItemLabel(item.id)}
                  </p>
                  <p className="mt-1 text-muted-foreground">{quoteFindingText(item)}</p>
                </li>
              ))}
            </ol>
          </>
        ) : (
          <ContentPageLead>{QUOTE_RESULT_MISSING_ZH}</ContentPageLead>
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
