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
const CAND_PATH = resolve(
  process.cwd(),
  "scripts/output/judgment-candidates.json",
);

function normRef(caseRef: string): string {
  return caseRef.replace(/\s+/g, "").toUpperCase();
}

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

  const candByRef = new Map<string, { neutralCitation?: string }>();
  try {
    const cand = JSON.parse(readFileSync(CAND_PATH, "utf8")) as {
      candidates: Array<{ caseRef: string; neutralCitation?: string }>;
    };
    for (const c of cand.candidates) {
      candByRef.set(normRef(c.caseRef), c);
    }
  } catch {
    // optional
  }

  const headers = [
    "caseRef",
    "court",
    "reasons",
    "reviewReason",
    "judgmentTitle",
    "defendantLabel",
    "plaintiffLabel",
    "partiesLine",
    "profileId",
    "sourceUrl",
  ];

  const lines = [headers.join(",")];
  for (const e of reviews) {
    const discovered = e.discoveredFrom as { profileId?: string } | undefined;
    const reasonList = Array.isArray(e.reasons)
      ? e.reasons.map((r) => String(r))
      : [];
    const reviewReason = reasonList.join("; ");
    const meta = candByRef.get(normRef(String(e.caseRef ?? "")));
    const judgmentTitle = meta?.neutralCitation?.trim() ?? "";
    const row = [
      String(e.caseRef ?? ""),
      String(e.court ?? ""),
      reasonList.join(";"),
      reviewReason,
      judgmentTitle,
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
