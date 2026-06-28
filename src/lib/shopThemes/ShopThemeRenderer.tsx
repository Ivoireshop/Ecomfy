import { Component, Suspense, type ReactNode } from "react";
import { getShopTheme } from "./registry";
import { buildShopThemeData } from "./dataAdapter";

class ThemeErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean }> {
  state = { hasError: false };
  static getDerivedStateFromError() { return { hasError: true }; }
  componentDidCatch(err: any) {
    console.error("[ShopThemeRenderer] crashed → falling back to classic", err);
    try {
      const url = new URL(window.location.href);
      url.searchParams.set("classic", "1");
      window.location.replace(url.toString());
    } catch {}
  }
  render() { return this.state.hasError ? null : this.props.children; }
}

export function ShopThemeRenderer({
  themeSlug,
  shop,
  products,
  customSettings,
}: {
  themeSlug: string;
  shop: any;
  products: any[];
  customSettings?: Record<string, any> | null;
}) {
  const entry = getShopTheme(themeSlug);
  if (!entry) return null;
  const data = buildShopThemeData({ shop, products, customSettings });
  const Theme = entry.Component;
  return (
    <ThemeErrorBoundary>
      <Suspense fallback={<div className="min-h-screen flex items-center justify-center text-sm text-muted-foreground">Chargement du thème…</div>}>
        <Theme data={data} />
      </Suspense>
    </ThemeErrorBoundary>
  );
}