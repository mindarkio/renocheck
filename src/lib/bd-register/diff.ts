import type { BdRegisterEntry } from "./types";

export type BdMwcDiff = {
  added: string[];
  removed: string[];
  changed: string[];
  unchanged: number;
};

function isMwcCompanyRow(e: BdRegisterEntry): boolean {
  return e.registerType === "MWC" && !e.unincorporated && Boolean(e.nameEn || e.nameZh);
}

function rowSignature(e: BdRegisterEntry): string {
  return JSON.stringify({
    nameEn: e.nameEn ?? "",
    nameZh: e.nameZh ?? "",
    expiryDate: e.expiryDate ?? "",
    flag: e.flag ?? "",
  });
}

/** Diff MWC company rows by regNo (names, expiry, flag). */
export function diffBdMwc(base: BdRegisterEntry[], cand: BdRegisterEntry[]): BdMwcDiff {
  const baseMap = new Map<string, BdRegisterEntry>();
  const candMap = new Map<string, BdRegisterEntry>();
  for (const e of base) {
    if (isMwcCompanyRow(e)) baseMap.set(e.regNo, e);
  }
  for (const e of cand) {
    if (isMwcCompanyRow(e)) candMap.set(e.regNo, e);
  }

  const added: string[] = [];
  const removed: string[] = [];
  const changed: string[] = [];
  let unchanged = 0;

  for (const regNo of candMap.keys()) {
    if (!baseMap.has(regNo)) added.push(regNo);
  }
  for (const regNo of baseMap.keys()) {
    if (!candMap.has(regNo)) removed.push(regNo);
  }
  for (const [regNo, b] of baseMap) {
    const c = candMap.get(regNo);
    if (!c) continue;
    if (rowSignature(b) === rowSignature(c)) unchanged += 1;
    else changed.push(regNo);
  }

  added.sort();
  removed.sort();
  changed.sort();

  return { added, removed, changed, unchanged };
}
