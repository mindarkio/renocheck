import { normalizeCompanyNameForCompare } from "./entity-report-context";
import {
  classifyDefendantEntity,
  defendantMatchConfidence,
} from "./judgment-d2-entity";
import { autoImportEligibility, defendantHasEngineeringKeyword } from "./judgment-d2-case-policy";
import {
  manualDropReason,
  manualKeepOverride,
} from "./judgment-d2-manual-triage";
import type { JudgmentCategory } from "./legal-event-schema";
import {
  extractSoleProprietorTradeAlias,
  isAutoDropCasePrefixV3d,
  isDefendantGovernment,
  isDefendantOwnersCorporation,
  isEngineeringCompanyPlaintiffOnly,
  isForceKeepCaseRef,
  isLabourPrefixDrop,
} from "./judgment-d2-v3d-rules";
import {
  isDefendantHousingAuthority,
  isSolePropAutoKeepCourt,
  isV3eAutoDropCasePrefix,
  normalizeV3eDropReason,
  soleProprietorTradeHasKeepKeyword,
} from "./judgment-d2-v3e-rules";
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

  const triageDropEarly = manualDropReason(row.caseRef);
  if (triageDropEarly) {
    return {
      disposition: "drop",
      reasons: [triageDropEarly],
      renovationRelevantSuggested: partiesSuggestRenovationRelevant(
        row.partiesLine,
        row.discoveredFrom.profileId,
      ),
    };
  }

  const triageKeepEarly = manualKeepOverride(row.caseRef);
  if (triageKeepEarly) {
    return {
      disposition: "keep",
      reasons: ["manual_triage_keep"],
      defendantLabel: triageKeepEarly.defendantLabel,
      plaintiffLabel: triageKeepEarly.plaintiffLabel,
      renovationRelevantSuggested: partiesSuggestRenovationRelevant(
        row.partiesLine,
        row.discoveredFrom.profileId,
      ),
      matchConfidence: "high",
      defendantEntityKind: classifyDefendantEntity(triageKeepEarly.defendantLabel),
      ...(triageKeepEarly.lookupAliases?.length
        ? { reviewLookupAliases: triageKeepEarly.lookupAliases }
        : {}),
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

  if (isLabourPrefixDrop(row.caseRef)) {
    return {
      disposition: "drop",
      reasons: ["employment_labour_dropped"],
      defendantLabel,
      plaintiffLabel,
      renovationRelevantSuggested,
      defendantEntityKind: classifyDefendantEntity(defendantLabel),
    };
  }

  if (isV3eAutoDropCasePrefix(row.caseRef)) {
    return {
      disposition: "drop",
      reasons: ["case_prefix_v3e_drop"],
      defendantLabel,
      plaintiffLabel,
      renovationRelevantSuggested,
      defendantEntityKind: classifyDefendantEntity(defendantLabel),
    };
  }

  const rightHit = mwcRight && !mwcRight.ambiguous ? mwcRight : null;
  const leftHit = mwcLeft && !mwcLeft.ambiguous ? mwcLeft : null;

  if (leftHit && !defendantHasEngineeringKeyword(defendantLabel)) {
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
    const aliasExtra = tradeAlias ? { reviewLookupAliases: [tradeAlias] } : {};
    if (
      isSolePropAutoKeepCourt(row.caseRef) &&
      soleProprietorTradeHasKeepKeyword(defendantLabel)
    ) {
      return {
        disposition: "keep",
        reasons: [...reasons, "sole_proprietor_engineering_keep"],
        defendantLabel,
        plaintiffLabel,
        mwcMatch,
        renovationRelevantSuggested,
        matchConfidence: "high",
        defendantEntityKind: entityKind,
        ...aliasExtra,
      };
    }
    return {
      disposition: "drop",
      reasons: [...reasons, "sole_proprietor_non_engineering_drop"],
      defendantLabel,
      plaintiffLabel,
      mwcMatch,
      renovationRelevantSuggested,
      defendantEntityKind: entityKind,
      ...aliasExtra,
    };
  }

  if (mwcRight?.ambiguous) {
    const renovationCompany =
      entityKind === "company" &&
      defendantHasEngineeringKeyword(defendantLabel);
    if (renovationCompany) {
      reasons.push("mwc_ambiguous_renovation_keep");
    } else {
      return {
        disposition: "drop",
        reasons: [...reasons, "mwc_ambiguous_non_renovation_drop"],
        defendantLabel,
        plaintiffLabel,
        mwcMatch,
        renovationRelevantSuggested,
        defendantEntityKind: entityKind,
      };
    }
  }

  if (
    entityKind === "unknown" ||
    isDefendantHousingAuthority(defendantLabel)
  ) {
    return {
      disposition: "drop",
      reasons: [...reasons, "defendant_entity_unknown"],
      defendantLabel,
      plaintiffLabel,
      mwcMatch,
      renovationRelevantSuggested,
      defendantEntityKind: entityKind,
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
      disposition: "drop",
      reasons: [...reasons, "weak_renovation_signal"],
      defendantLabel,
      plaintiffLabel,
      mwcMatch,
      renovationRelevantSuggested,
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
      disposition: "drop",
      reasons: [...reasons, normalizeV3eDropReason(auto.reason)],
      defendantLabel,
      plaintiffLabel,
      mwcMatch,
      renovationRelevantSuggested,
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
