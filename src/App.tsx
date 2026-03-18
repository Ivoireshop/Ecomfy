import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { ThemeProvider } from "next-themes";
import { SupportButton } from "@/components/SupportButton";
import { BackButton } from "@/components/BackButton";
import { useLocation } from "react-router-dom";
import { lazy, Suspense } from "react";

// Eager load: landing + auth (critical path)
import Index from "./pages/Index";
import Auth from "./pages/Auth";

// Lazy load all other pages
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
const ProtectedRoute = lazy(() => import("./components/ProtectedRoute"));

const queryClient = new QueryClient();

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
  const isShopView = location.pathname.startsWith("/shop/");
  const publicPages = ["/", "/auth", "/reset-password", "/privacy-policy", "/terms-of-service", "/cookies-policy", "/api-documentation", "/blog", "/legal-notice"];
  const showSidebar = !publicPages.includes(location.pathname) && !isShowcaseView && !isShopView;
  const showSupport = !publicPages.includes(location.pathname) && !isShowcaseView && !isShopView;

  return (
    <>
      <BackButton />
      {showSidebar && (
        <div className="fixed top-1 left-1 md:top-2 md:left-3 z-50">
          <SidebarTrigger />
        </div>
      )}
      {showSupport && <SupportButton />}
      <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/auth" element={<Auth />} />
          <Route path="/reset-password" element={<ResetPassword />} />
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
            path="/referral" 
            element={
              <ProtectedRoute>
                <Referral />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/tutorial" 
            element={
              <ProtectedRoute>
                <Tutorial />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/demo" 
            element={
              <ProtectedRoute>
                <Demo />
              </ProtectedRoute>
            } 
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
          <Route path="/shop-builder" element={<ProtectedRoute><ShopBuilder /></ProtectedRoute>} />
          <Route path="/shop-editor/:id" element={<ProtectedRoute><ShopEditor /></ProtectedRoute>} />
          <Route path="/shop-preview/:id" element={<ProtectedRoute><ShopView /></ProtectedRoute>} />
          <Route path="/shop/:slug" element={<ShopView />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
    </>
  );
};

const PUBLIC_PAGES = ["/", "/auth", "/reset-password", "/privacy-policy", "/terms-of-service", "/cookies-policy", "/api-documentation", "/blog", "/legal-notice"];

const AppWithSidebar = () => {
  const location = useLocation();
  const isShowcaseView = location.pathname.startsWith("/showcase/");
  const isShopView = location.pathname.startsWith("/shop/") || location.pathname.startsWith("/shop-preview/");
  const isPublicPage = PUBLIC_PAGES.includes(location.pathname);

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
          <AppWithSidebar />
        </BrowserRouter>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
