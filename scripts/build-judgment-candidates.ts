/**
 * D1 — merge parsed LRS HTML pages into judgment-candidates.json
 *
 * Usage:
 *   pnpm build:judgment-candidates
 *   pnpm build:judgment-candidates --from-dir=scripts/output/lrs-html
 */
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  judgmentCandidateRowSchema,
  judgmentCandidatesManifestSchema,
} from "../src/lib/judgment-candidates-schema";
import {
  lrsRowToCandidateFields,
  parseLrsSearchResultHtml,
} from "../src/lib/parse-lrs-search-html";

const OUT_DIR = resolve(process.cwd(), "scripts/output");
const OUT_PATH = resolve(OUT_DIR, "judgment-candidates.json");
const DEFAULT_HTML_DIR = resolve(OUT_DIR, "lrs-html");
const MANIFEST_PATH = resolve(OUT_DIR, "lrs-fetch-manifest.json");

type FetchManifestEntry = {
  profileId: string;
  tier: string;
  url: string;
  page: number;
  htmlPath: string;
  fetchedAt: string;
};

type FetchManifest = {
  entries: FetchManifestEntry[];
};

function loadFetchManifest(): FetchManifest {
  try {
    return JSON.parse(readFileSync(MANIFEST_PATH, "utf8")) as FetchManifest;
  } catch {
    return { entries: [] };
  }
}

function dedupeKey(caseRef: string): string {
  return caseRef.replace(/\s+/g, "").toUpperCase();
}

function main() {
  const fromDirArg = process.argv.find((a) => a.startsWith("--from-dir="));
  const htmlDir = fromDirArg
    ? resolve(process.cwd(), fromDirArg.slice("--from-dir=".length))
    : DEFAULT_HTML_DIR;

  const manifest = loadFetchManifest();
  const files = readdirSync(htmlDir).filter((f) => f.endsWith(".html"));
  if (files.length === 0) {
    console.error(
      JSON.stringify({
        event: "build_judgment_candidates_no_html",
        htmlDir,
        hint: "Run pnpm fetch:judgments first",
      }),
    );
    process.exit(1);
  }

  const byFile = new Map<string, FetchManifestEntry>();
  for (const e of manifest.entries) {
    byFile.set(e.htmlPath, e);
  }

  const merged = new Map<string, ReturnType<typeof lrsRowToCandidateFields>>();
  const generatedAt = new Date().toISOString();

  for (const file of files.sort()) {
    const htmlPath = resolve(htmlDir, file);
    const html = readFileSync(htmlPath, "utf8");
    const meta =
      byFile.get(htmlPath) ??
      manifest.entries.find((e) => e.htmlPath.endsWith(file));
    const listingUrl =
      meta?.url ??
      `https://legalref.judiciary.hk/lrs/common/search/search_result.jsp?local=${file}`;
    const profileId = meta?.profileId ?? file.replace(/\.html$/, "");
    const tier = meta?.tier ?? "?";
    const fetchedAt = meta?.fetchedAt ?? generatedAt;

    for (const row of parseLrsSearchResultHtml(html)) {
      if (!/^judgments$/i.test(row.database.trim())) continue;
      const candidate = lrsRowToCandidateFields(row, {
        lrsListingUrl: listingUrl,
        profileId,
        tier,
        fetchedAt,
      });
      const parsed = judgmentCandidateRowSchema.safeParse(candidate);
      if (!parsed.success) continue;
      merged.set(dedupeKey(parsed.data.caseRef), parsed.data);
    }
  }

  const backfillPath = resolve(OUT_DIR, "judgment-candidates-gold-backfill.json");
  try {
    const backfill = JSON.parse(readFileSync(backfillPath, "utf8")) as {
      candidates?: ReturnType<typeof lrsRowToCandidateFields>[];
    };
    for (const c of backfill.candidates ?? []) {
      const parsed = judgmentCandidateRowSchema.safeParse(c);
      if (parsed.success) merged.set(dedupeKey(parsed.data.caseRef), parsed.data);
    }
  } catch {
    // optional
  }

  const candidates = [...merged.values()];
  const payload = judgmentCandidatesManifestSchema.parse({
    schemaVersion: 1,
    generatedAt,
    policy: "no_serp_track1",
    entryCount: candidates.length,
    candidates,
  });

  mkdirSync(OUT_DIR, { recursive: true });
  writeFileSync(OUT_PATH, `${JSON.stringify(payload, null, 2)}\n`, "utf8");

  console.info(
    JSON.stringify({
      event: "build_judgment_candidates_done",
      path: OUT_PATH,
      candidates: candidates.length,
      htmlFiles: files.length,
    }),
  );
}

main();
