import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { createClient } from "@supabase/supabase-js";
import { judgmentCandidatesManifestSchema } from "./judgment-candidates-schema";
import { MwcContractorsMemoryIndex } from "./mwc-contractors-memory-index";
import { runD2FilterPipeline } from "./judgment-d2-filter-pipeline";
import { normalizeCaseRefKey } from "./judgment-d2-filter-cache";

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

describe("D2 filter golden parity", () => {
  it(
    "keep/drop/review lists match committed golden",
    async () => {
      loadEnvLocal();
      const url =
        process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
      const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
      if (!url || !key) {
        expect.fail("Supabase env required for D2 parity test");
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

      const supabase = createClient(url, key, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
      const mwcIndex = await MwcContractorsMemoryIndex.loadAll(supabase);

      const { entries, counts } = runD2FilterPipeline({
        candidates: manifest.candidates,
        skipPrefixes: profiles.caseRefSkipPrefixes,
        priorityPrefixes: profiles.caseRefPriorityPrefixes,
        courtPrefixes,
        mwcIndex,
        useStepCache: false,
        writeStepCache: false,
      });

      expect(counts).toEqual(golden.summary);

      const byRef = new Map(
        entries.map((e) => [normalizeCaseRefKey(e.caseRef), e]),
      );
      for (const g of golden.entries) {
        const key = normalizeCaseRefKey(g.caseRef);
        const e = byRef.get(key);
        expect(e, `missing ${g.caseRef}`).toBeDefined();
        expect(e!.disposition).toBe(g.disposition);
        expect(e!.reasons).toEqual(g.reasons);
      }
      expect(entries.length).toBe(golden.entries.length);
    },
    180_000,
  );
});
