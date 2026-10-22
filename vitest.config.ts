import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    // 唔好加 globalSetup 或者喺 config 讀 Supabase key；主 process 冇清 env。
    setupFiles: ["src/test/strip-secret-env.ts"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "server-only": path.resolve(
        __dirname,
        "node_modules/next/dist/compiled/server-only/empty.js",
      ),
    },
  },
});
