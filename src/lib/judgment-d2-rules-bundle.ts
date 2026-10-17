import { readdirSync } from "node:fs";
import { join } from "node:path";

const COURT_CONFIG = "scripts/config/court-from-case-ref.json";

/** Files whose content invalidates D2 step cache (keep in sync with glob + test). */
export function listD2RulesBundleFiles(cwd = process.cwd()): string[] {
  const libDir = join(cwd, "src/lib");
  const tsRules = readdirSync(libDir)
    .filter(
      (name) =>
        name.startsWith("judgment-d2-") &&
        name.endsWith(".ts") &&
        !name.endsWith(".test.ts"),
    )
    .map((name) => join("src/lib", name))
    .sort();
  return [...tsRules, COURT_CONFIG].sort();
}
