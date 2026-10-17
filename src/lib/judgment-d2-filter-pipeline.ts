import type { JudgmentCandidateRow } from "./judgment-candidates-schema";
import {
  defaultDefendantPartyLabel,
  defaultPlaintiffPartyLabel,
  splitPartiesLineWithRetry,
} from "./judgment-d2-parties";
import { runD2Gates, type D2Disposition } from "./judgment-d2-gates";
import { lookupMwcForPartyLabelMemory } from "./judgment-d2-mwc-match-memory";
import type { MwcContractorsMemoryIndex } from "./mwc-contractors-memory-index";
import { courtFromCaseRef } from "./court-from-case-ref";
import {
  type D2CachedCandidateStep,
  type D2FilterStepCacheFile,
  getCachedStepIfValid,
  judgmentCandidateContentHash,
  normalizeCaseRefKey,
} from "./judgment-d2-filter-cache";

export type D2FilterEntry = {
  caseRef: string;
  disposition: D2Disposition;
  reasons: string[];
  defendantLabel?: string;
  plaintiffLabel?: string;
  renovationRelevantSuggested: boolean;
  mwcMatch?: ReturnType<typeof runD2Gates>["mwcMatch"];
  court: string;
  sourceUrl: string;
  partiesLine: string;
  discoveredFrom: JudgmentCandidateRow["discoveredFrom"];
  reviewJudgmentCategory?: string;
  reviewLookupAliases?: string[];
};

export type D2FilterTimingsMs = {
  parseParties: number;
  mwcLookup: number;
  runGates: number;
  cacheHits: number;
  cacheMisses: number;
};

export type RunD2FilterPipelineOptions = {
  candidates: JudgmentCandidateRow[];
  skipPrefixes: string[];
  priorityPrefixes: string[];
  courtPrefixes: Record<string, string>;
  mwcIndex: MwcContractorsMemoryIndex;
  stepCache?: D2FilterStepCacheFile;
  useStepCache?: boolean;
  writeStepCache?: boolean;
  onlyCaseRef?: string;
  changedOnly?: boolean;
};

export type RunD2FilterPipelineResult = {
  entries: D2FilterEntry[];
  counts: Record<D2Disposition, number>;
  timingsMs: D2FilterTimingsMs;
  cache: D2FilterStepCacheFile;
};

function gateToCached(gate: ReturnType<typeof runD2Gates>): D2CachedCandidateStep["gate"] {
  return {
    disposition: gate.disposition,
    reasons: gate.reasons,
    defendantLabel: gate.defendantLabel,
    plaintiffLabel: gate.plaintiffLabel,
    renovationRelevantSuggested: gate.renovationRelevantSuggested,
    mwcMatch: gate.mwcMatch,
    ...(gate.reviewJudgmentCategory
      ? { reviewJudgmentCategory: gate.reviewJudgmentCategory }
      : {}),
    ...(gate.reviewLookupAliases?.length
      ? { reviewLookupAliases: gate.reviewLookupAliases }
      : {}),
  };
}

function entryFromCache(
  row: JudgmentCandidateRow,
  courtPrefixes: Record<string, string>,
  cached: D2CachedCandidateStep,
): D2FilterEntry {
  const g = cached.gate;
  return {
    caseRef: row.caseRef,
    disposition: g.disposition,
    reasons: g.reasons,
    defendantLabel: g.defendantLabel,
    plaintiffLabel: g.plaintiffLabel,
    renovationRelevantSuggested: g.renovationRelevantSuggested,
    mwcMatch: g.mwcMatch,
    court: courtFromCaseRef(row.caseRef, courtPrefixes),
    sourceUrl: row.judgmentUrl ?? row.lrsListingUrl,
    partiesLine: row.partiesLine,
    discoveredFrom: row.discoveredFrom,
    ...(g.reviewJudgmentCategory
      ? { reviewJudgmentCategory: g.reviewJudgmentCategory }
      : {}),
    ...(g.reviewLookupAliases?.length
      ? { reviewLookupAliases: g.reviewLookupAliases }
      : {}),
  };
}

export function runD2FilterPipeline(
  options: RunD2FilterPipelineOptions,
): RunD2FilterPipelineResult {
  const {
    candidates,
    skipPrefixes,
    priorityPrefixes,
    courtPrefixes,
    mwcIndex,
    stepCache: initialCache,
    useStepCache = true,
    writeStepCache = true,
    onlyCaseRef,
    changedOnly = false,
  } = options;

  const cache: D2FilterStepCacheFile = initialCache ?? {
    schemaVersion: 1,
    policy: "company_defendant_v3e",
    updatedAt: new Date(0).toISOString(),
    byCaseRef: {},
  };

  let pool = candidates;
  if (onlyCaseRef) {
    const key = normalizeCaseRefKey(onlyCaseRef);
    pool = candidates.filter((c) => normalizeCaseRefKey(c.caseRef) === key);
  }

  const entries: D2FilterEntry[] = [];
  const counts: Record<D2Disposition, number> = {
    keep: 0,
    drop: 0,
    review: 0,
  };
  const timingsMs: D2FilterTimingsMs = {
    parseParties: 0,
    mwcLookup: 0,
    runGates: 0,
    cacheHits: 0,
    cacheMisses: 0,
  };

  const processRow = (
    row: JudgmentCandidateRow,
    allowCache: boolean,
  ): D2FilterEntry => {
    if (allowCache) {
      const cached = getCachedStepIfValid(cache, row);
      if (cached) {
        timingsMs.cacheHits += 1;
        return entryFromCache(row, courtPrefixes, cached);
      }
    }

    timingsMs.cacheMisses += 1;

    const t0 = performance.now();
    const parsed = splitPartiesLineWithRetry(row.partiesLine);
    timingsMs.parseParties += performance.now() - t0;

    const split = parsed.split;
    let mwcLeft = null;
    let mwcRight = null;
    const t1 = performance.now();
    if (split) {
      const partyLabels = [split.left, split.right];
      mwcLeft = lookupMwcForPartyLabelMemory(
        mwcIndex,
        defaultPlaintiffPartyLabel(split),
        partyLabels,
      );
      mwcRight = lookupMwcForPartyLabelMemory(
        mwcIndex,
        defaultDefendantPartyLabel(split),
        partyLabels,
      );
    }
    timingsMs.mwcLookup += performance.now() - t1;

    const t2 = performance.now();
    const gate = runD2Gates({
      row,
      skipPrefixes,
      priorityPrefixes,
      mwcLeft,
      mwcRight,
      partiesSplit: split,
    });
    timingsMs.runGates += performance.now() - t2;

    if (writeStepCache) {
      const key = normalizeCaseRefKey(row.caseRef);
      cache.byCaseRef[key] = {
        contentHash: judgmentCandidateContentHash(row),
        partiesLine: row.partiesLine.trim(),
        parse: { split: parsed.split, retried: parsed.retried },
        mwcLeft,
        mwcRight,
        gate: gateToCached(gate),
      };
    }

    return {
      caseRef: row.caseRef,
      disposition: gate.disposition,
      reasons: gate.reasons,
      defendantLabel: gate.defendantLabel,
      plaintiffLabel: gate.plaintiffLabel,
      renovationRelevantSuggested: gate.renovationRelevantSuggested,
      mwcMatch: gate.mwcMatch,
      court: courtFromCaseRef(row.caseRef, courtPrefixes),
      sourceUrl: row.judgmentUrl ?? row.lrsListingUrl,
      partiesLine: row.partiesLine,
      discoveredFrom: row.discoveredFrom,
      ...(gate.reviewJudgmentCategory
        ? { reviewJudgmentCategory: gate.reviewJudgmentCategory }
        : {}),
      ...(gate.reviewLookupAliases?.length
        ? { reviewLookupAliases: gate.reviewLookupAliases }
        : {}),
    };
  };

  const allowCache = useStepCache || changedOnly;

  if (onlyCaseRef) {
    for (const row of pool) {
      const entry = processRow(row, allowCache);
      counts[entry.disposition] += 1;
      entries.push(entry);
    }
  } else {
    const rows = changedOnly ? candidates : candidates;
    for (const row of rows) {
      const entry = processRow(row, allowCache);
      counts[entry.disposition] += 1;
      entries.push(entry);
    }
  }

  return { entries, counts, timingsMs, cache };
}
