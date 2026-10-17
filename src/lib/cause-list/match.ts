import { extractMwcBilingualNames } from "../mwc-bilingual-company-names";
import { isDefendantSideRole, isRenovationRelevantCase } from "./filter";
import {
  buildCompanyRegistryIndex,
  corporateBilingualHalves,
  partyLookupTerms,
  type CompanyRegistryIndex,
} from "./match-registry";
import {
  cjkEditDistance,
  normalizeChineseCompanyName,
  normalizeEnglishCompanyName,
  splitBilingualCompanyRaw,
} from "./normalize";
import { parseCorporateParties } from "./party";
import type {
  CauseListMatch,
  CauseListMatchCase,
  CauseListMatchParty,
  MatchConfidence,
  ParsedCauseListCase,
  ParsedCorporateParty,
} from "./types";
import type { CauseListCompanyFixture } from "./fixtures/companies.fixture";

export type CompanyRegistry = CauseListCompanyFixture[];

const CONFIDENCE_RANK: Record<MatchConfidence, number> = { A: 3, B: 2, C: 1 };

function bilingualPairMatches(
  rawName: string,
  company: CauseListCompanyFixture,
): boolean {
  const bi = splitBilingualCompanyRaw(rawName);
  if (!bi.en || !bi.zh) {
    const paren = extractMwcBilingualNames(rawName);
    if (!paren.en || !paren.zh) return false;
    bi.en = paren.en;
    bi.zh = paren.zh;
  }
  const en = normalizeEnglishCompanyName(bi.en).normStrict;
  const zh = normalizeChineseCompanyName(bi.zh).normStrict;
  const enHit = company.namesEn.some(
    (n) => normalizeEnglishCompanyName(n).normStrict === en,
  );
  const zhHit = company.namesZh.some(
    (n) => normalizeChineseCompanyName(n).normStrict === zh,
  );
  return enHit && zhHit;
}

type PartyHit = {
  confidence: MatchConfidence;
  companyId: string;
  matchedOn: string;
  ambiguous?: boolean;
};

function strictIdsHit(ids: string[] | undefined, legalName: string): PartyHit | null {
  if (!ids || ids.length === 0) return null;
  if (ids.length > 1) {
    return {
      confidence: "C",
      companyId: ids[0],
      matchedOn: legalName,
      ambiguous: true,
    };
  }
  return { confidence: "A", companyId: ids[0], matchedOn: legalName };
}

function lookupStrictMatch(
  index: CompanyRegistryIndex,
  legalName: string,
): PartyHit | null {
  for (const term of partyLookupTerms(legalName)) {
    const en = normalizeEnglishCompanyName(term).normStrict;
    const zh = normalizeChineseCompanyName(term).normStrict;
    const aEn = strictIdsHit(index.strictEnToId.get(en), legalName);
    if (aEn) return aEn;
    const aZh = strictIdsHit(index.strictZhToId.get(zh), legalName);
    if (aZh) return aZh;
    const bAlias = index.aliasStrictToId.get(en) ?? index.aliasStrictToId.get(zh);
    if (bAlias) return { confidence: "B", companyId: bAlias, matchedOn: legalName };
  }
  return null;
}

function partyHasBilingualPair(legalName: string): boolean {
  const bi = splitBilingualCompanyRaw(legalName);
  if (bi.en && bi.zh) return true;
  const paren = extractMwcBilingualNames(legalName);
  return Boolean(paren.en && paren.zh);
}

function lookupFuzzyMatch(
  index: CompanyRegistryIndex,
  legalName: string,
  companies: CompanyRegistry,
): PartyHit | null {
  const bi = corporateBilingualHalves(legalName);
  const en = normalizeEnglishCompanyName(bi.en ?? legalName);
  const zh = normalizeChineseCompanyName(bi.zh ?? legalName);

  // Same result as scanning every company: a non-bilingual party never pairs.
  if (partyHasBilingualPair(legalName)) {
    for (let i = 0; i < companies.length; i++) {
      if (bilingualPairMatches(legalName, companies[i])) {
        return { confidence: "B", companyId: companies[i].id, matchedOn: legalName };
      }
    }
  }

  const coreEnHit = index.coreEnToId.get(en.normCore);
  if (coreEnHit) {
    return { confidence: "C", companyId: coreEnHit, matchedOn: legalName };
  }
  const coreZhHit = index.coreZhToId.get(zh.normCore);
  if (coreZhHit) {
    return { confidence: "C", companyId: coreZhHit, matchedOn: legalName };
  }

  // Edit distance ≤ 1 implies |len(a) − len(b)| ≤ 1. Skip the rest.
  if ([...zh.normCore].length >= 4) {
    const zhLen = [...zh.normCore].length;
    for (const [core, id] of index.coreZhToId) {
      if (Math.abs([...core].length - zhLen) > 1) continue;
      if (cjkEditDistance(zh.normCore, core) <= 1) {
        return { confidence: "C", companyId: id, matchedOn: legalName };
      }
    }
  }

  return null;
}

export function matchCorporateParty(
  party: ParsedCorporateParty,
  index: CompanyRegistryIndex,
  companies: CompanyRegistry,
): PartyHit | null {
  return matchPartyToCompany(party, index, companies);
}

function matchPartyToCompany(
  party: ParsedCorporateParty,
  index: CompanyRegistryIndex,
  companies: CompanyRegistry,
): PartyHit | null {
  const strict = lookupStrictMatch(index, party.legalName);
  if (strict) return strict;

  return lookupFuzzyMatch(index, party.legalName, companies);
}

function toMatchCase(caseRow: ParsedCauseListCase): CauseListMatchCase {
  return {
    court: caseRow.court,
    caseNo: caseRow.caseNo,
    hearingDate: caseRow.hearingDate,
    claimNature: caseRow.claimNature,
    hearingType: caseRow.hearingType,
  };
}

function toMatchParty(party: ParsedCorporateParty): CauseListMatchParty {
  return {
    role: party.role,
    position: party.position,
    legalName: party.legalName,
    tradeName: party.tradeName,
    formerlyTradedAs: party.formerlyTradedAs,
    incorporatedOwners: party.incorporatedOwners,
    displayLabel: party.legalName,
  };
}

function dedupeKey(m: CauseListMatch): string {
  return `${m.case.court}|${m.case.caseNo}|${m.companyId}`;
}

export function matchCauseListCases(
  cases: ParsedCauseListCase[],
  companies: CompanyRegistry,
): CauseListMatch[] {
  const index = buildCompanyRegistryIndex(companies);
  const byKey = new Map<string, CauseListMatch>();

  for (const caseRow of cases) {
    if (!isRenovationRelevantCase(caseRow)) continue;

    const corporates = parseCorporateParties(caseRow.parties);
    for (const party of corporates) {
      if (!isDefendantSideRole(party.role)) continue;

      const hit = matchPartyToCompany(party, index, companies);
      if (!hit) continue;

      const match: CauseListMatch = {
        confidence: hit.confidence,
        companyId: hit.companyId,
        case: toMatchCase(caseRow),
        party: toMatchParty(party),
        matchedOn: hit.matchedOn,
        reviewOnly: hit.confidence === "C" || hit.ambiguous === true,
        ...(hit.ambiguous ? { ambiguous: true } : {}),
      };

      const key = dedupeKey(match);
      const existing = byKey.get(key);
      if (!existing) {
        byKey.set(key, match);
        continue;
      }
      if (CONFIDENCE_RANK[match.confidence] > CONFIDENCE_RANK[existing.confidence]) {
        byKey.set(key, match);
      }
    }
  }

  return [...byKey.values()];
}

export function summarizeMatchesByLevel(matches: CauseListMatch[]): Record<MatchConfidence, number> {
  return {
    A: matches.filter((m) => m.confidence === "A" && !m.reviewOnly).length,
    B: matches.filter((m) => m.confidence === "B" && !m.reviewOnly).length,
    C: matches.filter((m) => m.confidence === "C").length,
  };
}
