#!/usr/bin/env node
/**
 * PRU-1 layout QC (local). Not part of `pnpm test`.
 * Usage: pnpm build && node scripts/pru-1-layout-qc.mjs
 */
import { spawn } from "node:child_process";
import {
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.join(__dirname, "..");
const outDir = path.join(
  process.env.HOME ?? "",
  "Desktop/MindArk/projects/Renocheck/docs/pru-1-qc",
);

const FIXTURES = [
  { id: "04272ad765a4dd910cf151aee5f04c23", file: "04272ad765a4dd910cf151aee5f04c23.json" },
  { id: "780b6902c105337959d12ec5464576d6", file: "780b6902c105337959d12ec5464576d6.json" },
  { id: "a0000000000000000000000000000001", file: "HEAVY.json", label: "HEAVY" },
  { id: "b0000000000000000000000000000001", file: "DEGRADED.json", label: "DEGRADED" },
  { id: "c0000000000000000000000000000001", file: "MWC_MISS.json", label: "MWC_MISS" },
];

const VIEWPORTS = [
  { name: "1440x900", width: 1440, height: 900 },
  { name: "1280x800", width: 1280, height: 800 },
  { name: "390x844", width: 390, height: 844 },
];

const STATIC_PAGES = [
  { name: "home", path: "/" },
  { name: "faq", path: "/faq" },
  { name: "about", path: "/about" },
];

const CORAL = [255, 143, 125];
const HERO_BG = [47, 93, 138];

function loadFixture(file) {
  return JSON.parse(
    readFileSync(
      path.join(repoRoot, "src/test-fixtures/reports", file),
      "utf8",
    ),
  );
}

function relLuminance([r, g, b]) {
  const srgb = [r, g, b].map((c) => {
    const v = c / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * srgb[0] + 0.7152 * srgb[1] + 0.0722 * srgb[2];
}

function contrastRatio(fg, bg) {
  const l1 = relLuminance(fg);
  const l2 = relLuminance(bg);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

function parseRgb(cssColor) {
  const m = cssColor.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (!m) return null;
  return [Number(m[1]), Number(m[2]), Number(m[3])];
}

function inRange(v, min, max) {
  return v >= min && v <= max;
}

function record(criteria, key, pass, actual, expected) {
  criteria.push({ key, pass, actual, expected });
}

async function ensureServer(baseUrl) {
  try {
    const res = await fetch(`${baseUrl}/api/health`);
    if (res.ok) return null;
  } catch {
    // spawn
  }
  const child = spawn("pnpm", ["start"], {
    cwd: repoRoot,
    stdio: "inherit",
    env: { ...process.env, PORT: "3000" },
  });
  await new Promise((r) => setTimeout(r, 9000));
  return child;
}

function clearOutDir() {
  mkdirSync(outDir, { recursive: true });
  for (const name of readdirSync(outDir)) {
    rmSync(path.join(outDir, name), { recursive: true, force: true });
  }
}

async function measureReportPage(page, fp, vp) {
  const criteria = [];
  const payload = loadFixture(fp.file);
  await page.route(`**/api/report/${fp.id}`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(payload),
    });
  });
  const baseUrl = process.env.PRU_QC_BASE_URL ?? "http://127.0.0.1:3000";
  await page.goto(`${baseUrl}/report/${fp.id}`, { waitUntil: "networkidle" });

  const shot = path.join(outDir, `report-${fp.id}-${vp.name}.png`);
  await page.screenshot({ path: shot, fullPage: true });

  const metrics = await page.evaluate(() => {
    const container = document.querySelector("[data-testid=report-layout-container]");
    const grid = document.querySelector("[data-testid=report-layout-grid]");
    const mainCol = document.querySelector("[data-testid=report-main-column]");
    const sidebar = document.querySelector("[data-testid=report-layout-sidebar]");
    const panel = document.querySelector("[data-testid=legal-events-panel]");
    const headerNav = document.querySelector("[data-testid=site-header-nav]");
    const logo = headerNav?.querySelector("img");
    const navLinks = headerNav?.querySelector("[class*='sm:flex']");

    const cw = (el) => {
      if (!el) return null;
      const s = getComputedStyle(el);
      return el.clientWidth - parseFloat(s.paddingLeft) - parseFloat(s.paddingRight);
    };

    const fontOf = (el) => {
      if (!el) return null;
      const s = getComputedStyle(el);
      return { px: parseFloat(s.fontSize), line: parseFloat(s.lineHeight) };
    };

    const textLeaves = [...document.querySelectorAll("body *")].filter((el) => {
      const s = getComputedStyle(el);
      if (s.display === "none" || s.visibility === "hidden") return false;
      if (el.children.length > 0) return false;
      const t = el.textContent?.trim();
      return Boolean(t);
    });

    const minFont = Math.min(
      ...textLeaves
        .map((el) => parseFloat(getComputedStyle(el).fontSize))
        .filter((n) => Number.isFinite(n)),
    );

    const smallest = textLeaves
      .map((el) => ({
        px: parseFloat(getComputedStyle(el).fontSize),
        text: (el.textContent ?? "").trim().slice(0, 40),
        tag: el.tagName,
        cls: el.className?.toString?.().slice(0, 120) ?? "",
      }))
      .filter((x) => Number.isFinite(x.px))
      .sort((a, b) => a.px - b.px)[0];

    const heroHeader = document.querySelector("article header.bg-primary");
    const heroTexts = heroHeader
      ? [...heroHeader.querySelectorAll("*")].filter((el) => {
          const t = el.textContent?.trim();
          return t && el.children.length === 0;
        })
      : [];

    const highlightCards = [
      ...document.querySelectorAll("section[aria-labelledby^='highlight-title-']"),
    ];
    const highlightLefts = highlightCards.map((el) => el.getBoundingClientRect().left);
    const lastHighlight = highlightCards[highlightCards.length - 1];
    const lastSpanTwo =
      lastHighlight?.className.includes("lg:col-span-2") ?? false;

    const legalCards = [...document.querySelectorAll("[data-testid=legal-event-card]")];
    const legalFieldCounts = [...legalCards].map(
      (card) => card.querySelectorAll("dl dt").length,
    );

    const identitySection = document.querySelector("#cr-identity-heading")?.closest("section");
    const identityHeight = identitySection?.getBoundingClientRect().height ?? null;
    const dtDdPairs = identitySection
      ? [...identitySection.querySelectorAll("dl > div")]
          .filter((row) => {
            if (row.querySelector("button")) return false;
            const dd = row.querySelector("dd");
            if (!dd) return false;
            const lh = parseFloat(getComputedStyle(dd).lineHeight);
            return dd.getBoundingClientRect().height <= lh * 1.25;
          })
          .map((row) => {
            const dt = row.querySelector("dt");
            const dd = row.querySelector("dd");
            const dtTop = dt?.getBoundingClientRect().top ?? 0;
            const ddTop = dd?.getBoundingClientRect().top ?? dtTop;
            return Math.abs(dtTop - ddTop);
          })
      : [];

    const externalLinks = [
      ...document.querySelectorAll("main a[target='_blank']"),
    ]
      .filter((a) => a.getAttribute("role") !== "button")
      .map((a) => a.getBoundingClientRect().height);

    const bodyPs = [...document.querySelectorAll("main p")].map((p) => {
      const s = getComputedStyle(p);
      return {
        maxWidth: s.maxWidth,
        width: p.getBoundingClientRect().width,
      };
    });

    const checklist = document.querySelector("#checklist-heading")?.closest("section");
    const nextSteps = document.querySelector("#next-steps-heading")?.closest("section");
    const sectionGap =
      checklist && nextSteps
        ? nextSteps.getBoundingClientRect().top -
          checklist.getBoundingClientRect().bottom
        : null;

    return {
      containerContentWidth: grid?.getBoundingClientRect().width ?? cw(container),
      containerOuterWidth: container?.getBoundingClientRect().width ?? null,
      mainWidth: mainCol?.getBoundingClientRect().width ?? null,
      sidebarWidth: sidebar?.getBoundingClientRect().width ?? null,
      panelWidth: panel?.getBoundingClientRect().width ?? null,
      gutter:
        container && mainCol && sidebar
          ? sidebar.getBoundingClientRect().left -
            mainCol.getBoundingClientRect().right
          : null,
      headerNavLeft: headerNav?.getBoundingClientRect().left ?? null,
      containerLeft: container?.getBoundingClientRect().left ?? null,
      logoLeft: logo?.getBoundingClientRect().left ?? null,
      navRight: navLinks?.getBoundingClientRect().right ?? null,
      containerRight: container?.getBoundingClientRect().right ?? null,
      containerLeft: container?.getBoundingClientRect().left ?? null,
      logoHeight: logo?.getBoundingClientRect().height ?? null,
      h1: fontOf(document.querySelector("h1")),
      h2: fontOf(document.querySelector("h2")),
      bodyP: fontOf(
        document.querySelector("article header p[class*='max-w-[40em]']"),
      ),
      h1Count: document.querySelectorAll("h1").length,
      scrollWidth: document.documentElement.scrollWidth,
      minFontPx: minFont,
      smallestTextNode: smallest,
      highlightCount: highlightCards.length,
      highlightLefts,
      highlightSingleColumn:
        highlightLefts.length > 1
          ? highlightLefts.every((l) => Math.abs(l - highlightLefts[0]) < 1)
          : true,
      lastHighlightSpansTwoCols: lastSpanTwo,
      legalFieldCounts,
      identityHeight,
      dtDdTopDelta: dtDdPairs,
      externalLinkHeights: externalLinks,
      bodyPs,
      sectionGap,
      heroTextSamples: heroTexts.slice(0, 30).map((el) => ({
        px: parseFloat(getComputedStyle(el).fontSize),
        color: getComputedStyle(el).color,
        text: (el.textContent ?? "").trim().slice(0, 30),
      })),
    };
  });

  // Container / grid widths
  if (vp.width >= 1440) {
    record(criteria, "containerContentWidth", inRange(metrics.containerContentWidth, 1199, 1201), metrics.containerContentWidth, "1200±1");
    record(criteria, "mainWidth", inRange(metrics.mainWidth, 784, 792), metrics.mainWidth, "784–792");
    record(criteria, "sidebarWidth", inRange(metrics.sidebarWidth, 384, 392), metrics.sidebarWidth, "384–392");
    record(criteria, "gutter", inRange(metrics.gutter, 23, 25), metrics.gutter, "24");
  } else if (vp.width >= 1280) {
    record(criteria, "containerContentWidth", inRange(metrics.containerContentWidth, 1119, 1121), metrics.containerContentWidth, "1120±1");
    record(criteria, "mainWidth", inRange(metrics.mainWidth, 730, 740), metrics.mainWidth, "730–740");
    record(criteria, "sidebarWidth", inRange(metrics.sidebarWidth, 355, 365), metrics.sidebarWidth, "355–365");
  } else if (vp.width === 390) {
    record(criteria, "mainWidth", inRange(metrics.mainWidth, 357, 359), metrics.mainWidth, "358");
    record(criteria, "scrollWidth", metrics.scrollWidth === 390, metrics.scrollWidth, "390");
  }

  if (fp.id === "04272ad765a4dd910cf151aee5f04c23" && (vp.width === 1440 || vp.width === 1280)) {
    const diff = Math.abs((metrics.panelWidth ?? 0) - (metrics.mainWidth ?? 0));
    record(criteria, "legalPanelVsMain", diff <= 1, { panel: metrics.panelWidth, main: metrics.mainWidth }, "±1px");
    record(
      criteria,
      "legalCard8Fields",
      metrics.legalFieldCounts.every((n) => n === 8),
      metrics.legalFieldCounts,
      "each card 8 fields",
    );
  }

  if (vp.width >= 1024) {
    for (const scrollY of [1500, null]) {
      if (scrollY !== null) await page.evaluate((y) => window.scrollTo(0, y), scrollY);
      else {
        const maxY = await page.evaluate(() => document.documentElement.scrollHeight - window.innerHeight - 300);
        await page.evaluate((y) => window.scrollTo(0, Math.max(0, y)), maxY);
      }
      const top = await page.evaluate(() => {
        const aside = document.querySelector("[data-testid=report-layout-sidebar]");
        return aside?.getBoundingClientRect().top ?? null;
      });
      const label = scrollY === 1500 ? "sidebarTopScroll1500" : "sidebarTopNearFooter";
      record(criteria, label, top !== null && inRange(top, 86, 90), top, "88±2");
    }
  }

  record(criteria, "h1Count", metrics.h1Count === 1, metrics.h1Count, "1");
  if (vp.width >= 1024) {
    record(criteria, "h1Font", metrics.h1?.px === 28, metrics.h1, "28px");
    record(criteria, "h2Font", metrics.h2?.px === 20, metrics.h2, "20px");
    record(criteria, "bodyFont", metrics.bodyP?.px === 16, metrics.bodyP, "16px");
  } else {
    record(criteria, "h1Font", metrics.h1?.px === 22, metrics.h1, "22px");
    record(criteria, "h2Font", metrics.h2?.px === 18, metrics.h2, "18px");
    record(criteria, "bodyFont", metrics.bodyP?.px === 15, metrics.bodyP, "15px");
  }

  record(criteria, "minFont12", metrics.minFontPx >= 12, { min: metrics.minFontPx, node: metrics.smallestTextNode }, "≥12px");

  // Header alignment (all report pages)
  const alignL = Math.abs((metrics.logoLeft ?? 0) - (metrics.containerLeft ?? 0));
  const alignR = Math.abs((metrics.navRight ?? 0) - (metrics.containerRight ?? 0));
  record(criteria, "headerAlignLeft", alignL <= 1, alignL, "±1px");
  if (vp.width >= 1024) {
    record(criteria, "headerAlignRight", alignR <= 1, alignR, "±1px");
  }
  if (vp.width >= 1024) {
    record(criteria, "logoHeightDesktop", inRange(metrics.logoHeight, 28, 32), metrics.logoHeight, "28–32");
  } else {
    record(criteria, "logoHeightMobile", inRange(metrics.logoHeight, 24, 28), metrics.logoHeight, "24–28");
  }

  // Hero contrast
  let worst = { ratio: Infinity, sample: null };
  for (const sample of metrics.heroTextSamples) {
    const rgb = parseRgb(sample.color);
    if (!rgb) continue;
    const ratio = contrastRatio(rgb, HERO_BG);
    const isCoral = rgb.every((v, i) => Math.abs(v - CORAL[i]) < 8);
    const need = sample.px >= 24 ? 3 : 4.5;
    if (isCoral && sample.px < 24) {
      record(criteria, "coralMin24px", false, sample, "coral only ≥24px");
    }
    if (ratio < worst.ratio) worst = { ratio, sample, need };
  }
  if (worst.sample) {
    record(
      criteria,
      "heroContrastWorst",
      worst.ratio >= worst.need,
      { ratio: worst.ratio, need: worst.need, sample: worst.sample },
      `≥${worst.need}:1`,
    );
  }

  if (vp.width === 390) {
    const minLink = Math.min(...metrics.externalLinkHeights.filter((h) => h > 0));
    record(criteria, "externalLinkMinHeight", minLink >= 44, minLink, "≥44px");
    if (fp.id === "04272ad765a4dd910cf151aee5f04c23") {
      record(
        criteria,
        "identityDtDdAlign",
        metrics.dtDdTopDelta.every((d) => d <= 2),
        metrics.dtDdTopDelta,
        "±2px",
      );
    }
    const maxP = Math.max(...metrics.bodyPs.map((p) => p.width));
    record(criteria, "bodyPMaxWidth", maxP <= 640, maxP, "≤640px");
  }

  const fpLabel = fp.label ?? fp.id;
  if (fpLabel === "HEAVY" && vp.width === 1440) {
    record(criteria, "highlightsTwoCol", !metrics.highlightSingleColumn, metrics.highlightLefts, "2 columns");
    record(criteria, "highlightsLastSpan", metrics.lastHighlightSpansTwoCols, metrics.lastHighlightSpansTwoCols, "last odd spans 2");
  }
  if (fpLabel === "HEAVY" && vp.width === 390) {
    record(criteria, "highlightsOneCol", metrics.highlightSingleColumn, metrics.highlightLefts, "same left");
  }

  if (vp.width >= 1024 && metrics.sectionGap !== null) {
    record(criteria, "sectionGapDesktop", inRange(metrics.sectionGap, 46, 50), metrics.sectionGap, "48±2");
  }

  return { fixture: fp.id, viewport: vp.name, screenshot: shot, metrics, criteria };
}

async function measureStaticPage(page, sp, vp) {
  const baseUrl = process.env.PRU_QC_BASE_URL ?? "http://127.0.0.1:3000";
  await page.goto(`${baseUrl}${sp.path}`, { waitUntil: "networkidle" });
  const shot = path.join(outDir, `static-${sp.name}-${vp.name}.png`);
  await page.screenshot({ path: shot, fullPage: true });
  const metrics = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    headerNavLeft: document.querySelector("[data-testid=site-header-nav]")?.getBoundingClientRect().left,
    containerLeft: document.querySelector("main .mx-auto, main [class*='max-w-']")?.getBoundingClientRect().left,
  }));
  const criteria = [];
  record(criteria, "scrollWidth", metrics.scrollWidth <= vp.width, metrics.scrollWidth, `≤${vp.width}`);
  return { page: sp.name, viewport: vp.name, screenshot: shot, metrics, criteria };
}

async function main() {
  clearOutDir();
  const { chromium } = await import("playwright");
  const baseUrl = process.env.PRU_QC_BASE_URL ?? "http://127.0.0.1:3000";
  const child = await ensureServer(baseUrl);

  const browser = await chromium.launch();
  const runs = [];

  for (const fp of FIXTURES) {
    for (const vp of VIEWPORTS) {
      const page = await browser.newPage({ viewport: vp });
      runs.push(await measureReportPage(page, fp, vp));
      await page.close();
    }
  }

  for (const sp of STATIC_PAGES) {
    for (const vp of VIEWPORTS) {
      const page = await browser.newPage({ viewport: vp });
      runs.push(await measureStaticPage(page, sp, vp));
      await page.close();
    }
  }

  await browser.close();
  if (child) child.kill("SIGTERM");

  const failures = runs.flatMap((r) =>
    (r.criteria ?? [])
      .filter((c) => !c.pass)
      .map((c) => ({ ...c, fixture: r.fixture ?? r.page, viewport: r.viewport })),
  );

  const summary = {
    generatedAt: new Date().toISOString(),
    gitHead: readFileSync(path.join(repoRoot, ".git/HEAD"), "utf8").trim(),
    totalCriteria: runs.reduce((n, r) => n + (r.criteria?.length ?? 0), 0),
    failed: failures.length,
    failures,
    runs,
  };

  writeFileSync(path.join(outDir, "measurements.json"), JSON.stringify(summary, null, 2));
  console.log(`QC: ${summary.failed} failures / ${summary.totalCriteria} checks`);
  console.log(`Output: ${outDir}`);
  if (failures.length) {
    for (const f of failures) {
      console.log(`FAIL [${f.fixture} ${f.viewport}] ${f.key}:`, JSON.stringify(f.actual));
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
