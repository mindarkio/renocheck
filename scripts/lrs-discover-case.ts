/**
 * D1 — discover one judgment by LRS case number (Playwright).
 *
 *   pnpm lrs:discover-case --case=HCSA59/2014
 *   pnpm lrs:discover-case --case=HCSA59/2014 --write-candidates
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { judgmentCandidateRowSchema } from "../src/lib/judgment-candidates-schema";
import {
  lrsRowToCandidateFields,
  parseLrsSearchResultHtml,
} from "../src/lib/parse-lrs-search-html";
import { buildLrsCaseNumberSearchResultUrl } from "../src/lib/lrs-search-url";
import { fetchLrsSearchPageHtml } from "./lib/lrs-playwright-fetch";

const OUT_HTML = resolve(process.cwd(), "scripts/output/lrs-html");
const CANDIDATES_PATH = resolve(
  process.cwd(),
  "scripts/output/judgment-candidates.json",
);

function caseArg(): string {
  const a = process.argv.find((x) => x.startsWith("--case="));
  if (!a) {
    console.error(
      JSON.stringify({
        event: "lrs_discover_case_missing_arg",
        hint: "pnpm lrs:discover-case --case=HCSA59/2014",
      }),
    );
    process.exit(1);
  }
  return a.slice("--case=".length).trim();
}

function formatCaseRefForDisplay(caseRef: string): string {
  const compact = caseRef.replace(/\s+/g, "");
  const m = compact.match(/^([A-Z]{2,6})(\d+\/\d{4})$/i);
  if (!m) return caseRef.trim();
  return `${m[1].toUpperCase()} ${m[2]}`;
}

async function main() {
  const caseRefInput = caseArg();
  const writeCandidates = process.argv.includes("--write-candidates");
  const url = buildLrsCaseNumberSearchResultUrl(caseRefInput);
  const profileId = `case-number-${caseRefInput.replace(/[^a-zA-Z0-9]+/g, "-")}`;

  const { chromium } = await import("playwright");
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const html = await fetchLrsSearchPageHtml(page, url);
  await browser.close();

  mkdirSync(OUT_HTML, { recursive: true });
  const htmlPath = resolve(OUT_HTML, `${profileId}-p1.html`);
  writeFileSync(htmlPath, html, "utf8");

  const rows = parseLrsSearchResultHtml(html).filter((r) =>
    /^judgments$/i.test(r.database.trim()),
  );
  const compactWanted = caseRefInput.replace(/\s+/g, "").toUpperCase();
  const row = rows.find(
    (r) => r.caseRef.replace(/\s+/g, "").toUpperCase() === compactWanted,
  );

  if (!row) {
    console.error(
      JSON.stringify({
        event: "lrs_discover_case_not_found",
        caseRef: caseRefInput,
        url,
        htmlPath,
        rowCount: rows.length,
      }),
    );
    process.exit(1);
  }

  const fetchedAt = new Date().toISOString();
  const candidate = judgmentCandidateRowSchema.parse(
    lrsRowToCandidateFields(row, {
      lrsListingUrl: url,
      profileId,
      tier: "A",
      fetchedAt,
    }),
  );

  const dis = row.judgmentDetailQuery?.match(/DIS=(\d+)/)?.[1];
  const payload = {
    caseRef: formatCaseRefForDisplay(row.caseRef),
    candidate,
    sourceUrl: dis
      ? `https://legalref.judiciary.hk/lrs/common/ju/ju_frame.jsp?DIS=${dis}&TP=JU`
      : null,
    htmlPath,
    searchUrl: url,
  };

  console.info(JSON.stringify({ event: "lrs_discover_case_ok", ...payload }));

  if (writeCandidates) {
    let manifest = {
      schemaVersion: 1 as const,
      generatedAt: fetchedAt,
      policy: "no_serp_track1" as const,
      entryCount: 1,
      candidates: [candidate],
    };
    try {
      const existing = JSON.parse(readFileSync(CANDIDATES_PATH, "utf8")) as {
        candidates: typeof candidate[];
      };
      const key = (c: { caseRef: string }) =>
        c.caseRef.replace(/\s+/g, "").toUpperCase();
      const merged = new Map(
        (existing.candidates ?? []).map((c) => [key(c), c]),
      );
      merged.set(key(candidate), candidate);
      const candidates = [...merged.values()];
      manifest = {
        schemaVersion: 1,
        generatedAt: fetchedAt,
        policy: "no_serp_track1",
        entryCount: candidates.length,
        candidates,
      };
    } catch {
      // new file
    }
    writeFileSync(
      CANDIDATES_PATH,
      `${JSON.stringify(manifest, null, 2)}\n`,
      "utf8",
    );
    console.info(
      JSON.stringify({
        event: "lrs_discover_case_merged_candidates",
        path: CANDIDATES_PATH,
        entryCount: manifest.entryCount,
      }),
    );
  }
}

main().catch((err) => {
  console.error(
    JSON.stringify({ event: "lrs_discover_case_failed", error: String(err) }),
  );
  process.exit(1);
});
