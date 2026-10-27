/**
 * Static response headers for every route.
 *
 * A nonce CSP would force dynamic rendering and drop prerender / PPR caching.
 * These values are fixed at build time. `next dev` adds `'unsafe-eval'` because
 * React's dev runtime needs it. Production does not.
 *
 * HSTS is intentionally absent: Vercel already sends max-age=63072000 without
 * includeSubDomains or preload. Do not duplicate or override it.
 */

export type SecurityHeader = {
  key: string;
  value: string;
};

/** Next.js path-to-regexp source that matches `/` and every nested path. */
export const SECURITY_HEADERS_SOURCE = "/:path*";

/** Judiciary daily cause list search. The report form posts here in a new tab. */
export const JUDICIARY_FORM_ACTION_ORIGIN = "https://e-services.judiciary.hk";

const PERMISSIONS_POLICY = [
  "camera=()",
  "microphone=()",
  "geolocation=()",
  "payment=()",
  "usb=()",
  "browsing-topics=()",
].join(", ");

export function buildContentSecurityPolicy(options: { dev: boolean }): string {
  const scriptSrc = ["'self'", "'unsafe-inline'"];
  if (options.dev) scriptSrc.push("'unsafe-eval'");

  return [
    "default-src 'self'",
    `script-src ${scriptSrc.join(" ")}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self'",
    "connect-src 'self'",
    "manifest-src 'self'",
    "frame-src 'none'",
    "object-src 'none'",
    "base-uri 'self'",
    `form-action 'self' ${JUDICIARY_FORM_ACTION_ORIGIN}`,
    "frame-ancestors 'none'",
    "upgrade-insecure-requests",
  ].join("; ");
}

export function buildSecurityHeaders(options: { dev: boolean }): SecurityHeader[] {
  return [
    {
      key: "Content-Security-Policy",
      value: buildContentSecurityPolicy(options),
    },
    { key: "X-Frame-Options", value: "DENY" },
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    { key: "Permissions-Policy", value: PERMISSIONS_POLICY },
  ];
}
