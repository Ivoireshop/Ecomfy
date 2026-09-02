import { useState } from "react";
import { Link } from "react-router-dom";
import { useCorporateGovernance } from "@/hooks/useCorporateGovernance";
import { useAuthReady } from "@/hooks/useAuthReady";
import { GovernanceDocumentViewerModal } from "@/components/governance/GovernanceDocumentViewerModal";
import { CorporateDocument } from "@/types/corporate";
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

export default function AssociateSpace() {
  const { user } = useAuthReady();
  const { loading, shareholders, documents, approveDocument, recordDocumentView } = useCorporateGovernance();

  // Document Viewer Modal State
  const [selectedDocForView, setSelectedDocForView] = useState<CorporateDocument | null>(null);
  const [isDocViewerOpen, setIsDocViewerOpen] = useState(false);

  // Onboarding Checklist checkboxes
  const [checkedRead, setCheckedRead] = useState(false);
  const [checkedAware, setCheckedAware] = useState(false);
  const [checkedLegal, setCheckedLegal] = useState(false);
  const [isApproving, setIsApproving] = useState(false);

  // Find user's shareholder profile (or fallback to main founder / guest)
  const currentShareholder = shareholders.find(
    s => s.user_id === user?.id || s.email.toLowerCase() === (user?.email || "").toLowerCase()
  ) || shareholders[0];

  const isMainFounder = currentShareholder?.is_main_founder || user?.email?.toLowerCase().includes("djateulrich");
  const alloc = currentShareholder?.allocation;
  const plan = currentShareholder?.vesting_plan;

  const handleApproveMandatoryDocument = async (docId: string, version: string) => {
    if (!checkedRead || !checkedAware || !checkedLegal) return;
    setIsApproving(true);
    try {
      await approveDocument(
        docId,
        version,
        "J'ai lu, compris et approuvé ce document. Je reconnais que ce document s'interprète avec les statuts et formalités juridiques applicables d'Ecomfy."
      );
    } catch (e) {
      console.error(e);
    } finally {
      setIsApproving(false);
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
            Bonjour, {currentShareholder?.full_name || "Membre Associé"}
          </h1>
          <p className="text-sm text-slate-400 max-w-2xl">
            Consultez votre participation, validez vos documents obligatoires et suivez vos échéances de vesting.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {isMainFounder && (
            <Button asChild className="bg-[#0E7C66] hover:bg-[#0A6352] text-white font-bold rounded-xl px-5">
              <Link to="/corporate-governance">
                <Crown className="w-4 h-4 mr-2 text-amber-400" /> Administration Corporate
              </Link>
            </Button>
          )}
        </div>
      </div>

      {/* METRICS CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        <Card className="bg-slate-900/80 border-slate-800 rounded-2xl p-5 shadow-xl">
          <span className="text-xs font-semibold text-slate-400">Participation Cible</span>
          <div className="mt-3 text-3xl font-extrabold text-emerald-400">
            {alloc?.target_percentage || (isMainFounder ? 80 : 10)} %
          </div>
          <p className="text-xs text-slate-500 mt-1">
            {(alloc?.target_shares || (isMainFounder ? 800000 : 100000)).toLocaleString()} actions attribuées
          </p>
        </Card>

        <Card className="bg-slate-900/80 border-slate-800 rounded-2xl p-5 shadow-xl">
          <span className="text-xs font-semibold text-slate-400">Participation Acquise</span>
          <div className="mt-3 text-3xl font-extrabold text-white">
            {alloc?.vested_percentage || (isMainFounder ? 80 : 0)} %
          </div>
          <p className="text-xs text-slate-500 mt-1">
            {(alloc?.vested_shares || (isMainFounder ? 800000 : 0)).toLocaleString()} actions acquises
          </p>
        </Card>

        <Card className="bg-slate-900/80 border-slate-800 rounded-2xl p-5 shadow-xl">
          <span className="text-xs font-semibold text-slate-400">Régime de Vesting</span>
          <div className="mt-3 text-2xl font-extrabold text-purple-300">
            {isMainFounder ? "Acquis d'Origine" : "Vesting 48 Mois"}
          </div>
          <p className="text-xs text-purple-400/90 font-medium mt-1">
            {isMainFounder ? "Fondateur Principal" : "Cliff 12 mois applicables"}
          </p>
        </Card>
      </div>

      {/* 7-LEVEL ONBOARDING WORKFLOW PROGRESSION */}
      <Card className="bg-slate-900/90 border-slate-800 rounded-3xl p-6 shadow-xl space-y-6">
        <CardHeader className="p-0">
          <CardTitle className="text-lg font-bold text-white flex items-center gap-2">
            <CheckSquare className="w-5 h-5 text-emerald-400" /> Parcours d'Onboarding de l'Associé (7 Niveaux Obligatoires)
          </CardTitle>
          <CardDescription className="text-slate-400 text-xs mt-1">
            Validez chaque étape administrative pour activer pleinement vos privilèges et droits d'associé Ecomfy.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="grid grid-cols-1 md:grid-cols-7 gap-2">
            {[
              { lvl: 1, title: "1. Invitation", desc: "Reçue par email", done: true },
              { lvl: 2, title: "2. Identité MFA", desc: "Email vérifié", done: true },
              { lvl: 3, title: "3. Documents", desc: "Dossier prêt", done: true },
              { lvl: 4, title: "4. Lecture", desc: "Horodatée", done: true },
              { lvl: 5, title: "5. Approbation", desc: "Signature Web", done: currentShareholder?.onboarding_level >= 5 },
              { lvl: 6, title: "6. Activation", desc: "Droits validés", done: currentShareholder?.onboarding_completed },
              { lvl: 7, title: "7. Espace Associé", desc: "Accès complet", done: currentShareholder?.onboarding_completed },
            ].map((step) => (
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
          <FileCheck className="w-5 h-5 text-emerald-400" /> Documents Juridiques à Lire et Approber
        </h3>

        <div className="grid grid-cols-1 gap-6">
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
                    Lecture & Acceptation Obligatoires
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
                {doc.content_markdown || "Contenu du document en cours de chargement..."}
              </div>

              {/* Electronic Approval Form */}
              <div className="p-5 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-4">
                <div className="space-y-2 text-xs text-slate-300">
                  <label className="flex items-start gap-3 cursor-pointer">
                    <Checkbox id="chk-read" checked={checkedRead} onCheckedChange={(val: boolean) => setCheckedRead(val)} className="mt-0.5" />
                    <span>J'ai lu ce document dans son intégralité.</span>
                  </label>
                  <label className="flex items-start gap-3 cursor-pointer">
                    <Checkbox id="chk-aware" checked={checkedAware} onCheckedChange={(val: boolean) => setCheckedAware(val)} className="mt-0.5" />
                    <span>Je reconnais avoir pris connaissance de son contenu et de sa portée.</span>
                  </label>
                  <label className="flex items-start gap-3 cursor-pointer">
                    <Checkbox id="chk-legal" checked={checkedLegal} onCheckedChange={(val: boolean) => setCheckedLegal(val)} className="mt-0.5" />
                    <span>Je comprends que ce document s'interprète avec les statuts et formalités juridiques applicables d'Ecomfy.</span>
                  </label>
                </div>

                <div className="flex justify-end pt-2">
                  <Button
                    onClick={() => handleApproveMandatoryDocument(doc.id, doc.current_version)}
                    disabled={!checkedRead || !checkedAware || !checkedLegal || isApproving}
                    className="bg-[#0E7C66] hover:bg-[#0A6352] text-white font-bold rounded-xl px-6"
                  >
                    {isApproving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <FileCheck className="w-4 h-4 mr-2" />}
                    LIRE ET APPROUVER
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>

      {/* DOCUMENT VIEWER MODAL */}
      <GovernanceDocumentViewerModal
        document={selectedDocForView}
        isOpen={isDocViewerOpen}
        onClose={() => setIsDocViewerOpen(false)}
        onApprove={approveDocument}
        onRecordView={recordDocumentView}
      />
    </div>
  );
}
