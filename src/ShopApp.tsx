import { Suspense, useEffect, useState } from "react";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { Toaster } from "@/components/ui/toaster";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { lazyWithRetry } from "@/lib/lazyWithRetry";
import { isCustomShopHostname } from "@/lib/leanShopPath";
import { captureAffiliateRefFromUrl } from "@/lib/affiliateRef";
import { ProductSkeleton } from "@/components/shop/ProductSkeleton";

/**
 * Application allégée pour les pages publiques de boutique (fiche produit, vitrine, confirmation).
 * C'est ce que reçoivent les visiteurs des publicités : voir `lib/leanShopPath.ts`.
 * Tout autre chemin recharge la page, et `main.tsx` charge alors le site complet.
 */
const ShopView = lazyWithRetry(() => import("./pages/ShopView"));
const ProductView = lazyWithRetry(() => import("./pages/ProductView"));
const OrderConfirmed = lazyWithRetry(() => import("./pages/OrderConfirmed"));
const DigitalDownload = lazyWithRetry(() => import("./pages/DigitalDownload"));
const ShopSessionExtras = lazyWithRetry(() => import("./ShopSessionExtras"));

const isCustomShopHost = isCustomShopHostname(
  typeof window !== "undefined" ? window.location.hostname : "",
  import.meta.env.DEV
);

const Blank = () => <div className="min-h-screen bg-white" />;

/**
 * Pendant le téléchargement du code de la page : le squelette de la fiche produit (le même que pendant le chargement
 * de la fiche, pour qu'il n'y ait aucun saut), un écran blanc ailleurs.
 */
const RouteFallback = () => {
  const { pathname } = useLocation();
  return /^\/shop\/[^/]+\/(p\/[^/]+|product)\/?$/.test(pathname) ? <ProductSkeleton /> : <Blank />;
};

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
          <Suspense fallback={<RouteFallback />}>
            <Routes>
              <Route path="/" element={isCustomShopHost ? <ShopView /> : <LeaveToFullApp />} />
              <Route path="/shop/:slug" element={<ShopView />} />
              <Route path="/shop/:slug/product" element={<ProductView />} />
              <Route path="/shop/:slug/p/:productSlug" element={<ProductView />} />
              <Route path="/order-confirmed" element={<OrderConfirmed />} />
              <Route path="/telechargement" element={<DigitalDownload />} />
              <Route path="/telechargement/:token" element={<DigitalDownload />} />
              <Route path="*" element={<LeaveToFullApp />} />
            </Routes>
          </Suspense>
        </main>
      </BrowserRouter>
    </ThemeProvider>
  </ErrorBoundary>
);

export default ShopApp;
