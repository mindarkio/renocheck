"use client";

import { ExternalLink } from "lucide-react";
import { useRef } from "react";
import {
  JUDICIARY_DCL_SEARCH_ACTION,
  buildDailyCauseListPostFields,
  hktDateDdmmyyyy,
} from "@/lib/judiciary-search-deep-links";
import {
  DAILY_CAUSE_LIST_FORM_NOTE_ZH,
  DAILY_CAUSE_LIST_LINK_LABEL_ZH,
} from "@/lib/report-trust-copy-zh";

export function DailyCauseListSearchForm({
  partyName,
  className,
}: {
  partyName: string;
  className?: string;
}) {
  const dateRef = useRef<HTMLInputElement>(null);
  const parties = buildDailyCauseListPostFields(partyName, new Date()).parties;

  return (
    <div>
      <form
        method="post"
        action={JUDICIARY_DCL_SEARCH_ACTION}
        target="_blank"
        rel="noopener noreferrer"
        className="inline"
        onSubmit={() => {
          if (dateRef.current) {
            dateRef.current.value = hktDateDdmmyyyy(new Date());
          }
        }}
      >
        <input type="hidden" name="lang" value="tc" />
        <input type="hidden" name="mode" value="search" />
        <input ref={dateRef} type="hidden" name="date" value="" />
        <input type="hidden" name="parties" value={parties} />
        <button
          type="submit"
          className={
            className ??
            "inline-flex items-center underline-offset-2 hover:underline"
          }
        >
          {DAILY_CAUSE_LIST_LINK_LABEL_ZH}
          <ExternalLink className="ms-1 inline size-3.5 opacity-80" aria-hidden />
          <span className="sr-only">（新分頁開啟）</span>
        </button>
      </form>
      <span className="mt-0.5 block text-[11px] leading-[1.6] text-primary-foreground/60 sm:text-xs">
        {DAILY_CAUSE_LIST_FORM_NOTE_ZH}
      </span>
    </div>
  );
}
