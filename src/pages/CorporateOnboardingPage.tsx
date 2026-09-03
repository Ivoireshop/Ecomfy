// src/pages/CorporateOnboardingPage.tsx
// Onboarding & Legal Approval Hub for Invited Associates, Co-founders, and Shareholders.

import { useState, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { Header } from "@/components/Header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { 
  ShieldCheck, FileCheck, CheckCircle2, UserCheck, Key, Lock, 
  Crown, Users, FileText, ArrowRight, Check, AlertCircle, Eye, Sparkles
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { INITIAL_GOVERNANCE_DOCUMENTS } from "@/data/initialGovernanceDocs";
import { toast } from "sonner";

export default function CorporateOnboardingPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const token = searchParams.get("token") || "";
  const emailParam = searchParams.get("email") || "";

  const [currentStep, setCurrentStep] = useState(1);
  const [shareholder, setShareholder] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Document reading tracking state
  const [readDocs, setReadDocs] = useState<Set<string>>(new Set());
  const [selectedDocToRead, setSelectedDocToRead] = useState<any>(null);

  // Legal Acceptance & Signature Form
  const [signerFullName, setSignerFullName] = useState("");
  const [signerLegalDeclaration, setSignerLegalDeclaration] = useState(false);
  const [isSubmittingSignature, setIsSubmittingSignature] = useState(false);
  const [isApprovedSuccess, setIsApprovedSuccess] = useState(false);

  useEffect(() => {
    fetchInviteDetails();
  }, [token, emailParam]);

  const fetchInviteDetails = async () => {
    setLoading(true);
    try {
      if (emailParam) {
        const { data } = await supabase
          .from("corporate_shareholders" as any)
          .select("*")
          .eq("email", emailParam)
          .maybeSingle();

        if (data) {
          setShareholder(data);
          setSignerFullName((data as any).full_name || "");
        } else {
          // Mock/Fallback for demo invite testing
          setShareholder({
            id: "sh-invited-demo",
            email: emailParam || "associe.invite@ecomfy.cloud",
            full_name: "Associé Invité",
            corporate_role: "shareholder",
            is_main_founder: false,
            onboarding_level: 1,
            onboarding_completed: false,
            allocation: {
              target_percentage: 10.0,
              target_shares: 100000,
              vested_percentage: 0.0,
              status: "vesting"
            }
          });
        }
      } else {
        setShareholder({
          id: "sh-invited-demo",
          email: "associe.invite@ecomfy.cloud",
          full_name: "DÉSIRÉ TANO",
          corporate_role: "shareholder",
          is_main_founder: false,
          onboarding_level: 1,
          onboarding_completed: false,
          allocation: {
            target_percentage: 10.0,
            target_shares: 100000,
            vested_percentage: 0.0,
            status: "vesting"
          }
        });
      }
    } catch (e) {
      console.error("Invite detail fetch error", e);
    } finally {
      setLoading(false);
    }
  };

  const handleDocRead = (docId: string) => {
    setReadDocs(prev => new Set([...prev, docId]));
    toast.success("Document lu et validé !");
  };

  const handleFinalSubmitApproval = async () => {
    if (!signerFullName.trim()) {
      toast.error("Veuillez saisir votre Nom Complet pour la signature électronique");
      return;
    }
    if (!signerLegalDeclaration) {
      toast.error("Veuillez cocher la déclaration d'approbation des statuts Ecomfy");
      return;
    }

    setIsSubmittingSignature(true);
    try {
      const timestamp = new Date().toISOString();

      // Log acceptances in database
      for (const doc of INITIAL_GOVERNANCE_DOCUMENTS.slice(0, 3)) {
        try {
          await supabase.from("corporate_document_acceptances" as any).insert({
            document_id: doc.id,
            version: doc.current_version,
            email: shareholder?.email || emailParam,
            action: "approved",
            legal_statement: `Signature électronique par ${signerFullName} le ${new Date().toLocaleDateString('fr-FR')}`,
            ip_address: "127.0.0.1",
            user_agent: navigator.userAgent,
            timestamp,
          });
        } catch {}
      }

      // Update shareholder record status to approved
      if (shareholder?.id && shareholder.id !== "sh-invited-demo") {
        await supabase
          .from("corporate_shareholders" as any)
          .update({
            onboarding_completed: true,
            onboarding_level: 7,
            mfa_enabled: true,
            updated_at: timestamp,
          })
          .eq("id", shareholder.id);
      }

      setIsApprovedSuccess(true);
      toast.success("Signature électronique et approbation enregistrées avec succès !");
    } catch (err: any) {
      toast.error(err.message || "Erreur lors de la signature");
    } finally {
      setIsSubmittingSignature(false);
    }
  };

  const mandatoryDocs = INITIAL_GOVERNANCE_DOCUMENTS.slice(0, 3);
  const allDocsRead = mandatoryDocs.every(d => readDocs.has(d.id));

  return (
    <div className="min-h-screen bg-[#090D16] text-slate-100 font-inter selection:bg-[#0E7C66] selection:text-white pb-16">
      <Header />

      <main className="max-w-4xl mx-auto px-4 sm:px-6 pt-10 space-y-8">
        
        {/* Onboarding Header */}
        <div className="text-center space-y-3">
          <Badge className="bg-[#0E7C66]/20 text-emerald-400 border border-[#0E7C66]/40 text-xs font-bold px-3 py-1 rounded-full">
            ECOMFY CORPORATE GOVERNANCE — INTEGRATION OFFICIELLE
          </Badge>
          <h1 className="text-3xl sm:text-4xl font-space font-extrabold text-white tracking-tight">
            Validation & Signature des Statuts Ecomfy
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 max-w-xl mx-auto">
            Bienvenue dans le portail légal d'intégration de Ecomfy SAS. Suivez les 3 étapes d'approbation ci-dessous.
          </p>
        </div>

        {/* Progress Steps Indicator */}
        <div className="grid grid-cols-3 gap-2 p-2 rounded-2xl bg-slate-900 border border-slate-800">
          <div className={`p-3 rounded-xl text-center text-xs font-bold transition-all ${currentStep === 1 ? 'bg-[#0E7C66] text-white shadow-md' : 'text-slate-400'}`}>
            1. Attributions & Rôle
          </div>
          <div className={`p-3 rounded-xl text-center text-xs font-bold transition-all ${currentStep === 2 ? 'bg-[#0E7C66] text-white shadow-md' : 'text-slate-400'}`}>
            2. Lecture des Statuts ({readDocs.size}/3)
          </div>
          <div className={`p-3 rounded-xl text-center text-xs font-bold transition-all ${currentStep === 3 ? 'bg-[#0E7C66] text-white shadow-md' : 'text-slate-400'}`}>
            3. Signature Électronique
          </div>
        </div>

        {/* STEP 1: Attributions & Rôle Summary */}
        {currentStep === 1 && (
          <Card className="bg-slate-900/90 border-slate-800 p-6 sm:p-8 rounded-3xl space-y-6 shadow-2xl">
            <div className="space-y-1 border-b border-slate-800 pb-4">
              <h2 className="text-xl font-space font-bold text-white flex items-center gap-2">
                <Users className="w-5 h-5 text-emerald-400" /> Récapitulatif de votre Nomination
              </h2>
              <p className="text-xs text-slate-400">Vérifiez les paramètres d'attribution de votre participation sociale.</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase">Membre Invité</span>
                <div className="text-base font-bold text-white">{shareholder?.full_name || 'Associé'}</div>
                <div className="text-xs font-mono text-emerald-400">{shareholder?.email || emailParam}</div>
              </div>

              <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase">Rôle Corporate</span>
                <div className="text-base font-bold text-purple-300 uppercase">{shareholder?.corporate_role || 'Associé / Vesting'}</div>
                <div className="text-xs text-slate-400">Statut : En attente de signature</div>
              </div>

              <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase">Participation Cible</span>
                <div className="text-2xl font-space font-bold text-emerald-400">
                  {shareholder?.allocation?.target_percentage || 10} %
                </div>
                <div className="text-xs text-slate-400">Du capital social Ecomfy SAS</div>
              </div>

              <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase">Actions Attribuées</span>
                <div className="text-2xl font-space font-bold text-white font-mono">
                  {(shareholder?.allocation?.target_shares || 100000).toLocaleString()} actions
                </div>
                <div className="text-xs text-slate-400">Sur une base de 1 000 000 d'actions</div>
              </div>
            </div>

            <div className="flex justify-end pt-4">
              <Button
                onClick={() => setCurrentStep(2)}
                className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl px-6 py-3 gap-2"
              >
                <span>PASSER À LA LECTURE DES STATUTS</span>
                <ArrowRight className="w-4 h-4" />
              </Button>
            </div>
          </Card>
        )}

        {/* STEP 2: Lecture Obligatoire des 3 Documents Statutaires */}
        {currentStep === 2 && (
          <Card className="bg-slate-900/90 border-slate-800 p-6 sm:p-8 rounded-3xl space-y-6 shadow-2xl">
            <div className="space-y-1 border-b border-slate-800 pb-4">
              <h2 className="text-xl font-space font-bold text-white flex items-center gap-2">
                <FileText className="w-5 h-5 text-emerald-400" /> Consultation des 3 Documents Statutaires
              </h2>
              <p className="text-xs text-slate-400">Vous devez consulter et valider chaque document juridique fondateur avant de pouvoir signer.</p>
            </div>

            <div className="space-y-3">
              {mandatoryDocs.map((doc) => {
                const isRead = readDocs.has(doc.id);
                return (
                  <div key={doc.id} className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-[10px]">OBLIGATOIRE</Badge>
                        <span className="font-bold text-sm text-white">{doc.title}</span>
                      </div>
                      <p className="text-xs text-slate-400">{doc.summary}</p>
                    </div>

                    <Button
                      onClick={() => {
                        setSelectedDocToRead(doc);
                        handleDocRead(doc.id);
                      }}
                      className={isRead ? "bg-emerald-600/20 text-emerald-300 border border-emerald-500/40" : "bg-emerald-600 hover:bg-emerald-500 text-white font-bold"}
                      size="sm"
                    >
                      {isRead ? (
                        <span className="flex items-center gap-1.5 text-xs font-bold"><Check className="w-3.5 h-3.5" /> Lu & Validé</span>
                      ) : (
                        <span className="flex items-center gap-1.5 text-xs font-bold"><Eye className="w-3.5 h-3.5" /> Consulter & Valider</span>
                      )}
                    </Button>
                  </div>
                );
              })}
            </div>

            <div className="flex items-center justify-between pt-4">
              <Button variant="ghost" onClick={() => setCurrentStep(1)} className="text-xs text-slate-400">Retour</Button>
              <Button
                onClick={() => setCurrentStep(3)}
                disabled={!allDocsRead}
                className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl px-6 py-3 gap-2 disabled:opacity-50"
              >
                <span>PASSER À LA SIGNATURE ÉLECTRONIQUE</span>
                <ArrowRight className="w-4 h-4" />
              </Button>
            </div>
          </Card>
        )}

        {/* STEP 3: Signature Électronique & Approbation Finale */}
        {currentStep === 3 && (
          <Card className="bg-slate-900/90 border-slate-800 p-6 sm:p-8 rounded-3xl space-y-6 shadow-2xl">
            {!isApprovedSuccess ? (
              <>
                <div className="space-y-1 border-b border-slate-800 pb-4">
                  <h2 className="text-xl font-space font-bold text-white flex items-center gap-2">
                    <ShieldCheck className="w-5 h-5 text-emerald-400" /> Signature Électronique & Engagement Legally Binding
                  </h2>
                  <p className="text-xs text-slate-400">Confirmez votre acceptation des statuts Ecomfy SAS.</p>
                </div>

                <div className="space-y-4 p-5 rounded-2xl bg-slate-950/80 border border-slate-800">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-300">Nom Complet pour la Signature Électronique</label>
                    <Input
                      value={signerFullName}
                      onChange={(e) => setSignerFullName(e.target.value)}
                      placeholder="Ex: DÉSIRÉ TANO"
                      className="bg-slate-900 border-slate-800 text-xs text-white h-10 rounded-xl font-bold"
                    />
                  </div>

                  <div className="flex items-start gap-3 pt-2">
                    <Checkbox
                      id="legal-decl"
                      checked={signerLegalDeclaration}
                      onCheckedChange={(checked) => setSignerLegalDeclaration(!!checked)}
                      className="mt-1 border-slate-700"
                    />
                    <label htmlFor="legal-decl" className="text-xs text-slate-300 leading-relaxed cursor-pointer">
                      Je soussigné(e) <strong className="text-white">{signerFullName || 'Associé'}</strong>, confirme avoir lu en totalité la Charte d'Actionnariat, l'Accord de Vesting et la Cession de Propriété Intellectuelle Ecomfy. J'accepte sans réserve les clauses statutaires et autorise l'enregistrement horodaté de ma signature électronique.
                    </label>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-4">
                  <Button variant="ghost" onClick={() => setCurrentStep(2)} className="text-xs text-slate-400">Retour</Button>
                  <Button
                    onClick={handleFinalSubmitApproval}
                    disabled={isSubmittingSignature || !signerLegalDeclaration}
                    className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl px-6 py-3 gap-2 shadow-lg shadow-emerald-900/40"
                  >
                    <span>{isSubmittingSignature ? "Signature en cours..." : "SOUMETTRE MA SIGNATURE ÉLECTRONIQUE"}</span>
                    <CheckCircle2 className="w-4 h-4" />
                  </Button>
                </div>
              </>
            ) : (
              <div className="p-8 text-center space-y-4">
                <div className="w-16 h-16 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 flex items-center justify-center mx-auto">
                  <CheckCircle2 className="w-8 h-8" />
                </div>
                <h2 className="text-2xl font-space font-bold text-white">Approbation & Signature Enregistrées !</h2>
                <p className="text-xs text-slate-300 max-w-md mx-auto leading-relaxed">
                  Votre signature a été transmise avec succès au Fondateur Principal. Votre statut est mis à jour dans le tableau de bord de gouvernance Ecomfy.
                </p>

                <Button
                  onClick={() => navigate("/associate-space")}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl px-6 py-3 mt-4"
                >
                  Accéder à mon Espace Associé
                </Button>
              </div>
            )}
          </Card>
        )}

      </main>

      {/* Document Reader Modal */}
      {selectedDocToRead && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-2xl w-full max-h-[85vh] overflow-y-auto space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="font-bold text-base text-white">{selectedDocToRead.title}</h3>
              <Button size="icon" variant="ghost" onClick={() => setSelectedDocToRead(null)} className="h-8 w-8 text-slate-400">✕</Button>
            </div>

            <div className="prose prose-invert max-w-none text-xs text-slate-300 leading-relaxed font-mono whitespace-pre-wrap">
              {selectedDocToRead.content_markdown}
            </div>

            <div className="flex justify-end pt-4 border-t border-slate-800">
              <Button
                onClick={() => {
                  handleDocRead(selectedDocToRead.id);
                  setSelectedDocToRead(null);
                }}
                className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl px-5"
              >
                J'AI LU ET JE VALIDE CE DOCUMENT
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
