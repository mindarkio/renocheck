/**
 * J3 — validate local judgment seed before import (Track A, no LLM).
 *
 * Usage:
 *   pnpm validate:judgments-seed
 *   pnpm validate:judgments-seed --file=scripts/fixtures/judgments-seed.local.json --min-renovation=5
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { z } from "zod";
import { courtFromCaseRef } from "../src/lib/court-from-case-ref";

const courtConfig = JSON.parse(
  readFileSync(
    resolve(process.cwd(), "scripts/config/court-from-case-ref.json"),
    "utf8",
  ),
) as { prefixes: Record<string, string> };
const COURT_PREFIXES = courtConfig.prefixes;

const DEFAULT_PATH = resolve(
  process.cwd(),
  "scripts/fixtures/judgments-seed.local.json",
);

const seedRowSchema = z.object({
  sourceType: z.string().optional(),
  sourceCatalogId: z.string().min(1),
  caseRef: z.string().min(1),
  court: z.string().min(1),
  eventDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  partyNames: z.array(z.string()).optional(),
  brNormalized: z.string().optional(),
  companyNameNormalized: z.string().min(1),
  judgmentCategory: z.string().min(1),
  partyRole: z.string().min(1),
  outcomeHint: z.string().optional(),
  procedureStage: z.string().optional(),
  hearingKeyPointsZh: z.array(z.string().min(1)).min(1),
  sourceUrl: z.string().url(),
  sourcePublishedAt: z.string().optional(),
  renovationRelevant: z.boolean().optional(),
  topicTags: z.array(z.string()).optional(),
  lookupAliases: z.array(z.string().min(1)).optional(),
  reviewStatus: z.enum(["auto", "human_verified"]).optional(),
});

function fileArg(argv: string[]): string {
  const arg = argv.find((a) => a.startsWith("--file="));
  return arg ? arg.slice("--file=".length) : DEFAULT_PATH;
}

function minRenovationArg(argv: string[]): number {
  const arg = argv.find((a) => a.startsWith("--min-renovation="));
  return arg ? Number.parseInt(arg.slice("--min-renovation=".length), 10) : 0;
}

function main() {
  const seedPath = resolve(process.cwd(), fileArg(process.argv));
  const minRenovation = minRenovationArg(process.argv);
  const raw = readFileSync(seedPath, "utf8");
  const parsed = JSON.parse(raw) as unknown;
  const rows = z.array(seedRowSchema).parse(parsed);

  const warnings: string[] = [];
  for (const row of rows) {
    const inferred = courtFromCaseRef(row.caseRef, COURT_PREFIXES);
    if (inferred && inferred !== row.court) {
      warnings.push(
        `${row.caseRef}: court "${row.court}" differs from prefix map "${inferred}"`,
      );
    }
    if (row.caseRef.includes("REPLACE") || row.sourceUrl.includes("REPLACE")) {
      warnings.push(`${row.caseRef}: placeholder REPLACE_ME still present`);
    }
  }

  const plaintiffs = rows.filter((r) => r.partyRole === "plaintiff");
  if (plaintiffs.length > 0) {
    console.error(
      JSON.stringify({
        event: "validate_judgments_seed_failed",
        reason: "plaintiff_not_allowed",
        caseRefs: plaintiffs.map((r) => r.caseRef),
        hint: "DEC-0012 amendment 2026-10-16 — defendant only",
      }),
    );
    process.exit(1);
  }

  const renovationCount = rows.filter((r) => r.renovationRelevant === true).length;
  if (minRenovation > 0 && renovationCount < minRenovation) {
    console.error(
      JSON.stringify({
        event: "validate_judgments_seed_failed",
        reason: "min_renovation_relevant",
        renovationCount,
        minRenovation,
      }),
    );
    process.exit(1);
  }

  console.log(
    JSON.stringify({
      event: "validate_judgments_seed_ok",
      path: seedPath,
      rows: rows.length,
      renovationRelevant: renovationCount,
      warnings,
    }),
  );
  if (warnings.length > 0) process.exit(2);
}

main();
