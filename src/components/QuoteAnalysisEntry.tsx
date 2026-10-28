"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { focusRingClass } from "@/lib/focus-ring";
import { QUOTE_ANALYSIS_ENTRY_ZH } from "@/lib/quote-analysis/copy";

/** Hidden unless the server says quote upload is available. /quote stays indexable either way. */
export function QuoteAnalysisEntry() {
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/quote/availability")
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { enabled?: boolean } | null) => {
        if (!cancelled && data?.enabled === true) setEnabled(true);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  if (!enabled) return null;

  return (
    <p className="mt-6 text-sm">
      <Link
        href="/quote/upload"
        className={`inline-flex min-h-11 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground ${focusRingClass}`}
      >
        {QUOTE_ANALYSIS_ENTRY_ZH}
      </Link>
    </p>
  );
}
