/**
 * Local check: public pages and admin routes must not overflow horizontally.
 * Usage: pnpm exec tsx scripts/admin-mobile-overflow-check.ts
 * Local only (never CI/prod). Supabase env is blanked so `next dev` can't pick up a DB from .env*;
 * the dashboard renders its error state, which is what this layout check needs. The PIN and
 * secret are generated per run and never printed or written.
 */
import { randomInt, randomUUID } from "node:crypto";
import { spawn, type ChildProcess } from "node:child_process";
import { mkdirSync } from "node:fs";
import path, { join as pathJoin } from "node:path";
import { chromium } from "playwright";

const PORT = 3456;
const BASE = `http://127.0.0.1:${PORT}`;
const WIDTHS = [320, 360, 375, 390, 412, 430, 1280] as const;
/** Synthetic report id (hex, not a credential) so the empty-state page can render. */
const REPORT_PATH = "/report/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const PUBLIC_PATHS = ["/", "/about", "/faq", "/admin/login", REPORT_PATH] as const;

function randomTestPin(len = 8): string {
  let s = String(randomInt(1, 10));
  for (let i = 1; i < len; i++) s += String(randomInt(0, 10));
  return s;
}

function randomSecret(): string {
  return randomUUID().replace(/-/g, "") + randomUUID().replace(/-/g, "");
}

async function waitForServer(proc: ChildProcess): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error("dev server timeout")), 120_000);
    const onData = (buf: Buffer) => {
      const txt = buf.toString();
      if (txt.includes("Ready") || txt.includes(`127.0.0.1:${PORT}`)) {
        clearTimeout(t);
        resolve();
      }
    };
    proc.stdout?.on("data", onData);
    proc.stderr?.on("data", onData);
    proc.on("error", reject);
  });
}

type MeasureRow = { scrollWidth: number; clientWidth: number; ok: boolean };

async function measureAtWidths(
  path: string,
  afterGoto?: (page: import("playwright").Page) => Promise<void>,
): Promise<Record<number, MeasureRow>> {
  const browser = await chromium.launch();
  const out: Record<number, MeasureRow> = {};
  for (const width of WIDTHS) {
    const page = await browser.newPage({ viewport: { width, height: 844 } });
    await page.goto(`${BASE}${path}`, { waitUntil: "networkidle" });
    if (path === "/") {
      await page.getByRole("alert").waitFor({ timeout: 15_000 }).catch(() => undefined);
    }
    if (path.startsWith("/report/")) {
      await page.locator("[role=alert]").waitFor({ timeout: 15_000 }).catch(() => undefined);
    }
    if (afterGoto) await afterGoto(page);
    const { scrollWidth, clientWidth } = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }));
    out[width] = { scrollWidth, clientWidth, ok: scrollWidth <= clientWidth };
    const shotDir = process.env.OVERFLOW_SCREENSHOT_DIR;
    if (shotDir && path === "/" && (width === 390 || width === 1280)) {
      mkdirSync(shotDir, { recursive: true });
      await page.screenshot({
        path: pathJoin(shotDir, `landing-banner-${width}.png`),
        fullPage: true,
      });
    }
    await page.close();
  }
  await browser.close();
  return out;
}

async function measureAdminDashboard(pin: string): Promise<Record<number, MeasureRow>> {
  const browser = await chromium.launch();
  const out: Record<number, MeasureRow> = {};
  for (const width of WIDTHS) {
    const page = await browser.newPage({ viewport: { width, height: 844 } });
    await page.goto(`${BASE}/admin/login`, { waitUntil: "networkidle" });
    await page.fill("#admin-pin", pin);
    await page.getByRole("button", { name: "登入" }).click();
    await page.waitForURL(/\/admin(?:\?|$)/, { timeout: 15_000 });
    await page
      .getByRole("heading", { name: "AI 用量（Gemini）" })
      .waitFor({ timeout: 15_000 });
    const { scrollWidth, clientWidth } = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }));
    out[width] = { scrollWidth, clientWidth, ok: scrollWidth <= clientWidth };
    const shotDir = process.env.OVERFLOW_SCREENSHOT_DIR;
    if (shotDir && (width === 390 || width === 1280)) {
      mkdirSync(shotDir, { recursive: true });
      await page.screenshot({
        path: pathJoin(shotDir, `admin-ai-usage-${width}.png`),
        fullPage: true,
      });
    }
    await page.close();
  }
  await browser.close();
  return out;
}

async function main(): Promise<void> {
  const pin = randomTestPin(8);
  const secret = randomSecret();
  const nextBin = path.join(process.cwd(), "node_modules", ".bin", "next");
  const proc = spawn(nextBin, ["dev", "-p", String(PORT), "-H", "127.0.0.1"], {
    cwd: process.cwd(),
    env: {
      PATH: process.env.PATH ?? "",
      HOME: process.env.HOME ?? "",
      NODE_ENV: "development",
      NEXT_TELEMETRY_DISABLED: "1",
      // Explicit empty values win over .env* files in @next/env, so no DB is reachable.
      NEXT_PUBLIC_SUPABASE_URL: "",
      SUPABASE_URL: "",
      SUPABASE_SERVICE_ROLE_KEY: "",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "",
      OVERFLOW_CHECK_STATS: "1",
      OVERFLOW_CHECK_GEMINI: "1",
      SERVICE_PAUSED: "1",
      ADMIN_DASHBOARD_PIN: pin,
      ADMIN_SESSION_SECRET: secret,
    },
    stdio: ["ignore", "pipe", "pipe"],
    detached: true,
  });
  const stop = () => {
    if (proc.pid && proc.exitCode === null) {
      try {
        process.kill(-proc.pid, "SIGTERM");
      } catch {
        /* already gone */
      }
    }
  };
  process.once("SIGINT", () => {
    stop();
    process.exit(130);
  });

  try {
    await waitForServer(proc);
    await new Promise((r) => setTimeout(r, 2500));

    const pages: Record<string, Record<number, MeasureRow>> = {};
    for (const pagePath of PUBLIC_PATHS) {
      pages[pagePath] = await measureAtWidths(pagePath);
    }
    pages["/admin"] = await measureAdminDashboard(pin);

    console.log(JSON.stringify(pages, null, 2));
    const bad = Object.values(pages)
      .flatMap((rows) => Object.values(rows))
      .filter((r) => !r.ok);
    if (bad.length > 0) process.exitCode = 1;
  } finally {
    stop();
  }
}

main().catch((e: unknown) => {
  console.error(e instanceof Error ? e.message.split("\n")[0] : "overflow check failed");
  process.exitCode = 1;
});
