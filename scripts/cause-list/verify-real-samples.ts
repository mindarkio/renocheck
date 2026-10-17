/**
 * Local-only smoke: parse real DCL HTML samples (never commit samples).
 * Prints row/case counts and kept (renovation-relevant cases with ≥1 corporate defendant/respondent).
 * Does not print party names.
 *
 * Usage: pnpm cause-list:verify-samples
 *        pnpm cause-list:verify-samples --date 16102026
 *        pnpm cause-list:verify-samples --file /path/to/wb_SMT_10032025.html --date 10032025
 * Env: CAUSE_LIST_SAMPLES_DIR (default ~/renocheck-review/samples)
 */
import { readFile } from "node:fs/promises";
import path from "node:path";
import { homedir } from "node:os";
import { countRawCaseNosInHtml } from "../../src/lib/cause-list/case-no";
import { isDefendantSideRole, isRenovationRelevantCase } from "../../src/lib/cause-list/filter";
import { parseCorporateParties } from "../../src/lib/cause-list/party";
import { parseSmtCauseListHtml, countSmtTables } from "../../src/lib/cause-list/parse-smt";
import { parseDcCauseListHtml } from "../../src/lib/cause-list/parse-dc";
import { parseCacfiCauseListHtml } from "../../src/lib/cause-list/parse-cacfi";
import { parseLandsCauseListHtml } from "../../src/lib/cause-list/parse-lands";
import type { ParsedCauseListCase } from "../../src/lib/cause-list/types";

type ParseResult = {
  rowCount: number;
  caseNoCount: number;
  cases: ParsedCauseListCase[];
};

type SampleJob = {
  label: string;
  filePath: string;
  date: string;
  mode: "smt" | "seven";
  parse: (html: string, date: string) => ParseResult;
};

function parseArgs(argv: string[]) {
  let date = "16102026";
  let file: string | undefined;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--date" && argv[i + 1]) date = argv[++i];
    else if (argv[i] === "--file" && argv[i + 1]) file = argv[++i];
  }
  if (!/^\d{8}$/.test(date)) throw new Error("--date DDMMYYYY required");
  return { date, file };
}

function countKeptCases(cases: ParsedCauseListCase[]): {
  kept: number;
  keptCaseNos: string[];
} {
  const keptCaseNos = new Set<string>();
  for (const caseRow of cases) {
    if (!isRenovationRelevantCase(caseRow)) continue;
    const hasCorpDefendant = parseCorporateParties(caseRow.parties).some((p) =>
      isDefendantSideRole(p.role),
    );
    if (hasCorpDefendant) keptCaseNos.add(caseRow.caseNo);
  }
  return {
    kept: keptCaseNos.size,
    keptCaseNos: [...keptCaseNos].sort(),
  };
}

function assertParseCoverage(
  label: string,
  html: string,
  parsed: ParseResult,
  mode: "smt" | "seven",
): void {
  if (mode === "smt") {
    const rawTables = countSmtTables(html);
    if (rawTables > 0 && parsed.cases.length === 0) {
      throw new Error(`${label}: HTML has ${rawTables} SCTC tables but parser returned 0 cases`);
    }
    if (rawTables !== parsed.cases.length) {
      throw new Error(
        `${label}: SMT table count ${rawTables} !== parsed cases ${parsed.cases.length}`,
      );
    }
    return;
  }

  const rawCaseNos = countRawCaseNosInHtml(html);
  if (rawCaseNos > 0 && parsed.cases.length === 0) {
    throw new Error(`${label}: HTML has ${rawCaseNos} case refs but parser returned 0 cases`);
  }
  if (rawCaseNos !== parsed.caseNoCount) {
    throw new Error(
      `${label}: raw caseNo count ${rawCaseNos} !== parsed caseNoCount ${parsed.caseNoCount}`,
    );
  }
}

function inferLabelFromPath(filePath: string): { label: string; mode: "smt" | "seven" } {
  const base = path.basename(filePath).toUpperCase();
  if (base.includes("SMT")) return { label: "SMT", mode: "smt" };
  if (base.includes("_DC_")) return { label: "DC", mode: "seven" };
  if (base.includes("CACFI")) return { label: "CACFI", mode: "seven" };
  if (base.includes("LANDS")) return { label: "LANDS", mode: "seven" };
  throw new Error(`cannot infer court from filename: ${filePath}`);
}

function defaultJobs(samplesDir: string, date: string): SampleJob[] {
  return [
    {
      label: "SMT",
      filePath: path.join(samplesDir, `view_en_SMT_${date}.html`),
      date,
      mode: "smt",
      parse: parseSmtCauseListHtml,
    },
    {
      label: "DC",
      filePath: path.join(samplesDir, `view_en_DC_${date}.html`),
      date,
      mode: "seven",
      parse: parseDcCauseListHtml,
    },
    {
      label: "CACFI",
      filePath: path.join(samplesDir, `view_en_CACFI_${date}.html`),
      date,
      mode: "seven",
      parse: parseCacfiCauseListHtml,
    },
    {
      label: "LANDS",
      filePath: path.join(samplesDir, `view_en_LANDS_${date}.html`),
      date,
      mode: "seven",
      parse: parseLandsCauseListHtml,
    },
    {
      label: "SMT_WB",
      filePath: path.join(samplesDir, "wb_SMT_10032025.html"),
      date: "10032025",
      mode: "smt",
      parse: parseSmtCauseListHtml,
    },
  ];
}

async function runJob(job: SampleJob): Promise<void> {
  const html = await readFile(job.filePath, "utf8");
  const parsed = job.parse(html, job.date);
  assertParseCoverage(job.label, html, parsed, job.mode);
  const { kept, keptCaseNos } = countKeptCases(parsed.cases);

  console.log(
    JSON.stringify({
      court: job.label,
      rows: parsed.rowCount,
      caseNos: parsed.caseNoCount,
      kept,
      keptCaseNos,
    }),
  );
}

async function main() {
  const { date, file } = parseArgs(process.argv.slice(2));
  const samplesDir =
    process.env.CAUSE_LIST_SAMPLES_DIR?.trim() ||
    path.join(homedir(), "renocheck-review", "samples");

  if (file) {
    const filePath = path.isAbsolute(file) ? file : path.join(samplesDir, file);
    const { label, mode } = inferLabelFromPath(filePath);
    const parse =
      mode === "smt"
        ? parseSmtCauseListHtml
        : label === "DC"
          ? parseDcCauseListHtml
          : label === "CACFI"
            ? parseCacfiCauseListHtml
            : parseLandsCauseListHtml;
    await runJob({ label, filePath, date, mode, parse });
    return;
  }

  const jobs = defaultJobs(samplesDir, date);
  for (const job of jobs) {
    await runJob(job);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
