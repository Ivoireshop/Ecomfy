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

// Eager load: landing only (critical path)
import Index from "./pages/Index";

// Lazy load all other pages
const Auth = lazy(() => import("./pages/Auth"));
const Generator = lazy(() => import("./pages/Generator"));
const Library = lazy(() => import("./pages/Library"));
const Subscription = lazy(() => import("./pages/Subscription"));
const Feedback = lazy(() => import("./pages/Feedback"));
const NotFound = lazy(() => import("./pages/NotFound"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const VerifyEmail = lazy(() => import("./pages/VerifyEmail"));
const ShowcaseBuilder = lazy(() => import("./pages/ShowcaseBuilder"));
const ShowcaseView = lazy(() => import("./pages/ShowcaseView"));
const ShowcaseManager = lazy(() => import("./pages/ShowcaseManager"));
const ShowcaseEditor = lazy(() => import("./pages/ShowcaseEditor"));
const PaymentHistory = lazy(() => import("./pages/PaymentHistory"));
const PromoCodeManager = lazy(() => import("./pages/PromoCodeManager"));
const FounderDashboard = lazy(() => import("./pages/FounderDashboard"));
const FounderTroubleshooting = lazy(() => import("./pages/FounderTroubleshooting"));
const Referral = lazy(() => import("./pages/Referral"));
const Tutorial = lazy(() => import("./pages/Tutorial"));
const Demo = lazy(() => import("./pages/Demo"));
const StudentDashboard = lazy(() => import("./pages/StudentDashboard"));
const StudentCourse = lazy(() => import("./pages/StudentCourse"));
const StudentCertificates = lazy(() => import("./pages/StudentCertificates"));
const EnrollmentCheckout = lazy(() => import("./pages/EnrollmentCheckout"));
const PaymentSuccess = lazy(() => import("./pages/PaymentSuccess"));
const VerifyCertificate = lazy(() => import("./pages/VerifyCertificate"));
const PrivacyPolicy = lazy(() => import("./pages/PrivacyPolicy"));
const TermsOfService = lazy(() => import("./pages/TermsOfService"));
const CookiesPolicy = lazy(() => import("./pages/CookiesPolicy"));
const ApiDocumentation = lazy(() => import("./pages/ApiDocumentation"));
const Blog = lazy(() => import("./pages/Blog"));
const LegalNotice = lazy(() => import("./pages/LegalNotice"));
const ShopManager = lazy(() => import("./pages/ShopManager"));
const ShopBuilder = lazy(() => import("./pages/ShopBuilder"));
const ShopEditor = lazy(() => import("./pages/ShopEditor"));
const ShopView = lazy(() => import("./pages/ShopView"));
const ProductView = lazy(() => import("./pages/ProductView"));
const ProtectedRoute = lazy(() => import("./components/ProtectedRoute"));
const CoursesManager = lazy(() => import("./pages/CoursesManager"));
const OrderConfirmed = lazy(() => import("./pages/OrderConfirmed"));
const Unsubscribe = lazy(() => import("./pages/Unsubscribe"));
const VisuelsPublicitaires = lazy(() => import("./pages/VisuelsPublicitaires"));
const VideosPublicitaires = lazy(() => import("./pages/VideosPublicitaires"));
const SitesVitrines = lazy(() => import("./pages/SitesVitrines"));
const BoutiquesEcommerce = lazy(() => import("./pages/BoutiquesEcommerce"));
const VideoCreator = lazy(() => import("./pages/VideoCreator"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const OrdersDiagnostic = lazy(() => import("./pages/OrdersDiagnostic"));
const AcceptShopInvite = lazy(() => import("./pages/AcceptShopInvite"));
const Documentation = lazy(() => import("./pages/Documentation"));

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
          <Route path="/sites-vitrines" element={<SitesVitrines />} />
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
            path="/showcase-builder"
            element={
              <ProtectedRoute requireActiveSubscription>
                <ShowcaseBuilder />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/showcase-manager" 
            element={
              <ProtectedRoute>
                <ShowcaseManager />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/showcase-editor/:id" 
            element={
              <ProtectedRoute>
                <ShowcaseEditor />
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
            path="/orders-diagnostic"
            element={
              <ProtectedRoute>
                <OrdersDiagnostic />
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
          <Route path="/api-documentation" element={<ApiDocumentation />} />
          <Route path="/blog" element={<Blog />} />
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
          <Route path="/docs" element={<ProtectedRoute><Documentation /></ProtectedRoute>} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
    </div>
  );
};

const PUBLIC_PAGES = ["/", "/auth", "/reset-password", "/privacy-policy", "/terms-of-service", "/cookies-policy", "/api-documentation", "/blog", "/legal-notice", "/visuels-publicitaires", "/videos-publicitaires", "/sites-vitrines", "/boutiques-ecommerce", "/demo", "/tutorial"];

// Prefetch heavy authenticated chunks during idle time so the first
// in-dashboard navigation is instant. No-op on slow connections / save-data.
const IdlePrefetcher = () => {
  useEffect(() => {
    if (typeof window === "undefined") return;
    const conn = (navigator as any).connection;
    if (conn?.saveData) return;
    if (conn?.effectiveType && /^(2g|slow-2g)$/.test(conn.effectiveType)) return;

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
