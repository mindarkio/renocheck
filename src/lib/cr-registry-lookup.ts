import type { CompaniesRegistryOfficial } from "./report-schema";
import { CR_ESERVICES_URL } from "./report-trust-copy-zh";
import { isCrOpenDataBrnEqualValue } from "./cr-register/brn";
import {
  searchCrLocalByBrnEqual,
  searchCrLocalByNameBeginsWith,
  type CrLocalSearchResult,
} from "./cr-register/client";
import {
  hasCrApiQueryPath,
  shouldRunCompaniesRegistryLookup,
} from "./cr-register/eligibility";
import {
  ambiguousCrSnapshot,
  candidateCrSnapshot,
  inconclusiveCrSnapshot,
  mapCrApiRowToSnapshot,
  notFoundCrSnapshot,
} from "./cr-register/map-row";
import {
  allNameSearchPrefixAttempts,
  buildNameSearchPrefixes,
  isCrMatchedPick,
  pickMatchedRows,
  tierForRow,
  type CrPickResult,
} from "./cr-register/match";
import {
  crRegistryCacheKey,
  getCrRegistryCached,
  setCrRegistryCached,
} from "./cr-register/memory-cache";
import type { CrApiLocalRow, CrMappedSnapshot } from "./cr-register/types";
import type { MwcRow } from "./mwc-lookup";
import type { NormalizedSearchInput } from "./normalize-search-input";

// 2026-10-19 實測 data.cr.gov.hk 9–14s；並行於 SERP（25s timeout）；總 maxDuration 60s。
export const CR_LOOKUP_BUDGET_MS = 25_000;

type CrLookupFetchStats = {
  fetchCount: number;
  lastHttpStatus: number | null;
};

function crLogFields(stats: CrLookupFetchStats, startedAt: number) {
  return {
    elapsed_ms: Date.now() - startedAt,
    http_status: stats.lastHttpStatus,
    fetch_count: stats.fetchCount,
  };
}

function snapshotToOfficial(
  lookupStatus: CompaniesRegistryOfficial["lookupStatus"],
  snapshot: CrMappedSnapshot,
): CompaniesRegistryOfficial {
  return {
    lookupStatus,
    matched: snapshot.matchAmbiguous ? false : snapshot.matched,
    ...(snapshot.matchAmbiguous ? { matchAmbiguous: true } : {}),
    matchTier: snapshot.matchTier,
    brNo: snapshot.brNo,
    companyType: snapshot.companyType,
    nameZh: snapshot.nameZh,
    nameEn: snapshot.nameEn,
    incorporationDate: snapshot.incorporationDate,
    retrievedAt: snapshot.retrievedAt,
    hints: snapshot.hints,
    icrisHomeUrl: snapshot.icrisHomeUrl || CR_ESERVICES_URL,
    ...(snapshot.candidateNames && snapshot.candidateNames.length > 0
      ? { candidateNames: snapshot.candidateNames }
      : {}),
  };
}

function budgetAbortSignal(): AbortSignal {
  return AbortSignal.abort(new DOMException("budget", "TimeoutError"));
}

function deadlineAbortSignal(leftMs: number): AbortSignal {
  const controller = new AbortController();
  const timer = setTimeout(() => {
    controller.abort(new DOMException("budget", "TimeoutError"));
  }, leftMs);
  (timer as { unref?: () => void }).unref?.();
  return controller.signal;
}

function fetchSignal(deadlineMs: number): AbortSignal {
  // left<=50 is defense-in-depth: throttle's deadline reserve rejects first;
  // covered by client.test budget TimeoutError test.
  const left = deadlineMs - Date.now();
  if (left <= 50) {
    return budgetAbortSignal();
  }
  return deadlineAbortSignal(left);
}

function toDegraded(
  message: string,
): { kind: "degraded"; reason: "timeout" | "error" } {
  return {
    kind: "degraded",
    reason: message === "timeout" ? "timeout" : "error",
  };
}

function matchedFromPick(
  pick: { tier: "A" | "B" | "C"; row: CrApiLocalRow },
  retrievedAt: string,
): CrMappedSnapshot {
  const mapped = mapCrApiRowToSnapshot(pick.row, {
    matchTier: pick.tier,
    retrievedAt,
  });
  return { matched: true, ...mapped };
}

async function fetchPrefixCached(
  prefix: string,
  cache: Map<string, CrLocalSearchResult>,
  deadlineMs: number,
  stats: CrLookupFetchStats,
): Promise<CrLocalSearchResult> {
  const cached = cache.get(prefix);
  if (cached) return cached;
  const res = await searchCrLocalByNameBeginsWith(prefix, {
    signal: fetchSignal(deadlineMs),
    deadlineMs,
    stats,
  });
  cache.set(prefix, res);
  return res;
}

async function resolveNamePrefixes(
  label: string,
  searchLabelUsed: string,
  retrievedAt: string,
  deadlineMs: number,
  stats: CrLookupFetchStats,
): Promise<
  | { kind: "snapshot"; snapshot: CrMappedSnapshot }
  | { kind: "degraded"; reason: "timeout" | "error" }
> {
  const primary = buildNameSearchPrefixes(label);
  const allAttempts = allNameSearchPrefixAttempts(label);
  if (primary.length === 0) {
    return { kind: "snapshot", snapshot: inconclusiveCrSnapshot(retrievedAt) };
  }

  const prefixCache = new Map<string, CrLocalSearchResult>();
  let candidates: CrApiLocalRow[] | null = null;

  const takePick = (pick: CrPickResult): CrMappedSnapshot | undefined => {
    if (pick === "ambiguous") return ambiguousCrSnapshot(retrievedAt);
    if (isCrMatchedPick(pick)) return matchedFromPick(pick, retrievedAt);
    if (pick?.tier === "D") {
      if (!candidates || pick.rows.length < candidates.length) {
        candidates = pick.rows;
      }
    }
    return undefined;
  };

  for (const prefix of primary) {
    const res = await fetchPrefixCached(prefix, prefixCache, deadlineMs, stats);
    if (res.kind === "error") {
      return toDegraded(res.message);
    }
    if (res.kind === "no_result") {
      continue;
    }
    const done = takePick(pickMatchedRows(res.rows, searchLabelUsed));
    if (done) return { kind: "snapshot", snapshot: done };
  }

  for (const prefix of allAttempts.slice(0, 4)) {
    const res = await fetchPrefixCached(prefix, prefixCache, deadlineMs, stats);
    if (res.kind === "error") {
      return toDegraded(res.message);
    }
    if (res.kind === "rows") {
      const done = takePick(pickMatchedRows(res.rows, searchLabelUsed));
      if (done) return { kind: "snapshot", snapshot: done };
    }
  }

  if (candidates) {
    const snapshot = candidateCrSnapshot(candidates, retrievedAt);
    if (snapshot) return { kind: "snapshot", snapshot };
  }

  // Untried variants (beyond the cap) are literal extensions of the shorter
  // prefixes already tried, so begins_with cannot return rows for them.
  const tried = [...prefixCache.values()];
  const allNoResult =
    tried.length > 0 &&
    primary.every((p) => prefixCache.get(p)?.kind === "no_result") &&
    tried.every((r) => r.kind === "no_result");
  if (allNoResult) {
    return { kind: "snapshot", snapshot: notFoundCrSnapshot(retrievedAt) };
  }
  return { kind: "snapshot", snapshot: inconclusiveCrSnapshot(retrievedAt) };
}

async function runLiveLookup(
  input: NormalizedSearchInput,
  searchLabelUsed: string,
  stats: CrLookupFetchStats,
): Promise<
  | { kind: "snapshot"; snapshot: CrMappedSnapshot }
  | { kind: "degraded"; reason: "timeout" | "error" }
  | { kind: "no_query" }
> {
  const retrievedAt = new Date().toISOString();
  const deadlineMs = Date.now() + CR_LOOKUP_BUDGET_MS;
  if (!hasCrApiQueryPath(input, searchLabelUsed)) {
    return { kind: "no_query" };
  }

  const nameLabel = input.companyName ?? searchLabelUsed;
  const prefixes = buildNameSearchPrefixes(nameLabel);
  const brnEqual =
    input.br && isCrOpenDataBrnEqualValue(input.br)
      ? input.br.trim()
      : undefined;

  const cacheKey = crRegistryCacheKey({
    brnEqual,
    namePrefixes: allNameSearchPrefixAttempts(nameLabel),
    searchLabelUsed,
  });
  const cached = getCrRegistryCached(cacheKey);
  if (cached) {
    return { kind: "snapshot", snapshot: cached };
  }

  const persist = (snapshot: CrMappedSnapshot) => {
    setCrRegistryCached(cacheKey, snapshot);
    return { kind: "snapshot" as const, snapshot };
  };

  if (brnEqual) {
    const res = await searchCrLocalByBrnEqual(brnEqual, {
      signal: fetchSignal(deadlineMs),
      deadlineMs,
      stats,
    });
    if (res.kind === "error") {
      return toDegraded(res.message);
    }
    if (res.kind === "no_result") {
      const hasName =
        Boolean(input.companyName?.trim()) ||
        /\p{L}/u.test(searchLabelUsed.trim());
      if (hasName) {
        const nameResult = await resolveNamePrefixes(
          nameLabel,
          searchLabelUsed,
          retrievedAt,
          deadlineMs,
          stats,
        );
        if (nameResult.kind === "degraded") return nameResult;
        return persist(nameResult.snapshot);
      }
      return persist(notFoundCrSnapshot(retrievedAt));
    }
    if (res.rows.length >= 1) {
      const row = res.rows[0]!;
      const tier = tierForRow(row, searchLabelUsed);
      if (!tier) {
        return persist(inconclusiveCrSnapshot(retrievedAt));
      }
      if (res.rows.length > 1) {
        const pick = pickMatchedRows(res.rows, searchLabelUsed);
        if (pick === "ambiguous") {
          return persist(ambiguousCrSnapshot(retrievedAt));
        }
        if (isCrMatchedPick(pick)) {
          return persist(matchedFromPick(pick, retrievedAt));
        }
        return persist(inconclusiveCrSnapshot(retrievedAt));
      }
      return persist(
        matchedFromPick({ tier, row }, retrievedAt),
      );
    }
  }

  if (prefixes.length === 0) {
    return { kind: "no_query" };
  }

  const nameResult = await resolveNamePrefixes(
    nameLabel,
    searchLabelUsed,
    retrievedAt,
    deadlineMs,
    stats,
  );
  if (nameResult.kind === "degraded") return nameResult;
  return persist(nameResult.snapshot);
}

export async function lookupCompaniesRegistryForSearch(
  input: NormalizedSearchInput,
  searchLabelUsed: string,
  mwcRow: MwcRow | null,
): Promise<CompaniesRegistryOfficial> {
  if (!shouldRunCompaniesRegistryLookup(input, searchLabelUsed, mwcRow)) {
    return {
      lookupStatus: "skipped",
      retrievedAt: new Date().toISOString(),
      hints: [],
      icrisHomeUrl: CR_ESERVICES_URL,
    };
  }

  const startedAt = Date.now();
  const stats: CrLookupFetchStats = {
    fetchCount: 0,
    lastHttpStatus: null,
  };

  try {
    const live = await runLiveLookup(input, searchLabelUsed, stats);
    if (live.kind === "degraded") {
      console.warn(
        JSON.stringify({
          event: "cr_lookup_failed",
          reason: live.reason,
          ...crLogFields(stats, startedAt),
        }),
      );
      return {
        lookupStatus: live.reason === "timeout" ? "timeout" : "error",
        retrievedAt: new Date().toISOString(),
        hints: [],
        icrisHomeUrl: CR_ESERVICES_URL,
      };
    }
    if (live.kind === "no_query") {
      return {
        lookupStatus: "ok",
        matched: false,
        retrievedAt: new Date().toISOString(),
        hints: [],
        icrisHomeUrl: CR_ESERVICES_URL,
      };
    }

    const snap = live.snapshot;
    console.info(
      JSON.stringify({
        event: "cr_lookup",
        matched: snap.matched,
        match_ambiguous: Boolean(snap.matchAmbiguous),
        hint_count: snap.hints.length,
        cache_hit: stats.fetchCount === 0,
        ...crLogFields(stats, startedAt),
      }),
    );

    return snapshotToOfficial("ok", snap);
  } catch {
    console.warn(
      JSON.stringify({
        event: "cr_lookup_failed",
        reason: "exception",
        ...crLogFields(stats, startedAt),
      }),
    );
    return {
      lookupStatus: "error",
      retrievedAt: new Date().toISOString(),
      hints: [],
      icrisHomeUrl: CR_ESERVICES_URL,
    };
  }
}
