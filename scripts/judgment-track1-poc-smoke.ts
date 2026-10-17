/**
 * PoC §1 — lookup smoke for all seed companies + optional full /api/search.
 *
 * Usage:
 *   pnpm judgment:poc-smoke
 *   pnpm judgment:poc-smoke --api-base=http://localhost:3000
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { lookupLegalJudgments } from "../src/lib/lookup-legal-judgments";
import { createClient } from "@supabase/supabase-js";

const SEED_PATH = resolve(
  process.cwd(),
  "scripts/fixtures/judgments-seed.local.json",
);
const OUT_PATH = resolve(
  process.cwd(),
  "scripts/output/judgment-poc-smoke-2026-10-16.json",
);

type SeedRow = { companyNameNormalized: string; caseRef: string };

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

function apiBase(): string | null {
  const a = process.argv.find((x) => x.startsWith("--api-base="));
  return a ? a.slice("--api-base=".length).replace(/\/$/, "") : null;
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

  const seeds = JSON.parse(readFileSync(SEED_PATH, "utf8")) as SeedRow[];
  const supabase = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const lookupResults = [];
  for (const row of seeds) {
    const r = await lookupLegalJudgments(supabase, {
      searchLabelUsed: row.companyNameNormalized,
    });
    lookupResults.push({
      companyNameNormalized: row.companyNameNormalized,
      expectedCaseRef: row.caseRef,
      matchCount: r.events.length,
      cases: r.events.map((e) => ({
        caseRef: e.caseRef,
        category: e.judgmentCategory,
        partyRole: e.partyRole,
        outcomeHint: e.outcomeHint,
      })),
      hitExpected: r.events.some((e) => e.caseRef === row.caseRef),
    });
  }

  const apiCases = [
    {
      label: "judgment_against_defendant",
      companyName: "SING YU DECORATION ENGINEERING COMPANY LTD",
    },
    {
      label: "dismissed_or_withdrawn",
      companyName: "楊國聰經營新寶燈飾裝修工程公司",
    },
    {
      label: "defendant_mwc_trade_name",
      companyName: "燊記裝修水電工程",
    },
  ];

  const apiResults: Array<Record<string, unknown>> = [];
  const base = apiBase();
  if (base) {
    for (const c of apiCases) {
      try {
        const res = await fetch(`${base}/api/search`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ companyName: c.companyName, refresh: true }),
        });
        const body = (await res.json()) as Record<string, unknown>;
        const report =
          (body.report as Record<string, unknown> | undefined) ?? body;
        const official = report.official as Record<string, unknown> | undefined;
        const evaluation = report.evaluation as
          | Record<string, unknown>
          | undefined;
        const legalEvents = official?.legalEvents;
        apiResults.push({
          scenario: c.label,
          companyName: c.companyName,
          httpStatus: res.status,
          legalEventCount: Array.isArray(legalEvents) ? legalEvents.length : 0,
          riskBandZh: evaluation?.riskBandZh,
          grade: report.grade,
          confidence: report.confidence,
        });
      } catch (err) {
        apiResults.push({
          scenario: c.label,
          companyName: c.companyName,
          error: String(err),
        });
      }
    }
  }

  const apiAllHaveLegalEvents =
    base &&
    apiResults.length > 0 &&
    apiResults.every(
      (r) =>
        typeof r.httpStatus === "number" &&
        r.httpStatus === 200 &&
        typeof r.legalEventCount === "number" &&
        r.legalEventCount >= 1,
    );

  const report = {
    generatedAt: new Date().toISOString(),
    lookupResults,
    lookupAllHit: lookupResults.every((r) => r.hitExpected && r.matchCount >= 1),
    apiResults,
    apiSkipped: !base,
    apiAllHaveLegalEvents: base ? apiAllHaveLegalEvents : null,
  };

  mkdirSync(resolve(process.cwd(), "scripts/output"), { recursive: true });
  writeFileSync(OUT_PATH, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  console.info(JSON.stringify({ event: "judgment_poc_smoke_done", path: OUT_PATH, report }));
  if (!report.lookupAllHit) process.exit(1);
  if (base && !apiAllHaveLegalEvents) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
