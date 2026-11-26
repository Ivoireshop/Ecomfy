import { useCallback, useEffect, useState } from "react";
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
import { getKycSignedUrls, isLegacyKycValue } from "@/lib/kycStorage";
import { ListPagination } from "@/components/ListPagination";
import { usePagedList } from "@/hooks/usePagedList";
import { readPage, searchFilter } from "@/lib/pagination";

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

const TODO_STATUSES: KycStatus[] = ["PENDING", "UNDER_REVIEW"];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const fmtDate = (d?: string | null) => (d ? new Date(d).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" }) : "—");

function DocImage({ label, url, legacy }: { label: string; url?: string | null; legacy?: boolean }) {
  return (
    <div className="space-y-1.5">
      <div className="text-xs font-semibold text-muted-foreground">{label}</div>
      {url ? (
        <a href={url} target="_blank" rel="noopener noreferrer" className="block">
          <img src={url} alt={label} className="w-full h-48 object-contain rounded-lg border bg-muted" />
        </a>
      ) : (
        <div className="h-48 rounded-lg border border-dashed flex items-center justify-center text-xs text-muted-foreground">
          {legacy ? "Ancienne pièce publique, à redemander" : "Non fourni"}
        </div>
      )}
    </div>
  );
}

export default function KycReview() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>("todo");
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<MerchantKyc | null>(null);
  const [decision, setDecision] = useState<Decision | null>(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  // Liens signés (5 min) des pièces du dossier ouvert : le bucket kyc-documents est privé (audit H1)
  const [docUrls, setDocUrls] = useState<{ front: string | null; back: string | null; selfie: string | null }>({
    front: null,
    back: null,
    selfie: null,
  });

  const list = usePagedList<MerchantKyc>({
    search: q,
    filterKey: tab,
    fetchPage: ({ page, pageSize, search }) =>
      readPage<MerchantKyc>(page, pageSize, (from, to) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let query = (supabase as any)
          .from("merchant_kyc")
          .select("*", { count: "exact" })
          // Les plus anciens d'abord : c'est l'ordre de traitement.
          .order("updated_at", { ascending: true })
          .order("id", { ascending: true })
          .range(from, to);
        if (tab === "todo") query = query.in("verification_status", TODO_STATUSES);
        else if (tab !== "all") query = query.eq("verification_status", tab);
        // Un identifiant de compte se cherche en entier ; le reste, par morceau de texte.
        if (UUID.test(search)) return query.eq("user_id", search);
        const filter = searchFilter(["full_name", "phone_number", "document_number"], search);
        return filter ? query.or(filter) : query;
      }),
  });

  // Dossiers à examiner, tous onglets confondus.
  const [todoCount, setTodoCount] = useState(0);
  const loadTodoCount = useCallback(async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { count, error } = await (supabase as any)
      .from("merchant_kyc")
      .select("id", { count: "exact", head: true })
      .in("verification_status", TODO_STATUSES);
    if (!error) setTodoCount(count ?? 0);
  }, []);
  useEffect(() => { void loadTodoCount(); }, [loadTodoCount]);

  const load = () => {
    list.reload();
    void loadTodoCount();
  };

  useEffect(() => {
    setDocUrls({ front: null, back: null, selfie: null });
    if (!selected) return;
    let cancelled = false;
    void getKycSignedUrls([selected.document_front_url, selected.document_back_url, selected.selfie_url]).then(
      ([front, back, selfie]) => {
        if (!cancelled) setDocUrls({ front, back, selfie });
      },
    );
    return () => {
      cancelled = true;
    };
  }, [selected]);

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
    load();
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
        <Button variant="outline" size="sm" onClick={load} disabled={list.loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${list.loading ? "animate-spin" : ""}`} /> Actualiser
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {TABS.map((t) => (
          <Button key={t.id} size="sm" variant={tab === t.id ? "default" : "outline"} onClick={() => setTab(t.id)}>
            {t.label}
            {t.id === "todo" && todoCount > 0 && (
              <Badge className="ml-2 bg-amber-500 text-white border-0">{todoCount}</Badge>
            )}
          </Button>
        ))}
        <div className="relative ml-auto w-full sm:w-72">
          <Search className="h-4 w-4 absolute left-2.5 top-2.5 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Nom, téléphone, n° de pièce…" className="pl-8" />
        </div>
      </div>

      {list.loading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-7 w-7 animate-spin text-primary" /></div>
      ) : list.error ? (
        <Card role="alert">
          <CardContent className="py-12 text-center text-sm text-destructive space-y-3">
            <p>Erreur de chargement : {list.error.message}</p>
            <Button size="sm" variant="outline" onClick={load}>Réessayer</Button>
          </CardContent>
        </Card>
      ) : list.rows.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            {tab === "todo" ? "Aucun dossier en attente d'examen." : "Aucun dossier ne correspond."}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {list.rows.map((r) => {
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

      <ListPagination page={list.page} pageSize={list.pageSize} total={list.total} onPageChange={list.setPage} disabled={list.loading} />

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
                <DocImage label="Recto" url={docUrls.front} legacy={isLegacyKycValue(selected.document_front_url)} />
                <DocImage label="Verso" url={docUrls.back} legacy={isLegacyKycValue(selected.document_back_url)} />
                <DocImage label="Selfie avec la pièce" url={docUrls.selfie} legacy={isLegacyKycValue(selected.selfie_url)} />
              </div>
              <p className="text-xs text-muted-foreground">Cliquez sur une image pour l'ouvrir en grand. Les liens expirent après 5 minutes : rouvrez le dossier si une image ne s'affiche plus.</p>

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
