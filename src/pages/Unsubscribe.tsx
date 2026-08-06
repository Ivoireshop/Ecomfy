import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, CheckCircle2, AlertCircle } from "lucide-react";

export default function Unsubscribe() {
  const [params] = useSearchParams();
  const token = params.get("token") || "";
  const [state, setState] = useState<"loading" | "valid" | "already" | "invalid" | "done" | "error">("loading");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!token) { setState("invalid"); return; }
    (async () => {
      try {
        const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/handle-email-unsubscribe?token=${encodeURIComponent(token)}`;
        const r = await fetch(url, { headers: { apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY } });
        const d = await r.json();
        if (d.valid) setState("valid");
        else if (d.reason === "already_unsubscribed") setState("already");
        else setState("invalid");
      } catch { setState("error"); }
    })();
  }, [token]);

  const confirm = async () => {
    setSubmitting(true);
    const { data, error } = await supabase.functions.invoke("handle-email-unsubscribe", { body: { token } });
    setSubmitting(false);
    if (error || !data?.success) { setState("error"); return; }
    setState("done");
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="max-w-md w-full p-8 text-center">
        {state === "loading" && <Loader2 className="h-8 w-8 animate-spin mx-auto" />}
        {state === "valid" && (
          <>
            <h1 className="text-xl font-bold mb-2">Se désabonner ?</h1>
            <p className="text-sm text-muted-foreground mb-6">Vous ne recevrez plus d'emails de Ecomfy à cette adresse.</p>
            <Button onClick={confirm} disabled={submitting} variant="destructive">{submitting && <Loader2 className="h-4 w-4 animate-spin mr-1" />}Confirmer le désabonnement</Button>
          </>
        )}
        {state === "already" && (<><CheckCircle2 className="h-10 w-10 text-emerald-500 mx-auto mb-2" /><p>Vous êtes déjà désabonné.</p></>)}
        {state === "done" && (<><CheckCircle2 className="h-10 w-10 text-emerald-500 mx-auto mb-2" /><p>Désabonnement confirmé.</p></>)}
        {state === "invalid" && (<><AlertCircle className="h-10 w-10 text-red-500 mx-auto mb-2" /><p>Lien invalide ou expiré.</p></>)}
        {state === "error" && (<><AlertCircle className="h-10 w-10 text-red-500 mx-auto mb-2" /><p>Une erreur est survenue. Réessayez plus tard.</p></>)}
      </Card>
    </div>
  );
}