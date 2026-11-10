import { useState } from "react";
import { useCorporateGovernance } from "@/hooks/useCorporateGovernance";
import { GovernanceDocumentViewerModal } from "@/components/governance/GovernanceDocumentViewerModal";
import { CreateDocumentModal } from "@/components/governance/CreateDocumentModal";
import { CorporateDocument } from "@/types/corporate";
import {
  NO_INVITATION,
  checkAllocationRoom,
  computeVestingProgress,
  invitationRank,
  resolveMemberStatus,
  sharesForPercentage,
  summarizeCapTable,
} from "@/lib/governanceMetrics";
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
  Building2,
  Clock,
  Loader2,
  PlusCircle,
  FileCheck,
  CheckCircle2,
  Mail,
  Send,
  UserCheck,
  RefreshCw,
  Ban,
  Activity,
  PieChart,
  Users,
  AlertTriangle,
  Scale,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const fmtDate = (v?: string | null) => (v ? new Date(v).toLocaleDateString("fr-FR") : "—");
const fmtPct = (n: number) => `${Number(n.toFixed(2))} %`;

const PROPOSAL_STATUS_LABELS: Record<string, string> = {
  proposed: "Proposée",
  documentation_required: "Documents requis",
  documentation_verified: "Documents vérifiés",
  approval_required: "Approbation requise",
  approved: "Approuvée",
  rejected: "Rejetée",
  changes_requested: "Modifications demandées",
  legal_formalization_required: "Formalisation juridique requise",
  legal_formalization_completed: "Formalisation juridique terminée",
  cap_table_updated: "Cap table mise à jour",
};

const AUDIT_ACTION_LABELS: Record<string, string> = {
  DOCUMENT_VIEWED: "Document consulté",
  DOCUMENT_APPROVED: "Document signé",
  DOCUMENT_CREATED: "Document créé",
  PROPOSAL_CREATED: "Proposition créée",
  INVITATION_CREATED: "Invitation créée",
  INVITATION_SENT: "Invitation envoyée",
  RESEND_INVITATION: "Invitation renvoyée",
  INVITATION_REVOKED: "Invitation révoquée",
  ROLE_ACTIVATED: "Rôle activé",
};

const roleLabels: Record<string, string> = {
  co_founder: "Cofondateur",
  cofounder: "Cofondateur",
  shareholder: "Associé",
  investor: "Investisseur",
  corporate_admin: "Administrateur",
  founder: "Fondateur",
};

const newToken = () => `inv-sec-${crypto.randomUUID()}`;

export default function CorporateGovernance() {
  const {
    loading,
    loadError,
    actor,
    canWrite,
    company,
    shareholders,
    invitations,
    invitationsAvailable,
    documents,
    proposals,
    auditLogs,
    auditTotal,
    fetchCorporateData,
    recordDocumentView,
    createDocument,
    createProposal,
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
  const [proposedPct, setProposedPct] = useState("");
  const [proposalRationale, setProposalRationale] = useState("");
  const [isSubmittingProposal, setIsSubmittingProposal] = useState(false);

  // Invite Shareholder Modal State
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [inviteFullName, setInviteFullName] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("shareholder");
  const [invitePct, setInvitePct] = useState("");
  const [isSendingInvite, setIsSendingInvite] = useState(false);

  const totalShares = company ? Number(company.total_authorized_shares) : null;
  const cap = summarizeCapTable(shareholders);
  const me = actor
    ? shareholders.find((s) => s.user_id === actor.id || s.email.toLowerCase() === actor.email.toLowerCase())
    : undefined;
  const mainFounderAlloc = cap.mainFounder?.allocation;

  const selectedBeneficiary = shareholders.find((s) => s.id === beneficiaryId);
  const proposedNum = Number(proposedPct);
  const proposalRoom = checkAllocationRoom(shareholders, beneficiaryId || null, proposedNum);
  const inviteNum = Number(invitePct);
  const inviteExisting = shareholders.find((s) => s.email.toLowerCase() === inviteEmail.trim().toLowerCase());
  const inviteRoom = checkAllocationRoom(shareholders, inviteExisting?.id ?? null, inviteNum);

  const resetProposalForm = () => {
    setProposalTitle("");
    setBeneficiaryId("");
    setProposedPct("");
    setProposalRationale("");
  };

  const handleCreateProposalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!proposalTitle.trim() || !beneficiaryId || !proposalRationale.trim()) return;
    if (!proposalRoom.ok) {
      toast.error(`La participation doit être comprise entre 0 et ${proposalRoom.maxPct} % (les autres membres détiennent ${proposalRoom.othersPct} %).`);
      return;
    }

    setIsSubmittingProposal(true);
    try {
      await createProposal({
        title: proposalTitle.trim(),
        beneficiary_shareholder_id: beneficiaryId,
        proposed_percentage: proposedNum,
        rationale: proposalRationale.trim(),
      });
      setIsProposalDialogOpen(false);
      resetProposalForm();
    } catch {
      // le hook a déjà affiché la raison ; on garde la saisie
    } finally {
      setIsSubmittingProposal(false);
    }
  };

  /** Lève l'erreur Supabase : une requête refusée ne doit jamais passer pour un succès. */
  const must = <T extends { error: { message: string } | null }>(res: T, label: string): T => {
    if (res.error) throw new Error(`${label} : ${res.error.message}`);
    return res;
  };

  const handleSendInviteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEmail = inviteEmail.trim().toLowerCase();
    const cleanName = inviteFullName.trim();
    if (!cleanName || !cleanEmail) return;
    if (!company || totalShares === null) {
      toast.error("Capital de référence introuvable : la société n'est pas enregistrée.");
      return;
    }
    if (!invitationsAvailable) {
      toast.error("Le suivi des invitations n'est pas disponible dans cette base.");
      return;
    }

    setIsSendingInvite(true);
    try {
      const existingSh = shareholders.find((s) => s.email.toLowerCase() === cleanEmail);
      if (existingSh && (existingSh.is_main_founder || existingSh.onboarding_completed)) {
        toast.error(`${existingSh.full_name} est déjà membre actif : aucune invitation n'est nécessaire.`);
        return;
      }

      const existingInvite = invitations.find(
        (i) => i.email.toLowerCase() === cleanEmail && !["DECLINED", "REVOKED", "EXPIRED"].includes(i.status),
      );
      if (existingInvite) {
        toast.warning(
          `Une invitation active (${existingInvite.status}) existe déjà pour cette adresse. Vous pouvez la renvoyer ou la révoquer.`,
          { description: `Rôle : ${existingInvite.corporate_role}` },
        );
        return;
      }

      if (!inviteRoom.ok) {
        toast.error(`La participation doit être comprise entre 0 et ${inviteRoom.maxPct} % (les autres membres détiennent ${inviteRoom.othersPct} %).`);
        return;
      }

      const secureToken = newToken();
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
      const targetShares = sharesForPercentage(inviteNum, totalShares);

      // 1. Membre : créé, ou mis à jour s'il existe déjà sans être activé (sans toucher à sa date de création)
      let shareholderId: string;
      if (existingSh) {
        must(
          await supabase
            .from("corporate_shareholders" as never)
            .update({ full_name: cleanName, corporate_role: inviteRole, updated_at: new Date().toISOString() } as never)
            .eq("id", existingSh.id),
          "Mise à jour du membre",
        );
        shareholderId = existingSh.id;
      } else {
        const res = must(
          await supabase
            .from("corporate_shareholders" as never)
            .insert({
              email: cleanEmail,
              full_name: cleanName,
              corporate_role: inviteRole,
              is_main_founder: false,
              onboarding_level: 1,
              onboarding_completed: false,
              mfa_enabled: false,
            } as never)
            .select("id")
            .single(),
          "Création du membre",
        );
        shareholderId = (res.data as unknown as { id: string }).id;
      }

      // 2. Participation : une seule ligne par membre
      if (existingSh?.allocation) {
        must(
          await supabase
            .from("corporate_share_allocations" as never)
            .update({ target_percentage: inviteNum, target_shares: targetShares, updated_at: new Date().toISOString() } as never)
            .eq("shareholder_id", shareholderId),
          "Mise à jour de la participation",
        );
      } else {
        must(
          await supabase.from("corporate_share_allocations" as never).insert({
            shareholder_id: shareholderId,
            target_percentage: inviteNum,
            target_shares: targetShares,
            vested_percentage: 0,
            vested_shares: 0,
            status: "vesting",
          } as never),
          "Création de la participation",
        );
      }

      // 3. Invitation
      must(
        await supabase.from("corporate_invitations" as never).insert({
          invite_token: secureToken,
          email: cleanEmail,
          full_name: cleanName,
          corporate_role: inviteRole,
          target_percentage: inviteNum,
          target_shares: targetShares,
          status: "PENDING_INVITATION",
          expires_at: expiresAt,
          invited_by: actor?.id ?? null,
          invited_by_name: me?.full_name ?? actor?.email ?? null,
          shareholder_id: shareholderId,
        } as never),
        "Création de l'invitation",
      );

      await logAudit("INVITATION_CREATED", "corporate_invitations", secureToken, null, {
        email: cleanEmail,
        name: cleanName,
        role: inviteRole,
        target_percentage: inviteNum,
        expires_at: expiresAt,
      });

      // 4. Envoi de l'e-mail : le résultat réel est annoncé, pas un succès présumé
      const { data: edgeRes, error: edgeErr } = await supabase.functions.invoke("send-corporate-invite", {
        body: { email: cleanEmail, fullName: cleanName, role: inviteRole, inviteToken: secureToken, originUrl: window.location.origin },
      });

      const inviteUrl = `${window.location.origin}/governance/invitation/${secureToken}?email=${encodeURIComponent(cleanEmail)}`;
      let copied = false;
      try {
        await navigator.clipboard.writeText(inviteUrl);
        copied = true;
      } catch {
        // presse-papiers indisponible
      }

      if (!edgeErr && edgeRes?.emailSent) {
        await supabase
          .from("corporate_invitations" as never)
          .update({ status: "INVITATION_SENT", updated_at: new Date().toISOString() } as never)
          .eq("invite_token", secureToken);
        await logAudit("INVITATION_SENT", "corporate_invitations", secureToken, null, { email: cleanEmail });
        toast.success(`Invitation envoyée à ${cleanEmail}.${copied ? " Le lien a aussi été copié." : ""}`);
      } else {
        toast.warning(
          `L'invitation est enregistrée mais l'e-mail n'a pas été envoyé${edgeErr ? ` (${edgeErr.message})` : ""}.`,
          { description: copied ? "Le lien d'invitation a été copié : transmettez-le à la personne." : `Lien : ${inviteUrl}`, duration: 12000 },
        );
      }

      setIsInviteModalOpen(false);
      setInviteFullName("");
      setInviteEmail("");
      setInvitePct("");
      await fetchCorporateData();
    } catch (err: any) {
      toast.error(err?.message || "Erreur lors de la création de l'invitation");
      await fetchCorporateData();
    } finally {
      setIsSendingInvite(false);
    }
  };

  // ACTIVER LE RÔLE (ACCEPTED -> ACTIVE)
  const handleActivateRole = async (s: any, inv: any) => {
    try {
      const timestamp = new Date().toISOString();
      must(
        await supabase
          .from("corporate_shareholders" as never)
          .update({ onboarding_completed: true, onboarding_level: 7, updated_at: timestamp } as never)
          .eq("id", s.id),
        "Activation du membre",
      );
      if (inv?.id) {
        must(
          await supabase
            .from("corporate_invitations" as never)
            .update({ status: "ACTIVE", activated_at: timestamp, updated_at: timestamp } as never)
            .eq("id", inv.id),
          "Mise à jour de l'invitation",
        );
      }
      await logAudit("ROLE_ACTIVATED", "corporate_shareholders", s.id, { status: inv?.status ?? null }, { status: "ACTIVE", role: s.corporate_role });
      toast.success(`Le rôle de ${s.full_name} est activé.`);
    } catch (err: any) {
      toast.error(err?.message || "Erreur lors de l'activation du rôle");
    } finally {
      await fetchCorporateData();
    }
  };

  // RENVOYER L'INVITATION (nouveau jeton, nouvelle échéance)
  const handleResendInvite = async (s: any, inv?: any) => {
    if (!inv?.id) {
      toast.error("Aucune invitation enregistrée pour ce membre : créez-en une avec « Inviter une personne ».");
      return;
    }
    try {
      const secureToken = newToken();
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
      const inviteUrl = `${window.location.origin}/governance/invitation/${secureToken}?email=${encodeURIComponent(s.email)}`;

      must(
        await supabase
          .from("corporate_invitations" as never)
          .update({ invite_token: secureToken, status: "PENDING_INVITATION", expires_at: expiresAt, revoked_at: null, updated_at: new Date().toISOString() } as never)
          .eq("id", inv.id),
        "Mise à jour de l'invitation",
      );

      const { data: edgeRes, error: edgeErr } = await supabase.functions.invoke("send-corporate-invite", {
        body: { email: s.email, fullName: s.full_name, role: s.corporate_role, inviteToken: secureToken, originUrl: window.location.origin },
      });

      await logAudit("RESEND_INVITATION", "corporate_invitations", inv.id, null, { email: s.email });

      let copied = false;
      try {
        await navigator.clipboard.writeText(inviteUrl);
        copied = true;
      } catch {
        // presse-papiers indisponible
      }

      if (!edgeErr && edgeRes?.emailSent) {
        await supabase
          .from("corporate_invitations" as never)
          .update({ status: "INVITATION_SENT", updated_at: new Date().toISOString() } as never)
          .eq("id", inv.id);
        toast.success(`Invitation renvoyée à ${s.full_name} (${s.email}).`);
      } else {
        toast.warning(`Nouveau lien créé mais e-mail non envoyé${edgeErr ? ` (${edgeErr.message})` : ""}.`, {
          description: copied ? "Le lien a été copié : transmettez-le à la personne." : `Lien : ${inviteUrl}`,
          duration: 12000,
        });
      }
    } catch (err: any) {
      toast.error(err?.message || "Erreur lors du renvoi de l'invitation");
    } finally {
      await fetchCorporateData();
    }
  };

  // RÉVOQUER L'INVITATION
  const handleRevokeInvite = async (inv: any, s: any) => {
    if (!inv?.id) {
      toast.error("Aucune invitation enregistrée à révoquer pour ce membre.");
      return;
    }
    try {
      const timestamp = new Date().toISOString();
      must(
        await supabase
          .from("corporate_invitations" as never)
          .update({ status: "REVOKED", revoked_at: timestamp, updated_at: timestamp } as never)
          .eq("id", inv.id),
        "Révocation",
      );
      await logAudit("INVITATION_REVOKED", "corporate_invitations", inv.id, { status: inv.status }, { email: s.email, status: "REVOKED" });
      toast.info(`Invitation de ${s.email} révoquée.`);
    } catch (err: any) {
      toast.error(err?.message || "Erreur lors de la révocation");
    } finally {
      await fetchCorporateData();
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 text-white">
        <div className="text-center space-y-3">
          <Loader2 className="w-10 h-10 animate-spin mx-auto text-[#0E7C66]" />
          <p className="text-sm text-slate-400 font-medium">Chargement du module Corporate & Governance Ecomfy...</p>
        </div>
      </div>
    );
  }

  const companyLabel = company ? `${company.legal_status} ${company.name}` : "Société non enregistrée";
  const sharesLabel = totalShares !== null ? `${totalShares.toLocaleString("fr-FR")} actions` : "capital non renseigné";
  const mainFounderName = cap.mainFounder?.full_name ?? "Aucun fondateur principal enregistré";

  return (
    <div className="min-h-screen bg-[#090D16] text-slate-100 font-inter selection:bg-[#0E7C66] selection:text-white p-4 sm:p-6 lg:p-8 space-y-8">
      {/* 1. EN-TÊTE */}
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
            {company ? `${company.legal_status} — ${sharesLabel}` : companyLabel}
          </Badge>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <p className="text-xs sm:text-sm text-slate-400 max-w-2xl">
            Invitations de gouvernance, cap table, vesting, propositions de capital, documents signés et journal d'audit, tels qu'enregistrés en base.
          </p>

          {canWrite ? (
            <div className="flex flex-wrap items-center gap-3">
              <Button
                onClick={() => setIsInviteModalOpen(true)}
                disabled={!invitationsAvailable || !company}
                title={!invitationsAvailable ? "Le suivi des invitations n'est pas disponible dans cette base" : undefined}
                className="bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs rounded-xl px-4 py-2 gap-2 shadow-lg shadow-purple-900/30 disabled:opacity-50"
              >
                <Mail className="w-4 h-4" />
                <span>Inviter une personne (Associé, Cofondateur...)</span>
              </Button>
              <Button
                onClick={() => setIsProposalDialogOpen(true)}
                disabled={!company || shareholders.length === 0}
                className="bg-[#0E7C66] hover:bg-[#0A6352] text-white font-bold text-xs rounded-xl px-4 py-2 gap-2 shadow-lg shadow-[#0E7C66]/20 disabled:opacity-50"
              >
                <PlusCircle className="w-4 h-4" />
                <span>Nouvelle proposition de cap table</span>
              </Button>
            </div>
          ) : (
            <Badge variant="outline" className="border-slate-700 text-slate-400 w-fit">
              Lecture seule : seuls les fondateurs et cofondateurs peuvent modifier
            </Badge>
          )}
        </div>
      </div>

      {loadError && (
        <div className="flex items-start gap-3 rounded-2xl border border-amber-500/40 bg-amber-500/10 p-4 text-xs text-amber-200">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-400" />
          <div>
            <div className="font-bold text-amber-300">Certaines données n'ont pas pu être lues</div>
            <div className="mt-1 font-mono text-[11px] break-words">{loadError}</div>
          </div>
        </div>
      )}
      {!invitationsAvailable && (
        <div className="flex items-start gap-3 rounded-2xl border border-slate-700 bg-slate-900 p-4 text-xs text-slate-300">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-slate-400" />
          <div>
            <div className="font-bold text-white">Suivi des invitations indisponible</div>
            <div className="mt-1">La table des invitations n'existe pas dans cette base : aucune invitation ne peut être créée ni suivie. Les statuts ci-dessous ne viennent que des fiches membres.</div>
          </div>
        </div>
      )}
      {!company && (
        <div className="flex items-start gap-3 rounded-2xl border border-amber-500/40 bg-amber-500/10 p-4 text-xs text-amber-200">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-400" />
          <div>Aucune société n'est enregistrée : le capital de référence est inconnu, les pourcentages ne peuvent pas être convertis en actions.</div>
        </div>
      )}

      {/* 2. INDICATEURS (tous calculés sur les lignes de la base) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-slate-900/80 border-slate-800 rounded-2xl p-5 shadow-xl">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400">Fondateur principal</span>
            <Crown className="w-4 h-4 text-amber-400" />
          </div>
          <div className="mt-3">
            <div className="text-2xl font-extrabold text-white">
              {mainFounderAlloc ? fmtPct(Number(mainFounderAlloc.target_percentage)) : "—"}
            </div>
            <p className="text-xs text-amber-400/90 font-medium mt-1">
              {mainFounderName}
              {mainFounderAlloc ? ` (${Number(mainFounderAlloc.target_shares).toLocaleString("fr-FR")} actions)` : ""}
            </p>
          </div>
        </Card>

        <Card className="bg-slate-900/80 border-slate-800 rounded-2xl p-5 shadow-xl">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400">Capital de référence</span>
            <Building2 className="w-4 h-4 text-blue-400" />
          </div>
          <div className="mt-3">
            <div className="text-2xl font-extrabold text-white">{totalShares !== null ? totalShares.toLocaleString("fr-FR") : "—"}</div>
            <p className="text-xs text-slate-400 mt-1">Actions autorisées {company?.name ?? ""}</p>
          </div>
        </Card>

        <Card className="bg-slate-900/80 border-slate-800 rounded-2xl p-5 shadow-xl">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400">Bénéficiaires hors fondateur</span>
            <Clock className="w-4 h-4 text-purple-400" />
          </div>
          <div className="mt-3">
            <div className="text-2xl font-extrabold text-purple-300">{cap.beneficiaries.length}</div>
            <p className="text-xs text-slate-400 mt-1">
              {cap.beneficiaries.length === 0
                ? "Aucune participation enregistrée"
                : cap.beneficiaries
                    .map((b) => `${b.full_name} (${fmtPct(Number(b.allocation?.target_percentage ?? 0))})`)
                    .join(" · ")}
            </p>
          </div>
        </Card>

        <Card className="bg-slate-900/80 border-slate-800 rounded-2xl p-5 shadow-xl">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400">Attribution cible totale</span>
            <PieChart className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="mt-3">
            <div className={`text-2xl font-extrabold ${cap.overAllocatedPct > 0 ? "text-red-400" : "text-emerald-400"}`}>{fmtPct(cap.allocatedPct)}</div>
            <p className="text-xs text-slate-400 mt-1">
              {cap.complete
                ? "Capital entièrement attribué"
                : cap.overAllocatedPct > 0
                  ? `Dépassement de ${fmtPct(cap.overAllocatedPct)} : à corriger`
                  : `${fmtPct(cap.unallocatedPct)} reste à attribuer`}
            </p>
          </div>
        </Card>
      </div>

      {/* 3. ONGLETS */}
      <Tabs defaultValue="invitations" className="w-full">
        <TabsList className="bg-slate-900 border border-slate-800 rounded-2xl p-1.5 flex flex-wrap gap-1.5">
          <TabsTrigger value="invitations" className="rounded-xl text-xs font-bold gap-2 data-[state=active]:bg-[#0E7C66] data-[state=active]:text-white">
            <Mail className="w-4 h-4" /> Membres & invitations ({shareholders.length})
          </TabsTrigger>
          <TabsTrigger value="captable" className="rounded-xl text-xs font-bold gap-2 data-[state=active]:bg-[#0E7C66] data-[state=active]:text-white">
            <PieChart className="w-4 h-4" /> Cap table
          </TabsTrigger>
          <TabsTrigger value="vesting" className="rounded-xl text-xs font-bold gap-2 data-[state=active]:bg-[#0E7C66] data-[state=active]:text-white">
            <Clock className="w-4 h-4" /> Vesting
          </TabsTrigger>
          <TabsTrigger value="proposals" className="rounded-xl text-xs font-bold gap-2 data-[state=active]:bg-[#0E7C66] data-[state=active]:text-white">
            <Scale className="w-4 h-4" /> Propositions ({proposals.length})
          </TabsTrigger>
          <TabsTrigger value="documents" className="rounded-xl text-xs font-bold gap-2 data-[state=active]:bg-[#0E7C66] data-[state=active]:text-white">
            <FileCheck className="w-4 h-4" /> Centre documentaire ({documents.length})
          </TabsTrigger>
          <TabsTrigger value="audit" className="rounded-xl text-xs font-bold gap-2 data-[state=active]:bg-[#0E7C66] data-[state=active]:text-white">
            <Activity className="w-4 h-4" /> Journal d'audit ({auditTotal})
          </TabsTrigger>
        </TabsList>

        {/* MEMBRES & INVITATIONS */}
        <TabsContent value="invitations" className="mt-6 space-y-6">
          <Card className="bg-slate-900/90 border-slate-800 rounded-3xl p-6 shadow-xl">
            <CardHeader className="p-0 mb-6">
              <CardTitle className="text-lg font-bold text-white flex items-center gap-2">
                <Mail className="w-5 h-5 text-emerald-400" /> Suivi des invitations et statut des membres
              </CardTitle>
              <CardDescription className="text-slate-400 text-xs mt-1">
                Chaque étape du parcours n'est cochée que si l'invitation enregistrée l'a atteinte. Un membre sans invitation enregistrée n'est pas présenté comme « invité ».
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {shareholders.length === 0 ? (
                <p className="text-xs text-slate-500 py-6 text-center">Aucun membre enregistré.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs text-slate-300">
                    <thead className="bg-slate-950/80 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800">
                      <tr>
                        <th className="p-4">Membre</th>
                        <th className="p-4">Rôle / statut</th>
                        <th className="p-4">Participation</th>
                        <th className="p-4">Parcours (8 étapes)</th>
                        {canWrite && <th className="p-4">Actions</th>}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {shareholders.map((s) => {
                        const isMain = s.is_main_founder;
                        const inv = invitations.find((i) => i.email.toLowerCase() === s.email.toLowerCase());
                        const st = resolveMemberStatus(s, inv);
                        const rank = invitationRank(st.status);
                        const alloc = s.allocation;
                        const roleTitle = roleLabels[s.corporate_role] || s.corporate_role;
                        const statusBadgeText = isMain
                          ? "Fondateur principal (actif)"
                          : st.isActive
                            ? `${roleTitle.toUpperCase()} ACTIF`
                            : st.status === NO_INVITATION
                              ? `${roleTitle.toUpperCase()} — AUCUNE INVITATION`
                              : `${roleTitle.toUpperCase()} — INVITATION EN COURS`;

                        const stepClass = (min: number, strong = false) =>
                          rank >= min || (st.isActive && !isMain)
                            ? strong
                              ? "bg-purple-500/30 text-purple-300 font-extrabold"
                              : "bg-emerald-500/20 text-emerald-300"
                            : "bg-slate-800 text-slate-500";

                        return (
                          <tr key={s.id} className="hover:bg-slate-800/40 transition-colors">
                            <td className="p-4 font-bold text-white">
                              <div className="flex items-center gap-2.5">
                                {isMain ? <Crown className="w-4 h-4 text-amber-400 shrink-0" /> : <Users className="w-4 h-4 text-emerald-400 shrink-0" />}
                                <div>
                                  <div>{s.full_name}</div>
                                  <div className="text-[11px] font-normal text-slate-500 font-mono">{s.email}</div>
                                </div>
                              </div>
                            </td>

                            <td className="p-4 space-y-1">
                              <div>
                                {isMain ? (
                                  <Badge className="bg-amber-500/20 text-amber-400 border border-amber-500/30 font-bold">{statusBadgeText}</Badge>
                                ) : st.isActive ? (
                                  <Badge className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-bold flex items-center gap-1.5 w-fit">
                                    <CheckCircle2 className="w-3.5 h-3.5" /> {statusBadgeText}
                                  </Badge>
                                ) : (
                                  <Badge className="bg-purple-500/20 text-purple-300 border border-purple-500/30 font-bold flex items-center gap-1.5 w-fit">
                                    <Clock className="w-3.5 h-3.5" /> {statusBadgeText}
                                  </Badge>
                                )}
                              </div>
                              {!isMain && (
                                <div className="text-[10px] text-slate-500">
                                  Statut : <strong className="text-slate-300 font-mono">{st.status === NO_INVITATION ? "aucune invitation enregistrée" : st.status}</strong>
                                  {inv && <span> · expire le {fmtDate(inv.expires_at)}</span>}
                                </div>
                              )}
                            </td>

                            <td className="p-4 font-extrabold text-emerald-400 text-sm">
                              {alloc ? fmtPct(Number(alloc.target_percentage)) : <span className="text-slate-500">—</span>}
                              <div className="text-[10px] font-normal font-mono text-slate-400">
                                {alloc ? `${Number(alloc.target_shares).toLocaleString("fr-FR")} actions` : "aucune participation"}
                              </div>
                            </td>

                            <td className="p-4 min-w-[280px]">
                              {isMain ? (
                                <span className="text-[11px] text-amber-400 font-medium">Fondateur principal : pas de parcours d'invitation</span>
                              ) : (
                                <div className="space-y-1.5 text-[10px]">
                                  <div className="grid grid-cols-4 gap-1">
                                    <span className={`p-1 rounded text-center font-bold ${stepClass(1)}`}>1. Créée</span>
                                    <span className={`p-1 rounded text-center font-bold ${stepClass(2)}`}>2. Envoyée</span>
                                    <span className={`p-1 rounded text-center font-bold ${stepClass(3)}`}>3. Ouverte</span>
                                    <span className={`p-1 rounded text-center font-bold ${stepClass(4)}`}>4. E-mail vérifié</span>
                                  </div>
                                  <div className="grid grid-cols-4 gap-1">
                                    <span className={`p-1 rounded text-center font-bold ${stepClass(5)}`}>5. Docs lus</span>
                                    <span className={`p-1 rounded text-center font-bold ${stepClass(6)}`}>6. Signée</span>
                                    <span className={`p-1 rounded text-center font-bold ${stepClass(6, true)}`}>7. Acceptée</span>
                                    <span className={`p-1 rounded text-center font-bold ${st.isActive ? "bg-emerald-600 text-white font-extrabold" : "bg-slate-800 text-slate-500"}`}>8. Activée</span>
                                  </div>
                                </div>
                              )}
                            </td>

                            {canWrite && (
                              <td className="p-4">
                                {!isMain && (
                                  <div className="flex flex-wrap items-center gap-1.5">
                                    {st.isAccepted && !st.isActive && (
                                      <Button
                                        size="sm"
                                        onClick={() => handleActivateRole(s, inv)}
                                        className="h-7 text-[11px] bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold rounded-lg gap-1"
                                      >
                                        <UserCheck className="w-3.5 h-3.5" /> Valider et activer
                                      </Button>
                                    )}

                                    {!st.isActive && inv && (
                                      <>
                                        <Button
                                          size="sm"
                                          variant="outline"
                                          onClick={() => handleResendInvite(s, inv)}
                                          className="h-7 text-[11px] border-slate-700 text-slate-300 hover:text-white rounded-lg gap-1"
                                          title="Renvoyer l'e-mail avec un nouveau jeton"
                                        >
                                          <RefreshCw className="w-3 h-3 text-purple-400" /> Renvoyer
                                        </Button>
                                        {!["REVOKED", "DECLINED"].includes(st.status) && (
                                          <Button
                                            size="sm"
                                            variant="ghost"
                                            onClick={() => handleRevokeInvite(inv, s)}
                                            className="h-7 text-[11px] text-red-400 hover:text-red-300 hover:bg-red-950/30 rounded-lg gap-1"
                                            title="Révoquer cette invitation"
                                          >
                                            <Ban className="w-3 h-3" /> Révoquer
                                          </Button>
                                        )}
                                      </>
                                    )}

                                    {!st.isActive && !inv && (
                                      <span className="text-[11px] text-slate-500">Aucune invitation à gérer</span>
                                    )}

                                    {st.isActive && (
                                      <span className="text-[11px] text-emerald-400 font-bold flex items-center gap-1">
                                        <CheckCircle2 className="w-3.5 h-3.5" /> Membre actif
                                      </span>
                                    )}
                                  </div>
                                )}
                              </td>
                            )}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* CAP TABLE */}
        <TabsContent value="captable" className="mt-6">
          <Card className="bg-slate-900/90 border-slate-800 rounded-3xl p-6 shadow-xl">
            <CardHeader className="p-0 mb-4">
              <CardTitle className="text-lg font-bold text-white flex items-center gap-2">
                <PieChart className="w-5 h-5 text-emerald-400" /> Cap table — {companyLabel} ({sharesLabel})
              </CardTitle>
              <CardDescription className="text-slate-400 text-xs mt-1">
                Participations cibles enregistrées. Total : {fmtPct(cap.allocatedPct)} ({cap.allocatedShares.toLocaleString("fr-FR")} actions)
                {cap.unallocatedPct > 0 ? ` · ${fmtPct(cap.unallocatedPct)} non attribué` : ""}.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {shareholders.length === 0 ? (
                <p className="text-xs text-slate-500 py-6 text-center">Aucun membre enregistré.</p>
              ) : (
                <div className="space-y-4">
                  {shareholders.map((s) => (
                    <div key={s.id} className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 flex items-center justify-between">
                      <div>
                        <div className="font-bold text-white">{s.full_name}</div>
                        <div className="text-xs text-slate-400">{s.email}</div>
                      </div>
                      <div className="text-right">
                        {s.allocation ? (
                          <>
                            <div className="text-lg font-extrabold text-emerald-400">{fmtPct(Number(s.allocation.target_percentage))}</div>
                            <div className="text-xs text-slate-400 font-mono font-bold">
                              {Number(s.allocation.target_shares).toLocaleString("fr-FR")} actions
                            </div>
                            <div className="text-[10px] text-slate-500 font-mono">
                              émises : {Number(s.allocation.legally_issued_shares).toLocaleString("fr-FR")} · acquises : {fmtPct(Number(s.allocation.vested_percentage))}
                            </div>
                          </>
                        ) : (
                          <div className="text-xs text-slate-500">Aucune participation enregistrée</div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* VESTING */}
        <TabsContent value="vesting" className="mt-6 space-y-6">
          <Card className="bg-slate-900/90 border-slate-800 rounded-3xl p-6 shadow-xl">
            <CardHeader className="p-0 mb-6">
              <CardTitle className="text-lg font-bold text-white flex items-center gap-2">
                <Clock className="w-5 h-5 text-purple-400" /> Plans de vesting enregistrés
              </CardTitle>
              <CardDescription className="text-slate-400 text-xs mt-1">
                Éligibilité calculée à partir des dates du plan (rien avant le cliff, puis un mois de plus à chaque mois écoulé). Une part éligible n'est acquise juridiquement qu'une fois formalisée.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {shareholders.filter((s) => !s.is_main_founder).length === 0 ? (
                <p className="text-xs text-slate-500 py-6 text-center">Aucun membre soumis au vesting.</p>
              ) : (
                <div className="space-y-4">
                  {shareholders
                    .filter((s) => !s.is_main_founder)
                    .map((s) => {
                      const plan = s.vesting_plan;
                      const progress = plan ? computeVestingProgress(plan) : null;
                      return (
                        <div key={s.id} className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-2">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <span className="font-bold text-white">
                              {s.full_name} <span className="font-normal text-slate-500">({s.email})</span>
                            </span>
                            {plan ? (
                              <Badge className="bg-purple-500/20 text-purple-300 border border-purple-500/30">
                                {plan.duration_months} mois (cliff {plan.cliff_months} mois) · {plan.status}
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="border-slate-700 text-slate-400">Aucun plan de vesting enregistré</Badge>
                            )}
                          </div>
                          {plan && progress ? (
                            <>
                              <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400 font-mono">
                                <span>
                                  Cible : {fmtPct(Number(plan.target_percentage))} ({Number(plan.target_shares).toLocaleString("fr-FR")} actions)
                                </span>
                                <span>
                                  Éligible : {fmtPct(progress.eligiblePct)} ({progress.eligibleShares.toLocaleString("fr-FR")} actions)
                                </span>
                                <span>Acquis formalisé : {fmtPct(Number(s.allocation?.vested_percentage ?? 0))}</span>
                              </div>
                              <div className="h-1.5 rounded-full bg-slate-800 overflow-hidden">
                                <div
                                  className="h-full bg-purple-500"
                                  style={{ width: `${Math.min(100, (progress.eligiblePct / Math.max(Number(plan.target_percentage), 0.0001)) * 100)}%` }}
                                />
                              </div>
                              <div className="text-[11px] text-slate-500">
                                Début {fmtDate(plan.start_date)} · cliff {fmtDate(plan.cliff_date)}
                                {progress.cliffReached ? " (franchi)" : " (à venir)"} · fin {fmtDate(plan.end_date)} · {progress.monthsElapsed} mois écoulés
                              </div>
                              {plan.objectives && <div className="text-[11px] text-slate-400">Objectifs : {plan.objectives}</div>}
                            </>
                          ) : plan ? (
                            <div className="text-xs text-amber-300">Les dates de ce plan sont illisibles : l'éligibilité ne peut pas être calculée.</div>
                          ) : s.allocation ? (
                            <div className="text-xs text-slate-400 font-mono">
                              Cible : {fmtPct(Number(s.allocation.target_percentage))} ({Number(s.allocation.target_shares).toLocaleString("fr-FR")} actions) · acquis formalisé : {fmtPct(Number(s.allocation.vested_percentage))}
                            </div>
                          ) : null}
                        </div>
                      );
                    })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* PROPOSITIONS */}
        <TabsContent value="proposals" className="mt-6">
          <Card className="bg-slate-900/90 border-slate-800 rounded-3xl p-6 shadow-xl">
            <CardHeader className="p-0 mb-4">
              <CardTitle className="text-lg font-bold text-white flex items-center gap-2">
                <Scale className="w-5 h-5 text-emerald-400" /> Propositions de changement de cap table
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {proposals.length === 0 ? (
                <p className="text-xs text-slate-500 py-6 text-center">Aucune proposition déposée.</p>
              ) : (
                <div className="space-y-3">
                  {proposals.map((p) => {
                    const ben = shareholders.find((s) => s.id === p.beneficiary_shareholder_id);
                    return (
                      <div key={p.id} className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-1.5">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="font-bold text-white text-sm">
                            #{p.proposal_number} — {p.title}
                          </span>
                          <Badge className="bg-slate-800 text-slate-200 border border-slate-700 text-[10px]">
                            {PROPOSAL_STATUS_LABELS[p.status] ?? p.status}
                          </Badge>
                        </div>
                        <div className="text-xs text-slate-400">
                          {ben ? ben.full_name : "Bénéficiaire inconnu"} : {fmtPct(Number(p.current_percentage))} → <strong className="text-emerald-400">{fmtPct(Number(p.proposed_percentage))}</strong>{" "}
                          ({Number(p.proposed_shares).toLocaleString("fr-FR")} actions) · déposée le {fmtDate(p.created_at)}
                        </div>
                        <div className="text-[11px] text-slate-500">{p.rationale}</div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* CENTRE DOCUMENTAIRE */}
        <TabsContent value="documents" className="mt-6">
          <Card className="bg-slate-900/90 border-slate-800 rounded-3xl p-6 shadow-xl space-y-4">
            <CardHeader className="p-0 mb-2 flex flex-row items-center justify-between gap-3">
              <CardTitle className="text-lg font-bold text-white flex items-center gap-2">
                <FileCheck className="w-5 h-5 text-emerald-400" /> Documents statutaires et de gouvernance ({documents.length})
              </CardTitle>
              {canWrite && (
                <Button onClick={() => setIsCreateDocModalOpen(true)} className="bg-[#0E7C66] hover:bg-[#0A6352] text-white font-bold text-xs rounded-xl gap-2">
                  <PlusCircle className="w-4 h-4" /> Nouveau document
                </Button>
              )}
            </CardHeader>
            {documents.length === 0 ? (
              <p className="text-xs text-slate-500 py-6 text-center">Aucun document enregistré.</p>
            ) : (
              <div className="space-y-3">
                {documents.map((doc) => (
                  <div key={doc.id} className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 flex items-center justify-between gap-3">
                    <div className="space-y-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-bold text-sm text-white">{doc.title}</span>
                        <Badge className="bg-slate-800 text-slate-300 text-[10px]">{doc.current_version}</Badge>
                        {doc.user_acceptance && (
                          <Badge className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[10px]">Signé par vous</Badge>
                        )}
                      </div>
                      <p className="text-xs text-slate-400">{doc.summary || "—"}</p>
                      <p className="text-[11px] text-slate-500">
                        {doc.approvals_count ?? 0} signature{(doc.approvals_count ?? 0) > 1 ? "s" : ""} enregistrée{(doc.approvals_count ?? 0) > 1 ? "s" : ""} pour cette version
                      </p>
                    </div>
                    <Button
                      size="sm"
                      onClick={() => {
                        setSelectedDocForView(doc);
                        setIsDocViewerOpen(true);
                      }}
                      className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shrink-0"
                    >
                      Consulter
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </TabsContent>

        {/* JOURNAL D'AUDIT */}
        <TabsContent value="audit" className="mt-6">
          <Card className="bg-slate-900/90 border-slate-800 rounded-3xl p-6 shadow-xl">
            <CardHeader className="p-0 mb-4">
              <CardTitle className="text-lg font-bold text-white flex items-center gap-2">
                <Activity className="w-5 h-5 text-emerald-400" /> Journal d'audit de la gouvernance
              </CardTitle>
              <CardDescription className="text-slate-400 text-xs mt-1">
                {auditTotal} ligne{auditTotal > 1 ? "s" : ""} au total
                {auditTotal > auditLogs.length ? ` · les ${auditLogs.length} plus récentes sont affichées` : ""}. Le journal est en ajout seul : aucune ligne ne se modifie ni ne s'efface.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {auditLogs.length === 0 ? (
                <p className="text-xs text-slate-500 py-6 text-center">Aucune action enregistrée.</p>
              ) : (
                <div className="space-y-2.5 max-h-[500px] overflow-y-auto pr-2">
                  {auditLogs.map((log) => (
                    <div key={log.id} className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 flex items-center justify-between gap-3 text-xs">
                      <div className="space-y-0.5 min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge className="bg-purple-500/20 text-purple-300 border border-purple-500/30 text-[10px]">
                            {AUDIT_ACTION_LABELS[log.action] ?? log.action}
                          </Badge>
                          <span className="text-slate-300 font-bold">{log.user_email || "Auteur inconnu"}</span>
                        </div>
                        <div className="text-[11px] text-slate-500 font-mono break-all">
                          {log.target_entity}
                          {log.entity_id ? ` · ${log.entity_id}` : ""}
                        </div>
                      </div>
                      <div className="text-right text-[10px] text-slate-400 font-mono shrink-0">
                        {new Date(log.timestamp).toLocaleString("fr-FR")}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* MODALE : INVITER */}
      <Dialog open={isInviteModalOpen} onOpenChange={setIsInviteModalOpen}>
        <DialogContent className="bg-slate-900 border-slate-800 text-white rounded-3xl sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold flex items-center gap-2">
              <Mail className="w-5 h-5 text-purple-400" /> Créer une invitation de gouvernance
            </DialogTitle>
            <DialogDescription className="text-slate-400 text-xs">
              Envoie une invitation par e-mail avec un jeton unique (validité 7 jours). La personne devra consulter les documents et accepter les conditions avant activation.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSendInviteSubmit} className="space-y-4 py-2">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">Nom complet du destinataire</label>
              <Input value={inviteFullName} onChange={(e) => setInviteFullName(e.target.value)} required className="bg-slate-950 border-slate-800 rounded-xl" />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">Adresse e-mail</label>
              <Input type="email" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} required className="bg-slate-950 border-slate-800 rounded-xl" />
              {inviteExisting && (
                <p className="text-[11px] text-amber-300">
                  Un membre existe déjà avec cette adresse ({inviteExisting.full_name}){inviteExisting.is_main_founder || inviteExisting.onboarding_completed ? " et il est actif." : " : sa fiche sera mise à jour."}
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">Rôle proposé</label>
              <Select value={inviteRole} onValueChange={setInviteRole}>
                <SelectTrigger className="bg-slate-950 border-slate-800 rounded-xl">
                  <SelectValue placeholder="Sélectionner le rôle" />
                </SelectTrigger>
                <SelectContent className="bg-slate-900 border-slate-800 text-white">
                  <SelectItem value="cofounder">Cofondateur</SelectItem>
                  <SelectItem value="shareholder">Associé / actionnaire</SelectItem>
                  <SelectItem value="investor">Investisseur</SelectItem>
                  <SelectItem value="corporate_admin">Administrateur autorisé</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">Participation cible (%)</label>
              <Input
                type="number"
                step="0.5"
                min="0"
                value={invitePct}
                onChange={(e) => setInvitePct(e.target.value)}
                required
                className="bg-slate-950 border-slate-800 rounded-xl"
              />
              <p className={`text-[11px] ${invitePct && !inviteRoom.ok ? "text-red-400" : "text-slate-500"}`}>
                Maximum possible : {inviteRoom.maxPct} % (les autres membres détiennent {inviteRoom.othersPct} %).
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-1.5 text-xs text-slate-300">
              <div className="font-bold text-emerald-400 mb-1">Récapitulatif</div>
              <div>• Nom : <strong>{inviteFullName || "—"}</strong></div>
              <div>• E-mail : <strong className="font-mono">{inviteEmail || "—"}</strong></div>
              <div>• Rôle : <strong className="text-purple-300">{roleLabels[inviteRole] || inviteRole}</strong></div>
              <div>
                • Participation : <strong>{invitePct ? `${inviteNum} %` : "—"}</strong>
                {invitePct && totalShares !== null && Number.isFinite(inviteNum) ? ` (${sharesForPercentage(inviteNum, totalShares).toLocaleString("fr-FR")} actions)` : ""}
              </div>
              <div>• Validité : <strong>7 jours</strong></div>
            </div>

            <DialogFooter className="mt-6">
              <Button type="button" variant="outline" onClick={() => setIsInviteModalOpen(false)} className="rounded-xl border-slate-700">Annuler</Button>
              <Button
                type="submit"
                disabled={isSendingInvite || !inviteRoom.ok}
                className="bg-purple-600 hover:bg-purple-500 text-white font-bold rounded-xl gap-2 disabled:opacity-50"
              >
                {isSendingInvite ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                Envoyer l'invitation
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* MODALE : PROPOSITION */}
      <Dialog
        open={isProposalDialogOpen}
        onOpenChange={(open) => {
          setIsProposalDialogOpen(open);
          if (!open) resetProposalForm();
        }}
      >
        <DialogContent className="bg-slate-900 border-slate-800 text-white rounded-3xl sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold flex items-center gap-2">
              <PlusCircle className="w-5 h-5 text-emerald-400" /> Nouvelle proposition de cap table
            </DialogTitle>
            <DialogDescription className="text-slate-400 text-xs">
              Propose de modifier la participation cible d'un membre. La proposition suit le workflow de validation ; la cap table ne change qu'à l'étape finale.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreateProposalSubmit} className="space-y-4 py-2">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">Titre</label>
              <Input value={proposalTitle} onChange={(e) => setProposalTitle(e.target.value)} required className="bg-slate-950 border-slate-800 rounded-xl" />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">Bénéficiaire</label>
              <Select value={beneficiaryId} onValueChange={setBeneficiaryId}>
                <SelectTrigger className="bg-slate-950 border-slate-800 rounded-xl">
                  <SelectValue placeholder="Choisir un membre" />
                </SelectTrigger>
                <SelectContent className="bg-slate-900 border-slate-800 text-white">
                  {shareholders.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.full_name} ({s.allocation ? fmtPct(Number(s.allocation.target_percentage)) : "aucune participation"})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">Participation proposée (%)</label>
              <Input
                type="number"
                step="0.5"
                min="0"
                value={proposedPct}
                onChange={(e) => setProposedPct(e.target.value)}
                required
                className="bg-slate-950 border-slate-800 rounded-xl"
              />
              {beneficiaryId && (
                <p className={`text-[11px] ${proposedPct && !proposalRoom.ok ? "text-red-400" : "text-slate-500"}`}>
                  Actuellement {fmtPct(Number(selectedBeneficiary?.allocation?.target_percentage ?? 0))} · maximum possible {proposalRoom.maxPct} %.
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">Justification</label>
              <Textarea value={proposalRationale} onChange={(e) => setProposalRationale(e.target.value)} required rows={3} className="bg-slate-950 border-slate-800 rounded-xl" />
            </div>

            <DialogFooter className="mt-6">
              <Button type="button" variant="outline" onClick={() => setIsProposalDialogOpen(false)} className="rounded-xl border-slate-700">Annuler</Button>
              <Button
                type="submit"
                disabled={isSubmittingProposal || !beneficiaryId || !proposalRoom.ok}
                className="bg-[#0E7C66] text-white font-bold rounded-xl disabled:opacity-50"
              >
                {isSubmittingProposal && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                Soumettre
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <CreateDocumentModal isOpen={isCreateDocModalOpen} onClose={() => setIsCreateDocModalOpen(false)} onCreate={createDocument} />

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
