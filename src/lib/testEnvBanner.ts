// Bandeau « MODE TEST » : signale sur toutes les pages qu'on est sur un serveur d'essai.
// Écrit sans React pour couvrir les deux applications (complète et boutique allégée), écrans d'erreur compris.
// La mise en page associée est dans src/index.css (classe `test-env`) : sans elle, la production ne change pas.

export const TEST_TITLE_PREFIX = "[TEST] ";

/** Vrai pour le build du VPS de test (`npm run build:vps`) ou si VITE_APP_ENV=test. */
export const isTestEnvironment = (mode: string, appEnv?: string): boolean =>
  mode === "vps" || appEnv?.trim().toLowerCase() === "test";

export const withTestPrefix = (title: string): string =>
  title.startsWith(TEST_TITLE_PREFIX) ? title : TEST_TITLE_PREFIX + title;

const text = (className: string, content: string): HTMLSpanElement => {
  const span = document.createElement("span");
  span.className = className;
  span.textContent = content;
  return span;
};

export function installTestEnvBanner(): void {
  document.documentElement.classList.add("test-env");

  const banner = document.createElement("div");
  banner.className = "env-banner";
  banner.setAttribute("role", "note");
  banner.setAttribute("translate", "no");
  banner.append(
    text("env-banner-icon", "🧪"),
    text("env-banner-short", "MODE TEST"),
    text("env-banner-long", "MODE TEST : environnement d'essai, ne pas utiliser avec de vrais clients"),
  );
  document.body.prepend(banner);

  // Les pages changent le titre de l'onglet à la navigation : on remet le préfixe à chaque fois.
  const prefixTitle = () => {
    const next = withTestPrefix(document.title);
    if (next !== document.title) document.title = next;
  };
  prefixTitle();
  new MutationObserver(prefixTitle).observe(document.head, { childList: true, subtree: true, characterData: true });
}
