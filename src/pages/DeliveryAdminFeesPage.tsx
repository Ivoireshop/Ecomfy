import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, CheckCircle2, Loader2, ShieldAlert, Wallet, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import { deliveryService } from "@/lib/deliveryService";
import { FEE_KIND_LABELS, FEE_STATE_LABELS, type DeliveryFeeKind, type DeliveryFeeOverview } from "@/types/delivery";

const fmtDay = (iso?: string | null) => (iso ? new Date(iso).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" }) : "—");
const money = (n: number, cur: string) => `${new Intl.NumberFormat("fr-FR").format(n)} ${cur}`;
const field = "bg-slate-950 border-slate-800 text-white placeholder:text-slate-500";
const secondaryBtn = "bg-slate-800 text-slate-100 hover:bg-slate-700 border border-slate-700 text-xs";

/** Contrôle des cotisations et cautions (cahier des charges §4.1 et §11.3) : barème, paiements à contrôler, accès des structures. */
export default function DeliveryAdminFeesPage() {
  const { toast } = useToast();
  const [overview, setOverview] = useState<DeliveryFeeOverview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  const [settings, setSettings] = useState({
    membershipAmount: "0",
    membershipPeriodMonths: "12",
    depositAmount: "0",
    currency: "XOF",
    refundPolicy: "",
    requireActivation: false,
  });
  const [rejectFor, setRejectFor] = useState<string | null>(null);
  const [rejectNote, setRejectNote] = useState("");
  const [actionFor, setActionFor] = useState<{ companyId: string; type: "record" | "refund" | "suspend" | "waive" } | null>(null);
  const [rec, setRec] = useState({ kind: "membership" as DeliveryFeeKind, amount: "", method: "", reference: "", note: "" });
  const [reason, setReason] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [o, s] = await Promise.all([deliveryService.getFeeOverview(), deliveryService.getFeeSettings()]);
      setOverview(o);
      setSettings({
        membershipAmount: String(s.membership_fee?.amount ?? 0),
        membershipPeriodMonths: String(s.membership_fee?.period_months ?? 12),
        depositAmount: String(s.deposit_fee?.amount ?? 0),
        currency: s.membership_fee?.currency ?? s.deposit_fee?.currency ?? "XOF",
        refundPolicy: s.deposit_refund_policy ?? "",
        requireActivation: s.require_company_activation === true,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Chargement impossible.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const run = async (key: string, action: () => Promise<void>, success: string) => {
    setBusy(key);
    try {
      await action();
      toast({ title: success });
      await load();
      return true;
    } catch (e) {
      toast({ variant: "destructive", title: "Action impossible", description: e instanceof Error ? e.message : "Erreur inconnue." });
      return false;
    } finally {
      setBusy(null);
    }
  };

  const saveSettings = (e: React.FormEvent) => {
    e.preventDefault();
    void run(
      "settings",
      () =>
        deliveryService.setFeeSettings({
          membershipAmount: Number(settings.membershipAmount),
          membershipPeriodMonths: Number(settings.membershipPeriodMonths),
          depositAmount: Number(settings.depositAmount),
          currency: settings.currency,
          refundPolicy: settings.refundPolicy,
          requireActivation: settings.requireActivation,
        }),
      "Barème enregistré",
    );
  };

  const closeAction = () => {
    setActionFor(null);
    setReason("");
    setRec({ kind: "membership", amount: "", method: "", reference: "", note: "" });
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 sm:p-6 lg:p-8">
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="border-b border-slate-800 pb-5">
          <Link to="/delivery-admin" className="inline-flex items-center gap-1 text-xs text-emerald-400 hover:underline">
            <ArrowLeft className="w-3.5 h-3.5" /> Back-office Livraison
          </Link>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white mt-2 flex items-center gap-2">
            <Wallet className="w-7 h-7 text-emerald-400" /> Cotisations et cautions
          </h1>
          <p className="text-xs text-slate-400 mt-1">Fixez le barème, contrôlez les paiements déclarés, suspendez ou rétablissez l'accès opérationnel des structures.</p>
        </div>

        {error && (
          <div role="alert" className="p-3 rounded-xl bg-red-950/40 border border-red-900 text-xs text-red-300 flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 shrink-0" /> {error}
          </div>
        )}
        {loading && !overview && <div className="flex items-center gap-2 text-slate-400 text-sm"><Loader2 className="w-4 h-4 animate-spin" /> Chargement…</div>}

        {/* Barème */}
        <Card className="bg-slate-900 border-slate-800 p-4">
          <form onSubmit={saveSettings} className="space-y-3">
            <h2 className="text-lg font-bold text-white">Barème et règle d'activation</h2>
            <p className="text-[11px] text-slate-400">Montants, périodicité et conditions de restitution relèvent de la direction. Un montant à 0 signifie « non exigé ».</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="space-y-1">
                <Label htmlFor="fs-mem" className="text-xs text-slate-300">Cotisation</Label>
                <Input id="fs-mem" type="number" min={0} step="any" required value={settings.membershipAmount} onChange={(e) => setSettings({ ...settings, membershipAmount: e.target.value })} className={field} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="fs-per" className="text-xs text-slate-300">Durée (mois, 0 = unique)</Label>
                <Input id="fs-per" type="number" min={0} max={120} step={1} required value={settings.membershipPeriodMonths} onChange={(e) => setSettings({ ...settings, membershipPeriodMonths: e.target.value })} className={field} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="fs-dep" className="text-xs text-slate-300">Caution</Label>
                <Input id="fs-dep" type="number" min={0} step="any" required value={settings.depositAmount} onChange={(e) => setSettings({ ...settings, depositAmount: e.target.value })} className={field} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="fs-cur" className="text-xs text-slate-300">Devise</Label>
                <Input id="fs-cur" maxLength={3} required value={settings.currency} onChange={(e) => setSettings({ ...settings, currency: e.target.value.toUpperCase() })} className={field} />
              </div>
            </div>
            <div className="space-y-1">
              <Label htmlFor="fs-pol" className="text-xs text-slate-300">Conditions de restitution de la caution (affichées aux structures)</Label>
              <Input id="fs-pol" maxLength={1500} value={settings.refundPolicy} onChange={(e) => setSettings({ ...settings, refundPolicy: e.target.value })} className={field} />
            </div>
            <label className="flex items-start gap-3 cursor-pointer">
              <input type="checkbox" checked={settings.requireActivation} onChange={(e) => setSettings({ ...settings, requireActivation: e.target.checked })} className="mt-1 accent-emerald-500" />
              <span className="text-xs text-slate-300">
                <span className="text-sm font-semibold text-white block">Exiger la cotisation et la caution pour recevoir des commandes</span>
                {settings.requireActivation
                  ? "Activé : une structure dont la cotisation ou la caution n'est pas à jour ne reçoit plus de nouvelles commandes et n'apparaît plus dans le répertoire des marchands."
                  : "Désactivé : rien n'est bloqué, les structures voient seulement ce qu'elles doivent."}{" "}
                Les livreurs indépendants ne sont jamais concernés. Une suspension décidée ici s'applique dans tous les cas.
              </span>
            </label>
            <Button type="submit" disabled={busy === "settings"} className="bg-emerald-500 text-slate-950 font-bold hover:bg-emerald-400">
              {busy === "settings" ? <Loader2 className="w-4 h-4 animate-spin" /> : "Enregistrer"}
            </Button>
          </form>
        </Card>

        {/* Paiements à contrôler */}
        <Card className="bg-slate-900 border-slate-800 p-4 space-y-3">
          <h2 className="text-lg font-bold text-white">Paiements à contrôler ({overview?.pending.length ?? 0})</h2>
          {overview && overview.pending.length === 0 ? (
            <p className="text-xs text-slate-500">Aucun paiement en attente.</p>
          ) : (
            <ul className="divide-y divide-slate-800">
              {overview?.pending.map((p) => (
                <li key={p.id} className="py-3 space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <span className="text-sm font-semibold text-white">{p.company_name}</span>{" "}
                      <Badge className="bg-slate-800 text-slate-200 border border-slate-700 text-[10px]">{FEE_KIND_LABELS[p.kind]}</Badge>
                      <div className="text-[11px] text-slate-400">
                        {money(p.amount, p.currency)} · {p.method}{p.reference ? ` · réf. ${p.reference}` : ""} · déclaré le {fmtDay(p.created_at)}
                        {p.note ? ` · « ${p.note} »` : ""}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" disabled={busy === `ok-${p.id}`} onClick={() => void run(`ok-${p.id}`, () => deliveryService.decideFeePayment(p.id, true), "Paiement confirmé")} className="bg-emerald-500 text-slate-950 font-bold hover:bg-emerald-400 text-xs">
                        <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Confirmer
                      </Button>
                      <Button size="sm" onClick={() => { setRejectFor(rejectFor === p.id ? null : p.id); setRejectNote(""); }} className={secondaryBtn}>
                        <XCircle className="w-3.5 h-3.5 mr-1" /> Rejeter
                      </Button>
                    </div>
                  </div>
                  {rejectFor === p.id && (
                    <form
                      className="flex flex-wrap gap-2 items-end"
                      onSubmit={async (e) => {
                        e.preventDefault();
                        if (await run(`no-${p.id}`, () => deliveryService.decideFeePayment(p.id, false, rejectNote), "Paiement rejeté")) setRejectFor(null);
                      }}
                    >
                      <div className="space-y-1 grow">
                        <Label htmlFor={`rj-${p.id}`} className="text-xs text-slate-300">Motif du rejet (transmis à la structure)</Label>
                        <Input id={`rj-${p.id}`} required minLength={5} value={rejectNote} onChange={(e) => setRejectNote(e.target.value)} className={field} />
                      </div>
                      <Button type="submit" size="sm" disabled={busy === `no-${p.id}`} className="bg-red-600 text-white hover:bg-red-500 text-xs">Confirmer le rejet</Button>
                    </form>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Card>

        {/* Structures */}
        <Card className="bg-slate-900 border-slate-800 p-4 space-y-3">
          <h2 className="text-lg font-bold text-white">Structures</h2>
          {overview && overview.companies.length === 0 ? (
            <p className="text-xs text-slate-500">Aucune structure inscrite.</p>
          ) : (
            <ul className="divide-y divide-slate-800">
              {overview?.companies.map((c) => (
                <li key={c.company_id} className="py-3 space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <span className="text-sm font-semibold text-white">{c.company_name}</span>{" "}
                      <Badge className="bg-slate-800 text-slate-200 border border-slate-700 text-[10px]">{FEE_STATE_LABELS[c.fees.state]}</Badge>{" "}
                      {!c.fees.operational && <Badge className="bg-red-500/15 text-red-300 border border-red-500/30 text-[10px]">Ne reçoit pas de commandes</Badge>}
                      <div className="text-[11px] text-slate-400">
                        {c.city} · cotisation : {c.fees.membership.amount <= 0 ? "non exigée" : c.fees.membership.ok ? (c.fees.membership.no_expiry ? "réglée" : `jusqu'au ${fmtDay(c.fees.membership.paid_until)}`) : "à régler"}
                        {" · "}caution : {c.fees.deposit.held ? "versée" : c.fees.deposit.amount > 0 ? "à verser" : "non exigée"}
                        {c.fees.suspended_reason ? ` · suspendue : ${c.fees.suspended_reason}` : ""}
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button size="sm" onClick={() => { setActionFor({ companyId: c.company_id, type: "record" }); setReason(""); }} className={secondaryBtn}>Enregistrer un paiement</Button>
                      {c.fees.deposit.held && <Button size="sm" onClick={() => { setActionFor({ companyId: c.company_id, type: "refund" }); setReason(""); }} className={secondaryBtn}>Restituer la caution</Button>}
                      {c.fees.suspended ? (
                        <Button size="sm" disabled={busy === `su-${c.company_id}`} onClick={() => void run(`su-${c.company_id}`, () => deliveryService.setActivation(c.company_id, false, c.fees.waived, c.fees.waived ? "Dispense maintenue" : undefined), "Accès rétabli")} className={secondaryBtn}>Rétablir l'accès</Button>
                      ) : (
                        <Button size="sm" onClick={() => { setActionFor({ companyId: c.company_id, type: "suspend" }); setReason(""); }} className={secondaryBtn}>Suspendre</Button>
                      )}
                      {c.fees.waived ? (
                        <Button size="sm" disabled={busy === `wa-${c.company_id}`} onClick={() => void run(`wa-${c.company_id}`, () => deliveryService.setActivation(c.company_id, c.fees.suspended, false, c.fees.suspended_reason ?? undefined), "Dispense retirée")} className={secondaryBtn}>Retirer la dispense</Button>
                      ) : (
                        <Button size="sm" onClick={() => { setActionFor({ companyId: c.company_id, type: "waive" }); setReason(""); }} className={secondaryBtn}>Dispenser</Button>
                      )}
                    </div>
                  </div>

                  {actionFor?.companyId === c.company_id && (
                    <form
                      className="grid grid-cols-1 sm:grid-cols-4 gap-2 items-end p-3 rounded-lg bg-slate-950 border border-slate-800"
                      onSubmit={async (e) => {
                        e.preventDefault();
                        const t = actionFor.type;
                        const ok = await run(
                          `act-${c.company_id}`,
                          () =>
                            t === "record"
                              ? deliveryService.recordFeePayment({ companyId: c.company_id, kind: rec.kind, amount: Number(rec.amount), method: rec.method, reference: rec.reference, note: rec.note })
                              : t === "refund"
                                ? deliveryService.refundDeposit(c.company_id, reason)
                                : t === "suspend"
                                  ? deliveryService.setActivation(c.company_id, true, c.fees.waived, reason)
                                  : deliveryService.setActivation(c.company_id, c.fees.suspended, true, reason),
                          t === "record" ? "Paiement enregistré" : t === "refund" ? "Caution restituée" : t === "suspend" ? "Accès suspendu" : "Structure dispensée",
                        );
                        if (ok) closeAction();
                      }}
                    >
                      {actionFor.type === "record" ? (
                        <>
                          <div className="space-y-1">
                            <Label htmlFor="rc-kind" className="text-xs text-slate-300">Nature</Label>
                            <select id="rc-kind" value={rec.kind} onChange={(e) => setRec({ ...rec, kind: e.target.value as DeliveryFeeKind })} className={`${field} h-10 w-full rounded-md border px-2 text-sm`}>
                              <option value="membership">Cotisation</option>
                              <option value="deposit">Caution</option>
                            </select>
                          </div>
                          <div className="space-y-1">
                            <Label htmlFor="rc-amount" className="text-xs text-slate-300">Montant reçu</Label>
                            <Input id="rc-amount" type="number" min={1} step="any" required value={rec.amount} onChange={(e) => setRec({ ...rec, amount: e.target.value })} className={field} />
                          </div>
                          <div className="space-y-1">
                            <Label htmlFor="rc-method" className="text-xs text-slate-300">Mode de paiement</Label>
                            <Input id="rc-method" required minLength={2} value={rec.method} onChange={(e) => setRec({ ...rec, method: e.target.value })} className={field} />
                          </div>
                          <div className="space-y-1">
                            <Label htmlFor="rc-ref" className="text-xs text-slate-300">Référence</Label>
                            <Input id="rc-ref" value={rec.reference} onChange={(e) => setRec({ ...rec, reference: e.target.value })} className={field} />
                          </div>
                        </>
                      ) : (
                        <div className="space-y-1 sm:col-span-3">
                          <Label htmlFor="ac-reason" className="text-xs text-slate-300">
                            {actionFor.type === "refund" ? "Modalités de la restitution" : actionFor.type === "suspend" ? "Motif de la suspension (vu par la structure)" : "Motif de la dispense"}
                          </Label>
                          <Input id="ac-reason" required minLength={5} value={reason} onChange={(e) => setReason(e.target.value)} className={field} />
                        </div>
                      )}
                      <div className="flex gap-2">
                        <Button type="submit" size="sm" disabled={busy === `act-${c.company_id}`} className="bg-emerald-500 text-slate-950 font-bold hover:bg-emerald-400 text-xs">Valider</Button>
                        <Button type="button" size="sm" onClick={closeAction} className={secondaryBtn}>Annuler</Button>
                      </div>
                    </form>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
