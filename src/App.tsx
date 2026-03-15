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
import Index from "./pages/Index";
import Generator from "./pages/Generator";
import Library from "./pages/Library";
import Auth from "./pages/Auth";
import Subscription from "./pages/Subscription";
import Feedback from "./pages/Feedback";
import NotFound from "./pages/NotFound";
import ResetPassword from "./pages/ResetPassword";
import VerifyEmail from "./pages/VerifyEmail";
import ShowcaseBuilder from "./pages/ShowcaseBuilder";
import ShowcaseView from "./pages/ShowcaseView";
import ShowcaseManager from "./pages/ShowcaseManager";
import ShowcaseEditor from "./pages/ShowcaseEditor";
import PaymentHistory from "./pages/PaymentHistory";
import PromoCodeManager from "./pages/PromoCodeManager";
import FounderDashboard from "./pages/FounderDashboard";
import Referral from "./pages/Referral";
import Tutorial from "./pages/Tutorial";
import Demo from "./pages/Demo";
import StudentDashboard from "./pages/StudentDashboard";
import StudentCourse from "./pages/StudentCourse";
import StudentCertificates from "./pages/StudentCertificates";
import EnrollmentCheckout from "./pages/EnrollmentCheckout";
import PaymentSuccess from "./pages/PaymentSuccess";
import VerifyCertificate from "./pages/VerifyCertificate";
import PrivacyPolicy from "./pages/PrivacyPolicy";
import TermsOfService from "./pages/TermsOfService";
import CookiesPolicy from "./pages/CookiesPolicy";
import ApiDocumentation from "./pages/ApiDocumentation";
import Blog from "./pages/Blog";
import LegalNotice from "./pages/LegalNotice";
import ShopManager from "./pages/ShopManager";
import ShopBuilder from "./pages/ShopBuilder";
import ShopEditor from "./pages/ShopEditor";
import ShopView from "./pages/ShopView";
import ProtectedRoute from "./components/ProtectedRoute";
import { useLocation } from "react-router-dom";

const queryClient = new QueryClient();

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
    </>
  );
};

const AppWithSidebar = () => {
  const location = useLocation();
  const isShowcaseView = location.pathname.startsWith("/showcase/");
  const isShopView = location.pathname.startsWith("/shop/");

  // For showcase/shop views, render without sidebar
  if (isShowcaseView || isShopView) {
    return (
      <main className="w-full">
        <AppContent />
      </main>
    );
  }

  // For all other routes, render with sidebar
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
