import { describe, expect, it } from "vitest";
import { assertNotProdDbOutsideProd, PROD_SUPABASE_PROJECT_REF } from "./db-guard";

const PROD_URL = `https://${PROD_SUPABASE_PROJECT_REF}.supabase.co`;

describe("assertNotProdDbOutsideProd", () => {
  it("throws refusing_prod_db when the prod host is used outside production", () => {
    expect(() =>
      assertNotProdDbOutsideProd({
        NEXT_PUBLIC_SUPABASE_URL: PROD_URL,
        VERCEL_ENV: "preview",
      }),
    ).toThrow("refusing_prod_db");

    expect(() =>
      assertNotProdDbOutsideProd({
        SUPABASE_URL: PROD_URL,
        VERCEL_ENV: undefined,
      }),
    ).toThrow("refusing_prod_db");
  });

  it("allows the prod host only when VERCEL_ENV is production", () => {
    expect(() =>
      assertNotProdDbOutsideProd({
        NEXT_PUBLIC_SUPABASE_URL: PROD_URL,
        VERCEL_ENV: "production",
      }),
    ).not.toThrow();
  });

  it("allows a non-prod host when VERCEL_ENV is unset", () => {
    expect(() =>
      assertNotProdDbOutsideProd({
        NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321",
        VERCEL_ENV: undefined,
      }),
    ).not.toThrow();
  });
});
