// @vitest-environment jsdom
import { describe, expect, it, vi, afterEach } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { CopyCompanyNameButton } from "./CopyCompanyNameButton";
import {
  COPY_COMPANY_NAME_BUTTON_ZH,
  COPY_COMPANY_NAME_DONE_ZH,
} from "@/lib/report-trust-copy-zh";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("CopyCompanyNameButton", () => {
  it("copies text and shows done label briefly", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, {
      clipboard: { writeText },
    });

    render(<CopyCompanyNameButton text="合成測試有限公司" />);

    const button = screen.getByRole("button", {
      name: COPY_COMPANY_NAME_BUTTON_ZH,
    });
    expect(screen.getByRole("status").textContent).toBe("");
    expect(button.className).toContain("border");
    expect(button.textContent).toContain(COPY_COMPANY_NAME_BUTTON_ZH);
    fireEvent.click(button);

    await waitFor(() => {
      expect(writeText).toHaveBeenCalledWith("合成測試有限公司");
    });
    await waitFor(() => {
      expect(button.textContent).toBe(COPY_COMPANY_NAME_DONE_ZH);
    });
    expect(screen.getByRole("status").textContent).toBe(
      COPY_COMPANY_NAME_DONE_ZH,
    );
    expect(
      screen.getByRole("button", { name: COPY_COMPANY_NAME_DONE_ZH }),
    ).toBe(button);
  });
});
