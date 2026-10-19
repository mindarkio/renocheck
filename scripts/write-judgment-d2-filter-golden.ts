/**
 * Regenerate scripts/fixtures/judgment-d2-filter-golden.json from parity candidates.
 *   pnpm exec tsx scripts/write-judgment-d2-filter-golden.ts
 */
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { judgmentCandidatesManifestSchema } from "../src/lib/judgment-candidates-schema";
import { MwcContractorsMemoryIndex } from "../src/lib/mwc-contractors-memory-index";
import {
  D2_MWC_ANON_DENIED_MESSAGE,
  d2MwcFailureText,
  decideD2MwcDatabase,
  loadD2GoldenMwcRows,
  selectD2GoldenSupabaseKey,
} from "../src/lib/judgment-d2-golden-gate";
import { runD2FilterPipeline } from "../src/lib/judgment-d2-filter-pipeline";

const GOLDEN_PATH = resolve(
  process.cwd(),
  "scripts/fixtures/judgment-d2-filter-golden.json",
);
const CANDIDATES_PATH = resolve(
  process.cwd(),
  "scripts/fixtures/judgment-candidates-d2-parity.json",
);

async function main() {
  const decision = decideD2MwcDatabase(process.env);
  if (decision.action !== "run") {
    console.error(decision.reason);
    process.exit(1);
  }
  const url =
    process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ||
    process.env.SUPABASE_URL?.trim();
  const keyChoice = selectD2GoldenSupabaseKey(process.env);
  if (!url || !keyChoice.ok) {
    console.error(
      keyChoice.ok
        ? "Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_URL"
        : keyChoice.reason,
    );
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

  const supabase = createClient(url, keyChoice.key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  let mwcRows;
  try {
    mwcRows = await loadD2GoldenMwcRows(supabase);
  } catch (error) {
    const text = d2MwcFailureText(error);
    console.error(text === D2_MWC_ANON_DENIED_MESSAGE ? D2_MWC_ANON_DENIED_MESSAGE : text);
    process.exit(1);
  }
  const mwcIndex = new MwcContractorsMemoryIndex(mwcRows);
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
    policy: "company_defendant_v3f",
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

main().catch((error) => {
  console.error(d2MwcFailureText(error));
  process.exit(1);
});
