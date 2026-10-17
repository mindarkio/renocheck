/**
 * Compare MWC company rows in cached BD CSV vs baseline snapshot in .cache/.
 * No DB. Writes summary JSON to scripts/output/ (gitignored).
 *
 * Usage:
 *   pnpm bd-register:fetch
 *   cp .cache/bd-register/registers_full_list.csv .cache/bd-register/registers_full_list.baseline.csv
 *   pnpm bd-register:dry-run
 */
import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { assertCacheFileFresh } from "../../src/lib/cause-list/cache-ttl";
import { diffBdMwc } from "../../src/lib/bd-register/diff";
import {
  BD_REGISTER_BASELINE_CSV_PATH,
  BD_REGISTER_CSV_PATH,
  BD_REGISTER_META_PATH,
} from "../../src/lib/bd-register/paths";
import {
  mwcCompanyRegNos,
  parseBdRegisterCsvWithMeta,
} from "../../src/lib/bd-register/parse";

function parseArgs(argv: string[]) {
  let baseline = BD_REGISTER_BASELINE_CSV_PATH;
  let candidate = BD_REGISTER_CSV_PATH;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--baseline" && argv[i + 1]) baseline = path.resolve(argv[++i]);
    if (argv[i] === "--candidate" && argv[i + 1]) candidate = path.resolve(argv[++i]);
  }
  return { baseline, candidate };
}

async function readCandidateRetrievedAt(): Promise<string | undefined> {
  try {
    const raw = await readFile(BD_REGISTER_META_PATH, "utf8");
    const meta = JSON.parse(raw) as { retrieved_at?: string };
    return meta.retrieved_at;
  } catch {
    return undefined;
  }
}

async function main() {
  const { baseline, candidate } = parseArgs(process.argv.slice(2));
  await assertCacheFileFresh(baseline, "BD register baseline CSV");
  await assertCacheFileFresh(candidate, "BD register cache");

  const [baseText, candText] = await Promise.all([
    readFile(baseline, "utf8"),
    readFile(candidate, "utf8"),
  ]);

  const baseParsed = parseBdRegisterCsvWithMeta(baseText);
  const candParsed = parseBdRegisterCsvWithMeta(candText);
  const baseMwc = mwcCompanyRegNos(baseParsed.entries);
  const candMwc = mwcCompanyRegNos(candParsed.entries);

  if (candParsed.entries.length < 10_000 || candMwc.size < 5_000) {
    throw new Error("BD CSV sanity: too few rows");
  }

  const mwcDiff = diffBdMwc(baseParsed.entries, candParsed.entries);

  let overlap = 0;
  for (const reg of candMwc) {
    if (baseMwc.has(reg)) overlap += 1;
  }
  const newInCandidate = candMwc.size - overlap;

  const summary = {
    event: "bd_register_mwc_dry_run",
    baseline_path: path.relative(process.cwd(), baseline),
    candidate_path: path.relative(process.cwd(), candidate),
    candidate_retrieved_at: await readCandidateRetrievedAt(),
    baseline_mwc_companies: baseMwc.size,
    candidate_mwc_companies: candMwc.size,
    overlap,
    new_in_candidate: newInCandidate,
    mwc_diff: {
      added_count: mwcDiff.added.length,
      removed_count: mwcDiff.removed.length,
      changed_count: mwcDiff.changed.length,
      unchanged: mwcDiff.unchanged,
      added: mwcDiff.added,
      removed: mwcDiff.removed,
      changed: mwcDiff.changed,
    },
    contractor_rows_parsed: {
      baseline: {
        raw_rows: baseParsed.rawContractorRows,
        unique_entries: baseParsed.entries.length,
      },
      candidate: {
        raw_rows: candParsed.rawContractorRows,
        unique_entries: candParsed.entries.length,
      },
    },
  };

  const outDir = path.join(process.cwd(), "scripts", "output");
  await mkdir(outDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const outPath = path.join(outDir, `bd-register-mwc-compare-${stamp}.json`);
  await writeFile(outPath, JSON.stringify(summary, null, 2) + "\n", "utf8");

  console.info(JSON.stringify({ ...summary, output: path.relative(process.cwd(), outPath) }));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
