"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { brandSectionTitleClass } from "@/lib/ui-surfaces";
import { sendUsageEvent } from "@/lib/usage-events-client";
import {
  QUOTE_CHECK_ITEMS,
  QUOTE_CHECKLIST_HEADING_ZH,
  QUOTE_CLEAR_BUTTON_ZH,
  QUOTE_CLEAR_HEADING_ZH,
  QUOTE_CLEARED_STATUS_ZH,
  QUOTE_CONDITIONAL_NOTE_ZH,
  QUOTE_COPIED_STATUS_ZH,
  QUOTE_COPY_BUTTON_ZH,
  QUOTE_COPY_FAILED_STATUS_ZH,
  QUOTE_REPLY_EMPTY_ZH,
  QUOTE_REPLY_HEADING_ZH,
  QUOTE_REPLY_NOTE_ZH,
  QUOTE_STATUS_OPTIONS,
  QUOTE_VAGUE_HEADING_ZH,
  buildQuoteReplyMessage,
  clearQuoteCheckSelections,
  getQuoteCheckSelectionsServerSnapshot,
  getQuoteCheckSelectionsSnapshot,
  quoteCheckProgressLabel,
  subscribeQuoteCheckSelections,
  updateQuoteCheckSelection,
  type QuoteCheckItemId,
  type QuoteCheckStatus,
} from "@/lib/quote-selfcheck";

const focusRingClass =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background";

const optionClass = (checked: boolean) =>
  `flex min-h-11 min-w-0 cursor-pointer items-center gap-1.5 break-words rounded-lg border px-2 text-sm text-foreground min-[360px]:gap-2 min-[360px]:px-2.5 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-primary has-[:focus-visible]:ring-offset-2 has-[:focus-visible]:ring-offset-background ${
    checked
      ? "border-primary bg-primary/5 font-medium"
      : "border-border bg-background"
  }`;

type QuoteNotice = "idle" | "copied" | "failed" | "cleared";

const NOTICE_TEXT: Record<QuoteNotice, string> = {
  idle: "",
  copied: QUOTE_COPIED_STATUS_ZH,
  failed: QUOTE_COPY_FAILED_STATUS_ZH,
  cleared: QUOTE_CLEARED_STATUS_ZH,
};

/** Fallback for browsers without async clipboard: copies the textarea's plain text. */
function copyBySelection(field: HTMLTextAreaElement | null): boolean {
  if (!field) return false;
  const previous = document.activeElement;
  field.focus();
  field.select();
  let ok = false;
  try {
    ok = typeof document.execCommand === "function" && document.execCommand("copy");
  } catch {
    ok = false;
  }
  // Keep the text selected on failure so the user can copy it by hand.
  if (ok && previous instanceof HTMLElement) previous.focus();
  return ok;
}

export function QuoteSelfCheck() {
  const selections = useSyncExternalStore(
    subscribeQuoteCheckSelections,
    getQuoteCheckSelectionsSnapshot,
    getQuoteCheckSelectionsServerSnapshot,
  );
  const [notice, setNotice] = useState<QuoteNotice>("idle");
  const replyRef = useRef<HTMLTextAreaElement>(null);
  const checklistHeadingRef = useRef<HTMLHeadingElement>(null);
  const pageSent = useRef(false);
  const message = buildQuoteReplyMessage(selections);
  const selectedCount = QUOTE_CHECK_ITEMS.filter((item) => selections[item.id]).length;

  useEffect(() => {
    if (pageSent.current) return;
    pageSent.current = true;
    sendUsageEvent("quote_page");
  }, []);

  function choose(id: QuoteCheckItemId, status: QuoteCheckStatus) {
    setNotice("idle");
    // Count only the click that completes the list. Restoring a finished list
    // on load, or a change from another tab, is not a new completion.
    const wasComplete = selectedCount === QUOTE_CHECK_ITEMS.length;
    const nowComplete = QUOTE_CHECK_ITEMS.every(
      (item) => item.id === id || Boolean(selections[item.id]),
    );
    updateQuoteCheckSelection(id, status);
    if (!wasComplete && nowComplete) sendUsageEvent("quote_all_ticked");
  }

  async function copyMessage() {
    if (!message) return;
    sendUsageEvent("quote_copy_reply");
    setNotice("idle");
    try {
      if (!navigator.clipboard?.writeText) throw new Error("clipboard unavailable");
      await navigator.clipboard.writeText(message);
      setNotice("copied");
    } catch {
      setNotice(copyBySelection(replyRef.current) ? "copied" : "failed");
    }
  }

  return (
    <div className="mt-6 min-w-0">
      <section aria-labelledby="quote-checklist-heading">
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
          <h2
            id="quote-checklist-heading"
            ref={checklistHeadingRef}
            tabIndex={-1}
            className={`${brandSectionTitleClass} focus:outline-none`}
          >
            {QUOTE_CHECKLIST_HEADING_ZH}
          </h2>
          <p className="text-sm text-muted-foreground">
            {quoteCheckProgressLabel(selectedCount)}
          </p>
        </div>
        {selectedCount > 0 ? (
          <button
            type="button"
            className={`mt-2 inline-flex min-h-11 items-center rounded-sm text-sm text-foreground underline-offset-2 hover:underline ${focusRingClass}`}
            onClick={() => {
              clearQuoteCheckSelections();
              setNotice("cleared");
              // The button unmounts once nothing is selected; keep focus in the checklist.
              checklistHeadingRef.current?.focus();
            }}
          >
            {QUOTE_CLEAR_BUTTON_ZH}
          </button>
        ) : null}
        <ol className="mt-4 min-w-0 space-y-5">
          {QUOTE_CHECK_ITEMS.map((item, index) => {
            const selected = selections[item.id];
            return (
              <li key={item.id} className="min-w-0 border-b border-border/60 pb-5">
                <fieldset className="min-w-0 border-0 p-0">
                  <legend className="w-full p-0">
                    <span className="text-sm font-semibold text-primary">
                      {index + 1}. {item.label}
                    </span>
                    {item.conditional ? (
                      <span className="mt-1 block text-sm text-muted-foreground">
                        {QUOTE_CONDITIONAL_NOTE_ZH}
                      </span>
                    ) : null}
                  </legend>
                  <p className="mt-2 break-words text-sm leading-[1.7] text-foreground">
                    <span className="font-medium">{QUOTE_CLEAR_HEADING_ZH}</span>
                    {" "}
                    {item.clearExample}
                  </p>
                  <p className="mt-1 break-words text-sm leading-[1.7] text-muted-foreground">
                    <span className="font-medium text-foreground">
                      {QUOTE_VAGUE_HEADING_ZH}
                    </span>
                    {" "}
                    {item.vagueExample}
                  </p>
                  <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                    {QUOTE_STATUS_OPTIONS.map((option) => {
                      const checked = selected === option.id;
                      return (
                        <label key={option.id} className={optionClass(checked)}>
                          <input
                            type="radio"
                            name={`quote-check-${item.id}`}
                            value={option.id}
                            checked={checked}
                            onChange={() => choose(item.id, option.id)}
                            className="size-4 shrink-0 accent-primary focus-visible:outline-none"
                          />
                          <span>
                            <span aria-hidden="true">{option.mark} </span>
                            {option.label}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </fieldset>
              </li>
            );
          })}
        </ol>
      </section>

      <section className="mt-6 min-w-0" aria-labelledby="quote-reply-heading">
        <h2 id="quote-reply-heading" className={brandSectionTitleClass}>
          {QUOTE_REPLY_HEADING_ZH}
        </h2>
        {message ? (
          <>
            <textarea
              ref={replyRef}
              readOnly
              value={message}
              rows={10}
              aria-label={QUOTE_REPLY_HEADING_ZH}
              className="mt-3 w-full min-w-0 resize-y rounded-lg border border-border bg-background px-3 py-3 text-sm leading-relaxed text-foreground"
            />
            <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <button
                type="button"
                className={`inline-flex min-h-11 w-full items-center justify-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground hover:opacity-90 sm:w-auto ${focusRingClass}`}
                onClick={() => {
                  void copyMessage();
                }}
              >
                {QUOTE_COPY_BUTTON_ZH}
              </button>
              <p className="text-sm text-muted-foreground">{QUOTE_REPLY_NOTE_ZH}</p>
            </div>
          </>
        ) : (
          <p className="mt-2 text-sm leading-[1.7] text-muted-foreground">
            {QUOTE_REPLY_EMPTY_ZH}
          </p>
        )}
        {/* Always mounted so the first message is announced; visible for sighted users too. */}
        <p
          role="status"
          className={`mt-2 min-h-5 text-sm ${notice === "failed" ? "text-foreground" : "text-muted-foreground"}`}
        >
          {NOTICE_TEXT[notice]}
        </p>
      </section>
    </div>
  );
}
