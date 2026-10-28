// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  QUOTE_ACK_LABEL_ZH,
  QUOTE_FILE_LABEL_ZH,
  QUOTE_SEAL_MODAL_TITLE_ZH,
  QUOTE_SEAL_REOPEN_ZH,
} from "@/lib/quote-analysis/copy";
import { QuoteAnalysisForm } from "./QuoteAnalysisForm";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

const NAME = "合成測試工程有限公司";

function pdfFile(): File {
  return new File([new Uint8Array([0x25, 0x50, 0x44, 0x46])], "quote.pdf", {
    type: "application/pdf",
  });
}

describe("sealed quote upload", () => {
  afterEach(() => {
    cleanup();
    sessionStorage.clear();
    vi.unstubAllGlobals();
  });

  it("does not put report data in the page and traps the login dialog", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (String(url).includes("/api/quote/availability")) {
          return new Response(JSON.stringify({ enabled: true, anonymous: true }), { status: 200 });
        }
        return new Response(JSON.stringify({ sealed: "opaque-blob" }), { status: 200 });
      }),
    );
    render(<QuoteAnalysisForm signedIn={false} />);
    await waitFor(() => {
      expect(screen.queryByText(/先揀 PDF/)).toBeNull();
    });
    fireEvent.change(screen.getByLabelText(QUOTE_FILE_LABEL_ZH), {
      target: { files: [pdfFile()] },
    });
    fireEvent.click(screen.getByRole("checkbox", { name: QUOTE_ACK_LABEL_ZH }));
    const dialog = await screen.findByRole("dialog", { name: QUOTE_SEAL_MODAL_TITLE_ZH });
    expect(dialog.getAttribute("aria-modal")).toBe("true");
    expect(document.body.textContent).not.toContain(NAME);
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).toBeNull();
    });
    expect(screen.getByRole("button", { name: QUOTE_SEAL_REOPEN_ZH })).toBeTruthy();
    expect(document.body.textContent).not.toContain(NAME);
  });

  it("does not send a second analysis while the first is in flight", async () => {
    let analyzeCalls = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (String(url).includes("/api/quote/availability")) {
          return new Response(JSON.stringify({ anonymous: true, enabled: true }), { status: 200 });
        }
        analyzeCalls += 1;
        return new Promise(() => {});
      }),
    );
    render(<QuoteAnalysisForm signedIn={false} />);
    await waitFor(() => {
      expect(screen.queryByText(/先揀 PDF/)).toBeNull();
    });
    fireEvent.change(screen.getByLabelText(QUOTE_FILE_LABEL_ZH), {
      target: { files: [pdfFile()] },
    });
    fireEvent.click(screen.getByRole("checkbox", { name: QUOTE_ACK_LABEL_ZH }));
    fireEvent.submit(screen.getByRole("checkbox", { name: QUOTE_ACK_LABEL_ZH }).closest("form")!);
    await screen.findByText("分析緊，請稍等。");
    expect(analyzeCalls).toBe(1);
  });
});
