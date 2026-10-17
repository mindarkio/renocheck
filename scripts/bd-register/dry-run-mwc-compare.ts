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
import { resolveCandidateRetrievedAt } from "../../src/lib/bd-register/candidate-meta";
import { diffBdMwc } from "../../src/lib/bd-register/diff";
import {
  BD_REGISTER_BASELINE_CSV_PATH,
  BD_REGISTER_CSV_PATH,
  BD_REGISTER_META_PATH,
} from "../../src/lib/bd-register/paths";
import {
  mwcCompanyRegNos,
  parseBdRegisterCsvFromBytes,
} from "../../src/lib/bd-register/parse";
import {
  assertBdCsvSanity,
  sanityCountsFromEntries,
} from "../../src/lib/bd-register/sanity";

function parseArgs(argv: string[]) {
  let baseline = BD_REGISTER_BASELINE_CSV_PATH;
  let candidate = BD_REGISTER_CSV_PATH;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--baseline" && argv[i + 1]) baseline = path.resolve(argv[++i]);
    if (argv[i] === "--candidate" && argv[i + 1]) candidate = path.resolve(argv[++i]);
  }
  return { baseline, candidate };
}

async function main() {
  const { baseline, candidate } = parseArgs(process.argv.slice(2));
  await assertCacheFileFresh(baseline, "BD register baseline CSV");
  await assertCacheFileFresh(candidate, "BD register cache");

  const [baseBuf, candBuf] = await Promise.all([
    readFile(baseline),
    readFile(candidate),
  ]);

  const baseParsed = parseBdRegisterCsvFromBytes(baseBuf);
  const candParsed = parseBdRegisterCsvFromBytes(candBuf);
  const baseMwc = mwcCompanyRegNos(baseParsed.entries);
  const candMwc = mwcCompanyRegNos(candParsed.entries);

  assertBdCsvSanity(sanityCountsFromEntries(baseParsed.entries));
  assertBdCsvSanity(sanityCountsFromEntries(candParsed.entries));

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
    candidate_retrieved_at: await resolveCandidateRetrievedAt(
      candidate,
      BD_REGISTER_META_PATH,
    ),
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
