/**
 * D2 — filter D1 candidates (MWC defendant focus, DEC-0012 amendment).
 *
 *   pnpm d2:filter-candidates
 *   pnpm d2:filter-candidates --dry-run
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { judgmentCandidatesManifestSchema } from "../src/lib/judgment-candidates-schema";
import {
  defaultDefendantPartyLabel,
  defaultPlaintiffPartyLabel,
  splitPartiesLineWithRetry,
} from "../src/lib/judgment-d2-parties";
import { runD2Gates, type D2Disposition } from "../src/lib/judgment-d2-gates";
import { lookupMwcForPartyLabel } from "../src/lib/judgment-d2-mwc-match";
import { courtFromCaseRef } from "../src/lib/court-from-case-ref";

const IN_PATH = resolve(
  process.cwd(),
  "scripts/output/judgment-candidates.json",
);
const OUT_QUEUE = resolve(
  process.cwd(),
  "scripts/output/judgment-d2-queue.json",
);
const OUT_KEEPS = resolve(
  process.cwd(),
  "scripts/output/judgment-d2-keep.json",
);
const PROFILES_PATH = resolve(
  process.cwd(),
  "scripts/config/lrs-ingestion-profiles.json",
);
const COURT_CONFIG = resolve(
  process.cwd(),
  "scripts/config/court-from-case-ref.json",
);

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

async function main() {
  loadEnvLocal();
  const dryRun = process.argv.includes("--dry-run");

  const url =
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error("Missing Supabase env");
    process.exit(1);
  }

  const raw = JSON.parse(readFileSync(IN_PATH, "utf8"));
  const manifest = judgmentCandidatesManifestSchema.parse(raw);

  const profiles = JSON.parse(readFileSync(PROFILES_PATH, "utf8")) as {
    caseRefSkipPrefixes: string[];
    caseRefPriorityPrefixes: string[];
  };
  const courtPrefixes = (
    JSON.parse(readFileSync(COURT_CONFIG, "utf8")) as {
      prefixes: Record<string, string>;
    }
  ).prefixes;

  const supabase = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const entries: Array<Record<string, unknown>> = [];
  const counts: Record<D2Disposition, number> = {
    keep: 0,
    drop: 0,
    review: 0,
  };

  for (const row of manifest.candidates) {
    const { split } = splitPartiesLineWithRetry(row.partiesLine);
    let mwcLeft = null;
    let mwcRight = null;
    if (split) {
      const partyLabels = [split.left, split.right];
      mwcLeft = await lookupMwcForPartyLabel(
        supabase,
        defaultPlaintiffPartyLabel(split),
        partyLabels,
      );
      mwcRight = await lookupMwcForPartyLabel(
        supabase,
        defaultDefendantPartyLabel(split),
        partyLabels,
      );
    }

    const gate = runD2Gates({
      row,
      skipPrefixes: profiles.caseRefSkipPrefixes,
      priorityPrefixes: profiles.caseRefPriorityPrefixes,
      mwcLeft,
      mwcRight,
      partiesSplit: split,
    });
    counts[gate.disposition] += 1;

    entries.push({
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
    });
  }

  const generatedAt = new Date().toISOString();
  const queue = {
    schemaVersion: 1,
    generatedAt,
    policy: "company_defendant_v3d",
    summary: counts,
    entries,
  };

  const keeps = entries.filter((e) => e.disposition === "keep");

  if (!dryRun) {
    mkdirSync(resolve(process.cwd(), "scripts/output"), { recursive: true });
    writeFileSync(OUT_QUEUE, `${JSON.stringify(queue, null, 2)}\n`, "utf8");
    writeFileSync(OUT_KEEPS, `${JSON.stringify(keeps, null, 2)}\n`, "utf8");
  }

  console.info(
    JSON.stringify({
      event: "d2_filter_candidates_done",
      dryRun,
      inputCount: manifest.candidates.length,
      summary: counts,
      queuePath: dryRun ? null : OUT_QUEUE,
      keepPath: dryRun ? null : OUT_KEEPS,
    }),
  );
}

main().catch((err) => {
  console.error(
    JSON.stringify({ event: "d2_filter_candidates_failed", error: String(err) }),
  );
  process.exit(1);
});
