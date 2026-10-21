/**
 * Local check: admin routes must not overflow the viewport horizontally.
 * Usage: pnpm exec tsx scripts/admin-mobile-overflow-check.ts
 */
import { randomInt, randomUUID } from "node:crypto";
import { spawn, type ChildProcess } from "node:child_process";
import { chromium } from "playwright";

const PORT = 3456;
const BASE = `http://127.0.0.1:${PORT}`;
const WIDTHS = [320, 360, 390] as const;

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

type MeasureRow = { scrollWidth: number; innerWidth: number; ok: boolean };

async function measureAtWidths(
  path: string,
  afterGoto?: (page: import("playwright").Page) => Promise<void>,
): Promise<Record<number, MeasureRow>> {
  const browser = await chromium.launch();
  const out: Record<number, MeasureRow> = {};
  for (const width of WIDTHS) {
    const page = await browser.newPage({ viewport: { width, height: 844 } });
    await page.goto(`${BASE}${path}`, { waitUntil: "networkidle" });
    if (afterGoto) await afterGoto(page);
    const { scrollWidth, innerWidth } = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      innerWidth: window.innerWidth,
    }));
    out[width] = { scrollWidth, innerWidth, ok: scrollWidth <= innerWidth };
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
    const { scrollWidth, innerWidth } = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      innerWidth: window.innerWidth,
    }));
    out[width] = { scrollWidth, innerWidth, ok: scrollWidth <= innerWidth };
    await page.close();
  }
  await browser.close();
  return out;
}

async function main(): Promise<void> {
  const pin = randomTestPin(8);
  const secret = randomSecret();
  const proc = spawn("pnpm", ["exec", "next", "dev", "-p", String(PORT)], {
    cwd: process.cwd(),
    env: { ...process.env, ADMIN_DASHBOARD_PIN: pin, ADMIN_SESSION_SECRET: secret },
    stdio: ["ignore", "pipe", "pipe"],
  });

  try {
    await waitForServer(proc);
    await new Promise((r) => setTimeout(r, 2500));

    const login = await measureAtWidths("/admin/login");
    const admin = await measureAdminDashboard(pin);

    console.log(JSON.stringify({ login, admin }, null, 2));
    const bad = [...Object.values(login), ...Object.values(admin)].filter((r) => !r.ok);
    if (bad.length > 0) process.exit(1);
  } finally {
    proc.kill("SIGTERM");
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
