import { useState } from "react";
import { Link } from "react-router-dom";
import { useCorporateGovernance } from "@/hooks/useCorporateGovernance";
import { useAuthReady } from "@/hooks/useAuthReady";
import { GovernanceDocumentViewerModal } from "@/components/governance/GovernanceDocumentViewerModal";
import { CorporateDocument } from "@/types/corporate";
import { buildOnboardingSteps, computeVestingProgress, resolveMemberStatus } from "@/lib/governanceMetrics";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Users,
  ShieldCheck,
  CheckCircle2,
  Clock,
  FileCheck,
  Crown,
  FileText,
  AlertTriangle,
  Lock,
  ArrowRight,
  Loader2,
  CheckSquare,
  Sparkles,
  Building2,
  Eye
} from "lucide-react";

type Ticks = { read: boolean; aware: boolean; legal: boolean };
const NO_TICKS: Ticks = { read: false, aware: false, legal: false };
const fmtPct = (n: number) => `${Number(n.toFixed(2))} %`;
const fmtDate = (v?: string | null) => (v ? new Date(v).toLocaleDateString("fr-FR") : "—");

export default function AssociateSpace() {
  const { user } = useAuthReady();
  const { loading, loadError, canWrite, shareholders, invitations, documents, viewedByMe, approveDocument, recordDocumentView } = useCorporateGovernance();

  // Document Viewer Modal State
  const [selectedDocForView, setSelectedDocForView] = useState<CorporateDocument | null>(null);
  const [isDocViewerOpen, setIsDocViewerOpen] = useState(false);

  // Cases à cocher propres à chaque document : cocher l'une ne débloque pas les autres.
  const [ticks, setTicks] = useState<Record<string, Ticks>>({});
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const tickOf = (docId: string): Ticks => ticks[docId] ?? NO_TICKS;
  const setTick = (docId: string, key: keyof Ticks, val: boolean) =>
    setTicks((prev) => ({ ...prev, [docId]: { ...(prev[docId] ?? NO_TICKS), [key]: val } }));

  // Profil de l'utilisateur connecté, et lui seul : jamais le profil d'un autre membre par défaut.
  const currentShareholder = shareholders.find(
    (s) => (user?.id && s.user_id === user.id) || (!!user?.email && s.email.toLowerCase() === user.email.toLowerCase()),
  );
  const isMainFounder = !!currentShareholder?.is_main_founder;
  const alloc = currentShareholder?.allocation;
  const plan = currentShareholder?.vesting_plan;
  const progress = plan ? computeVestingProgress(plan) : null;
  const myInvitation = currentShareholder
    ? invitations.find((i) => i.email.toLowerCase() === currentShareholder.email.toLowerCase())
    : undefined;
  const memberStatus = currentShareholder ? resolveMemberStatus(currentShareholder, myInvitation) : null;

  const mandatory = documents.filter((d) => d.is_mandatory);
  const steps = buildOnboardingSteps({
    shareholder: currentShareholder ?? null,
    invitation: myInvitation,
    emailConfirmed: !!user?.email_confirmed_at,
    mandatoryDocs: mandatory.length,
    viewedMandatory: mandatory.filter((d) => viewedByMe.has(d.id)).length,
    approvedMandatory: mandatory.filter((d) => !!d.user_acceptance).length,
  });

  const handleApproveMandatoryDocument = async (docId: string, version: string) => {
    const t = tickOf(docId);
    if (!t.read || !t.aware || !t.legal) return;
    setApprovingId(docId);
    try {
      const ok = await approveDocument(
        docId,
        version,
        "J'ai lu, compris et approuvé ce document. Je reconnais que ce document s'interprète avec les statuts et formalités juridiques applicables d'Ecomfy.",
      );
      if (ok) setTicks((prev) => ({ ...prev, [docId]: NO_TICKS }));
    } finally {
      setApprovingId(null);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 text-white">
        <Loader2 className="w-8 h-8 animate-spin text-[#0E7C66]" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 sm:p-8 space-y-8 font-sans">
      {/* HEADER BANNER */}
      <div className="bg-gradient-to-r from-emerald-500/10 via-slate-900 to-slate-900 border border-emerald-500/20 rounded-3xl p-6 sm:p-8 shadow-2xl flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-semibold">
            <Users className="w-3.5 h-3.5 text-emerald-400" /> Mon Espace Associé Ecomfy
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight flex items-center gap-3">
            Bonjour, {currentShareholder?.full_name || "membre"}
          </h1>
          <p className="text-sm text-slate-400 max-w-2xl">
            Consultez votre participation, validez vos documents obligatoires et suivez vos échéances de vesting.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {(isMainFounder || canWrite) && (
            <Button asChild className="bg-[#0E7C66] hover:bg-[#0A6352] text-white font-bold rounded-xl px-5">
              <Link to="/corporate-governance">
                <Crown className="w-4 h-4 mr-2 text-amber-400" /> Administration Corporate
              </Link>
            </Button>
          )}
        </div>
      </div>

      {loadError && (
        <div className="rounded-2xl border border-amber-500/40 bg-amber-500/10 p-4 text-xs text-amber-200">
          <div className="font-bold text-amber-300">Certaines données n'ont pas pu être lues</div>
          <div className="mt-1 font-mono text-[11px] break-words">{loadError}</div>
        </div>
      )}

      {!currentShareholder && (
        <div className="rounded-2xl border border-slate-700 bg-slate-900 p-5 text-sm text-slate-300">
          <div className="font-bold text-white">Aucun profil d'associé n'est rattaché à ce compte</div>
          <p className="mt-1 text-xs text-slate-400">
            Votre participation et votre vesting apparaîtront ici dès qu'un fondateur aura enregistré votre fiche avec l'adresse {user?.email ?? "de ce compte"}. Les documents ci-dessous restent consultables et signables.
          </p>
        </div>
      )}

      {/* METRICS CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        <Card className="bg-slate-900/80 border-slate-800 rounded-2xl p-5 shadow-xl">
          <span className="text-xs font-semibold text-slate-400">Participation cible</span>
          <div className="mt-3 text-3xl font-extrabold text-emerald-400">
            {alloc ? fmtPct(Number(alloc.target_percentage)) : "—"}
          </div>
          <p className="text-xs text-slate-500 mt-1">
            {alloc ? `${Number(alloc.target_shares).toLocaleString("fr-FR")} actions attribuées` : "Aucune participation enregistrée"}
          </p>
        </Card>

        <Card className="bg-slate-900/80 border-slate-800 rounded-2xl p-5 shadow-xl">
          <span className="text-xs font-semibold text-slate-400">Participation acquise</span>
          <div className="mt-3 text-3xl font-extrabold text-white">
            {alloc ? fmtPct(Number(alloc.vested_percentage)) : "—"}
          </div>
          <p className="text-xs text-slate-500 mt-1">
            {alloc ? `${Number(alloc.vested_shares).toLocaleString("fr-FR")} actions acquises` : "—"}
            {progress && !isMainFounder ? ` · éligible au vesting : ${fmtPct(progress.eligiblePct)}` : ""}
          </p>
        </Card>

        <Card className="bg-slate-900/80 border-slate-800 rounded-2xl p-5 shadow-xl">
          <span className="text-xs font-semibold text-slate-400">Régime de vesting</span>
          <div className="mt-3 text-2xl font-extrabold text-purple-300">
            {!currentShareholder ? "—" : isMainFounder ? "Fondateur principal" : plan ? `Vesting ${plan.duration_months} mois` : "Aucun plan enregistré"}
          </div>
          <p className="text-xs text-purple-400/90 font-medium mt-1">
            {plan && !isMainFounder
              ? `Cliff ${plan.cliff_months} mois · ${progress?.cliffReached ? "franchi" : "franchi le"} ${fmtDate(plan.cliff_date)} · fin ${fmtDate(plan.end_date)}`
              : memberStatus && !isMainFounder
                ? memberStatus.status === "ACTIVE"
                  ? "Membre actif"
                  : "Membre non encore activé"
                : ""}
          </p>
        </Card>
      </div>

      {/* 7-LEVEL ONBOARDING WORKFLOW PROGRESSION */}
      <Card className="bg-slate-900/90 border-slate-800 rounded-3xl p-6 shadow-xl space-y-6">
        <CardHeader className="p-0">
          <CardTitle className="text-lg font-bold text-white flex items-center gap-2">
            <CheckSquare className="w-5 h-5 text-emerald-400" /> Parcours d'Onboarding de l'Associé (7 niveaux)
          </CardTitle>
          <CardDescription className="text-slate-400 text-xs mt-1">
            Chaque étape n'est validée que lorsqu'un fait correspondant est enregistré (profil, e-mail confirmé, consultation, signature, activation).
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="grid grid-cols-1 md:grid-cols-7 gap-2">
            {steps.map((step) => (
              <div
                key={step.lvl}
                className={`p-3 rounded-2xl border text-center transition-all ${
                  step.done
                    ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                    : "bg-slate-950 border-slate-800 text-slate-500"
                }`}
              >
                <div className="w-7 h-7 rounded-full mx-auto flex items-center justify-center font-bold text-xs bg-slate-900 border border-current mb-1.5">
                  {step.lvl}
                </div>
                <div className="font-bold text-xs truncate">{step.title}</div>
                <div className="text-[10px] text-slate-400 mt-0.5">{step.desc}</div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* MANDATORY DOCUMENTS SIGNATURE SECTION */}
      <div className="space-y-6">
        <h3 className="text-lg font-bold text-white flex items-center gap-2">
          <FileCheck className="w-5 h-5 text-emerald-400" /> Documents juridiques à lire et approuver
        </h3>

        <div className="grid grid-cols-1 gap-6">
          {documents.length === 0 && (
            <p className="text-xs text-slate-500">Aucun document enregistré.</p>
          )}
          {documents.map((doc) => (
            <Card key={doc.id} className="bg-slate-900/90 border-slate-800 rounded-3xl p-6 shadow-xl space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <Badge className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[10px]">
                      {doc.category.toUpperCase()}
                    </Badge>
                    <span className="text-xs font-mono text-slate-500">{doc.current_version}</span>
                  </div>
                  <h4 className="text-base font-bold text-white mt-1">{doc.title}</h4>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-slate-400 border-slate-700">
                    {doc.is_mandatory ? "Lecture et acceptation obligatoires" : "Lecture recommandée"}
                  </Badge>
                  <Button
                    onClick={() => {
                      setSelectedDocForView(doc);
                      setIsDocViewerOpen(true);
                    }}
                    variant="outline"
                    size="sm"
                    className="rounded-xl text-xs border-emerald-500/40 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20 hover:text-white font-bold"
                  >
                    <Eye className="w-3.5 h-3.5 mr-1" /> Consulter
                  </Button>
                </div>
              </div>

              {/* Document Markdown Content Box */}
              <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 text-xs text-slate-300 leading-relaxed font-mono whitespace-pre-wrap max-h-60 overflow-y-auto">
                {doc.content_markdown || "Contenu du document non disponible."}
              </div>

              {/* Signature électronique : état réel lu en base */}
              {doc.user_acceptance ? (
                <div className="p-5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 space-y-1">
                  <div className="flex items-center gap-2 font-bold text-sm">
                    <CheckCircle2 className="w-5 h-5" /> Document signé (version {doc.current_version})
                  </div>
                  <p className="text-xs text-emerald-300/80">
                    Signature enregistrée le {doc.user_acceptance.timestamp ? new Date(doc.user_acceptance.timestamp).toLocaleString("fr-FR") : "—"}.
                  </p>
                </div>
              ) : (
                <div className="p-5 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-4">
                  <div className="space-y-2 text-xs text-slate-300">
                    <label className="flex items-start gap-3 cursor-pointer">
                      <Checkbox id={`chk-read-${doc.id}`} checked={tickOf(doc.id).read} onCheckedChange={(val) => setTick(doc.id, "read", val === true)} className="mt-0.5" />
                      <span>J'ai lu ce document dans son intégralité.</span>
                    </label>
                    <label className="flex items-start gap-3 cursor-pointer">
                      <Checkbox id={`chk-aware-${doc.id}`} checked={tickOf(doc.id).aware} onCheckedChange={(val) => setTick(doc.id, "aware", val === true)} className="mt-0.5" />
                      <span>Je reconnais avoir pris connaissance de son contenu et de sa portée.</span>
                    </label>
                    <label className="flex items-start gap-3 cursor-pointer">
                      <Checkbox id={`chk-legal-${doc.id}`} checked={tickOf(doc.id).legal} onCheckedChange={(val) => setTick(doc.id, "legal", val === true)} className="mt-0.5" />
                      <span>Je comprends que ce document s'interprète avec les statuts et formalités juridiques applicables d'Ecomfy.</span>
                    </label>
                  </div>

                  <div className="flex justify-end pt-2">
                    <Button
                      onClick={() => handleApproveMandatoryDocument(doc.id, doc.current_version)}
                      disabled={!tickOf(doc.id).read || !tickOf(doc.id).aware || !tickOf(doc.id).legal || approvingId === doc.id}
                      className="bg-[#0E7C66] hover:bg-[#0A6352] text-white font-bold rounded-xl px-6"
                    >
                      {approvingId === doc.id ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <FileCheck className="w-4 h-4 mr-2" />}
                      LIRE ET APPROUVER
                    </Button>
                  </div>
                </div>
              )}
            </Card>
          ))}
        </div>
      </div>

      {/* DOCUMENT VIEWER MODAL */}
      <GovernanceDocumentViewerModal
        document={selectedDocForView ? documents.find((d) => d.id === selectedDocForView.id) ?? selectedDocForView : null}
        isOpen={isDocViewerOpen}
        onClose={() => setIsDocViewerOpen(false)}
        onApprove={approveDocument}
        onRecordView={recordDocumentView}
      />
    </div>
  );
}
