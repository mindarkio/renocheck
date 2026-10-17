import { extractMwcBilingualNames } from "../mwc-bilingual-company-names";
import { mwcCompanyNameLookupTerms } from "../mwc-company-search-terms";
import {
  normalizeChineseCompanyName,
  normalizeEnglishCompanyName,
  splitBilingualCompanyRaw,
} from "./normalize";
import type { CauseListCompanyFixture } from "./fixtures/companies.fixture";

export type CompanyRegistryIndex = {
  strictEnToId: Map<string, string>;
  strictZhToId: Map<string, string>;
  coreEnToId: Map<string, string>;
  coreZhToId: Map<string, string>;
  aliasStrictToId: Map<string, string>;
  companies: CauseListCompanyFixture[];
};

function addStrictEn(map: Map<string, string>, key: string, id: string) {
  if (!key) return;
  if (!map.has(key)) map.set(key, id);
}

function addStrictZh(map: Map<string, string>, key: string, id: string) {
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
  const split = splitBilingualCompanyRaw(name);
  if (split.en) targets.add(split.en);
  if (split.zh) targets.add(split.zh);

  for (const raw of targets) {
    for (const term of mwcCompanyNameLookupTerms(raw)) {
      const en = normalizeEnglishCompanyName(term);
      const zh = normalizeChineseCompanyName(term);
      if (asAlias) {
        addStrictEn(index.aliasStrictToId, en.normStrict, id);
        addStrictZh(index.aliasStrictToId, zh.normStrict, id);
      } else {
        addStrictEn(index.strictEnToId, en.normStrict, id);
        addStrictZh(index.strictZhToId, zh.normStrict, id);
        addStrictEn(index.coreEnToId, en.normCore, id);
        addStrictZh(index.coreZhToId, zh.normCore, id);
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
  const split = splitBilingualCompanyRaw(legalName);
  if (split.en) out.add(split.en);
  if (split.zh) out.add(split.zh);
  const terms: string[] = [];
  for (const raw of out) terms.push(...mwcCompanyNameLookupTerms(raw));
  return terms;
}
