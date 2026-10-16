import { normalizeCompanyNameForCompare } from "./entity-report-context";
import { classifyDefendantEntity } from "./judgment-d2-entity";
import {
  extractSoleProprietorOwnerName,
  extractSoleProprietorTradeAlias,
} from "./judgment-d2-v3d-rules";
import { mwcCompanyNameLookupTerms } from "./mwc-company-search-terms";
import { normalizeLookupAliases, suggestLookupAliases } from "./judgment-lookup-match";

export function isSoleProprietorshipLegalRow(topicTags?: string[] | null): boolean {
  return topicTags?.includes("sole_proprietorship") ?? false;
}

export type SolePropImportShape = {
  companyNameNormalized: string;
  lookupAliases: string[];
  topicTags: string[];
};

/** DB: 商號入 `company_name_normalized`；東主只留 `party_names`。 */
export function shapeSoleProprietorImportRow(input: {
  defendantLabel: string;
  partyNames?: string[];
  manualAliases?: string[];
  topicTags?: string[];
}): SolePropImportShape {
  const defendantLabel = input.defendantLabel.trim();
  const topicTags = [...(input.topicTags ?? [])];
  if (!topicTags.includes("sole_proprietorship")) {
    topicTags.push("sole_proprietorship");
  }

  const trade = extractSoleProprietorTradeAlias(defendantLabel);
  const owner = extractSoleProprietorOwnerName(defendantLabel);
  const tradeName = trade ?? defendantLabel;

  const ownerNorm = owner ? normalizeCompanyNameForCompare(owner) : "";
  const aliasExtras = [
    ...suggestLookupAliases(defendantLabel, []),
    ...(input.manualAliases ?? []),
  ];

  const base = normalizeLookupAliases(tradeName, aliasExtras);
  const aliasSet = new Set<string>();
  const maybeAddAlias = (raw: string) => {
    const n = normalizeCompanyNameForCompare(raw);
    if (n.length < 2) return;
    if (ownerNorm) {
      if (n === ownerNorm || ownerNorm === n) return;
      if (ownerNorm.includes(n) || n.includes(ownerNorm)) return;
    }
    aliasSet.add(n);
  };
  for (const a of base) maybeAddAlias(a);
  for (const term of mwcCompanyNameLookupTerms(tradeName)) maybeAddAlias(term);

  return {
    companyNameNormalized: normalizeCompanyNameForCompare(tradeName),
    lookupAliases: [...aliasSet],
    topicTags,
  };
}

export function shapeCompanyImportRow(input: {
  companyNameNormalized: string;
  partyNames?: string[];
  manualAliases?: string[];
  topicTags?: string[];
}): { companyNameNormalized: string; lookupAliases: string[]; topicTags: string[] } {
  const label = input.companyNameNormalized.trim();
  const aliases = normalizeLookupAliases(label, [
    ...suggestLookupAliases(label, input.partyNames),
    ...(input.manualAliases ?? []),
  ]);
  return {
    companyNameNormalized: normalizeCompanyNameForCompare(label),
    lookupAliases: aliases,
    topicTags: [...(input.topicTags ?? [])],
  };
}

export function resolveImportCompanyFields(row: {
  companyNameNormalized: string;
  partyNames?: string[];
  lookupAliases?: string[];
  topicTags?: string[];
}): { companyNameNormalized: string; lookupAliases: string[]; topicTags: string[] } {
  const manual = row.lookupAliases ?? [];
  if (classifyDefendantEntity(row.companyNameNormalized) === "sole_proprietor") {
    return shapeSoleProprietorImportRow({
      defendantLabel: row.companyNameNormalized,
      partyNames: row.partyNames,
      manualAliases: manual,
      topicTags: row.topicTags,
    });
  }
  return shapeCompanyImportRow({
    companyNameNormalized: row.companyNameNormalized,
    partyNames: row.partyNames,
    manualAliases: manual,
    topicTags: row.topicTags,
  });
}

/** Report UI: 判詞 party 原文（含「X經營Y」）。 */
export function soleProprietorDefendantDisplayZh(
  partyNames: string[] | null | undefined,
): string | undefined {
  if (!partyNames?.length) return undefined;
  const defendant = partyNames[partyNames.length - 1]?.trim();
  if (!defendant) return undefined;
  if (
    classifyDefendantEntity(defendant) === "sole_proprietor" ||
    /經營|trading as|\bt\/a\b/i.test(defendant)
  ) {
    return defendant;
  }
  return undefined;
}
