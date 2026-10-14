/**
 * Dev: raw Serp vs L1 for one fixture id (scripts/fixtures/search-evidence.json).
 * Usage:
 *   pnpm tsx scripts/diagnose-retrieval-case.ts yuanshi-international
 *   pnpm tsx scripts/diagnose-retrieval-case.ts fei-wong --phone 92805455
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  entityL1MustIncludeAny,
  entityMatchTokens,
} from "../src/lib/search-entity-labels";
import {
  buildRetrievalEvidence,
  filterWebSearchHitsForLlm,
} from "../src/lib/search-evidence-filter";
import { resolveAuthoritativeSearchLabel } from "../src/lib/entity-report-context";
import { normalizeHongKongPhone } from "../src/lib/normalize-phone";
import { fetchWebSearchHitsForEntity } from "../src/lib/web-search";

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

function parseArgs(argv: string[]): { id: string; phone?: string } {
  let id = "yuanshi-international";
  let phone: string | undefined;
  for (const arg of argv) {
    if (arg.startsWith("--phone=")) {
      phone = arg.slice("--phone=".length);
    } else if (!arg.startsWith("-")) {
      id = arg;
    }
  }
  return { id, phone };
}

async function main() {
  loadEnvLocal();
  const { id, phone: phoneArg } = parseArgs(process.argv.slice(2));
  const fixtures = JSON.parse(
    readFileSync(
      resolve(process.cwd(), "scripts/fixtures/search-evidence.json"),
      "utf8",
    ),
  ) as {
    cases: Array<{
      id: string;
      companyName?: string;
      phone?: string;
      mustIncludeInResults?: string | null;
    }>;
  };
  const case_ = fixtures.cases.find((c) => c.id === id);
  if (!case_) {
    console.error(`Unknown case id: ${id}`);
    process.exit(1);
  }
  const input = {
    companyName: case_.companyName,
    phone: phoneArg ?? case_.phone,
  };
  const phoneForL1 = normalizeHongKongPhone(input.phone) ?? undefined;
  const searchLabel = resolveAuthoritativeSearchLabel(input);
  const { hits: raw } = await fetchWebSearchHitsForEntity(input);
  const tokens = entityMatchTokens(input, { phoneNormalized: phoneForL1 });
  const bound = filterWebSearchHitsForLlm(raw, tokens, {
    normalizedPhone: phoneForL1,
    mustIncludeAny: entityL1MustIncludeAny(searchLabel),
  });
  const evidence = buildRetrievalEvidence(bound, tokens, {
    normalizedPhone: phoneForL1,
  });
  console.log(`Case ${id}: raw=${raw.length} bound=${bound.length}`);
  if (phoneForL1) console.log(`Phone L1: ${phoneForL1}`);
  console.log("Tokens:", tokens.join(" | "));
  console.log("\nBound hits:");
  for (const h of bound) {
    console.log(" ", h.url);
    console.log("   ", h.snippet.slice(0, 100));
  }
  if (evidence.length) {
    console.log("\nEvidence matchReason:");
    for (const row of evidence) {
      console.log(`  ${row.matchReason} @ ${row.url.slice(0, 60)}`);
    }
  }
  console.log("\nRaw sample:");
  for (const h of raw.slice(0, 12)) {
    const blob = `${h.title} ${h.snippet} ${h.url}`;
    const matched = tokens.filter((t) => blob.includes(t));
    console.log(
      matched.length ? `[${matched.join(",")}]` : "[—]",
      h.url.slice(0, 70),
      h.snippet.slice(0, 60),
    );
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
