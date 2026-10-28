"use client";

import Link from "next/link";
import { useEffect } from "react";
import { focusRingClass, focusRingOnPrimaryClass } from "@/lib/focus-ring";
import {
  LANDING_CHOICE_HEADING_ZH,
  LANDING_QUOTE_ACTION_ZH,
  LANDING_QUOTE_BODY_ZH,
  LANDING_QUOTE_TITLE_ZH,
  LANDING_QUOTE_UNAVAILABLE_ZH,
  LANDING_SEARCH_ACTION_ZH,
  LANDING_SEARCH_BODY_ZH,
  LANDING_SEARCH_TITLE_ZH,
} from "@/lib/quote-analysis/copy";

const cardClass =
  "flex min-h-44 w-full flex-col justify-between rounded-2xl p-5 text-left sm:min-h-52 sm:p-6";

export function FocusCompanySearchOnHash() {
  useEffect(() => {
    const focus = () => {
      if (window.location.hash !== "#company-search") return;
      document.getElementById("search-query")?.focus();
    };
    focus();
    window.addEventListener("hashchange", focus);
    return () => window.removeEventListener("hashchange", focus);
  }, []);
  return null;
}

function focusCompanySearch(event: React.MouseEvent<HTMLAnchorElement>) {
  const input = document.getElementById("search-query");
  if (!input) return;
  event.preventDefault();
  if (typeof input.scrollIntoView === "function") {
    input.scrollIntoView({ block: "center" });
  }
  input.focus();
  if (window.location.hash !== "#company-search") {
    history.pushState(null, "", "/#company-search");
  }
}

export function LandingChoices({ quoteOpen }: { quoteOpen: boolean }) {
  return (
    <section className="mb-8 w-full" aria-labelledby="landing-choice-heading">
      <h2
        id="landing-choice-heading"
        className="text-center text-lg font-semibold text-primary sm:text-xl"
      >
        {LANDING_CHOICE_HEADING_ZH}
      </h2>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        {quoteOpen ? (
          <Link
            href="/quote/upload"
            className={`${cardClass} bg-primary text-primary-foreground ${focusRingOnPrimaryClass}`}
          >
            <span>
              <span className="block text-base font-semibold sm:text-lg">
                {LANDING_QUOTE_TITLE_ZH}
              </span>
              <span className="mt-2 block text-sm leading-relaxed text-primary-foreground/90">
                {LANDING_QUOTE_BODY_ZH}
              </span>
            </span>
            <span className="mt-4 inline-flex min-h-11 items-center text-sm font-medium">
              {LANDING_QUOTE_ACTION_ZH}
            </span>
          </Link>
        ) : (
          <button
            type="button"
            disabled
            className={`${cardClass} cursor-not-allowed border border-border bg-muted text-muted-foreground`}
          >
            <span>
              <span className="block text-base font-semibold text-foreground sm:text-lg">
                {LANDING_QUOTE_TITLE_ZH}
              </span>
              <span className="mt-2 block text-sm leading-relaxed">
                {LANDING_QUOTE_UNAVAILABLE_ZH}
              </span>
            </span>
          </button>
        )}
        <Link
          href="/#company-search"
          onClick={focusCompanySearch}
          className={`${cardClass} border border-border bg-background text-foreground ${focusRingClass}`}
        >
          <span>
            <span className="block text-base font-semibold text-primary sm:text-lg">
              {LANDING_SEARCH_TITLE_ZH}
            </span>
            <span className="mt-2 block text-sm leading-relaxed text-muted-foreground">
              {LANDING_SEARCH_BODY_ZH}
            </span>
          </span>
          <span className="mt-4 inline-flex min-h-11 items-center text-sm font-medium text-primary">
            {LANDING_SEARCH_ACTION_ZH}
          </span>
        </Link>
      </div>
    </section>
  );
}
