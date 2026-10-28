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
  "mt-1 w-full min-h-11 rounded-lg border border-border bg-background px-3 text-base text-foreground";

export function SignInForm({
  nextPath,
  onVerified,
  submitLabel = LOGIN_SUBMIT_ZH,
  onAbandon,
  abandonLabel,
}: {
  nextPath?: string;
  /** When set, stay on this page instead of following `next`. */
  onVerified?: () => void | Promise<void>;
  /** Defaults to the site login button. The quote verification step passes its own label. */
  submitLabel?: string;
  onAbandon?: () => void;
  abandonLabel?: string;
}) {
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
      if (onVerified) {
        await onVerified();
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

  const modal = Boolean(onAbandon);
  const emailField = (
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
  );
  const sendButton = (
    <button
      type="button"
      className="inline-flex min-h-11 items-center rounded-md border border-border px-3 text-sm font-medium text-foreground disabled:opacity-60"
      onClick={sendCode}
      disabled={pending !== null}
    >
      {LOGIN_SEND_ZH}
    </button>
  );
  const codeField = (
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
  );

  return (
    <form onSubmit={verify} className={modal ? "mt-6 space-y-5" : "mt-6 space-y-4"}>
      {modal ? (
        <div className="space-y-3">
          {emailField}
          {sendButton}
        </div>
      ) : (
        <>
          {emailField}
          {sendButton}
        </>
      )}
      {codeField}
      {message ? (
        <p className="text-sm leading-relaxed text-muted-foreground" role="status">
          {message}
        </p>
      ) : null}
      {error ? (
        <p className="text-sm leading-relaxed text-[var(--brand-coral-emphasis)]" role="alert">
          {error}
        </p>
      ) : null}
      <button
        type="submit"
        className={`inline-flex min-h-11 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-60 ${
          modal ? "w-full" : ""
        }`}
        disabled={pending !== null}
      >
        {submitLabel}
      </button>
      {onAbandon && abandonLabel ? (
        <div className="flex justify-center pt-2">
          <button
            type="button"
            onClick={onAbandon}
            className="inline-flex min-h-11 items-center justify-center px-3 text-sm text-muted-foreground underline-offset-2 hover:underline"
          >
            {abandonLabel}
          </button>
        </div>
      ) : null}
    </form>
  );
}
