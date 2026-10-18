import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { createClient } from "@supabase/supabase-js";
import { judgmentCandidatesManifestSchema } from "./judgment-candidates-schema";
import { MwcContractorsMemoryIndex } from "./mwc-contractors-memory-index";
import { runD2FilterPipeline } from "./judgment-d2-filter-pipeline";
import { normalizeCaseRefKey } from "./judgment-d2-filter-cache";
import {
  decideD2GoldenRun,
  loadD2GoldenMwcRows,
  selectD2GoldenSupabaseKey,
} from "./judgment-d2-golden-gate";

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

const decision = decideD2GoldenRun(process.env);

describe("D2 filter golden parity", () => {
  if (decision.action === "skip") {
    it.skip(decision.reason, () => {});
    return;
  }

  if (decision.action === "fail") {
    it(decision.reason, () => {
      expect.fail(decision.reason);
    });
    return;
  }

  it(
    "keep/drop/review lists match committed golden",
    async () => {
      const url =
        process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ||
        process.env.SUPABASE_URL?.trim();
      const keyChoice = selectD2GoldenSupabaseKey(process.env);
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
      const mwcIndex = new MwcContractorsMemoryIndex(
        await loadD2GoldenMwcRows(supabase),
      );
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
