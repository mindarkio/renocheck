/**
 * Download BD registers full-list CSV to .cache/bd-register/ (gitignored).
 *
 * Usage: pnpm bd-register:fetch
 *
 * Env: BD_REGISTER_CSV_URL (default: static.data.gov.hk PSI URL in sources.ts)
 */
import { mkdir, writeFile } from "node:fs/promises";
import {
  BD_REGISTER_CACHE_DIR,
  BD_REGISTER_CSV_PATH,
  BD_REGISTER_META_PATH,
} from "../../src/lib/bd-register/paths";
import { BD_REGISTERS_FULL_LIST_CSV_URL } from "../../src/lib/bd-register/sources";
import {
  fetchBdRegisterCsv,
  sha256Hex,
  validateBdRegisterCsvBytes,
} from "../../src/lib/bd-register/fetch-csv";
import { checkRobotsAllowsFetch } from "../../src/lib/cause-list/fetch-dcl";

const USER_AGENT =
  "RenocheckBdRegisterResearch/0.1 (+https://renocheck.homes; offline register dev)";
const MIN_DELAY_MS = 3000;
const MAX_DELAY_MS = 5000;

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  await mkdir(BD_REGISTER_CACHE_DIR, { recursive: true });

  const delay =
    MIN_DELAY_MS + Math.floor(Math.random() * (MAX_DELAY_MS - MIN_DELAY_MS + 1));
  console.info(`Waiting ${delay}ms before fetch…`);
  await sleep(delay);

  const url = process.env.BD_REGISTER_CSV_URL?.trim() || BD_REGISTERS_FULL_LIST_CSV_URL;
  const origin = new URL(url).origin;
  await checkRobotsAllowsFetch(origin, USER_AGENT, new URL(url).pathname);

  const fetched = await fetchBdRegisterCsv(url, { userAgent: USER_AGENT });
  validateBdRegisterCsvBytes(fetched.body);

  const retrievedAt = new Date().toISOString();
  const hash = sha256Hex(fetched.body);
  await writeFile(BD_REGISTER_CSV_PATH, fetched.body);
  await writeFile(
    BD_REGISTER_META_PATH,
    JSON.stringify(
      {
        url: fetched.url,
        retrieved_at: retrievedAt,
        http_status: fetched.httpStatus,
        bytes: fetched.body.length,
        last_modified: fetched.lastModified,
        etag: fetched.etag,
        sha256: hash,
      },
      null,
      2,
    ) + "\n",
    "utf8",
  );

  console.info(
    JSON.stringify({
      event: "bd_register_fetch",
      mode: "http",
      url: fetched.url,
      bytes: fetched.body.length,
      sha256: hash,
      path: BD_REGISTER_CSV_PATH,
      meta_path: BD_REGISTER_META_PATH,
    }),
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
