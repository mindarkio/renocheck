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
  inconclusiveCrSnapshot,
  mapCrApiRowToSnapshot,
  notFoundCrSnapshot,
} from "./cr-register/map-row";
import {
  allNameSearchPrefixAttempts,
  buildNameSearchPrefixes,
  pickMatchedRows,
  tierForRow,
} from "./cr-register/match";
import {
  crRegistryCacheKey,
  getCrRegistryCached,
  setCrRegistryCached,
} from "./cr-register/memory-cache";
import type { CrMappedSnapshot } from "./cr-register/types";
import type { MwcRow } from "./mwc-lookup";
import type { NormalizedSearchInput } from "./normalize-search-input";

const LOOKUP_BUDGET_MS = 6000;

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
  };
}

function fetchSignal(deadlineMs: number): AbortSignal | undefined {
  const left = deadlineMs - Date.now();
  if (left <= 0) return AbortSignal.timeout(1);
  return AbortSignal.timeout(left);
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
  pick: { tier: "A" | "B" | "C"; row: import("./cr-register/types").CrApiLocalRow },
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
): Promise<CrLocalSearchResult> {
  const cached = cache.get(prefix);
  if (cached) return cached;
  const res = await searchCrLocalByNameBeginsWith(prefix, {
    signal: fetchSignal(deadlineMs),
  });
  cache.set(prefix, res);
  return res;
}

async function resolveNamePrefixes(
  label: string,
  searchLabelUsed: string,
  retrievedAt: string,
  deadlineMs: number,
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

  for (const prefix of primary) {
    const res = await fetchPrefixCached(prefix, prefixCache, deadlineMs);
    if (res.kind === "error") {
      return toDegraded(res.message);
    }
    if (res.kind === "no_result") {
      continue;
    }
    const pick = pickMatchedRows(res.rows, searchLabelUsed);
    if (pick === "ambiguous") {
      return { kind: "snapshot", snapshot: ambiguousCrSnapshot(retrievedAt) };
    }
    if (pick) {
      return { kind: "snapshot", snapshot: matchedFromPick(pick, retrievedAt) };
    }
  }

  for (const prefix of allAttempts) {
    const res = await fetchPrefixCached(prefix, prefixCache, deadlineMs);
    if (res.kind === "error") {
      return toDegraded(res.message);
    }
    if (res.kind === "rows") {
      const pick = pickMatchedRows(res.rows, searchLabelUsed);
      if (pick === "ambiguous") {
        return { kind: "snapshot", snapshot: ambiguousCrSnapshot(retrievedAt) };
      }
      if (pick) {
        return {
          kind: "snapshot",
          snapshot: matchedFromPick(pick, retrievedAt),
        };
      }
    }
  }

  const allNoResult =
    allAttempts.length > 0 &&
    allAttempts.every((p) => prefixCache.get(p)?.kind === "no_result");
  if (allNoResult) {
    return { kind: "snapshot", snapshot: notFoundCrSnapshot(retrievedAt) };
  }
  return { kind: "snapshot", snapshot: inconclusiveCrSnapshot(retrievedAt) };
}

async function runLiveLookup(
  input: NormalizedSearchInput,
  searchLabelUsed: string,
): Promise<
  | { kind: "snapshot"; snapshot: CrMappedSnapshot }
  | { kind: "degraded"; reason: "timeout" | "error" }
  | { kind: "no_query" }
> {
  const retrievedAt = new Date().toISOString();
  const deadlineMs = Date.now() + LOOKUP_BUDGET_MS;
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
        if (pick) {
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

  try {
    const live = await runLiveLookup(input, searchLabelUsed);
    if (live.kind === "degraded") {
      console.warn(
        JSON.stringify({
          event: "cr_lookup_failed",
          reason: live.reason,
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
      }),
    );

    return snapshotToOfficial("ok", snap);
  } catch {
    console.warn(
      JSON.stringify({
        event: "cr_lookup_failed",
        reason: "exception",
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
