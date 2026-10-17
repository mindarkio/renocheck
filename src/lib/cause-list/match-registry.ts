import { extractMwcBilingualNames } from "../mwc-bilingual-company-names";
import { mwcCompanyNameLookupTerms } from "../mwc-company-search-terms";
import {
  normalizeChineseCompanyName,
  normalizeEnglishCompanyName,
  splitBilingualCompanyRaw,
} from "./normalize";
import { isCorporateEntityName } from "./party";
import type { CauseListCompanyFixture } from "./fixtures/companies.fixture";

export type CompanyRegistryIndex = {
  strictEnToId: Map<string, string[]>;
  strictZhToId: Map<string, string[]>;
  coreEnToId: Map<string, string>;
  coreZhToId: Map<string, string>;
  aliasStrictToId: Map<string, string>;
  companies: CauseListCompanyFixture[];
};

/** Use a bilingual split only when both halves are corporate names. */
export function corporateBilingualHalves(name: string): { en?: string; zh?: string } {
  const raw = splitBilingualCompanyRaw(name);
  const split = {
    en: raw.en?.replace(/[\s(（]+$/u, "").trim(),
    zh: raw.zh?.replace(/^[\s(（]+|[\s)）]+$/gu, "").trim(),
  };
  if (
    split.en &&
    split.zh &&
    isCorporateEntityName(split.en) &&
    isCorporateEntityName(split.zh)
  ) {
    return split;
  }
  return {};
}

function addStrictIds(map: Map<string, string[]>, key: string, id: string) {
  if (!key) return;
  const ids = map.get(key);
  if (!ids) {
    map.set(key, [id]);
    return;
  }
  if (!ids.includes(id)) ids.push(id);
}

function addFirstId(map: Map<string, string>, key: string, id: string) {
  if (!key) return;
  if (!map.has(key)) map.set(key, id);
}

function ingestName(
  id: string,
  name: string,
  index: CompanyRegistryIndex,
  asAlias: boolean,
) {
  const targets = new Set<string>([name]);
  const bi = extractMwcBilingualNames(name);
  if (bi.combined) targets.add(bi.combined);
  if (bi.en) targets.add(bi.en);
  if (bi.zh) targets.add(bi.zh);
  const halves = corporateBilingualHalves(name);
  if (halves.en) targets.add(halves.en);
  if (halves.zh) targets.add(halves.zh);

  for (const raw of targets) {
    for (const term of mwcCompanyNameLookupTerms(raw)) {
      const en = normalizeEnglishCompanyName(term);
      const zh = normalizeChineseCompanyName(term);
      if (asAlias) {
        addFirstId(index.aliasStrictToId, en.normStrict, id);
        addFirstId(index.aliasStrictToId, zh.normStrict, id);
      } else {
        addStrictIds(index.strictEnToId, en.normStrict, id);
        addStrictIds(index.strictZhToId, zh.normStrict, id);
        addFirstId(index.coreEnToId, en.normCore, id);
        addFirstId(index.coreZhToId, zh.normCore, id);
      }
    }
  }
}

export function buildCompanyRegistryIndex(
  companies: CauseListCompanyFixture[],
): CompanyRegistryIndex {
  const index: CompanyRegistryIndex = {
    strictEnToId: new Map(),
    strictZhToId: new Map(),
    coreEnToId: new Map(),
    coreZhToId: new Map(),
    aliasStrictToId: new Map(),
    companies,
  };

  for (const c of companies) {
    for (const name of c.namesEn) ingestName(c.id, name, index, false);
    for (const name of c.namesZh) ingestName(c.id, name, index, false);
    for (const name of [...(c.aliasesEn ?? []), ...(c.aliasesZh ?? [])]) {
      ingestName(c.id, name, index, true);
    }
  }

  return index;
}

export function partyLookupTerms(legalName: string): string[] {
  const out = new Set<string>();
  out.add(legalName);
  const bi = extractMwcBilingualNames(legalName);
  if (bi.combined) out.add(bi.combined);
  if (bi.en) out.add(bi.en);
  if (bi.zh) out.add(bi.zh);
  const halves = corporateBilingualHalves(legalName);
  if (halves.en) out.add(halves.en);
  if (halves.zh) out.add(halves.zh);
  const terms: string[] = [];
  for (const raw of out) terms.push(...mwcCompanyNameLookupTerms(raw));
  return terms;
}
