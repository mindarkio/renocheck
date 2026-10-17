import { existsSync } from "node:fs";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { scanCachedSnapshots } from "./backfill-scan";
import type { CauseListSnapshot } from "./cdx";

const DATE = "10032025";

function smtHtml(tableCount: number, close: boolean): string {
  const rows = Array.from({ length: tableCount }, (_, index) => {
    const n = index + 1;
    return `<table><tr><td>1</td><td>SCTC ${n}/2025</td><td>P</td><td>SYNTH DEFENDANT LIMITED</td><td>Work Done</td><td>Hearing</td></tr></table>`;
  }).join("");
  const tail = close ? "</html><script>document.title=\"x\"</script>" : "";
  return `<html><head><title>Daily List</title></head><body>Daily Cause List 10/03/2025 ${rows}${tail}`;
}

function snap(timestamp: string): CauseListSnapshot {
  return {
    court: "SMT",
    dateDdMmYyyy: DATE,
    iso: "2025-03-10",
    timestamp,
    original: `https://e-services.judiciary.hk/dcl/view.jsp?date=${DATE}&court=SMT`,
  };
}

describe("cached cause-list scan", () => {
  let dir = "";

  afterEach(async () => {
    if (dir) await rm(dir, { recursive: true, force: true });
    dir = "";
  });

  it("counts the first 90% of an SMT page as truncated and keeps none of its rows", async () => {
    dir = await mkdtemp(path.join(tmpdir(), "cause-list-scan-"));
    const full = smtHtml(8, true);
    const cut = full.slice(0, Math.floor(full.length * 0.9));
    const timestamp = "20250310120000";
    const filename = `SMT_${DATE}_wb${timestamp}.html`;
    await writeFile(path.join(dir, filename), cut);
    const scanned = await scanCachedSnapshots({
      snapshots: [snap(timestamp)],
      cacheDir: dir,
      files: [filename],
    });
    expect(scanned.pages.truncated).toBe(1);
    expect(scanned.rowsParsed.SMT).toBe(0);
    expect(scanned.pages.parsed).toBe(0);
  });

  it("counts a closed SMT page's rows", async () => {
    dir = await mkdtemp(path.join(tmpdir(), "cause-list-scan-"));
    const timestamp = "20250310120000";
    const filename = `SMT_${DATE}_wb${timestamp}.html`;
    await writeFile(path.join(dir, filename), smtHtml(4, true));
    const scanned = await scanCachedSnapshots({
      snapshots: [snap(timestamp), snap("20250310120001")],
      cacheDir: dir,
      files: [filename],
    });
    expect(scanned.pages.truncated).toBe(0);
    expect(scanned.rowsParsed.SMT).toBe(4);
    expect(scanned.fetchedKeys.size).toBe(1);
  });

  it("counts the first 90% of the cached 10 March 2025 SMT replay as truncated", async () => {
    const source = ".cache/cause-list/SMT_10032025_wb20250307103829.html";
    if (!existsSync(source)) return;
    dir = await mkdtemp(path.join(tmpdir(), "cause-list-scan-"));
    const html = await readFile(source, "utf8");
    const timestamp = "20250307103829";
    const filename = `SMT_${DATE}_wb${timestamp}.html`;
    await writeFile(path.join(dir, filename), html.slice(0, Math.floor(html.length * 0.9)));
    const truncated = await scanCachedSnapshots({
      snapshots: [snap(timestamp)],
      cacheDir: dir,
      files: [filename],
    });
    expect(truncated.pages.truncated).toBe(1);
    expect(truncated.rowsParsed.SMT).toBe(0);

    await writeFile(path.join(dir, filename), html);
    const full = await scanCachedSnapshots({
      snapshots: [snap(timestamp)],
      cacheDir: dir,
      files: [filename],
    });
    expect(full.pages.truncated).toBe(0);
    expect(full.rowsParsed.SMT).toBe(243);
  });
});
