import { execFileSync } from "node:child_process";
import { assertLegalrefJudgmentSourceUrl } from "./legal-event-source-url";

const FETCH_TIMEOUT_MS = 60_000;
const CURL_MAX_BUFFER = 12 * 1024 * 1024;
const MAX_PLAIN_CHARS = 48_000;

export function toJuFrameUrl(sourceUrl: string): string {
  const allowed = assertLegalrefJudgmentSourceUrl(sourceUrl);
  const m = allowed.match(/DIS=(\d+)/i);
  if (m) {
    return `https://legalref.judiciary.hk/lrs/common/ju/ju_frame.jsp?DIS=${m[1]}&TP=JU`;
  }
  return allowed;
}

/** Direct judgment body (frame inner page). */
export function toJuBodyUrl(sourceUrl: string): string {
  const allowed = assertLegalrefJudgmentSourceUrl(sourceUrl);
  const m = allowed.match(/DIS=(\d+)/i);
  if (m) {
    return `https://legalref.judiciary.hk/lrs/common/ju/ju_body.jsp?DIS=${m[1]}&TP=JU`;
  }
  return allowed;
}

export function htmlToPlainText(html: string): string {
  const noScript = html.replace(/<script[\s\S]*?<\/script>/gi, " ");
  const noStyle = noScript.replace(/<style[\s\S]*?<\/style>/gi, " ");
  const text = noStyle
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/\s+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ");
  return text.trim().slice(0, MAX_PLAIN_CHARS);
}

function fetchLegalrefHtmlViaCurl(url: string): string {
  const sec = Math.ceil(FETCH_TIMEOUT_MS / 1000);
  return execFileSync(
    "curl",
    [
      "-sL",
      "--max-time",
      String(sec),
      "-A",
      "Mozilla/5.0 (compatible; RenocheckJudgmentSummary/1.0)",
      "-H",
      "Referer: https://legalref.judiciary.hk/",
      url,
    ],
    { encoding: "utf8", maxBuffer: CURL_MAX_BUFFER },
  );
}

export async function fetchLegalrefJudgmentPlainText(
  sourceUrl: string,
): Promise<{ url: string; text: string }> {
  const url = toJuBodyUrl(sourceUrl);
  let html: string;
  try {
    html = fetchLegalrefHtmlViaCurl(url);
  } catch {
    throw new Error("legalref_fetch_failed");
  }
  if (/request rejected/i.test(html)) {
    throw new Error("legalref_fetch_rejected");
  }
  const text = htmlToPlainText(html);
  if (text.length < 80) {
    throw new Error("legalref_fetch_text_too_short");
  }
  return { url, text };
}
