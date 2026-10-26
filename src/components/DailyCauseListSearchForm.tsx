"use client";

import { ExternalLink } from "lucide-react";
import { useRef, useSyncExternalStore } from "react";
import {
  JUDICIARY_DCL_SEARCH_ACTION,
  dailyCauseListPartyQuery,
  hktDateDdmmyyyy,
} from "@/lib/judiciary-search-deep-links";
import {
  DAILY_CAUSE_LIST_FORM_NOTE_ZH,
  DAILY_CAUSE_LIST_LINK_LABEL_ZH,
  JUDICIARY_DAILY_CAUSE_LIST_URL,
} from "@/lib/report-trust-copy-zh";
import { safeHttpUrl } from "@/lib/safe-http-url";

const noopSubscribe = () => () => {};

const DEFAULT_BUTTON_CLASS =
  "inline-flex cursor-pointer items-center underline-offset-2 hover:underline";

export function DailyCauseListSearchForm({
  partyName,
  className,
  noteClassName,
}: {
  partyName: string;
  className?: string;
  noteClassName?: string;
}) {
  const dateRef = useRef<HTMLInputElement>(null);
  // false during SSR / before hydration, so the button cannot post an empty date.
  const ready = useSyncExternalStore(noopSubscribe, () => true, () => false);
  const parties = dailyCauseListPartyQuery(partyName);
  const listHref = safeHttpUrl(JUDICIARY_DAILY_CAUSE_LIST_URL);

  if (parties === null) {
    if (!listHref) {
      return (
        <span className={className ?? DEFAULT_BUTTON_CLASS}>
          {DAILY_CAUSE_LIST_LINK_LABEL_ZH}
        </span>
      );
    }
    return (
      <a
        href={listHref}
        target="_blank"
        rel="noopener noreferrer"
        className={className ?? DEFAULT_BUTTON_CLASS}
      >
        {DAILY_CAUSE_LIST_LINK_LABEL_ZH}
        <ExternalLink className="ms-1 inline size-3.5 opacity-80" aria-hidden />
        <span className="sr-only">（新分頁開啟）</span>
      </a>
    );
  }

  return (
    <div>
      <form
        method="post"
        action={JUDICIARY_DCL_SEARCH_ACTION}
        target="_blank"
        rel="noopener noreferrer"
        className="inline"
        onSubmit={(e) => {
          if (!dateRef.current) {
            e.preventDefault();
            return;
          }
          dateRef.current.value = hktDateDdmmyyyy(new Date());
        }}
      >
        <input type="hidden" name="lang" value="tc" />
        <input type="hidden" name="mode" value="search" />
        <input ref={dateRef} type="hidden" name="date" value="" />
        <input
          type="hidden"
          name="parties"
          value={Array.from(parties).slice(0, 200).join("")}
        />
        <button
          type="submit"
          disabled={!ready}
          className={className ?? DEFAULT_BUTTON_CLASS}
        >
          {DAILY_CAUSE_LIST_LINK_LABEL_ZH}
          <ExternalLink className="ms-1 inline size-3.5 opacity-80" aria-hidden />
          <span className="sr-only">（新分頁開啟）</span>
        </button>
      </form>
      <span
        className={`mt-0.5 block text-xs leading-[1.6] sm:text-sm ${noteClassName ?? "text-primary-foreground/80"}`}
      >
        {DAILY_CAUSE_LIST_FORM_NOTE_ZH}
      </span>
    </div>
  );
}
