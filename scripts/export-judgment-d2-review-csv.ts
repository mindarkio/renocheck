/**
 * Export D2 review queue to CSV for human triage.
 *
 *   pnpm d2:export-review-csv
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";

const QUEUE_PATH = resolve(
  process.cwd(),
  "scripts/output/judgment-d2-queue.json",
);
const OUT_PATH = resolve(
  process.cwd(),
  "scripts/output/judgment-d2-review.csv",
);

function csvEscape(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function main() {
  const queue = JSON.parse(readFileSync(QUEUE_PATH, "utf8")) as {
    policy: string;
    summary: Record<string, number>;
    entries: Array<Record<string, unknown>>;
  };

  const reviews = queue.entries.filter((e) => e.disposition === "review");
  const headers = [
    "caseRef",
    "court",
    "reasons",
    "defendantLabel",
    "plaintiffLabel",
    "partiesLine",
    "profileId",
    "sourceUrl",
  ];

  const lines = [headers.join(",")];
  for (const e of reviews) {
    const discovered = e.discoveredFrom as { profileId?: string } | undefined;
    const row = [
      String(e.caseRef ?? ""),
      String(e.court ?? ""),
      Array.isArray(e.reasons) ? e.reasons.join(";") : "",
      String(e.defendantLabel ?? ""),
      String(e.plaintiffLabel ?? ""),
      String(e.partiesLine ?? ""),
      String(discovered?.profileId ?? ""),
      String(e.sourceUrl ?? ""),
    ];
    lines.push(row.map(csvEscape).join(","));
  }

  mkdirSync(resolve(process.cwd(), "scripts/output"), { recursive: true });
  writeFileSync(OUT_PATH, `${lines.join("\n")}\n`, "utf8");

  console.info(
    JSON.stringify({
      event: "d2_export_review_csv_done",
      policy: queue.policy,
      summary: queue.summary,
      reviewRows: reviews.length,
      path: OUT_PATH,
    }),
  );
}

main();
