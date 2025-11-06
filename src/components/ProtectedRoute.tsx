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
  const [isFounder, setIsFounder] = useState(false);

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
      // Check if user is founder or co-founder
      const { data: roleData } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId)
        // @ts-ignore - Role types will be updated after migration
        .in("role", ["founder", "co_founder"]);

      const isFounderOrCofounder = roleData && roleData.length > 0;
      setIsFounder(isFounderOrCofounder);

      // Founders and co-founders have unlimited access
      if (isFounderOrCofounder) {
        setHasActiveSubscription(true);
        setFreeGenerationsRemaining(999999); // Effectively unlimited
        setIsLoading(false);
        return;
      }

      // Check subscription for regular users
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

  // Founders and co-founders bypass subscription requirements
  if (requireActiveSubscription && !isFounder && !hasActiveSubscription && freeGenerationsRemaining <= 0) {
    return <Navigate to="/subscription" replace />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;