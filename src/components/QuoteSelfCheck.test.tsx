// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QuoteSelfCheck } from "./QuoteSelfCheck";
import {
  QUOTE_CHECK_ITEMS,
  QUOTE_CLEARED_STATUS_ZH,
  QUOTE_COPIED_STATUS_ZH,
  QUOTE_COPY_BUTTON_ZH,
  QUOTE_COPY_FAILED_STATUS_ZH,
  QUOTE_REPLY_EMPTY_ZH,
  QUOTE_REPLY_NOTE_ZH,
  QUOTE_SELF_CHECK_STORAGE_KEY,
  buildQuoteReplyMessage,
  clearQuoteCheckSelections,
} from "@/lib/quote-selfcheck";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  localStorage.clear();
  // The store caches at module level; reset it so tests stay independent.
  clearQuoteCheckSelections();
});

function setClipboard(value: unknown) {
  Object.defineProperty(navigator, "clipboard", { value, configurable: true });
}

function setExecCommand(impl: (command: string) => boolean) {
  const execCommand = vi.fn(impl);
  Object.defineProperty(document, "execCommand", { value: execCommand, configurable: true });
  return execCommand;
}

function radio(groupName: RegExp, name: string): HTMLInputElement {
  const input = within(group(groupName)).getByRole("radio", { name });
  if (!(input instanceof HTMLInputElement)) throw new Error("not a radio input");
  return input;
}

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

  it("gives each item its own radio group name", () => {
    render(<QuoteSelfCheck />);
    const names = new Set(
      screen.getAllByRole("radio").map((input) => input.getAttribute("name")),
    );
    expect(names.size).toBe(QUOTE_CHECK_ITEMS.length);
    expect(within(group(/拆舊範圍/)).getAllByRole("radio")).toHaveLength(4);
  });

  it("falls back to copying the textarea text when the clipboard API is missing", async () => {
    setClipboard(undefined);
    const execCommand = setExecCommand(() => true);
    render(<QuoteSelfCheck />);
    fireEvent.click(radio(/拆舊範圍/, "冇提及"));
    fireEvent.click(screen.getByRole("button", { name: QUOTE_COPY_BUTTON_ZH }));

    await waitFor(() => {
      expect(screen.getByRole("status").textContent).toBe(QUOTE_COPIED_STATUS_ZH);
    });
    expect(execCommand).toHaveBeenCalledWith("copy");
  });

  it("shows a visible failure message and selects the text when copying fails", async () => {
    setClipboard({ writeText: vi.fn().mockRejectedValue(new Error("NotAllowedError")) });
    setExecCommand(() => false);
    render(<QuoteSelfCheck />);
    fireEvent.click(radio(/拆舊範圍/, "冇提及"));
    fireEvent.click(screen.getByRole("button", { name: QUOTE_COPY_BUTTON_ZH }));

    await waitFor(() => {
      expect(screen.getByRole("status").textContent).toBe(QUOTE_COPY_FAILED_STATUS_ZH);
    });
    const field = screen.getByRole("textbox");
    expect(field instanceof HTMLTextAreaElement && field.selectionEnd - field.selectionStart).toBe(
      buildQuoteReplyMessage({ demolition: "missing" })?.length,
    );
    expect(screen.getByRole("status").className).not.toContain("sr-only");
  });

  it("moves focus to the checklist heading and announces after clearing", () => {
    render(<QuoteSelfCheck />);
    fireEvent.click(radio(/拆舊範圍/, "冇提及"));
    fireEvent.click(screen.getByRole("button", { name: "清除選擇" }));
    expect(document.activeElement?.id).toBe("quote-checklist-heading");
    expect(screen.getByRole("status").textContent).toBe(QUOTE_CLEARED_STATUS_ZH);
    expect(localStorage.getItem(QUOTE_SELF_CHECK_STORAGE_KEY)).toBeNull();
  });

  it("picks up a change written by another tab", () => {
    render(<QuoteSelfCheck />);
    act(() => {
      localStorage.setItem(QUOTE_SELF_CHECK_STORAGE_KEY, JSON.stringify({ electrical: "vague" }));
      window.dispatchEvent(new StorageEvent("storage", { key: QUOTE_SELF_CHECK_STORAGE_KEY }));
    });
    expect(radio(/電力工程細節/, "寫得含糊").checked).toBe(true);
  });

  it("keeps working in memory when localStorage reads throw", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new DOMException("denied", "SecurityError");
    });
    render(<QuoteSelfCheck />);
    fireEvent.click(radio(/拆舊範圍/, "冇提及"));
    expect(radio(/拆舊範圍/, "冇提及").checked).toBe(true);
    expect(textareaValue()).toBe(buildQuoteReplyMessage({ demolition: "missing" }));
  });

  it("keeps working in memory when localStorage writes throw", () => {
    const setItem = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("full", "QuotaExceededError");
    });
    render(<QuoteSelfCheck />);
    fireEvent.click(radio(/拆舊範圍/, "冇提及"));
    fireEvent.click(radio(/電力工程細節/, "寫得含糊"));
    expect(radio(/拆舊範圍/, "冇提及").checked).toBe(true);
    expect(textareaValue()).toBe(
      buildQuoteReplyMessage({ demolition: "missing", electrical: "vague" }),
    );
    expect(setItem).toHaveBeenCalled();
  });
});

