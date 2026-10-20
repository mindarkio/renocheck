import { Building2 } from "lucide-react";
import { CopyCompanyNameButton } from "@/components/CopyCompanyNameButton";
import { officialVerifyCopyName } from "@/lib/official-verify-links";
import { formatReportGeneratedAtHkt } from "@/lib/format-report-generated-at";
import type { RiskReport } from "@/lib/report-schema";
import {
  CR_DATA_ATTRIBUTION_ZH,
  CR_IDENTITY_AMBIGUOUS_ZH,
  CR_IDENTITY_CARD_HEADING_ZH,
  CR_IDENTITY_FIELD_LABELS_ZH,
  CR_IDENTITY_INCONCLUSIVE_ZH,
  CR_IDENTITY_NOT_FOUND_ZH,
  CR_IDENTITY_SOURCE_LABEL_ZH,
  CR_LOOKUP_DEGRADED_ZH,
  crBrNoCompareNoteZh,
  crHintIncorporationUnderOneYearZh,
} from "@/lib/report-trust-copy-zh";
import {
  reportBlockPaddingClass,
  reportBodyTextClass,
  reportH3CardClass,
  reportMetaTextClass,
} from "@/lib/report-tokens";

const reportBlockClass = `${reportBlockPaddingClass} border-t border-border/60`;
const reportBodyClass = reportBodyTextClass;
const reportMetaClass = reportMetaTextClass;

function CrSourceAttribution({ retrievedAt }: { retrievedAt: string }) {
  return (
    <p className={reportMetaClass}>
      {CR_IDENTITY_SOURCE_LABEL_ZH} · 擷取於{" "}
      <time dateTime={retrievedAt}>
        {formatReportGeneratedAtHkt(retrievedAt)}
      </time>
    </p>
  );
}

export function CompanyIdentityCard({ report }: { report: RiskReport }) {
  const cr = report.official.companiesRegistry;
  if (!cr || cr.lookupStatus === "skipped") return null;

  const copyName = officialVerifyCopyName(report);
  const isMatched =
    cr.lookupStatus === "ok" && cr.matched === true && !cr.matchAmbiguous;
  const showIncorporationHint =
    isMatched &&
    cr.incorporationDate &&
    cr.hints.includes("incorporation_under_one_year");

  return (
    <section
      className={reportBlockClass}
      aria-labelledby="cr-identity-heading"
    >
      <h3
        id="cr-identity-heading"
        className={`flex items-center gap-2 ${reportH3CardClass}`}
      >
        <Building2 className="size-5 shrink-0 text-primary" aria-hidden />
        {CR_IDENTITY_CARD_HEADING_ZH}
      </h3>

      <div className="mt-4 space-y-3">
        {isMatched ? (
          <>
            <dl className="space-y-2">
              {cr.brNo?.trim() ? (
                <div className="flex flex-row items-center gap-x-3">
                  <dt className={`${reportMetaClass} shrink-0 leading-[26px] lg:leading-7`}>
                    {CR_IDENTITY_FIELD_LABELS_ZH.brNo}
                  </dt>
                  <dd className={`${reportBodyClass} min-w-0 flex-1 font-mono tabular-nums`}>
                    {cr.brNo}
                  </dd>
                </div>
              ) : null}
              {cr.nameZh?.trim() ? (
                <div className="flex flex-row items-center gap-x-3 gap-y-1">
                  <dt className={`${reportMetaClass} shrink-0 leading-[26px] lg:leading-7`}>
                    {CR_IDENTITY_FIELD_LABELS_ZH.nameZh}
                  </dt>
                  <dd className={`${reportBodyClass} min-w-0 flex-1 flex flex-wrap items-center gap-2`}>
                    <span>{cr.nameZh}</span>
                    {copyName ? (
                      <CopyCompanyNameButton text={copyName} />
                    ) : null}
                  </dd>
                </div>
              ) : null}
              {cr.nameEn?.trim() ? (
                <div className="flex flex-row items-center gap-x-3">
                  <dt className={`${reportMetaClass} shrink-0 leading-[26px] lg:leading-7`}>
                    {CR_IDENTITY_FIELD_LABELS_ZH.nameEn}
                  </dt>
                  <dd className={`${reportBodyClass} min-w-0 flex-1`}>{cr.nameEn}</dd>
                </div>
              ) : null}
              {cr.companyType?.trim() ? (
                <div className="flex flex-row items-center gap-x-3">
                  <dt className={`${reportMetaClass} shrink-0 leading-[26px] lg:leading-7`}>
                    {CR_IDENTITY_FIELD_LABELS_ZH.companyType}
                  </dt>
                  <dd className={`${reportBodyClass} min-w-0 flex-1`}>{cr.companyType}</dd>
                </div>
              ) : null}
              {cr.incorporationDate ? (
                <div className="flex flex-row items-center gap-x-3">
                  <dt className={`${reportMetaClass} shrink-0 leading-[26px] lg:leading-7`}>
                    {CR_IDENTITY_FIELD_LABELS_ZH.incorporationDate}
                  </dt>
                  <dd className={`${reportBodyClass} min-w-0 flex-1`}>
                    <time dateTime={cr.incorporationDate}>
                      {cr.incorporationDate}
                    </time>
                  </dd>
                </div>
              ) : null}
            </dl>
            <div className={`space-y-1 ${reportMetaClass}`}>
              <CrSourceAttribution retrievedAt={cr.retrievedAt} />
              <p>{CR_DATA_ATTRIBUTION_ZH}</p>
              {cr.brNo?.trim() ? (
                <p>{crBrNoCompareNoteZh(cr.brNo)}</p>
              ) : null}
            </div>
            {showIncorporationHint && cr.incorporationDate ? (
              <p className={`${reportBodyClass} text-muted-foreground`}>
                {crHintIncorporationUnderOneYearZh(cr.incorporationDate)}
              </p>
            ) : null}
          </>
        ) : null}

        {cr.matchAmbiguous ? (
          <>
            <p className={reportBodyClass}>{CR_IDENTITY_AMBIGUOUS_ZH}</p>
            <CrSourceAttribution retrievedAt={cr.retrievedAt} />
          </>
        ) : null}

        {cr.lookupStatus === "ok" &&
        cr.matched !== true &&
        !cr.matchAmbiguous ? (
          <>
            <p className={reportBodyClass}>
              {cr.hints.includes("not_found_in_active_list")
                ? CR_IDENTITY_NOT_FOUND_ZH
                : CR_IDENTITY_INCONCLUSIVE_ZH}
            </p>
            <CrSourceAttribution retrievedAt={cr.retrievedAt} />
          </>
        ) : null}

        {cr.lookupStatus === "error" || cr.lookupStatus === "timeout" ? (
          <p className={`${reportBodyClass} text-muted-foreground`}>
            {CR_LOOKUP_DEGRADED_ZH}
          </p>
        ) : null}
      </div>
    </section>
  );
}
