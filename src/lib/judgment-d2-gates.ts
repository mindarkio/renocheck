import { normalizeCompanyNameForCompare } from "./entity-report-context";
import {
  classifyDefendantEntity,
  defendantMatchConfidence,
} from "./judgment-d2-entity";
import { autoImportEligibility } from "./judgment-d2-case-policy";
import type { JudgmentCategory } from "./legal-event-schema";
import {
  extractSoleProprietorTradeAlias,
  isAutoDropCasePrefixV3d,
  isDefendantGovernment,
  isDefendantOwnersCorporation,
  isEngineeringCompanyPlaintiffOnly,
  isForceKeepCaseRef,
  isLabourPrefixReview,
} from "./judgment-d2-v3d-rules";
import {
  caseRefPrefix,
  defaultDefendantPartyLabel,
  defaultPlaintiffPartyLabel,
  partiesSuggestRenovationRelevant,
  splitPartiesLineWithRetry,
  type SplitParties,
} from "./judgment-d2-parties";
import type { JudgmentCandidateRow } from "./judgment-candidates-schema";

export type D2Disposition = "keep" | "drop" | "review";

export type MwcMatchSummary = {
  companyName: string;
  registrationNo: string;
  ambiguous: boolean;
};

export type D2GateInput = {
  row: JudgmentCandidateRow;
  skipPrefixes: string[];
  priorityPrefixes: string[];
  mwcLeft: MwcMatchSummary | null;
  mwcRight: MwcMatchSummary | null;
  /** When set, skips internal parties re-parse (filter script supplies retry). */
  partiesSplit?: SplitParties | null;
};

function defendantMwcPlausible(defendantLabel: string, mwc: MwcMatchSummary): boolean {
  const d = normalizeCompanyNameForCompare(defendantLabel);
  const m = normalizeCompanyNameForCompare(mwc.companyName);
  if (d.length < 2 || m.length < 2) return false;
  if (d === m || d.includes(m) || m.includes(d)) return true;
  const rawD = defendantLabel.trim();
  const rawM = mwc.companyName.trim();
  return rawD.includes(rawM) || rawM.includes(rawD);
}

export type D2GateResult = {
  disposition: D2Disposition;
  reasons: string[];
  defendantLabel?: string;
  plaintiffLabel?: string;
  mwcMatch?: MwcMatchSummary;
  renovationRelevantSuggested: boolean;
  matchConfidence?: "high" | "review";
  defendantEntityKind?: ReturnType<typeof classifyDefendantEntity>;
  reviewJudgmentCategory?: JudgmentCategory;
  reviewLookupAliases?: string[];
};

function prefixSkipped(caseRef: string, skipPrefixes: string[]): boolean {
  const p = caseRefPrefix(caseRef);
  return skipPrefixes.some((s) => p === s.toUpperCase());
}

function prefixPriority(caseRef: string, priorityPrefixes: string[]): boolean {
  const p = caseRefPrefix(caseRef);
  return priorityPrefixes.some((pr) => p === pr.toUpperCase());
}

export function runD2Gates(input: D2GateInput): D2GateResult {
  const { row, skipPrefixes, priorityPrefixes, mwcLeft, mwcRight } = input;
  const reasons: string[] = [];

  if (row.database !== "Judgments") {
    return {
      disposition: "drop",
      reasons: ["not_judgments_database"],
      renovationRelevantSuggested: false,
    };
  }

  if (prefixSkipped(row.caseRef, skipPrefixes)) {
    return {
      disposition: "drop",
      reasons: ["case_ref_prefix_skipped"],
      renovationRelevantSuggested: false,
    };
  }

  if (isAutoDropCasePrefixV3d(row.caseRef)) {
    return {
      disposition: "drop",
      reasons: ["case_ref_prefix_auto_drop_v3d"],
      renovationRelevantSuggested: false,
    };
  }

  const parsed =
    input.partiesSplit !== undefined
      ? { split: input.partiesSplit, retried: false }
      : splitPartiesLineWithRetry(row.partiesLine);
  const split = parsed.split;
  if (!split) {
    return {
      disposition: "review",
      reasons: [
        parsed.retried ? "parties_unparsed_after_retry" : "parties_unparsed",
      ],
      renovationRelevantSuggested: partiesSuggestRenovationRelevant(
        row.partiesLine,
        row.discoveredFrom.profileId,
      ),
    };
  }

  const defendantLabel = defaultDefendantPartyLabel(split);
  const plaintiffLabel = defaultPlaintiffPartyLabel(split);
  const renovationRelevantSuggested = partiesSuggestRenovationRelevant(
    row.partiesLine,
    row.discoveredFrom.profileId,
  );

  if (isForceKeepCaseRef(row.caseRef)) {
    return {
      disposition: "keep",
      reasons: ["force_keep_allowlist"],
      defendantLabel,
      plaintiffLabel,
      renovationRelevantSuggested,
      matchConfidence: "high",
      defendantEntityKind: classifyDefendantEntity(defendantLabel),
    };
  }

  if (isLabourPrefixReview(row.caseRef)) {
    return {
      disposition: "review",
      reasons: ["labour_category_review"],
      defendantLabel,
      plaintiffLabel,
      renovationRelevantSuggested,
      matchConfidence: "review",
      defendantEntityKind: classifyDefendantEntity(defendantLabel),
      reviewJudgmentCategory: "employment_labour",
    };
  }

  const rightHit = mwcRight && !mwcRight.ambiguous ? mwcRight : null;
  const leftHit = mwcLeft && !mwcLeft.ambiguous ? mwcLeft : null;

  if (leftHit) {
    return {
      disposition: "drop",
      reasons: ["mwc_plaintiff_only_pass"],
      defendantLabel,
      plaintiffLabel,
      renovationRelevantSuggested,
    };
  }

  const entityKind = classifyDefendantEntity(defendantLabel);
  const priority = prefixPriority(row.caseRef, priorityPrefixes);
  const confidence = defendantMatchConfidence(
    entityKind,
    renovationRelevantSuggested,
    priority,
  );

  let mwcMatch: MwcMatchSummary | undefined;
  if (rightHit && defendantMwcPlausible(defendantLabel, rightHit)) {
    mwcMatch = rightHit;
  } else if (rightHit) {
    reasons.push("mwc_defendant_label_mismatch");
  }
  if (mwcRight?.ambiguous) {
    reasons.push("mwc_defendant_ambiguous");
  }

  if (entityKind === "natural_person") {
    return {
      disposition: "drop",
      reasons: [...reasons, "natural_person_defendant"],
      defendantLabel,
      plaintiffLabel,
      mwcMatch,
      renovationRelevantSuggested,
      defendantEntityKind: entityKind,
    };
  }

  if (entityKind === "sole_proprietor") {
    const tradeAlias = extractSoleProprietorTradeAlias(defendantLabel);
    return {
      disposition: "review",
      reasons: [...reasons, "sole_proprietor_review"],
      defendantLabel,
      plaintiffLabel,
      mwcMatch,
      renovationRelevantSuggested,
      matchConfidence: "review",
      defendantEntityKind: entityKind,
      ...(tradeAlias ? { reviewLookupAliases: [tradeAlias] } : {}),
    };
  }

  if (isDefendantOwnersCorporation(defendantLabel)) {
    return {
      disposition: "drop",
      reasons: [...reasons, "defendant_owners_corporation"],
      defendantLabel,
      plaintiffLabel,
      mwcMatch,
      renovationRelevantSuggested,
      defendantEntityKind: entityKind,
    };
  }

  if (isDefendantGovernment(defendantLabel)) {
    return {
      disposition: "drop",
      reasons: [...reasons, "defendant_government"],
      defendantLabel,
      plaintiffLabel,
      mwcMatch,
      renovationRelevantSuggested,
      defendantEntityKind: entityKind,
    };
  }

  if (isEngineeringCompanyPlaintiffOnly(plaintiffLabel, defendantLabel)) {
    return {
      disposition: "drop",
      reasons: [...reasons, "engineering_company_plaintiff_only"],
      defendantLabel,
      plaintiffLabel,
      mwcMatch,
      renovationRelevantSuggested,
      defendantEntityKind: entityKind,
    };
  }

  if (confidence === "review") {
    return {
      disposition: "review",
      reasons: [
        ...reasons,
        entityKind === "unknown"
          ? "defendant_entity_unknown"
          : "weak_renovation_signal",
      ],
      defendantLabel,
      plaintiffLabel,
      mwcMatch,
      renovationRelevantSuggested,
      matchConfidence: "review",
      defendantEntityKind: entityKind,
    };
  }

  if (mwcRight?.ambiguous) {
    return {
      disposition: "review",
      reasons,
      defendantLabel,
      plaintiffLabel,
      mwcMatch,
      renovationRelevantSuggested,
      matchConfidence: "review",
      defendantEntityKind: entityKind,
    };
  }

  const auto = autoImportEligibility({
    caseRef: row.caseRef,
    partiesLine: row.partiesLine,
    profileId: row.discoveredFrom.profileId,
    renovationRelevantSuggested,
    defendantLabel,
  });
  if (!auto.eligible) {
    return {
      disposition: "review",
      reasons: [...reasons, auto.reason],
      defendantLabel,
      plaintiffLabel,
      mwcMatch,
      renovationRelevantSuggested,
      matchConfidence: "review",
      defendantEntityKind: entityKind,
    };
  }

  return {
    disposition: "keep",
    reasons: [
      ...reasons,
      mwcMatch ? "company_defendant_mwc_enrich" : "company_defendant",
    ],
    defendantLabel,
    plaintiffLabel,
    mwcMatch,
    renovationRelevantSuggested,
    matchConfidence: "high",
    defendantEntityKind: entityKind,
  };
}
