import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, CheckCircle2, AlertCircle, LogIn } from "lucide-react";

const AcceptShopInvite = () => {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const token = params.get("token") || "";
  const [status, setStatus] = useState<"loading" | "ok" | "auth" | "error">("loading");
  const [message, setMessage] = useState("");
  const [shopId, setShopId] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      if (!token) { setStatus("error"); setMessage("Lien d'invitation invalide."); return; }
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setStatus("auth");
        return;
      }
      const { data, error } = await (supabase as any).rpc("accept_shop_invitation", { _token: token });
      if (error) { setStatus("error"); setMessage(error.message); return; }
      if (!data?.success) {
        setStatus("error");
        const err = data?.error;
        if (err === "email_mismatch") setMessage(`Cette invitation est destinée à ${data.expected_email}. Connectez-vous avec cette adresse.`);
        else if (err === "invalid_token") setMessage("Lien d'invitation invalide ou expiré.");
        else if (err === "revoked") setMessage("Cette invitation a été révoquée.");
        else setMessage("Impossible d'accepter l'invitation.");
        return;
      }
      setShopId(data.shop_id);
      setStatus("ok");
    })();
  }, [token]);

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-muted/30">
      <Card className="p-8 max-w-md w-full space-y-4 text-center">
        {status === "loading" && (
          <><Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" /><p>Vérification…</p></>
        )}
        {status === "auth" && (
          <>
            <LogIn className="h-10 w-10 mx-auto text-primary" />
            <h2 className="text-xl font-bold">Connexion requise</h2>
            <p className="text-sm text-muted-foreground">Connectez-vous avec l'adresse email qui a reçu l'invitation pour accepter et accéder à la boutique.</p>
            <Button className="w-full" onClick={() => navigate(`/auth?redirect=${encodeURIComponent(`/accept-shop-invite?token=${token}`)}`)}>
              Se connecter
            </Button>
          </>
        )}
        {status === "ok" && (
          <>
            <CheckCircle2 className="h-10 w-10 mx-auto text-emerald-500" />
            <h2 className="text-xl font-bold">Invitation acceptée 🎉</h2>
            <p className="text-sm text-muted-foreground">Vous avez maintenant accès à la boutique.</p>
            <Button className="w-full" onClick={() => shopId ? navigate(`/shop-editor/${shopId}`) : navigate("/shop-manager")}>
              Accéder à la boutique
            </Button>
          </>
        )}
        {status === "error" && (
          <>
            <AlertCircle className="h-10 w-10 mx-auto text-destructive" />
            <h2 className="text-xl font-bold">Impossible d'accepter</h2>
            <p className="text-sm text-muted-foreground">{message}</p>
            <Button variant="outline" className="w-full" onClick={() => navigate("/")}>Retour à l'accueil</Button>
          </>
        )}
      </Card>
    </div>
  );
};

export default AcceptShopInvite;