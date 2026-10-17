/**
 * Download BD registers full-list CSV to .cache/bd-register/ (gitignored).
 *
 * Usage:
 *   pnpm bd-register:fetch
 *   pnpm bd-register:fetch --copy-from-docs   # offline: copy docs/sourcedata snapshot
 *
 * Env: BD_REGISTER_CSV_URL (default: static.data.gov.hk PSI URL in sources.ts)
 */
import { copyFile, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { readFileSync } from "node:fs";
import { BD_REGISTERS_FULL_LIST_CSV_URL } from "../../src/lib/bd-register/sources";
import {
  checkRobotsAllowsFetch,
  fetchDclHtml,
} from "../../src/lib/cause-list/fetch-dcl";

const USER_AGENT =
  "RenocheckBdRegisterResearch/0.1 (+https://renocheck.homes; offline register dev)";
const MIN_DELAY_MS = 3000;
const MAX_DELAY_MS = 5000;

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function parseArgs(argv: string[]) {
  return { copyFromDocs: argv.includes("--copy-from-docs") };
}

async function main() {
  const { copyFromDocs } = parseArgs(process.argv.slice(2));
  const cacheDir = path.join(process.cwd(), ".cache", "bd-register");
  await mkdir(cacheDir, { recursive: true });
  const outPath = path.join(cacheDir, "registers_full_list.csv");

  if (copyFromDocs) {
    const src = path.join(process.cwd(), "docs/sourcedata/registers_full_list.csv");
    await copyFile(src, outPath);
    console.info(
      JSON.stringify({
        event: "bd_register_fetch",
        mode: "copy_from_docs",
        bytes: readFileSync(outPath).length,
        path: outPath,
      }),
    );
    return;
  }

  const delay =
    MIN_DELAY_MS + Math.floor(Math.random() * (MAX_DELAY_MS - MIN_DELAY_MS + 1));
  console.info(`Waiting ${delay}ms before fetch…`);
  await sleep(delay);

  const url = process.env.BD_REGISTER_CSV_URL?.trim() || BD_REGISTERS_FULL_LIST_CSV_URL;
  const origin = new URL(url).origin;
  await checkRobotsAllowsFetch(origin, USER_AGENT, new URL(url).pathname);

  const body = await fetchDclHtml(url, { userAgent: USER_AGENT });
  await writeFile(outPath, body, "utf8");
  console.info(
    JSON.stringify({
      event: "bd_register_fetch",
      mode: "http",
      url,
      bytes: body.length,
      path: outPath,
    }),
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
