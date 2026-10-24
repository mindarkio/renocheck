"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { QUOTE_ANALYSIS_ENTRY_ZH } from "@/lib/quote-analysis/copy";
import { contentLinkClass } from "@/lib/ui-surfaces";

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
      <Link href="/quote/upload" className={`inline-flex min-h-11 items-center ${contentLinkClass}`}>
        {QUOTE_ANALYSIS_ENTRY_ZH}
      </Link>
    </p>
  );
}
