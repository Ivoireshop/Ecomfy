import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { mcpPlugin } from "@lovable.dev/mcp-js/stacks/supabase/vite";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [react(), mcpPlugin(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  define: {
    __BUILD_ID__: JSON.stringify(
      process.env.COMMIT_SHA ||
        process.env.VERCEL_GIT_COMMIT_SHA ||
        process.env.SOURCE_VERSION ||
        `dev-${Date.now()}`
    ),
    __BUILD_TIME__: JSON.stringify(new Date().toISOString()),
  },
  build: {
    target: "es2020",
    cssCodeSplit: true,
    sourcemap: false,
    chunkSizeWarningLimit: 1000,
  },
}));
