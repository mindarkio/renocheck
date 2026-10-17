/**
 * MWC 中英公司名 ↔ official_legal_events 配對；可選寫入 lookup_aliases（無 schema 變更）。
 *
 *   pnpm mwc:bilingual-legal-match
 *   pnpm mwc:bilingual-legal-match --write
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@supabase/supabase-js";
import { normalizeCompanyNameForCompare } from "../src/lib/entity-report-context";
import { lookupMwcForPartyLabel } from "../src/lib/judgment-d2-mwc-match";
import { defendantLabelForMwcLookup } from "../src/lib/judgment-defendant-label";
import { extractSoleProprietorTradeAlias } from "../src/lib/judgment-d2-v3d-rules";
import { legalRowMatchesSearchLabel, normalizeLookupAliases } from "../src/lib/judgment-lookup-match";
import {
  filterSolePropLookupAliases,
  isSoleProprietorshipLegalRow,
  resolveImportCompanyFields,
} from "../src/lib/judgment-sole-prop-import";
import {
  extractMwcBilingualNames,
  mwcBilingualLookupTerms,
} from "../src/lib/mwc-bilingual-company-names";
import {
  assertJudgmentSeedAllowedForRemoteImport,
  officialLegalEventSourceCatalogAllowlistValues,
} from "../src/lib/judgment-import-catalog-guard";

const SEED_PATH = resolve(
  process.cwd(),
  "scripts/fixtures/judgments-seed.local.json",
);

type MwcRow = {
  id: string;
  company_name: string;
  registration_no: string | null;
};

type LegalRow = {
  id: string;
  case_ref: string;
  company_name_normalized: string;
  party_names: string[] | null;
  lookup_aliases: string[] | null;
  br_normalized: string | null;
  topic_tags: string[] | null;
};

type SeedRow = {
  sourceCatalogId: string;
  caseRef: string;
  companyNameNormalized: string;
  partyNames?: string[];
  lookupAliases?: string[];
};

function normRef(caseRef: string): string {
  return caseRef.replace(/\s+/g, "").toUpperCase();
}

function loadEnvLocal() {
  try {
    const text = readFileSync(resolve(process.cwd(), ".env.local"), "utf8");
    for (const line of text.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq === -1) continue;
      const key = trimmed.slice(0, eq).trim();
      let val = trimmed.slice(eq + 1).trim();
      if (
        (val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))
      ) {
        val = val.slice(1, -1);
      }
      if (!process.env[key]) process.env[key] = val;
    }
  } catch {
    // optional
  }
}

async function fetchAllRows<T>(
  supabase: SupabaseClient,
  table: string,
  select: string,
  filter?: (q: ReturnType<SupabaseClient["from"]>) => ReturnType<SupabaseClient["from"]>,
): Promise<T[]> {
  const pageSize = 1000;
  let from = 0;
  const out: T[] = [];
  while (true) {
    let q = supabase.from(table).select(select).range(from, from + pageSize - 1);
    if (filter) q = filter(q) as typeof q;
    const { data, error } = await q;
    if (error) throw error;
    const batch = (data ?? []) as T[];
    out.push(...batch);
    if (batch.length < pageSize) break;
    from += pageSize;
  }
  return out;
}

/** Same bar as D2 Gate 3 `defendantMwcPlausible` (full labels, min length). */
function defendantMwcPlausible(defendantLabel: string, mwcCompanyName: string): boolean {
  const d = normalizeCompanyNameForCompare(defendantLabel);
  const m = normalizeCompanyNameForCompare(mwcCompanyName);
  if (d.length < 6 || m.length < 6) return false;
  if (d === m || d.includes(m) || m.includes(d)) return true;
  const rawD = defendantLabel.trim();
  const rawM = mwcCompanyName.trim();
  return rawD.includes(rawM) || rawM.includes(rawD);
}

function legalDefendantLabels(legal: LegalRow, seed?: SeedRow): string[] {
  const labels = new Set<string>();
  if (isSoleProprietorshipLegalRow(legal.topic_tags)) {
    for (const a of legal.lookup_aliases ?? []) {
      if (a.trim()) labels.add(a.trim());
    }
    if (seed?.companyNameNormalized) {
      const trade = extractSoleProprietorTradeAlias(seed.companyNameNormalized);
      if (trade) labels.add(trade);
    }
    return [...labels];
  }
  if (seed?.companyNameNormalized) {
    labels.add(defendantLabelForMwcLookup(seed.companyNameNormalized));
  }
  labels.add(legal.company_name_normalized);
  for (const a of legal.lookup_aliases ?? []) {
    if (a.trim()) labels.add(a.trim());
  }
  return [...labels];
}

function mwcMatchesLegalViaLookupRules(mwc: MwcRow, legal: LegalRow): boolean {
  const names = extractMwcBilingualNames(mwc.company_name);
  for (const term of mwcBilingualLookupTerms(names)) {
    if (
      legalRowMatchesSearchLabel(term, {
        company_name_normalized: legal.company_name_normalized,
        lookup_aliases: legal.lookup_aliases,
        topic_tags: legal.topic_tags,
      })
    ) {
      return true;
    }
  }
  return false;
}

function mwcStrictlyMatchesLegal(
  mwc: MwcRow,
  legal: LegalRow,
  seed?: SeedRow,
): boolean {
  const mwcTerms = mwcBilingualLookupTerms(
    extractMwcBilingualNames(mwc.company_name),
  );
  for (const defendant of legalDefendantLabels(legal, seed)) {
    for (const mwcTerm of mwcTerms) {
      if (defendantMwcPlausible(defendant, mwcTerm)) return true;
    }
  }
  if (mwc.registration_no && legal.br_normalized) {
    const regDigits = mwc.registration_no.replace(/\D/g, "");
    if (regDigits.length >= 4 && regDigits === legal.br_normalized) return true;
  }
  return false;
}

function bilingualAliasExtras(mwc: MwcRow): string[] {
  return mwcBilingualLookupTerms(extractMwcBilingualNames(mwc.company_name));
}

function defendantLabelForLegalRow(
  legal: LegalRow,
  seed?: SeedRow,
): string | null {
  if (seed?.companyNameNormalized?.trim()) {
    return defendantLabelForMwcLookup(seed.companyNameNormalized);
  }
  const parties = legal.party_names ?? [];
  if (parties.length >= 2) {
    const defendant = parties[parties.length - 1]?.trim();
    if (defendant) return defendantLabelForMwcLookup(defendant);
  }
  if (legal.company_name_normalized?.trim()) {
    return defendantLabelForMwcLookup(legal.company_name_normalized);
  }
  return null;
}

function loadSeedByCaseRef(): Map<string, SeedRow> {
  const map = new Map<string, SeedRow>();
  if (!existsSync(SEED_PATH)) return map;
  const rows = JSON.parse(readFileSync(SEED_PATH, "utf8")) as SeedRow[];
  assertJudgmentSeedAllowedForRemoteImport(rows);
  for (const row of rows) {
    map.set(normRef(row.caseRef), row);
  }
  return map;
}

async function main() {
  loadEnvLocal();
  const write = process.argv.includes("--write");
  const url =
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error("Missing Supabase env");
    process.exit(1);
  }

  const supabase = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const seedByRef = loadSeedByCaseRef();

  const mwcs = await fetchAllRows<MwcRow>(
    supabase,
    "mwc_contractors",
    "id, company_name, registration_no",
  );

  const legals = await fetchAllRows<LegalRow>(
    supabase,
    "official_legal_events",
    "id, case_ref, company_name_normalized, party_names, lookup_aliases, br_normalized, topic_tags",
    (q) =>
      q.in(
        "source_catalog_id",
        officialLegalEventSourceCatalogAllowlistValues(),
      ),
  );

  const mwcByReg = new Map<string, MwcRow>();
  for (const m of mwcs) {
    if (m.registration_no) mwcByReg.set(m.registration_no, m);
  }

  const legalToMwcs = new Map<string, MwcRow[]>();
  const mwcToLegals = new Map<string, LegalRow[]>();
  let lookupHits = 0;
  let lookupAmbiguous = 0;

  for (const legal of legals) {
    const seed = seedByRef.get(normRef(legal.case_ref));
    const defendantRaw = defendantLabelForLegalRow(legal, seed);
    if (!defendantRaw) {
      console.warn(
        JSON.stringify({
          event: "mwc_bilingual_skip_no_defendant",
          caseRef: legal.case_ref,
        }),
      );
      continue;
    }
    const defendant = defendantRaw;
    const partyNames = seed?.partyNames ?? [];

    const lookup = await lookupMwcForPartyLabel(
      supabase,
      defendant,
      partyNames,
    );
    const matched = new Map<string, MwcRow>();

    if (lookup?.ambiguous) lookupAmbiguous += 1;
    if (lookup && !lookup.ambiguous && lookup.registrationNo) {
      const row = mwcByReg.get(lookup.registrationNo);
      if (row) {
        matched.set(row.id, row);
        lookupHits += 1;
      }
    }

    for (const mwc of mwcs) {
      if (
        mwcStrictlyMatchesLegal(mwc, legal, seed) ||
        mwcMatchesLegalViaLookupRules(mwc, legal)
      ) {
        matched.set(mwc.id, mwc);
      }
    }

    if (matched.size > 0) {
      legalToMwcs.set(legal.id, [...matched.values()]);
      for (const mwc of matched.values()) {
        const list = mwcToLegals.get(mwc.id) ?? [];
        list.push(legal);
        mwcToLegals.set(mwc.id, list);
      }
    }
  }

  let aliasUpdates = 0;
  if (write) {
    for (const legal of legals) {
      const matched = legalToMwcs.get(legal.id) ?? [];
      if (matched.length === 0) continue;
      const seed = seedByRef.get(normRef(legal.case_ref));
      const shaped = seed
        ? resolveImportCompanyFields({
            companyNameNormalized: seed.companyNameNormalized,
            partyNames: seed.partyNames,
            lookupAliases: seed.lookupAliases,
            topicTags: legal.topic_tags ?? undefined,
          })
        : {
            companyNameNormalized: legal.company_name_normalized,
            lookupAliases: legal.lookup_aliases ?? [],
            topicTags: legal.topic_tags ?? [],
          };
      const extras: string[] = [];
      for (const mwc of matched) {
        extras.push(...bilingualAliasExtras(mwc));
      }
      const defendantLabel =
        defendantLabelForLegalRow(legal, seed) ??
        shaped.companyNameNormalized;
      if (!defendantLabel?.trim()) {
        console.warn(
          JSON.stringify({
            event: "mwc_bilingual_skip_alias_no_defendant",
            caseRef: legal.case_ref,
          }),
        );
        continue;
      }
      let nextAliases: string[];
      try {
        nextAliases = isSoleProprietorshipLegalRow(legal.topic_tags)
          ? filterSolePropLookupAliases(defendantLabel, [
              ...shaped.lookupAliases,
              ...extras,
            ])
          : normalizeLookupAliases(shaped.companyNameNormalized, [
              ...shaped.lookupAliases,
              ...extras,
            ]);
      } catch (e) {
        console.warn(
          JSON.stringify({
            event: "mwc_bilingual_skip_alias_build_failed",
            caseRef: legal.case_ref,
            error: e instanceof Error ? e.message : String(e),
          }),
        );
        continue;
      }
      const prev = legal.lookup_aliases ?? [];
      const same =
        nextAliases.length === prev.length &&
        nextAliases.every((a, i) => a === prev[i]);
      if (same) continue;
      const { error } = await supabase
        .from("official_legal_events")
        .update({ lookup_aliases: nextAliases })
        .eq("id", legal.id);
      if (error) {
        console.warn(
          JSON.stringify({
            event: "mwc_bilingual_skip_alias_update_failed",
            caseRef: legal.case_ref,
            error: error.message,
          }),
        );
        continue;
      }
      aliasUpdates += 1;
    }
  }

  const sample = [...mwcToLegals.entries()]
    .slice(0, 8)
    .map(([mwcId, hits]) => {
      const mwc = mwcs.find((m) => m.id === mwcId)!;
      return {
        mwcCompany: mwc.company_name,
        registrationNo: mwc.registration_no,
        caseRefs: hits.map((h) => h.case_ref),
      };
    });

  console.info(
    JSON.stringify(
      {
        event: "mwc_bilingual_legal_match_done",
        policy: "seed_lookup_plus_strict_bilingual_terms",
        mwcContractorsTotal: mwcs.length,
        legalEventsTotal: legals.length,
        seedRowsLoaded: seedByRef.size,
        mwcWithAtLeastOneLegalCase: mwcToLegals.size,
        legalEventsWithMwcMatch: legalToMwcs.size,
        lookupMwcForPartyLabelHits: lookupHits,
        lookupMwcAmbiguous: lookupAmbiguous,
        aliasRowsUpdated: write ? aliasUpdates : 0,
        write,
        sample,
      },
      null,
      2,
    ),
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
