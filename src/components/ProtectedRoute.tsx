import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Session } from "@supabase/supabase-js";
import { Loader2 } from "lucide-react";

interface ProtectedRouteProps {
  children: React.ReactNode;
  requireActiveSubscription?: boolean;
}

const ProtectedRoute = ({ children, requireActiveSubscription = false }: ProtectedRouteProps) => {
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasActiveSubscription, setHasActiveSubscription] = useState(false);
  const [freeGenerationsRemaining, setFreeGenerationsRemaining] = useState(0);

  useEffect(() => {
    // Check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session && requireActiveSubscription) {
        checkSubscription(session.user.id);
      } else {
        setIsLoading(false);
      }
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session);
        if (session && requireActiveSubscription) {
          checkSubscription(session.user.id);
        } else {
          setIsLoading(false);
        }
      }
    );

    return () => subscription.unsubscribe();
  }, [requireActiveSubscription]);

  const checkSubscription = async (userId: string) => {
    try {
      // Check subscription
      const { data: subData, error: subError } = await supabase
        .from("subscriptions")
        .select("status")
        .eq("user_id", userId)
        .single();

      if (subError) throw subError;
      const hasActiveSub = subData?.status === "active";
      setHasActiveSubscription(hasActiveSub);

      // Check free generations if no active subscription
      if (!hasActiveSub) {
        const { data: profileData, error: profileError } = await supabase
          .from("profiles")
          .select("free_generations_remaining")
          .eq("id", userId)
          .single();

        if (profileError) throw profileError;
        setFreeGenerationsRemaining(profileData?.free_generations_remaining || 0);
      }
    } catch (error) {
      console.error("Error checking subscription:", error);
      setHasActiveSubscription(false);
      setFreeGenerationsRemaining(0);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!session) {
    return <Navigate to="/auth" replace />;
  }

  if (requireActiveSubscription && !hasActiveSubscription && freeGenerationsRemaining <= 0) {
    return <Navigate to="/subscription" replace />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;