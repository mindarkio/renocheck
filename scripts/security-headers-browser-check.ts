/**
 * Local browser check for the static security headers. Not part of `pnpm test`.
 *
 *   BASE_URL=http://127.0.0.1:3456 pnpm exec tsx scripts/security-headers-browser-check.ts
 *
 * The server must already be `next start` on that localhost URL. This script
 * never calls production, the preview deployment, or the judiciary: non-local
 * requests are aborted inside the browser. The cause-list check only proves
 * the browser was allowed to start the POST.
 *
 * Fixture names are synthetic and exist only in this process.
 */
import {
  chromium,
  type APIResponse,
  type BrowserContext,
  type Page,
  type Request,
  type Response,
} from "playwright";
import {
  buildContentSecurityPolicy,
  buildSecurityHeaders,
} from "../src/lib/security-headers";

const FINGERPRINT = "c0ffee00c0ffee00c0ffee00c0ffee00";
const COMPANY = "合成測試有限公司";
const JUDICIARY_ACTION = "https://e-services.judiciary.hk/dcl/search.jsp";

const HTML_PAGES = [
  "/",
  "/faq",
  "/how-it-works",
  "/about",
  "/legal/disclaimer",
  "/guides/check-renovation-contractor-licence",
  "/login",
] as const;

type Violation = {
  page: string;
  directive: string;
  blocked: string;
  sample: string;
};

type HeaderSource = Response | APIResponse;

function assertLocalBase(baseUrl: string): URL {
  const url = new URL(baseUrl);
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error(`BASE_URL must be http(s), got ${url.protocol}`);
  }
  if (url.hostname !== "127.0.0.1" && url.hostname !== "localhost") {
    throw new Error(`BASE_URL must be localhost, got ${url.hostname}`);
  }
  return url;
}

function isLocalHost(hostname: string): boolean {
  return hostname === "127.0.0.1" || hostname === "localhost";
}

async function listHeaders(
  response: HeaderSource,
): Promise<{ name: string; value: string }[]> {
  // Page Response.headersArray() is async; APIResponse.headersArray() is sync. await covers both.
  return await response.headersArray();
}

async function valuesOf(response: HeaderSource, name: string): Promise<string[]> {
  const headers = await listHeaders(response);
  return headers
    .filter((header) => header.name.toLowerCase() === name.toLowerCase())
    .map((header) => header.value);
}

async function assertSecurityHeaders(response: HeaderSource, path: string): Promise<void> {
  for (const header of buildSecurityHeaders({ dev: false })) {
    const values = await valuesOf(response, header.key);
    if (values.length !== 1 || values[0] !== header.value) {
      throw new Error(
        `${path} ${header.key} = ${JSON.stringify(values)}, expected one ${JSON.stringify(header.value)}`,
      );
    }
  }
  const hsts = await valuesOf(response, "strict-transport-security");
  if (hsts.length > 0) {
    throw new Error(`${path} must not set HSTS (leave it to Vercel): ${hsts.join(" | ")}`);
  }
  if ((await valuesOf(response, "content-security-policy-report-only")).length > 0) {
    throw new Error(`${path} must enforce CSP, not Report-Only`);
  }
}

function syntheticReport() {
  return {
    reportVersion: "2.7.0",
    entity: {
      displayName: COMPANY,
      matchType: "company_name",
      queryEcho: COMPANY,
      searchLabelUsed: COMPANY,
      nameAlignment: "match",
    },
    grade: "C",
    confidence: "low",
    evaluation: {
      overallGrade: "C",
      displayGradeZh: "C",
      riskBandZh: "中性",
      confidence: "low",
      dataSaturation: "sparse",
      complianceTrack: {
        isMwcRegistered: true,
        licenseStatus: "active",
      },
      reputationTrack: {
        disputeLevel: "none_detected",
        recentDisputeCount: 0,
      },
    },
    summaryZh: "合成測試摘要。公開資料不足以下結論。",
    official: {
      mwcMatched: true,
      details: {
        companyName: COMPANY,
        registrationNo: "MWC(W)999001",
        expiryDate: "2027-01-15",
      },
      legalLookupStatus: "ok",
      legalEvents: [],
    },
    signals: {
      discussionCount: 0,
      themes: [],
      highlights: [],
      boundHitCount: 0,
      retrievalEvidence: [],
      contractChecklist: ["有無書面合約？"],
      actionableClauses: [],
    },
    disclaimerVersion: "1.2.5",
    generatedAt: "2026-10-27T02:00:00.000Z",
  };
}

async function installRoutes(context: BrowserContext, external: string[]): Promise<void> {
  await context.route("**/*", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (!isLocalHost(url.hostname)) {
      external.push(`${request.method()} ${url.href}`);
      await route.abort("blockedbyclient");
      return;
    }

    if (url.pathname === "/api/search" && request.method() === "POST") {
      const body = request.postDataJSON() as { preview?: string };
      if (body.preview === "register") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            matchCount: 2,
            windowFull: false,
            candidates: [
              {
                companyName: COMPANY,
                companyNameEn: "ZZQ Synthetic Alpha Limited",
                registrationNo: "MWC(W)999001",
                exact: true,
              },
              {
                companyName: "合成測試工程有限公司",
                companyNameEn: "ZZQ Synthetic Beta Limited",
                registrationNo: "MWC(W)999002",
                exact: false,
              },
            ],
          }),
        });
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ fingerprint: FINGERPRINT, report: syntheticReport() }),
      });
      return;
    }

    if (url.pathname === `/api/report/${FINGERPRINT}`) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ report: syntheticReport() }),
      });
      return;
    }

    if (url.pathname.startsWith("/api/")) {
      await route.fulfill({ status: 204, body: "" });
      return;
    }

    await route.continue();
  });
}

async function readViolations(page: Page): Promise<Violation[]> {
  return page.evaluate(() => {
    const list =
      (window as unknown as { __cspViolations?: Violation[] }).__cspViolations ?? [];
    return list;
  });
}

async function main(): Promise<void> {
  const baseUrl = process.env.BASE_URL?.trim();
  if (!baseUrl) throw new Error("BASE_URL is required");
  const origin = assertLocalBase(baseUrl).origin;
  const violations: Violation[] = [];
  const consoleHits: string[] = [];
  const external: string[] = [];

  const browser = await chromium.launch({ headless: true });
  // The feedback slide-in fades in over 200ms. Reduced motion makes it render at
  // its end state (motion-reduce:opacity-100, transition-none), so the style
  // check below never samples a half-finished fade.
  const context = await browser.newContext({
    viewport: { width: 1280, height: 700 },
    reducedMotion: "reduce",
  });
  await context.addInitScript(() => {
    const target = window as unknown as { __cspViolations: Violation[] };
    target.__cspViolations = [];
    document.addEventListener("securitypolicyviolation", (event) => {
      target.__cspViolations.push({
        page: location.pathname,
        directive: event.violatedDirective,
        blocked: event.blockedURI,
        sample: event.sample,
      });
    });
  });
  await installRoutes(context, external);

  const page = await context.newPage();
  page.setDefaultTimeout(60_000);
  page.on("console", (message) => {
    const text = message.text();
    if (/content security policy/i.test(text)) consoleHits.push(`${page.url()} ${text}`);
  });
  page.on("pageerror", (error) => {
    if (/content security policy/i.test(error.message)) {
      consoleHits.push(`${page.url()} ${error.message}`);
    }
  });

  async function visit(path: string): Promise<void> {
    const response = await page.goto(`${origin}${path}`, { waitUntil: "load" });
    if (!response) throw new Error(`${path} did not return a response`);
    if (!response.ok()) throw new Error(`${path} status ${response.status()}`);
    await assertSecurityHeaders(response, path);
    violations.push(...(await readViolations(page)));
  }

  try {
    await visit("/");
    const home = await page.evaluate(async () => {
      await document.fonts.ready;
      const images = [...document.images].map((image) => ({
        src: image.currentSrc || image.src,
        width: image.naturalWidth,
      }));
      const jsonLd = [...document.querySelectorAll('script[type="application/ld+json"]')].map(
        (node) => node.textContent ?? "",
      );
      return {
        images,
        jsonLd,
        canonical: document.querySelector('link[rel="canonical"]')?.getAttribute("href") ?? "",
        version: document.body.innerText.includes("v0.9.14"),
        fontFamily: getComputedStyle(document.body).fontFamily,
        notoLoaded: [...document.fonts].some(
          (face) => /Noto/i.test(face.family) && face.status === "loaded",
        ),
      };
    });
    if (!home.version) throw new Error("home footer is not v0.9.14");
    if (!home.notoLoaded) throw new Error(`Noto Sans TC did not load (${home.fontFamily})`);
    const broken = home.images.filter((image) => image.width === 0);
    if (broken.length > 0) throw new Error(`home images failed: ${JSON.stringify(broken)}`);
    if (!home.images.some((image) => image.src.includes("/logo/"))) {
      throw new Error("home did not render a same-origin logo");
    }
    if (home.jsonLd.length === 0) throw new Error("home JSON-LD missing");
    if (home.canonical !== "https://renocheck.homes" && home.canonical !== "https://renocheck.homes/") {
      throw new Error(`home canonical changed: ${home.canonical}`);
    }
    for (const block of home.jsonLd) JSON.parse(block);
    violations.push(...(await readViolations(page)));

    for (const path of HTML_PAGES.slice(1)) await visit(path);

    await visit("/faq");
    const faqCanonical = await page.locator('link[rel="canonical"]').getAttribute("href");
    if (!faqCanonical?.endsWith("/faq")) throw new Error(`faq canonical changed: ${faqCanonical}`);
    const faqData = JSON.parse(
      (await page.locator('script[type="application/ld+json"]').first().textContent()) ?? "null",
    ) as { "@type"?: string };
    if (faqData["@type"] !== "FAQPage") throw new Error("faq JSON-LD was not an FAQPage");

    await visit("/legal/disclaimer");
    if (!(await page.getByText("版本 1.2.5").count())) {
      throw new Error("disclaimer version is no longer 1.2.5");
    }

    await visit("/");
    await page.locator("#search-query").fill(COMPANY);
    await page.locator("#search-query").press("Enter");
    await page.getByRole("heading", { name: "名冊有多過一間相符" }).waitFor();
    await page.getByRole("radio").first().check();
    await page.getByRole("button", { name: "查呢間" }).click();
    await page.waitForURL(new RegExp(`/report/${FINGERPRINT}$`));
    await page.getByRole("heading", { name: COMPANY }).waitFor();

    const form = page.locator(`form[action="${JUDICIARY_ACTION}"]`);
    await form.waitFor();
    const submit = form.locator('button[type="submit"]');
    if (await submit.isDisabled()) {
      throw new Error("cause-list submit stayed disabled after hydration");
    }
    const judiciaryRequest = new Promise<Request>((resolve, reject) => {
      const timer = setTimeout(
        () => reject(new Error("judiciary form POST was not attempted")),
        10_000,
      );
      const onRequest = (request: Request) => {
        if (!request.url().startsWith(JUDICIARY_ACTION)) return;
        clearTimeout(timer);
        context.off("request", onRequest);
        resolve(request);
      };
      context.on("request", onRequest);
    });
    await submit.click();
    const posted = await judiciaryRequest;
    if (posted.method() !== "POST") {
      throw new Error(`cause-list form used ${posted.method()} instead of POST`);
    }

    await page.evaluate(() => window.scrollTo(0, 0));
    await page.locator("#report-feedback-slide").waitFor({ timeout: 50_000 });
    const slideStyle = await page.locator("#report-feedback-slide").evaluate((element) => {
      const style = getComputedStyle(element);
      return { opacity: style.opacity, bottom: style.bottom, position: style.position };
    });
    if (slideStyle.position !== "fixed" || slideStyle.opacity !== "1" || slideStyle.bottom === "auto") {
      throw new Error(`feedback slide-in style was blocked: ${JSON.stringify(slideStyle)}`);
    }
    violations.push(...(await readViolations(page)));

    const reportDoc = await context.request.get(`${origin}/report/${FINGERPRINT}`);
    if (!reportDoc.ok()) throw new Error(`report document status ${reportDoc.status()}`);
    await assertSecurityHeaders(reportDoc, `/report/${FINGERPRINT}`);

    for (const path of ["/robots.txt", "/sitemap.xml", "/llms.txt", "/og.png", "/admin", "/guides/this-guide-does-not-exist"]) {
      await assertSecurityHeaders(await context.request.get(`${origin}${path}`), path);
    }

    const robots = await (await context.request.get(`${origin}/robots.txt`)).text();
    if (!robots.includes("Disallow: /api/") || robots.includes("Disallow: /admin") || !robots.includes("Sitemap:")) {
      throw new Error("robots.txt rules changed");
    }
    const sitemap = await (await context.request.get(`${origin}/sitemap.xml`)).text();
    if (!sitemap.includes("/faq") || !sitemap.includes("/guides/check-renovation-contractor-licence")) {
      throw new Error("sitemap.xml entries changed");
    }
    const llms = await (await context.request.get(`${origin}/llms.txt`)).text();
    if (!llms.includes("Canonical site: https://renocheck.homes/")) {
      throw new Error("llms.txt canonical line changed");
    }

    const login = await context.request.get(`${origin}/login`);
    const robotsTag = await valuesOf(login, "x-robots-tag");
    if (robotsTag.length !== 1 || robotsTag[0] !== "noindex, nofollow") {
      throw new Error(`/login X-Robots-Tag changed: ${JSON.stringify(robotsTag)}`);
    }
    const loginCache = await valuesOf(login, "cache-control");
    if (!loginCache.includes("private, no-store")) {
      throw new Error(`/login Cache-Control missing private, no-store: ${JSON.stringify(loginCache)}`);
    }
    const faqRobots = await valuesOf(await context.request.get(`${origin}/faq`), "x-robots-tag");
    if (faqRobots.length > 0) throw new Error(`/faq gained X-Robots-Tag: ${JSON.stringify(faqRobots)}`);

    const llmsCache = await valuesOf(await context.request.get(`${origin}/llms.txt`), "cache-control");
    if (!llmsCache.includes("public, max-age=86400")) {
      throw new Error(`llms.txt Cache-Control changed: ${JSON.stringify(llmsCache)}`);
    }

    const unexpected = external.filter((entry) => !entry.startsWith(`POST ${JUDICIARY_ACTION}`));
    if (unexpected.length > 0) throw new Error(`unexpected external requests:\n${unexpected.join("\n")}`);
    if (!external.some((entry) => entry.startsWith(`POST ${JUDICIARY_ACTION}`))) {
      throw new Error("cause-list POST was not observed");
    }
    if (violations.length > 0 || consoleHits.length > 0) {
      throw new Error(`CSP violations:\n${JSON.stringify({ violations, consoleHits }, null, 2)}`);
    }

    console.log(
      JSON.stringify(
        {
          ok: true,
          base: origin,
          policy: buildContentSecurityPolicy({ dev: false }),
          headers: buildSecurityHeaders({ dev: false }),
          externalAborted: external,
        },
        null,
        2,
      ),
    );
  } finally {
    await browser.close();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.stack ?? error.message : String(error));
  process.exit(1);
});
