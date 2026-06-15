import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { ThemeProvider } from "next-themes";
import { SupportButton } from "@/components/SupportButton";
import { BackButton } from "@/components/BackButton";
import { MobileBottomNav } from "@/components/MobileBottomNav";
import { useLocation } from "react-router-dom";
import { lazy, Suspense, useEffect } from "react";
import { useCommunityNotifications } from "@/hooks/useCommunityNotifications";

// Eager load: landing only (critical path)
import Index from "./pages/Index";

// Wrap lazy() so that a stale chunk (after a redeploy) doesn't leave the user
// on a blank screen. We retry once, and if it still fails we hard-reload the
// page so the browser fetches the new asset manifest.
const RELOAD_KEY = "__chunk_reload_attempted__";
const lazyWithRetry = <T extends { default: React.ComponentType<any> }>(
  factory: () => Promise<T>
) =>
  lazy(async () => {
    try {
      return await factory();
    } catch (err) {
      try {
        return await factory();
      } catch (err2) {
        if (typeof window !== "undefined") {
          const already = sessionStorage.getItem(RELOAD_KEY);
          if (!already) {
            sessionStorage.setItem(RELOAD_KEY, "1");
            window.location.reload();
            // Return a never-resolving promise to avoid Suspense throwing again.
            return new Promise<T>(() => {});
          }
        }
        throw err2;
      }
    }
  });

// Lazy load all other pages
const Auth = lazyWithRetry(() => import("./pages/Auth"));
const Generator = lazyWithRetry(() => import("./pages/Generator"));
const Library = lazyWithRetry(() => import("./pages/Library"));
const Subscription = lazyWithRetry(() => import("./pages/Subscription"));
const Feedback = lazyWithRetry(() => import("./pages/Feedback"));
const NotFound = lazyWithRetry(() => import("./pages/NotFound"));
const ResetPassword = lazyWithRetry(() => import("./pages/ResetPassword"));
const VerifyEmail = lazyWithRetry(() => import("./pages/VerifyEmail"));
const ShowcaseView = lazyWithRetry(() => import("./pages/ShowcaseView"));
const PaymentHistory = lazyWithRetry(() => import("./pages/PaymentHistory"));
const PromoCodeManager = lazyWithRetry(() => import("./pages/PromoCodeManager"));
const FounderDashboard = lazyWithRetry(() => import("./pages/FounderDashboard"));
const FounderTroubleshooting = lazyWithRetry(() => import("./pages/FounderTroubleshooting"));
const Referral = lazyWithRetry(() => import("./pages/Referral"));
const Tutorial = lazyWithRetry(() => import("./pages/Tutorial"));
const Demo = lazyWithRetry(() => import("./pages/Demo"));
const StudentDashboard = lazyWithRetry(() => import("./pages/StudentDashboard"));
const StudentCourse = lazyWithRetry(() => import("./pages/StudentCourse"));
const StudentCertificates = lazyWithRetry(() => import("./pages/StudentCertificates"));
const EnrollmentCheckout = lazyWithRetry(() => import("./pages/EnrollmentCheckout"));
const PaymentSuccess = lazyWithRetry(() => import("./pages/PaymentSuccess"));
const VerifyCertificate = lazyWithRetry(() => import("./pages/VerifyCertificate"));
const PrivacyPolicy = lazyWithRetry(() => import("./pages/PrivacyPolicy"));
const TermsOfService = lazyWithRetry(() => import("./pages/TermsOfService"));
const CookiesPolicy = lazyWithRetry(() => import("./pages/CookiesPolicy"));
const ApiDocumentation = lazyWithRetry(() => import("./pages/ApiDocumentation"));
const LegalNotice = lazyWithRetry(() => import("./pages/LegalNotice"));
const ShopManager = lazyWithRetry(() => import("./pages/ShopManager"));
const ShopBuilder = lazyWithRetry(() => import("./pages/ShopBuilder"));
const ShopEditor = lazyWithRetry(() => import("./pages/ShopEditor"));
const ShopView = lazyWithRetry(() => import("./pages/ShopView"));
const ProductView = lazyWithRetry(() => import("./pages/ProductView"));
const ProtectedRoute = lazyWithRetry(() => import("./components/ProtectedRoute"));
const CoursesManager = lazyWithRetry(() => import("./pages/CoursesManager"));
const OrderConfirmed = lazyWithRetry(() => import("./pages/OrderConfirmed"));
const Unsubscribe = lazyWithRetry(() => import("./pages/Unsubscribe"));
const VisuelsPublicitaires = lazyWithRetry(() => import("./pages/VisuelsPublicitaires"));
const VideosPublicitaires = lazyWithRetry(() => import("./pages/VideosPublicitaires"));
const BoutiquesEcommerce = lazyWithRetry(() => import("./pages/BoutiquesEcommerce"));
const Community = lazyWithRetry(() => import("./pages/Community"));
const VideoCreator = lazyWithRetry(() => import("./pages/VideoCreator"));
const Dashboard = lazyWithRetry(() => import("./pages/Dashboard"));
const AcceptShopInvite = lazyWithRetry(() => import("./pages/AcceptShopInvite"));
const Documentation = lazyWithRetry(() => import("./pages/Documentation"));
const Health = lazyWithRetry(() => import("./pages/Health"));
const AiQuota = lazyWithRetry(() => import("./pages/AiQuota"));
const Profile = lazyWithRetry(() => import("./pages/Profile"));
const DeliverySignup = lazyWithRetry(() => import("./pages/DeliverySignup"));
const DeliveryDashboard = lazyWithRetry(() => import("./pages/DeliveryDashboard"));
const FounderRoute = lazyWithRetry(() => import("./components/FounderRoute"));

// Detect when the visitor arrives via a custom shop domain. In that case the
// root path "/" should render the shop (resolved by hostname inside ShopView)
// instead of the marketing landing page.
const isCustomShopHost = (() => {
  if (typeof window === "undefined") return false;
  const host = window.location.hostname.toLowerCase().replace(/^www\./, "");
  const KNOWN = ["visuelpro.cloud", "localhost", "visualpro-african-ai-creations.lovable.app"];
  if (KNOWN.includes(host)) return false;
  if (host.endsWith(".lovable.app") || host.endsWith(".lovable.dev") || host.endsWith(".lovableproject.com")) return false;
  return true;
})();

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Conservative caching: avoids redundant refetches across the dashboard
      // without changing any UI or business logic. Pages still refetch on mount
      // when stale (60s) and keep data in memory for 5 min.
      staleTime: 60 * 1000,
      gcTime: 5 * 60 * 1000,
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

const PageLoader = () => (
  <div className="flex items-center justify-center min-h-screen">
    <div className="flex flex-col items-center gap-4">
      <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      <p className="text-sm text-muted-foreground">Chargement...</p>
    </div>
  </div>
);

const AppContent = () => {
  const location = useLocation();
  useCommunityNotifications();
  const isShowcaseView = location.pathname.startsWith("/showcase/");
  const isShopView = location.pathname.startsWith("/shop/") || location.pathname.startsWith("/shop-preview/") || (isCustomShopHost && location.pathname === "/");
  const isOrderConfirmed = location.pathname.startsWith("/order-confirmed");
  const isPublicPage = PUBLIC_PAGES.includes(location.pathname) || isOrderConfirmed;
  const showSidebar = !isPublicPage && !isShowcaseView && !isShopView;
  const showSupport = !isPublicPage && !isShowcaseView && !isShopView;
  const hideChrome = isShopView || isOrderConfirmed;

  return (
    <div className={hideChrome ? "" : "pb-16 md:pb-0"}>
      {!hideChrome && <BackButton />}
      {showSupport && <SupportButton />}
      {!isOrderConfirmed && <MobileBottomNav />}
      <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route path="/" element={isCustomShopHost ? <ShopView /> : <Index />} />
          <Route path="/auth" element={<Auth />} />
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            }
          />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/unsubscribe" element={<Unsubscribe />} />
          <Route path="/visuels-publicitaires" element={<VisuelsPublicitaires />} />
          <Route path="/videos-publicitaires" element={<VideosPublicitaires />} />
          <Route path="/boutiques-ecommerce" element={<BoutiquesEcommerce />} />
          <Route
            path="/subscription" 
            element={
              <ProtectedRoute>
                <Subscription />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/generator" 
            element={
              <ProtectedRoute requireActiveSubscription>
                <Generator />
              </ProtectedRoute>
            } 
          />
          <Route
            path="/video-creator"
            element={
              <ProtectedRoute requireActiveSubscription>
                <VideoCreator />
              </ProtectedRoute>
            }
          />
          <Route 
            path="/library" 
            element={
              <ProtectedRoute>
                <Library />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/feedback" 
            element={
              <ProtectedRoute>
                <Feedback />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/payment-history" 
            element={
              <ProtectedRoute>
                <PaymentHistory />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/promo-codes" 
            element={
              <ProtectedRoute>
                <PromoCodeManager />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/founder-dashboard" 
            element={
              <ProtectedRoute>
                <FounderDashboard />
              </ProtectedRoute>
            } 
          />
          <Route
            path="/founder-troubleshooting"
            element={
              <ProtectedRoute>
                <FounderTroubleshooting />
              </ProtectedRoute>
            }
          />
          <Route 
            path="/referral" 
            element={
              <ProtectedRoute>
                <Referral />
              </ProtectedRoute>
            } 
          />
          <Route
            path="/ai-quota"
            element={
              <ProtectedRoute>
                <AiQuota />
              </ProtectedRoute>
            }
          />
          <Route 
            path="/tutorial" 
            element={<Tutorial />} 
          />
          <Route 
            path="/demo" 
            element={<Demo />} 
          />
          <Route path="/showcase/:subdomain" element={<ShowcaseView />} />
          <Route path="/showcase/:subdomain/:page" element={<ShowcaseView />} />
          <Route path="/enroll/:courseId" element={<EnrollmentCheckout />} />
          <Route path="/payment-success" element={<PaymentSuccess />} />
          <Route 
            path="/student" 
            element={
              <ProtectedRoute>
                <StudentDashboard />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/student/course/:courseId" 
            element={
              <ProtectedRoute>
                <StudentCourse />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/student/certificates" 
            element={
              <ProtectedRoute>
                <StudentCertificates />
              </ProtectedRoute>
            } 
          />
          <Route path="/verify-certificate/:certificateNumber?" element={<VerifyCertificate />} />
          <Route path="/privacy-policy" element={<PrivacyPolicy />} />
          <Route path="/terms-of-service" element={<TermsOfService />} />
          <Route path="/cookies-policy" element={<CookiesPolicy />} />
          <Route path="/api-documentation" element={<FounderRoute><ApiDocumentation /></FounderRoute>} />
          <Route path="/legal-notice" element={<LegalNotice />} />
          <Route path="/shop-manager" element={<ProtectedRoute><ShopManager /></ProtectedRoute>} />
          <Route path="/courses-manager" element={<ProtectedRoute><CoursesManager /></ProtectedRoute>} />
          <Route path="/shop-builder" element={<ProtectedRoute><ShopBuilder /></ProtectedRoute>} />
          <Route path="/shop-editor/:id" element={<ProtectedRoute><ShopEditor /></ProtectedRoute>} />
          <Route path="/shop-preview/:id" element={<ProtectedRoute><ShopView /></ProtectedRoute>} />
          <Route path="/shop/:slug" element={<ShopView />} />
          <Route path="/shop-preview/:id/product" element={<ProtectedRoute><ProductView /></ProtectedRoute>} />
          <Route path="/shop/:slug/product" element={<ProductView /> } />
          {/* Clean shareable product URLs (e.g. /shop/ma-boutique/p/mon-produit) */}
          <Route path="/shop-preview/:id/p/:productSlug" element={<ProtectedRoute><ProductView /></ProtectedRoute>} />
          <Route path="/shop/:slug/p/:productSlug" element={<ProductView /> } />
          <Route path="/order-confirmed" element={<OrderConfirmed />} />
          <Route path="/accept-shop-invite" element={<AcceptShopInvite />} />
          <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
          <Route path="/community" element={<ProtectedRoute><Community /></ProtectedRoute>} />
          <Route path="/delivery-signup" element={<ProtectedRoute><DeliverySignup /></ProtectedRoute>} />
          <Route path="/delivery-dashboard" element={<ProtectedRoute><DeliveryDashboard /></ProtectedRoute>} />
          <Route path="/docs" element={<FounderRoute><Documentation /></FounderRoute>} />
          <Route path="/health" element={<Health />} />
          <Route path="/healthz" element={<Health />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
    </div>
  );
};

const PUBLIC_PAGES = ["/", "/auth", "/reset-password", "/privacy-policy", "/terms-of-service", "/cookies-policy", "/api-documentation", "/legal-notice", "/visuels-publicitaires", "/videos-publicitaires", "/boutiques-ecommerce", "/demo", "/tutorial", "/health", "/healthz"];

// Prefetch heavy authenticated chunks during idle time so the first
// in-dashboard navigation is instant. No-op on slow connections / save-data.
const IdlePrefetcher = () => {
  useEffect(() => {
    if (typeof window === "undefined") return;
    const conn = (navigator as any).connection;
    if (conn?.saveData) return;
    if (conn?.effectiveType && /^(2g|slow-2g)$/.test(conn.effectiveType)) return;
    // Don't prefetch the authenticated dashboard chunks on public e-commerce
    // landings — that traffic typically comes from ads and must stay light.
    const p = window.location.pathname;
    const onShop =
      p.startsWith("/shop/") ||
      p.startsWith("/shop-preview/") ||
      p.startsWith("/order-confirmed") ||
      isCustomShopHost;
    if (onShop) return;

    const run = () => {
      import("./pages/Dashboard");
      import("./pages/Library");
      import("./pages/Generator");
      import("./pages/ShopManager");
      import("./components/ProtectedRoute");
    };
    const ric = (window as any).requestIdleCallback as
      | ((cb: () => void, opts?: { timeout: number }) => number)
      | undefined;
    if (ric) ric(run, { timeout: 3000 });
    else setTimeout(run, 2000);
  }, []);
  return null;
};

const AppWithSidebar = () => {
  const location = useLocation();
  const isShowcaseView = location.pathname.startsWith("/showcase/");
  const isShopView = location.pathname.startsWith("/shop/") || location.pathname.startsWith("/shop-preview/") || (isCustomShopHost && location.pathname === "/");
  const isOrderConfirmed = location.pathname.startsWith("/order-confirmed");
  const isPublicPage = PUBLIC_PAGES.includes(location.pathname) || isOrderConfirmed;

  // Showcase/shop/public pages: no sidebar at all
  if (isShowcaseView || isShopView || isPublicPage) {
    return (
      <main className="w-full">
        <AppContent />
      </main>
    );
  }

  // Authenticated dashboard pages: with sidebar
  return (
    <SidebarProvider defaultOpen={false}>
      <div className="flex min-h-screen w-full">
        <AppSidebar />
        <main className="flex-1">
          <AppContent />
        </main>
      </div>
    </SidebarProvider>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <IdlePrefetcher />
          <AppWithSidebar />
        </BrowserRouter>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
