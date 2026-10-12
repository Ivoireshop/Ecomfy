import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { VitePWA } from "vite-plugin-pwa";

// Variables indispensables au build : sans elles, src/integrations/supabase/client.ts
// retombe silencieusement sur "dummy.supabase.co" et le site déployé ne fonctionne plus.
const REQUIRED_ENV = ["VITE_SUPABASE_URL", "VITE_SUPABASE_PUBLISHABLE_KEY"] as const;

function assertBuildEnv(mode: string) {
  // loadEnv fusionne les fichiers .env et process.env (variables Vercel comprises).
  const env = loadEnv(mode, process.cwd(), "VITE_");
  const problems = REQUIRED_ENV.filter((k) => !env[k]?.trim()).map((k) => `${k} est manquante`);
  if (env.VITE_SUPABASE_URL && !/^https:\/\/[a-z0-9]+\.supabase\.co\/?$/.test(env.VITE_SUPABASE_URL.trim())) {
    problems.push(`VITE_SUPABASE_URL invalide : ${env.VITE_SUPABASE_URL}`);
  }
  if (problems.length) {
    throw new Error(
      "Build interrompu, configuration Supabase incomplète :\n - " +
        problems.join("\n - ") +
        "\nDéfinissez ces variables dans Vercel (Settings > Environment Variables) ou dans votre .env local (voir .env.example)."
    );
  }
}

// https://vitejs.dev/config/
export default defineConfig(({ command, mode }) => {
  if (command === "build") assertBuildEnv(mode);
  return {
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [
    react(),
    VitePWA({
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.js',
      injectRegister: 'auto',
      registerType: 'autoUpdate',
      manifest: false, // We're using the existing manifest.webmanifest in public/
      injectManifest: {
        maximumFileSizeToCacheInBytes: 5000000,
        globPatterns: ['**/*.{js,css,ico,png,svg,woff2,ttf,eot,json}']
      },
      devOptions: {
        enabled: false,
        type: 'module'
      }
    })
  ].filter(Boolean),
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
};
});
