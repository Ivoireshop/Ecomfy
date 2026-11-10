import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { checkAllocationRoom, countApprovers, sharesForPercentage } from "@/lib/governanceMetrics";
import {
  CorporateCompany,
  CorporateShareholder,
  CorporateDocument,
  CorporateProposal,
  CorporateIPAsset,
  CorporateAuditLog,
  CorporateDocumentAcceptance,
  CorporateInvitation,
} from "@/types/corporate";

const AUDIT_PAGE = 50;

/** Les tables corporate_* ne sont pas dans les types générés. */
const table = (name: string) => supabase.from(name as never) as any;

/** Table absente du schéma (migration non appliquée) : code Postgres 42P01 ou PGRST205 côté API. */
const isMissingTable = (err: { code?: string; message?: string } | null | undefined) =>
  !!err && (err.code === "42P01" || err.code === "PGRST205" || /does not exist|schema cache/i.test(err.message ?? ""));

export interface SessionActor {
  id: string;
  email: string;
}

const getActor = async (): Promise<SessionActor | null> => {
  const { data } = await supabase.auth.getSession();
  const u = data?.session?.user;
  return u?.email ? { id: u.id, email: u.email } : null;
};

export const useCorporateGovernance = () => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [company, setCompany] = useState<CorporateCompany | null>(null);
  const [shareholders, setShareholders] = useState<CorporateShareholder[]>([]);
  const [invitations, setInvitations] = useState<CorporateInvitation[]>([]);
  const [invitationsAvailable, setInvitationsAvailable] = useState(true);
  const [documents, setDocuments] = useState<CorporateDocument[]>([]);
  const [proposals, setProposals] = useState<CorporateProposal[]>([]);
  const [ipAssets, setIpAssets] = useState<CorporateIPAsset[]>([]);
  const [auditLogs, setAuditLogs] = useState<CorporateAuditLog[]>([]);
  const [auditTotal, setAuditTotal] = useState(0);
  const [actor, setActor] = useState<SessionActor | null>(null);
  /** Fondateur ou cofondateur : seuls rôles que les politiques d'écriture acceptent. */
  const [canWrite, setCanWrite] = useState(false);
  /** Documents que l'utilisateur connecté a consultés (journal d'audit), tous appareils confondus. */
  const [viewedByMe, setViewedByMe] = useState<Set<string>>(new Set());
  const viewedThisSession = useRef<Set<string>>(new Set());

  const fetchCorporateData = useCallback(async () => {
    setLoading(true);
    const problems: string[] = [];
    const note = (label: string, err: { message?: string } | null | undefined) => {
      if (err) problems.push(`${label} : ${err.message ?? "erreur de lecture"}`);
    };
    try {
      const me = await getActor();
      setActor(me);

      if (me) {
        const { data: roles, error: rolesErr } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", me.id);
        note("Rôles", rolesErr);
        setCanWrite(((roles || []) as Array<{ role: string }>).some((r) => r.role === "founder" || r.role === "co_founder"));
      } else {
        setCanWrite(false);
      }

      // 1. Société
      const { data: companyData, error: companyErr } = await table("corporate_companies").select("*").limit(1).maybeSingle();
      note("Société", companyErr);
      setCompany((companyData as CorporateCompany) ?? null);

      // 2. Membres, participations, plans de vesting
      const [shRes, allocRes, vestRes] = await Promise.all([
        table("corporate_shareholders").select("*").order("is_main_founder", { ascending: false }).order("created_at", { ascending: true }),
        table("corporate_share_allocations").select("*"),
        table("corporate_vesting_plans").select("*"),
      ]);
      note("Membres", shRes.error);
      note("Participations", allocRes.error);
      note("Vesting", vestRes.error);

      const allocMap = new Map<string, any>((allocRes.data || []).map((a: any) => [a.shareholder_id, a]));
      const vestingMap = new Map<string, any>((vestRes.data || []).map((v: any) => [v.shareholder_id, v]));
      const combined: CorporateShareholder[] = (shRes.data || []).map((s: any) => ({
        ...s,
        allocation: allocMap.get(s.id),
        vesting_plan: vestingMap.get(s.id),
      }));
      setShareholders(combined);

      // 2b. Invitations : seules les lignes enregistrées comptent. Aucune invitation n'est déduite des membres.
      const invRes = await table("corporate_invitations").select("*").order("created_at", { ascending: false });
      if (invRes.error) {
        if (isMissingTable(invRes.error)) {
          setInvitationsAvailable(false);
        } else {
          note("Invitations", invRes.error);
        }
        setInvitations([]);
      } else {
        setInvitationsAvailable(true);
        setInvitations((invRes.data as CorporateInvitation[]) || []);
      }

      // 3. Documents (la base est la seule source) + signatures
      const [docsRes, accRes] = await Promise.all([
        table("corporate_documents").select("*").order("created_at", { ascending: true }),
        table("corporate_document_acceptances").select("*").eq("action", "approved").order("timestamp", { ascending: false }),
      ]);
      note("Documents", docsRes.error);
      note("Signatures", accRes.error);

      const acceptances = (accRes.data || []) as CorporateDocumentAcceptance[];
      const mine = new Map<string, CorporateDocumentAcceptance>();
      for (const a of acceptances) {
        if (me && a.user_id === me.id && !mine.has(`${a.document_id}|${a.version}`)) mine.set(`${a.document_id}|${a.version}`, a);
      }

      setDocuments(
        (docsRes.data || []).map((d: any): CorporateDocument => ({
          id: d.id,
          slug: d.slug ?? null,
          title: d.title,
          category: d.category,
          legal_status: d.legal_status ?? undefined,
          summary: d.summary ?? undefined,
          author: d.author ?? undefined,
          is_mandatory: d.is_mandatory ?? true,
          target_roles: d.target_roles ?? [],
          current_version: d.current_version,
          storage_path: d.storage_path ?? null,
          content_markdown: d.content_markdown ?? null,
          created_at: d.created_at,
          updated_at: d.updated_at,
          approvals_count: countApprovers(acceptances, d.id, d.current_version),
          user_acceptance: mine.get(`${d.id}|${d.current_version}`) ?? null,
        })),
      );

      // 4. Propositions
      const propRes = await table("corporate_proposals").select("*").order("created_at", { ascending: false });
      note("Propositions", propRes.error);
      setProposals((propRes.data as CorporateProposal[]) || []);

      // 5. Propriété intellectuelle
      const ipRes = await table("corporate_intellectual_property").select("*").order("created_at", { ascending: false });
      note("Propriété intellectuelle", ipRes.error);
      setIpAssets((ipRes.data as CorporateIPAsset[]) || []);

      // 6. Journal d'audit : total exact + dernières lignes
      const logsRes = await table("corporate_audit_logs")
        .select("*", { count: "exact" })
        .order("timestamp", { ascending: false })
        .limit(AUDIT_PAGE);
      note("Journal d'audit", logsRes.error);
      setAuditLogs((logsRes.data as CorporateAuditLog[]) || []);
      setAuditTotal(logsRes.count ?? (logsRes.data?.length || 0));

      // 6b. Consultations de l'utilisateur connecté
      if (me) {
        const viewRes = await table("corporate_audit_logs")
          .select("entity_id")
          .eq("user_id", me.id)
          .eq("action", "DOCUMENT_VIEWED")
          .eq("target_entity", "corporate_documents");
        setViewedByMe(new Set(((viewRes.data || []) as Array<{ entity_id: string | null }>).map((r) => r.entity_id).filter(Boolean) as string[]));
      } else {
        setViewedByMe(new Set());
      }
    } catch (err: any) {
      console.error("Error fetching corporate governance data:", err);
      problems.push(err?.message ?? "erreur inattendue");
    } finally {
      setLoadError(problems.length ? problems.join(" · ") : null);
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCorporateData();
  }, [fetchCorporateData]);

  /**
   * Écrit une ligne dans le journal d'audit au nom de l'utilisateur connecté. L'adresse IP n'est pas
   * connue du navigateur : elle reste vide plutôt que d'être inventée. Retourne false si l'écriture
   * a échoué (le journal est en ajout seul : un échec ne doit pas passer inaperçu).
   */
  const logAudit = async (action: string, targetEntity: string, entityId?: string, oldVals?: unknown, newVals?: unknown): Promise<boolean> => {
    const who = await getActor();
    if (!who) {
      console.warn(`Audit non écrit (${action}) : aucune session ouverte.`);
      return false;
    }
    const { error } = await table("corporate_audit_logs").insert({
      user_id: who.id,
      user_email: who.email,
      action,
      target_entity: targetEntity,
      entity_id: entityId ?? null,
      old_values: oldVals ?? null,
      new_values: newVals ?? null,
      ip_address: null,
    });
    if (error) {
      console.warn(`Audit non écrit (${action}) :`, error.message);
      return false;
    }
    return true;
  };

  /** Consultation d'un document : une ligne par document et par session, seulement si elle est écrite pour de bon. */
  const recordDocumentView = async (documentId: string) => {
    if (viewedThisSession.current.has(documentId)) return;
    viewedThisSession.current.add(documentId);
    const ok = await logAudit("DOCUMENT_VIEWED", "corporate_documents", documentId, null, { at: new Date().toISOString() });
    if (ok) setViewedByMe((prev) => new Set(prev).add(documentId));
    else viewedThisSession.current.delete(documentId);
  };

  /** Crée un document (fondateur / cofondateur : la politique d'écriture refuse les autres). */
  const createDocument = async (payload: {
    title: string;
    category: any;
    legal_status: any;
    summary: string;
    content_markdown: string;
    is_mandatory: boolean;
  }): Promise<CorporateDocument | undefined> => {
    try {
      const who = await getActor();
      if (!who) throw new Error("Connectez-vous pour créer un document.");
      const me = shareholders.find((s) => s.user_id === who.id || s.email.toLowerCase() === who.email.toLowerCase());

      const { data, error } = await table("corporate_documents")
        .insert({
          title: payload.title,
          category: payload.category,
          is_mandatory: payload.is_mandatory,
          content_markdown: payload.content_markdown,
          current_version: "v1.0",
          legal_status: payload.legal_status ?? null,
          summary: payload.summary || null,
          author: me?.full_name ?? who.email,
        })
        .select()
        .single();

      if (error) {
        // Colonnes du seed absentes (migration 20261109100000 non appliquée) : on réessaie sans elles.
        if (/legal_status|summary|author|column/i.test(error.message ?? "")) {
          const retry = await table("corporate_documents")
            .insert({
              title: payload.title,
              category: payload.category,
              is_mandatory: payload.is_mandatory,
              content_markdown: payload.content_markdown,
              current_version: "v1.0",
            })
            .select()
            .single();
          if (retry.error) throw retry.error;
          await logAudit("DOCUMENT_CREATED", "corporate_documents", retry.data.id, null, { title: payload.title });
          toast({ title: "Document créé", description: `« ${payload.title} » a été ajouté au Centre documentaire.` });
          await fetchCorporateData();
          return retry.data as CorporateDocument;
        }
        throw error;
      }

      await logAudit("DOCUMENT_CREATED", "corporate_documents", data.id, null, { title: payload.title, category: payload.category });
      toast({ title: "Document créé", description: `« ${payload.title} » a été ajouté au Centre documentaire.` });
      await fetchCorporateData();
      return data as CorporateDocument;
    } catch (err: any) {
      toast({
        title: "Création impossible",
        description: err?.message || "Le document n'a pas pu être enregistré.",
        variant: "destructive",
      });
    }
  };

  /** Dépose une proposition de changement de cap table au nom de l'utilisateur connecté. */
  const createProposal = async (payload: {
    title: string;
    beneficiary_shareholder_id: string;
    proposed_percentage: number;
    rationale: string;
  }) => {
    try {
      const who = await getActor();
      if (!who) throw new Error("Connectez-vous pour déposer une proposition.");
      if (!company) throw new Error("Capital de référence introuvable : la société n'est pas enregistrée.");

      const beneficiary = shareholders.find((s) => s.id === payload.beneficiary_shareholder_id);
      if (!beneficiary) throw new Error("Bénéficiaire introuvable.");

      const room = checkAllocationRoom(shareholders, beneficiary.id, payload.proposed_percentage);
      if (!room.ok) {
        throw new Error(
          `La participation proposée doit être comprise entre 0 et ${room.maxPct} % (les autres membres détiennent déjà ${room.othersPct} %).`,
        );
      }

      const totalShares = Number(company.total_authorized_shares);
      const currentPct = Number(beneficiary.allocation?.target_percentage ?? 0);

      const { data, error } = await table("corporate_proposals")
        .insert({
          title: payload.title,
          beneficiary_shareholder_id: beneficiary.id,
          proposed_by: who.id,
          current_percentage: currentPct,
          proposed_percentage: payload.proposed_percentage,
          current_shares: sharesForPercentage(currentPct, totalShares),
          proposed_shares: sharesForPercentage(payload.proposed_percentage, totalShares),
          rationale: payload.rationale,
          status: "proposed",
        })
        .select()
        .single();
      if (error) throw error;

      await logAudit("PROPOSAL_CREATED", "corporate_proposals", data.id, null, {
        beneficiary: beneficiary.email,
        from: currentPct,
        to: payload.proposed_percentage,
      });
      toast({ title: "Proposition enregistrée", description: "Elle est soumise au workflow de validation." });
      await fetchCorporateData();
      return data;
    } catch (err: any) {
      toast({
        title: "Proposition refusée",
        description: err?.message || "La proposition n'a pas pu être enregistrée.",
        variant: "destructive",
      });
      throw err;
    }
  };

  /** Fait avancer une proposition. Au passage « cap_table_updated », la participation est réellement modifiée. */
  const updateProposalStatus = async (proposalId: string, nextStatus: string, legalDocPath?: string) => {
    try {
      const currentProp = proposals.find((p) => p.id === proposalId);
      if (!currentProp) throw new Error("Proposition introuvable.");
      const updateData: Record<string, unknown> = { status: nextStatus, updated_at: new Date().toISOString() };
      if (legalDocPath) updateData.legal_document_path = legalDocPath;

      const { error } = await table("corporate_proposals").update(updateData).eq("id", proposalId);
      if (error) throw error;

      if (nextStatus === "cap_table_updated" && currentProp.beneficiary_shareholder_id) {
        if (!company) throw new Error("Capital de référence introuvable.");
        const newShares = sharesForPercentage(Number(currentProp.proposed_percentage), Number(company.total_authorized_shares));
        const { error: allocErr } = await table("corporate_share_allocations")
          .update({
            target_percentage: currentProp.proposed_percentage,
            target_shares: newShares,
            updated_at: new Date().toISOString(),
          })
          .eq("shareholder_id", currentProp.beneficiary_shareholder_id);
        if (allocErr) throw allocErr;

        const { error: snapErr } = await table("corporate_cap_table_snapshots").insert({
          proposal_id: proposalId,
          snapshot_data: { shareholders, company },
          total_shares: company.total_authorized_shares,
          reason: `Approbation formelle proposition : ${currentProp.title}`,
          created_by: (await getActor())?.id ?? null,
        });
        if (snapErr) throw snapErr;
      }

      await logAudit(`PROPOSAL_${nextStatus.toUpperCase()}`, "corporate_proposals", proposalId, { status: currentProp.status }, { status: nextStatus });
      toast({ title: "Statut mis à jour", description: `La proposition est maintenant au statut : ${nextStatus}` });
      await fetchCorporateData();
    } catch (err: any) {
      toast({
        title: "Mise à jour impossible",
        description: err?.message || "Échec de l'avancement du workflow",
        variant: "destructive",
      });
    }
  };

  /**
   * Signature électronique d'un document par l'utilisateur connecté. La ligne est écrite en base ;
   * le succès n'est annoncé qu'une fois l'écriture confirmée. Retourne true si la signature est enregistrée.
   */
  const approveDocument = async (documentId: string, version: string, legalStatement: string): Promise<boolean> => {
    try {
      const who = await getActor();
      if (!who) throw new Error("Connectez-vous pour signer ce document.");

      const doc = documents.find((d) => d.id === documentId);
      if (doc?.user_acceptance && doc.current_version === version) {
        toast({ title: "Déjà signé", description: "Votre signature de cette version est déjà enregistrée." });
        return true;
      }

      const { error } = await table("corporate_document_acceptances").insert({
        document_id: documentId,
        version,
        user_id: who.id,
        email: who.email,
        action: "approved",
        legal_statement: legalStatement,
        ip_address: null,
        user_agent: navigator.userAgent,
      });
      if (error) throw error;

      const audited = await logAudit("DOCUMENT_APPROVED", "corporate_documents", documentId, null, { version, user_email: who.email });
      toast({
        title: "Document approuvé",
        description: audited
          ? "Votre signature a été enregistrée."
          : "Votre signature est enregistrée, mais la ligne du journal d'audit n'a pas pu être écrite.",
      });
      await fetchCorporateData();
      return true;
    } catch (err: any) {
      toast({
        title: "Signature non enregistrée",
        description: err?.message || "Impossible d'enregistrer votre signature.",
        variant: "destructive",
      });
      return false;
    }
  };

  return {
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
    ipAssets,
    auditLogs,
    auditTotal,
    viewedByMe,
    fetchCorporateData,
    recordDocumentView,
    createDocument,
    createProposal,
    updateProposalStatus,
    approveDocument,
    logAudit,
  };
};
