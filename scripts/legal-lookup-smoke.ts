/**
 * Dev smoke: DB lookup only (no Serp/LLM). DEC-0012 P5.
 *
 * Usage:
 *   pnpm legal:lookup-smoke "示例裝修工程有限公司"
 *   pnpm legal:lookup-smoke --br 12345678
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { lookupLegalJudgments } from "../src/lib/lookup-legal-judgments";

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

async function main() {
  loadEnvLocal();
  const args = process.argv.slice(2);
  let br: string | undefined;
  let label = "";
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--br" && args[i + 1]) {
      br = args[++i];
    } else if (!args[i].startsWith("--")) {
      label = args[i];
    }
  }
  if (!label && !br) {
    label = "示例裝修工程有限公司";
  }

  const url =
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error("Missing Supabase URL or SUPABASE_SERVICE_ROLE_KEY");
    process.exit(1);
  }

  const supabase = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const result = await lookupLegalJudgments(supabase, {
    searchLabelUsed: label || "—",
    br,
  });

  console.info(
    JSON.stringify(
      {
        event: "legal_lookup_smoke",
        searchLabelUsed: label || null,
        br: br ?? null,
        registryAsOf: result.registryAsOf,
        matchCount: result.events.length,
        cases: result.events.map((e) => ({
          caseRef: e.caseRef,
          category: e.judgmentCategory,
          role: e.partyRole,
        })),
      },
      null,
      2,
    ),
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
