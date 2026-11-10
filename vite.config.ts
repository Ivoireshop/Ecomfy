import { defineConfig, loadEnv, type Plugin } from "vite";
import type { OutputChunk } from "rollup";
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

/**
 * Préchargement du code de la fiche produit, dès le <head>.
 *
 * Sans cela, le navigateur télécharge d'abord le point d'entrée, l'exécute (≈ 0,5 s de plus sur un téléphone d'entrée de
 * gamme), puis seulement découvre `ProductView` et ses ~50 modules. En listant ces fichiers dans le <head>, ils partent
 * en même temps que la requête de la fiche. Le script ne fait rien hors des URL de fiche produit : les autres pages
 * (tableau de bord, accueil) ne téléchargent rien en plus.
 *
 * La liste est calculée au build à partir des vrais fichiers générés (noms avec empreinte), jamais écrite à la main.
 * Son chemin de détection répète `getLeanShopKind` (src/lib/leanShopPath.ts) pour les fiches produit.
 */
function preloadProductChunks(): Plugin {
  return {
    name: "ecomfy-preload-product-chunks",
    transformIndexHtml: {
      order: "post",
      handler(html, ctx) {
        const bundle = ctx.bundle;
        if (!bundle) return html; // serveur de développement : rien à préchauffer
        const chunks = Object.values(bundle).filter((c): c is OutputChunk => c.type === "chunk");
        const byFile = new Map(chunks.map((c) => [c.fileName, c]));
        const facade = (suffix: string) =>
          chunks.find((c) => c.facadeModuleId && c.facadeModuleId.replace(/\\/g, "/").endsWith(suffix));
        const closure = (start: OutputChunk | undefined, into: Set<string>) => {
          const walk = (file: string) => {
            if (into.has(file)) return;
            const chunk = byFile.get(file);
            if (!chunk) return;
            into.add(file);
            chunk.imports.forEach(walk);
          };
          if (start) walk(start.fileName);
        };
        const entry = chunks.find((c) => c.isEntry && c.facadeModuleId?.replace(/\\/g, "/").endsWith("/index.html"));
        const alreadyPreloaded = new Set<string>();
        closure(entry, alreadyPreloaded); // déjà préchargé par Vite lui-même
        const wanted = new Set<string>();
        closure(facade("src/pages/ProductView.tsx"), wanted);
        closure(facade("src/boot/bootShop.tsx"), wanted);
        const files = [...wanted].filter((f) => !alreadyPreloaded.has(f));
        if (files.length === 0) return html;
        const script =
          `(function(){try{var p=location.pathname;` +
          `if(!/^\\/shop\\/[^\\/]+\\/p\\/[^\\/?#]+/.test(p)&&!/^\\/shop\\/[^\\/]+\\/product\\/?$/.test(p))return;` +
          `var f=${JSON.stringify(files.map((f) => `/${f}`))};` +
          `for(var i=0;i<f.length;i++){var l=document.createElement("link");l.rel="modulepreload";l.crossOrigin="";l.href=f[i];document.head.appendChild(l);}` +
          `}catch(e){}})();`;
        // « head-prepend » : un script placé après la feuille de style attendrait la fin de son téléchargement.
        return [{ tag: "script", children: script, injectTo: "head-prepend" as const }];
      },
    },
  };
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
    preloadProductChunks(),
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
