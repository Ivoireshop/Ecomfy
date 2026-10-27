import { defineConfig } from "vitest/config";
import path from "path";

// Configuration volontairement séparée de vite.config.ts : les tests n'ont besoin ni du plugin PWA
// ni de la vérification des variables Supabase exigée par le build.
export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "supabase/tests/**/*.test.ts"],
    coverage: {
      provider: "v8",
      include: ["src/lib/**", "src/services/**", "supabase/functions/_shared/**"],
    },
  },
});
