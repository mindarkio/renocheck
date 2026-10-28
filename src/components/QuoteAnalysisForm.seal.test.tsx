// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  LOGIN_CODE_LABEL_ZH,
  LOGIN_EMAIL_LABEL_ZH,
  QUOTE_ACK_LABEL_ZH,
  QUOTE_ANALYSING_ZH,
  QUOTE_FILE_LABEL_ZH,
  QUOTE_PICK_FIRST_ZH,
  QUOTE_SEAL_CLOSE_ZH,
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
      expect(screen.queryByText(QUOTE_PICK_FIRST_ZH)).toBeNull();
    });
    fireEvent.change(screen.getByLabelText(QUOTE_FILE_LABEL_ZH), {
      target: { files: [pdfFile()] },
    });
    fireEvent.click(screen.getByRole("checkbox", { name: QUOTE_ACK_LABEL_ZH }));
    const dialog = await screen.findByRole("dialog", { name: QUOTE_SEAL_MODAL_TITLE_ZH });
    expect(dialog.getAttribute("aria-modal")).toBe("true");
    expect(screen.queryByLabelText(QUOTE_FILE_LABEL_ZH)).toBeNull();
    expect(document.querySelector("[data-quote-report-skeleton]")).toBeTruthy();
    expect(document.body.textContent).not.toContain(NAME);
    const abandon = screen.getByRole("button", { name: QUOTE_SEAL_CLOSE_ZH });
    const submit = screen.getByRole("button", { name: QUOTE_SEAL_REOPEN_ZH });
    expect(submit.className).toContain("w-full");
    expect(abandon.parentElement?.className).toContain("justify-center");
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).toBeNull();
    });
    expect(screen.getByRole("button", { name: QUOTE_SEAL_REOPEN_ZH })).toBeTruthy();
    expect(document.querySelector("[data-quote-report-skeleton]")).toBeTruthy();
    expect(screen.queryByLabelText(QUOTE_FILE_LABEL_ZH)).toBeNull();
    expect(document.body.textContent).not.toContain(NAME);
  });

  it("discards the sealed result when the user abandons verification", async () => {
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
      expect(screen.queryByText(QUOTE_PICK_FIRST_ZH)).toBeNull();
    });
    fireEvent.change(screen.getByLabelText(QUOTE_FILE_LABEL_ZH), {
      target: { files: [pdfFile()] },
    });
    fireEvent.click(screen.getByRole("checkbox", { name: QUOTE_ACK_LABEL_ZH }));
    await screen.findByRole("dialog", { name: QUOTE_SEAL_MODAL_TITLE_ZH });
    fireEvent.click(screen.getByRole("button", { name: QUOTE_SEAL_CLOSE_ZH }));
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).toBeNull();
    });
    expect(screen.queryByRole("button", { name: QUOTE_SEAL_REOPEN_ZH })).toBeNull();
    expect(document.querySelector("[data-quote-report-skeleton]")).toBeNull();
    expect(screen.getByLabelText(QUOTE_FILE_LABEL_ZH)).toBeTruthy();
    expect(document.body.textContent).not.toContain(NAME);
  });

  it("abandon drops the sealed blob and does not claim after verify returns", async () => {
    let releaseVerify: (response: Response) => void = () => {};
    const calls: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        const href = String(url);
        calls.push(href);
        if (href.includes("/api/quote/availability")) {
          return new Response(JSON.stringify({ enabled: true, anonymous: true }), { status: 200 });
        }
        if (href.includes("/api/quote/analyze")) {
          return new Response(JSON.stringify({ sealed: "opaque-blob" }), { status: 200 });
        }
        if (href.includes("/api/auth/verify")) {
          return new Promise<Response>((resolve) => {
            releaseVerify = resolve;
          });
        }
        if (href.includes("/api/quote/claim")) {
          return new Response(JSON.stringify({ id: "33333333-3333-4333-8333-333333333333", items: [] }), {
            status: 200,
          });
        }
        return new Response(JSON.stringify({ ok: true }), { status: 200 });
      }),
    );
    render(<QuoteAnalysisForm signedIn={false} />);
    await waitFor(() => {
      expect(screen.queryByText(QUOTE_PICK_FIRST_ZH)).toBeNull();
    });
    fireEvent.change(screen.getByLabelText(QUOTE_FILE_LABEL_ZH), {
      target: { files: [pdfFile()] },
    });
    fireEvent.click(screen.getByRole("checkbox", { name: QUOTE_ACK_LABEL_ZH }));
    await screen.findByRole("dialog", { name: QUOTE_SEAL_MODAL_TITLE_ZH });
    expect(sessionStorage.getItem("renocheck:quote-seal-pending")).toBe("1");
    fireEvent.change(screen.getByLabelText(LOGIN_EMAIL_LABEL_ZH), {
      target: { value: "person@example.com" },
    });
    fireEvent.change(screen.getByLabelText(LOGIN_CODE_LABEL_ZH), {
      target: { value: "123456" },
    });
    fireEvent.click(screen.getByRole("button", { name: QUOTE_SEAL_REOPEN_ZH }));
    fireEvent.click(screen.getByRole("button", { name: QUOTE_SEAL_CLOSE_ZH }));
    releaseVerify(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    await waitFor(() => {
      expect(screen.getByLabelText(QUOTE_FILE_LABEL_ZH)).toBeTruthy();
    });
    await waitFor(() => {
      expect(calls.some((href) => href.includes("/api/auth/verify"))).toBe(true);
    });
    expect(calls.some((href) => href.includes("/api/quote/claim"))).toBe(false);
    expect(sessionStorage.getItem("renocheck:quote-seal-pending")).toBeNull();
    expect(screen.queryByRole("button", { name: QUOTE_SEAL_REOPEN_ZH })).toBeNull();
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
      expect(screen.queryByText(QUOTE_PICK_FIRST_ZH)).toBeNull();
    });
    fireEvent.change(screen.getByLabelText(QUOTE_FILE_LABEL_ZH), {
      target: { files: [pdfFile()] },
    });
    fireEvent.click(screen.getByRole("checkbox", { name: QUOTE_ACK_LABEL_ZH }));
    fireEvent.submit(screen.getByRole("checkbox", { name: QUOTE_ACK_LABEL_ZH }).closest("form")!);
    await screen.findByText(QUOTE_ANALYSING_ZH);
    expect(analyzeCalls).toBe(1);
  });
});
