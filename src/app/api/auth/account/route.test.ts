import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

const USER = "11111111-1111-4111-8111-111111111111";

const mocks = vi.hoisted(() => ({
  getAuthUser: vi.fn(),
  signOut: vi.fn(async () => ({ error: null })),
  deleteUser: vi.fn(async () => ({ data: { user: null }, error: null })),
  tables: [] as string[],
  failTable: null as string | null,
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
            eq: async () => ({
              error: mocks.failTable === table ? { message: "no" } : null,
            }),
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

  it("refuses cross-site posts", async () => {
    const res = await POST(
      new Request("http://localhost/api/auth/account", {
        method: "POST",
        headers: { origin: "https://evil.example", "content-type": "application/json" },
        body: JSON.stringify({ confirm: "刪除" }),
      }),
    );
    expect(res.status).toBe(403);
    expect(mocks.deleteUser).not.toHaveBeenCalled();
  });

  it("keeps the session when the rows cannot be removed", async () => {
    mocks.failTable = "quote_analysis_claims";
    const res = await POST(request({ confirm: "刪除" }));
    mocks.failTable = null;
    expect(res.status).toBe(503);
    expect(mocks.deleteUser).not.toHaveBeenCalled();
    expect(mocks.signOut).not.toHaveBeenCalled();
  });

  it("rejects account deletion without the typed confirmation", async () => {
    const res = await POST(request({}));
    expect(res.status).toBe(400);
    expect(mocks.deleteUser).not.toHaveBeenCalled();
  });

  it("rejects the old english token and anything other than 刪除", async () => {
    for (const confirm of ["delete", "刪除 ", " 刪除", "删除"]) {
      const res = await POST(request({ confirm }));
      expect(res.status).toBe(400);
    }
    expect(mocks.deleteUser).not.toHaveBeenCalled();
  });

  it("requires a session", async () => {
    mocks.getAuthUser.mockResolvedValue(null);
    const res = await POST(request({ confirm: "刪除" }));
    expect(res.status).toBe(401);
    expect(mocks.deleteUser).not.toHaveBeenCalled();
  });

  it("deletes the signed-in user and their quote analyses", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const res = await POST(request({ confirm: "刪除" }));
    expect(res.status).toBe(200);
    expect(mocks.tables).toEqual(["quote_analysis_claims", "quote_analyses"]);
    expect(mocks.deleteUser).toHaveBeenCalledWith(USER);
    expect(mocks.signOut).toHaveBeenCalledOnce();
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
