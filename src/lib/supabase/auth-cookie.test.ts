import { afterEach, describe, expect, it, vi } from "vitest";

const createServerClient = vi.hoisted(() => vi.fn());

vi.mock("next/headers", () => ({
  cookies: async () => ({
    getAll: () => [],
    set: () => undefined,
  }),
}));

vi.mock("@supabase/ssr", () => ({
  createServerClient,
}));

import { createSupabaseServerClient } from "@/lib/supabase/server";

describe("Supabase auth cookies", () => {
  afterEach(() => {
    createServerClient.mockReset();
    vi.unstubAllEnvs();
  });

  it("sets httpOnly on the server client", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://local.example.invalid");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "test-anon");
    createServerClient.mockReturnValue({ auth: {} });
    await createSupabaseServerClient();
    expect(createServerClient).toHaveBeenCalledWith(
      "https://local.example.invalid",
      "test-anon",
      expect.objectContaining({
        cookieOptions: { httpOnly: true, secure: false },
      }),
    );
  });

  it("sets secure only when NODE_ENV is production", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://local.example.invalid");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "test-anon");
    vi.stubEnv("NODE_ENV", "production");
    createServerClient.mockReturnValue({ auth: {} });
    await createSupabaseServerClient();
    expect(createServerClient).toHaveBeenCalledWith(
      "https://local.example.invalid",
      "test-anon",
      expect.objectContaining({
        cookieOptions: { httpOnly: true, secure: true },
      }),
    );
  });
});
