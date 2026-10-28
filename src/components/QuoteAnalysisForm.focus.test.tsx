// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  QUOTE_ACK_LABEL_ZH,
  QUOTE_ANALYSIS_SECTION_ZH,
  QUOTE_ANALYSIS_VERIFY_CTA_ZH,
  QUOTE_COMPANY_CONFIRM_ZH,
  QUOTE_FILE_LABEL_ZH,
} from "@/lib/quote-analysis/copy";

const nav = vi.hoisted(() => ({ push: vi.fn(), refresh: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => nav }));
vi.mock("@/components/ReportCard", () => ({ ReportCard: () => <div>search-result</div> }));
vi.mock("@/components/SignInForm", () => ({
  SignInForm: ({ onVerified }: { onVerified: () => void }) => (
    <button type="button" onClick={() => void onVerified()}>
      mock-verify
    </button>
  ),
}));

import { QuoteAnalysisForm } from "./QuoteAnalysisForm";

const NAME = "合成測試工程有限公司";
const ID = "33333333-3333-4333-8333-333333333333";

function pdfFile(): File {
  return new File([new Uint8Array([0x25, 0x50, 0x44, 0x46])], "quote.pdf", { type: "application/pdf" });
}

describe("quote result heading focus", () => {
  afterEach(() => {
    cleanup();
    sessionStorage.clear();
    nav.push.mockReset();
    vi.unstubAllGlobals();
  });

  it("moves focus to the checklist heading after the verified result renders", async () => {
    let calls = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init?: RequestInit) => {
        const href = String(url);
        if (href.includes("/api/quote/analyze")) {
          calls += 1;
          if (calls === 1) {
            return new Response(JSON.stringify({ companyName: NAME }), { status: 200 });
          }
          return new Response(
            JSON.stringify({
              id: ID,
              companyName: NAME,
              items: [{ id: "scope", label: "工程範圍", status: "clear", finding: "已列明" }],
            }),
            { status: 200 },
          );
        }
        if (href.includes("/api/search") && init?.body && String(init.body).includes("preview")) {
          return new Response(JSON.stringify({ matchCount: 0, windowFull: false, candidates: [] }), {
            status: 200,
          });
        }
        if (href.includes("/api/search")) {
          return new Response(JSON.stringify({ report: { entity: { displayName: NAME } } }), { status: 200 });
        }
        return new Response(JSON.stringify({ ok: true }), { status: 200 });
      }),
    );

    render(<QuoteAnalysisForm signedIn={false} />);
    fireEvent.change(screen.getByLabelText(QUOTE_FILE_LABEL_ZH), { target: { files: [pdfFile()] } });
    fireEvent.click(screen.getByRole("checkbox", { name: QUOTE_ACK_LABEL_ZH }));
    fireEvent.click(await screen.findByRole("button", { name: QUOTE_COMPANY_CONFIRM_ZH }));
    fireEvent.click(await screen.findByRole("button", { name: QUOTE_ANALYSIS_VERIFY_CTA_ZH }));
    fireEvent.click(await screen.findByRole("button", { name: "mock-verify" }));

    expect(await screen.findByText("工程範圍")).toBeTruthy();
    const heading = screen.getByRole("heading", { name: QUOTE_ANALYSIS_SECTION_ZH, level: 2 });
    expect(heading.getAttribute("tabindex")).toBe("-1");
    await waitFor(() => expect(document.activeElement).toBe(heading));
    expect(nav.push).not.toHaveBeenCalled();
  });
});
