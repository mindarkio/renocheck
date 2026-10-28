// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  QUOTE_ACK_LABEL_ZH,
  QUOTE_ANALYSIS_VERIFY_CTA_ZH,
  QUOTE_COMPANY_CONFIRM_ZH,
  QUOTE_FILE_LABEL_ZH,
  QUOTE_VERIFY_ABANDON_ZH,
  QUOTE_VERIFY_MODAL_TITLE_ZH,
} from "@/lib/quote-analysis/copy";
import { QuoteAnalysisForm } from "./QuoteAnalysisForm";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

vi.mock("@/components/ReportCard", () => ({
  ReportCard: () => <div>search-result</div>,
}));

const NAME = "合成測試工程有限公司";

function pdfFile(): File {
  return new File([new Uint8Array([0x25, 0x50, 0x44, 0x46])], "quote.pdf", {
    type: "application/pdf",
  });
}

function mockFetch(extra?: (url: string, init?: RequestInit) => Response | Promise<Response> | null) {
  const calls: string[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      const href = String(url);
      calls.push(href);
      const custom = extra?.(href, init);
      if (custom) return custom;
      if (href.includes("/api/quote/analyze")) {
        return new Response(JSON.stringify({ companyName: NAME }), { status: 200 });
      }
      if (href.includes("/api/search") && init?.body && String(init.body).includes("preview")) {
        return new Response(JSON.stringify({ matchCount: 0, windowFull: false, candidates: [] }), {
          status: 200,
        });
      }
      if (href.includes("/api/search")) {
        return new Response(
          JSON.stringify({ report: { entity: { displayName: NAME } } }),
          { status: 200 },
        );
      }
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    }),
  );
  return calls;
}

async function extract() {
  render(<QuoteAnalysisForm signedIn={false} />);
  fireEvent.change(screen.getByLabelText(QUOTE_FILE_LABEL_ZH), {
    target: { files: [pdfFile()] },
  });
  fireEvent.click(screen.getByRole("checkbox", { name: QUOTE_ACK_LABEL_ZH }));
  expect(await screen.findByText(/我們在報價單上找到/)).toBeTruthy();
}

describe("logged-out quote upload", () => {
  afterEach(() => {
    cleanup();
    sessionStorage.clear();
    vi.unstubAllGlobals();
  });

  it("extracts the company name and keeps the search result outside the blurred analysis", async () => {
    mockFetch();
    await extract();
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.body.textContent).not.toContain("有寫清楚");
    fireEvent.click(screen.getByRole("button", { name: QUOTE_COMPANY_CONFIRM_ZH }));
    expect(await screen.findByText("search-result")).toBeTruthy();
    const skeleton = document.querySelector("[data-quote-report-skeleton]");
    expect(skeleton).toBeTruthy();
    expect(skeleton?.closest("[aria-hidden='true']")).toBeTruthy();
    expect(screen.getByText("search-result").closest("[aria-hidden='true']")).toBeNull();
    expect(screen.getByRole("button", { name: QUOTE_ANALYSIS_VERIFY_CTA_ZH })).toBeTruthy();
  });

  it("discards the file when verification is abandoned", async () => {
    mockFetch();
    await extract();
    fireEvent.click(screen.getByRole("button", { name: QUOTE_COMPANY_CONFIRM_ZH }));
    await screen.findByRole("button", { name: QUOTE_ANALYSIS_VERIFY_CTA_ZH });
    fireEvent.click(screen.getByRole("button", { name: QUOTE_ANALYSIS_VERIFY_CTA_ZH }));
    await screen.findByRole("dialog", { name: QUOTE_VERIFY_MODAL_TITLE_ZH });
    fireEvent.click(screen.getByRole("button", { name: QUOTE_VERIFY_ABANDON_ZH }));
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).toBeNull();
    });
    expect(screen.getByLabelText(QUOTE_FILE_LABEL_ZH)).toBeTruthy();
    expect(screen.queryByText(/我們在報價單上找到/)).toBeNull();
    expect(sessionStorage.getItem("renocheck:quote-seal-pending")).toBeNull();
  });
});
