// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  ACCOUNT_DELETE_ACK_ZH,
  ACCOUNT_DELETE_BUTTON_ZH,
  ACCOUNT_DELETE_CONFIRM_LABEL_ZH,
  ACCOUNT_DELETE_HINT_ZH,
} from "@/lib/quote-analysis/copy";
import { AccountActions } from "./AccountActions";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

describe("account deletion confirmation", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("keeps the delete button disabled until the user types 刪除", () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    render(<AccountActions />);
    const button = screen.getByRole("button", { name: ACCOUNT_DELETE_BUTTON_ZH });
    const input = screen.getByLabelText(ACCOUNT_DELETE_CONFIRM_LABEL_ZH);
    const hint = screen.getByText(ACCOUNT_DELETE_HINT_ZH);
    expect(hint.tagName).toBe("P");
    expect(hint.compareDocumentPosition(input) & Node.DOCUMENT_POSITION_FOLLOWING).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );
    expect(screen.queryByRole("checkbox")).toBeNull();
    expect(hint.id).toBe("delete-account-hint");
    expect(input.getAttribute("aria-describedby")).toBe("delete-account-hint");
    expect((button as HTMLButtonElement).disabled).toBe(true);

    fireEvent.change(input, { target: { value: "delete" } });
    expect((button as HTMLButtonElement).disabled).toBe(true);
    fireEvent.submit(button.closest("form")!);
    expect(fetchSpy).not.toHaveBeenCalled();
    const alert = screen.getByRole("alert");
    expect(alert.textContent).toBe(ACCOUNT_DELETE_ACK_ZH);
    expect(input.getAttribute("aria-describedby")).toBe(`delete-account-hint ${alert.id}`);

    fireEvent.change(input, { target: { value: "刪除" } });
    expect((button as HTMLButtonElement).disabled).toBe(false);
  });
});
