import { readdirSync } from "node:fs";
import { join } from "node:path";

const COURT_CONFIG = "scripts/config/court-from-case-ref.json";

/** Non-`judgment-d2-*` modules that affect D2 disposition / cache (explicit SSOT). */
const EXPLICIT_D2_BUNDLE_FILES = [
  "src/lib/entity-report-context.ts",
  "src/lib/mwc-company-search-terms.ts",
  "src/lib/mwc-contractors-memory-index.ts",
  "src/lib/court-from-case-ref.ts",
] as const;

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
  const merged = [...tsRules, ...EXPLICIT_D2_BUNDLE_FILES, COURT_CONFIG];
  return [...new Set(merged)].sort();
}
