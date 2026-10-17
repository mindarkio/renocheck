import { csvField } from "./csv";
import { BACKFILL_COURTS, weekdayGapRanges, type CauseListSnapshot } from "./cdx";
import { isDefendantSideRole, isRenovationRelevantCase } from "./filter";
import type { CauseListCompanyFixture } from "./fixtures/companies.fixture";
import { buildCompanyRegistryIndex } from "./match-registry";
import { matchCorporateParty } from "./match";
import {
  normalizeChineseCompanyName,
  normalizeEnglishCompanyName,
  splitBilingualCompanyRaw,
} from "./normalize";
import { isCorporateEntityName, parseCorporateParties } from "./party";
import type {
  CauseListCourtCode,
  MatchConfidence,
  ParsedCauseListCase,
} from "./types";

export type BackfillMatchLevel = MatchConfidence | "unmatched";

export type BackfillRow = {
  court: CauseListCourtCode;
  caseNo: string;
  firstHearingDate: string;
  lastHearingDate: string;
  claimNature: string;
  companyName: string;
  role: "defendant" | "respondent";
  matchLevel: BackfillMatchLevel;
  matchedCompanyId: string;
};

const LEVEL_RANK: Record<BackfillMatchLevel, number> = {
  unmatched: 0,
  C: 1,
  B: 2,
  A: 3,
};

const COURT_ORDER = new Map(BACKFILL_COURTS.map((court, index) => [court, index]));

type Accumulator = BackfillRow & {
  natures: Array<{ iso: string; nature: string }>;
};

function companyDedupeKey(legalName: string): string {
  const bi = splitBilingualCompanyRaw(legalName);
  if (bi.en && bi.zh) {
    return `mix:${normalizeEnglishCompanyName(bi.en).normStrict}|${normalizeChineseCompanyName(bi.zh).normStrict}`;
  }
  if (/[\u4e00-\u9fff]/u.test(legalName)) {
    return `zh:${normalizeChineseCompanyName(legalName).normStrict}`;
  }
  return `en:${normalizeEnglishCompanyName(legalName).normStrict}`;
}

function emptyCourtBuckets(): Record<
  CauseListCourtCode,
  { corporateRenovationRelevantRows: number }
> {
  return {
    SMT: { corporateRenovationRelevantRows: 0 },
    DC: { corporateRenovationRelevantRows: 0 },
    CACFI: { corporateRenovationRelevantRows: 0 },
    LANDS: { corporateRenovationRelevantRows: 0 },
  };
}

export type AggregateResult = {
  rows: BackfillRow[];
  byCourt: Record<CauseListCourtCode, { corporateRenovationRelevantRows: number }>;
};

export function createBackfillAggregator(companies: CauseListCompanyFixture[]) {
  const index = buildCompanyRegistryIndex(companies);
  const byKey = new Map<string, Accumulator>();
  const byCourt = emptyCourtBuckets();

  return {
    add(cases: ParsedCauseListCase[]) {
      addCorporateDefendantCases(cases, companies, index, byKey, byCourt);
    },
    finish(): AggregateResult {
      return { rows: rowsFromAccumulators(byKey), byCourt };
    },
  };
}

export function aggregateCorporateDefendantRows(
  cases: ParsedCauseListCase[],
  companies: CauseListCompanyFixture[],
): AggregateResult {
  const aggregator = createBackfillAggregator(companies);
  aggregator.add(cases);
  return aggregator.finish();
}

function addCorporateDefendantCases(
  cases: ParsedCauseListCase[],
  companies: CauseListCompanyFixture[],
  index: ReturnType<typeof buildCompanyRegistryIndex>,
  byKey: Map<string, Accumulator>,
  byCourt: AggregateResult["byCourt"],
): void {
  for (const caseRow of cases) {
    if (!isRenovationRelevantCase(caseRow)) continue;
    const corporates = parseCorporateParties(caseRow.parties).filter(
      (party) =>
        isDefendantSideRole(party.role) && isCorporateEntityName(party.legalName),
    );

    for (const party of corporates) {
      if (party.role !== "defendant" && party.role !== "respondent") continue;
      byCourt[caseRow.court].corporateRenovationRelevantRows += 1;

      const hit = companies.length
        ? matchCorporateParty(party, index, companies)
        : null;
      const matchLevel: BackfillMatchLevel = hit?.confidence ?? "unmatched";
      const matchedCompanyId = hit?.companyId ?? "";
      const key = `${caseRow.court}|${caseRow.caseNo}|${companyDedupeKey(party.legalName)}`;
      const nature = (caseRow.claimNature ?? "").replace(/\s+/g, " ").trim();
      const existing = byKey.get(key);
      if (!existing) {
        byKey.set(key, {
          court: caseRow.court,
          caseNo: caseRow.caseNo,
          firstHearingDate: caseRow.hearingDate,
          lastHearingDate: caseRow.hearingDate,
          claimNature: nature,
          companyName: party.legalName,
          role: party.role,
          matchLevel,
          matchedCompanyId,
          natures: nature ? [{ iso: caseRow.hearingDate, nature }] : [],
        });
        continue;
      }

      if (caseRow.hearingDate < existing.firstHearingDate) {
        existing.firstHearingDate = caseRow.hearingDate;
        existing.role = party.role;
        existing.companyName = party.legalName;
      }
      if (caseRow.hearingDate > existing.lastHearingDate) {
        existing.lastHearingDate = caseRow.hearingDate;
      }
      if (nature) existing.natures.push({ iso: caseRow.hearingDate, nature });
      if (LEVEL_RANK[matchLevel] > LEVEL_RANK[existing.matchLevel]) {
        existing.matchLevel = matchLevel;
        existing.matchedCompanyId = matchedCompanyId;
      }
    }
  }

}

function rowsFromAccumulators(byKey: Map<string, Accumulator>): BackfillRow[] {
  const rows = [...byKey.values()].map((row) => {
    const natures = [...row.natures].sort((a, b) => a.iso.localeCompare(b.iso));
    const unique: string[] = [];
    for (const item of natures) {
      if (!unique.includes(item.nature)) unique.push(item.nature);
    }
    return {
      court: row.court,
      caseNo: row.caseNo,
      firstHearingDate: row.firstHearingDate,
      lastHearingDate: row.lastHearingDate,
      claimNature: unique.join(" / "),
      companyName: row.companyName,
      role: row.role,
      matchLevel: row.matchLevel,
      matchedCompanyId: row.matchedCompanyId,
    };
  });

  rows.sort(
    (a, b) =>
      (COURT_ORDER.get(a.court) ?? 0) - (COURT_ORDER.get(b.court) ?? 0) ||
      a.caseNo.localeCompare(b.caseNo) ||
      a.companyName.localeCompare(b.companyName),
  );

  return rows;
}

export function assertCorporateBackfillRows(rows: BackfillRow[]): void {
  for (const row of rows) {
    if (!isCorporateEntityName(row.companyName)) {
      throw new Error(`refusing non-corporate output row ${row.court} ${row.caseNo}`);
    }
    if (row.role !== "defendant" && row.role !== "respondent") {
      throw new Error(`refusing non-defendant output row ${row.court} ${row.caseNo}`);
    }
  }
}

export function backfillRowsToCsv(rows: BackfillRow[]): string {
  const header =
    "court,caseNo,firstHearingDate,lastHearingDate,claimNature,companyName,role,matchLevel,matchedCompanyId";
  const lines = rows.map((row) =>
    [
      row.court,
      csvField(row.caseNo),
      row.firstHearingDate,
      row.lastHearingDate,
      csvField(row.claimNature),
      csvField(row.companyName),
      row.role,
      row.matchLevel,
      csvField(row.matchedCompanyId),
    ].join(","),
  );
  return `${header}\n${lines.join("\n")}${lines.length ? "\n" : ""}`;
}

export type CourtBackfillSummary = {
  datesFoundInCdx: number;
  datesFetched: number;
  rowsParsed: number;
  corporateRenovationRelevantRows: number;
  dedupedCases: number;
  A: number;
  B: number;
  C: number;
  unmatched: number;
};

export type BackfillSummary = {
  from: string;
  to: string;
  generatedAt: string;
  complete: boolean;
  mwcRegistry: {
    source: string;
    corporateCompanies: number;
    mode: "offline-public-register" | "unmatched-no-registry";
  };
  courts: Record<CauseListCourtCode, CourtBackfillSummary>;
  totals: {
    dedupedCases: number;
    distinctCompaniesA: number;
    distinctCompaniesB: number;
    distinctCompaniesAorB: number;
  };
  coverage: Record<
    CauseListCourtCode,
    {
      earliest: string | null;
      latest: string | null;
      weekdayGapCount: number;
      gapRanges: string[];
    }
  >;
  pages: {
    empty: number;
    unsupported: number;
    legacyFormat: number;
    parseFailures: number;
    fetchFailures: number;
  };
  parseFailures: Array<{ court: CauseListCourtCode; date: string; kind: string }>;
};

export function buildBackfillSummary(input: {
  from: string;
  to: string;
  generatedAt: string;
  complete: boolean;
  mwcMode: BackfillSummary["mwcRegistry"]["mode"];
  corporateCompanies: number;
  snapshots: CauseListSnapshot[];
  fetchedKeys: Set<string>;
  rowsParsed: Record<CauseListCourtCode, number>;
  corporateRenovationRelevantRows: Record<CauseListCourtCode, number>;
  rows: BackfillRow[];
  pages: BackfillSummary["pages"];
  parseFailures: BackfillSummary["parseFailures"];
}): BackfillSummary {
  const courts = {} as BackfillSummary["courts"];
  const coverage = {} as BackfillSummary["coverage"];

  for (const court of BACKFILL_COURTS) {
    const courtRows = input.rows.filter((row) => row.court === court);
    const dates = input.snapshots.filter((snap) => snap.court === court);
    const countLevel = (level: BackfillMatchLevel) =>
      courtRows.filter((row) => row.matchLevel === level).length;
    courts[court] = {
      datesFoundInCdx: dates.length,
      datesFetched: dates.filter((snap) =>
        input.fetchedKeys.has(`${snap.court}|${snap.dateDdMmYyyy}`),
      ).length,
      rowsParsed: input.rowsParsed[court],
      corporateRenovationRelevantRows: input.corporateRenovationRelevantRows[court],
      dedupedCases: courtRows.length,
      A: countLevel("A"),
      B: countLevel("B"),
      C: countLevel("C"),
      unmatched: countLevel("unmatched"),
    };
    const isos = dates.map((snap) => snap.iso).sort();
    const gaps = weekdayGapRanges(input.from, input.to, isos);
    coverage[court] = {
      earliest: isos[0] ?? null,
      latest: isos[isos.length - 1] ?? null,
      weekdayGapCount: gaps.reduce((sum, range) => {
        if (!range.includes("..")) return sum + 1;
        const [start, end] = range.split("..");
        const a = new Date(`${start}T00:00:00Z`).getTime();
        const b = new Date(`${end}T00:00:00Z`).getTime();
        return sum + Math.round((b - a) / 86400000) + 1;
      }, 0),
      gapRanges: gaps,
    };
  }

  const idsA = new Set(
    input.rows.filter((row) => row.matchLevel === "A").map((row) => row.matchedCompanyId),
  );
  const idsB = new Set(
    input.rows.filter((row) => row.matchLevel === "B").map((row) => row.matchedCompanyId),
  );
  const idsAorB = new Set([...idsA, ...idsB]);

  return {
    from: input.from,
    to: input.to,
    generatedAt: input.generatedAt,
    complete: input.complete,
    mwcRegistry: {
      source: "docs/sourcedata/registers_full_list.csv",
      corporateCompanies: input.corporateCompanies,
      mode: input.mwcMode,
    },
    courts,
    totals: {
      dedupedCases: input.rows.length,
      distinctCompaniesA: idsA.size,
      distinctCompaniesB: idsB.size,
      distinctCompaniesAorB: idsAorB.size,
    },
    coverage,
    pages: input.pages,
    parseFailures: input.parseFailures,
  };
}
