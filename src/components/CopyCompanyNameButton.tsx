"use client";

import { useEffect, useRef, useState } from "react";
import {
  COPY_COMPANY_NAME_BUTTON_ZH,
  COPY_COMPANY_NAME_DONE_ZH,
} from "@/lib/report-trust-copy-zh";

export function CopyCompanyNameButton({
  text,
  className,
}: {
  text: string;
  className?: string;
}) {
  const [label, setLabel] = useState(COPY_COMPANY_NAME_BUTTON_ZH);
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
      className={
        className ??
        "text-sm text-primary underline-offset-2 hover:underline"
      }
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
      {label}
    </button>
  );
}
