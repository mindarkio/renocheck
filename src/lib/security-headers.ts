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

/**
 * Judiciary daily cause list search. The report form posts here in a new tab.
 * Must equal `JUDICIARY_DCL_SEARCH_ACTION` (pinned by security-headers.test.ts).
 * A full URL scopes form-action to that one endpoint; CSP ignores the path
 * after a redirect, so a same-host redirect from the judiciary still works.
 */
export const JUDICIARY_FORM_ACTION_URL = "https://e-services.judiciary.hk/dcl/search.jsp";

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
    "script-src-attr 'none'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self'",
    "connect-src 'self'",
    "manifest-src 'self'",
    "frame-src 'none'",
    "worker-src 'none'",
    "object-src 'none'",
    "base-uri 'none'",
    `form-action 'self' ${JUDICIARY_FORM_ACTION_URL}`,
    "frame-ancestors 'none'",
    // Production is HTTPS-only (Vercel HSTS). In `next dev` over plain HTTP, WebKit
    // upgrades even loopback subresources and every browser upgrades a LAN IP, so
    // an iPhone hitting http://<lan-ip>:3000 would load no JS or CSS.
    ...(options.dev ? [] : ["upgrade-insecure-requests"]),
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
    { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  ];
}
