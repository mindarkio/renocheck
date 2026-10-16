/**
 * Dry-run: draft hearing summaries for a batch (default 20) → CSV. Does not write DB.
 *
 *   pnpm judgment:summary-dryrun
 *   pnpm judgment:summary-dryrun --limit=20 --file=scripts/fixtures/judgments-seed.local.json
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import {
  fetchLegalrefJudgmentPlainText,
  toJuFrameUrl,
} from "../src/lib/judgment-lrs-plain-text";
import {
  draftJudgmentSummaryWithRetry,
  type JudgmentSummaryDraftPoint,
} from "../src/lib/judgment-summary-draft";
import {
  hearingSummaryPendingForEvent,
  isHearingSummaryPlaceholder,
} from "../src/lib/judgment-hearing-summary";

const DEFAULT_SEED = resolve(
  process.cwd(),
  "scripts/fixtures/judgments-seed.local.json",
);
const DEFAULT_OUT = resolve(
  process.cwd(),
  "scripts/output/judgment-summary-dryrun.csv",
);
const KEEP_PATH = resolve(
  process.cwd(),
  "scripts/output/judgment-d2-keep.json",
);

type SeedRow = {
  caseRef: string;
  sourceUrl: string;
  outcomeHint?: string;
  hearingKeyPointsZh: string[];
  reviewStatus?: "auto" | "human_verified";
  companyNameNormalized: string;
  partyNames?: string[];
};

type KeepRow = {
  caseRef: string;
  sourceUrl?: string;
  partiesLine?: string;
  defendantLabel?: string;
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

function normRef(r: string): string {
  return r.replace(/\s+/g, "").toUpperCase();
}

function intArg(name: string, fallback: number): number {
  const a = process.argv.find((x) => x.startsWith(`--${name}=`));
  if (!a) return fallback;
  const n = Number.parseInt(a.slice(name.length + 3), 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

function csvEscape(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function partiesLineForRow(
  row: SeedRow,
  keepByRef: Map<string, KeepRow>,
): string {
  const k = keepByRef.get(normRef(row.caseRef));
  if (k?.partiesLine?.trim()) return k.partiesLine.trim();
  const names = row.partyNames?.filter(Boolean) ?? [];
  if (names.length >= 2) return `${names[0]} 對 ${names[1]}`;
  return "";
}

function existingPointsToRows(
  row: SeedRow,
  sourceUrl: string,
): Array<{ outcomeHint: string; point: JudgmentSummaryDraftPoint }> {
  const outcome = row.outcomeHint ?? "unknown";
  return row.hearingKeyPointsZh
    .filter((p) => !isHearingSummaryPlaceholder(p))
    .map((keyPointZh) => ({
      outcomeHint: outcome,
      point: { keyPointZh, sourceQuoteZh: "" },
    }));
}

async function main() {
  loadEnvLocal();
  const limit = intArg("limit", 20);
  const fileArg = process.argv.find((a) => a.startsWith("--file="));
  const seedPath = fileArg
    ? resolve(process.cwd(), fileArg.slice("--file=".length))
    : DEFAULT_SEED;
  const outArg = process.argv.find((a) => a.startsWith("--out="));
  const outPath = outArg
    ? resolve(process.cwd(), outArg.slice("--out=".length))
    : DEFAULT_OUT;

  const seed = JSON.parse(readFileSync(seedPath, "utf8")) as SeedRow[];

  const keepByRef = new Map<string, KeepRow>();
  try {
    const keep = JSON.parse(readFileSync(KEEP_PATH, "utf8")) as KeepRow[];
    for (const k of keep) {
      keepByRef.set(normRef(k.caseRef), k);
    }
  } catch {
    // optional
  }

  const pending = seed.filter((r) =>
    hearingSummaryPendingForEvent(
      r.hearingKeyPointsZh,
      r.reviewStatus,
    ),
  );
  const batch = pending.slice(0, limit);

  const headers = [
    "caseRef",
    "sourceUrl",
    "outcome_hint",
    "keyPointZh",
    "sourceQuoteZh",
  ];
  const lines: string[] = [headers.join(",")];
  const errors: Array<{ caseRef: string; error: string }> = [];

  for (const [index, row] of batch.entries()) {
    console.info(
      JSON.stringify({
        event: "judgment_summary_dryrun_case",
        index: index + 1,
        total: batch.length,
        caseRef: row.caseRef,
      }),
    );
    const keep = keepByRef.get(normRef(row.caseRef));
    const sourceUrl = toJuFrameUrl(
      keep?.sourceUrl?.trim() || row.sourceUrl,
    );
    const defendant =
      keep?.defendantLabel?.trim() || row.companyNameNormalized;
    const partiesLine = partiesLineForRow(row, keepByRef);

    if (!hearingSummaryPendingForEvent(row.hearingKeyPointsZh, row.reviewStatus)) {
      for (const { outcomeHint, point } of existingPointsToRows(
        row,
        sourceUrl,
      )) {
        lines.push(
          [
            csvEscape(row.caseRef),
            csvEscape(sourceUrl),
            csvEscape(outcomeHint),
            csvEscape(point.keyPointZh),
            csvEscape(point.sourceQuoteZh),
          ].join(","),
        );
      }
      continue;
    }

    try {
      await new Promise((r) => setTimeout(r, 3500));
      const { text } = await fetchLegalrefJudgmentPlainText(sourceUrl);
      const draft = await draftJudgmentSummaryWithRetry({
        caseRef: row.caseRef,
        defendantLabel: defendant,
        partiesLine,
        sourcePlainText: text,
      });
      const outcome = draft.outcomeHint;
      for (const point of draft.points) {
        lines.push(
          [
            csvEscape(row.caseRef),
            csvEscape(sourceUrl),
            csvEscape(outcome),
            csvEscape(point.keyPointZh),
            csvEscape(point.sourceQuoteZh),
          ].join(","),
        );
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      errors.push({ caseRef: row.caseRef, error: msg });
      lines.push(
        [
          csvEscape(row.caseRef),
          csvEscape(sourceUrl),
          csvEscape(row.outcomeHint ?? "unclear"),
          csvEscape(`（dry-run 失敗：${msg}）`),
          csvEscape(""),
        ].join(","),
      );
    }
  }

  mkdirSync(resolve(outPath, ".."), { recursive: true });
  writeFileSync(outPath, `${lines.join("\n")}\n`, "utf8");

  console.log(
    JSON.stringify({
      event: "judgment_summary_dryrun_done",
      dryRun: true,
      wroteDb: false,
      seedPath,
      outPath,
      limit,
      batchSize: batch.length,
      csvRows: lines.length - 1,
      errors,
    }),
  );
}

main().catch((e) => {
  console.error(
    JSON.stringify({
      event: "judgment_summary_dryrun_fatal",
      error: e instanceof Error ? e.message : String(e),
    }),
  );
  process.exit(1);
});
