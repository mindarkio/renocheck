import { extractMwcBilingualNames } from "../mwc-bilingual-company-names";
import { isDefendantSideRole, isRenovationRelevantCase } from "./filter";
import {
  cjkEditDistance,
  normalizeChineseCompanyName,
  normalizeCompanyName,
  normalizeEnglishCompanyName,
} from "./normalize";
import { parseCorporateParties } from "./party";
import type {
  CauseListMatch,
  MatchConfidence,
  ParsedCauseListCase,
  ParsedCorporateParty,
} from "./types";
import type { CauseListCompanyFixture } from "./fixtures/companies.fixture";

export type CompanyRegistry = CauseListCompanyFixture[];

type NormalizedCompanyKeys = {
  id: string;
  strictEn: Set<string>;
  strictZh: Set<string>;
  coreEn: Set<string>;
  coreZh: Set<string>;
  aliasesStrict: Set<string>;
};

function buildRegistry(companies: CompanyRegistry): NormalizedCompanyKeys[] {
  return companies.map((c) => {
    const strictEn = new Set<string>();
    const strictZh = new Set<string>();
    const coreEn = new Set<string>();
    const coreZh = new Set<string>();
    const aliasesStrict = new Set<string>();

    for (const name of c.namesEn) {
      const n = normalizeEnglishCompanyName(name);
      strictEn.add(n.normStrict);
      coreEn.add(n.normCore);
    }
    for (const name of c.namesZh) {
      const n = normalizeChineseCompanyName(name);
      strictZh.add(n.normStrict);
      coreZh.add(n.normCore);
    }
    for (const name of [...(c.aliasesEn ?? []), ...(c.aliasesZh ?? [])]) {
      const n = normalizeCompanyName(name);
      aliasesStrict.add(n.normStrict);
      if (n.script === "zh" || n.script === "mixed") {
        aliasesStrict.add(normalizeChineseCompanyName(name).normStrict);
      }
    }

    return {
      id: c.id,
      strictEn,
      strictZh,
      coreEn,
      coreZh,
      aliasesStrict,
    };
  });
}

function splitCauseListBilingualRaw(raw: string): { en?: string; zh?: string } {
  const bi = extractMwcBilingualNames(raw);
  if (bi.en && bi.zh) return { en: bi.en, zh: bi.zh };
  const idx = raw.search(/\([\u4e00-\u9fff]/u);
  if (idx > 0) {
    const en = raw.slice(0, idx).trim();
    const zh = raw
      .slice(idx)
      .replace(/^\(/, "")
      .replace(/\)$/, "")
      .trim();
    return { en, zh };
  }
  return {};
}

function bilingualPairMatches(rawName: string, company: CauseListCompanyFixture): boolean {
  const bi = extractMwcBilingualNames(rawName);
  if (!bi.en || !bi.zh) return false;
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

function matchPartyToCompany(
  party: ParsedCorporateParty,
  registry: NormalizedCompanyKeys[],
  companies: CompanyRegistry,
): { confidence: MatchConfidence; companyId: string; matchedOn: string } | null {
  const candidates = [party.legalName, party.tradeName].filter(Boolean) as string[];

  for (const raw of candidates) {
    const norm = normalizeCompanyName(raw);
    const bi = splitCauseListBilingualRaw(raw);
    const en = normalizeEnglishCompanyName(bi.en ?? raw);
    const zh = normalizeChineseCompanyName(bi.zh ?? raw);

    for (const row of registry) {
      if (row.strictEn.has(en.normStrict) || row.strictZh.has(zh.normStrict)) {
        return { confidence: "A", companyId: row.id, matchedOn: raw };
      }
    }

    for (let i = 0; i < registry.length; i++) {
      const row = registry[i];
      const company = companies[i];
      if (row.aliasesStrict.has(norm.normStrict) || row.aliasesStrict.has(zh.normStrict)) {
        return { confidence: "B", companyId: row.id, matchedOn: raw };
      }
      if (party.tradeName && row.strictEn.has(normalizeEnglishCompanyName(party.tradeName).normStrict)) {
        return { confidence: "B", companyId: row.id, matchedOn: party.tradeName };
      }
      if (bilingualPairMatches(raw, company)) {
        return { confidence: "B", companyId: row.id, matchedOn: raw };
      }
    }

    for (const row of registry) {
      for (const core of row.coreZh) {
        if (zh.normCore === core) {
          return { confidence: "C", companyId: row.id, matchedOn: raw };
        }
        if (cjkEditDistance(zh.normCore, core) <= 1 && zh.normCore.length >= 4) {
          return { confidence: "C", companyId: row.id, matchedOn: raw };
        }
      }
      for (const core of row.coreEn) {
        if (en.normCore === core) {
          return { confidence: "C", companyId: row.id, matchedOn: raw };
        }
      }
    }
  }

  return null;
}

export function matchCauseListCases(
  cases: ParsedCauseListCase[],
  companies: CompanyRegistry,
): CauseListMatch[] {
  const registry = buildRegistry(companies);
  const matches: CauseListMatch[] = [];

  for (const caseRow of cases) {
    if (!isRenovationRelevantCase(caseRow)) continue;

    const corporates = parseCorporateParties(caseRow.parties);
    for (const party of corporates) {
      if (!isDefendantSideRole(party.role)) continue;

      const hit = matchPartyToCompany(party, registry, companies);
      if (!hit) continue;

      matches.push({
        confidence: hit.confidence,
        companyId: hit.companyId,
        case: caseRow,
        party,
        matchedOn: hit.matchedOn,
        reviewOnly: hit.confidence === "C",
      });
    }
  }

  return matches;
}

export function summarizeMatchesByLevel(matches: CauseListMatch[]): Record<MatchConfidence, number> {
  return {
    A: matches.filter((m) => m.confidence === "A" && !m.reviewOnly).length,
    B: matches.filter((m) => m.confidence === "B" && !m.reviewOnly).length,
    C: matches.filter((m) => m.confidence === "C").length,
  };
}
