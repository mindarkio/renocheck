// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  ACCOUNT_DELETE_ACK_ZH,
  ACCOUNT_DELETE_BUTTON_ZH,
  ACCOUNT_DELETE_CONFIRM_LABEL_ZH,
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
    expect((button as HTMLButtonElement).disabled).toBe(true);

    fireEvent.change(input, { target: { value: "delete" } });
    expect((button as HTMLButtonElement).disabled).toBe(true);
    fireEvent.submit(button.closest("form")!);
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(screen.getByRole("alert").textContent).toBe(ACCOUNT_DELETE_ACK_ZH);

    fireEvent.change(input, { target: { value: "刪除" } });
    expect((button as HTMLButtonElement).disabled).toBe(false);
  });
});
