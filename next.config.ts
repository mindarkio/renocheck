import { readFileSync } from "node:fs";
import path from "node:path";
import type { NextConfig } from "next";

function readPackageVersion(): string {
  const raw = readFileSync(path.join(process.cwd(), "package.json"), "utf8");
  const parsed: unknown = JSON.parse(raw);
  if (
    typeof parsed !== "object" ||
    parsed === null ||
    !("version" in parsed) ||
    typeof parsed.version !== "string" ||
    parsed.version.length === 0
  ) {
    throw new Error("package.json version must be a non-empty string");
  }
  return parsed.version;
}

const nextConfig: NextConfig = {
  /* config options here */
  // Inline only the version string. Do not import package.json from client modules.
  env: {
    NEXT_PUBLIC_APP_VERSION: readPackageVersion(),
  },
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
