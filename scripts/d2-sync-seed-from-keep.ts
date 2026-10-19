/**
 * Rebuild judgments-seed.local.json from judgment-d2-keep.json (v3 policy).
 * Preserves human_verified hearing text when case still in keep set.
 *
 *   pnpm d2:sync-seed
 *   pnpm d2:sync-seed --dry-run
 */
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { execSync } from "node:child_process";
import { courtFromCaseRef } from "../src/lib/court-from-case-ref";
import {
  normalizeLookupAliases,
  suggestLookupAliases,
} from "../src/lib/judgment-lookup-match";
import { brNormalizedFromSeedField } from "../src/lib/normalize-br";
import {
  HEARING_SUMMARY_AUTO_PLACEHOLDER_ZH,
  isHearingSummaryPlaceholder,
} from "../src/lib/judgment-hearing-summary";
import { seedOutcomeOverride } from "../src/lib/judgment-seed-outcome-overrides";

const KEEP_PATH = resolve(
  process.cwd(),
  "scripts/output/judgment-d2-keep.json",
);
const CAND_PATH = resolve(
  process.cwd(),
  "scripts/output/judgment-candidates.json",
);
const SEED_PATH = resolve(
  process.cwd(),
  "scripts/fixtures/judgments-seed.local.json",
);
const COURT_CONFIG = resolve(
  process.cwd(),
  "scripts/config/court-from-case-ref.json",
);

type KeepRow = {
  caseRef: string;
  defendantLabel: string;
  plaintiffLabel?: string;
  mwcMatch?: { companyName: string; registrationNo: string };
  reviewLookupAliases?: string[];
  sourceUrl: string;
  reviewJudgmentCategory?: string;
};

type SeedRow = Record<string, unknown>;

function normRef(r: string): string {
  return r.replace(/\s+/g, "").toUpperCase();
}

function displayCaseRef(caseRef: string): string {
  const c = caseRef.replace(/\s+/g, "");
  const m = c.match(/^([A-Z]{2,6})(\d+\/\d{4})$/i);
  if (m) return `${m[1].toUpperCase()} ${m[2]}`;
  return caseRef.trim();
}

function toJuFrameUrl(url: string): string {
  const m = url.match(/DIS=(\d+)/i);
  if (m) {
    return `https://legalref.judiciary.hk/lrs/common/ju/ju_frame.jsp?DIS=${m[1]}&TP=JU`;
  }
  return url;
}

function seedRowFromKeep(
  k: KeepRow,
  meta: { eventDate: string; partiesLine: string; neutralCitation?: string },
  prefixes: Record<string, string>,
  prior?: SeedRow,
): SeedRow {
  const caseRef = displayCaseRef(k.caseRef);
  const defendant = k.defendantLabel.trim();
  const plaintiff = k.plaintiffLabel?.trim();
  const partyNames = plaintiff ? [plaintiff, defendant] : [defendant];
  const aliases = normalizeLookupAliases(defendant, [
    ...suggestLookupAliases(defendant, partyNames),
    ...(k.reviewLookupAliases ?? []),
  ]);
  const br = brNormalizedFromSeedField(k.mwcMatch?.registrationNo);

  const priorPoints = Array.isArray(prior?.hearingKeyPointsZh)
    ? (prior.hearingKeyPointsZh as string[])
    : [];
  const priorVerified =
    prior?.reviewStatus === "human_verified" ||
    priorPoints.some((p) => !isHearingSummaryPlaceholder(p));

  return {
    sourceType: "court_judgment",
    sourceCatalogId: "legalref-lrs-ju",
    caseRef,
    court:
      courtFromCaseRef(caseRef, prefixes) ??
      courtFromCaseRef(k.caseRef, prefixes) ??
      "District Court",
    eventDate: meta.eventDate,
    partyNames,
    companyNameNormalized: defendant,
    ...(br ? { brNormalized: br } : {}),
    ...(aliases.length ? { lookupAliases: aliases } : {}),
    judgmentCategory:
      k.reviewJudgmentCategory ?? "renovation_engineering_civil",
    partyRole: "defendant",
    outcomeHint:
      seedOutcomeOverride(caseRef) ??
      (typeof prior?.outcomeHint === "string" ? prior.outcomeHint : undefined) ??
      "unclear",
    procedureStage: "unknown",
    hearingKeyPointsZh: priorVerified
      ? priorPoints
      : [HEARING_SUMMARY_AUTO_PLACEHOLDER_ZH],
    reviewStatus: priorVerified ? "human_verified" : "auto",
    sourceUrl: toJuFrameUrl(k.sourceUrl),
    renovationRelevant: true,
    ...(meta.neutralCitation
      ? { topicTags: [`neutral_citation:${meta.neutralCitation}`] }
      : {}),
  };
}

function main() {
  const dryRun = process.argv.includes("--dry-run");
  const prefixes = (
    JSON.parse(readFileSync(COURT_CONFIG, "utf8")) as {
      prefixes: Record<string, string>;
    }
  ).prefixes;

  const keeps = JSON.parse(readFileSync(KEEP_PATH, "utf8")) as KeepRow[];
  const cand = JSON.parse(readFileSync(CAND_PATH, "utf8")) as {
    candidates: Array<{
      caseRef: string;
      eventDate: string;
      partiesLine: string;
      neutralCitation?: string;
    }>;
  };
  const byRef = new Map(
    cand.candidates.map((c) => [normRef(c.caseRef), c]),
  );

  let priorRows: SeedRow[] = [];
  try {
    priorRows = JSON.parse(readFileSync(SEED_PATH, "utf8")) as SeedRow[];
  } catch {
    priorRows = [];
  }
  const priorByRef = new Map(
    priorRows.map((r) => [normRef(String(r.caseRef)), r]),
  );

  const next: SeedRow[] = [];
  for (const k of keeps) {
    const key = normRef(k.caseRef);
    const meta = byRef.get(key);
    if (!meta) {
      console.error(
        JSON.stringify({ event: "d2_sync_seed_no_candidate", caseRef: k.caseRef }),
      );
      process.exit(1);
    }
    next.push(seedRowFromKeep(k, meta, prefixes, priorByRef.get(key)));
  }

  console.info(
    JSON.stringify({
      event: "d2_sync_seed_prepared",
      keepRows: keeps.length,
      priorRows: priorRows.length,
      nextRows: next.length,
      dryRun,
    }),
  );

  if (dryRun) return;

  writeFileSync(SEED_PATH, `${JSON.stringify(next, null, 2)}\n`, "utf8");
  execSync("pnpm validate:judgments-seed --min-renovation=5", {
    stdio: "inherit",
    cwd: process.cwd(),
  });
}

main();
