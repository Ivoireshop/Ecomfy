import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useLocation, useNavigate } from "react-router-dom";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { ThemeProvider } from "next-themes";
import { SupportButton } from "@/components/SupportButton";
import { MobileBottomNav } from "@/components/MobileBottomNav";
import { lazy, Suspense, useEffect } from "react";
import { useCommunityNotifications } from "@/hooks/useCommunityNotifications";
import { useOrderNotifications } from "@/hooks/useOrderNotifications";
import { useNativePush } from "@/hooks/useNativePush";
import { useWebPush } from "@/hooks/useWebPush";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

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
const Studio = lazyWithRetry(() => import("./pages/Studio"));
const Library = lazyWithRetry(() => import("./pages/Library"));
const Subscription = lazyWithRetry(() => import("./pages/Subscription"));
const Feedback = lazyWithRetry(() => import("./pages/Feedback"));
const NotFound = lazyWithRetry(() => import("./pages/NotFound"));
const ResetPassword = lazyWithRetry(() => import("./pages/ResetPassword"));
const VerifyEmail = lazyWithRetry(() => import("./pages/VerifyEmail"));
const OAuthConsent = lazyWithRetry(() => import("./pages/OAuthConsent"));
const PaymentHistory = lazyWithRetry(() => import("./pages/PaymentHistory"));
const PromoCodeManager = lazyWithRetry(() => import("./pages/PromoCodeManager"));
const FounderDashboard = lazyWithRetry(() => import("./pages/FounderDashboard"));
const FounderTroubleshooting = lazyWithRetry(() => import("./pages/FounderTroubleshooting"));
const CorporateGovernance = lazyWithRetry(() => import("./pages/CorporateGovernance"));
const CorporateOnboardingPage = lazyWithRetry(() => import("./pages/CorporateOnboardingPage"));
const GovernanceDocumentPage = lazyWithRetry(() => import("./pages/GovernanceDocumentPage"));
const AssociateSpace = lazyWithRetry(() => import("./pages/AssociateSpace"));
const SeoIntelligencePage = lazyWithRetry(() => import("./pages/SeoIntelligencePage"));
const Referral = lazyWithRetry(() => import("./pages/Referral"));
const Tutorial = lazyWithRetry(() => import("./pages/Tutorial"));
const Academy = lazyWithRetry(() => import("./pages/Academy"));
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
const Dashboard = lazyWithRetry(() => import("./pages/Dashboard"));
const AcceptShopInvite = lazyWithRetry(() => import("./pages/AcceptShopInvite"));
const Documentation = lazyWithRetry(() => import("./pages/Documentation"));
const Health = lazyWithRetry(() => import("./pages/Health"));
const AiQuota = lazyWithRetry(() => import("./pages/AiQuota"));
const Profile = lazyWithRetry(() => import("./pages/Profile"));
const DeliverySignup = lazyWithRetry(() => import("./pages/DeliverySignup"));
const DeliveryDashboard = lazyWithRetry(() => import("./pages/DeliveryDashboard"));
const FounderRoute = lazyWithRetry(() => import("./components/FounderRoute"));
const ConnectUsPage = lazyWithRetry(() => import("./pages/ConnectUsPage"));
const SeoPreview = lazyWithRetry(() => import("./pages/founder/SeoPreview"));
const ShopPaymentControl = lazyWithRetry(() => import("./pages/founder/ShopPaymentControl"));
const PricingDashboard = lazyWithRetry(() => import("./pages/PricingDashboard"));
const DriverApp = lazyWithRetry(() => import("./pages/driver/DriverApp"));
const DriverHome = lazyWithRetry(() => import("./pages/driver/DriverHome"));
const DriverScanner = lazyWithRetry(() => import("./pages/driver/DriverScanner"));
const DriverMission = lazyWithRetry(() => import("./pages/driver/DriverMission"));

// Detect when the visitor arrives via a custom shop domain. In that case the
// root path "/" should render the shop (resolved by hostname inside ShopView)
// instead of the marketing landing page.
const isCustomShopHost = (() => {
  if (typeof window === "undefined") return false;
  
  // En environnement de développement (Vite), on désactive la redirection vers le shop
  // pour vous permettre de voir la landing page et le dashboard normalement.
  if (import.meta.env.DEV) return false;

  const host = window.location.hostname.toLowerCase().replace(/^www\./, "");
  const KNOWN = ["ecomfy.cloud", "localhost", "127.0.0.1"];
  
  if (KNOWN.includes(host) || host.endsWith(".vercel.app")) return false;
  
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
  useOrderNotifications();
  useNativePush();
  useWebPush();
    const isShopView = location.pathname.startsWith("/shop/") || location.pathname.startsWith("/shop-preview/") || (isCustomShopHost && location.pathname === "/");
  const isOrderConfirmed = location.pathname.startsWith("/order-confirmed");
  const isPublicPage = PUBLIC_PAGES.includes(location.pathname) || isOrderConfirmed;
  const isDriverApp = location.pathname.startsWith("/delivery/driver");
  const showSidebar = !isPublicPage && !isShopView && !isDriverApp;
  const showSupport = !isPublicPage && !isShopView && !isDriverApp;
  const hideChrome = isShopView || isOrderConfirmed || isDriverApp;

  return (
    <div className={hideChrome ? "" : "pb-16 md:pb-0"}>
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
          <Route path="/oauth/consent" element={<OAuthConsent />} />
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
            path="/pricing" 
            element={
              <ProtectedRoute>
                <PricingDashboard />
              </ProtectedRoute>
            } 
          />
          <Route path="/generator" element={<Navigate to="/studio" replace />} />
          <Route path="/video-creator" element={<Navigate to="/studio" replace />} />
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
            path="/corporate-governance"
            element={
              <FounderRoute>
                <CorporateGovernance />
              </FounderRoute>
            }
          />
          <Route
            path="/governance/onboarding"
            element={<CorporateOnboardingPage />}
          />
          <Route
            path="/governance/documents/:documentId"
            element={
              <FounderRoute>
                <GovernanceDocumentPage />
              </FounderRoute>
            }
          />
          <Route
            path="/associate-space"
            element={
              <FounderRoute>
                <AssociateSpace />
              </FounderRoute>
            }
          />
          <Route
            path="/seo"
            element={
              <ProtectedRoute>
                <SeoIntelligencePage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/seo/*"
            element={
              <ProtectedRoute>
                <SeoIntelligencePage />
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
            path="/founder/seo-preview"
            element={
              <FounderRoute>
                <SeoPreview />
              </FounderRoute>
            }
          />
          <Route
            path="/founder/shop-payment-control"
            element={
              <FounderRoute>
                <ShopPaymentControl />
              </FounderRoute>
            }
          />
          <Route path="/studio" element={
            <ProtectedRoute>
              <Studio />
            </ProtectedRoute>
          } />
          <Route path="/generator" element={<Navigate to="/studio" replace />} />
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
            path="/academy" 
            element={
              <ProtectedRoute>
                <Academy />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/connectus" 
            element={
              <ProtectedRoute>
                <ConnectUsPage />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/connectus/*" 
            element={
              <ProtectedRoute>
                <ConnectUsPage />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/academie" 
            element={<Navigate to="/academy" replace />} 
          />
          <Route 
            path="/demo" 
            element={<Demo />} 
          />
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
            path="/student-dashboard" 
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
          <Route path="/api-documentation" element={<ProtectedRoute><ApiDocumentation /></ProtectedRoute>} />
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
          
          <Route path="/delivery/driver" element={<ProtectedRoute><DriverApp /></ProtectedRoute>}>
            <Route index element={<DriverHome />} />
            <Route path="scanner" element={<DriverScanner />} />
            <Route path="mission/:deliveryId" element={<DriverMission />} />
          </Route>
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
      import("./pages/Studio");
      import("./pages/Library");
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
    const isShopView = location.pathname.startsWith("/shop/") || location.pathname.startsWith("/shop-preview/") || (isCustomShopHost && location.pathname === "/");
  const isOrderConfirmed = location.pathname.startsWith("/order-confirmed");
  const isPublicPage = PUBLIC_PAGES.includes(location.pathname) || isOrderConfirmed;
  
  const isShopManagement = location.pathname.startsWith("/shop-manager") || 
                           location.pathname.startsWith("/shop-editor") || 
                           location.pathname.startsWith("/shop-builder");
  const isDriverApp = location.pathname.startsWith("/delivery/driver");
  const isConnectUs = location.pathname.startsWith("/connectus");

  // Showcase/shop/public pages and ConnectUs dedicated layout: no sidebar at all
  if (isShopView || isPublicPage || isShopManagement || isDriverApp || isConnectUs) {
    return (
      <main className="w-full">
        <AppContent />
      </main>
    );
  }

  // Authenticated dashboard pages: with sidebar
  return (
    <SidebarProvider defaultOpen={true}>
      <div className="flex min-h-screen w-full">
        <AppSidebar />
        <main className="flex-1 min-w-0">
          <AppContent />
        </main>
      </div>
    </SidebarProvider>
  );
};

const AuthCallbackHandler = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();

  useEffect(() => {
    const processCallback = async () => {
      const search = window.location.search;
      const hash = window.location.hash;
      const searchParams = new URLSearchParams(search);
      const hashParams = new URLSearchParams(hash.replace(/^#/, "?"));

      const code = searchParams.get("code");
      const type = searchParams.get("type") || hashParams.get("type");
      const error = searchParams.get("error") || hashParams.get("error");
      const errorDescription = searchParams.get("error_description") || hashParams.get("error_description");
      const isConfirmedFlag = searchParams.get("confirmed") === "true";
      const hasAccessToken = hashParams.has("access_token") || searchParams.has("access_token");

      if (error) {
        console.error("Erreur de callback auth:", error, errorDescription);
        if (errorDescription?.includes("expired") || errorDescription?.includes("invalid")) {
          toast({
            title: "Lien expiré ou invalide",
            description: "Votre lien de confirmation a expiré. Veuillez vous connecter pour recevoir un nouveau lien.",
            variant: "destructive",
          });
        }
        navigate("/auth", { replace: true });
        return;
      }

      if (type === "recovery" || hash.includes("type=recovery")) {
        if (location.pathname !== "/reset-password") {
          navigate(`/reset-password${search}${hash}`, { replace: true });
        }
        return;
      }

      // Échange du code PKCE Supabase (?code=...)
      if (code) {
        try {
          const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
          if (!exchangeError && data?.session) {
            window.history.replaceState(null, "", "/dashboard");
            toast({
              title: "🎉 Email confirmé avec succès !",
              description: "Bienvenue sur Ecomfy ! Votre compte est activé, vous pouvez créer votre boutique immédiatement.",
            });
            navigate("/dashboard", { replace: true });
            return;
          }
        } catch (err) {
          console.error("Erreur échange de code PKCE:", err);
        }
      }

      // Confirmation via jeton hash (#access_token=...) ou type=signup/confirmed=true
      if (hasAccessToken || type === "signup" || isConfirmedFlag) {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          if (location.pathname === "/" || location.pathname === "/auth") {
            window.history.replaceState(null, "", "/dashboard");
            toast({
              title: "🎉 Email confirmé avec succès !",
              description: "Bienvenue sur Ecomfy ! Votre compte est activé, vous pouvez créer votre boutique immédiatement.",
            });
            navigate("/dashboard", { replace: true });
          }
        }
      }
    };

    void processCallback();
  }, [location.pathname, navigate, toast]);

  return null;
};

const App = () => (
  <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <AuthCallbackHandler />
            <IdlePrefetcher />
            <AppWithSidebar />
          </BrowserRouter>
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  </ErrorBoundary>
);

export default App;
