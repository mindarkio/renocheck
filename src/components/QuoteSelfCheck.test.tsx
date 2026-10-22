// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QuoteSelfCheck } from "./QuoteSelfCheck";
import {
  QUOTE_COPIED_STATUS_ZH,
  QUOTE_COPY_BUTTON_ZH,
  QUOTE_REPLY_EMPTY_ZH,
  QUOTE_REPLY_NOTE_ZH,
  QUOTE_SELF_CHECK_STORAGE_KEY,
  buildQuoteReplyMessage,
} from "@/lib/quote-selfcheck";

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.restoreAllMocks();
});

function group(name: RegExp) {
  return screen.getByRole("group", { name });
}

function textareaValue(): string {
  const field = screen.getByRole("textbox");
  if (!(field instanceof HTMLTextAreaElement)) {
    throw new Error("reply field is not a textarea");
  }
  return field.value;
}

describe("QuoteSelfCheck", () => {
  it("shows a prompt and no message until a missing or vague status is chosen", () => {
    render(<QuoteSelfCheck />);
    expect(screen.getByText(QUOTE_REPLY_EMPTY_ZH).textContent).toBe(QUOTE_REPLY_EMPTY_ZH);
    expect(screen.queryByRole("textbox")).toBeNull();
    expect(screen.queryByRole("link", { name: /wa\.me|WhatsApp/ })).toBeNull();
    expect(document.body.innerHTML).not.toContain("wa.me");

    fireEvent.click(within(group(/拆舊範圍/)).getByRole("radio", { name: "有寫清楚" }));
    expect(screen.queryByRole("textbox")).toBeNull();

    fireEvent.click(within(group(/拆舊範圍/)).getByRole("radio", { name: "冇提及" }));
    const message = buildQuoteReplyMessage({ demolition: "missing" });
    const field = screen.getByRole("textbox");
    expect(textareaValue()).toBe(message);
    expect(field.hasAttribute("readonly")).toBe(true);
    expect(screen.getByText(QUOTE_REPLY_NOTE_ZH).textContent).toBe(QUOTE_REPLY_NOTE_ZH);
  });

  it("puts missing items before vague items in the textarea", () => {
    render(<QuoteSelfCheck />);
    fireEvent.click(within(group(/拆舊範圍/)).getByRole("radio", { name: "寫得含糊" }));
    fireEvent.click(within(group(/電力工程細節/)).getByRole("radio", { name: "冇提及" }));

    expect(textareaValue()).toBe(
      buildQuoteReplyMessage({ demolition: "vague", electrical: "missing" }),
    );
  });

  it("copies the plain-text message and announces success", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });

    render(<QuoteSelfCheck />);
    fireEvent.click(within(group(/煤氣工程/)).getByRole("radio", { name: "寫得含糊" }));
    const message = buildQuoteReplyMessage({ gas: "vague" });

    fireEvent.click(screen.getByRole("button", { name: QUOTE_COPY_BUTTON_ZH }));

    await waitFor(() => {
      expect(writeText).toHaveBeenCalledWith(message);
    });
    expect(screen.getByRole("status").textContent).toBe(QUOTE_COPIED_STATUS_ZH);
    expect(screen.getByRole("button", { name: QUOTE_COPY_BUTTON_ZH }).className).toContain(
      "min-h-11",
    );
  });

  it("remembers selections in localStorage and drops arithmetic on the next edit", () => {
    localStorage.setItem(
      QUOTE_SELF_CHECK_STORAGE_KEY,
      JSON.stringify({ demolition: "missing", arithmetic: "missing" }),
    );
    render(<QuoteSelfCheck />);
    const remembered = within(group(/拆舊範圍/)).getByRole("radio", { name: "冇提及" });
    expect(remembered instanceof HTMLInputElement && remembered.checked).toBe(true);
    expect(textareaValue()).toBe(buildQuoteReplyMessage({ demolition: "missing" }));

    fireEvent.click(screen.getByRole("button", { name: "清除選擇" }));
    const stored = JSON.parse(localStorage.getItem(QUOTE_SELF_CHECK_STORAGE_KEY) ?? "{}") as {
      arithmetic?: string;
    };
    expect(stored.arithmetic).toBeUndefined();
    expect(screen.queryByRole("textbox")).toBeNull();
  });
});
