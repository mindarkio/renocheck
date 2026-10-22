// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SearchForm } from "./SearchForm";
import { ServiceBanner } from "./ServiceBanner";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

const B1 = "用戶擁擠，系統暫停服務，請稍後再試";
const B6 = "報告未能顯示，請稍後再試。";

function jsonResponse(status: number, error: string) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => ({ error }),
  };
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("ServiceBanner", () => {
  it("shows the approved pause text", () => {
    render(<ServiceBanner />);
    expect(screen.getByRole("alert").textContent).toBe(B1);
  });
});

describe("SearchForm pause and errors", () => {
  it("disables every input and the submit button when paused, with no extra message", () => {
    render(<SearchForm paused />);
    for (const id of ["companyName", "phone", "br"]) {
      expect((document.getElementById(id) as HTMLInputElement).disabled).toBe(true);
    }
    expect(
      (screen.getByRole("button", { name: "查閱公開資料摘要" }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
    expect(document.body.textContent).not.toContain(B1);
  });

  it("disables the landing search box when paused", () => {
    render(<SearchForm variant="landing" paused />);
    expect((screen.getByRole("searchbox") as HTMLInputElement).disabled).toBe(true);
    expect(
      (screen.getByRole("button", { name: "查閱公開資料摘要" }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
  });

  it.each(["service_paused", "llm_busy"] as const)(
    "shows B1 and disables input after 503 %s",
    async (code) => {
      vi.stubGlobal(
        "fetch",
        vi.fn(async () => jsonResponse(503, code)),
      );
      render(<SearchForm variant="landing" />);
      fireEvent.change(screen.getByRole("searchbox"), {
        target: { value: "示例裝修有限公司" },
      });
      fireEvent.click(screen.getByRole("button", { name: "查閱公開資料摘要" }));
      await waitFor(() => {
        expect(screen.getByRole("status").textContent).toBe(B1);
      });
      expect((screen.getByRole("searchbox") as HTMLInputElement).disabled).toBe(true);
    },
  );

  it.each(["supabase_unavailable", "serp_unavailable", "llm_unavailable"] as const)(
    "hides the %s env hint",
    async (code) => {
      vi.stubGlobal(
        "fetch",
        vi.fn(async () => jsonResponse(503, code)),
      );
      render(<SearchForm variant="landing" />);
      fireEvent.change(screen.getByRole("searchbox"), {
        target: { value: "示例裝修有限公司" },
      });
      fireEvent.click(screen.getByRole("button", { name: "查閱公開資料摘要" }));
      await waitFor(() => {
        expect(screen.getByRole("status").textContent).toBe(B6);
      });
      const text = document.body.textContent ?? "";
      expect(text).not.toContain("SERPER");
      expect(text).not.toContain("Supabase");
      expect(text).not.toContain("環境變數");
      expect(text).not.toContain("AI Gateway");
    },
  );
});
