import "server-only";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { assertNotProdDbOutsideProd } from "@/lib/db-guard";
import { supabaseAuthCookieOptions } from "@/lib/supabase/auth-cookie";

export type AuthUser = { id: string; email: string | null };

export function isSupabaseAuthConfigured(
  env: Record<string, string | undefined> = process.env,
): boolean {
  return Boolean(
    env.NEXT_PUBLIC_SUPABASE_URL?.trim() &&
      env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim(),
  );
}

export async function createSupabaseServerClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  if (!url || !key) return null;
  try {
    assertNotProdDbOutsideProd();
  } catch {
    return null;
  }
  const cookieStore = await cookies();
  return createServerClient(url, key, {
    cookieOptions: supabaseAuthCookieOptions(),
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Server Components cannot always write cookies. Route handlers can.
        }
      },
    },
  });
}

export async function getAuthUser(): Promise<AuthUser | null> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return null;
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;
  return { id: data.user.id, email: data.user.email ?? null };
}
