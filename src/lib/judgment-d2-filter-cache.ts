import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import type { JudgmentCandidateRow } from "./judgment-candidates-schema";
import type { SplitParties } from "./judgment-d2-parties";
import type { MwcMatchSummary } from "./judgment-d2-gates";
import type { D2Disposition } from "./judgment-d2-gates";
import { manualTriageRevisionHash } from "./judgment-d2-manual-triage";
import { listD2RulesBundleFiles } from "./judgment-d2-rules-bundle";

export const D2_FILTER_POLICY = "company_defendant_v3e";

const LRS_PROFILES_PATH = "scripts/config/lrs-ingestion-profiles.json";

export type D2CachedGate = {
  disposition: D2Disposition;
  reasons: string[];
  defendantLabel?: string;
  plaintiffLabel?: string;
  renovationRelevantSuggested: boolean;
  mwcMatch?: MwcMatchSummary;
  reviewJudgmentCategory?: string;
  reviewLookupAliases?: string[];
};

export type D2CachedCandidateStep = {
  contentHash: string;
  partiesLine: string;
  parse: { split: SplitParties | null; retried: boolean };
  mwcLeft: MwcMatchSummary | null;
  mwcRight: MwcMatchSummary | null;
  gate: D2CachedGate;
};

export type D2FilterStepCacheFile = {
  schemaVersion: 1;
  policy: string;
  pipelineRev?: string;
  updatedAt: string;
  byCaseRef: Record<string, D2CachedCandidateStep>;
};

const DEFAULT_CACHE_PATH = resolve(
  process.cwd(),
  "scripts/output/d2-candidate-step-cache.json",
);

export function normalizeCaseRefKey(caseRef: string): string {
  return caseRef.replace(/\s+/g, "").toUpperCase();
}

function sha256File(relativePath: string): string {
  const absolute = resolve(process.cwd(), relativePath);
  return createHash("sha256").update(readFileSync(absolute)).digest("hex");
}

/** SHA-256 (hex) of D2 gate / rules source bundle. */
export function d2RulesBundleContentSha(cwd = process.cwd()): string {
  const parts = listD2RulesBundleFiles(cwd).map((p) => sha256File(p));
  return createHash("sha256").update(parts.join("")).digest("hex").slice(0, 16);
}

export function d2PipelineRevisionHash(mwcSnapshotSha: string): string {
  const profilesSha = sha256File(LRS_PROFILES_PATH).slice(0, 16);
  return createHash("sha256")
    .update(
      JSON.stringify({
        rules: d2RulesBundleContentSha(),
        profiles: profilesSha,
        mwc: mwcSnapshotSha,
        manualTriage: manualTriageRevisionHash(),
        policy: D2_FILTER_POLICY,
      }),
    )
    .digest("hex")
    .slice(0, 16);
}

/** Stable hash for candidate row (parse / gate inputs). */
export function judgmentCandidateContentHash(
  row: JudgmentCandidateRow,
  mwcSnapshotSha: string,
): string {
  const payload = JSON.stringify({
    caseRef: normalizeCaseRefKey(row.caseRef),
    partiesLine: row.partiesLine.trim(),
    eventDate: row.eventDate,
    database: row.database,
    profileId: row.discoveredFrom.profileId,
    pipelineRev: d2PipelineRevisionHash(mwcSnapshotSha),
  });
  return createHash("sha256").update(payload).digest("hex");
}

export function loadD2FilterStepCache(
  mwcSnapshotSha: string,
  path = DEFAULT_CACHE_PATH,
): D2FilterStepCacheFile {
  const pipelineRev = d2PipelineRevisionHash(mwcSnapshotSha);
  if (!existsSync(path)) {
    return {
      schemaVersion: 1,
      policy: D2_FILTER_POLICY,
      pipelineRev,
      updatedAt: new Date(0).toISOString(),
      byCaseRef: {},
    };
  }
  const raw = JSON.parse(readFileSync(path, "utf8")) as D2FilterStepCacheFile;
  if (raw.policy !== D2_FILTER_POLICY || raw.pipelineRev !== pipelineRev) {
    return {
      schemaVersion: 1,
      policy: D2_FILTER_POLICY,
      pipelineRev,
      updatedAt: new Date(0).toISOString(),
      byCaseRef: {},
    };
  }
  return raw;
}

export function saveD2FilterStepCache(
  cache: D2FilterStepCacheFile,
  mwcSnapshotSha: string,
  path = DEFAULT_CACHE_PATH,
): void {
  mkdirSync(resolve(path, ".."), { recursive: true });
  writeFileSync(
    path,
    `${JSON.stringify(
      {
        ...cache,
        pipelineRev: d2PipelineRevisionHash(mwcSnapshotSha),
        updatedAt: new Date().toISOString(),
      },
      null,
      2,
    )}\n`,
    "utf8",
  );
}

export function getCachedStepIfValid(
  cache: D2FilterStepCacheFile,
  row: JudgmentCandidateRow,
  mwcSnapshotSha: string,
): D2CachedCandidateStep | null {
  const key = normalizeCaseRefKey(row.caseRef);
  const entry = cache.byCaseRef[key];
  if (!entry) return null;
  const hash = judgmentCandidateContentHash(row, mwcSnapshotSha);
  if (entry.contentHash !== hash) return null;
  if (entry.partiesLine !== row.partiesLine.trim()) return null;
  return entry;
}
