import { Building2 } from "lucide-react";
import { CopyCompanyNameButton } from "@/components/CopyCompanyNameButton";
import { officialVerifyCopyName } from "@/lib/official-verify-links";
import { formatReportGeneratedAtHkt } from "@/lib/format-report-generated-at";
import type {
  CompaniesRegistryCandidate,
  RiskReport,
} from "@/lib/report-schema";
import {
  CR_CANDIDATE_LIST_EXPLAINER_PENDING_APPROVAL_ZH,
  CR_CANDIDATE_LIST_HEADING_PENDING_APPROVAL_ZH,
} from "@/lib/cr-register/candidate-copy";
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
  reportBodyTextClass,
  reportH3CardClass,
  reportMetaTextClass,
} from "@/lib/report-tokens";

const reportBlockClass =
  "border-t border-border/60 px-5 py-2 lg:px-8 lg:py-8";
const reportBodyClass = reportBodyTextClass;
const reportMetaClass = reportMetaTextClass;

function CrCandidateList({ names }: { names: CompaniesRegistryCandidate[] }) {
  return (
    <div>
      <h3 className="text-sm font-medium text-foreground">
        {CR_CANDIDATE_LIST_HEADING_PENDING_APPROVAL_ZH}
      </h3>
      <p className={`${reportBodyClass} mt-1`}>
        {CR_CANDIDATE_LIST_EXPLAINER_PENDING_APPROVAL_ZH}
      </p>
      <ul className={`${reportBodyClass} mt-2 list-disc space-y-1 pl-5`}>
        {names.map((candidate, index) => {
          const title = [candidate.nameZh, candidate.nameEn]
            .map((part) => part?.trim())
            .filter(Boolean)
            .join(" ");
          const br = candidate.brNo?.trim();
          return (
            <li key={`${br ?? "row"}-${index}`}>
              {title}
              {br
                ? `${title ? " " : ""}（${CR_IDENTITY_FIELD_LABELS_ZH.brNo} ${br}）`
                : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function CrSourceAttribution({ retrievedAt }: { retrievedAt: string }) {
  return (
    <span>
      {CR_IDENTITY_SOURCE_LABEL_ZH} · 擷取於{" "}
      <time dateTime={retrievedAt}>
        {formatReportGeneratedAtHkt(retrievedAt)}
      </time>
    </span>
  );
}

const identityDtClass =
  "w-[4.5rem] shrink-0 text-xs leading-5 text-muted-foreground";
const identityDdClass =
  "min-w-0 flex-1 text-[15px] leading-[18px] text-foreground/90";
const identityEnClass =
  "min-w-0 flex-1 text-[13px] leading-[18px] text-foreground/90";

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
      <h2
        id="cr-identity-heading"
        className={`flex items-center gap-2 ${reportH3CardClass}`}
      >
        <Building2 className="size-5 shrink-0 text-primary" aria-hidden />
        {CR_IDENTITY_CARD_HEADING_ZH}
      </h2>

      <div className="mt-2 space-y-2">
        {isMatched ? (
          <>
            <dl className="space-y-1">
              {cr.brNo?.trim() ? (
                <div className="flex flex-row items-center gap-x-2">
                  <dt className={identityDtClass}>
                    {CR_IDENTITY_FIELD_LABELS_ZH.brNo}
                  </dt>
                  <dd className={`${identityDdClass} font-mono tabular-nums`}>
                    {cr.brNo}
                  </dd>
                </div>
              ) : null}
              {cr.nameZh?.trim() ? (
                <div className="flex flex-row items-center gap-x-2">
                  <dt className={identityDtClass}>
                    {CR_IDENTITY_FIELD_LABELS_ZH.nameZh}
                  </dt>
                  <dd className={`${identityDdClass} flex flex-wrap items-center gap-1`}>
                    <span>{cr.nameZh}</span>
                    {copyName ? (
                      <CopyCompanyNameButton text={copyName} />
                    ) : null}
                  </dd>
                </div>
              ) : null}
              {cr.nameEn?.trim() ? (
                <div className="flex flex-row items-center gap-x-2">
                  <dt className={identityDtClass}>
                    {CR_IDENTITY_FIELD_LABELS_ZH.nameEn}
                  </dt>
                  <dd className={identityEnClass}>{cr.nameEn}</dd>
                </div>
              ) : null}
              {cr.companyType?.trim() ? (
                <div className="flex flex-row items-center gap-x-2">
                  <dt className={identityDtClass}>
                    {CR_IDENTITY_FIELD_LABELS_ZH.companyType}
                  </dt>
                  <dd className={identityDdClass}>{cr.companyType}</dd>
                </div>
              ) : null}
              {cr.incorporationDate ? (
                <div className="flex flex-row items-center gap-x-2">
                  <dt className={identityDtClass}>
                    {CR_IDENTITY_FIELD_LABELS_ZH.incorporationDate}
                  </dt>
                  <dd className={identityDdClass}>
                    <time dateTime={cr.incorporationDate}>
                      {cr.incorporationDate}
                    </time>
                  </dd>
                </div>
              ) : null}
            </dl>
            <p className="text-xs leading-[18px] text-muted-foreground">
              <CrSourceAttribution retrievedAt={cr.retrievedAt} />
              <span> {CR_DATA_ATTRIBUTION_ZH}</span>
              {cr.brNo?.trim() ? (
                <span> {crBrNoCompareNoteZh(cr.brNo)}</span>
              ) : null}
            </p>
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
            <p className={reportMetaClass}>
              <CrSourceAttribution retrievedAt={cr.retrievedAt} />
            </p>
          </>
        ) : null}

        {cr.lookupStatus === "ok" &&
        cr.matched !== true &&
        !cr.matchAmbiguous ? (
          <>
            {cr.candidateNames && cr.candidateNames.length > 0 ? (
              <CrCandidateList names={cr.candidateNames} />
            ) : (
              <p className={reportBodyClass}>
                {cr.hints.includes("not_found_in_active_list")
                  ? CR_IDENTITY_NOT_FOUND_ZH
                  : CR_IDENTITY_INCONCLUSIVE_ZH}
              </p>
            )}
            <p className={reportMetaClass}>
              <CrSourceAttribution retrievedAt={cr.retrievedAt} />
            </p>
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
