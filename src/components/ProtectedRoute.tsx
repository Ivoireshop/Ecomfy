import { useCallback, useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";
import { useAuthReady } from "@/hooks/useAuthReady";

interface ProtectedRouteProps {
  children: React.ReactNode;
  requireActiveSubscription?: boolean;
}

const ProtectedRoute = ({ children, requireActiveSubscription = false }: ProtectedRouteProps) => {
  const { session, user, isReady } = useAuthReady();
  const [isLoading, setIsLoading] = useState(true);
  const [hasActiveSubscription, setHasActiveSubscription] = useState(false);
  const [freeGenerationsRemaining, setFreeGenerationsRemaining] = useState(0);
  const [isFounder, setIsFounder] = useState(false);

  const checkSubscription = useCallback(async (userId: string) => {
    try {
      const { data: roleData } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId)
        // @ts-ignore - Role types will be updated after migration
        .in("role", ["founder", "co_founder"]);

      const isFounderOrCofounder = !!roleData?.length;
      setIsFounder(isFounderOrCofounder);

      if (isFounderOrCofounder) {
        setHasActiveSubscription(true);
        setFreeGenerationsRemaining(999999);
        return;
      }

      const { data: profileData, error: profileError } = await supabase
        .from("profiles")
        .select("free_generations_remaining")
        .eq("id", userId)
        .single();

      if (profileError) {
        console.error("Error loading profile:", profileError);
        setFreeGenerationsRemaining(3);
      } else {
        setFreeGenerationsRemaining(profileData?.free_generations_remaining || 0);
      }

      const { data: subData, error: subError } = await supabase
        .from("subscriptions")
        .select("status")
        .eq("user_id", userId)
        .single();

      if (subError) {
        console.error("Error loading subscription:", subError);
        setHasActiveSubscription(false);
      } else {
        setHasActiveSubscription(subData?.status === "active");
      }
    } catch (error) {
      console.error("Unexpected error checking subscription:", error);
      setHasActiveSubscription(false);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isReady) {
      return;
    }

    if (!user) {
      setHasActiveSubscription(false);
      setFreeGenerationsRemaining(0);
      setIsFounder(false);
      setIsLoading(false);
      return;
    }

    if (!requireActiveSubscription) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    void checkSubscription(user.id);
  }, [checkSubscription, isReady, requireActiveSubscription, user]);

  if (isLoading || !isReady) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!session) {
    return <Navigate to="/auth" replace />;
  }

  if (requireActiveSubscription && !isFounder && !hasActiveSubscription && freeGenerationsRemaining <= 0) {
    return <Navigate to="/subscription" replace />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;
