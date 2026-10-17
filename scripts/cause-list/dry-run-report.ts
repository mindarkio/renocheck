/**
 * Parse cached cause lists for a date range; write match summary CSV to scripts/output/ (gitignored).
 * Usage: pnpm tsx scripts/cause-list/dry-run-report.ts --from 16102026 --to 16102026
 */
import { readdir, readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import {
  CAUSE_LIST_COMPANY_FIXTURES,
} from "../../src/lib/cause-list/fixtures/companies.fixture";
import {
  matchCauseListCases,
  parseCacfiCauseListHtml,
  parseDcCauseListHtml,
  parseLandsCauseListHtml,
  parseSmtCauseListHtml,
  summarizeMatchesByLevel,
} from "../../src/lib/cause-list";

const PARSERS: Record<
  string,
  (html: string, date: string) => ReturnType<typeof parseSmtCauseListHtml>
> = {
  SMT: parseSmtCauseListHtml,
  DC: parseDcCauseListHtml,
  CACFI: parseCacfiCauseListHtml,
  LANDS: parseLandsCauseListHtml,
};

function parseArgs(argv: string[]) {
  let from = "";
  let to = "";
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--from" && argv[i + 1]) from = argv[++i];
    if (argv[i] === "--to" && argv[i + 1]) to = argv[++i];
  }
  if (!/^\d{8}$/.test(from) || !/^\d{8}$/.test(to)) {
    throw new Error("--from and --to DDMMYYYY required");
  }
  return { from, to };
}

function dateInRange(fileDate: string, from: string, to: string): boolean {
  return fileDate >= from && fileDate <= to;
}

async function main() {
  const { from, to } = parseArgs(process.argv.slice(2));
  const cacheDir = path.join(process.cwd(), ".cache", "cause-list");
  const files = await readdir(cacheDir).catch(() => [] as string[]);

  const allCases: ReturnType<typeof parseSmtCauseListHtml> = [];
  for (const file of files) {
    const m = file.match(/^([A-Z]+)_(\d{8})(?:_wb\d+)?\.html$/);
    if (!m) continue;
    const [, court, date] = m;
    if (!dateInRange(date, from, to)) continue;
    const parser = PARSERS[court];
    if (!parser) continue;
    const html = await readFile(path.join(cacheDir, file), "utf8");
    allCases.push(...parser(html, date));
  }

  const matches = matchCauseListCases(allCases, CAUSE_LIST_COMPANY_FIXTURES);
  const summary = summarizeMatchesByLevel(matches);

  const outDir = path.join(process.cwd(), "scripts", "output");
  await mkdir(outDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const csvPath = path.join(outDir, `cause-list-dry-run-${stamp}.csv`);

  const header =
    "confidence,company_id,case_no,court,hearing_date,claim_nature,role,matched_on,review_only\n";
  const rows = matches.map((m) =>
    [
      m.confidence,
      m.companyId,
      m.case.caseNo,
      m.case.court,
      m.case.hearingDate,
      (m.case.claimNature ?? "").replace(/,/g, " "),
      m.party.role,
      m.matchedOn.replace(/,/g, " "),
      m.reviewOnly ? "yes" : "no",
    ].join(","),
  );
  const footer = `\n# summary_A,${summary.A},summary_B,${summary.B},summary_C,${summary.C},cases_parsed,${allCases.length}\n`;
  await writeFile(csvPath, header + rows.join("\n") + footer, "utf8");

  console.info(
    JSON.stringify({
      event: "cause_list_dry_run",
      from,
      to,
      cases_parsed: allCases.length,
      summary,
      csv: csvPath,
    }),
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
