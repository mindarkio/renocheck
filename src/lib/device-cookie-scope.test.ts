import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const SRC = path.resolve(__dirname, "..");

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else if (/\.(ts|tsx)$/.test(name)) out.push(full);
  }
  return out;
}

describe("rc_did cookie scope", () => {
  it("is only named by the device helper and POST /api/feedback", () => {
    const allowed = new Set(
      [
        "src/lib/device-id.ts",
        "src/lib/device-id.test.ts",
        "src/app/api/feedback/route.ts",
        "src/app/api/feedback/route.test.ts",
        "src/lib/device-cookie-scope.test.ts",
      ].map((file) => path.resolve(file)),
    );
    const hits = walk(SRC).filter((file) => {
      if (allowed.has(file)) return false;
      return readFileSync(file, "utf8").includes("rc_did");
    });
    expect(hits).toEqual([]);
  });
});
