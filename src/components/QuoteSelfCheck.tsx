"use client";

import { useState, useSyncExternalStore } from "react";
import { brandSectionTitleClass } from "@/lib/ui-surfaces";
import {
  QUOTE_CHECK_ITEMS,
  QUOTE_CHECKLIST_HEADING_ZH,
  QUOTE_CLEAR_BUTTON_ZH,
  QUOTE_CLEAR_HEADING_ZH,
  QUOTE_CONDITIONAL_NOTE_ZH,
  QUOTE_COPIED_STATUS_ZH,
  QUOTE_COPY_BUTTON_ZH,
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

const optionClass = (checked: boolean) =>
  `flex min-h-11 min-w-0 cursor-pointer items-center gap-2 break-words rounded-lg border px-2.5 text-sm text-foreground has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-primary/40 ${
    checked
      ? "border-primary bg-primary/5 font-medium"
      : "border-border bg-background"
  }`;

export function QuoteSelfCheck() {
  const selections = useSyncExternalStore(
    subscribeQuoteCheckSelections,
    getQuoteCheckSelectionsSnapshot,
    getQuoteCheckSelectionsServerSnapshot,
  );
  const [copied, setCopied] = useState(false);

  const message = buildQuoteReplyMessage(selections);
  const selectedCount = QUOTE_CHECK_ITEMS.filter((item) => selections[item.id]).length;

  function choose(id: QuoteCheckItemId, status: QuoteCheckStatus) {
    setCopied(false);
    updateQuoteCheckSelection(id, status);
  }

  async function copyMessage() {
    if (!message || !navigator.clipboard?.writeText) return;
    try {
      setCopied(false);
      await navigator.clipboard.writeText(message);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="mt-6 min-w-0">
      <section aria-labelledby="quote-checklist-heading">
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
          <h2 id="quote-checklist-heading" className={brandSectionTitleClass}>
            {QUOTE_CHECKLIST_HEADING_ZH}
          </h2>
          <p className="text-sm text-muted-foreground">
            {quoteCheckProgressLabel(selectedCount)}
          </p>
        </div>
        {selectedCount > 0 ? (
          <button
            type="button"
            className="mt-2 inline-flex min-h-11 items-center text-sm text-foreground underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
            onClick={() => {
              setCopied(false);
              clearQuoteCheckSelections();
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
              readOnly
              value={message}
              rows={10}
              aria-label={QUOTE_REPLY_HEADING_ZH}
              className="mt-3 w-full min-w-0 resize-y rounded-lg border border-border bg-background px-3 py-3 text-sm leading-relaxed text-foreground"
            />
            <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <button
                type="button"
                className="inline-flex min-h-11 w-full items-center justify-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 sm:w-auto"
                onClick={() => {
                  void copyMessage();
                }}
              >
                {QUOTE_COPY_BUTTON_ZH}
              </button>
              <p className="text-sm text-muted-foreground">{QUOTE_REPLY_NOTE_ZH}</p>
            </div>
            <p className="sr-only" role="status">
              {copied ? QUOTE_COPIED_STATUS_ZH : ""}
            </p>
          </>
        ) : (
          <p className="mt-2 text-sm leading-[1.7] text-muted-foreground">
            {QUOTE_REPLY_EMPTY_ZH}
          </p>
        )}
      </section>
    </div>
  );
}
