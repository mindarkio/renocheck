// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  LOGIN_CODE_LABEL_ZH,
  LOGIN_EMAIL_LABEL_ZH,
  QUOTE_ACK_LABEL_ZH,
  QUOTE_FILE_LABEL_ZH,
  QUOTE_FILE_RESELECT_ZH,
  QUOTE_SUBMIT_ZH,
} from "@/lib/quote-analysis/copy";
import { QUOTE_FILE_PENDING_KEY, QuoteAnalysisForm } from "./QuoteAnalysisForm";

const push = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, refresh: vi.fn() }),
}));

function pdfFile(): File {
  return new File([new Uint8Array([0x25, 0x50, 0x44, 0x46])], "quote.pdf", {
    type: "application/pdf",
  });
}

function chooseFile() {
  fireEvent.change(screen.getByLabelText(QUOTE_FILE_LABEL_ZH), {
    target: { files: [pdfFile()] },
  });
}

describe("quote upload before login", () => {
  afterEach(() => {
    cleanup();
    sessionStorage.clear();
    localStorage.clear();
    push.mockClear();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("extracts the company name before verification and does not navigate", async () => {
    const calls: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        calls.push(String(url));
        if (String(url).includes("/api/quote/analyze")) {
          return new Response(JSON.stringify({ companyName: "合成測試工程有限公司" }), { status: 200 });
        }
        return new Response(JSON.stringify({ ok: true }), { status: 200 });
      }),
    );
    render(<QuoteAnalysisForm signedIn={false} />);
    expect(screen.queryByLabelText(LOGIN_EMAIL_LABEL_ZH)).toBeNull();
    chooseFile();
    fireEvent.click(screen.getByRole("checkbox", { name: QUOTE_ACK_LABEL_ZH }));
    expect(await screen.findByText(/我們在報價單上找到/)).toBeTruthy();
    expect(calls.filter((url) => url.includes("/api/quote/analyze"))).toHaveLength(1);
    expect(push).not.toHaveBeenCalled();
    expect(screen.queryByLabelText(LOGIN_CODE_LABEL_ZH)).toBeNull();
  });

  it("skips the login step when the user is already signed in", () => {
    render(<QuoteAnalysisForm signedIn />);
    chooseFile();
    expect(screen.queryByLabelText(LOGIN_EMAIL_LABEL_ZH)).toBeNull();
    expect(screen.getByRole("button", { name: QUOTE_SUBMIT_ZH })).toBeTruthy();
  });

  it("asks for the PDF again after a reload and does not keep the file", async () => {
    sessionStorage.setItem(QUOTE_FILE_PENDING_KEY, "1");
    const urls: string[] = [];
    vi.stubGlobal("fetch", async (url: string) => {
      urls.push(url);
      return new Response("{}", { status: 200 });
    });
    render(<QuoteAnalysisForm signedIn={false} />);
    expect(await screen.findByText(QUOTE_FILE_RESELECT_ZH)).toBeTruthy();
    expect(urls.some((url) => url.includes("/api/quote/analyze"))).toBe(false);
    expect(localStorage.length).toBe(0);
    expect(sessionStorage.getItem(QUOTE_FILE_PENDING_KEY)).toBe("1");
  });

  it("records only a pending flag, not the PDF", () => {
    const writes: string[] = [];
    const original = Storage.prototype.setItem;
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(function (
      this: Storage,
      key: string,
      value: string,
    ) {
      const bucket = this === localStorage ? "local" : "session";
      writes.push(`${bucket}:${key}:${value}`);
      return original.call(this, key, value);
    });
    render(<QuoteAnalysisForm signedIn={false} />);
    chooseFile();
    expect(writes).toEqual([`session:${QUOTE_FILE_PENDING_KEY}:1`]);
  });
});
