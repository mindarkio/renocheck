/**
 * Regenerate scripts/fixtures/judgment-d2-filter-golden.json from parity candidates.
 *   pnpm exec tsx scripts/write-judgment-d2-filter-golden.ts
 */
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { judgmentCandidatesManifestSchema } from "../src/lib/judgment-candidates-schema";
import { MwcContractorsMemoryIndex } from "../src/lib/mwc-contractors-memory-index";
import { runD2FilterPipeline } from "../src/lib/judgment-d2-filter-pipeline";

const GOLDEN_PATH = resolve(
  process.cwd(),
  "scripts/fixtures/judgment-d2-filter-golden.json",
);
const CANDIDATES_PATH = resolve(
  process.cwd(),
  "scripts/fixtures/judgment-candidates-d2-parity.json",
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
  const url =
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error("Missing Supabase env");
    process.exit(1);
  }

  const manifest = judgmentCandidatesManifestSchema.parse(
    JSON.parse(readFileSync(CANDIDATES_PATH, "utf8")),
  );
  const profiles = JSON.parse(
    readFileSync(
      resolve(process.cwd(), "scripts/config/lrs-ingestion-profiles.json"),
      "utf8",
    ),
  ) as {
    caseRefSkipPrefixes: string[];
    caseRefPriorityPrefixes: string[];
  };
  const courtPrefixes = (
    JSON.parse(
      readFileSync(
        resolve(process.cwd(), "scripts/config/court-from-case-ref.json"),
        "utf8",
      ),
    ) as { prefixes: Record<string, string> }
  ).prefixes;

  const supabase = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const mwcIndex = await MwcContractorsMemoryIndex.loadAll(supabase);
  const mwcSnapshotSha = mwcIndex.snapshotContentHash();

  const { entries, counts } = runD2FilterPipeline({
    candidates: manifest.candidates,
    skipPrefixes: profiles.caseRefSkipPrefixes,
    priorityPrefixes: profiles.caseRefPriorityPrefixes,
    courtPrefixes,
    mwcIndex,
    mwcSnapshotSha,
    useStepCache: false,
    writeStepCache: false,
  });

  const golden = {
    policy: "company_defendant_v3e",
    summary: counts,
    entryCount: entries.length,
    entries: entries.map((e) => ({
      caseRef: e.caseRef,
      disposition: e.disposition,
      reasons: e.reasons,
    })),
  };

  writeFileSync(GOLDEN_PATH, `${JSON.stringify(golden)}\n`, "utf8");
  console.info(JSON.stringify({ event: "d2_golden_written", summary: counts }));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
