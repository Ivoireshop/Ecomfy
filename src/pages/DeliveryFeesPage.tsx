import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Loader2, RefreshCw, ShieldAlert, Wallet } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import { deliveryService } from "@/lib/deliveryService";
import {
  FEE_KIND_LABELS,
  FEE_PAYMENT_STATUS_LABELS,
  FEE_STATE_LABELS,
  type DeliveryFeeKind,
  type DeliveryFeeStatus,
} from "@/types/delivery";

const fmtDay = (iso?: string | null) => (iso ? new Date(iso).toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" }) : "—");
const money = (n: number, cur: string) => `${new Intl.NumberFormat("fr-FR").format(n)} ${cur}`;
const field = "bg-slate-950 border-slate-800 text-white placeholder:text-slate-500";

const STATE_TONE: Record<string, string> = {
  active: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  waived: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  payment_review: "bg-sky-500/15 text-sky-300 border-sky-500/30",
  payment_due: "bg-amber-500/15 text-amber-300 border-amber-500/30",
  expired: "bg-amber-500/15 text-amber-300 border-amber-500/30",
  suspended: "bg-red-500/15 text-red-300 border-red-500/30",
};

/** Cotisation et caution de la structure (cahier des charges §4.1) : frais exigibles, déclaration d'un paiement, historique. */
export default function DeliveryFeesPage() {
  const { toast } = useToast();
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [fees, setFees] = useState<DeliveryFeeStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [kind, setKind] = useState<DeliveryFeeKind | null>(null);
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
      setFees(await deliveryService.getCompanyFees(company.id));
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
    if (!companyId || !kind) return;
    setBusy(true);
    try {
      await deliveryService.declareFeePayment({ companyId, kind, ...form });
      toast({ title: "Paiement déclaré", description: "L'équipe eComfy le contrôle et vous notifie." });
      setKind(null);
      setForm({ method: "", reference: "", note: "" });
      await load();
    } catch (err) {
      toast({ variant: "destructive", title: "Déclaration impossible", description: err instanceof Error ? err.message : undefined });
    } finally {
      setBusy(false);
    }
  };

  const mem = fees?.membership;
  const dep = fees?.deposit;
  const canDeclareMembership = !!mem && mem.amount > 0 && !mem.pending && fees?.state !== "suspended";
  const canDeclareDeposit = !!dep && dep.amount > 0 && !dep.held && !dep.pending && fees?.state !== "suspended";

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 sm:p-6 lg:p-8">
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="border-b border-slate-800 pb-5">
          <Link to="/delivery/partner-dashboard" className="inline-flex items-center gap-1 text-xs text-emerald-400 hover:underline">
            <ArrowLeft className="w-3.5 h-3.5" /> Tableau de bord
          </Link>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white mt-2 flex items-center gap-2">
            <Wallet className="w-7 h-7 text-emerald-400" /> Cotisation et caution
          </h1>
          <p className="text-xs text-slate-400 mt-1">Frais exigés par eComfy pour recevoir et traiter des commandes, et historique de vos paiements.</p>
        </div>

        {error && (
          <div role="alert" className="p-3 rounded-xl bg-red-950/40 border border-red-900 text-xs text-red-300 flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 shrink-0" /> {error}
          </div>
        )}

        {loading && !fees ? (
          <div className="flex items-center gap-2 text-slate-400 text-sm"><Loader2 className="w-4 h-4 animate-spin" /> Chargement…</div>
        ) : fees && !fees.applicable ? (
          <Card className="bg-slate-900 border-slate-800 p-4 text-sm text-slate-300">Les livreurs indépendants ne sont pas soumis à la cotisation ni à la caution.</Card>
        ) : fees ? (
          <>
            <Card className="bg-slate-900 border-slate-800 p-4 space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-lg font-bold text-white">Votre accès opérationnel</h2>
                <Badge className={`${STATE_TONE[fees.state] ?? "bg-slate-700 text-slate-200 border-slate-600"} border`}>{FEE_STATE_LABELS[fees.state]}</Badge>
              </div>
              <p className="text-sm text-slate-300">
                {fees.suspended
                  ? `Votre accès est suspendu${fees.suspended_reason ? ` : ${fees.suspended_reason}` : "."}`
                  : fees.operational
                    ? "Vous pouvez recevoir et traiter des commandes."
                    : "Vous ne recevez pas de nouvelles commandes tant que votre cotisation et votre caution ne sont pas à jour."}
              </p>
              {!fees.enforced && !fees.suspended && (fees.state === "payment_due" || fees.state === "expired") && (
                <p className="text-[11px] text-slate-400">L'exigence de paiement n'est pas encore activée par eComfy : vous n'êtes pas bloqué pour l'instant.</p>
              )}
            </Card>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Card className="bg-slate-900 border-slate-800 p-4 space-y-2">
                <h3 className="text-sm font-bold text-white">Cotisation</h3>
                {mem && mem.amount > 0 ? (
                  <>
                    <p className="text-xl font-extrabold text-emerald-300">{money(mem.amount, mem.currency)}</p>
                    <p className="text-[11px] text-slate-400">
                      {mem.period_months ? `Valable ${mem.period_months} mois.` : "Payée une seule fois, sans échéance."}
                    </p>
                    <p className="text-xs text-slate-300">
                      {mem.ok ? (mem.no_expiry ? "Réglée." : `À jour jusqu'au ${fmtDay(mem.paid_until)}.`) : mem.pending ? "Paiement en contrôle." : "À régler."}
                    </p>
                    {canDeclareMembership && (
                      <Button size="sm" onClick={() => setKind("membership")} className="bg-emerald-500 text-slate-950 font-bold hover:bg-emerald-400">
                        {mem.ok ? "Renouveler" : "Déclarer mon paiement"}
                      </Button>
                    )}
                  </>
                ) : (
                  <p className="text-xs text-slate-400">Aucune cotisation n'est exigée pour le moment.</p>
                )}
              </Card>

              <Card className="bg-slate-900 border-slate-800 p-4 space-y-2">
                <h3 className="text-sm font-bold text-white">Caution</h3>
                {dep && dep.amount > 0 ? (
                  <>
                    <p className="text-xl font-extrabold text-emerald-300">{money(dep.amount, dep.currency)}</p>
                    <p className="text-xs text-slate-300">{dep.held ? "Versée." : dep.pending ? "Paiement en contrôle." : "À verser."}</p>
                    {dep.policy && <p className="text-[11px] text-slate-400">Restitution : {dep.policy}</p>}
                    {canDeclareDeposit && (
                      <Button size="sm" onClick={() => setKind("deposit")} className="bg-emerald-500 text-slate-950 font-bold hover:bg-emerald-400">
                        Déclarer mon paiement
                      </Button>
                    )}
                  </>
                ) : (
                  <p className="text-xs text-slate-400">Aucune caution n'est exigée pour le moment.</p>
                )}
              </Card>
            </div>

            {kind && (
              <Card className="bg-slate-900 border-slate-800 p-4">
                <form onSubmit={submit} className="space-y-3">
                  <h3 className="text-sm font-bold text-white">
                    Déclarer le paiement de la {FEE_KIND_LABELS[kind].toLowerCase()} ({money(kind === "membership" ? mem!.amount : dep!.amount, kind === "membership" ? mem!.currency : dep!.currency)})
                  </h3>
                  <p className="text-[11px] text-slate-400">Effectuez le paiement auprès d'eComfy, puis indiquez ici comment vous l'avez réglé. L'équipe le vérifie avant de l'enregistrer.</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label htmlFor="fee-method" className="text-xs text-slate-300">Mode de paiement</Label>
                      <Input id="fee-method" required minLength={2} placeholder="Orange Money, Wave, virement…" value={form.method} onChange={(e) => setForm({ ...form, method: e.target.value })} className={field} />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="fee-ref" className="text-xs text-slate-300">Référence de la transaction</Label>
                      <Input id="fee-ref" value={form.reference} onChange={(e) => setForm({ ...form, reference: e.target.value })} className={field} />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="fee-note" className="text-xs text-slate-300">Précision (facultatif)</Label>
                    <Input id="fee-note" maxLength={500} value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} className={field} />
                  </div>
                  <div className="flex gap-2">
                    <Button type="submit" disabled={busy} className="bg-emerald-500 text-slate-950 font-bold hover:bg-emerald-400">
                      {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : "Envoyer"}
                    </Button>
                    <Button type="button" variant="outline" onClick={() => setKind(null)} className="bg-slate-800 text-slate-100 border-slate-700 hover:bg-slate-700">Annuler</Button>
                  </div>
                </form>
              </Card>
            )}

            <Card className="bg-slate-900 border-slate-800 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold text-white">Historique des paiements</h2>
                <Button size="sm" variant="outline" onClick={() => void load()} className="bg-slate-800 text-slate-100 border-slate-700 hover:bg-slate-700 text-xs">
                  <RefreshCw className="w-3.5 h-3.5 mr-1" /> Actualiser
                </Button>
              </div>
              {fees.payments && fees.payments.length > 0 ? (
                <ul className="divide-y divide-slate-800">
                  {fees.payments.map((p) => (
                    <li key={p.id} className="py-2.5 text-sm">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="font-semibold text-white">{FEE_KIND_LABELS[p.kind]} · {money(p.amount, p.currency)}</span>
                        <Badge className="bg-slate-800 text-slate-200 border border-slate-700 text-[10px]">{FEE_PAYMENT_STATUS_LABELS[p.status]}</Badge>
                      </div>
                      <div className="text-[11px] text-slate-400">
                        {p.method}{p.reference ? ` · réf. ${p.reference}` : ""} · {fmtDay(p.created_at)}
                        {p.kind === "membership" && p.status === "confirmed" ? ` · ${p.period_end ? `valable jusqu'au ${fmtDay(p.period_end)}` : "sans échéance"}` : ""}
                        {p.status === "refunded" ? ` · restituée le ${fmtDay(p.refunded_at)}` : ""}
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
