/**
 * D1 — case-number discover for gold seeds missing from candidates (merge, no full rebuild wipe).
 *
 *   pnpm d1:backfill-gold
 */
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { execSync } from "node:child_process";

const SEED = resolve(
  process.cwd(),
  "scripts/fixtures/judgments-seed.local.json",
);
const CAND = resolve(
  process.cwd(),
  "scripts/output/judgment-candidates.json",
);

function normCaseRef(r: string): string {
  return r.replace(/\s+/g, "").toUpperCase();
}

function toDiscoverArg(caseRef: string): string {
  return caseRef.replace(/\s+/g, "");
}

function main() {
  const seeds = JSON.parse(readFileSync(SEED, "utf8")) as Array<{
    caseRef: string;
    partyRole?: string;
  }>;
  let cand: { candidates: unknown[] };
  try {
    cand = JSON.parse(readFileSync(CAND, "utf8")) as { candidates: unknown[] };
  } catch {
    cand = { candidates: [] };
  }
  const have = new Set(
    (cand.candidates as Array<{ caseRef: string }>).map((c) =>
      normCaseRef(c.caseRef),
    ),
  );

  const missing = seeds
    .filter((s) => s.partyRole !== "plaintiff")
    .filter((s) => !have.has(normCaseRef(s.caseRef)));

  if (missing.length === 0) {
    console.info(JSON.stringify({ event: "d1_backfill_gold_none_needed" }));
    return;
  }

  for (const s of missing) {
    const arg = toDiscoverArg(s.caseRef);
    execSync(
      `pnpm lrs:discover-case --case=${arg} --write-candidates`,
      { stdio: "inherit", cwd: process.cwd() },
    );
  }

  const after = JSON.parse(readFileSync(CAND, "utf8")) as {
    candidates: Array<{ caseRef: string; discoveredFrom?: { profileId?: string } }>;
  };
  const backfilledRefs = new Set(missing.map((m) => normCaseRef(m.caseRef)));
  const goldRows = after.candidates.filter((c) =>
    backfilledRefs.has(normCaseRef(c.caseRef)),
  );
  const backfillPath = resolve(
    process.cwd(),
    "scripts/output/judgment-candidates-gold-backfill.json",
  );
  writeFileSync(
    backfillPath,
    `${JSON.stringify({ generatedAt: new Date().toISOString(), candidates: goldRows }, null, 2)}\n`,
    "utf8",
  );

  console.info(
    JSON.stringify({
      event: "d1_backfill_gold_done",
      backfilled: missing.map((m) => m.caseRef),
      goldBackfillPath: backfillPath,
      goldBackfillCount: goldRows.length,
    }),
  );
}

main();
