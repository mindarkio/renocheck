/**
 * D1 gate — gold defendant seeds must appear in judgment-candidates.json
 *
 *   pnpm d1:audit-gold
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

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

function main() {
  const seeds = JSON.parse(readFileSync(SEED, "utf8")) as Array<{
    caseRef: string;
    partyRole?: string;
  }>;
  const cand = JSON.parse(readFileSync(CAND, "utf8")) as {
    candidates: Array<{ caseRef: string }>;
  };
  const have = new Set(cand.candidates.map((c) => normCaseRef(c.caseRef)));

  const missing: string[] = [];
  for (const s of seeds) {
    if (s.partyRole === "plaintiff") continue;
    if (!have.has(normCaseRef(s.caseRef))) missing.push(s.caseRef);
  }

  const ok = missing.length === 0;
  console.info(
    JSON.stringify({
      event: ok ? "d1_audit_gold_recall_ok" : "d1_audit_gold_recall_fail",
      goldDefendantRows: seeds.filter((s) => s.partyRole !== "plaintiff").length,
      missing,
      candidateCount: cand.candidates.length,
    }),
  );
  if (!ok) process.exit(1);
}

main();
