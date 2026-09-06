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
  Mail,
  Copy,
  Send,
  UserCheck,
  XCircle,
  RefreshCw,
  Ban,
  Activity
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export default function CorporateGovernance() {
  const {
    loading,
    company,
    shareholders,
    invitations,
    documents,
    proposals,
    ipAssets,
    auditLogs,
    fetchCorporateData,
    recordDocumentView,
    createDocument,
    createProposal,
    updateProposalStatus,
    approveDocument,
    logAudit,
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
    const cleanEmail = inviteEmail.trim().toLowerCase();
    const cleanName = inviteFullName.trim();

    if (!cleanName || !cleanEmail) return;

    setIsSendingInvite(true);
    try {
      // 1. Check if active invitation already exists for this email
      const existingInvite = invitations.find(
        (i) => i.email.toLowerCase() === cleanEmail && !["DECLINED", "REVOKED", "EXPIRED"].includes(i.status)
      );

      if (existingInvite) {
        toast.warning(
          `Une invitation active (${existingInvite.status}) existe déjà pour cette adresse email. Vous pouvez la renvoyer ou la révoquer.`,
          {
            description: `Rôle : ${existingInvite.corporate_role}`,
          }
        );
        setIsSendingInvite(false);
        return;
      }

      const secureToken = `inv-sec-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(); // 7 days expiration
      const targetShares = (invitePct / 100) * (company?.total_authorized_shares || 1000000);

      // 2. Save or update shareholder record with pending_onboarding status
      const { data: newSh, error: shErr } = await supabase
        .from("corporate_shareholders" as any)
        .upsert(
          {
            email: cleanEmail,
            full_name: cleanName,
            corporate_role: inviteRole,
            is_main_founder: false,
            onboarding_level: 1,
            onboarding_completed: false,
            mfa_enabled: false,
            created_at: new Date().toISOString(),
          },
          { onConflict: "email" }
        )
        .select()
        .single();

      if (shErr) throw shErr;

      if (newSh) {
        await supabase.from("corporate_share_allocations" as any).upsert({
          shareholder_id: (newSh as any).id,
          target_percentage: invitePct,
          target_shares: targetShares,
          vested_percentage: 0.0,
          vested_shares: 0.0,
          status: "vesting",
        });
      }

      // 3. Create corporate invitation record
      try {
        await supabase.from("corporate_invitations" as any).insert({
          invite_token: secureToken,
          email: cleanEmail,
          full_name: cleanName,
          corporate_role: inviteRole,
          target_percentage: invitePct,
          target_shares: targetShares,
          status: "PENDING_INVITATION",
          expires_at: expiresAt,
          invited_by_name: "ULRICH DJATÉ YAPI (Fondateur)",
          shareholder_id: newSh?.id || null,
        });
      } catch (e) {
        console.warn("Table corporate_invitations insert fallback:", e);
      }

      // 4. Log INVITATION_CREATED in audit logs
      await logAudit("INVITATION_CREATED", "corporate_invitations", secureToken, null, {
        email: cleanEmail,
        name: cleanName,
        role: inviteRole,
        target_percentage: invitePct,
        expires_at: expiresAt,
      });

      // 5. Invoke Edge Function send-corporate-invite
      const { data: edgeRes, error: edgeErr } = await supabase.functions.invoke("send-corporate-invite", {
        body: {
          email: cleanEmail,
          fullName: cleanName,
          role: inviteRole,
          inviteToken: secureToken,
          originUrl: window.location.origin,
        },
      });

      if (edgeErr) console.error("Edge function error:", edgeErr);

      // Update status to INVITATION_SENT if edge function sent
      if (edgeRes?.emailSent) {
        try {
          await supabase
            .from("corporate_invitations" as any)
            .update({ status: "INVITATION_SENT", updated_at: new Date().toISOString() })
            .eq("invite_token", secureToken);
        } catch {}

        await logAudit("INVITATION_SENT", "corporate_invitations", secureToken, null, { email: cleanEmail });
      }

      const inviteUrl = `${window.location.origin}/governance/invitation/${secureToken}?email=${encodeURIComponent(cleanEmail)}`;
      navigator.clipboard.writeText(inviteUrl);

      // MANDATORY EXACT TOAST MESSAGE PER SPEC
      toast.success("Invitation envoyée avec succès.");
      toast.info(
        "Cette personne doit maintenant ouvrir son invitation, vérifier son adresse email, lire les documents requis et accepter les conditions avant que sa nomination soit activée.",
        { duration: 8000 }
      );

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

  // ACTIVATE ROLE (ACCEPTED -> ACTIVE)
  const handleActivateRole = async (s: any, inv: any) => {
    try {
      const timestamp = new Date().toISOString();

      // 1. Update shareholder status to active/completed
      await supabase
        .from("corporate_shareholders" as any)
        .update({
          onboarding_completed: true,
          onboarding_level: 7,
          updated_at: timestamp,
        })
        .eq("id", s.id);

      // 2. Update invitation status to ACTIVE
      if (inv?.id) {
        await supabase
          .from("corporate_invitations" as any)
          .update({
            status: "ACTIVE",
            activated_at: timestamp,
            updated_at: timestamp,
          })
          .eq("id", inv.id);
      }

      // 3. Log ROLE_ACTIVATED in audit logs
      await logAudit("ROLE_ACTIVATED", "corporate_shareholders", s.id, { status: "ACCEPTED" }, { status: "ACTIVE", role: s.corporate_role });

      toast.success(`Le rôle de ${s.full_name} a été activé avec succès ! Il bénéficie maintenant des accès actifs.`);
      fetchCorporateData();
    } catch (err: any) {
      toast.error("Erreur lors de l'activation du rôle");
    }
  };

  // RESEND INVITATION
  const handleResendInvite = async (s: any, inv?: any) => {
    try {
      const secureToken = `inv-sec-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
      const inviteUrl = `${window.location.origin}/governance/invitation/${secureToken}?email=${encodeURIComponent(s.email)}`;

      // 1. Update or create invitation record with new token and extended expiration
      if (inv?.id) {
        await supabase
          .from("corporate_invitations" as any)
          .update({
            invite_token: secureToken,
            status: "INVITATION_SENT",
            expires_at: expiresAt,
            updated_at: new Date().toISOString(),
          })
          .eq("id", inv.id);
      } else {
        await supabase.from("corporate_invitations" as any).insert({
          invite_token: secureToken,
          email: s.email,
          full_name: s.full_name,
          corporate_role: s.corporate_role,
          target_percentage: s.allocation?.target_percentage || 10,
          status: "INVITATION_SENT",
          expires_at: expiresAt,
          shareholder_id: s.id,
        });
      }

      // 2. Invoke Edge Function
      const { data: edgeRes } = await supabase.functions.invoke("send-corporate-invite", {
        body: {
          email: s.email,
          fullName: s.full_name,
          role: s.corporate_role,
          inviteToken: secureToken,
          originUrl: window.location.origin,
        },
      });

      // 3. Log RESEND_INVITATION in audit log
      await logAudit("RESEND_INVITATION", "corporate_invitations", secureToken, null, { email: s.email, new_token: secureToken });

      navigator.clipboard.writeText(inviteUrl);
      toast.success(`Invitation renvoyée avec succès à ${s.full_name} (${s.email}) !`);
      fetchCorporateData();
    } catch (e) {
      toast.error("Erreur lors du renvoi de l'invitation");
    }
  };

  // REVOKE / CANCEL INVITATION
  const handleRevokeInvite = async (invOrSh: any) => {
    try {
      const timestamp = new Date().toISOString();
      const email = invOrSh.email;

      // Update corporate_invitations status to REVOKED
      await supabase
        .from("corporate_invitations" as any)
        .update({
          status: "REVOKED",
          revoked_at: timestamp,
          updated_at: timestamp,
        })
        .eq("email", email);

      // Log INVITATION_REVOKED in audit log
      await logAudit("INVITATION_REVOKED", "corporate_invitations", invOrSh.id || email, null, { email });

      toast.info(`Invitation pour ${email} révoquée/annulée avec succès.`);
      fetchCorporateData();
    } catch (e) {
      toast.error("Erreur lors de l'annulation de l'invitation");
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
  const mainFounderAllocation = shareholders.find((s) => s.is_main_founder || s.email.includes("djateulrich"))?.allocation;
  const mainFounderPct = mainFounderAllocation?.target_percentage || 80;

  const vestingBeneficiariesCount = shareholders.filter((s) => !s.is_main_founder && !s.email.includes("djateulrich")).length;
  const totalAllocatedPct = shareholders.reduce((acc, s) => acc + (s.allocation?.target_percentage || 0), 0);

  const roleLabels: Record<string, string> = {
    co_founder: "Cofondateur",
    cofounder: "Cofondateur",
    shareholder: "Associé",
    investor: "Investisseur",
    corporate_admin: "Administrateur",
    founder: "Fondateur",
  };

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
              <h1 className="text-2xl sm:text-3xl font-space font-extrabold text-white">Gouvernance, Cap Table & Invitations</h1>
            </div>
          </div>
          <Badge className="bg-[#0E7C66]/20 text-emerald-400 border border-[#0E7C66]/40 px-3 py-1 font-bold">
            SAS — 1 000 000 Actions
          </Badge>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <p className="text-xs sm:text-sm text-slate-400 max-w-2xl">
            Gestion des invitations formelles de gouvernance, suivi du workflow à 8 étapes, Cap Table et validation des nominations.
          </p>

          <div className="flex flex-wrap items-center gap-3">
            <Button
              onClick={() => setIsInviteModalOpen(true)}
              className="bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs rounded-xl px-4 py-2 gap-2 shadow-lg shadow-purple-900/30"
            >
              <Mail className="w-4 h-4" />
              <span>Inviter une personne (Associé, Cofondateur...)</span>
            </Button>
            <Button
              onClick={() => setIsProposalDialogOpen(true)}
              className="bg-[#0E7C66] hover:bg-[#0A6352] text-white font-bold text-xs rounded-xl px-4 py-2 gap-2 shadow-lg shadow-[#0E7C66]/20"
            >
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
      <Tabs defaultValue="invitations" className="w-full">
        <TabsList className="bg-slate-900 border border-slate-800 rounded-2xl p-1.5 flex flex-wrap gap-1.5">
          <TabsTrigger value="invitations" className="rounded-xl text-xs font-bold gap-2 data-[state=active]:bg-[#0E7C66] data-[state=active]:text-white">
            <Mail className="w-4 h-4" /> Invitations & Nominations ({shareholders.length})
          </TabsTrigger>
          <TabsTrigger value="captable" className="rounded-xl text-xs font-bold gap-2 data-[state=active]:bg-[#0E7C66] data-[state=active]:text-white">
            <PieChart className="w-4 h-4" /> Cap Table
          </TabsTrigger>
          <TabsTrigger value="vesting" className="rounded-xl text-xs font-bold gap-2 data-[state=active]:bg-[#0E7C66] data-[state=active]:text-white">
            <Clock className="w-4 h-4" /> Moteur de Vesting
          </TabsTrigger>
          <TabsTrigger value="documents" className="rounded-xl text-xs font-bold gap-2 data-[state=active]:bg-[#0E7C66] data-[state=active]:text-white">
            <FileCheck className="w-4 h-4" /> Centre Documentaire
          </TabsTrigger>
          <TabsTrigger value="audit" className="rounded-xl text-xs font-bold gap-2 data-[state=active]:bg-[#0E7C66] data-[state=active]:text-white">
            <Activity className="w-4 h-4" /> Audit Logs ({auditLogs.length})
          </TabsTrigger>
        </TabsList>

        {/* TAB 1: INVITATIONS & NOMINATIONS TABLE */}
        <TabsContent value="invitations" className="mt-6 space-y-6">
          <Card className="bg-slate-900/90 border-slate-800 rounded-3xl p-6 shadow-xl">
            <CardHeader className="p-0 mb-6 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-lg font-bold text-white flex items-center gap-2">
                  <Mail className="w-5 h-5 text-emerald-400" /> Suivi du Workflow d'Invitation & Statut des Membres
                </CardTitle>
                <CardDescription className="text-slate-400 text-xs mt-1">
                  Les membres doivent ouvrir leur invitation, vérifier leur email, lire les statuts obligatoires et accepter les conditions avant activation par le fondateur.
                </CardDescription>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-300">
                  <thead className="bg-slate-950/80 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800">
                    <tr>
                      <th className="p-4">Membre Invité</th>
                      <th className="p-4">Rôle Proposé / Statut</th>
                      <th className="p-4">Attribution</th>
                      <th className="p-4">Timeline de Progression (8 Étapes)</th>
                      <th className="p-4">Actions Fondateur</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {shareholders.map((s) => {
                      const isMain = s.is_main_founder || s.email.includes("djateulrich");
                      const inv = invitations.find((i) => i.email.toLowerCase() === s.email.toLowerCase());
                      const invStatus = inv?.status || (s.onboarding_completed ? "ACTIVE" : "INVITATION_SENT");
                      const isActivated = isMain || invStatus === "ACTIVE" || (s.onboarding_completed && invStatus !== "ACCEPTED");
                      const isAccepted = invStatus === "ACCEPTED";
                      const alloc = s.allocation;

                      const roleTitle = roleLabels[s.corporate_role] || s.corporate_role;
                      const statusBadgeText = isMain
                        ? "Fondateur Principal (Actif)"
                        : isActivated
                        ? `${roleTitle.toUpperCase()} ACTIF`
                        : `${roleTitle.toUpperCase()} — INVITATION EN ATTENTE`;

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
                              <div className="text-[11px] font-normal text-slate-500 font-mono">{s.email}</div>
                            </div>
                          </td>

                          <td className="p-4 space-y-1">
                            <div>
                              {isMain ? (
                                <Badge className="bg-amber-500/20 text-amber-400 border border-amber-500/30 font-bold">
                                  {statusBadgeText}
                                </Badge>
                              ) : isActivated ? (
                                <Badge className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-bold flex items-center gap-1.5 w-fit">
                                  <CheckCircle2 className="w-3.5 h-3.5" /> {statusBadgeText}
                                </Badge>
                              ) : (
                                <Badge className="bg-purple-500/20 text-purple-300 border border-purple-500/30 font-bold animate-pulse flex items-center gap-1.5 w-fit">
                                  <Clock className="w-3.5 h-3.5" /> {statusBadgeText}
                                </Badge>
                              )}
                            </div>
                            {!isMain && (
                              <div className="text-[10px] text-slate-500">
                                Statut interne : <strong className="text-slate-300 font-mono">{invStatus}</strong>
                              </div>
                            )}
                          </td>

                          <td className="p-4 font-extrabold text-emerald-400 text-sm">
                            {alloc?.target_percentage || 10} %
                            <div className="text-[10px] font-normal font-mono text-slate-400">
                              {(alloc?.target_shares || 100000).toLocaleString()} actions
                            </div>
                          </td>

                          {/* TIMELINE DES 8 ÉTAPES */}
                          <td className="p-4 min-w-[280px]">
                            {isMain ? (
                              <span className="text-[11px] text-amber-400 font-medium">Validation initiale membre fondateur ✓</span>
                            ) : (
                              <div className="space-y-1.5 text-[10px]">
                                <div className="grid grid-cols-4 gap-1">
                                  <span className={`p-1 rounded text-center font-bold ${["PENDING_INVITATION", "INVITATION_SENT", "INVITATION_OPENED", "EMAIL_VERIFIED", "DOCUMENTS_READ", "ACCEPTED", "ACTIVE"].includes(invStatus) ? 'bg-emerald-500/20 text-emerald-300' : 'bg-slate-800 text-slate-500'}`}>
                                    1. Créée ✓
                                  </span>
                                  <span className={`p-1 rounded text-center font-bold ${["INVITATION_SENT", "INVITATION_OPENED", "EMAIL_VERIFIED", "DOCUMENTS_READ", "ACCEPTED", "ACTIVE"].includes(invStatus) ? 'bg-emerald-500/20 text-emerald-300' : 'bg-slate-800 text-slate-500'}`}>
                                    2. Envoyée ✓
                                  </span>
                                  <span className={`p-1 rounded text-center font-bold ${["INVITATION_OPENED", "EMAIL_VERIFIED", "DOCUMENTS_READ", "ACCEPTED", "ACTIVE"].includes(invStatus) ? 'bg-emerald-500/20 text-emerald-300' : 'bg-slate-800 text-slate-500'}`}>
                                    3. Ouverte ✓
                                  </span>
                                  <span className={`p-1 rounded text-center font-bold ${["EMAIL_VERIFIED", "DOCUMENTS_READ", "ACCEPTED", "ACTIVE"].includes(invStatus) ? 'bg-emerald-500/20 text-emerald-300' : 'bg-slate-800 text-slate-500'}`}>
                                    4. Email vérifié ✓
                                  </span>
                                </div>
                                <div className="grid grid-cols-4 gap-1">
                                  <span className={`p-1 rounded text-center font-bold ${["DOCUMENTS_READ", "ACCEPTED", "ACTIVE"].includes(invStatus) ? 'bg-emerald-500/20 text-emerald-300' : 'bg-slate-800 text-slate-500'}`}>
                                    5. Docs lus ✓
                                  </span>
                                  <span className={`p-1 rounded text-center font-bold ${["ACCEPTED", "ACTIVE"].includes(invStatus) ? 'bg-emerald-500/20 text-emerald-300' : 'bg-slate-800 text-slate-500'}`}>
                                    6. Signé ✓
                                  </span>
                                  <span className={`p-1 rounded text-center font-bold ${["ACCEPTED", "ACTIVE"].includes(invStatus) ? 'bg-purple-500/30 text-purple-300 font-extrabold' : 'bg-slate-800 text-slate-500'}`}>
                                    7. Acceptée ✓
                                  </span>
                                  <span className={`p-1 rounded text-center font-bold ${invStatus === "ACTIVE" || s.onboarding_completed ? 'bg-emerald-600 text-white font-extrabold' : 'bg-slate-800 text-slate-500'}`}>
                                    8. Activée ✓
                                  </span>
                                </div>
                              </div>
                            )}
                          </td>

                          {/* ACTIONS FONDATEUR */}
                          <td className="p-4">
                            {!isMain && (
                              <div className="flex flex-wrap items-center gap-1.5">
                                {isAccepted && !isActivated && (
                                  <Button
                                    size="sm"
                                    onClick={() => handleActivateRole(s, inv)}
                                    className="h-7 text-[11px] bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold rounded-lg gap-1 shadow-md shadow-emerald-900/40"
                                    title="Valider et Activer le rôle"
                                  >
                                    <UserCheck className="w-3.5 h-3.5" /> VALIDER & ACTIVER RÔLE
                                  </Button>
                                )}

                                {!isActivated && (
                                  <>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => handleResendInvite(s, inv)}
                                      className="h-7 text-[11px] border-slate-700 text-slate-300 hover:text-white rounded-lg gap-1"
                                      title="Renvoyer l'email d'invitation avec nouveau token"
                                    >
                                      <RefreshCw className="w-3 h-3 text-purple-400" /> Renvoyer
                                    </Button>

                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={() => handleRevokeInvite(inv || s)}
                                      className="h-7 text-[11px] text-red-400 hover:text-red-300 hover:bg-red-950/30 rounded-lg gap-1"
                                      title="Annuler/Révoquer cette invitation"
                                    >
                                      <Ban className="w-3 h-3" /> Annuler
                                    </Button>
                                  </>
                                )}

                                {isActivated && (
                                  <span className="text-[11px] text-emerald-400 font-bold flex items-center gap-1">
                                    <CheckCircle2 className="w-3.5 h-3.5" /> Membre Actif
                                  </span>
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

        {/* TAB 2: CAP TABLE */}
        <TabsContent value="captable" className="mt-6">
          <Card className="bg-slate-900/90 border-slate-800 rounded-3xl p-6 shadow-xl">
            <CardHeader className="p-0 mb-4">
              <CardTitle className="text-lg font-bold text-white flex items-center gap-2">
                <PieChart className="w-5 h-5 text-emerald-400" /> Cap Table Officiel Ecomfy SAS (1 000 000 Actions)
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="space-y-4">
                {shareholders.map((s) => (
                  <div key={s.id} className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 flex items-center justify-between">
                    <div>
                      <div className="font-bold text-white">{s.full_name}</div>
                      <div className="text-xs text-slate-400">{s.email}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-extrabold text-emerald-400">{s.allocation?.target_percentage || 10}%</div>
                      <div className="text-xs text-slate-400 font-mono font-bold">{(s.allocation?.target_shares || 100000).toLocaleString()} actions</div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 3: VESTING ENGINE */}
        <TabsContent value="vesting" className="mt-6 space-y-6">
          <Card className="bg-slate-900/90 border-slate-800 rounded-3xl p-6 shadow-xl">
            <CardHeader className="p-0 mb-6">
              <CardTitle className="text-lg font-bold text-white flex items-center gap-2">
                <Clock className="w-5 h-5 text-purple-400" /> Suivi du Vesting des Associés (Cliff 12m / Vesting 48m)
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="space-y-4">
                {shareholders.filter((s) => !s.is_main_founder).map((s) => (
                  <div key={s.id} className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-white">{s.full_name} ({s.email})</span>
                      <Badge className="bg-purple-500/20 text-purple-300 border border-purple-500/30">
                        Vesting 48 Mois (Cliff 12 Mois)
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
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-white">{doc.title}</span>
                      <Badge className="bg-slate-800 text-slate-300 text-[10px]">{doc.current_version}</Badge>
                    </div>
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

        {/* TAB 5: AUDIT LOGS */}
        <TabsContent value="audit" className="mt-6">
          <Card className="bg-slate-900/90 border-slate-800 rounded-3xl p-6 shadow-xl">
            <CardHeader className="p-0 mb-4">
              <CardTitle className="text-lg font-bold text-white flex items-center gap-2">
                <Activity className="w-5 h-5 text-emerald-400" /> Audit Log Historique Governance
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="space-y-2.5 max-h-[500px] overflow-y-auto pr-2">
                {auditLogs.map((log) => (
                  <div key={log.id} className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 flex items-center justify-between text-xs">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <Badge className="bg-purple-500/20 text-purple-300 border border-purple-500/30 text-[10px] font-mono">
                          {log.action}
                        </Badge>
                        <span className="text-slate-300 font-bold">{log.user_email || 'Système'}</span>
                      </div>
                      <div className="text-[11px] text-slate-500 font-mono">Entity: {log.target_entity} ({log.entity_id || 'n/a'})</div>
                    </div>
                    <div className="text-right text-[10px] text-slate-400 font-mono">
                      {new Date(log.timestamp).toLocaleString('fr-FR')}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* MODAL 1: INVITE MEMBER VIA EMAIL */}
      <Dialog open={isInviteModalOpen} onOpenChange={setIsInviteModalOpen}>
        <DialogContent className="bg-slate-900 border-slate-800 text-white rounded-3xl sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold flex items-center gap-2">
              <Mail className="w-5 h-5 text-purple-400" /> Créer une Invitation de Gouvernance
            </DialogTitle>
            <DialogDescription className="text-slate-400 text-xs">
              Envoie une invitation par email avec un token sécurisé unique (expiration 7 jours). Le membre devra consulter les statuts et accepter les conditions avant activation.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSendInviteSubmit} className="space-y-4 py-2">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">Nom Complet du Destinataire</label>
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
              <label className="text-xs font-semibold text-slate-300">Rôle Proposé</label>
              <Select value={inviteRole} onValueChange={setInviteRole}>
                <SelectTrigger className="bg-slate-950 border-slate-800 rounded-xl">
                  <SelectValue placeholder="Sélectionner le rôle" />
                </SelectTrigger>
                <SelectContent className="bg-slate-900 border-slate-800 text-white">
                  <SelectItem value="cofounder">Cofondateur</SelectItem>
                  <SelectItem value="shareholder">Associé / Actionnaire</SelectItem>
                  <SelectItem value="investor">Investisseur</SelectItem>
                  <SelectItem value="corporate_admin">Administrateur Autorisé</SelectItem>
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

            {/* Récapitulatif exigé */}
            <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-1.5 text-xs text-slate-300">
              <div className="font-bold text-emerald-400 mb-1">RÉCAPITULATIF DE L'INVITATION</div>
              <div>• Nom : <strong>{inviteFullName || '—'}</strong></div>
              <div>• Email : <strong className="font-mono">{inviteEmail || '—'}</strong></div>
              <div>• Rôle proposé : <strong className="text-purple-300">{roleLabels[inviteRole] || inviteRole}</strong></div>
              <div>• Participation : <strong>{invitePct}%</strong> ({((invitePct / 100) * totalShares).toLocaleString()} actions)</div>
              <div>• Documents requis : <strong>3 Documents Statutaires</strong></div>
              <div>• Durée de validité : <strong>7 Jours</strong></div>
            </div>

            <DialogFooter className="mt-6">
              <Button type="button" variant="outline" onClick={() => setIsInviteModalOpen(false)} className="rounded-xl border-slate-700">
                Annuler
              </Button>
              <Button type="submit" disabled={isSendingInvite} className="bg-purple-600 hover:bg-purple-500 text-white font-bold rounded-xl gap-2">
                {isSendingInvite ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                ENVOYER L'INVITATION
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
