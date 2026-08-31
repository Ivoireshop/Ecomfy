import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  CorporateCompany,
  CorporateShareholder,
  CorporateShareAllocation,
  CorporateVestingPlan,
  CorporateDocument,
  CorporateProposal,
  CorporateIPAsset,
  CorporateAuditLog,
  CorporateDocumentAcceptance,
} from "@/types/corporate";

export const useCorporateGovernance = () => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [company, setCompany] = useState<CorporateCompany | null>(null);
  const [shareholders, setShareholders] = useState<CorporateShareholder[]>([]);
  const [documents, setDocuments] = useState<CorporateDocument[]>([]);
  const [proposals, setProposals] = useState<CorporateProposal[]>([]);
  const [ipAssets, setIpAssets] = useState<CorporateIPAsset[]>([]);
  const [auditLogs, setAuditLogs] = useState<CorporateAuditLog[]>([]);

  const fetchCorporateData = useCallback(async () => {
    setLoading(true);
    try {
      // 1. Fetch Company Metadata
      const { data: companyData } = await supabase
        .from("corporate_companies" as any)
        .select("*")
        .maybeSingle();

      if (companyData) setCompany(companyData as any);

      // 2. Fetch Shareholders & Allocations & Vesting Plans
      const { data: shData } = await supabase
        .from("corporate_shareholders" as any)
        .select("*")
        .order("is_main_founder", { ascending: false });

      if (shData) {
        const { data: allocData } = await supabase
          .from("corporate_share_allocations" as any)
          .select("*");

        const { data: vestingData } = await supabase
          .from("corporate_vesting_plans" as any)
          .select("*");

        const allocMap = new Map((allocData || []).map((a: any) => [a.shareholder_id, a]));
        const vestingMap = new Map((vestingData || []).map((v: any) => [v.shareholder_id, v]));

        const combined: CorporateShareholder[] = shData.map((s: any) => ({
          ...s,
          allocation: allocMap.get(s.id),
          vesting_plan: vestingMap.get(s.id),
        }));

        setShareholders(combined);
      }

      // 3. Fetch Documents
      const { data: docsData } = await supabase
        .from("corporate_documents" as any)
        .select("*")
        .order("created_at", { ascending: true });

      if (docsData) setDocuments(docsData as any);

      // 4. Fetch Proposals
      const { data: propData } = await supabase
        .from("corporate_proposals" as any)
        .select("*")
        .order("created_at", { ascending: false });

      if (propData) setProposals(propData as any);

      // 5. Fetch IP Assets
      const { data: ipData } = await supabase
        .from("corporate_intellectual_property" as any)
        .select("*")
        .order("created_at", { ascending: false });

      if (ipData) setIpAssets(ipData as any);

      // 6. Fetch Audit Logs
      const { data: logsData } = await supabase
        .from("corporate_audit_logs" as any)
        .select("*")
        .order("timestamp", { ascending: false })
        .limit(50);

      if (logsData) setAuditLogs(logsData as any);

    } catch (err: any) {
      console.error("Error fetching corporate governance data:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCorporateData();
  }, [fetchCorporateData]);

  // Log Audit Action Helper
  const logAudit = async (action: string, targetEntity: string, entityId?: string, oldVals?: any, newVals?: any) => {
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const user = sessionData?.session?.user;
      await supabase.from("corporate_audit_logs" as any).insert({
        user_id: user?.id || null,
        user_email: user?.email || "system",
        action,
        target_entity: targetEntity,
        entity_id: entityId || null,
        old_values: oldVals || null,
        new_values: newVals || null,
        ip_address: "127.0.0.1",
        timestamp: new Date().toISOString(),
      });
    } catch (e) {
      console.warn("Could not log corporate audit:", e);
    }
  };

  // Submit Cap Table Change Proposal
  const createProposal = async (payload: {
    title: string;
    beneficiary_shareholder_id: string;
    proposed_percentage: number;
    rationale: string;
    proposed_by: string;
  }) => {
    try {
      const beneficiary = shareholders.find(s => s.id === payload.beneficiary_shareholder_id);
      const currentPct = beneficiary?.allocation?.target_percentage || 0;
      const totalShares = company?.total_authorized_shares || 1000000;
      const currentShares = (currentPct / 100) * totalShares;
      const proposedShares = (payload.proposed_percentage / 100) * totalShares;

      const { data, error } = await supabase.from("corporate_proposals" as any).insert({
        title: payload.title,
        beneficiary_shareholder_id: payload.beneficiary_shareholder_id,
        proposed_by: payload.proposed_by,
        current_percentage: currentPct,
        proposed_percentage: payload.proposed_percentage,
        current_shares: currentShares,
        proposed_shares: proposedShares,
        rationale: payload.rationale,
        status: "proposed",
      }).select().single();

      if (error) throw error;

      await logAudit("PROPOSAL_CREATED", "corporate_proposals", (data as any)?.id, null, data);

      toast({
        title: "Proposal créée",
        description: "La proposition d'attribution a été soumise au workflow de validation.",
      });

      fetchCorporateData();
      return data;
    } catch (err: any) {
      toast({
        title: "Erreur proposal",
        description: err?.message || "Impossible de créer la proposition",
        variant: "destructive",
      });
      throw err;
    }
  };

  // Advance Proposal Workflow Status
  const updateProposalStatus = async (proposalId: string, nextStatus: string, legalDocPath?: string) => {
    try {
      const currentProp = proposals.find(p => p.id === proposalId);
      const updateData: any = { status: nextStatus, updated_at: new Date().toISOString() };
      if (legalDocPath) updateData.legal_document_path = legalDocPath;

      const { error } = await supabase
        .from("corporate_proposals" as any)
        .update(updateData)
        .eq("id", proposalId);

      if (error) throw error;

      // If status reaches CAP_TABLE_UPDATED, update the actual shareholder allocation!
      if (nextStatus === "cap_table_updated" && currentProp) {
        if (currentProp.beneficiary_shareholder_id) {
          const totalShares = company?.total_authorized_shares || 1000000;
          const newShares = (currentProp.proposed_percentage / 100) * totalShares;

          await supabase
            .from("corporate_share_allocations" as any)
            .update({
              target_percentage: currentProp.proposed_percentage,
              target_shares: newShares,
              updated_at: new Date().toISOString(),
            })
            .eq("shareholder_id", currentProp.beneficiary_shareholder_id);
        }

        // Save Cap Table Snapshot
        await supabase.from("corporate_cap_table_snapshots" as any).insert({
          proposal_id: proposalId,
          snapshot_data: { shareholders, company },
          total_shares: company?.total_authorized_shares || 1000000,
          reason: `Approbation formelle proposition: ${currentProp.title}`,
        });
      }

      await logAudit(`PROPOSAL_${nextStatus.toUpperCase()}`, "corporate_proposals", proposalId, { status: currentProp?.status }, { status: nextStatus });

      toast({
        title: "Statut mis à jour",
        description: `La proposition est maintenant au statut : ${nextStatus}`,
      });

      fetchCorporateData();
    } catch (err: any) {
      toast({
        title: "Erreur de mise à jour",
        description: err?.message || "Échec de l'avancement du workflow",
        variant: "destructive",
      });
    }
  };

  // Sign & Approve Document
  const approveDocument = async (documentId: string, version: string, legalStatement: string) => {
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const user = sessionData?.session?.user;
      if (!user) throw new Error("Utilisateur non authentifié");

      const { error } = await supabase.from("corporate_document_acceptances" as any).insert({
        document_id: documentId,
        version,
        user_id: user.id,
        email: user.email || "",
        action: "approved",
        legal_statement: legalStatement,
        ip_address: "127.0.0.1",
        user_agent: navigator.userAgent,
        timestamp: new Date().toISOString(),
      });

      if (error) throw error;

      // Update onboarding level if all mandatory documents signed
      await logAudit("DOCUMENT_APPROVED", "corporate_documents", documentId, null, { version, user_id: user.id });

      toast({
        title: "✨ Document approuvé !",
        description: "Votre approbation horodatée a été enregistrée avec succès.",
      });

      fetchCorporateData();
    } catch (err: any) {
      toast({
        title: "Erreur d'approbation",
        description: err?.message || "Impossible d'enregistrer votre signature",
        variant: "destructive",
      });
    }
  };

  return {
    loading,
    company,
    shareholders,
    documents,
    proposals,
    ipAssets,
    auditLogs,
    fetchCorporateData,
    createProposal,
    updateProposalStatus,
    approveDocument,
  };
};
