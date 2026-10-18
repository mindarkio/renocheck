import type { CompaniesRegistryOfficial } from "./report-schema";
import { CR_ESERVICES_URL } from "./report-trust-copy-zh";
import { isCrOpenDataBrnEqualValue } from "./cr-register/brn";
import {
  searchCrLocalByBrnEqual,
  searchCrLocalByNameBeginsWith,
} from "./cr-register/client";
import {
  hasCrApiQueryPath,
  shouldRunCompaniesRegistryLookup,
} from "./cr-register/eligibility";
import {
  ambiguousCrSnapshot,
  mapCrApiRowToSnapshot,
  notFoundCrSnapshot,
} from "./cr-register/map-row";
import {
  buildNameSearchPrefixes,
  pickMatchedRows,
} from "./cr-register/match";
import {
  crRegistryCacheKey,
  getCrRegistryCached,
  setCrRegistryCached,
} from "./cr-register/memory-cache";
import type { CrMappedSnapshot } from "./cr-register/types";
import type { MwcRow } from "./mwc-lookup";
import type { NormalizedSearchInput } from "./normalize-search-input";

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

async function runLiveLookup(
  input: NormalizedSearchInput,
  searchLabelUsed: string,
): Promise<
  | { kind: "snapshot"; snapshot: CrMappedSnapshot }
  | { kind: "degraded"; reason: "timeout" | "error" }
  | { kind: "no_query" }
> {
  const retrievedAt = new Date().toISOString();
  if (!hasCrApiQueryPath(input, searchLabelUsed)) {
    return { kind: "no_query" };
  }

  const prefixes = buildNameSearchPrefixes(
    input.companyName ?? searchLabelUsed,
  );
  const brnEqual =
    input.br && isCrOpenDataBrnEqualValue(input.br)
      ? input.br.trim()
      : undefined;

  const cacheKey = crRegistryCacheKey({
    brnEqual,
    namePrefixes: prefixes,
  });
  const cached = getCrRegistryCached(cacheKey);
  if (cached) {
    return { kind: "snapshot", snapshot: cached };
  }

  if (brnEqual) {
    const res = await searchCrLocalByBrnEqual(brnEqual);
    if (res.kind === "error") {
      return {
        kind: "degraded",
        reason: res.message === "timeout" ? "timeout" : "error",
      };
    }
    if (res.kind === "no_result") {
      const snap = notFoundCrSnapshot(retrievedAt);
      setCrRegistryCached(cacheKey, snap);
      return { kind: "snapshot", snapshot: snap };
    }
    if (res.rows.length === 1) {
      const mapped = mapCrApiRowToSnapshot(res.rows[0]!, {
        matchTier: "A",
        retrievedAt,
      });
      const snap: CrMappedSnapshot = { matched: true, ...mapped };
      setCrRegistryCached(cacheKey, snap);
      return { kind: "snapshot", snapshot: snap };
    }
    const pick = pickMatchedRows(res.rows, searchLabelUsed);
    if (pick === "ambiguous") {
      const snap = ambiguousCrSnapshot(retrievedAt);
      setCrRegistryCached(cacheKey, snap);
      return { kind: "snapshot", snapshot: snap };
    }
    if (!pick) {
      const snap: CrMappedSnapshot = {
        matched: false,
        retrievedAt,
        hints: [],
        icrisHomeUrl: CR_ESERVICES_URL,
      };
      setCrRegistryCached(cacheKey, snap);
      return { kind: "snapshot", snapshot: snap };
    }
    const mapped = mapCrApiRowToSnapshot(pick.row, {
      matchTier: "A",
      retrievedAt,
    });
    const snap: CrMappedSnapshot = { matched: true, ...mapped };
    setCrRegistryCached(cacheKey, snap);
    return { kind: "snapshot", snapshot: snap };
  }

  if (prefixes.length === 0) {
    return { kind: "no_query" };
  }

  let attempts = 0;
  let allNoResult = true;
  for (const prefix of prefixes.slice(0, 2)) {
    attempts += 1;
    const res = await searchCrLocalByNameBeginsWith(prefix);
    if (res.kind === "error") {
      return {
        kind: "degraded",
        reason: res.message === "timeout" ? "timeout" : "error",
      };
    }
    if (res.kind === "no_result") {
      continue;
    }
    allNoResult = false;
    const pick = pickMatchedRows(res.rows, searchLabelUsed);
    if (pick === "ambiguous") {
      const snap = ambiguousCrSnapshot(retrievedAt);
      setCrRegistryCached(cacheKey, snap);
      return { kind: "snapshot", snapshot: snap };
    }
    if (pick) {
      const mapped = mapCrApiRowToSnapshot(pick.row, {
        matchTier: pick.tier,
        retrievedAt,
      });
      const snap: CrMappedSnapshot = { matched: true, ...mapped };
      setCrRegistryCached(cacheKey, snap);
      return { kind: "snapshot", snapshot: snap };
    }
  }

  if (attempts > 0 && allNoResult) {
    const snap = notFoundCrSnapshot(retrievedAt);
    setCrRegistryCached(cacheKey, snap);
    return { kind: "snapshot", snapshot: snap };
  }

  const snap: CrMappedSnapshot = {
    matched: false,
    retrievedAt,
    hints: [],
    icrisHomeUrl: CR_ESERVICES_URL,
  };
  setCrRegistryCached(cacheKey, snap);
  return { kind: "snapshot", snapshot: snap };
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
}
