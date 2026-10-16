/**
 * Shared Playwright helpers for LRS search result pages (D1).
 */
export const LRS_GOTO_TIMEOUT_MS = 180_000;
export const LRS_FOUND_WAIT_MS = 90_000;

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function fetchLrsSearchPageHtml(
  page: import("playwright").Page,
  url: string,
): Promise<string> {
  await page.goto(url, {
    waitUntil: "domcontentloaded",
    timeout: LRS_GOTO_TIMEOUT_MS,
  });
  await page.waitForFunction(
    () => document.body?.innerText?.includes("found") ?? false,
    { timeout: LRS_FOUND_WAIT_MS },
  );
  return await page.content();
}

export async function fetchLrsSearchNextPages(
  page: import("playwright").Page,
  pageCount: number,
): Promise<string[]> {
  const extra: string[] = [];
  for (let p = 2; p <= pageCount; p++) {
    await page.evaluate((n) => {
      const form = document.forms[0] as HTMLFormElement | undefined;
      const fn = (globalThis as { pagesubmit?: (n: string, f: HTMLFormElement) => void })
        .pagesubmit;
      if (form && typeof fn === "function") fn(String(n), form);
    }, p);
    await sleep(1500);
    await page.waitForFunction(
      () => document.body?.innerText?.includes("found") ?? false,
      { timeout: LRS_FOUND_WAIT_MS },
    );
    extra.push(await page.content());
    await sleep(1200);
  }
  return extra;
}

export function profileHtmlFileName(profileId: string, pageNum: number): string {
  const slug = profileId
    .replace(/[^\p{L}\p{N}_-]+/gu, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "");
  return `${slug}-p${pageNum}.html`;
}
