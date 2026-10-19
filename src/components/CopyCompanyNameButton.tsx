"use client";

import { Check, Copy } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import {
  COPY_COMPANY_NAME_BUTTON_ZH,
  COPY_COMPANY_NAME_DONE_ZH,
} from "@/lib/report-trust-copy-zh";

const defaultButtonClass =
  "inline-flex items-center gap-1.5 rounded-md border border-primary/30 bg-primary/5 px-3 py-1.5 text-sm font-medium text-primary transition-colors hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40";

export function CopyCompanyNameButton({
  text,
  className,
}: {
  text: string;
  className?: string;
}) {
  const [label, setLabel] = useState(COPY_COMPANY_NAME_BUTTON_ZH);
  const done = label === COPY_COMPANY_NAME_DONE_ZH;
  const resetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (resetTimer.current) clearTimeout(resetTimer.current);
    };
  }, []);

  return (
    <button
      type="button"
      aria-label={COPY_COMPANY_NAME_BUTTON_ZH}
      className={className ?? defaultButtonClass}
      onClick={async () => {
        try {
          if (!navigator.clipboard?.writeText) return;
          await navigator.clipboard.writeText(text);
          setLabel(COPY_COMPANY_NAME_DONE_ZH);
          if (resetTimer.current) clearTimeout(resetTimer.current);
          resetTimer.current = setTimeout(() => {
            setLabel(COPY_COMPANY_NAME_BUTTON_ZH);
          }, 2000);
        } catch {
          // keep default label
        }
      }}
    >
      {done ? (
        <Check className="size-3.5 shrink-0" aria-hidden />
      ) : (
        <Copy className="size-3.5 shrink-0" aria-hidden />
      )}
      {label}
    </button>
  );
}
