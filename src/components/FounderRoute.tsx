import { useEffect, useState } from "react";
import { Navigate, Link } from "react-router-dom";
import { Loader2, Lock, ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuthReady } from "@/hooks/useAuthReady";
import { Button } from "@/components/ui/button";

/**
 * Restricts a route to founder / co_founder roles only.
 * Even an authenticated regular user reaching the URL directly is blocked.
 */
const FounderRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, isReady } = useAuthReady();
  const [allowed, setAllowed] = useState<boolean | null>(null);

  useEffect(() => {
    if (!isReady) return;
    if (!user) { setAllowed(false); return; }
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        // @ts-ignore
        .in("role", ["founder", "co_founder"]);
      if (!cancelled) setAllowed(!!data?.length);
    })();
    return () => { cancelled = true; };
  }, [isReady, user]);

  if (!isReady || allowed === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) return <Navigate to="/auth" replace />;

  if (!allowed) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6">
        <div className="max-w-md w-full text-center space-y-4">
          <div className="mx-auto w-14 h-14 rounded-full bg-muted flex items-center justify-center">
            <Lock className="h-7 w-7 text-muted-foreground" />
          </div>
          <h1 className="text-2xl font-semibold">Accès restreint</h1>
          <p className="text-muted-foreground">
            Cette section est réservée aux fondateurs et co-fondateurs de VisualPro.
          </p>
          <Button asChild variant="outline">
            <Link to="/"><ArrowLeft className="h-4 w-4 mr-2" />Retour à l'accueil</Link>
          </Button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};

export default FounderRoute;