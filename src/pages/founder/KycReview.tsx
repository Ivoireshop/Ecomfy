import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import { ArrowLeft, CheckCircle2, Loader2, RefreshCw, Search, ShieldCheck, XCircle, RotateCcw } from "lucide-react";
import type { KycStatus, MerchantKyc } from "@/types/ecomfyPay";

type Tab = "todo" | "VERIFIED" | "REJECTED" | "RESUBMISSION_REQUIRED" | "all";
type Decision = "VERIFIED" | "REJECTED" | "RESUBMISSION_REQUIRED";

const TABS: { id: Tab; label: string }[] = [
  { id: "todo", label: "À examiner" },
  { id: "VERIFIED", label: "Validés" },
  { id: "REJECTED", label: "Rejetés" },
  { id: "RESUBMISSION_REQUIRED", label: "Pièces redemandées" },
  { id: "all", label: "Tous" },
];

const STATUS_META: Record<KycStatus, { label: string; className: string }> = {
  NOT_STARTED: { label: "Non transmis", className: "bg-slate-100 text-slate-700 border-slate-300" },
  PENDING: { label: "En attente", className: "bg-amber-100 text-amber-800 border-amber-300" },
  UNDER_REVIEW: { label: "En cours d'examen", className: "bg-amber-100 text-amber-800 border-amber-300" },
  VERIFIED: { label: "Validé", className: "bg-green-100 text-green-800 border-green-300" },
  REJECTED: { label: "Rejeté", className: "bg-red-100 text-red-800 border-red-300" },
  RESUBMISSION_REQUIRED: { label: "Pièces redemandées", className: "bg-orange-100 text-orange-800 border-orange-300" },
};

const DOC_LABELS: Record<string, string> = {
  cni: "Carte nationale d'identité",
  passport: "Passeport",
  consular_card: "Carte consulaire",
  trade_register: "Registre du commerce",
};

const DECISION_COPY: Record<Decision, { title: string; confirm: string; reasonRequired: boolean }> = {
  VERIFIED: { title: "Valider ce dossier", confirm: "Valider", reasonRequired: false },
  REJECTED: { title: "Rejeter ce dossier", confirm: "Rejeter", reasonRequired: true },
  RESUBMISSION_REQUIRED: { title: "Redemander des pièces", confirm: "Redemander", reasonRequired: true },
};

const fmtDate = (d?: string | null) => (d ? new Date(d).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" }) : "—");

function DocImage({ label, url }: { label: string; url?: string | null }) {
  return (
    <div className="space-y-1.5">
      <div className="text-xs font-semibold text-muted-foreground">{label}</div>
      {url ? (
        <a href={url} target="_blank" rel="noopener noreferrer" className="block">
          <img src={url} alt={label} className="w-full h-48 object-contain rounded-lg border bg-muted" />
        </a>
      ) : (
        <div className="h-48 rounded-lg border border-dashed flex items-center justify-center text-xs text-muted-foreground">
          Non fourni
        </div>
      )}
    </div>
  );
}

export default function KycReview() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<MerchantKyc[]>([]);
  const [tab, setTab] = useState<Tab>("todo");
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<MerchantKyc | null>(null);
  const [decision, setDecision] = useState<Decision | null>(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      // @ts-ignore table créée par la migration Ecomfy Pay
      .from("merchant_kyc")
      .select("*")
      .order("updated_at", { ascending: true })
      .limit(500);
    if (error) toast({ title: "Erreur de chargement", description: error.message, variant: "destructive" });
    setRows((data as unknown as MerchantKyc[]) || []);
    setLoading(false);
  };

  useEffect(() => { void load(); }, []);

  const counts = useMemo(() => {
    const todo = rows.filter((r) => r.verification_status === "PENDING" || r.verification_status === "UNDER_REVIEW").length;
    return { todo, all: rows.length } as Record<string, number>;
  }, [rows]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return rows.filter((r) => {
      const s = r.verification_status;
      if (tab === "todo" && s !== "PENDING" && s !== "UNDER_REVIEW") return false;
      if (tab !== "todo" && tab !== "all" && s !== tab) return false;
      if (!needle) return true;
      return [r.full_name, r.phone_number, r.document_number, r.user_id].some((v) => v?.toLowerCase().includes(needle));
    });
  }, [rows, tab, q]);

  const openDecision = (d: Decision) => {
    setReason("");
    setDecision(d);
  };

  const submitDecision = async () => {
    if (!selected || !decision) return;
    const copy = DECISION_COPY[decision];
    if (copy.reasonRequired && !reason.trim()) {
      toast({ title: "Motif obligatoire", description: "Expliquez au marchand ce qui doit être corrigé.", variant: "destructive" });
      return;
    }
    setBusy(true);
    // @ts-ignore RPC créée par la migration Ecomfy Pay
    const { data, error } = await supabase.rpc("review_merchant_kyc", {
      p_user_id: selected.user_id,
      p_decision: decision,
      p_reason: copy.reasonRequired ? reason.trim() : null,
    });
    setBusy(false);
    const result = data as { success?: boolean; error?: string } | null;
    if (error || result?.success === false) {
      toast({ title: "Décision refusée", description: error?.message || result?.error || "Erreur inconnue", variant: "destructive" });
      return;
    }
    toast({ title: decision === "VERIFIED" ? "Dossier validé" : decision === "REJECTED" ? "Dossier rejeté" : "Pièces redemandées" });
    setDecision(null);
    setSelected(null);
    void load();
  };

  return (
    <div className="min-h-screen bg-background p-4 sm:p-6 max-w-6xl mx-auto space-y-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/founder-dashboard")} aria-label="Retour">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-xl font-semibold flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-primary" /> Revue KYC des marchands
            </h1>
            <p className="text-sm text-muted-foreground">
              Un marchand ne peut retirer de l'argent qu'une fois son dossier validé ici.
            </p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} /> Actualiser
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {TABS.map((t) => (
          <Button key={t.id} size="sm" variant={tab === t.id ? "default" : "outline"} onClick={() => setTab(t.id)}>
            {t.label}
            {t.id === "todo" && counts.todo > 0 && (
              <Badge className="ml-2 bg-amber-500 text-white border-0">{counts.todo}</Badge>
            )}
          </Button>
        ))}
        <div className="relative ml-auto w-full sm:w-72">
          <Search className="h-4 w-4 absolute left-2.5 top-2.5 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Nom, téléphone, n° de pièce…" className="pl-8" />
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-7 w-7 animate-spin text-primary" /></div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            {tab === "todo" ? "Aucun dossier en attente d'examen." : "Aucun dossier ne correspond."}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {filtered.map((r) => {
            const meta = STATUS_META[r.verification_status] ?? STATUS_META.PENDING;
            return (
              <Card key={r.id} className="cursor-pointer hover:border-primary/50 transition-colors" onClick={() => setSelected(r)}>
                <CardContent className="p-4 flex items-center justify-between gap-3 flex-wrap">
                  <div className="min-w-0">
                    <div className="font-semibold truncate">{r.full_name}</div>
                    <div className="text-xs text-muted-foreground">
                      {DOC_LABELS[r.document_type] ?? r.document_type} · {r.country} · {r.phone_number || "sans téléphone"}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-muted-foreground">Mis à jour {fmtDate(r.updated_at)}</span>
                    <Badge variant="outline" className={meta.className}>{meta.label}</Badge>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={!!selected && !decision} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          {selected && (
            <>
              <DialogHeader>
                <DialogTitle>{selected.full_name}</DialogTitle>
                <DialogDescription>
                  Comparez le nom, le numéro et la photo du visage avec les pièces avant de décider.
                </DialogDescription>
              </DialogHeader>

              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm">Informations déclarées</CardTitle></CardHeader>
                <CardContent className="grid sm:grid-cols-2 gap-x-6 gap-y-2 text-sm">
                  <div><span className="text-muted-foreground">Nom : </span>{selected.full_name}</div>
                  <div><span className="text-muted-foreground">Téléphone : </span>{selected.phone_number || "—"}</div>
                  <div><span className="text-muted-foreground">Pays : </span>{selected.country}</div>
                  <div><span className="text-muted-foreground">Type de compte : </span>{selected.seller_type === "business" ? "Société" : "Particulier"}</div>
                  <div><span className="text-muted-foreground">Pièce : </span>{DOC_LABELS[selected.document_type] ?? selected.document_type}</div>
                  <div><span className="text-muted-foreground">N° de pièce : </span><span className="font-mono">{selected.document_number}</span></div>
                  <div><span className="text-muted-foreground">Déposé : </span>{fmtDate(selected.created_at)}</div>
                  <div><span className="text-muted-foreground">Statut : </span>{(STATUS_META[selected.verification_status] ?? STATUS_META.PENDING).label}</div>
                  {selected.rejection_reason && (
                    <div className="sm:col-span-2"><span className="text-muted-foreground">Dernier motif : </span>{selected.rejection_reason}</div>
                  )}
                  {selected.verified_at && (
                    <div className="sm:col-span-2"><span className="text-muted-foreground">Validé le : </span>{fmtDate(selected.verified_at)}</div>
                  )}
                </CardContent>
              </Card>

              <div className="grid sm:grid-cols-3 gap-3">
                <DocImage label="Recto" url={selected.document_front_url} />
                <DocImage label="Verso" url={selected.document_back_url} />
                <DocImage label="Selfie avec la pièce" url={selected.selfie_url} />
              </div>
              <p className="text-xs text-muted-foreground">Cliquez sur une image pour l'ouvrir en grand.</p>

              <DialogFooter className="gap-2 sm:gap-2 flex-wrap">
                <Button variant="outline" className="text-orange-700" onClick={() => openDecision("RESUBMISSION_REQUIRED")}>
                  <RotateCcw className="h-4 w-4 mr-2" /> Redemander des pièces
                </Button>
                <Button variant="outline" className="text-red-700" onClick={() => openDecision("REJECTED")}>
                  <XCircle className="h-4 w-4 mr-2" /> Rejeter
                </Button>
                <Button onClick={() => openDecision("VERIFIED")} disabled={selected.verification_status === "VERIFIED"}>
                  <CheckCircle2 className="h-4 w-4 mr-2" /> Valider
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!decision} onOpenChange={(o) => !o && !busy && setDecision(null)}>
        <DialogContent className="max-w-md">
          {decision && selected && (
            <>
              <DialogHeader>
                <DialogTitle>{DECISION_COPY[decision].title}</DialogTitle>
                <DialogDescription>
                  {decision === "VERIFIED"
                    ? `${selected.full_name} pourra demander des retraits dès que les retraits sont ouverts sur la plateforme.`
                    : "Ce motif sera affiché au marchand."}
                </DialogDescription>
              </DialogHeader>
              {DECISION_COPY[decision].reasonRequired && (
                <Textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Ex : photo du recto floue, le nom ne correspond pas à la pièce…"
                  rows={4}
                  autoFocus
                />
              )}
              <DialogFooter>
                <Button variant="outline" onClick={() => setDecision(null)} disabled={busy}>Annuler</Button>
                <Button onClick={() => void submitDecision()} disabled={busy}>
                  {busy && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  {DECISION_COPY[decision].confirm}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
