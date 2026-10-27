import { Component, Suspense, type ReactNode } from "react";
import { getShopTheme } from "./registry";
import { buildShopThemeData } from "./dataAdapter";

class ThemeErrorBoundary extends Component<{ children: ReactNode; embedded?: boolean }, { hasError: boolean }> {
  state = { hasError: false };
  static getDerivedStateFromError() { return { hasError: true }; }
  componentDidCatch(err: any) {
    console.error("[ShopThemeRenderer] crashed → falling back to classic", err);
    // Aperçu dans le tableau de bord : on ne recharge pas la page du marchand (il perdrait ses réglages non enregistrés).
    if (this.props.embedded) return;
    try {
      const url = new URL(window.location.href);
      url.searchParams.set("classic", "1");
      window.location.replace(url.toString());
    } catch {}
  }
  render() {
    if (!this.state.hasError) return this.props.children;
    if (this.props.embedded) {
      return (
        <div className="min-h-[240px] flex items-center justify-center p-6 text-center text-sm text-muted-foreground">
          Impossible d'afficher l'aperçu de ce thème pour le moment.
        </div>
      );
    }
    return null;
  }
}

export function ShopThemeRenderer({
  themeSlug,
  shop,
  products,
  customSettings,
  embedded = false,
}: {
  themeSlug: string;
  shop: any;
  products: any[];
  customSettings?: Record<string, any> | null;
  /** Aperçu intégré au tableau de bord : une erreur d'affichage reste locale au lieu de recharger la page. */
  embedded?: boolean;
}) {
  const entry = getShopTheme(themeSlug);
  if (!entry) return null;
  const data = buildShopThemeData({ shop, products, customSettings });
  const Theme = entry.Component;
  return (
    <ThemeErrorBoundary embedded={embedded}>
      <Suspense fallback={<div className="min-h-screen flex items-center justify-center text-sm text-muted-foreground">Chargement du thème…</div>}>
        <Theme data={data} />
      </Suspense>
    </ThemeErrorBoundary>
  );
}