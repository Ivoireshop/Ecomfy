import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Loader2, RefreshCw, ShieldAlert, Star } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import { deliveryService } from "@/lib/deliveryService";
import { FEE_PAYMENT_STATUS_LABELS, type DeliveryPremiumPlan, type DeliveryPremiumStatus } from "@/types/delivery";

const fmtDay = (iso?: string | null) => (iso ? new Date(iso).toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" }) : "—");
const money = (n: number, cur: string) => `${new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 2 }).format(n)} ${cur}`;
const field = "bg-slate-950 border-slate-800 text-white placeholder:text-slate-500";
const durationLabel = (months: number) => (months === 1 ? "1 mois" : months % 12 === 0 ? `${months / 12} an${months >= 24 ? "s" : ""}` : `${months} mois`);

/** Abonnement Premium de la structure (cahier des charges §4.2) : visibilité accrue, distincte de la vérification officielle. */
export default function DeliveryPremiumPage() {
  const { toast } = useToast();
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [premium, setPremium] = useState<DeliveryPremiumStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [plan, setPlan] = useState<DeliveryPremiumPlan | null>(null);
  const [form, setForm] = useState({ method: "", reference: "", note: "" });

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const company = await deliveryService.getMyCompany();
      if (!company) {
        setError("Aucune structure n'est rattachée à ce compte.");
        return;
      }
      setCompanyId(company.id);
      setPremium(await deliveryService.getCompanyPremium(company.id));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Chargement impossible.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyId || !plan) return;
    setBusy(true);
    try {
      await deliveryService.declarePremium({ companyId, planCode: plan.code, ...form });
      toast({ title: "Paiement déclaré", description: "L'équipe eComfy le contrôle et vous notifie." });
      setPlan(null);
      setForm({ method: "", reference: "", note: "" });
      await load();
    } catch (err) {
      toast({ variant: "destructive", title: "Déclaration impossible", description: err instanceof Error ? err.message : undefined });
    } finally {
      setBusy(false);
    }
  };

  const canSubscribe = !!premium && premium.applicable && !premium.pending && !premium.suspended && premium.plans.length > 0;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 sm:p-6 lg:p-8">
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="border-b border-slate-800 pb-5">
          <Link to="/delivery/partner-dashboard" className="inline-flex items-center gap-1 text-xs text-emerald-400 hover:underline">
            <ArrowLeft className="w-3.5 h-3.5" /> Tableau de bord
          </Link>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white mt-2 flex items-center gap-2">
            <Star className="w-7 h-7 text-amber-400" /> Abonnement Premium
          </h1>
          <p className="text-xs text-slate-400 mt-1">Améliorez votre visibilité auprès des commerçants. Le Premium ne remplace pas la vérification officielle de votre structure.</p>
        </div>

        {error && (
          <div role="alert" className="p-3 rounded-xl bg-red-950/40 border border-red-900 text-xs text-red-300 flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 shrink-0" /> {error}
          </div>
        )}

        {loading && !premium ? (
          <div className="flex items-center gap-2 text-slate-400 text-sm"><Loader2 className="w-4 h-4 animate-spin" /> Chargement…</div>
        ) : premium && !premium.applicable ? (
          <Card className="bg-slate-900 border-slate-800 p-4 text-sm text-slate-300">L'abonnement Premium est réservé aux structures de livraison.</Card>
        ) : premium ? (
          <>
            <Card className="bg-slate-900 border-slate-800 p-4 space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-lg font-bold text-white">Votre abonnement</h2>
                <Badge className={`border ${premium.active ? "bg-amber-500/15 text-amber-300 border-amber-500/30" : premium.pending ? "bg-sky-500/15 text-sky-300 border-sky-500/30" : "bg-slate-700 text-slate-200 border-slate-600"}`}>
                  {premium.active ? "Premium actif" : premium.pending ? "Paiement en contrôle" : premium.expired ? "Expiré" : "Non souscrit"}
                </Badge>
              </div>
              {premium.active ? (
                <p className="text-sm text-slate-300">
                  {premium.plan_label ?? "Premium"} · valable jusqu'au {fmtDay(premium.paid_until)}.
                  {premium.next_period_start ? ` Une période suivante est déjà réglée (à partir du ${fmtDay(premium.next_period_start)}).` : ""}
                </p>
              ) : premium.expired ? (
                <p className="text-sm text-slate-300">Votre abonnement a pris fin le {fmtDay(premium.paid_until)}. Votre badge et votre mise en avant ont été retirés ; vous pouvez vous réabonner.</p>
              ) : (
                <p className="text-sm text-slate-300">Vous n'avez pas d'abonnement Premium.</p>
              )}
              <ul className="text-[11px] text-slate-400 list-disc pl-4 space-y-0.5">
                <li>Meilleur positionnement dans les résultats de recherche des commerçants.</li>
                <li>Mise en avant dans le répertoire et badge « Premium » sur votre fiche.</li>
                <li>Visible seulement une fois votre structure vérifiée par eComfy.</li>
              </ul>
              {premium.suspended && <p className="text-xs text-red-300">Votre accès est suspendu : la souscription est impossible pour le moment.</p>}
            </Card>

            <Card className="bg-slate-900 border-slate-800 p-4 space-y-3">
              <h2 className="text-lg font-bold text-white">{premium.active ? "Renouveler ou changer de formule" : "Formules"}</h2>
              {premium.plans.length === 0 ? (
                <p className="text-xs text-slate-400">Aucune formule n'est proposée pour le moment.</p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {premium.plans.map((p) => (
                    <div key={p.code} className="rounded-xl border border-slate-800 bg-slate-950 p-3 space-y-1">
                      <p className="text-sm font-bold text-white">{p.label}</p>
                      <p className="text-xl font-extrabold text-amber-300">{money(p.amount, p.currency)}</p>
                      <p className="text-[11px] text-slate-400">Valable {durationLabel(p.months)}.</p>
                      {canSubscribe && (
                        <Button size="sm" onClick={() => setPlan(p)} className="bg-amber-500 text-slate-950 font-bold hover:bg-amber-400">
                          {premium.active ? "Choisir cette formule" : "Souscrire"}
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              )}
              {premium.active && (
                <p className="text-[11px] text-slate-400">Une nouvelle formule prend effet à la fin de la période en cours : vous ne perdez rien de ce qui est déjà payé.</p>
              )}
              {premium.pending && <p className="text-[11px] text-sky-300">Un paiement est en cours de contrôle : vous pourrez en déclarer un autre une fois traité.</p>}
            </Card>

            {plan && (
              <Card className="bg-slate-900 border-slate-800 p-4">
                <form onSubmit={submit} className="space-y-3">
                  <h3 className="text-sm font-bold text-white">Déclarer le paiement de « {plan.label} » ({money(plan.amount, plan.currency)})</h3>
                  <p className="text-[11px] text-slate-400">Effectuez le paiement auprès d'eComfy, puis indiquez ici comment vous l'avez réglé. L'équipe le vérifie avant d'activer l'abonnement.</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label htmlFor="pr-method" className="text-xs text-slate-300">Mode de paiement</Label>
                      <Input id="pr-method" required minLength={2} placeholder="Orange Money, Wave, virement…" value={form.method} onChange={(e) => setForm({ ...form, method: e.target.value })} className={field} />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="pr-ref" className="text-xs text-slate-300">Référence de la transaction</Label>
                      <Input id="pr-ref" value={form.reference} onChange={(e) => setForm({ ...form, reference: e.target.value })} className={field} />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="pr-note" className="text-xs text-slate-300">Précision (facultatif)</Label>
                    <Input id="pr-note" maxLength={500} value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} className={field} />
                  </div>
                  <div className="flex gap-2">
                    <Button type="submit" disabled={busy} className="bg-amber-500 text-slate-950 font-bold hover:bg-amber-400">
                      {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : "Envoyer"}
                    </Button>
                    <Button type="button" variant="outline" onClick={() => setPlan(null)} className="bg-slate-800 text-slate-100 border-slate-700 hover:bg-slate-700">Annuler</Button>
                  </div>
                </form>
              </Card>
            )}

            <Card className="bg-slate-900 border-slate-800 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold text-white">Historique</h2>
                <Button size="sm" variant="outline" onClick={() => void load()} className="bg-slate-800 text-slate-100 border-slate-700 hover:bg-slate-700 text-xs">
                  <RefreshCw className="w-3.5 h-3.5 mr-1" /> Actualiser
                </Button>
              </div>
              {premium.payments.length > 0 ? (
                <ul className="divide-y divide-slate-800">
                  {premium.payments.map((p) => (
                    <li key={p.id} className="py-2.5 text-sm">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="font-semibold text-white">{p.plan_label ?? "Premium"} · {money(p.amount, p.currency)}</span>
                        <Badge className="bg-slate-800 text-slate-200 border border-slate-700 text-[10px]">{FEE_PAYMENT_STATUS_LABELS[p.status]}</Badge>
                      </div>
                      <div className="text-[11px] text-slate-400">
                        {p.method}{p.reference ? ` · réf. ${p.reference}` : ""} · {fmtDay(p.created_at)}
                        {p.status === "confirmed" && p.period_start && p.period_end ? ` · du ${fmtDay(p.period_start)} au ${fmtDay(p.period_end)}` : ""}
                      </div>
                      {p.status === "rejected" && p.decision_note && <div className="text-[11px] text-red-300">Motif : {p.decision_note}</div>}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-slate-500">Aucun paiement enregistré.</p>
              )}
            </Card>
          </>
        ) : null}
      </div>
    </div>
  );
}
