import { readFileSync } from "node:fs";
import path from "node:path";
import type { NextConfig } from "next";
import {
  SECURITY_HEADERS_SOURCE,
  buildSecurityHeaders,
} from "./src/lib/security-headers";

// 必須喺 repo 根目錄 build（process.cwd()）
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
  async headers() {
    return [
      {
        source: SECURITY_HEADERS_SOURCE,
        headers: buildSecurityHeaders({
          dev: process.env.NODE_ENV === "development",
        }),
      },
      {
        source: "/admin/:path*",
        headers: [
          { key: "Cache-Control", value: "no-store" },
          { key: "X-Robots-Tag", value: "noindex, nofollow" },
        ],
      },
      ...[
        "/quote/analyses/:path*",
        "/account",
        "/login",
        "/quote/upload",
        "/api/auth/:path*",
        "/api/quote/:path*",
      ].map((source) => ({
        source,
        headers: [
          { key: "Cache-Control", value: "private, no-store" },
          { key: "X-Robots-Tag", value: "noindex, nofollow" },
        ],
      })),
    ];
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
