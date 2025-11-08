import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { ThemeProvider } from "next-themes";
import { SupportButton } from "@/components/SupportButton";
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
import ProtectedRoute from "./components/ProtectedRoute";
import { useLocation } from "react-router-dom";

const queryClient = new QueryClient();

const AppContent = () => {
  const location = useLocation();
  const isShowcaseView = location.pathname.startsWith("/showcase/");
  const showSidebar = !["/", "/auth", "/verify-email"].includes(location.pathname) && !isShowcaseView;
  const showSupport = !["/", "/auth", "/verify-email"].includes(location.pathname) && !isShowcaseView;

  return (
    <>
      {showSidebar && (
        <div className="fixed top-4 left-4 z-50">
          <SidebarTrigger />
        </div>
      )}
      {showSupport && <SupportButton />}
      <Routes>
        <Route path="/" element={<Index />} />
        <Route path="/auth" element={<Auth />} />
        <Route path="/verify-email" element={<VerifyEmail />} />
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
        <Route path="/showcase/:subdomain" element={<ShowcaseView />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </>
  );
};

const AppWithSidebar = () => {
  const location = useLocation();
  const isShowcaseView = location.pathname.startsWith("/showcase/");

  // For showcase views, render without sidebar
  if (isShowcaseView) {
    return (
      <main className="w-full">
        <AppContent />
      </main>
    );
  }

  // For all other routes, render with sidebar
  return (
    <SidebarProvider>
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
