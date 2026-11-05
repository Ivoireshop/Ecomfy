import { Suspense, useEffect, useState } from "react";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { Toaster } from "@/components/ui/toaster";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { lazyWithRetry } from "@/lib/lazyWithRetry";
import { isCustomShopHostname } from "@/lib/leanShopPath";
import { captureAffiliateRefFromUrl } from "@/lib/affiliateRef";

/**
 * Application allégée pour les pages publiques de boutique (fiche produit, vitrine, confirmation).
 * C'est ce que reçoivent les visiteurs des publicités : voir `lib/leanShopPath.ts`.
 * Tout autre chemin recharge la page, et `main.tsx` charge alors le site complet.
 */
const ShopView = lazyWithRetry(() => import("./pages/ShopView"));
const ProductView = lazyWithRetry(() => import("./pages/ProductView"));
const OrderConfirmed = lazyWithRetry(() => import("./pages/OrderConfirmed"));
const ShopSessionExtras = lazyWithRetry(() => import("./ShopSessionExtras"));

const isCustomShopHost = isCustomShopHostname(
  typeof window !== "undefined" ? window.location.hostname : "",
  import.meta.env.DEV
);

const Blank = () => <div className="min-h-screen bg-white" />;

/** Chemin hors boutique (ex. lien « /auth » d'une page d'accueil personnalisée) : le site complet prend le relais. */
const LeaveToFullApp = () => {
  const location = useLocation();
  useEffect(() => {
    window.location.replace(`${location.pathname}${location.search}${location.hash}`);
  }, [location.pathname, location.search, location.hash]);
  return <Blank />;
};

const hasStoredSession = () => {
  try {
    return !!localStorage.getItem("ecomfy-auth-token");
  } catch {
    return false;
  }
};

/** Notifications du marchand connecté, chargées après l'affichage et seulement s'il y a une session. */
const SessionExtras = () => {
  const [enabled, setEnabled] = useState(false);
  useEffect(() => {
    if (!hasStoredSession()) return;
    const t = setTimeout(() => setEnabled(true), 3000);
    return () => clearTimeout(t);
  }, []);
  if (!enabled) return null;
  return (
    <Suspense fallback={null}>
      <ShopSessionExtras />
    </Suspense>
  );
};

const AffiliateRefCapture = () => {
  useEffect(() => {
    captureAffiliateRefFromUrl();
  }, []);
  return null;
};

const ShopApp = () => (
  <ErrorBoundary>
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
      <Toaster />
      <BrowserRouter>
        <AffiliateRefCapture />
        <SessionExtras />
        <main className="w-full">
          <Suspense fallback={<Blank />}>
            <Routes>
              <Route path="/" element={isCustomShopHost ? <ShopView /> : <LeaveToFullApp />} />
              <Route path="/shop/:slug" element={<ShopView />} />
              <Route path="/shop/:slug/product" element={<ProductView />} />
              <Route path="/shop/:slug/p/:productSlug" element={<ProductView />} />
              <Route path="/order-confirmed" element={<OrderConfirmed />} />
              <Route path="*" element={<LeaveToFullApp />} />
            </Routes>
          </Suspense>
        </main>
      </BrowserRouter>
    </ThemeProvider>
  </ErrorBoundary>
);

export default ShopApp;
