/**
 * D2 B1 — merge judgment-d2-keep.json into judgments-seed.local.json + import
 *
 *   pnpm d2:import-keep
 *   pnpm d2:import-keep --dry-run
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
import { HEARING_SUMMARY_AUTO_PLACEHOLDER_ZH } from "../src/lib/judgment-hearing-summary";

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
  sourceUrl: string;
};

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
    }>;
  };
  const byRef = new Map(
    cand.candidates.map((c) => [normRef(c.caseRef), c]),
  );

  const existing = JSON.parse(readFileSync(SEED_PATH, "utf8")) as Array<{
    caseRef: string;
  }>;
  const seedByRef = new Map(existing.map((r) => [normRef(r.caseRef), r]));

  const added: string[] = [];
  for (const k of keeps) {
    const key = normRef(k.caseRef);
    if (seedByRef.has(key)) continue;
    const meta = byRef.get(key);
    if (!meta) {
      console.error(JSON.stringify({ event: "d2_import_keep_no_candidate", caseRef: k.caseRef }));
      process.exit(1);
    }
    const caseRef = displayCaseRef(k.caseRef);
    const defendant = k.defendantLabel.trim();
    const plaintiff = k.plaintiffLabel?.trim();
    const partyNames = plaintiff ? [plaintiff, defendant] : [defendant];
    const aliases = normalizeLookupAliases(
      defendant,
      suggestLookupAliases(defendant, partyNames),
    );
    const br = brNormalizedFromSeedField(k.mwcMatch?.registrationNo);

    const row = {
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
      judgmentCategory: "renovation_engineering_civil",
      partyRole: "defendant",
      outcomeHint: "unknown",
      procedureStage: "unknown",
      hearingKeyPointsZh: [HEARING_SUMMARY_AUTO_PLACEHOLDER_ZH],
      reviewStatus: "auto",
      sourceUrl: toJuFrameUrl(k.sourceUrl),
      renovationRelevant: true,
    };
    existing.push(row);
    seedByRef.set(key, row);
    added.push(caseRef);
  }

  console.info(
    JSON.stringify({
      event: "d2_import_keep_prepared",
      added,
      seedRows: existing.length,
      dryRun,
    }),
  );

  if (dryRun || added.length === 0) return;

  writeFileSync(SEED_PATH, `${JSON.stringify(existing, null, 2)}\n`, "utf8");
  execSync("pnpm validate:judgments-seed --min-renovation=5", {
    stdio: "inherit",
    cwd: process.cwd(),
  });
  execSync(`pnpm import:judgments --file=${SEED_PATH}`, {
    stdio: "inherit",
    cwd: process.cwd(),
  });
}

main();
