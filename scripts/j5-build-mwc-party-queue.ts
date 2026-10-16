/**
 * J5 — export MWC/MWC(W) rows as LRS Parties search queue.
 *
 *   pnpm j5:build-queue
 */
import { createClient } from "@supabase/supabase-js";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const OUT_PATH = resolve(
  process.cwd(),
  "scripts/output/j5-mwc-party-queue.json",
);

type QueueEntry = {
  registrationNo: string;
  companyName: string;
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

async function main() {
  loadEnvLocal();
  const url =
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error("Missing Supabase env");
    process.exit(1);
  }

  const supabase = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const pageSize = 1000;
  const entries: QueueEntry[] = [];
  let from = 0;

  for (;;) {
    const { data, error } = await supabase
      .from("mwc_contractors")
      .select("registration_no, company_name")
      .order("registration_no", { ascending: true })
      .range(from, from + pageSize - 1);
    if (error) {
      console.error(error);
      process.exit(1);
    }
    if (!data?.length) break;
    for (const row of data) {
      const name = (row.company_name as string)?.trim() ?? "";
      if (name.length < 2) continue;
      entries.push({
        registrationNo: row.registration_no as string,
        companyName: name,
      });
    }
    if (data.length < pageSize) break;
    from += pageSize;
  }

  const payload = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    total: entries.length,
    entries,
  };

  mkdirSync(resolve(process.cwd(), "scripts/output"), { recursive: true });
  writeFileSync(OUT_PATH, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  console.info(
    JSON.stringify({ event: "j5_build_mwc_party_queue_done", path: OUT_PATH, total: entries.length }),
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
