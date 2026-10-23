"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import {
  ACCOUNT_DELETE_ACK_ZH,
  ACCOUNT_DELETE_BUTTON_ZH,
  ACCOUNT_DELETE_CHECK_ZH,
  ACCOUNT_DELETE_ERROR_ZH,
  ACCOUNT_SIGN_OUT_ZH,
} from "@/lib/quote-analysis/copy";

export function AccountActions() {
  const router = useRouter();
  const checkboxRef = useRef<HTMLInputElement>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<"out" | "delete" | null>(null);

  async function signOut() {
    setPending("out");
    setError(null);
    try {
      await fetch("/api/auth/sign-out", { method: "POST" });
      router.push("/");
      router.refresh();
    } finally {
      setPending(null);
    }
  }

  async function deleteAccount(event: React.FormEvent) {
    event.preventDefault();
    if (!confirmed) {
      setError(ACCOUNT_DELETE_ACK_ZH);
      checkboxRef.current?.focus();
      return;
    }
    setPending("delete");
    setError(null);
    try {
      const res = await fetch("/api/auth/account", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ confirm: "delete" }),
      });
      const data = (await res.json().catch(() => null)) as { message?: string } | null;
      if (!res.ok) {
        setError(data?.message ?? ACCOUNT_DELETE_ERROR_ZH);
        return;
      }
      router.push("/");
      router.refresh();
    } catch {
      setError(ACCOUNT_DELETE_ERROR_ZH);
    } finally {
      setPending(null);
    }
  }

  return (
    <div className="mt-6 space-y-8">
      <button
        type="button"
        onClick={signOut}
        disabled={pending !== null}
        className="inline-flex min-h-11 items-center rounded-md border border-border px-4 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 disabled:opacity-60"
      >
        {ACCOUNT_SIGN_OUT_ZH}
      </button>
      <form onSubmit={deleteAccount} className="space-y-3">
        <label className="flex min-h-11 items-start gap-3 text-sm text-foreground">
          <input
            ref={checkboxRef}
            type="checkbox"
            name="confirm"
            value="delete"
            checked={confirmed}
            onChange={(event) => {
              setConfirmed(event.target.checked);
              setError(null);
            }}
            className="mt-1 size-5 shrink-0"
            aria-describedby={error ? "delete-account-error" : undefined}
          />
          <span>{ACCOUNT_DELETE_CHECK_ZH}</span>
        </label>
        {error ? (
          <p
            id="delete-account-error"
            className="text-sm text-[var(--brand-coral-emphasis)]"
            role="alert"
          >
            {error}
          </p>
        ) : null}
        <button
          type="submit"
          disabled={pending !== null}
          className="inline-flex min-h-11 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 disabled:opacity-60"
        >
          {ACCOUNT_DELETE_BUTTON_ZH}
        </button>
      </form>
    </div>
  );
}
