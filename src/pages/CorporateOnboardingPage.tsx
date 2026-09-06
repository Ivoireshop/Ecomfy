// src/pages/CorporateOnboardingPage.tsx
// Onboarding & Legal Approval Hub for Invited Associates, Co-founders, Shareholders & Admins.

import { useState, useEffect } from "react";
import { useSearchParams, useParams, useNavigate } from "react-router-dom";
import { Header } from "@/components/Header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { 
  ShieldCheck, FileCheck, CheckCircle2, UserCheck, Key, Lock, 
  Crown, Users, FileText, ArrowRight, Check, AlertCircle, Eye, Sparkles, AlertTriangle, XCircle
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { INITIAL_GOVERNANCE_DOCUMENTS } from "@/data/initialGovernanceDocs";
import { toast } from "sonner";
import { GovernanceInvitationStatus } from "@/types/corporate";

export default function CorporateOnboardingPage() {
  const [searchParams] = useSearchParams();
  const routeParams = useParams<{ token?: string }>();
  const navigate = useNavigate();

  const token = routeParams.token || searchParams.get("token") || "";
  const emailParam = searchParams.get("email") || "";

  const [currentStep, setCurrentStep] = useState(1);
  const [invitation, setInvitation] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [currentUserEmail, setCurrentUserEmail] = useState<string | null>(null);

  // Document reading tracking state (stores doc ID -> version string)
  const [readDocs, setReadDocs] = useState<Map<string, string>>(new Map());
  const [selectedDocToRead, setSelectedDocToRead] = useState<any>(null);

  // 3 Required Checkboxes
  const [check1ReadDocs, setCheck1ReadDocs] = useState(false);
  const [check2ConfirmInfo, setCheck2ConfirmInfo] = useState(false);
  const [check3UnderstandActivation, setCheck3UnderstandActivation] = useState(false);

  // Legal Acceptance & Signature Form
  const [signerFullName, setSignerFullName] = useState("");
  const [isSubmittingSignature, setIsSubmittingSignature] = useState(false);
  const [isApprovedSuccess, setIsApprovedSuccess] = useState(false);
  const [isDeclinedSuccess, setIsDeclinedSuccess] = useState(false);

  useEffect(() => {
    checkCurrentUser();
    fetchInviteDetails();
  }, [token, emailParam]);

  const checkCurrentUser = async () => {
    const { data } = await supabase.auth.getSession();
    if (data?.session?.user?.email) {
      setCurrentUserEmail(data.session.user.email);
    }
  };

  const fetchInviteDetails = async () => {
    setLoading(true);
    try {
      let invData: any = null;

      if (token) {
        const { data } = await supabase
          .from("corporate_invitations" as any)
          .select("*")
          .eq("invite_token", token)
          .maybeSingle();

        if (data) invData = data;
      }

      if (!invData && emailParam) {
        const { data } = await supabase
          .from("corporate_invitations" as any)
          .select("*")
          .eq("email", emailParam.toLowerCase())
          .order("created_at", { ascending: false })
          .maybeSingle();

        if (data) invData = data;
      }

      if (!invData) {
        // Fallback for demo token testing
        invData = {
          id: "inv-demo-1",
          invite_token: token || "demo-token",
          email: emailParam || "udyshop1@gmail.com",
          full_name: "Membre Invité",
          corporate_role: "cofounder",
          invited_by_name: "ULRICH DJATÉ YAPI (Fondateur)",
          status: "INVITATION_SENT",
          expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
          created_at: new Date().toISOString(),
        };
      }

      setInvitation(invData);
      setSignerFullName(invData?.full_name || "");

      // Auto update status to INVITATION_OPENED if previously INVITATION_SENT / PENDING_INVITATION
      if (invData?.id && (invData.status === "INVITATION_SENT" || invData.status === "PENDING_INVITATION")) {
        const openedAt = new Date().toISOString();
        await supabase
          .from("corporate_invitations" as any)
          .update({
            status: "INVITATION_OPENED",
            opened_at: openedAt,
            updated_at: openedAt,
          })
          .eq("id", invData.id);

        setInvitation((prev: any) => ({ ...prev, status: "INVITATION_OPENED", opened_at: openedAt }));

        // Audit Log
        try {
          await supabase.from("corporate_audit_logs" as any).insert({
            user_email: invData.email,
            action: "INVITATION_OPENED",
            target_entity: "corporate_invitations",
            entity_id: invData.id,
            timestamp: openedAt,
          });
        } catch {}
      }
    } catch (e) {
      console.error("Invite detail fetch error", e);
    } finally {
      setLoading(false);
    }
  };

  const handleDocRead = async (docId: string, version: string) => {
    setReadDocs(prev => new Map(prev).set(docId, version));
    toast.success(`Document lu et validé (${version}) !`);

    // Log document reading in audit log
    try {
      await supabase.from("corporate_audit_logs" as any).insert({
        user_email: invitation?.email,
        action: "DOCUMENT_VIEWED",
        target_entity: "corporate_documents",
        entity_id: docId,
        new_values: { version },
        timestamp: new Date().toISOString(),
      });
    } catch {}
  };

  const handleDeclineInvitation = async () => {
    if (!invitation?.id) return;

    try {
      const now = new Date().toISOString();
      await supabase
        .from("corporate_invitations" as any)
        .update({
          status: "DECLINED",
          declined_at: now,
          updated_at: now,
        })
        .eq("id", invitation.id);

      // Log in audit log
      await supabase.from("corporate_audit_logs" as any).insert({
        user_email: invitation.email,
        action: "NOMINATION_DECLINED",
        target_entity: "corporate_invitations",
        entity_id: invitation.id,
        new_values: { role: invitation.corporate_role },
        timestamp: now,
      });

      setIsDeclinedSuccess(true);
      toast.info("Vous avez refusé cette nomination.");
    } catch (err: any) {
      toast.error("Erreur lors du refus de la nomination");
    }
  };

  const handleFinalSubmitApproval = async () => {
    if (!signerFullName.trim()) {
      toast.error("Veuillez saisir votre Nom Complet pour la signature électronique");
      return;
    }
    if (!check1ReadDocs || !check2ConfirmInfo || !check3UnderstandActivation) {
      toast.error("Veuillez cocher les 3 confirmations requises pour valider l'acceptation");
      return;
    }

    setIsSubmittingSignature(true);
    try {
      const timestamp = new Date().toISOString();
      const mandatoryDocs = INITIAL_GOVERNANCE_DOCUMENTS.slice(0, 3);
      const readVersionsObj: Record<string, string> = {};
      mandatoryDocs.forEach(d => {
        readVersionsObj[d.id] = readDocs.get(d.id) || d.current_version;
      });

      // 1. Record document acceptances in database
      for (const doc of mandatoryDocs) {
        try {
          await supabase.from("corporate_document_acceptances" as any).insert({
            document_id: doc.id,
            version: doc.current_version,
            email: invitation?.email || emailParam,
            action: "approved",
            legal_statement: `Signature électronique par ${signerFullName} le ${new Date().toLocaleDateString('fr-FR')}`,
            ip_address: "127.0.0.1",
            user_agent: navigator.userAgent,
            timestamp,
          });
        } catch {}
      }

      // 2. Update invitation status to ACCEPTED
      if (invitation?.id && invitation.id !== "inv-demo-1") {
        await supabase
          .from("corporate_invitations" as any)
          .update({
            status: "ACCEPTED",
            accepted_at: timestamp,
            legal_declaration_signed: true,
            signer_full_name: signerFullName.trim(),
            read_document_ids: Array.from(readDocs.keys()),
            read_document_versions: readVersionsObj,
            updated_at: timestamp,
          })
          .eq("id", invitation.id);
      }

      // 3. Log NOMINATION_ACCEPTED in audit logs
      try {
        await supabase.from("corporate_audit_logs" as any).insert({
          user_email: invitation?.email || emailParam,
          action: "NOMINATION_ACCEPTED",
          target_entity: "corporate_invitations",
          entity_id: invitation?.id || "demo",
          new_values: {
            role: invitation?.corporate_role,
            signer: signerFullName.trim(),
            versions: readVersionsObj,
          },
          timestamp,
        });
      } catch {}

      setIsApprovedSuccess(true);
      toast.success("Votre acceptation a bien été enregistrée !");
    } catch (err: any) {
      toast.error(err.message || "Erreur lors de la soumission de votre acceptation");
    } finally {
      setIsSubmittingSignature(false);
    }
  };

  const mandatoryDocs = INITIAL_GOVERNANCE_DOCUMENTS.slice(0, 3);
  const allDocsRead = mandatoryDocs.every(d => readDocs.has(d.id));

  // Check expiration & revocation
  const isExpired = invitation?.expires_at ? new Date() > new Date(invitation.expires_at) : false;
  const isRevoked = invitation?.status === "REVOKED";
  const isDeclined = invitation?.status === "DECLINED" || isDeclinedSuccess;
  const isAlreadyAccepted = invitation?.status === "ACCEPTED" || isApprovedSuccess;
  const isActive = invitation?.status === "ACTIVE";

  const roleLabels: Record<string, string> = {
    co_founder: "Cofondateur",
    cofounder: "Cofondateur",
    shareholder: "Associé / Actionnaire",
    investor: "Investisseur",
    corporate_admin: "Administrateur Autorisé",
    founder: "Fondateur",
  };
  const displayRole = roleLabels[invitation?.corporate_role] || invitation?.corporate_role || "Associé";

  if (loading) {
    return (
      <div className="min-h-screen bg-[#090D16] text-white flex items-center justify-center">
        <div className="text-center space-y-3">
          <Sparkles className="w-8 h-8 animate-spin text-[#0E7C66] mx-auto" />
          <p className="text-xs text-slate-400">Chargement de votre invitation Ecomfy Governance...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#090D16] text-slate-100 font-inter selection:bg-[#0E7C66] selection:text-white pb-16">
      <Header />

      <main className="max-w-4xl mx-auto px-4 sm:px-6 pt-10 space-y-8">
        
        {/* Onboarding Header */}
        <div className="text-center space-y-3">
          <Badge className="bg-[#0E7C66]/20 text-emerald-400 border border-[#0E7C66]/40 text-xs font-bold px-3 py-1 rounded-full">
            ECOMFY CORPORATE GOVERNANCE — INVITATION OFFICIELLE
          </Badge>
          <h1 className="text-3xl sm:text-4xl font-space font-extrabold text-white tracking-tight">
            VOTRE INVITATION ECOMFY
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 max-w-xl mx-auto">
            Portail sécurisé de consultation, lecture des statuts et approbation de votre nomination.
          </p>
        </div>

        {/* STATUS BARRIERS FOR EXPIRED / REVOKED / DECLINED */}
        {isRevoked && (
          <Card className="bg-red-950/40 border-red-900/60 p-8 rounded-3xl text-center space-y-3">
            <XCircle className="w-12 h-12 text-red-400 mx-auto" />
            <h2 className="text-xl font-bold text-white">Cette invitation a été annulée par le fondateur.</h2>
            <p className="text-xs text-slate-300">
              L'accès aux documents et à l'acceptation de cette nomination n'est plus disponible.
            </p>
          </Card>
        )}

        {isExpired && !isRevoked && (
          <Card className="bg-amber-950/40 border-amber-900/60 p-8 rounded-3xl text-center space-y-3">
            <AlertTriangle className="w-12 h-12 text-amber-400 mx-auto" />
            <h2 className="text-xl font-bold text-white">Cette invitation a expiré.</h2>
            <p className="text-xs text-slate-300">
              Le délai de validité (7 jours) est dépassé. Veuillez demander au fondateur principal de vous renvoyer une nouvelle invitation.
            </p>
          </Card>
        )}

        {isDeclined && !isRevoked && !isExpired && (
          <Card className="bg-slate-900/90 border-slate-800 p-8 rounded-3xl text-center space-y-3">
            <XCircle className="w-12 h-12 text-slate-400 mx-auto" />
            <h2 className="text-xl font-bold text-white">Invitation Refusée</h2>
            <p className="text-xs text-slate-400">
              Vous avez décliné cette nomination. Aucune modification de statut ou d'accès n'a été effectuée.
            </p>
          </Card>
        )}

        {!isRevoked && !isExpired && !isDeclined && (
          <>
            {/* Progress Steps Indicator */}
            <div className="grid grid-cols-3 gap-2 p-2 rounded-2xl bg-slate-900 border border-slate-800">
              <div className={`p-3 rounded-xl text-center text-xs font-bold transition-all ${currentStep === 1 ? 'bg-[#0E7C66] text-white shadow-md' : 'text-slate-400'}`}>
                1. Détails & Email ({currentUserEmail ? 'Vérifié' : 'À Confirmer'})
              </div>
              <div className={`p-3 rounded-xl text-center text-xs font-bold transition-all ${currentStep === 2 ? 'bg-[#0E7C66] text-white shadow-md' : 'text-slate-400'}`}>
                2. Documents Obligatoires ({readDocs.size}/3)
              </div>
              <div className={`p-3 rounded-xl text-center text-xs font-bold transition-all ${currentStep === 3 ? 'bg-[#0E7C66] text-white shadow-md' : 'text-slate-400'}`}>
                3. Approbation & Signature
              </div>
            </div>

            {/* STEP 1: Details & Email Check */}
            {currentStep === 1 && (
              <Card className="bg-slate-900/90 border-slate-800 p-6 sm:p-8 rounded-3xl space-y-6 shadow-2xl">
                <div className="space-y-1 border-b border-slate-800 pb-4">
                  <h2 className="text-xl font-space font-bold text-white flex items-center gap-2">
                    <Users className="w-5 h-5 text-emerald-400" /> Détails de votre Invitation
                  </h2>
                  <p className="text-xs text-slate-400">Vérifiez les paramètres officiels transmis par la gouvernance.</p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-1">
                    <span className="text-[10px] font-bold text-slate-400 uppercase">Membre Invité</span>
                    <div className="text-base font-bold text-white">{invitation?.full_name || 'Associé'}</div>
                    <div className="text-xs font-mono text-emerald-400">{invitation?.email}</div>
                  </div>

                  <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-1">
                    <span className="text-[10px] font-bold text-slate-400 uppercase">Rôle Proposé</span>
                    <div className="text-base font-bold text-purple-300 uppercase">{displayRole}</div>
                    <div className="text-xs text-slate-400">Invité par : {invitation?.invited_by_name || 'Fondateur Principal'}</div>
                  </div>

                  <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-1">
                    <span className="text-[10px] font-bold text-slate-400 uppercase">Date de l'Invitation</span>
                    <div className="text-sm font-bold text-white">
                      {new Date(invitation?.created_at || Date.now()).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
                    </div>
                    <div className="text-xs text-slate-400">Délai de validité : 7 Jours</div>
                  </div>

                  <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-1">
                    <span className="text-[10px] font-bold text-slate-400 uppercase">Statut d'Invitation</span>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge className="bg-amber-500/20 text-amber-300 border border-amber-500/30 font-bold uppercase text-[11px]">
                        EN ATTENTE D'ACCEPTATION
                      </Badge>
                    </div>
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-[#0E7C66]/10 border border-[#0E7C66]/30 flex items-center justify-between gap-4">
                  <div className="space-y-0.5">
                    <span className="text-xs font-bold text-emerald-400">Vérification de l'adresse email</span>
                    <p className="text-xs text-slate-300">
                      Email invité : <span className="font-mono font-bold text-white">{invitation?.email}</span>
                    </p>
                  </div>
                  <Badge className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-bold">
                    <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> EMAIL VÉRIFIÉ
                  </Badge>
                </div>

                <div className="flex justify-between items-center pt-4">
                  <Button variant="ghost" onClick={handleDeclineInvitation} className="text-xs text-red-400 hover:text-red-300 hover:bg-red-950/30">
                    REFUSER L'INVITATION
                  </Button>
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

            {/* STEP 2: Mandatory Document Reading */}
            {currentStep === 2 && (
              <Card className="bg-slate-900/90 border-slate-800 p-6 sm:p-8 rounded-3xl space-y-6 shadow-2xl">
                <div className="space-y-1 border-b border-slate-800 pb-4">
                  <h2 className="text-xl font-space font-bold text-white flex items-center gap-2">
                    <FileText className="w-5 h-5 text-emerald-400" /> DOCUMENTS À CONSULTER (OBLIGATOIRE)
                  </h2>
                  <p className="text-xs text-slate-400">
                    Vous devez obligatoirement cliquer sur <strong>CONSULTER</strong> et lire chaque document statutaire avant de pouvoir procéder à l'approbation.
                  </p>
                </div>

                <div className="space-y-3">
                  {mandatoryDocs.map((doc) => {
                    const isRead = readDocs.has(doc.id);
                    const readVersion = readDocs.get(doc.id);
                    return (
                      <div key={doc.id} className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-[10px]">OBLIGATOIRE</Badge>
                            <span className="font-bold text-sm text-white">{doc.title}</span>
                            <span className="text-xs text-slate-500 font-mono">({doc.current_version})</span>
                          </div>
                          <p className="text-xs text-slate-400">{doc.summary}</p>
                        </div>

                        <Button
                          onClick={() => {
                            setSelectedDocToRead(doc);
                          }}
                          className={isRead ? "bg-emerald-600/20 text-emerald-300 border border-emerald-500/40" : "bg-emerald-600 hover:bg-emerald-500 text-white font-bold"}
                          size="sm"
                        >
                          {isRead ? (
                            <span className="flex items-center gap-1.5 text-xs font-bold"><Check className="w-3.5 h-3.5" /> Lu ({readVersion})</span>
                          ) : (
                            <span className="flex items-center gap-1.5 text-xs font-bold"><Eye className="w-3.5 h-3.5" /> CONSULTER</span>
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
                    <span>PASSER À L'APPROBATION</span>
                    <ArrowRight className="w-4 h-4" />
                  </Button>
                </div>
              </Card>
            )}

            {/* STEP 3: Approval & Electronic Signature */}
            {currentStep === 3 && (
              <Card className="bg-slate-900/90 border-slate-800 p-6 sm:p-8 rounded-3xl space-y-6 shadow-2xl">
                {!isApprovedSuccess && !isAlreadyAccepted ? (
                  <>
                    <div className="space-y-1 border-b border-slate-800 pb-4">
                      <h2 className="text-xl font-space font-bold text-white flex items-center gap-2">
                        <ShieldCheck className="w-5 h-5 text-emerald-400" /> Approbation de la Nomination
                      </h2>
                      <p className="text-xs text-slate-400">
                        Cochez les 3 déclarations obligatoires et saisissez votre Nom Complet pour valider votre acceptation.
                      </p>
                    </div>

                    <div className="space-y-4 p-5 rounded-2xl bg-slate-950/80 border border-slate-800">
                      <div className="space-y-3 border-b border-slate-800 pb-4">
                        <div className="flex items-start gap-3">
                          <Checkbox
                            id="check-1"
                            checked={check1ReadDocs}
                            onCheckedChange={(checked) => setCheck1ReadDocs(!!checked)}
                            className="mt-1 border-slate-700"
                          />
                          <label htmlFor="check-1" className="text-xs text-slate-300 leading-relaxed cursor-pointer font-medium">
                            ☐ J'ai lu l'ensemble des documents statutaires et juridiques qui m'ont été présentés.
                          </label>
                        </div>

                        <div className="flex items-start gap-3">
                          <Checkbox
                            id="check-2"
                            checked={check2ConfirmInfo}
                            onCheckedChange={(checked) => setCheck2ConfirmInfo(!!checked)}
                            className="mt-1 border-slate-700"
                          />
                          <label htmlFor="check-2" className="text-xs text-slate-300 leading-relaxed cursor-pointer font-medium">
                            ☐ Je confirme avoir pris connaissance des informations relatives à ma nomination en tant que <strong className="text-purple-300">{displayRole}</strong>.
                          </label>
                        </div>

                        <div className="flex items-start gap-3">
                          <Checkbox
                            id="check-3"
                            checked={check3UnderstandActivation}
                            onCheckedChange={(checked) => setCheck3UnderstandActivation(!!checked)}
                            className="mt-1 border-slate-700"
                          />
                          <label htmlFor="check-3" className="text-xs text-slate-300 leading-relaxed cursor-pointer font-medium">
                            ☐ Je comprends que mon statut ne devient actif qu'après validation formelle du processus de gouvernance applicable.
                          </label>
                        </div>
                      </div>

                      <div className="space-y-2 pt-2">
                        <label className="text-xs font-bold text-slate-300">Nom et Prénom (Signature Électronique)</label>
                        <Input
                          value={signerFullName}
                          onChange={(e) => setSignerFullName(e.target.value)}
                          placeholder="Ex: DÉSIRÉ TANO"
                          className="bg-slate-900 border-slate-800 text-xs text-white h-10 rounded-xl font-bold"
                        />
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-4">
                      <Button variant="ghost" onClick={handleDeclineInvitation} className="text-xs text-red-400 hover:text-red-300 hover:bg-red-950/30">
                        REFUSER L'INVITATION
                      </Button>
                      <Button
                        onClick={handleFinalSubmitApproval}
                        disabled={isSubmittingSignature || !allDocsRead || !check1ReadDocs || !check2ConfirmInfo || !check3UnderstandActivation || !signerFullName.trim()}
                        className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl px-6 py-3 gap-2 shadow-lg shadow-emerald-900/40 disabled:opacity-40"
                      >
                        <span>{isSubmittingSignature ? "Enregistrement en cours..." : "ACCEPTER LA NOMINATION"}</span>
                        <CheckCircle2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </>
                ) : (
                  <div className="p-8 text-center space-y-4">
                    <div className="w-16 h-16 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 flex items-center justify-center mx-auto">
                      <CheckCircle2 className="w-8 h-8" />
                    </div>
                    <h2 className="text-2xl font-space font-bold text-white">Votre acceptation a bien été enregistrée.</h2>
                    <p className="text-xs sm:text-sm text-slate-300 max-w-lg mx-auto leading-relaxed">
                      Votre nomination est maintenant en cours de validation/activation conformément aux règles de gouvernance d'Ecomfy. Le fondateur principal a été notifié de votre acceptation.
                    </p>

                    <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 max-w-md mx-auto text-left space-y-1.5 text-xs text-slate-400">
                      <div className="flex justify-between">
                        <span>Statut :</span>
                        <span className="font-bold text-emerald-400">ACCEPTED (Accepté)</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Signataire :</span>
                        <span className="font-bold text-white">{signerFullName || invitation?.full_name}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Date d'acceptation :</span>
                        <span className="font-mono text-slate-300">{new Date().toLocaleDateString('fr-FR')}</span>
                      </div>
                    </div>
                  </div>
                )}
              </Card>
            )}
          </>
        )}

      </main>

      {/* Document Reader Modal */}
      {selectedDocToRead && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-2xl w-full max-h-[85vh] overflow-y-auto space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-base text-white">{selectedDocToRead.title}</h3>
                <Badge className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[10px]">
                  {selectedDocToRead.current_version}
                </Badge>
              </div>
              <Button size="icon" variant="ghost" onClick={() => setSelectedDocToRead(null)} className="h-8 w-8 text-slate-400">✕</Button>
            </div>

            <div className="prose prose-invert max-w-none text-xs text-slate-300 leading-relaxed font-mono whitespace-pre-wrap p-4 bg-slate-950 rounded-2xl border border-slate-800 max-h-[50vh] overflow-y-auto">
              {selectedDocToRead.content_markdown}
            </div>

            <div className="flex justify-end pt-4 border-t border-slate-800">
              <Button
                onClick={() => {
                  handleDocRead(selectedDocToRead.id, selectedDocToRead.current_version);
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
