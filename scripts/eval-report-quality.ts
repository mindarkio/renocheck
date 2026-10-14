/**
 * Validate golden RiskReport fixtures (default) or live API (--live).
 *
 * Usage:
 *   pnpm eval:report-quality
 *   pnpm eval:report-quality --live   # all live gold (incl. stretch)
 *   pnpm eval:report-quality --live --gate   # blocking only (release gate)
 *   pnpm eval:report-quality --live --case fei-wong-phone
 *
 * Live: requires `pnpm dev` (refresh:true only in NODE_ENV=development) and EVAL_BASE_URL (default http://localhost:3000).
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { riskReportSchema, type RiskReport } from "../src/lib/report-schema";
import { REPORT_VERSION } from "../src/lib/constants";

const GOLDEN_PATH = resolve(
  process.cwd(),
  "scripts/fixtures/report-quality-golden.json",
);
const LIVE_PATH = resolve(
  process.cwd(),
  "scripts/fixtures/report-quality-live.json",
);

type ReportQualityExpect = {
  nameAlignment?: string;
  minBoundHits: number;
  maxBoundHits?: number;
  minRetrievalEvidence?: number;
  minChecklistItems: number;
  forbiddenThemes: string[];
  maxGrade?: string;
  zeroHighlightGradeMustBe?: string;
  mwcMatched?: boolean;
  searchLabelIncludes?: string;
  forbiddenSummaryPhrases?: string[];
  /** At least one retrievalEvidence.url must contain each listed substring (OR). */
  goldEvidenceUrlSubstrings?: string[];
  dataSaturation?: string;
  riskBandZh?: string;
  /** When Serp/LLM tier fluctuates but dispute in scope is stable. */
  riskBandZhIn?: string[];
};

type GoldenCase = {
  id: string;
  report: unknown;
  expect: ReportQualityExpect;
};

type GoldenFile = {
  version: number;
  reports: GoldenCase[];
};

type LiveCase = {
  id: string;
  label?: string;
  /** blocking = release gate; stretch = tracked but optional for --gate */
  goldTier?: "blocking" | "stretch";
  input: { companyName?: string; phone?: string; br?: string };
  expect: ReportQualityExpect;
};

type LiveFile = {
  version: number;
  cases: LiveCase[];
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

function validateReportAgainstExpect(
  report: RiskReport,
  exp: ReportQualityExpect,
): string[] {
  const errors: string[] = [];

  if (report.reportVersion !== REPORT_VERSION) {
    errors.push(`reportVersion ${report.reportVersion}`);
  }
  if (exp.nameAlignment != null && report.entity.nameAlignment !== exp.nameAlignment) {
    errors.push(
      `nameAlignment ${report.entity.nameAlignment} != ${exp.nameAlignment}`,
    );
  }
  if (
    exp.mwcMatched != null &&
    report.official.mwcMatched !== exp.mwcMatched
  ) {
    errors.push(`mwcMatched ${report.official.mwcMatched} != ${exp.mwcMatched}`);
  }
  if (exp.searchLabelIncludes) {
    if (!report.entity.searchLabelUsed.includes(exp.searchLabelIncludes)) {
      errors.push(
        `searchLabelUsed missing "${exp.searchLabelIncludes}"`,
      );
    }
  }

    const bound = report.signals.boundHitCount ?? 0;
    if (bound < exp.minBoundHits) {
      errors.push(`boundHitCount ${bound} < ${exp.minBoundHits}`);
    }
    if (exp.maxBoundHits != null && bound > exp.maxBoundHits) {
      errors.push(`boundHitCount ${bound} > max ${exp.maxBoundHits}`);
    }
    const retrievalLen = report.signals.retrievalEvidence?.length ?? 0;
    const minRetrieval =
      exp.minRetrievalEvidence ??
      (exp.minBoundHits > 0 ? exp.minBoundHits : 0);
    if (retrievalLen < minRetrieval) {
      errors.push(
        `retrievalEvidence ${retrievalLen} < ${minRetrieval}`,
      );
    }
    if (bound > 0 && retrievalLen < bound) {
      errors.push(
        `retrievalEvidence ${retrievalLen} < boundHitCount ${bound}`,
      );
    }
  if (report.signals.contractChecklist.length < exp.minChecklistItems) {
    errors.push("contractChecklist too short");
  }
  for (const forbidden of exp.forbiddenThemes) {
    if (report.signals.themes.includes(forbidden)) {
      errors.push(`forbidden theme ${forbidden}`);
    }
  }

  const highlightsLen = report.signals.highlights?.length ?? 0;
  if (exp.zeroHighlightGradeMustBe && highlightsLen === 0) {
    if (report.grade !== exp.zeroHighlightGradeMustBe) {
      errors.push(
        `grade ${report.grade} != ${exp.zeroHighlightGradeMustBe} (zero-highlight)`,
      );
    }
  }
  if (exp.maxGrade) {
    const ladder = ["A", "B", "C", "D", "E", "F"];
    const gi = ladder.indexOf(report.grade);
    const mi = ladder.indexOf(exp.maxGrade);
    if (gi !== -1 && mi !== -1 && gi > mi) {
      errors.push(`grade ${report.grade} worse than maxGrade ${exp.maxGrade}`);
    }
  }

  if (
    exp.dataSaturation != null &&
    report.evaluation.dataSaturation !== exp.dataSaturation
  ) {
    errors.push(
      `dataSaturation ${report.evaluation.dataSaturation} != ${exp.dataSaturation}`,
    );
  }

  for (const phrase of exp.forbiddenSummaryPhrases ?? []) {
    if (report.summaryZh.includes(phrase)) {
      errors.push(`summary contains forbidden phrase ${phrase}`);
    }
  }

  if (exp.riskBandZhIn != null && exp.riskBandZhIn.length > 0) {
    if (!exp.riskBandZhIn.includes(report.evaluation.riskBandZh)) {
      errors.push(
        `riskBandZh ${report.evaluation.riskBandZh} not in [${exp.riskBandZhIn.join(", ")}]`,
      );
    }
  } else if (
    exp.riskBandZh != null &&
    report.evaluation.riskBandZh !== exp.riskBandZh
  ) {
    errors.push(
      `riskBandZh ${report.evaluation.riskBandZh} != ${exp.riskBandZh}`,
    );
  }

  const goldSubs = exp.goldEvidenceUrlSubstrings;
  if (goldSubs?.length && bound > 0) {
    const urls = (report.signals.retrievalEvidence ?? []).map((e) => e.url);
    const hit = goldSubs.some((sub) =>
      urls.some((u) => u.includes(sub)),
    );
    if (!hit) {
      errors.push(
        `bound>0 but no retrievalEvidence url matches gold: ${goldSubs.join(", ")}`,
      );
    }
  }

  return errors;
}

function runGolden(): boolean {
  const file = JSON.parse(readFileSync(GOLDEN_PATH, "utf8")) as GoldenFile;
  let ok = true;

  for (const case_ of file.reports) {
    const parsed = riskReportSchema.safeParse(case_.report);
    if (!parsed.success) {
      console.log(`✗ ${case_.id}  schema invalid`);
      ok = false;
      continue;
    }
    const errors = validateReportAgainstExpect(parsed.data, case_.expect);

    if (errors.length) {
      console.log(`✗ ${case_.id}  ${errors.join("; ")}`);
      ok = false;
    } else {
      console.log(`✓ ${case_.id}`);
    }
  }

  return ok;
}

function parseCaseFilter(): string | undefined {
  const idx = process.argv.indexOf("--case");
  if (idx === -1) return undefined;
  const id = process.argv[idx + 1]?.trim();
  return id || undefined;
}

async function runLive(): Promise<boolean> {
  loadEnvLocal();
  const base = (process.env.EVAL_BASE_URL ?? "http://localhost:3000").replace(
    /\/$/,
    "",
  );
  const caseFilter = parseCaseFilter();

  const file = JSON.parse(readFileSync(LIVE_PATH, "utf8")) as LiveFile;
  let cases = file.cases;
  if (process.argv.includes("--gate")) {
    cases = cases.filter((c) => c.goldTier !== "stretch");
  }
  if (caseFilter) {
    cases = cases.filter((c) => c.id === caseFilter);
    if (cases.length === 0) {
      console.error(`No live case with id "${caseFilter}"`);
      return false;
    }
  }

  try {
    const health = await fetch(`${base}/api/health`, { cache: "no-store" });
    if (!health.ok) {
      console.error(`Health check failed: ${health.status} at ${base}`);
      return false;
    }
  } catch (e) {
    console.error(
      `Cannot reach ${base}/api/health — start pnpm dev? (${String(e)})`,
    );
    return false;
  }

  const gateNote = process.argv.includes("--gate") ? " [gate=blocking]" : "";
  console.log(
    `Live report quality @ ${base} (${cases.length} case(s))${gateNote}\n`,
  );
  let ok = true;

  for (const case_ of cases) {
    const label = case_.label ? ` — ${case_.label}` : "";
    let res: Response;
    try {
      res = await fetch(`${base}/api/search`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...case_.input, refresh: true }),
        cache: "no-store",
      });
    } catch (e) {
      console.log(`✗ ${case_.id}${label}  fetch failed: ${String(e)}`);
      ok = false;
      continue;
    }

    const body = (await res.json()) as {
      error?: string;
      report?: unknown;
      fingerprint?: string;
      cacheHit?: boolean;
    };

    if (!res.ok) {
      console.log(
        `✗ ${case_.id}${label}  HTTP ${res.status} ${body.error ?? "unknown"}`,
      );
      ok = false;
      continue;
    }

    const parsed = riskReportSchema.safeParse(body.report);
    if (!parsed.success) {
      console.log(`✗ ${case_.id}${label}  response report invalid`);
      ok = false;
      continue;
    }

    const report = parsed.data;
    const errors = validateReportAgainstExpect(report, case_.expect);
    const meta = `grade=${report.grade} bound=${report.signals.boundHitCount ?? 0} evidence=${report.signals.retrievalEvidence?.length ?? 0} mwc=${report.official.mwcMatched} cacheHit=${body.cacheHit ?? "?"}`;

    if (errors.length) {
      console.log(`✗ ${case_.id}${label}  ${errors.join("; ")} (${meta})`);
      ok = false;
    } else {
      console.log(`✓ ${case_.id}${label}  (${meta})`);
    }
  }

  return ok;
}

async function main() {
  const live = process.argv.includes("--live");
  const ok = live ? await runLive() : runGolden();
  if (!ok) process.exit(1);
  console.log("\nReport quality eval OK.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
