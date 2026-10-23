import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { deleteAccountAndAnalyses } from "@/lib/auth/delete-account";

const USER = "11111111-1111-4111-8111-111111111111";

function admin(options?: { failTable?: string }) {
  const tables: string[] = [];
  const deleteUser = vi.fn(async () => ({ data: { user: null }, error: null }));
  const client = {
    from(table: string) {
      tables.push(table);
      return {
        delete() {
          return {
            eq: async () => ({
              error: options?.failTable === table ? { message: "no" } : null,
            }),
          };
        },
      };
    },
    auth: { admin: { deleteUser } },
  };
  return { client: client as unknown as SupabaseClient, tables, deleteUser };
}

describe("delete account", () => {
  it("deletes quote rows and then the auth user", async () => {
    const { client, tables, deleteUser } = admin();
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    await expect(deleteAccountAndAnalyses(client, USER)).resolves.toBe(true);
    expect(tables).toEqual(["quote_analysis_claims", "quote_analyses"]);
    expect(deleteUser).toHaveBeenCalledWith(USER);
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it("does not delete the auth user when quote rows cannot be removed", async () => {
    const { client, deleteUser } = admin({ failTable: "quote_analyses" });
    await expect(deleteAccountAndAnalyses(client, USER)).resolves.toBe(false);
    expect(deleteUser).not.toHaveBeenCalled();
  });
});
