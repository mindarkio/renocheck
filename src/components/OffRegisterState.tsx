import { Info } from "lucide-react";
import Link from "next/link";
import { focusRingClass } from "@/lib/focus-ring";
import {
  offRegisterCrLeadZh,
  shouldShowOffRegisterState,
} from "@/lib/off-register-report";
import type { RiskReport } from "@/lib/report-schema";
import {
  BD_EXEMPTED_WORKS_URL,
  BD_MINOR_WORKS_OFFICIAL_URL,
  MWC_MISS_EXEMPT_ENGINEERING_PARAGRAPH_ZH,
  MWC_MISS_NOTE_HEADING_ZH,
  NEXT_STEPS_MINOR_WORKS_LINK_LABEL_ZH,
  OFF_REGISTER_BODY_ZH,
  OFF_REGISTER_NOT_A_GRADE_ZH,
  OFF_REGISTER_QUOTE_CTA_ZH,
  OFF_REGISTER_QUOTE_HREF,
  OFF_REGISTER_QUOTE_WHY_ZH,
  UNVERIFIED_COMPANY_REGISTRATION_EXEMPTED_LINK_LABEL_ZH,
} from "@/lib/report-trust-copy-zh";
import {
  reportBodyTextClass,
  reportH2SectionClass,
} from "@/lib/report-tokens";
import { safeHttpUrl } from "@/lib/safe-http-url";

function RegisterFactLink({ href, label }: { href: string; label: string }) {
  const safe = safeHttpUrl(href);
  if (!safe) return null;
  return (
    <a
      href={safe}
      target="_blank"
      rel="noopener noreferrer"
      className={`inline-flex min-h-11 items-center font-medium text-primary underline-offset-2 hover:underline ${focusRingClass}`}
    >
      {label}
      <span className="sr-only">（新分頁開啟）</span>
    </a>
  );
}

/**
 * Company-name report with no MWC row. Sits under the risk band and
 * before the Companies Registry card. Does not change the grade.
 */
export function OffRegisterState({ report }: { report: RiskReport }) {
  if (!shouldShowOffRegisterState(report)) return null;

  return (
    <section
      className="border-t border-border/60 bg-muted/30 px-5 py-5 lg:px-8 lg:py-8"
      aria-labelledby="off-register-heading"
    >
      <h2
        id="off-register-heading"
        className={`${reportH2SectionClass} flex items-start gap-2.5`}
      >
        <Info className="mt-1 size-[1.125rem] shrink-0 text-primary/75" aria-hidden />
        {MWC_MISS_NOTE_HEADING_ZH}
      </h2>
      <div className={`${reportBodyTextClass} mt-3 space-y-2`} role="note">
        <p>{OFF_REGISTER_BODY_ZH}</p>
        <p>{OFF_REGISTER_NOT_A_GRADE_ZH}</p>
        <p>{offRegisterCrLeadZh(report)}</p>
        <p>{MWC_MISS_EXEMPT_ENGINEERING_PARAGRAPH_ZH}</p>
        <p className="flex flex-col gap-1 sm:flex-row sm:flex-wrap sm:gap-x-4">
          <RegisterFactLink
            href={BD_MINOR_WORKS_OFFICIAL_URL}
            label={NEXT_STEPS_MINOR_WORKS_LINK_LABEL_ZH}
          />
          <RegisterFactLink
            href={BD_EXEMPTED_WORKS_URL}
            label={UNVERIFIED_COMPANY_REGISTRATION_EXEMPTED_LINK_LABEL_ZH}
          />
        </p>
        <p id="off-register-quote-why">{OFF_REGISTER_QUOTE_WHY_ZH}</p>
        <p>
          <Link
            href={OFF_REGISTER_QUOTE_HREF}
            aria-describedby="off-register-quote-why"
            className={`inline-flex min-h-11 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground ${focusRingClass}`}
          >
            {OFF_REGISTER_QUOTE_CTA_ZH}
          </Link>
        </p>
      </div>
    </section>
  );
}
