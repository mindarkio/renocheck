import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { judgmentCandidatesManifestSchema } from "./judgment-candidates-schema";
import { MwcContractorsMemoryIndex } from "./mwc-contractors-memory-index";
import { runD2FilterPipeline } from "./judgment-d2-filter-pipeline";
import { normalizeCaseRefKey } from "./judgment-d2-filter-cache";
import type { MwcRow } from "./mwc-lookup";
import {
  decideD2GoldenRun,
  d2GoldenMwcSelectList,
  selectD2GoldenSupabaseKey,
  type D2GoldenEnv,
} from "./judgment-d2-golden-gate";
import { readStashedServiceRoleEnv } from "../test/strip-service-role-env";

const GOLDEN_PATH = resolve(
  process.cwd(),
  "scripts/fixtures/judgment-d2-filter-golden.json",
);
const CANDIDATES_PATH = resolve(
  process.cwd(),
  "scripts/fixtures/judgment-candidates-d2-parity.json",
);
const PROFILES_PATH = resolve(
  process.cwd(),
  "scripts/config/lrs-ingestion-profiles.json",
);
const COURT_CONFIG = resolve(
  process.cwd(),
  "scripts/config/court-from-case-ref.json",
);

type GoldenEntry = {
  caseRef: string;
  disposition: string;
  reasons: string[];
};

type GoldenFile = {
  summary: { keep: number; drop: number; review: number };
  entries: GoldenEntry[];
};

type D2MwcNameRow = {
  company_name: string | null;
  registration_no: string | null;
};

function envForD2Golden(): D2GoldenEnv {
  const env: D2GoldenEnv = { ...process.env };
  const stashed = readStashedServiceRoleEnv();
  for (const [name, value] of Object.entries(stashed)) {
    if (value) env[name] = value;
  }
  return env;
}

/** Page company_name + registration_no only. Do not log row contents. */
async function loadMwcIndexForD2Golden(
  supabase: SupabaseClient,
): Promise<MwcContractorsMemoryIndex> {
  const pageSize = 1000;
  let from = 0;
  const rows: MwcRow[] = [];
  const columns = d2GoldenMwcSelectList();
  while (true) {
    const { data, error } = await supabase
      .from("mwc_contractors")
      .select(columns)
      .range(from, from + pageSize - 1);
    if (error) {
      throw new Error(`mwc_contractors read failed (${error.code ?? "unknown"})`);
    }
    const batch = (data ?? []) as unknown as D2MwcNameRow[];
    for (const row of batch) {
      if (!row.company_name) continue;
      rows.push({
        company_name: row.company_name,
        registration_no: row.registration_no ?? "",
        phone: null,
        expiry_date: null,
        primary_signatory_name: null,
        source_updated_at: null,
      });
    }
    if (batch.length < pageSize) break;
    from += pageSize;
  }
  return new MwcContractorsMemoryIndex(rows);
}

const decision = decideD2GoldenRun(process.env);

describe("D2 filter golden parity", () => {
  if (decision.action === "skip") {
    it.skip(decision.reason, () => {});
    return;
  }

  it(
    "keep/drop/review lists match committed golden",
    async () => {
      const env = envForD2Golden();
      const url =
        env.NEXT_PUBLIC_SUPABASE_URL?.trim() || env.SUPABASE_URL?.trim();
      const keyChoice = selectD2GoldenSupabaseKey(env);
      if (!url) {
        expect.fail(
          "RUN_D2_GOLDEN=1 but NEXT_PUBLIC_SUPABASE_URL / SUPABASE_URL is missing.",
        );
      }
      if (!keyChoice.ok) {
        expect.fail(keyChoice.reason);
      }
      if (!existsSync(CANDIDATES_PATH) || !existsSync(GOLDEN_PATH)) {
        expect.fail("missing parity fixtures");
      }

      const golden = JSON.parse(readFileSync(GOLDEN_PATH, "utf8")) as GoldenFile;
      const manifest = judgmentCandidatesManifestSchema.parse(
        JSON.parse(readFileSync(CANDIDATES_PATH, "utf8")),
      );
      const profiles = JSON.parse(readFileSync(PROFILES_PATH, "utf8")) as {
        caseRefSkipPrefixes: string[];
        caseRefPriorityPrefixes: string[];
      };
      const courtPrefixes = (
        JSON.parse(readFileSync(COURT_CONFIG, "utf8")) as {
          prefixes: Record<string, string>;
        }
      ).prefixes;

      const supabase = createClient(url, keyChoice.key, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
      const mwcIndex = await loadMwcIndexForD2Golden(supabase);
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

      expect(counts).toEqual(golden.summary);

      const byRef = new Map(
        entries.map((e) => [normalizeCaseRefKey(e.caseRef), e]),
      );
      for (const g of golden.entries) {
        const caseKey = normalizeCaseRefKey(g.caseRef);
        const entry = byRef.get(caseKey);
        expect(entry, `missing ${g.caseRef}`).toBeDefined();
        expect(entry!.disposition).toBe(g.disposition);
        expect(entry!.reasons).toEqual(g.reasons);
      }
      expect(entries.length).toBe(golden.entries.length);
    },
    180_000,
  );
});
