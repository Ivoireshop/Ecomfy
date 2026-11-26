import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { ListPagination } from "@/components/ListPagination";
import { usePagedList } from "@/hooks/usePagedList";
import { pageRange } from "@/lib/pagination";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { CheckCircle2, XCircle, Loader2, RefreshCw, Copy, AlertTriangle } from "lucide-react";

interface AdminWithdrawal {
  id: string;
  withdrawal_reference: string;
  merchant_id: string;
  amount: number;
  currency: string;
  payout_method: string;
  payout_operator: string | null;
  destination_phone: string | null;
  destination_name: string | null;
  destination_bank_iban: string | null;
  status: string;
  failure_reason: string | null;
  manual_reference: string | null;
  review_note: string | null;
  reviewed_at: string | null;
  created_at: string;
  merchant_email: string | null;
  kyc_full_name: string | null;
  kyc_phone: string | null;
  kyc_status: string | null;
  wallet_frozen: boolean | null;
  reviewed_by_email: string | null;
}

type Filter = "REQUESTED" | "SUCCEEDED" | "FAILED" | "ALL";

const OPERATOR_LABELS: Record<string, string> = {
  wave: "Wave",
  orange_money: "Orange Money",
  mtn: "MTN",
  moov: "Moov",
};

const STATUS_STYLES: Record<string, string> = {
  REQUESTED: "bg-amber-500/15 text-amber-300 border-amber-500/30",
  PROCESSING: "bg-amber-500/15 text-amber-300 border-amber-500/30",
  SUCCEEDED: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  FAILED: "bg-rose-500/15 text-rose-300 border-rose-500/30",
};

const STATUS_LABELS: Record<string, string> = {
  REQUESTED: "À valider",
  PROCESSING: "En cours",
  SUCCEEDED: "Payé",
  FAILED: "Rejeté",
};

const fmt = (n: number) => new Intl.NumberFormat("fr-FR").format(n);

type RpcResult = { data: { success?: boolean; error?: string; withdrawals?: AdminWithdrawal[]; total?: number; pending_count?: number } | null; error: { message?: string } | null };
// Les RPC fondateur ne figurent pas dans les types générés.
const callRpc = (fn: string, args: Record<string, unknown>) =>
  (supabase as unknown as { rpc: (f: string, a: Record<string, unknown>) => PromiseLike<RpcResult> }).rpc(fn, args);

export const FounderWithdrawalsPanel = () => {
  const { toast } = useToast();
  const [filter, setFilter] = useState<Filter>("REQUESTED");
  const [pendingCount, setPendingCount] = useState<number | null>(null);

  const [target, setTarget] = useState<AdminWithdrawal | null>(null);
  const [mode, setMode] = useState<"approve" | "reject" | null>(null);
  const [text, setText] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  const list = usePagedList<AdminWithdrawal>({
    filterKey: filter,
    fetchPage: async ({ page, pageSize }) => {
      const { data, error } = await callRpc("founder_list_withdrawals", {
        p_status: filter === "ALL" ? null : filter,
        p_limit: pageSize,
        p_offset: pageRange(page, pageSize)[0],
      });
      if (error || !data?.success) throw new Error(error?.message || "Accès refusé.");
      setPendingCount(data.pending_count ?? null);
      return { rows: data.withdrawals ?? [], total: data.total ?? 0 };
    },
  });
  const { rows, loading } = list;

  const open = (w: AdminWithdrawal, m: "approve" | "reject") => {
    setTarget(w);
    setMode(m);
    setText("");
    setNote("");
  };

  const close = () => {
    setTarget(null);
    setMode(null);
  };

  const submit = async () => {
    if (!target || !mode) return;
    setSaving(true);
    const { data, error } =
      mode === "approve"
        ? await callRpc("founder_approve_withdrawal", {
            p_withdrawal_reference: target.withdrawal_reference,
            p_manual_reference: text,
            p_note: note || null,
          })
        : await callRpc("founder_reject_withdrawal", {
            p_withdrawal_reference: target.withdrawal_reference,
            p_reason: text,
          });
    setSaving(false);

    if (error || !data?.success) {
      toast({ title: "Action refusée", description: data?.error || error?.message || "Erreur inconnue.", variant: "destructive" });
      return;
    }
    toast({
      title: mode === "approve" ? "Retrait marqué comme payé" : "Retrait rejeté",
      description: mode === "approve" ? `${target.withdrawal_reference} clôturé.` : "Le montant a été recrédité au marchand.",
    });
    close();
    list.reload();
  };

  const copy = (value: string, label: string) => {
    navigator.clipboard?.writeText(value).then(
      () => toast({ title: `${label} copié` }),
      () => undefined
    );
  };

  const destination = (w: AdminWithdrawal) =>
    w.payout_method === "mobile_money"
      ? `${OPERATOR_LABELS[w.payout_operator ?? ""] ?? "Mobile Money"} · ${w.destination_phone ?? "—"}`
      : `Banque · ${w.destination_bank_iban ?? "—"}`;

  return (
    <Card className="bg-slate-900/90 border-slate-800 rounded-3xl p-6 shadow-xl space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-space font-bold text-white">Retraits Ecomfy Pay</h3>
          <p className="text-xs text-slate-400 max-w-xl">
            Versez l'argent vous-même (Wave, Orange, MTN, Moov ou banque), puis marquez la demande comme payée avec la référence
            de la transaction. Le solde du marchand est déjà débité ; un rejet le recrédite.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={list.reload} disabled={loading} className="gap-2 border-slate-700 bg-transparent text-slate-200 hover:bg-slate-800 hover:text-white">
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} /> Actualiser
        </Button>
      </div>

      <div className="flex flex-wrap gap-2">
        {(["REQUESTED", "SUCCEEDED", "FAILED", "ALL"] as Filter[]).map((f) => (
          <Button
            key={f}
            size="sm"
            variant={filter === f ? "default" : "outline"}
            onClick={() => setFilter(f)}
            className={filter === f ? "bg-[#0E7C66] text-white" : "border-slate-700 bg-transparent text-slate-300 hover:bg-slate-800 hover:text-white"}
          >
            {f === "REQUESTED" ? `À valider${pendingCount !== null ? ` (${pendingCount})` : ""}` : f === "SUCCEEDED" ? "Payés" : f === "FAILED" ? "Rejetés" : "Tous"}
          </Button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
        </div>
      ) : list.error ? (
        <div role="alert" className="text-center py-12 text-rose-400 text-xs font-semibold space-y-3">
          <p>Chargement impossible : {list.error.message}</p>
          <Button size="sm" variant="outline" onClick={list.reload} className="border-slate-700 bg-transparent text-slate-200">Réessayer</Button>
        </div>
      ) : rows.length === 0 ? (
        <div className="text-center py-12 text-slate-500 text-xs font-semibold">Aucun retrait dans cette vue.</div>
      ) : (
        <div className="space-y-3">
          {rows.map((w) => {
            const waiting = w.status === "REQUESTED" || w.status === "PROCESSING";
            const nameMismatch =
              !!w.kyc_full_name && !!w.destination_name &&
              w.kyc_full_name.trim().toLowerCase() !== w.destination_name.trim().toLowerCase();
            return (
              <div key={w.id} className="rounded-2xl border border-slate-800 bg-slate-950/60 p-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xl font-bold text-white">{fmt(w.amount)} {w.currency === "XOF" ? "FCFA" : w.currency}</span>
                    <Badge variant="outline" className={`text-[10px] ${STATUS_STYLES[w.status] ?? ""}`}>
                      {STATUS_LABELS[w.status] ?? w.status}
                    </Badge>
                  </div>
                  <span className="text-[11px] text-slate-500">{new Date(w.created_at).toLocaleString("fr-FR")}</span>
                </div>

                <div className="grid gap-2 sm:grid-cols-2 text-xs">
                  <div>
                    <p className="text-slate-500">Marchand</p>
                    <p className="text-slate-200 font-semibold break-all">{w.merchant_email ?? w.merchant_id}</p>
                    <p className="text-slate-400">
                      KYC : {w.kyc_full_name ?? "—"} · {w.kyc_phone ?? "—"}{" "}
                      <span className={w.kyc_status === "VERIFIED" ? "text-emerald-400" : "text-rose-400"}>({w.kyc_status ?? "aucun"})</span>
                    </p>
                  </div>
                  <div>
                    <p className="text-slate-500">À verser à</p>
                    <p className="text-slate-200 font-semibold flex items-center gap-1.5">
                      {destination(w)}
                      {w.destination_phone && (
                        <button type="button" onClick={() => copy(w.destination_phone!, "Numéro")} aria-label="Copier le numéro" className="text-slate-400 hover:text-white">
                          <Copy className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </p>
                    <p className="text-slate-400">Bénéficiaire : {w.destination_name ?? "—"}</p>
                  </div>
                </div>

                {waiting && (nameMismatch || w.wallet_frozen || w.kyc_status !== "VERIFIED") && (
                  <div className="flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 p-2.5 text-[11px] text-amber-200">
                    <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                    <span>
                      {nameMismatch && "Le nom du bénéficiaire diffère du nom du KYC. "}
                      {w.wallet_frozen && "Le portefeuille est gelé. "}
                      {w.kyc_status !== "VERIFIED" && "Le KYC n'est plus vérifié. "}
                      Vérifiez avant de verser.
                    </span>
                  </div>
                )}

                {w.status === "SUCCEEDED" && (
                  <p className="text-[11px] text-slate-400">
                    Payé · réf. <span className="text-slate-200">{w.manual_reference ?? "—"}</span>
                    {w.reviewed_by_email ? ` · par ${w.reviewed_by_email}` : ""}
                    {w.reviewed_at ? ` · ${new Date(w.reviewed_at).toLocaleString("fr-FR")}` : ""}
                  </p>
                )}
                {w.status === "FAILED" && (
                  <p className="text-[11px] text-slate-400">
                    Rejeté · motif : <span className="text-slate-200">{w.failure_reason ?? w.review_note ?? "—"}</span>
                    {w.reviewed_by_email ? ` · par ${w.reviewed_by_email}` : ""}
                  </p>
                )}

                <p className="text-[10px] text-slate-600">{w.withdrawal_reference}</p>

                {waiting && (
                  <div className="flex flex-wrap gap-2 pt-1">
                    <Button size="sm" onClick={() => open(w, "approve")} className="gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white">
                      <CheckCircle2 className="h-4 w-4" /> Marquer comme payé
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => open(w, "reject")} className="gap-1.5 border-rose-500/40 bg-transparent text-rose-300 hover:bg-rose-500/10 hover:text-rose-200">
                      <XCircle className="h-4 w-4" /> Rejeter
                    </Button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <ListPagination page={list.page} pageSize={list.pageSize} total={list.total} onPageChange={list.setPage} disabled={loading} tone="dark" />

      <Dialog open={!!target && !!mode} onOpenChange={(o) => !o && !saving && close()}>
        <DialogContent className="bg-slate-900 border-slate-800 text-white">
          <DialogHeader>
            <DialogTitle>{mode === "approve" ? "Confirmer le versement" : "Rejeter le retrait"}</DialogTitle>
            <DialogDescription className="text-slate-400">
              {target && (
                <>
                  {fmt(target.amount)} FCFA — {destination(target)} — {target.destination_name ?? ""}
                </>
              )}
            </DialogDescription>
          </DialogHeader>

          {mode === "approve" ? (
            <div className="space-y-3">
              <p className="text-xs text-amber-200 bg-amber-500/10 border border-amber-500/30 rounded-xl p-2.5">
                Ne validez qu'après avoir réellement envoyé l'argent. Cette action est définitive.
              </p>
              <div className="space-y-1.5">
                <Label htmlFor="wd-ref">Référence de la transaction *</Label>
                <Input id="wd-ref" value={text} onChange={(e) => setText(e.target.value)} placeholder="ex. identifiant de transfert Wave" className="bg-slate-950 border-slate-700" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="wd-note">Note interne (facultatif)</Label>
                <Input id="wd-note" value={note} onChange={(e) => setNote(e.target.value)} className="bg-slate-950 border-slate-700" />
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-xs text-slate-400">Le montant sera recrédité sur le solde disponible du marchand.</p>
              <div className="space-y-1.5">
                <Label htmlFor="wd-reason">Motif du rejet *</Label>
                <Input id="wd-reason" value={text} onChange={(e) => setText(e.target.value)} placeholder="ex. numéro invalide" className="bg-slate-950 border-slate-700" />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={close} disabled={saving} className="border-slate-700 bg-transparent text-slate-200 hover:bg-slate-800 hover:text-white">
              Annuler
            </Button>
            <Button
              onClick={submit}
              disabled={saving || text.trim().length < 3}
              className={mode === "approve" ? "bg-emerald-600 hover:bg-emerald-500 text-white" : "bg-rose-600 hover:bg-rose-500 text-white"}
            >
              {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              {mode === "approve" ? "Confirmer" : "Rejeter"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
};
