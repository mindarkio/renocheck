/**
 * Local-only smoke: parse real DCL HTML samples (never commit samples).
 * Prints row/case counts and kept (renovation-relevant cases with ≥1 corporate defendant/respondent).
 * Does not print party names.
 *
 * Usage: pnpm cause-list:verify-samples
 * Env: CAUSE_LIST_SAMPLES_DIR (default ~/renocheck-review/samples)
 */
import { readFile } from "node:fs/promises";
import path from "node:path";
import { homedir } from "node:os";
import { isDefendantSideRole, isRenovationRelevantCase } from "../../src/lib/cause-list/filter";
import { parseCorporateParties } from "../../src/lib/cause-list/party";
import { parseSmtCauseListHtml } from "../../src/lib/cause-list/parse-smt";
import { parseDcCauseListHtml } from "../../src/lib/cause-list/parse-dc";
import { parseCacfiCauseListHtml } from "../../src/lib/cause-list/parse-cacfi";
import { parseLandsCauseListHtml } from "../../src/lib/cause-list/parse-lands";
import type { ParsedCauseListCase } from "../../src/lib/cause-list/types";

const DATE = "16102026";

type SampleSpec = {
  label: string;
  file: string;
  parse: (html: string, date: string) => {
    rowCount: number;
    caseNoCount: number;
    cases: ParsedCauseListCase[];
  };
};

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

async function main() {
  const samplesDir =
    process.env.CAUSE_LIST_SAMPLES_DIR?.trim() ||
    path.join(homedir(), "renocheck-review", "samples");

  const specs: SampleSpec[] = [
    {
      label: "SMT",
      file: `view_en_SMT_${DATE}.html`,
      parse: parseSmtCauseListHtml,
    },
    {
      label: "DC",
      file: `view_en_DC_${DATE}.html`,
      parse: parseDcCauseListHtml,
    },
    {
      label: "CACFI",
      file: `view_en_CACFI_${DATE}.html`,
      parse: parseCacfiCauseListHtml,
    },
    {
      label: "LANDS",
      file: `view_en_LANDS_${DATE}.html`,
      parse: parseLandsCauseListHtml,
    },
  ];

  for (const spec of specs) {
    const filePath = path.join(samplesDir, spec.file);
    const html = await readFile(filePath, "utf8");
    const parsed = spec.parse(html, DATE);
    if (parsed.rowCount > 0 && parsed.cases.length === 0) {
      throw new Error(`${spec.label}: page has rows but parser returned 0 cases`);
    }
    const { kept, keptCaseNos } = countKeptCases(parsed.cases);

    console.log(
      JSON.stringify({
        court: spec.label,
        rows: parsed.rowCount,
        caseNos: parsed.caseNoCount,
        kept,
        keptCaseNos,
      }),
    );
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
