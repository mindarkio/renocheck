import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseSmtCauseListHtml } from "./parse-smt";
import { isCompleteReplay } from "./replay-complete";

const DATE = "10032025";

function smtHtml(tableCount: number, options?: { close?: boolean; extraTable?: boolean }): string {
  const rows = Array.from({ length: tableCount }, (_, index) => {
    const n = index + 1;
    return `<table><tr><td>1</td><td>SCTC ${n}/2025</td><td>P</td><td>SYNTH DEFENDANT LIMITED</td><td>Work Done</td><td>Hearing</td></tr></table>`;
  }).join("");
  const extra = options?.extraTable
    ? `<table><tr><td>SCTC ${tableCount + 1}/2025</td></tr></table>`
    : "";
  const close = options?.close === false ? "" : "</html><script>document.title=\"x\"</script>";
  return `<html><head><title>Daily List</title></head><body>Daily Cause List 10/03/2025 ${rows}${extra}${close}`;
}

describe("replay completeness", () => {
  it("accepts a closed SMT page whose table count matches the parse", () => {
    const html = smtHtml(4);
    const parsed = parseSmtCauseListHtml(html, DATE);
    expect(parsed.cases.length).toBe(4);
    expect(isCompleteReplay("SMT", html, parsed.cases.length)).toBe(true);
  });

  it("rejects a sliced page and a closed page with an extra unparsed table", () => {
    const full = smtHtml(4);
    const sliced = full.slice(0, Math.floor(full.length * 0.9));
    const slicedParsed = parseSmtCauseListHtml(sliced, DATE);
    expect(isCompleteReplay("SMT", sliced, slicedParsed.cases.length)).toBe(false);

    const extra = smtHtml(4, { extraTable: true });
    const extraParsed = parseSmtCauseListHtml(extra, DATE);
    expect(extraParsed.cases.length).toBe(4);
    expect(isCompleteReplay("SMT", extra, extraParsed.cases.length)).toBe(false);
  });

  it("rejects truncations of the cached 10 March 2025 SMT replay when that file is present", () => {
    const path = ".cache/cause-list/SMT_10032025_wb20250307103829.html";
    if (!existsSync(path)) return;
    const html = readFileSync(path, "utf8");
    const full = parseSmtCauseListHtml(html, DATE);
    expect(full.cases.length).toBe(243);
    expect(isCompleteReplay("SMT", html, full.cases.length)).toBe(true);
    for (const [pct, rows] of [
      [0.3, 71],
      [0.6, 144],
      [0.9, 229],
    ] as const) {
      const cut = html.slice(0, Math.floor(html.length * pct));
      const parsed = parseSmtCauseListHtml(cut, DATE);
      expect(parsed.cases.length).toBe(rows);
      expect(isCompleteReplay("SMT", cut, parsed.cases.length)).toBe(false);
    }
  });
});
