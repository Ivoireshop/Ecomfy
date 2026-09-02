import { useState } from "react";
import { Link } from "react-router-dom";
import { useCorporateGovernance } from "@/hooks/useCorporateGovernance";
import { GovernanceDocumentViewerModal } from "@/components/governance/GovernanceDocumentViewerModal";
import { CreateDocumentModal } from "@/components/governance/CreateDocumentModal";
import { CorporateDocument } from "@/types/corporate";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Crown,
  ShieldCheck,
  Building2,
  FileText,
  TrendingUp,
  PieChart,
  Users,
  Briefcase,
  AlertTriangle,
  Clock,
  Sparkles,
  Loader2,
  PlusCircle,
  FileCheck,
  History,
  Lock,
  ArrowRight,
  ShieldAlert,
  UserX,
  Code,
  CheckCircle2,
  AlertCircle,
  Eye,
  FolderText,
  Mail,
  Copy,
  Send,
  UserCheck
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export default function CorporateGovernance() {
  const {
    loading,
    company,
    shareholders,
    documents,
    proposals,
    ipAssets,
    auditLogs,
    fetchCorporateData,
    recordDocumentView,
    createDocument,
    createProposal,
    updateProposalStatus,
    approveDocument
  } = useCorporateGovernance();

  // Document Viewer & Creation Modal State
  const [selectedDocForView, setSelectedDocForView] = useState<CorporateDocument | null>(null);
  const [isDocViewerOpen, setIsDocViewerOpen] = useState(false);
  const [isCreateDocModalOpen, setIsCreateDocModalOpen] = useState(false);

  // New Proposal Form State
  const [isProposalDialogOpen, setIsProposalDialogOpen] = useState(false);
  const [proposalTitle, setProposalTitle] = useState("");
  const [beneficiaryId, setBeneficiaryId] = useState("");
  const [proposedPct, setProposedPct] = useState<number>(5.0);
  const [proposalRationale, setProposalRationale] = useState("");
  const [isSubmittingProposal, setIsSubmittingProposal] = useState(false);

  // Invite Shareholder Modal State
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [inviteFullName, setInviteFullName] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("shareholder");
  const [invitePct, setInvitePct] = useState<number>(10.0);
  const [isSendingInvite, setIsSendingInvite] = useState(false);

  // Electronic Signature Audit Modal
  const [selectedAuditShareholder, setSelectedAuditShareholder] = useState<any>(null);

  const handleCreateProposalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!proposalTitle || !beneficiaryId || !proposedPct || !proposalRationale) return;

    setIsSubmittingProposal(true);
    try {
      await createProposal({
        title: proposalTitle,
        beneficiary_shareholder_id: beneficiaryId,
        proposed_percentage: proposedPct,
        rationale: proposalRationale,
        proposed_by: "ulrich-admin",
      });

      setIsProposalDialogOpen(false);
      setProposalTitle("");
      setBeneficiaryId("");
      setProposedPct(5.0);
      setProposalRationale("");
    } catch (e) {
      console.error(e);
    } finally {
      setIsSubmittingProposal(false);
    }
  };

  const handleSendInviteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteFullName.trim() || !inviteEmail.trim()) return;

    setIsSendingInvite(true);
    try {
      const inviteToken = `inv-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
      const targetShares = (invitePct / 100) * (company?.total_authorized_shares || 1000000);

      // Save or update shareholder record with pending_onboarding status
      const { data: newSh, error: shErr } = await supabase
        .from("corporate_shareholders" as any)
        .upsert({
          email: inviteEmail.trim().toLowerCase(),
          full_name: inviteFullName.trim(),
          corporate_role: inviteRole,
          is_main_founder: false,
          onboarding_level: 1,
          onboarding_completed: false,
          mfa_enabled: false,
          created_at: new Date().toISOString(),
        }, { onConflict: "email" })
        .select()
        .single();

      if (shErr) throw shErr;

      if (newSh) {
        await supabase
          .from("corporate_share_allocations" as any)
          .upsert({
            shareholder_id: (newSh as any).id,
            target_percentage: invitePct,
            target_shares: targetShares,
            vested_percentage: 0.0,
            vested_shares: 0.0,
            status: "vesting",
          });
      }

      // Invoke real Email Edge Function
      const { data: edgeRes } = await supabase.functions.invoke("send-corporate-invite", {
        body: {
          email: inviteEmail.trim().toLowerCase(),
          fullName: inviteFullName.trim(),
          role: inviteRole,
          targetPercentage: invitePct,
          targetShares,
          inviteToken,
          originUrl: window.location.origin,
        }
      });

      const onboardingLink = `${window.location.origin}/governance/onboarding?token=${inviteToken}&email=${encodeURIComponent(inviteEmail.trim())}`;
      
      toast.success(edgeRes?.message || "Invitation générée avec succès !");
      navigator.clipboard.writeText(onboardingLink);
      toast.info(`Lien d'invitation copié dans le presse-papier : ${onboardingLink}`);

      setIsInviteModalOpen(false);
      setInviteFullName("");
      setInviteEmail("");
      setInvitePct(10.0);
      fetchCorporateData();
    } catch (err: any) {
      toast.error(err?.message || "Erreur lors de l'envoi de l'invitation");
    } finally {
      setIsSendingInvite(false);
    }
  };

  const handleConfirmShareholder = async (shId: string, name: string) => {
    try {
      await supabase
        .from("corporate_shareholders" as any)
        .update({
          onboarding_completed: true,
          onboarding_level: 7,
          updated_at: new Date().toISOString(),
        })
        .eq("id", shId);

      toast.success(`Le membre ${name} a été confirmé et activé comme administrateur officiel !`);
      fetchCorporateData();
    } catch (err: any) {
      toast.error("Erreur lors de la confirmation");
    }
  };

  const handleResendInvite = async (s: any) => {
    try {
      const inviteToken = `inv-${Date.now()}`;
      const onboardingLink = `${window.location.origin}/governance/onboarding?token=${inviteToken}&email=${encodeURIComponent(s.email)}`;
      
      await supabase.functions.invoke("send-corporate-invite", {
        body: {
          email: s.email,
          fullName: s.full_name,
          role: s.corporate_role,
          targetPercentage: s.allocation?.target_percentage || 10,
          targetShares: s.allocation?.target_shares || 100000,
          inviteToken,
          originUrl: window.location.origin,
        }
      });

      navigator.clipboard.writeText(onboardingLink);
      toast.success(`Invitation renvoyée à ${s.full_name} ! Link copié.`);
    } catch (e) {
      toast.error("Erreur lors de la ré-expédition");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 text-white">
        <div className="text-center space-y-3">
          <Loader2 className="w-10 h-10 animate-spin mx-auto text-[#0E7C66]" />
          <p className="text-sm text-slate-400 font-medium">Chargement du Module Corporate & Governance Ecomfy...</p>
        </div>
      </div>
    );
  }

  // Cap Table Metrics
  const totalShares = company?.total_authorized_shares || 1000000;
  const mainFounderAllocation = shareholders.find(s => s.is_main_founder || s.email.includes("djateulrich"))?.allocation;
  const mainFounderPct = mainFounderAllocation?.target_percentage || 80;

  const vestingBeneficiariesCount = shareholders.filter(s => !s.is_main_founder && !s.email.includes("djateulrich")).length;
  const totalAllocatedPct = shareholders.reduce((acc, s) => acc + (s.allocation?.target_percentage || 0), 0);

  return (
    <div className="min-h-screen bg-[#090D16] text-slate-100 font-inter selection:bg-[#0E7C66] selection:text-white p-4 sm:p-6 lg:p-8 space-y-8">
      
      {/* 1. BRANDING BANNER HEADER */}
      <div className="p-6 sm:p-8 rounded-3xl bg-slate-900/90 border border-slate-800 backdrop-blur-xl shadow-2xl space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#0E7C66]/20 border border-[#0E7C66]/40 flex items-center justify-center">
              <Building2 className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <span className="text-[10px] font-extrabold tracking-widest text-emerald-400 uppercase">ECOMFY CORPORATE SYSTEM</span>
              <h1 className="text-2xl sm:text-3xl font-space font-extrabold text-white">Gouvernance, Cap Table & Vesting</h1>
            </div>
          </div>
          <Badge className="bg-[#0E7C66]/20 text-emerald-400 border border-[#0E7C66]/40 px-3 py-1 font-bold">
            SAS — 1 000 000 Actions
          </Badge>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <p className="text-xs sm:text-sm text-slate-400 max-w-2xl">
            Gestion du Cap Table, moteurs de vesting, documentation juridique, traçabilité des décisions et onboarding des associés.
          </p>

          <div className="flex flex-wrap items-center gap-3">
            <Button onClick={() => setIsInviteModalOpen(true)} className="bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs rounded-xl px-4 py-2 gap-2 shadow-lg shadow-purple-900/30">
              <Mail className="w-4 h-4" />
              <span>Inviter un Associé par Email</span>
            </Button>
            <Button onClick={() => setIsProposalDialogOpen(true)} className="bg-[#0E7C66] hover:bg-[#0A6352] text-white font-bold text-xs rounded-xl px-4 py-2 gap-2 shadow-lg shadow-[#0E7C66]/20">
              <PlusCircle className="w-4 h-4" />
              <span>Nouvelle Proposal Cap Table</span>
            </Button>
          </div>
        </div>
      </div>

      {/* 2. METRICS GRID */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-slate-900/80 border-slate-800 rounded-2xl p-5 shadow-xl">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400">Fondateur Principal</span>
            <Crown className="w-4 h-4 text-amber-400" />
          </div>
          <div className="mt-3">
            <div className="text-2xl font-extrabold text-white">{mainFounderPct} %</div>
            <p className="text-xs text-amber-400/90 font-medium mt-1">ULRICH DJATÉ YAPI (800 000 actions)</p>
          </div>
        </Card>

        <Card className="bg-slate-900/80 border-slate-800 rounded-2xl p-5 shadow-xl">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400">Capital de Référence</span>
            <Building2 className="w-4 h-4 text-blue-400" />
          </div>
          <div className="mt-3">
            <div className="text-2xl font-extrabold text-white">{totalShares.toLocaleString()}</div>
            <p className="text-xs text-slate-400 mt-1">Actions autorisées Ecomfy SAS</p>
          </div>
        </Card>

        <Card className="bg-slate-900/80 border-slate-800 rounded-2xl p-5 shadow-xl">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400">Bénéficiaires Vesting</span>
            <Clock className="w-4 h-4 text-purple-400" />
          </div>
          <div className="mt-3">
            <div className="text-2xl font-extrabold text-purple-300">{vestingBeneficiariesCount} Associés</div>
            <p className="text-xs text-slate-400 mt-1">Désiré Tano (10%) & Couboura Amena (10%)</p>
          </div>
        </Card>

        <Card className="bg-slate-900/80 border-slate-800 rounded-2xl p-5 shadow-xl">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400">Attribution Cible Totale</span>
            <PieChart className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="mt-3">
            <div className="text-2xl font-extrabold text-emerald-400">{totalAllocatedPct} %</div>
            <p className="text-xs text-slate-400 mt-1">100% Attribué (80% Fondateur + 20% Vesting)</p>
          </div>
        </Card>
      </div>

      {/* 3. MAIN OPERATIONAL TABS */}
      <Tabs defaultValue="captable" className="w-full">
        <TabsList className="bg-slate-900 border border-slate-800 rounded-2xl p-1.5 flex flex-wrap gap-1.5">
          <TabsTrigger value="captable" className="rounded-xl text-xs font-bold gap-2 data-[state=active]:bg-[#0E7C66] data-[state=active]:text-white">
            <PieChart className="w-4 h-4" /> Cap Table
          </TabsTrigger>
          <TabsTrigger value="vesting" className="rounded-xl text-xs font-bold gap-2 data-[state=active]:bg-[#0E7C66] data-[state=active]:text-white">
            <Clock className="w-4 h-4" /> Moteur de Vesting
          </TabsTrigger>
          <TabsTrigger value="proposals" className="rounded-xl text-xs font-bold gap-2 data-[state=active]:bg-[#0E7C66] data-[state=active]:text-white">
            <FileText className="w-4 h-4" /> Proposals & Modifications
          </TabsTrigger>
          <TabsTrigger value="documents" className="rounded-xl text-xs font-bold gap-2 data-[state=active]:bg-[#0E7C66] data-[state=active]:text-white">
            <FileCheck className="w-4 h-4" /> Centre Documentaire
          </TabsTrigger>
        </TabsList>

        {/* TAB 1: CAP TABLE TABLE */}
        <TabsContent value="captable" className="mt-6">
          <Card className="bg-slate-900/90 border-slate-800 rounded-3xl p-6 shadow-xl">
            <CardHeader className="p-0 mb-6 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-lg font-bold text-white flex items-center gap-2">
                  <PieChart className="w-5 h-5 text-emerald-400" /> Cap Table & Statut de Confirmation des Associés
                </CardTitle>
                <CardDescription className="text-slate-400 text-xs mt-1">
                  Les membres doivent consulter et signer électroniquement les statuts pour passer au statut d'administrateur actif.
                </CardDescription>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-300">
                  <thead className="bg-slate-950/80 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800">
                    <tr>
                      <th className="p-4">Associé / Membre</th>
                      <th className="p-4">Rôle Corporate</th>
                      <th className="p-4">Participation</th>
                      <th className="p-4">Actions</th>
                      <th className="p-4">Statut d'Approbation</th>
                      <th className="p-4">Actions de Validation</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {shareholders.map((s) => {
                      const isMain = s.is_main_founder || s.email.includes("djateulrich");
                      const isConfirmed = isMain || s.onboarding_completed;
                      const alloc = s.allocation;

                      return (
                        <tr key={s.id} className="hover:bg-slate-800/40 transition-colors">
                          <td className="p-4 font-bold text-white flex items-center gap-2.5">
                            {isMain ? (
                              <Crown className="w-4 h-4 text-amber-400 shrink-0" />
                            ) : (
                              <Users className="w-4 h-4 text-emerald-400 shrink-0" />
                            )}
                            <div>
                              <div>{s.full_name}</div>
                              <div className="text-[11px] font-normal text-slate-500">{s.email}</div>
                            </div>
                          </td>

                          <td className="p-4">
                            {isMain ? (
                              <Badge className="bg-amber-500/20 text-amber-400 border border-amber-500/30 font-bold">
                                Fondateur Principal
                              </Badge>
                            ) : (
                              <Badge className="bg-purple-500/20 text-purple-300 border border-purple-500/30 font-semibold uppercase">
                                {s.corporate_role || 'Associé / Vesting'}
                              </Badge>
                            )}
                          </td>

                          <td className="p-4 font-extrabold text-emerald-400 text-sm">
                            {alloc?.target_percentage || 10} %
                          </td>

                          <td className="p-4 font-mono">
                            {(alloc?.target_shares || 100000).toLocaleString()}
                          </td>

                          <td className="p-4">
                            {isConfirmed ? (
                              <Badge className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-bold flex items-center gap-1.5 w-fit">
                                <CheckCircle2 className="w-3.5 h-3.5" /> Membre Officiel Actif
                              </Badge>
                            ) : (
                              <Badge className="bg-amber-500/20 text-amber-300 border border-amber-500/30 animate-pulse font-bold flex items-center gap-1.5 w-fit">
                                <AlertTriangle className="w-3.5 h-3.5 text-amber-400" /> En attente de signature & approbation
                              </Badge>
                            )}
                          </td>

                          <td className="p-4">
                            {!isMain && (
                              <div className="flex items-center gap-2">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleResendInvite(s)}
                                  className="h-7 text-[11px] border-slate-700 text-slate-300 hover:text-white rounded-lg gap-1"
                                  title="Renvoyer l'email d'invitation"
                                >
                                  <Send className="w-3 h-3 text-purple-400" /> Renvoyer Mail
                                </Button>

                                {!isConfirmed && (
                                  <Button
                                    size="sm"
                                    onClick={() => handleConfirmShareholder(s.id, s.full_name)}
                                    className="h-7 text-[11px] bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg gap-1"
                                    title="Confirmer définitivement l'associé"
                                  >
                                    <UserCheck className="w-3 h-3" /> Valider Membre
                                  </Button>
                                )}
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 2: VESTING ENGINE */}
        <TabsContent value="vesting" className="mt-6 space-y-6">
          <Card className="bg-slate-900/90 border-slate-800 rounded-3xl p-6 shadow-xl">
            <CardHeader className="p-0 mb-6">
              <CardTitle className="text-lg font-bold text-white flex items-center gap-2">
                <Clock className="w-5 h-5 text-purple-400" /> Suivi du Vesting des Associés
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="space-y-4">
                {shareholders.filter(s => !s.is_main_founder).map((s) => (
                  <div key={s.id} className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-white">{s.full_name} ({s.email})</span>
                      <Badge className="bg-purple-500/20 text-purple-300 border border-purple-500/30">
                        Cliff 12 Mois / Vesting 48 Mois
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between text-xs text-slate-400 font-mono">
                      <span>Cible : {s.allocation?.target_percentage || 10}% ({(s.allocation?.target_shares || 100000).toLocaleString()} actions)</span>
                      <span>Acquis : {s.allocation?.vested_percentage || 0}%</span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 3: PROPOSALS */}
        <TabsContent value="proposals" className="mt-6">
          <Card className="bg-slate-900/90 border-slate-800 rounded-3xl p-6 shadow-xl">
            <CardHeader className="p-0 mb-4">
              <CardTitle className="text-lg font-bold text-white">Propositions de modification du Cap Table</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <p className="text-xs text-slate-400">Toutes les modifications du Cap Table doivent faire l'objet d'une proposal validée à 9 étapes.</p>
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 4: CENTRE DOCUMENTAIRE */}
        <TabsContent value="documents" className="mt-6">
          <Card className="bg-slate-900/90 border-slate-800 rounded-3xl p-6 shadow-xl space-y-4">
            <CardHeader className="p-0 mb-2">
              <CardTitle className="text-lg font-bold text-white flex items-center gap-2">
                <FileCheck className="w-5 h-5 text-emerald-400" /> Documents Statutaires et de Gouvernance ({documents.length})
              </CardTitle>
            </CardHeader>
            <div className="space-y-3">
              {documents.map((doc) => (
                <div key={doc.id} className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 flex items-center justify-between">
                  <div className="space-y-1">
                    <span className="font-bold text-sm text-white">{doc.title}</span>
                    <p className="text-xs text-slate-400">{doc.summary || "Document officiel Ecomfy SAS"}</p>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => {
                      setSelectedDocForView(doc);
                      setIsDocViewerOpen(true);
                    }}
                    className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl"
                  >
                    Consulter
                  </Button>
                </div>
              ))}
            </div>
          </Card>
        </TabsContent>
      </Tabs>

      {/* MODAL 1: INVITE SHAREHOLDER VIA EMAIL */}
      <Dialog open={isInviteModalOpen} onOpenChange={setIsInviteModalOpen}>
        <DialogContent className="bg-slate-900 border-slate-800 text-white rounded-3xl sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold flex items-center gap-2">
              <Mail className="w-5 h-5 text-purple-400" /> Invitation Officielle Associé / Cofondateur
            </DialogTitle>
            <DialogDescription className="text-slate-400 text-xs">
              Envoie un email réel et génère le lien sécurisé d'intégration pour signature des statuts Ecomfy.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSendInviteSubmit} className="space-y-4 py-2">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">Nom Complet du Membre</label>
              <Input
                placeholder="Ex: DÉSIRÉ TANO"
                value={inviteFullName}
                onChange={(e) => setInviteFullName(e.target.value)}
                required
                className="bg-slate-950 border-slate-800 rounded-xl"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">Adresse Email Officielle</label>
              <Input
                type="email"
                placeholder="ex: desire.tano@ecomfy.cloud"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                required
                className="bg-slate-950 border-slate-800 rounded-xl"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">Rôle Corporate Attribué</label>
              <Select value={inviteRole} onValueChange={setInviteRole}>
                <SelectTrigger className="bg-slate-950 border-slate-800 rounded-xl">
                  <SelectValue placeholder="Sélectionner le rôle" />
                </SelectTrigger>
                <SelectContent className="bg-slate-900 border-slate-800 text-white">
                  <SelectItem value="co_founder">Co-Fondateur</SelectItem>
                  <SelectItem value="shareholder">Associé / Shareholder</SelectItem>
                  <SelectItem value="investor">Investisseur</SelectItem>
                  <SelectItem value="corporate_admin">Administrateur Corporate</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">Participation Cible (%)</label>
              <Input
                type="number"
                step="0.5"
                value={invitePct}
                onChange={(e) => setInvitePct(parseFloat(e.target.value))}
                required
                className="bg-slate-950 border-slate-800 rounded-xl"
              />
            </div>

            <DialogFooter className="mt-6">
              <Button type="button" variant="outline" onClick={() => setIsInviteModalOpen(false)} className="rounded-xl border-slate-700">
                Annuler
              </Button>
              <Button type="submit" disabled={isSendingInvite} className="bg-purple-600 hover:bg-purple-500 text-white font-bold rounded-xl gap-2">
                {isSendingInvite ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                Envoyer l'Email & Générer Lien
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* MODAL 2: CREATE PROPOSAL */}
      <Dialog open={isProposalDialogOpen} onOpenChange={setIsProposalDialogOpen}>
        <DialogContent className="bg-slate-900 border-slate-800 text-white rounded-3xl sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold flex items-center gap-2">
              <PlusCircle className="w-5 h-5 text-emerald-400" /> Nouvelle Proposition Cap Table
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreateProposalSubmit} className="space-y-4 py-2">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">Titre de la Proposition</label>
              <Input
                placeholder="ex: Attribution proposée à Désiré Tano (+5%)"
                value={proposalTitle}
                onChange={(e) => setProposalTitle(e.target.value)}
                required
                className="bg-slate-950 border-slate-800 rounded-xl"
              />
            </div>
            <DialogFooter className="mt-6">
              <Button type="button" variant="outline" onClick={() => setIsProposalDialogOpen(false)} className="rounded-xl border-slate-700">Annuler</Button>
              <Button type="submit" disabled={isSubmittingProposal} className="bg-[#0E7C66] text-white font-bold rounded-xl">Soumettre</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

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
