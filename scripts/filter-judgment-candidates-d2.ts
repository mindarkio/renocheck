/**
 * D2 — filter D1 candidates (MWC defendant focus, DEC-0012 amendment).
 *
 *   pnpm d2:filter-candidates
 *   pnpm d2:filter-candidates --dry-run
 *   pnpm d2:filter-candidates --profile
 *   pnpm d2:filter-candidates --only="CACV 131/2005"
 *   pnpm d2:filter-candidates --changed
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { judgmentCandidatesManifestSchema } from "../src/lib/judgment-candidates-schema";
import type { D2Disposition } from "../src/lib/judgment-d2-gates";
import {
  loadD2FilterStepCache,
  saveD2FilterStepCache,
} from "../src/lib/judgment-d2-filter-cache";
import { runD2FilterPipeline } from "../src/lib/judgment-d2-filter-pipeline";
import { MwcContractorsMemoryIndex } from "../src/lib/mwc-contractors-memory-index";

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

function argValue(prefix: string): string | undefined {
  const a = process.argv.find((x) => x.startsWith(`${prefix}=`));
  if (!a) return undefined;
  const raw = a.slice(prefix.length + 1);
  if (
    (raw.startsWith('"') && raw.endsWith('"')) ||
    (raw.startsWith("'") && raw.endsWith("'"))
  ) {
    return raw.slice(1, -1);
  }
  return raw;
}

async function main() {
  loadEnvLocal();
  const dryRun = process.argv.includes("--dry-run");
  const profile = process.argv.includes("--profile");
  const noCache = process.argv.includes("--no-cache");
  const changedOnly = process.argv.includes("--changed");
  const onlyCaseRef = argValue("--only");
  const timings: Record<string, number> = {};

  const tRead = performance.now();
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
  timings.read_files_ms = performance.now() - tRead;

  const tParse = performance.now();
  const stepCache = noCache ? loadD2FilterStepCache() : loadD2FilterStepCache();
  if (noCache) stepCache.byCaseRef = {};
  timings.parse_manifest_ms = performance.now() - tParse;

  const supabase = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const tMwc = performance.now();
  const mwcIndex = await MwcContractorsMemoryIndex.loadAll(supabase);
  timings.load_mwc_index_ms = performance.now() - tMwc;
  timings.mwc_rows = mwcIndex.size;

  const tPipeline = performance.now();
  const { entries, counts, timingsMs, cache } = runD2FilterPipeline({
    candidates: manifest.candidates,
    skipPrefixes: profiles.caseRefSkipPrefixes,
    priorityPrefixes: profiles.caseRefPriorityPrefixes,
    courtPrefixes,
    mwcIndex,
    stepCache,
    useStepCache: !noCache,
    writeStepCache: !dryRun && !onlyCaseRef,
    onlyCaseRef,
    changedOnly,
  });
  timings.filter_pipeline_ms = performance.now() - tPipeline;
  timings.parse_parties_ms = timingsMs.parseParties;
  timings.mwc_lookup_ms = timingsMs.mwcLookup;
  timings.run_gates_ms = timingsMs.runGates;
  timings.cache_hits = timingsMs.cacheHits;
  timings.cache_misses = timingsMs.cacheMisses;

  if (!dryRun && !onlyCaseRef) {
    const tWrite = performance.now();
    saveD2FilterStepCache(cache);
    timings.write_cache_ms = performance.now() - tWrite;
  }

  const generatedAt = new Date().toISOString();
  const queue = {
    schemaVersion: 1,
    generatedAt,
    policy: "company_defendant_v3e",
    summary: counts,
    entries,
  };

  const keeps = entries.filter((e) => e.disposition === "keep");

  const reportPriorDrops = process.argv.includes("--report-prior-keep-drops");
  if (reportPriorDrops && !onlyCaseRef) {
    try {
      const priorRaw = readFileSync(OUT_KEEPS, "utf8");
      const prior = JSON.parse(priorRaw) as Array<{ caseRef: string }>;
      const priorKeys = new Set(
        prior.map((p) => p.caseRef.replace(/\s+/g, "").toUpperCase()),
      );
      const droppedFromPrior = entries.filter((e) => {
        const key = String(e.caseRef ?? "").replace(/\s+/g, "").toUpperCase();
        return priorKeys.has(key) && e.disposition === "drop";
      });
      const outPath = resolve(
        process.cwd(),
        "scripts/output/d2-prior-keep-drops.json",
      );
      mkdirSync(resolve(outPath, ".."), { recursive: true });
      writeFileSync(
        outPath,
        `${JSON.stringify(
          {
            generatedAt,
            priorKeepCount: prior.length,
            newKeepCount: keeps.length,
            droppedFromPrior: droppedFromPrior.map((e) => ({
              caseRef: e.caseRef,
              reasons: e.reasons,
              defendantLabel: e.defendantLabel,
              plaintiffLabel: e.plaintiffLabel,
            })),
          },
          null,
          2,
        )}\n`,
        "utf8",
      );
      console.info(
        JSON.stringify({
          event: "d2_prior_keep_drops_report",
          path: outPath,
          droppedCount: droppedFromPrior.length,
        }),
      );
    } catch (err) {
      console.error(
        JSON.stringify({
          event: "d2_prior_keep_drops_report_failed",
          error: String(err),
        }),
      );
    }
  }

  if (!dryRun && !onlyCaseRef) {
    const tWrite = performance.now();
    mkdirSync(resolve(process.cwd(), "scripts/output"), { recursive: true });
    writeFileSync(OUT_QUEUE, `${JSON.stringify(queue, null, 2)}\n`, "utf8");
    writeFileSync(OUT_KEEPS, `${JSON.stringify(keeps, null, 2)}\n`, "utf8");
    timings.write_output_ms = performance.now() - tWrite;
  }

  const payload: Record<string, unknown> = {
    event: "d2_filter_candidates_done",
    dryRun,
    onlyCaseRef: onlyCaseRef ?? null,
    changedOnly,
    inputCount: manifest.candidates.length,
    processedCount: entries.length,
    summary: counts,
    queuePath: dryRun || onlyCaseRef ? null : OUT_QUEUE,
    keepPath: dryRun || onlyCaseRef ? null : OUT_KEEPS,
  };
  if (profile) {
    payload.profileMs = timings;
  }

  console.info(JSON.stringify(payload));
}

main().catch((err) => {
  console.error(
    JSON.stringify({ event: "d2_filter_candidates_failed", error: String(err) }),
  );
  process.exit(1);
});
