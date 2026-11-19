import React, { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { CheckCircle2, AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { deliveryService } from "@/lib/deliveryService";
import { DELIVERY_ROLE_LABELS, type DeliveryWorkspaceRole } from "@/types/delivery";

const ERRORS: Record<string, string> = {
  invalid_token: "Ce lien d'invitation n'est pas valide ou a déjà été utilisé.",
  expired: "Cette invitation a expiré (14 jours). Demandez-en une nouvelle au responsable de la structure.",
  email_not_confirmed: "Confirmez d'abord l'adresse e-mail de votre compte, puis rouvrez le lien.",
  email_mismatch: "Cette invitation a été envoyée à une autre adresse e-mail. Connectez-vous avec le compte invité.",
  already_owner: "Votre compte possède déjà une structure de livraison : il ne peut pas rejoindre une autre équipe.",
  already_member: "Votre compte est déjà membre actif d'une structure de livraison.",
};

/** Acceptation d'une invitation à rejoindre l'équipe d'une structure de livraison (/delivery/join?token=…). */
export default function DeliveryJoinPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const token = params.get("token") || "";
  const [state, setState] = useState<"loading" | "ok" | "error">("loading");
  const [message, setMessage] = useState("");
  const [info, setInfo] = useState<{ company?: string; role?: string }>({});
  const started = useRef(false);

  useEffect(() => {
    // Le jeton est à usage unique : une seule tentative, même si React rejoue l'effet.
    if (started.current) return;
    started.current = true;
    (async () => {
      try {
        const res = await deliveryService.acceptInvitation(token);
        if (res.success) {
          setInfo({ company: res.company_name, role: res.role });
          setState("ok");
        } else {
          setMessage(ERRORS[res.error || ""] || "Invitation impossible à accepter.");
          setState("error");
        }
      } catch (err: unknown) {
        setMessage((err instanceof Error && err.message) || "Invitation impossible à accepter.");
        setState("error");
      }
    })();
  }, [token]);

  return (
    <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-4">
      <Card className="max-w-md w-full bg-slate-900 border-slate-800 text-center">
        <CardHeader>
          {state === "loading" && <RefreshCw className="w-8 h-8 mx-auto text-emerald-400 animate-spin" />}
          {state === "ok" && <CheckCircle2 className="w-10 h-10 mx-auto text-emerald-400" />}
          {state === "error" && <AlertTriangle className="w-10 h-10 mx-auto text-amber-400" />}
          <CardTitle>
            {state === "loading" ? "Validation de l'invitation…" : state === "ok" ? "Bienvenue dans l'équipe" : "Invitation non acceptée"}
          </CardTitle>
          <CardDescription>
            {state === "ok"
              ? `Vous rejoignez ${info.company ?? "la structure"} en tant que ${DELIVERY_ROLE_LABELS[(info.role as DeliveryWorkspaceRole) ?? "driver"] ?? info.role}.`
              : state === "error"
                ? message
                : "Un instant."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {state === "ok" && (
            <Button onClick={() => navigate("/delivery/partner-dashboard")} className="bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold">
              Ouvrir mon espace
            </Button>
          )}
          {state === "error" && (
            <Button asChild variant="outline" className="bg-slate-900 border-slate-700 text-slate-200">
              <Link to="/">Retour à l'accueil</Link>
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
