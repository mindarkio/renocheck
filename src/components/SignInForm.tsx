"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { safeNextPath } from "@/lib/request-guards";
import {
  LOGIN_CODE_INVALID_ZH,
  LOGIN_CODE_LABEL_ZH,
  LOGIN_EMAIL_LABEL_ZH,
  LOGIN_SEND_FAILED_ZH,
  LOGIN_SEND_ZH,
  LOGIN_SENT_ZH,
  LOGIN_SUBMIT_ZH,
} from "@/lib/quote-analysis/copy";

const fieldClass =
  "mt-1 w-full min-h-11 rounded-lg border border-border bg-background px-3 text-base text-foreground outline-none focus-visible:ring-2 focus-visible:ring-primary/30";

export function SignInForm({ nextPath }: { nextPath?: string }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<"send" | "verify" | null>(null);

  async function sendCode() {
    setError(null);
    setMessage(null);
    setPending("send");
    try {
      const res = await fetch("/api/auth/otp", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = (await res.json().catch(() => null)) as { message?: string } | null;
      if (!res.ok) {
        setError(data?.message ?? LOGIN_SEND_FAILED_ZH);
        return;
      }
      setMessage(LOGIN_SENT_ZH);
    } catch {
      setError(LOGIN_SEND_FAILED_ZH);
    } finally {
      setPending(null);
    }
  }

  async function verify(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setPending("verify");
    try {
      const res = await fetch("/api/auth/verify", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, token: code }),
      });
      const data = (await res.json().catch(() => null)) as { message?: string } | null;
      if (!res.ok) {
        setError(data?.message ?? LOGIN_CODE_INVALID_ZH);
        return;
      }
      router.push(safeNextPath(nextPath));
      router.refresh();
    } catch {
      setError(LOGIN_CODE_INVALID_ZH);
    } finally {
      setPending(null);
    }
  }

  return (
    <form onSubmit={verify} className="mt-6 space-y-4">
      <div>
        <label htmlFor="login-email" className="text-sm font-medium text-foreground">
          {LOGIN_EMAIL_LABEL_ZH}
        </label>
        <input
          id="login-email"
          name="email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className={fieldClass}
        />
      </div>
      <button
        type="button"
        className="inline-flex min-h-11 items-center rounded-md border border-border px-3 text-sm font-medium text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 disabled:opacity-60"
        onClick={sendCode}
        disabled={pending !== null}
      >
        {LOGIN_SEND_ZH}
      </button>
      <div>
        <label htmlFor="login-code" className="text-sm font-medium text-foreground">
          {LOGIN_CODE_LABEL_ZH}
        </label>
        <input
          id="login-code"
          name="code"
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="[0-9]{6}"
          maxLength={6}
          required
          value={code}
          onChange={(event) => setCode(event.target.value)}
          className={fieldClass}
        />
      </div>
      {message ? (
        <p className="text-sm text-muted-foreground" role="status">
          {message}
        </p>
      ) : null}
      {error ? (
        <p className="text-sm text-[var(--brand-coral-emphasis)]" role="alert">
          {error}
        </p>
      ) : null}
      <button
        type="submit"
        className="inline-flex min-h-11 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 disabled:opacity-60"
        disabled={pending !== null}
      >
        {LOGIN_SUBMIT_ZH}
      </button>
    </form>
  );
}
