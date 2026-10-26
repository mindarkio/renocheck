"use client";

import { useEffect, useRef, useState } from "react";
import type { PublicMwcCandidate } from "@/lib/register-candidate-gate";
import {
  EXACT_ROW_TAG_ZH,
  PICKER_ACTION_ZH,
  PICKER_BACK_ZH,
  PICKER_GROUP_LABEL_ZH,
  PICKER_HEADING_ZH,
  PICKER_HINT_ZH,
  REGISTER_ERROR_ZH,
  REGISTER_RETRY_ZH,
  TOO_MANY_BACK_ZH,
  TOO_MANY_HEADING_ZH,
  candidateRadioLabelZh,
  pickerBodyZh,
  tooManyBodyZh,
} from "@/lib/search-disambiguation-copy";

const panelClass =
  "mt-4 rounded-xl border border-border bg-background p-4 text-left shadow-sm";

type RegisterMatchPanelProps = {
  input: string;
  mode: "picker" | "too_many" | "register_error";
  candidates?: PublicMwcCandidate[];
  onPick: (registrationNo: string) => void;
  onBack: () => void;
  onRetry: () => void;
};

export function RegisterMatchPanel({
  input,
  mode,
  candidates = [],
  onPick,
  onBack,
  onRetry,
}: RegisterMatchPanelProps) {
  const [selected, setSelected] = useState<string | null>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);

  // The search box is disabled while the register loads, so focus would drop
  // to <body>. Move it to the panel heading so keyboard and screen-reader
  // users land on the result.
  useEffect(() => {
    headingRef.current?.focus();
  }, [mode]);

  if (mode === "register_error") {
    return (
      <div role="status" className={`${panelClass} border-warning/30 bg-warning-foreground`}>
        <p className="text-sm text-warning">{REGISTER_ERROR_ZH}</p>
        <button
          type="button"
          onClick={onRetry}
          className="mt-3 min-h-11 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
        >
          {REGISTER_RETRY_ZH}
        </button>
      </div>
    );
  }

  if (mode === "too_many") {
    return (
      <section className={panelClass} aria-labelledby="register-too-many-heading">
        <h2
          id="register-too-many-heading"
          ref={headingRef}
          tabIndex={-1}
          className="text-base font-semibold text-foreground"
        >
          {TOO_MANY_HEADING_ZH}
        </h2>
        <p role="status" className="mt-2 text-sm leading-relaxed text-foreground/90">
          {tooManyBodyZh(input)}
        </p>
        <button
          type="button"
          onClick={onBack}
          className="mt-3 min-h-11 rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted"
        >
          {TOO_MANY_BACK_ZH}
        </button>
      </section>
    );
  }

  return (
    <section className={panelClass} aria-labelledby="register-picker-heading">
      <h2
        id="register-picker-heading"
        ref={headingRef}
        tabIndex={-1}
        className="text-base font-semibold text-foreground"
      >
        {PICKER_HEADING_ZH}
      </h2>
      <p className="mt-2 text-sm leading-relaxed text-foreground/90">{pickerBodyZh(input)}</p>
      <div role="radiogroup" aria-label={PICKER_GROUP_LABEL_ZH} className="mt-3">
        {candidates.map((row) => {
          const radioLabel = row.exact
            ? `${candidateRadioLabelZh(row)}，${EXACT_ROW_TAG_ZH}`
            : candidateRadioLabelZh(row);
          return (
            <label
              key={row.registrationNo}
              className="flex min-h-11 cursor-pointer items-start gap-3 border-b border-border/70 py-2.5 last:border-b-0"
            >
              <input
                type="radio"
                name="register-candidate"
                value={row.registrationNo}
                checked={selected === row.registrationNo}
                onChange={() => setSelected(row.registrationNo)}
                onKeyDown={(event) => {
                  // Enter inside the form would submit it and rerun the
                  // register check. Treat it as 查呢間 for the focused row.
                  if (event.key !== "Enter") return;
                  event.preventDefault();
                  setSelected(row.registrationNo);
                  onPick(row.registrationNo);
                }}
                aria-label={radioLabel}
                className="mt-1 size-4 shrink-0 accent-primary"
              />
              <span className="min-w-0">
                <span className="block text-sm font-medium text-foreground">{row.companyName}</span>
                {row.companyNameEn ? (
                  <span className="mt-0.5 block text-sm text-muted-foreground">
                    {row.companyNameEn}
                  </span>
                ) : null}
                <span className="mt-0.5 block text-sm text-muted-foreground">
                  註冊編號 {row.registrationNo}
                </span>
                {row.exact ? (
                  <span className="mt-1 inline-block rounded-full bg-muted px-2 py-0.5 text-xs text-foreground">
                    {EXACT_ROW_TAG_ZH}
                  </span>
                ) : null}
              </span>
            </label>
          );
        })}
      </div>
      <p className="mt-3 text-xs leading-relaxed text-muted-foreground">{PICKER_HINT_ZH}</p>
      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        <button
          type="button"
          disabled={selected == null}
          onClick={() => {
            if (selected) onPick(selected);
          }}
          className="min-h-11 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-60"
        >
          {PICKER_ACTION_ZH}
        </button>
        <button
          type="button"
          onClick={onBack}
          className="min-h-11 rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted"
        >
          {PICKER_BACK_ZH}
        </button>
      </div>
    </section>
  );
}
