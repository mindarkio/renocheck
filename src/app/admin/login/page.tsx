import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { isAdminDashboardEnabled } from "@/lib/admin/auth";
import { isAdminSessionValid } from "@/lib/admin/session";
import { connection } from "next/server";
import { submitAdminLogin } from "./actions";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
  title: "管理員登入",
};

type PageProps = {
  searchParams: Promise<{ error?: string }>;
};

export default async function AdminLoginPage({ searchParams }: PageProps) {
  await connection();
  if (!isAdminDashboardEnabled()) notFound();
  if (await isAdminSessionValid()) redirect("/admin");

  const { error } = await searchParams;
  let message: string | null = null;
  if (error === "locked") message = "試錯太多次，請 15 分鐘後再試";
  else if (error === "wrong") message = "PIN 唔啱，請再試";

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4 py-12">
      <h1 className="mb-6 text-center text-xl font-semibold text-primary">
        管理員登入
      </h1>
      <form action={submitAdminLogin} className="rounded-md border border-border bg-card p-6 shadow-sm">
        {message ? (
          <p className="mb-4 text-sm text-[var(--brand-coral-emphasis)]" role="alert">
            {message}
          </p>
        ) : null}
        <label className="mb-4 block text-sm font-medium" htmlFor="admin-pin">
          PIN
        </label>
        <input
          id="admin-pin"
          name="pin"
          type="password"
          inputMode="numeric"
          autoComplete="off"
          required
          minLength={4}
          maxLength={32}
          className="mb-4 w-full rounded-md border border-border px-3 py-2 text-base"
        />
        <button
          type="submit"
          className="w-full rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground"
        >
          登入
        </button>
      </form>
    </div>
  );
}
