import { NextResponse } from "next/server";
import { isSupabaseAdminConfigured } from "@/lib/supabase/admin";
import { isLlmConfigured, llmProviderLabel } from "@/lib/llm-model";
import {
  isWebSearchConfigured,
  resolveWebSearchProvider,
} from "@/lib/search-provider";

export function GET() {
  const supabaseAdmin = isSupabaseAdminConfigured();
  const serpConfigured = isWebSearchConfigured();
  const webSearchProvider = resolveWebSearchProvider();
  const llmConfigured = isLlmConfigured();

  return NextResponse.json({
    ok: true,
    supabaseAdmin,
    serpConfigured,
    ...(webSearchProvider ? { webSearchProvider } : {}),
    llmConfigured,
    ...(llmConfigured ? { llmProvider: llmProviderLabel() } : {}),
    ...(supabaseAdmin
      ? {}
      : {
          hint:
            "Set NEXT_PUBLIC_SUPABASE_URL (or SUPABASE_URL) and SUPABASE_SERVICE_ROLE_KEY in .env.local",
        }),
  });
}
