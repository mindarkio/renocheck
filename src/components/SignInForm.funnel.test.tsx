// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { LOGIN_CODE_LABEL_ZH, LOGIN_EMAIL_LABEL_ZH, LOGIN_SEND_ZH } from "@/lib/quote-analysis/copy";
import { SignInForm } from "./SignInForm";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

vi.mock("@/lib/usage-events-client", () => ({
  sendUsageEvent: vi.fn(),
}));

import { sendUsageEvent } from "@/lib/usage-events-client";

function stubAuth(otp: { status: number; body: unknown }, verify: { status: number; body: unknown }) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      const r = String(url).includes("/api/auth/verify") ? verify : otp;
      return new Response(JSON.stringify(r.body), { status: r.status });
    }),
  );
}

async function sendAndVerify() {
  fireEvent.change(screen.getByLabelText(LOGIN_EMAIL_LABEL_ZH), {
    target: { value: "tester@example.invalid" },
  });
  fireEvent.click(screen.getByRole("button", { name: LOGIN_SEND_ZH }));
  await waitFor(() => expect(vi.mocked(fetch)).toHaveBeenCalledTimes(1));
  fireEvent.change(screen.getByLabelText(LOGIN_CODE_LABEL_ZH), { target: { value: "123456" } });
  fireEvent.submit(screen.getByLabelText(LOGIN_CODE_LABEL_ZH).closest("form")!);
  await waitFor(() => expect(vi.mocked(fetch)).toHaveBeenCalledTimes(2));
}

describe("SignInForm quote funnel events", () => {
  afterEach(() => {
    cleanup();
    vi.mocked(sendUsageEvent).mockClear();
    vi.unstubAllGlobals();
  });

  it("sends nothing from the site login form", async () => {
    stubAuth({ status: 503, body: { error: "unavailable" } }, { status: 400, body: { error: "invalid_code" } });
    render(<SignInForm />);
    await sendAndVerify();
    expect(sendUsageEvent).not.toHaveBeenCalled();
  });

  it("sends reason codes only, never the email, from the quote dialog", async () => {
    stubAuth({ status: 200, body: { ok: true } }, { status: 200, body: { ok: true } });
    const onVerified = vi.fn(async () => {});
    render(<SignInForm trackQuoteFunnel onVerified={onVerified} onAbandon={() => {}} abandonLabel="x" />);
    await sendAndVerify();
    await waitFor(() => expect(onVerified).toHaveBeenCalled());
    expect(vi.mocked(sendUsageEvent).mock.calls).toEqual([["quote_otp_success"]]);
    expect(JSON.stringify(vi.mocked(sendUsageEvent).mock.calls)).not.toContain("example.invalid");
  });

  it("maps a wrong code to an allow-listed reason", async () => {
    stubAuth({ status: 200, body: { ok: true } }, { status: 400, body: { error: "invalid_code" } });
    render(<SignInForm trackQuoteFunnel onAbandon={() => {}} abandonLabel="x" />);
    await sendAndVerify();
    await waitFor(() =>
      expect(sendUsageEvent).toHaveBeenCalledWith("quote_otp_fail", { detail: "invalid_input" }),
    );
  });
});
