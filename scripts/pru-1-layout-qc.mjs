#!/usr/bin/env node
/**
 * PRU-1 layout QC (local). Does not run in `pnpm test`.
 * Usage: pnpm build && pnpm start &  node scripts/pru-1-layout-qc.mjs
 */
import { spawn } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
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
  { id: "HEAVY", file: "HEAVY.json" },
  { id: "DEGRADED", file: "DEGRADED.json" },
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

function loadFixture(file) {
  const raw = JSON.parse(
    readFileSync(
      path.join(repoRoot, "src/test-fixtures/reports", file),
      "utf8",
    ),
  );
  return raw;
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

async function ensureServer(baseUrl) {
  try {
    const res = await fetch(`${baseUrl}/api/health`);
    if (res.ok) return null;
  } catch {
    // spawn
  }
  return spawn("pnpm", ["start"], {
    cwd: repoRoot,
    stdio: "inherit",
    env: { ...process.env, PORT: "3000" },
  });
}

async function main() {
  const { chromium } = await import("playwright");
  mkdirSync(outDir, { recursive: true });
  const baseUrl = process.env.PRU_QC_BASE_URL ?? "http://127.0.0.1:3000";
  const child = await ensureServer(baseUrl);
  if (child) {
    await new Promise((r) => setTimeout(r, 8000));
  }

  const browser = await chromium.launch();
  const results = { generatedAt: new Date().toISOString(), cases: [] };

  for (const fp of FIXTURES) {
    const payload = loadFixture(fp.file);
    for (const vp of VIEWPORTS) {
      const page = await browser.newPage({ viewport: vp });
      await page.route(`**/api/report/${fp.id}`, async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(payload),
        });
      });
      const url = `${baseUrl}/report/${fp.id}`;
      await page.goto(url, { waitUntil: "networkidle" });
      const shot = path.join(outDir, `report-${fp.id}-${vp.name}.png`);
      await page.screenshot({ path: shot, fullPage: true });

      const metrics = await page.evaluate(() => {
        const container = document.querySelector("main .mx-auto");
        const mainCol = document.querySelector("[data-testid=report-main-column]");
        const sidebar = document.querySelector("[data-testid=report-layout-sidebar]");
        const panel = document.querySelector("[data-testid=legal-events-panel]");
        const h1 = document.querySelector("h1");
        const h2 = document.querySelector("h2");
        const p = document.querySelector("header p.max-w-\\[40em\\], header p[class*='max-w-[40em]']") ?? document.querySelector("header p");
        const font = (el) => {
          if (!el) return null;
          const s = getComputedStyle(el);
          return { px: parseFloat(s.fontSize), line: parseFloat(s.lineHeight) };
        };
        const rects = (sel) => [...document.querySelectorAll(sel)].map((el) => el.getBoundingClientRect());
        return {
          containerWidth: container?.getBoundingClientRect().width ?? null,
          mainWidth: mainCol?.getBoundingClientRect().width ?? null,
          sidebarWidth: sidebar?.getBoundingClientRect().width ?? null,
          panelWidth: panel?.getBoundingClientRect().width ?? null,
          h1: font(h1),
          h2: font(h2),
          bodyP: font(p),
          scrollWidth: document.documentElement.scrollWidth,
          minFontPx: Math.min(
            ...[...document.querySelectorAll("body *")]
              .filter((el) => {
                const s = getComputedStyle(el);
                if (s.display === "none" || s.visibility === "hidden") return false;
                const t = el.textContent?.trim();
                return t && t.length > 0 && el.children.length === 0;
              })
              .map((el) => parseFloat(getComputedStyle(el).fontSize))
              .filter((n) => Number.isFinite(n)),
          ),
          highlightLefts: rects("[aria-labelledby^='highlight-title-'] section, section[aria-labelledby^='highlight-title-']").map((r) => r.left),
        };
      });

      results.cases.push({
        fixture: fp.id,
        viewport: vp.name,
        screenshot: shot,
        metrics,
        heroContrast: contrastRatio([255, 255, 255], [47, 93, 138]),
      });
      await page.close();
    }
  }

  for (const sp of STATIC_PAGES) {
    for (const vp of VIEWPORTS) {
      const page = await browser.newPage({ viewport: vp });
      await page.goto(`${baseUrl}${sp.path}`, { waitUntil: "networkidle" });
      const shot = path.join(outDir, `static-${sp.name}-${vp.name}.png`);
      await page.screenshot({ path: shot, fullPage: true });
      await page.close();
    }
  }

  writeFileSync(
    path.join(outDir, "measurements.json"),
    JSON.stringify(results, null, 2),
  );
  await browser.close();
  if (child) child.kill("SIGTERM");
  console.log(`QC output: ${outDir}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
