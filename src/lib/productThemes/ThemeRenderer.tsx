import React, { Suspense } from "react";
import { buildThemeData } from "./dataAdapter";
import { THEME_REGISTRY, isKnownTheme } from "./registry";
import type { ProductAudio, ProductThemeSettings } from "@/lib/productAppearance";

interface Props {
  product: any;
  shop: any;
  audios: ProductAudio[];
  settings: ProductThemeSettings | null;
  fallback: React.ReactNode;
  onCheckout?: () => void;
}

class ThemeErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false };
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch(err: unknown) {
    // eslint-disable-next-line no-console
    console.warn("[ThemeRenderer] theme crashed, reloading classic view", err);
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      url.searchParams.set("classic", "1");
      window.location.replace(url.toString());
    }
  }
  render() {
    if (this.state.hasError) {
      return <div className="min-h-screen bg-white" />;
    }
    return <>{this.props.children}</>;
  }
}

export default function ThemeRenderer({ product, shop, audios, settings, fallback, onCheckout }: Props) {
  const slug = settings?.theme_slug || null;

  // Force classic render: query ?classic=1 or no theme selected
  const force = typeof window !== "undefined" && new URLSearchParams(window.location.search).get("classic") === "1";
  if (force || !isKnownTheme(slug)) return <>{fallback}</>;

  const Theme = THEME_REGISTRY[slug].component;
  const data = buildThemeData({ product, shop, audios, settings });

  void fallback;
  return (
    <ThemeErrorBoundary>
      <Suspense fallback={<div className="min-h-screen bg-white" />}>
        <Theme data={data} onCheckout={onCheckout} />
      </Suspense>
    </ThemeErrorBoundary>
  );
}