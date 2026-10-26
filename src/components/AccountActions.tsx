"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import {
  ACCOUNT_DELETE_ACK_ZH,
  ACCOUNT_DELETE_BUTTON_ZH,
  ACCOUNT_DELETE_CONFIRM_LABEL_ZH,
  ACCOUNT_DELETE_CONFIRM_WORD_ZH,
  ACCOUNT_DELETE_ERROR_ZH,
  ACCOUNT_DELETE_HINT_ZH,
  ACCOUNT_SIGN_OUT_ZH,
} from "@/lib/quote-analysis/copy";

const fieldClass =
  "mt-1 w-full min-h-11 rounded-lg border border-border bg-background px-3 text-base text-foreground";

export function AccountActions() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [typed, setTyped] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<"out" | "delete" | null>(null);
  const confirmed = typed === ACCOUNT_DELETE_CONFIRM_WORD_ZH;

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
      inputRef.current?.focus();
      return;
    }
    setPending("delete");
    setError(null);
    try {
      const res = await fetch("/api/auth/account", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ confirm: ACCOUNT_DELETE_CONFIRM_WORD_ZH }),
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
        className="inline-flex min-h-11 items-center rounded-md border border-border px-4 text-sm font-medium disabled:opacity-60"
      >
        {ACCOUNT_SIGN_OUT_ZH}
      </button>
      <form onSubmit={deleteAccount} className="space-y-3">
        <p id="delete-account-hint" className="text-sm leading-relaxed text-muted-foreground">
          {ACCOUNT_DELETE_HINT_ZH}
        </p>
        <label htmlFor="delete-confirm" className="block text-sm text-foreground">
          {ACCOUNT_DELETE_CONFIRM_LABEL_ZH}
        </label>
        <input
          ref={inputRef}
          id="delete-confirm"
          type="text"
          name="confirm"
          value={typed}
          autoComplete="off"
          onChange={(event) => {
            setTyped(event.target.value);
            setError(null);
          }}
          aria-describedby={
            error ? "delete-account-hint delete-account-error" : "delete-account-hint"
          }
          className={fieldClass}
        />
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
          disabled={pending !== null || !confirmed}
          className="inline-flex min-h-11 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-60"
        >
          {ACCOUNT_DELETE_BUTTON_ZH}
        </button>
      </form>
    </div>
  );
}
