import { beforeEach, describe, expect, it, vi } from "vitest";

const getAuthUser = vi.hoisted(() => vi.fn());
const claimSealedQuote = vi.hoisted(() => vi.fn());

vi.mock("@/lib/supabase/server", () => ({ getAuthUser }));
vi.mock("@/lib/quote-analysis/claim", () => ({ claimSealedQuote }));

import { POST } from "./route";

const USER = { id: "11111111-1111-4111-8111-111111111111", email: "person@example.com" };

function request(body: unknown) {
  return new Request("http://localhost/api/quote/claim", {
    method: "POST",
    headers: { origin: "http://localhost", "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/quote/claim", () => {
  beforeEach(() => {
    getAuthUser.mockReset();
    claimSealedQuote.mockReset();
  });

  it("requires a session and ignores any user id in the body", async () => {
    getAuthUser.mockResolvedValue(null);
    const denied = await POST(request({ sealed: "blob", userId: "99999999-9999-4999-8999-999999999999" }));
    expect(denied.status).toBe(401);
    expect(claimSealedQuote).not.toHaveBeenCalled();

    getAuthUser.mockResolvedValue(USER);
    claimSealedQuote.mockResolvedValue({ status: 200, body: { id: "22222222-2222-4222-8222-222222222222" } });
    const ok = await POST(request({ sealed: "blob", userId: "99999999-9999-4999-8999-999999999999" }));
    expect(ok.status).toBe(200);
    expect(claimSealedQuote).toHaveBeenCalledWith({ userId: USER.id, sealed: "blob" });
  });
});
