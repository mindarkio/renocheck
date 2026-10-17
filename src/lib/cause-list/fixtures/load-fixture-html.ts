import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const FIXTURE_DIR = path.dirname(fileURLToPath(import.meta.url));

export function loadCauseListFixtureHtml(name: string): string {
  return readFileSync(
    path.join(FIXTURE_DIR, "html", `${name}.fixture.html`),
    "utf8",
  );
}
