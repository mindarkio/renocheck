import { describe, expect, it, vi } from "vitest";

const signOut = vi.hoisted(() => vi.fn(async () => ({ error: null })));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: async () => ({ auth: { signOut } }),
}));

import { POST } from "./route";

describe("POST /api/auth/sign-out", () => {
  it("refuses cross-site posts and signs out same-site ones", async () => {
    const cross = new Request("http://localhost/api/auth/sign-out", {
      method: "POST",
      headers: { origin: "https://evil.example" },
    });
    expect((await POST(cross)).status).toBe(403);
    expect(signOut).not.toHaveBeenCalled();
    const same = new Request("http://localhost/api/auth/sign-out", {
      method: "POST",
      headers: { origin: "http://localhost" },
    });
    expect((await POST(same)).status).toBe(200);
    expect(signOut).toHaveBeenCalledOnce();
  });
});
