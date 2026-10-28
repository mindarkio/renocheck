// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  QUOTE_ACK_LABEL_ZH,
  QUOTE_ANALYSIS_VERIFY_CTA_ZH,
  QUOTE_COMPANY_CONFIRM_ZH,
  QUOTE_FILE_LABEL_ZH,
  QUOTE_NOT_QUOTATION_ZH,
  QUOTE_SEAL_CLOSE_ZH,
} from "@/lib/quote-analysis/copy";

const nav = vi.hoisted(() => ({ push: vi.fn(), refresh: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => nav }));
vi.mock("@/components/ReportCard", () => ({ ReportCard: () => <div>search-result</div> }));
vi.mock("@/components/SignInForm", () => ({
  SignInForm: ({ onVerified, onAbandon, abandonLabel }: { onVerified: () => void; onAbandon: () => void; abandonLabel: string }) => (
    <div>
      <button type="button" onClick={() => void onVerified()}>mock-verify</button>
      <button type="button" onClick={onAbandon}>{abandonLabel}</button>
    </div>
  ),
}));

import { QuoteAnalysisForm } from "./QuoteAnalysisForm";

const NAME = "合成測試工程有限公司";
const ID = "33333333-3333-4333-8333-333333333333";

function pdfFile(): File {
  return new File([new Uint8Array([0x25, 0x50, 0x44, 0x46])], "quote.pdf", { type: "application/pdf" });
}

type Handler = (url: string, init?: RequestInit) => Response | Promise<Response> | null;
function mockFetch(analyze: Handler) {
  vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
    const href = String(url);
    if (href.includes("/api/quote/analyze")) return (await analyze(href, init)) as Response;
    if (href.includes("/api/search") && init?.body && String(init.body).includes("preview")) {
      return new Response(JSON.stringify({ matchCount: 0, windowFull: false, candidates: [] }), { status: 200 });
    }
    if (href.includes("/api/search")) {
      return new Response(JSON.stringify({ report: { entity: { displayName: NAME } } }), { status: 200 });
    }
    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  }));
}

function pick(signedIn: boolean) {
  render(<QuoteAnalysisForm signedIn={signedIn} />);
  fireEvent.change(screen.getByLabelText(QUOTE_FILE_LABEL_ZH), { target: { files: [pdfFile()] } });
  fireEvent.click(screen.getByRole("checkbox", { name: QUOTE_ACK_LABEL_ZH }));
}

describe("quote upload r3 edge cases", () => {
  afterEach(() => {
    cleanup();
    sessionStorage.clear();
    nav.push.mockReset();
    vi.unstubAllGlobals();
  });

  it("shows the not-a-quotation message from a 200 reply without a row", async () => {
    mockFetch(() => new Response(JSON.stringify({ error: "not_quotation", message: QUOTE_NOT_QUOTATION_ZH }), { status: 200 }));
    pick(true);
    expect(await screen.findByText(QUOTE_NOT_QUOTATION_ZH)).toBeTruthy();
  });

  it("asks for verification again when a signed-in page gets a name-only reply", async () => {
    mockFetch(() => new Response(JSON.stringify({ companyName: NAME }), { status: 200 }));
    pick(true);
    expect(await screen.findByRole("dialog")).toBeTruthy();
    expect(screen.getByRole("button", { name: "mock-verify" })).toBeTruthy();
    expect(nav.push).not.toHaveBeenCalled();
  });

  it("opens the full result when the server already saw a session", async () => {
    mockFetch(() => new Response(JSON.stringify({ id: ID, companyName: NAME, items: [] }), { status: 200 }));
    pick(false);
    await waitFor(() => expect(nav.push).toHaveBeenCalledWith(`/quote/analyses/${ID}`));
    expect(screen.queryByText(/我們在報價單上找到/)).toBeNull();
  });

  it("sends only the confirmed name, and aborts the analysis when the user abandons", async () => {
    const forms: FormData[] = [];
    let signal: AbortSignal | undefined;
    mockFetch((_url, init) => {
      const form = init?.body as FormData;
      forms.push(form);
      if (forms.length === 1) return new Response(JSON.stringify({ companyName: NAME }), { status: 200 });
      signal = init?.signal ?? undefined;
      return new Promise<Response>((_resolve, reject) => {
        signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")));
      });
    });
    pick(false);
    fireEvent.click(await screen.findByRole("button", { name: QUOTE_COMPANY_CONFIRM_ZH }));
    fireEvent.click(await screen.findByRole("button", { name: QUOTE_ANALYSIS_VERIFY_CTA_ZH }));
    fireEvent.click(await screen.findByRole("button", { name: "mock-verify" }));
    await waitFor(() => expect(forms).toHaveLength(2));
    expect(forms[1]?.get("extractedCompanyName")).toBeNull();
    expect(forms[1]?.get("confirmedCompanyName")).toBe(NAME);
    expect(signal?.aborted).toBe(false);
    fireEvent.click(screen.getByRole("button", { name: QUOTE_SEAL_CLOSE_ZH }));
    await waitFor(() => expect(signal?.aborted).toBe(true));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.queryByRole("alert")).toBeNull();
  });
});
