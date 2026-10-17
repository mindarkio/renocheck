/**
 * Compare MWC company rows in cached BD CSV vs baseline (docs/sourcedata snapshot).
 * No DB. Writes summary JSON to scripts/output/ (gitignored).
 *
 * Usage: pnpm bd-register:dry-run
 *   pnpm bd-register:fetch --copy-from-docs && pnpm bd-register:dry-run
 */
import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { mwcCompanyRegNos, parseBdRegisterCsv } from "../../src/lib/bd-register/parse";

function parseArgs(argv: string[]) {
  let baseline = path.join(process.cwd(), "docs/sourcedata/registers_full_list.csv");
  let candidate = path.join(process.cwd(), ".cache/bd-register/registers_full_list.csv");
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--baseline" && argv[i + 1]) baseline = argv[++i];
    if (argv[i] === "--candidate" && argv[i + 1]) candidate = argv[++i];
  }
  return { baseline, candidate };
}

async function main() {
  const { baseline, candidate } = parseArgs(process.argv.slice(2));
  const [baseText, candText] = await Promise.all([
    readFile(baseline, "utf8"),
    readFile(candidate, "utf8"),
  ]);

  const baseEntries = parseBdRegisterCsv(baseText);
  const candEntries = parseBdRegisterCsv(candText);
  const baseMwc = mwcCompanyRegNos(baseEntries);
  const candMwc = mwcCompanyRegNos(candEntries);

  let overlap = 0;
  for (const reg of candMwc) {
    if (baseMwc.has(reg)) overlap += 1;
  }
  const newInCandidate = candMwc.size - overlap;

  const summary = {
    event: "bd_register_mwc_dry_run",
    baseline_path: baseline,
    candidate_path: candidate,
    baseline_mwc_companies: baseMwc.size,
    candidate_mwc_companies: candMwc.size,
    overlap,
    new_in_candidate: newInCandidate,
    contractor_rows_parsed: {
      baseline: baseEntries.length,
      candidate: candEntries.length,
    },
  };

  const outDir = path.join(process.cwd(), "scripts", "output");
  await mkdir(outDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const outPath = path.join(outDir, `bd-register-mwc-compare-${stamp}.json`);
  await writeFile(outPath, JSON.stringify(summary, null, 2) + "\n", "utf8");

  console.info(JSON.stringify({ ...summary, output: outPath }));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
