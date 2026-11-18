import React, { useCallback, useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Helmet } from "react-helmet";
import { Button } from "@/components/ui/button";
import { Loader2, FlaskConical, CheckCircle2, XCircle, Ban, Clock, AlertTriangle } from "lucide-react";
import { sandboxCheckoutApi, type SandboxCheckout, type SandboxScenario } from "@/lib/ecomfyPayDevApi";

// Page de paiement du SANDBOX Ecomfy Pay : simule l'écran d'un opérateur. Aucun argent ne circule, aucun code n'est demandé :
// le développeur choisit le résultat que doit recevoir son intégration (redirection + webhook payment.*).
const SCENARIOS: Array<{ id: SandboxScenario; label: string; hint: string; icon: React.ElementType; tone: string }> = [
  { id: "success", label: "Paiement réussi", hint: "payment.succeeded", icon: CheckCircle2, tone: "bg-emerald-600 hover:bg-emerald-700 text-white" },
  { id: "insufficient_funds", label: "Solde insuffisant", hint: "payment.failed · insufficient_funds", icon: XCircle, tone: "bg-white hover:bg-slate-50 text-slate-800 border border-slate-300" },
  { id: "declined", label: "Paiement refusé", hint: "payment.failed · payment_declined", icon: XCircle, tone: "bg-white hover:bg-slate-50 text-slate-800 border border-slate-300" },
  { id: "cancelled", label: "Client qui annule", hint: "payment.cancelled", icon: Ban, tone: "bg-white hover:bg-slate-50 text-slate-800 border border-slate-300" },
  { id: "expired", label: "Paiement expiré", hint: "payment.expired", icon: Clock, tone: "bg-white hover:bg-slate-50 text-slate-800 border border-slate-300" },
];

const formatPrice = (n: number) => new Intl.NumberFormat("fr-FR").format(n);

export default function EcomfyPaySandboxCheckout() {
  const { paymentId } = useParams<{ paymentId: string }>();
  const [loading, setLoading] = useState(true);
  const [payment, setPayment] = useState<SandboxCheckout | null>(null);
  const [busy, setBusy] = useState<SandboxScenario | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!paymentId) return;
    setLoading(true);
    setPayment(await sandboxCheckoutApi.get(paymentId));
    setLoading(false);
  }, [paymentId]);

  useEffect(() => { void load(); }, [load]);

  const choose = async (scenario: SandboxScenario) => {
    if (!paymentId) return;
    setBusy(scenario);
    setError(null);
    const res = await sandboxCheckoutApi.complete(paymentId, scenario);
    setBusy(null);
    if (res.ok) {
      if (res.redirect_url) window.location.assign(res.redirect_url);
      else await load();
      return;
    }
    setError(res.code === "payment_not_pending" ? "Ce paiement de test est déjà terminé." : "Impossible de terminer ce paiement de test. Réessayez.");
    await load();
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <Helmet>
        <title>Paiement sandbox — Ecomfy Pay</title>
        <meta name="robots" content="noindex,nofollow" />
      </Helmet>
      <div className="w-full max-w-md bg-white rounded-3xl border border-amber-200 shadow-sm overflow-hidden">
        <div className="bg-amber-50 border-b border-amber-200 px-6 py-3 flex items-center gap-2 text-amber-900 text-xs font-bold">
          <FlaskConical className="w-4 h-4" /> ENVIRONNEMENT SANDBOX — aucun argent réel ne circule
        </div>

        <div className="p-6 space-y-5">
          {loading ? (
            <div className="py-10 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div>
          ) : !payment ? (
            <div className="py-8 text-center space-y-2">
              <AlertTriangle className="w-8 h-8 mx-auto text-amber-500" />
              <p className="font-bold text-slate-800">Paiement de test introuvable</p>
              <p className="text-sm text-slate-500">Le lien est incorrect, ou ce paiement n'existe pas en mode test.</p>
            </div>
          ) : (
            <>
              <div className="text-center space-y-1">
                <p className="text-sm text-slate-500">{payment.business_name ?? "Boutique"}</p>
                <p className="text-3xl font-extrabold text-slate-900">{formatPrice(payment.amount)} {payment.currency === "XOF" ? "FCFA" : payment.currency}</p>
                {payment.description && <p className="text-sm text-slate-500">{payment.description}</p>}
                <p className="text-xs text-slate-400 font-mono">{payment.id}</p>
              </div>

              {payment.status !== "pending" ? (
                <div className="rounded-2xl bg-slate-50 border border-slate-200 p-4 text-center text-sm text-slate-700">
                  Ce paiement de test est terminé : <strong>{payment.status}</strong>.
                  {payment.success_url && (
                    <div className="mt-3">
                      <Button variant="outline" size="sm" onClick={() => window.location.assign(payment.success_url as string)}>Retourner sur le site</Button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Choisissez le résultat à simuler</p>
                  {SCENARIOS.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      disabled={busy !== null}
                      onClick={() => choose(s.id)}
                      className={`w-full rounded-xl px-4 py-3 text-left flex items-center gap-3 transition-colors disabled:opacity-60 ${s.tone}`}
                    >
                      {busy === s.id ? <Loader2 className="w-4 h-4 animate-spin shrink-0" /> : <s.icon className="w-4 h-4 shrink-0" />}
                      <span className="flex-1">
                        <span className="block text-sm font-bold">{s.label}</span>
                        <span className="block text-[11px] opacity-75 font-mono">{s.hint}</span>
                      </span>
                    </button>
                  ))}
                </div>
              )}
              {error && <p className="text-sm text-red-600 text-center">{error}</p>}
              <p className="text-[11px] text-slate-400 text-center">
                Après votre choix, le client est renvoyé sur le site du marchand et votre serveur reçoit le webhook correspondant.
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
