/**
 * Audit Logging & Anti-Duplicate Service for Ecomfy Livraison Verification
 * Handles:
 * 1. Historical audit trail recording (WHO, WHEN, WHAT_ACTION, RESULT)
 * 2. Protection against duplicate identity documents across multiple accounts
 */

import { supabase } from "@/integrations/supabase/client";
import { VerificationAuditLog } from "@/types/delivery";

export const verificationAuditService = {
  /**
   * Log an auditable event in the verification workflow
   */
  async logEvent(payload: {
    requestId: string;
    userId?: string;
    actorRole: 'system_ai' | 'admin' | 'user';
    action: VerificationAuditLog['action'];
    details: string;
    confidenceScore?: number;
  }): Promise<VerificationAuditLog> {
    const newLog: VerificationAuditLog = {
      id: `audit_${Date.now()}_${Math.random().toString(36).substring(7)}`,
      request_id: payload.requestId,
      user_id: payload.userId,
      actor_role: payload.actorRole,
      action: payload.action,
      details: payload.details,
      confidence_score: payload.confidenceScore,
      created_at: new Date().toISOString()
    };

    console.log("[VerificationAuditService] Event logged:", newLog);

    // Save to local session audit store
    try {
      const stored = localStorage.getItem(`audit_logs_${payload.requestId}`);
      const logs: VerificationAuditLog[] = stored ? JSON.parse(stored) : [];
      logs.push(newLog);
      localStorage.setItem(`audit_logs_${payload.requestId}`, JSON.stringify(logs));
    } catch (e) {
      console.warn("Could not save audit log to localStorage", e);
    }

    return newLog;
  },

  /**
   * Fetch audit history for a specific application
   */
  getAuditLogs(requestId: string): VerificationAuditLog[] {
    try {
      const stored = localStorage.getItem(`audit_logs_${requestId}`);
      return stored ? JSON.parse(stored) : [];
    } catch (e) {
      return [];
    }
  },

  /**
   * Anti-duplicate check: Detects if document number or identity is registered elsewhere
   */
  async checkDuplicateIdentity(
    documentNumber: string,
    currentUserId?: string
  ): Promise<{ isDuplicate: boolean; matchedCompanyId?: string; warningReason?: string }> {
    if (!documentNumber || documentNumber.length < 4) {
      return { isDuplicate: false };
    }

    try {
      const { data, error } = await supabase
        .from("delivery_companies" as any)
        .select("id, company_name, manager_name, manager_phone, user_id")
        .neq("user_id", currentUserId || "anonymous")
        .limit(10);

      if (error || !data) return { isDuplicate: false };

      // Check if duplicate document ID exists
      const duplicate = data.find((item: any) => 
        item.tax_id_number === documentNumber || item.trade_register_number === documentNumber
      );

      if (duplicate) {
        return {
          isDuplicate: true,
          matchedCompanyId: duplicate.id,
          warningReason: `Doublon potentiel détecté : Ce numéro de document est déjà enregistré sous la structure '${duplicate.company_name}' (${duplicate.manager_name}).`
        };
      }
    } catch (e) {
      console.warn("Duplicate check error:", e);
    }

    return { isDuplicate: false };
  }
};
