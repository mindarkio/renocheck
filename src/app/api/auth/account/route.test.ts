import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

const USER = "11111111-1111-4111-8111-111111111111";

const mocks = vi.hoisted(() => ({
  getAuthUser: vi.fn(),
  signOut: vi.fn(async () => ({ error: null })),
  deleteUser: vi.fn(async () => ({ data: { user: null }, error: null })),
  tables: [] as string[],
}));

vi.mock("@/lib/supabase/server", () => ({
  getAuthUser: () => mocks.getAuthUser(),
  createSupabaseServerClient: async () => ({
    auth: { signOut: mocks.signOut },
  }),
}));

vi.mock("@/lib/supabase/admin", () => ({
  getSupabaseAdmin: () =>
    ({
      from(table: string) {
        mocks.tables.push(table);
        return {
          delete: () => ({
            eq: async () => ({ error: null }),
          }),
        };
      },
      auth: { admin: { deleteUser: mocks.deleteUser } },
    }) as unknown as SupabaseClient,
}));

import { POST } from "./route";

function request(body: unknown) {
  return new Request("http://localhost/api/auth/account", {
    method: "POST",
    headers: {
      origin: "http://localhost",
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });
}

describe("POST /api/auth/account", () => {
  beforeEach(() => {
    mocks.tables.length = 0;
    mocks.getAuthUser.mockReset();
    mocks.deleteUser.mockClear();
    mocks.signOut.mockClear();
    mocks.getAuthUser.mockResolvedValue({ id: USER, email: "person@example.com" });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("rejects account deletion without the confirmation", async () => {
    const res = await POST(request({}));
    expect(res.status).toBe(400);
    expect(mocks.deleteUser).not.toHaveBeenCalled();
  });

  it("requires a session", async () => {
    mocks.getAuthUser.mockResolvedValue(null);
    const res = await POST(request({ confirm: "delete" }));
    expect(res.status).toBe(401);
    expect(mocks.deleteUser).not.toHaveBeenCalled();
  });

  it("deletes the signed-in user and their quote analyses", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const res = await POST(request({ confirm: "delete" }));
    expect(res.status).toBe(200);
    expect(mocks.tables).toEqual(["quote_analysis_claims", "quote_analyses"]);
    expect(mocks.deleteUser).toHaveBeenCalledWith(USER);
    expect(mocks.signOut).toHaveBeenCalledOnce();
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
