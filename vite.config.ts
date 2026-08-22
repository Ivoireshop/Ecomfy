import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { VitePWA } from "vite-plugin-pwa";

// https://vitejs.dev/config/
export default defineConfig(() => ({
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
      cleanupOutdatedCaches: true,
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
}));
