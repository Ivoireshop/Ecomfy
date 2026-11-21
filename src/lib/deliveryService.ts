import { supabase } from "@/integrations/supabase/client";
import {
  DeliveryAuditEntry,
  DeliveryCompany,
  DeliveryCompanyKyc,
  DeliveryCompanyLocation,
  DeliveryDirectoryCard,
  DeliveryAgentVisit,
  DeliveryFieldAgent,
  DeliveryFieldVisitAdmin,
  DeliveryPendingVerification,
  DeliveryVisitOutcome,
  DeliveryVisitSummary,
  VisitChecks,
  DeliveryDirectoryResult,
  DeliveryFeeKind,
  DeliveryFeeOverview,
  DeliveryFeeSettings,
  DeliveryCompanyFinance,
  DeliveryFinanceSummary,
  DeliveryPremiumPlan,
  DeliveryPremiumStatus,
  DeliveryFeeStatus,
  DeliveryProfileInput,
  DeliveryProfileType,
  DeliveryDispatch,
  DeliveryDispatchHistoryEntry,
  DeliveryDriverStats,
  DeliveryAdminOperations,
  DeliveryWorkspace,
  DeliveryStaffMember,
  DeliveryStaffRole,
  DeliveryAssignableDriver,
  DeliveryCashTransfer,
  DeliveryNotification,
  DeliveryVerificationStatus,
  DeliveryDispatchStatus,
  DeliveryDriver,
  DeliveryVehicleType,
  IdDocumentType,
  LicenseCategory,
  StructuredRejectionReasonCode,
} from "@/types/delivery";

// Les types générés de Supabase ne connaissent pas encore le module « Ecomfy Livraison » (tables delivery_companies,
// delivery_drivers… et leurs RPC). Un seul point d'accès non typé, plutôt qu'un `as any` à chaque appel.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

/** Message lisible d'une erreur renvoyée par une Edge Function (le corps JSON contient « error »). */
async function functionErrorMessage(error: unknown, fallback: string): Promise<string> {
  const context = (error as { context?: { json?: () => Promise<{ error?: string }> } } | null)?.context;
  if (context?.json) {
    try {
      const body = await context.json();
      if (body?.error) return String(body.error);
    } catch {
      /* corps illisible : message générique */
    }
  }
  return (error as { message?: string } | null)?.message || fallback;
}

export interface DriverInput {
  first_name: string;
  last_name: string;
  phone: string;
  whatsapp?: string;
  date_of_birth: string;
  vehicle_type: DeliveryVehicleType;
  vehicle_license_plate?: string;
  id_type?: IdDocumentType;
  id_number?: string;
  id_expiry?: string;
  license_number: string;
  license_categories: LicenseCategory[];
  license_expiry: string;
  /** Chemins dans le bucket privé delivery-kyc. */
  photo_url?: string;
  national_id_photo_url: string;
  /** Verso : exigé pour une CNI, pas pour un passeport. */
  national_id_back_photo_url?: string;
  license_photo_url: string;
  license_back_photo_url: string;
  selfie_with_id_url: string;
}

export interface RegisterApplicationInput {
  company: {
    profile_type: "manager" | "driver";
    company_name: string;
    country: string;
    country_code: string;
    city: string;
    headquarters_address: string;
    manager_first_name: string;
    manager_last_name: string;
    manager_phone: string;
    manager_whatsapp?: string;
    manager_id_photo_url: string;
    manager_id_back_photo_url?: string;
    manager_selfie_with_id_url: string;
    warehouse_photo_url?: string;
    /** Position précise de l'entrepôt (exigée d'une société). */
    warehouse_latitude?: number;
    warehouse_longitude?: number;
    warehouse_accuracy_m?: number;
    warehouse_location_source?: 'gps' | 'map';
    has_tax_registration: boolean;
    tax_id_number?: string;
    tax_document_url?: string;
    trade_register_number?: string;
    trade_register_document_url?: string;
    covered_cities?: string[];
  };
  kyc: { id_type: IdDocumentType; id_number: string; id_expiry?: string; date_of_birth: string };
  hubs: Array<{ city: string; address: string; hub_name?: string; phone?: string }>;
  drivers: DriverInput[];
}

export interface DeliveryDecisionInput {
  companyId?: string;
  driverId?: string;
  decision: "approved" | "rejected" | "action_required" | "suspended";
  reasonCode?: StructuredRejectionReasonCode;
  reason?: string;
  /** Message au candidat (complément demandé). */
  message?: string;
  /** Note interne, jamais visible du candidat. */
  note?: string;
  cascadeDrivers?: boolean;
}

export interface DeliveryDecisionResult {
  emailSent: boolean;
  emailNote?: string;
  driversApproved: string[];
  driversBlocked: Array<{ id: string; name: string; issues: string[] }>;
}

const COMPANY_SELECT =
  "*, hubs:delivery_hubs(*), drivers:delivery_drivers(*), kyc:delivery_company_kyc(*), location:delivery_company_location(*)";

const normalizeKyc = (value: unknown): DeliveryCompanyKyc | null =>
  ((Array.isArray(value) ? value[0] : value) as DeliveryCompanyKyc | undefined) ?? null;

const normalizeLocation = (value: unknown): DeliveryCompanyLocation | null =>
  ((Array.isArray(value) ? value[0] : value) as DeliveryCompanyLocation | undefined) ?? null;

const withKyc = (row: Record<string, unknown>): DeliveryCompany =>
  ({ ...row, kyc: normalizeKyc(row.kyc), location: normalizeLocation(row.location) }) as unknown as DeliveryCompany;

export const deliveryService = {
  /**
   * Inscription d'un dossier (structure + identité + hubs + livreurs) en UNE transaction côté serveur.
   * Le serveur refuse : pièce qui n'est pas un fichier déposé par l'utilisateur, responsable mineur, doublon
   * de pièce d'identité, permis incompatible avec le véhicule ou expiré.
   */
  async registerApplication(input: RegisterApplicationInput): Promise<string> {
    const { data, error } = await db.rpc("register_delivery_application", {
      p_company: input.company,
      p_kyc: input.kyc,
      p_hubs: input.hubs,
      p_drivers: input.drivers,
    });
    if (error) throw new Error(error.message);
    return data as string;
  },

  /** Remplace les pièces ou informations demandées puis remet le dossier en file d'attente. */
  async resubmitApplication(
    companyId: string,
    changes: {
      company?: Record<string, unknown>;
      kyc?: Partial<RegisterApplicationInput["kyc"]>;
      drivers?: Array<Partial<DriverInput> & { id: string }>;
    },
  ): Promise<void> {
    const { error } = await db.rpc("resubmit_delivery_application", {
      p_company_id: companyId,
      p_company: changes.company ?? {},
      p_kyc: changes.kyc ?? {},
      p_drivers: changes.drivers ?? [],
    });
    if (error) throw new Error(error.message);
  },

  /** Le dossier du compte connecté, avec ses hubs, ses livreurs et son identité (KYC). */
  async getMyCompany(): Promise<DeliveryCompany | null> {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return null;

    const { data, error } = await db
      .from("delivery_companies")
      .select(COMPANY_SELECT)
      .eq("user_id", userData.user.id)
      .maybeSingle();

    if (error) {
      console.error("Error fetching my delivery company:", error);
      return null;
    }
    return data ? withKyc(data) : null;
  },

  /** Espace de travail (propriétaire ou collaborateur) ; null si le compte n'appartient à aucune structure. */
  async getMyWorkspace(): Promise<DeliveryWorkspace | null> {
    const { data, error } = await db.rpc("delivery_my_workspace");
    if (error) {
      console.error("Error fetching delivery workspace:", error);
      return null;
    }
    return (data as DeliveryWorkspace | null) ?? null;
  },

  async getAssignableDrivers(companyId: string): Promise<DeliveryAssignableDriver[]> {
    const { data, error } = await db.rpc("delivery_company_drivers", { _company_id: companyId });
    if (error) throw new Error(error.message);
    return (data || []) as DeliveryAssignableDriver[];
  },

  async listTeam(companyId: string): Promise<DeliveryStaffMember[]> {
    const { data, error } = await db.rpc("delivery_staff_list", { _company_id: companyId });
    if (error) throw new Error(error.message);
    return (data || []) as DeliveryStaffMember[];
  },

  /** Renvoie le jeton d'invitation : le lien à transmettre est /delivery/join?token=… */
  async inviteStaff(companyId: string, email: string, role: DeliveryStaffRole, driverId?: string | null): Promise<string> {
    const { data, error } = await db.rpc("delivery_staff_invite", {
      _company_id: companyId,
      _email: email,
      _role: role,
      _driver_id: driverId || null,
    });
    if (error) throw new Error(error.message);
    return (data as { token: string }).token;
  },

  async acceptInvitation(token: string): Promise<{ success: boolean; error?: string; company_name?: string; role?: string }> {
    const { data, error } = await db.rpc("delivery_staff_accept", { _token: token });
    if (error) throw new Error(error.message);
    return data as { success: boolean; error?: string; company_name?: string; role?: string };
  },

  async setStaffStatus(staffId: string, status: "active" | "inactive"): Promise<void> {
    const { error } = await db.rpc("delivery_staff_set_status", { _staff_id: staffId, _status: status });
    if (error) throw new Error(error.message);
  },

  async setStaffRole(staffId: string, role: DeliveryStaffRole, driverId?: string | null): Promise<void> {
    const { error } = await db.rpc("delivery_staff_set_role", { _staff_id: staffId, _role: role, _driver_id: driverId || null });
    if (error) throw new Error(error.message);
  },

  async revokeStaffInvite(staffId: string): Promise<void> {
    const { error } = await db.rpc("delivery_staff_revoke_invite", { _staff_id: staffId });
    if (error) throw new Error(error.message);
  },

  // ---------------------------------------------------------------------------------------------------------------
  // Vérification physique (cahier §5)
  // ---------------------------------------------------------------------------------------------------------------

  async getFieldAgents(): Promise<DeliveryFieldAgent[]> {
    const { data, error } = await db.rpc("delivery_admin_field_agents");
    if (error) throw new Error(error.message);
    return (data || []) as DeliveryFieldAgent[];
  },

  async setFieldAgent(input: { email: string; fullName: string; phone?: string; active?: boolean }): Promise<void> {
    const { error } = await db.rpc("delivery_admin_set_field_agent", {
      _email: input.email,
      _full_name: input.fullName,
      _phone: input.phone ?? null,
      _active: input.active ?? true,
    });
    if (error) throw new Error(error.message);
  },

  async getPendingVerifications(): Promise<DeliveryPendingVerification[]> {
    const { data, error } = await db.rpc("delivery_admin_pending_verifications");
    if (error) throw new Error(error.message);
    return (data || []) as DeliveryPendingVerification[];
  },

  async getFieldVisits(status?: string): Promise<DeliveryFieldVisitAdmin[]> {
    const { data, error } = await db.rpc("delivery_admin_field_visits", { _status: status ?? null });
    if (error) throw new Error(error.message);
    return (data || []) as DeliveryFieldVisitAdmin[];
  },

  async scheduleVisit(input: { companyId: string; agentId: string; scheduledFor: string; instructions?: string }): Promise<void> {
    const { error } = await db.rpc("delivery_admin_schedule_visit", {
      _company_id: input.companyId,
      _agent_id: input.agentId,
      _scheduled_for: input.scheduledFor,
      _instructions: input.instructions ?? null,
    });
    if (error) throw new Error(error.message);
  },

  async cancelVisit(visitId: string, reason: string): Promise<void> {
    const { error } = await db.rpc("delivery_admin_cancel_visit", { _visit_id: visitId, _reason: reason });
    if (error) throw new Error(error.message);
  },

  async getRequireVisit(): Promise<boolean> {
    const { data, error } = await db.rpc("delivery_admin_get_settings");
    if (error) throw new Error(error.message);
    return (data as Record<string, unknown> | null)?.require_field_visit === true;
  },

  async setRequireVisit(required: boolean): Promise<void> {
    const { error } = await db.rpc("delivery_admin_set_require_visit", { _required: required });
    if (error) throw new Error(error.message);
  },

  // ─── Cotisation, caution et activation (§4.1) ───
  async getCompanyFees(companyId: string): Promise<DeliveryFeeStatus> {
    const { data, error } = await db.rpc("delivery_company_fees", { _company_id: companyId });
    if (error) throw new Error(error.message);
    return data as DeliveryFeeStatus;
  },

  async declareFeePayment(input: { companyId: string; kind: DeliveryFeeKind; method: string; reference?: string; note?: string }): Promise<void> {
    const { error } = await db.rpc("delivery_company_declare_payment", {
      _company_id: input.companyId,
      _kind: input.kind,
      _method: input.method,
      _reference: input.reference || null,
      _note: input.note || null,
    });
    if (error) throw new Error(error.message);
  },

  async getFeeSettings(): Promise<DeliveryFeeSettings> {
    const { data, error } = await db.rpc("delivery_admin_fee_settings");
    if (error) throw new Error(error.message);
    return data as DeliveryFeeSettings;
  },

  async setFeeSettings(input: {
    membershipAmount: number;
    membershipPeriodMonths: number;
    depositAmount: number;
    currency: string;
    refundPolicy: string;
    requireActivation: boolean;
  }): Promise<void> {
    const { error } = await db.rpc("delivery_admin_set_fee_settings", {
      _membership_amount: input.membershipAmount,
      _membership_period_months: input.membershipPeriodMonths,
      _deposit_amount: input.depositAmount,
      _currency: input.currency,
      _refund_policy: input.refundPolicy,
      _require_activation: input.requireActivation,
    });
    if (error) throw new Error(error.message);
  },

  async getFeeOverview(): Promise<DeliveryFeeOverview> {
    const { data, error } = await db.rpc("delivery_admin_fee_overview");
    if (error) throw new Error(error.message);
    return data as DeliveryFeeOverview;
  },

  async decideFeePayment(paymentId: string, approve: boolean, note?: string): Promise<void> {
    const { error } = await db.rpc("delivery_admin_decide_payment", { _payment_id: paymentId, _approve: approve, _note: note || null });
    if (error) throw new Error(error.message);
  },

  async recordFeePayment(input: { companyId: string; kind: DeliveryFeeKind; amount: number; method: string; reference?: string; note?: string }): Promise<void> {
    const { error } = await db.rpc("delivery_admin_record_payment", {
      _company_id: input.companyId,
      _kind: input.kind,
      _amount: input.amount,
      _method: input.method,
      _reference: input.reference || null,
      _note: input.note || null,
    });
    if (error) throw new Error(error.message);
  },

  async refundDeposit(companyId: string, note: string): Promise<void> {
    const { error } = await db.rpc("delivery_admin_refund_deposit", { _company_id: companyId, _note: note });
    if (error) throw new Error(error.message);
  },

  async setActivation(companyId: string, suspended: boolean, waived: boolean, reason?: string): Promise<void> {
    const { error } = await db.rpc("delivery_admin_set_activation", {
      _company_id: companyId,
      _suspended: suspended,
      _waived: waived,
      _reason: reason || null,
    });
    if (error) throw new Error(error.message);
  },

  // ─── Gestion financière de l'administration (§11.3) ───
  async getFinanceSummary(from?: Date | null, to?: Date | null): Promise<DeliveryFinanceSummary> {
    const { data, error } = await db.rpc("delivery_admin_finance_summary", {
      _from: from ? from.toISOString() : null,
      _to: to ? to.toISOString() : null,
    });
    if (error) throw new Error(error.message);
    return data as DeliveryFinanceSummary;
  },

  async getCompanyFinance(companyId: string): Promise<DeliveryCompanyFinance> {
    const { data, error } = await db.rpc("delivery_admin_company_finance", { _company_id: companyId });
    if (error) throw new Error(error.message);
    return data as DeliveryCompanyFinance;
  },

  // ─── Abonnement Premium (§4.2) ───
  async getCompanyPremium(companyId: string): Promise<DeliveryPremiumStatus> {
    const { data, error } = await db.rpc("delivery_company_premium", { _company_id: companyId });
    if (error) throw new Error(error.message);
    return data as DeliveryPremiumStatus;
  },

  async declarePremium(input: { companyId: string; planCode: string; method: string; reference?: string; note?: string }): Promise<void> {
    const { error } = await db.rpc("delivery_company_declare_premium", {
      _company_id: input.companyId,
      _plan_code: input.planCode,
      _method: input.method,
      _reference: input.reference || null,
      _note: input.note || null,
    });
    if (error) throw new Error(error.message);
  },

  async setPremiumPlans(plans: DeliveryPremiumPlan[]): Promise<void> {
    const { error } = await db.rpc("delivery_admin_set_premium_plans", { _plans: plans });
    if (error) throw new Error(error.message);
  },

  async recordPremium(input: { companyId: string; planCode: string; method: string; reference?: string; note?: string }): Promise<void> {
    const { error } = await db.rpc("delivery_admin_record_premium", {
      _company_id: input.companyId,
      _plan_code: input.planCode,
      _method: input.method,
      _reference: input.reference || null,
      _note: input.note || null,
    });
    if (error) throw new Error(error.message);
  },

  async endPremium(companyId: string, reason: string): Promise<void> {
    const { error } = await db.rpc("delivery_admin_end_premium", { _company_id: companyId, _reason: reason });
    if (error) throw new Error(error.message);
  },

  /** Vrai si le compte connecté est un agent terrain actif (affiche l'entrée « Missions terrain »). */
  async isFieldAgent(): Promise<boolean> {
    const { data, error } = await db.rpc("delivery_is_field_agent");
    return !error && data === true;
  },

  async getAgentVisits(): Promise<DeliveryAgentVisit[]> {
    const { data, error } = await db.rpc("delivery_agent_my_visits");
    if (error) throw new Error(error.message);
    return (data || []) as DeliveryAgentVisit[];
  },

  async startVisit(visitId: string): Promise<void> {
    const { error } = await db.rpc("delivery_agent_start_visit", { _visit_id: visitId });
    if (error) throw new Error(error.message);
  },

  async submitVisit(input: {
    visitId: string;
    outcome: DeliveryVisitOutcome;
    checks: VisitChecks;
    observations: string;
    photos: string[];
    visitedOn?: string;
  }): Promise<void> {
    const { error } = await db.rpc("delivery_agent_submit_visit", {
      _visit_id: input.visitId,
      _outcome: input.outcome,
      _checks: input.checks,
      _observations: input.observations,
      _photos: input.photos,
      _visited_on: input.visitedOn ?? null,
    });
    if (error) throw new Error(error.message);
  },

  /** Dépose une photo de visite dans le dossier de l'agent (bucket privé) et renvoie son chemin. */
  async uploadVisitPhoto(file: File): Promise<string> {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) throw new Error("Connexion requise.");
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) throw new Error("La photo doit être au format JPG, PNG ou WEBP.");
    if (file.size > 10 * 1024 * 1024) throw new Error("Une photo ne doit pas dépasser 10 Mo.");
    const ext = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
    const path = `${userData.user.id}/visit-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const { error } = await supabase.storage.from("delivery-visits").upload(path, file, { contentType: file.type, upsert: false });
    if (error) throw new Error(error.message);
    return path;
  },

  /** Liens signés de 10 minutes pour afficher des photos de visite (agent auteur ou administrateur). */
  async getVisitPhotoUrls(paths: string[]): Promise<Record<string, string>> {
    if (paths.length === 0) return {};
    const { data, error } = await supabase.storage.from("delivery-visits").createSignedUrls(paths, 600);
    if (error) throw new Error(error.message);
    const out: Record<string, string> = {};
    for (const row of data ?? []) if (row.path && row.signedUrl) out[row.path] = row.signedUrl;
    return out;
  },

  /** Statut de vérification et visite en cours, sans rapport ni photos (propriétaire du dossier ou administrateur). */
  async getVisitSummary(companyId: string): Promise<DeliveryVisitSummary | null> {
    const { data, error } = await db.rpc("delivery_company_visit_summary", { _company_id: companyId });
    if (error) {
      console.error("Error fetching visit summary:", error);
      return null;
    }
    return data as DeliveryVisitSummary;
  },

  /** Répertoire (cahier §2) : structures et livreurs indépendants vérifiés. Seuls les champs publics sortent de la base. */
  async searchDirectory(params: {
    query?: string;
    city?: string;
    profileType?: DeliveryProfileType | null;
    limit?: number;
    offset?: number;
  } = {}): Promise<DeliveryDirectoryResult> {
    const { data, error } = await db.rpc("delivery_directory_search", {
      _query: params.query?.trim() || null,
      _city: params.city?.trim() || null,
      _profile_type: params.profileType ?? null,
      _limit: params.limit ?? 24,
      _offset: params.offset ?? 0,
    });
    if (error) throw new Error(error.message);
    const result = (data ?? { total: 0, items: [] }) as DeliveryDirectoryResult;
    return { total: result.total ?? 0, items: result.items ?? [] };
  },

  async getDirectoryCard(companyId: string): Promise<DeliveryDirectoryCard> {
    const { data, error } = await db.rpc("delivery_directory_get", { _company_id: companyId });
    if (error) throw new Error(error.message);
    return data as DeliveryDirectoryCard;
  },

  /** URL publique d'un logo (bucket « delivery-logos »). */
  logoPublicUrl(path: string | null | undefined): string | null {
    if (!path) return null;
    return supabase.storage.from("delivery-logos").getPublicUrl(path).data.publicUrl;
  },

  /** Dépose un logo dans le dossier de l'utilisateur et renvoie son chemin. */
  async uploadLogo(file: File): Promise<string> {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) throw new Error("Connexion requise.");
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) throw new Error("Le logo doit être une image JPG, PNG ou WEBP.");
    if (file.size > 2 * 1024 * 1024) throw new Error("Le logo ne doit pas dépasser 2 Mo.");
    const ext = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
    const path = `${userData.user.id}/logo-${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("delivery-logos").upload(path, file, { contentType: file.type, upsert: false });
    if (error) throw new Error(error.message);
    return path;
  },

  /**
   * Met à jour la fiche du responsable. La base impose ses règles : une modification de l'adresse, de la ville ou du nom
   * d'une structure approuvée la renvoie en vérification (badge retiré), et les indicateurs de performance sont intouchables.
   * Renvoie le dossier après mise à jour pour que l'écran affiche le statut réel.
   */
  async updateMyProfile(companyId: string, input: Partial<DeliveryProfileInput>): Promise<DeliveryCompany> {
    const { data, error } = await db
      .from("delivery_companies")
      .update(input)
      .eq("id", companyId)
      .select(COMPANY_SELECT)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) throw new Error("Modification refusée : ce dossier n'est pas le vôtre.");
    return withKyc(data);
  },

  /** Annuaire des vendeurs : structures approuvées (sans livreurs ni identité, que la base ne leur montre pas). */
  async getVerifiedCompaniesForCity(city: string): Promise<DeliveryCompany[]> {
    const { data, error } = await db
      .from("delivery_companies")
      .select("*, hubs:delivery_hubs(*)")
      .eq("verification_status", "approved")
      .eq("trust_badge_active", true);

    if (error) {
      console.error("Error fetching verified companies:", error);
      return [];
    }

    const list = (data || []) as DeliveryCompany[];
    if (!city) return list;

    return list.sort((a, b) => {
      const aCovers = a.covered_cities?.some((c) => c.toLowerCase().includes(city.toLowerCase()));
      const bCovers = b.covered_cities?.some((c) => c.toLowerCase().includes(city.toLowerCase()));
      if (aCovers && !bCovers) return -1;
      if (!aCovers && bCovers) return 1;
      return (b.rating_score || 5) - (a.rating_score || 5);
    });
  },

  /** Back-office : dossiers par statut (réservé aux administrateurs par la RLS). */
  async getAdminApplications(statusFilter?: DeliveryVerificationStatus | "all"): Promise<DeliveryCompany[]> {
    let query = db.from("delivery_companies").select(COMPANY_SELECT).order("created_at", { ascending: false });
    if (statusFilter && statusFilter !== "all") query = query.eq("verification_status", statusFilter);

    const { data, error } = await query;
    if (error) throw new Error(error.message);
    return ((data || []) as Record<string, unknown>[]).map(withKyc);
  },

  /** Nombre de dossiers par statut (pastilles du back-office). */
  async getAdminStatusCounts(): Promise<Record<string, number>> {
    const { data, error } = await db.from("delivery_companies").select("verification_status");
    if (error) throw new Error(error.message);
    const counts: Record<string, number> = {};
    for (const row of (data || []) as Array<{ verification_status: string }>) {
      counts[row.verification_status] = (counts[row.verification_status] ?? 0) + 1;
    }
    return counts;
  },

  /** Journal d'audit d'un dossier. Le candidat ne reçoit que les lignes « owner » (la RLS filtre). */
  async getAuditLog(companyId: string): Promise<DeliveryAuditEntry[]> {
    const { data, error } = await db
      .from("delivery_verification_audit")
      .select("*")
      .eq("company_id", companyId)
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);
    return (data || []) as DeliveryAuditEntry[];
  },

  /** Note interne (administrateurs seulement). */
  async getInternalNote(companyId: string): Promise<string> {
    const { data, error } = await db
      .from("delivery_company_review_notes")
      .select("internal_note")
      .eq("company_id", companyId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return (data?.internal_note as string | undefined) ?? "";
  },

  /**
   * Décision d'un administrateur sur une structure ou un livreur. La base applique les règles et journalise ;
   * l'Edge Function envoie l'e-mail. Lève une erreur au message lisible si la décision est refusée.
   */
  async submitDecision(input: DeliveryDecisionInput): Promise<DeliveryDecisionResult> {
    const { data, error } = await supabase.functions.invoke("verify-delivery-identity", { body: input });
    if (error) throw new Error(await functionErrorMessage(error, "Décision impossible pour le moment."));
    return {
      emailSent: !!data?.emailSent,
      emailNote: data?.emailNote,
      driversApproved: data?.driversApproved ?? [],
      driversBlocked: data?.driversBlocked ?? [],
    };
  },

  /** Ajoute un livreur à une structure. Il reste inactif jusqu'à son approbation par un administrateur. */
  async addDriver(companyId: string, input: DriverInput): Promise<void> {
    const { error } = await db.from("delivery_drivers").insert({
      company_id: companyId,
      full_name: `${input.first_name} ${input.last_name}`.trim(),
      first_name: input.first_name.trim(),
      last_name: input.last_name.trim(),
      phone: input.phone.trim(),
      whatsapp: input.whatsapp?.trim() || null,
      date_of_birth: input.date_of_birth,
      vehicle_type: input.vehicle_type,
      vehicle_license_plate: input.vehicle_license_plate?.trim() || null,
      id_type: input.id_type ?? "cni",
      id_number: input.id_number?.trim() || null,
      id_expiry: input.id_expiry || null,
      license_number: input.license_number.trim(),
      license_categories: input.license_categories,
      license_expiry: input.license_expiry,
      photo_url: input.photo_url || input.selfie_with_id_url,
      national_id_photo_url: input.national_id_photo_url,
      national_id_back_photo_url: input.national_id_back_photo_url || null,
      license_photo_url: input.license_photo_url,
      license_back_photo_url: input.license_back_photo_url || null,
      selfie_with_id_url: input.selfie_with_id_url,
    });
    if (error) throw new Error(error.message);
  },

  /**
   * Corrige un livreur (permis, pièces…). Le serveur contrôle la règle permis ↔ véhicule, repasse le livreur
   * « en attente » et l'inactive jusqu'à nouvelle vérification.
   */
  async updateDriver(driverId: string, changes: Partial<DriverInput>): Promise<void> {
    const patch: Record<string, unknown> = { ...changes };
    if (changes.first_name !== undefined || changes.last_name !== undefined) {
      const { data: current } = await db.from("delivery_drivers").select("first_name, last_name").eq("id", driverId).maybeSingle();
      patch.full_name = `${changes.first_name ?? current?.first_name ?? ""} ${changes.last_name ?? current?.last_name ?? ""}`.trim();
    }
    const { data, error } = await db.from("delivery_drivers").update(patch).eq("id", driverId).select("id");
    if (error) throw new Error(error.message);
    if (!data?.length) throw new Error("Livreur introuvable ou modification non autorisée.");
  },

  /** Notifications du compte connecté (les plus récentes d'abord). */
  async listNotifications(limit = 30): Promise<DeliveryNotification[]> {
    const { data, error } = await db
      .from("delivery_notifications")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) throw new Error(error.message);
    return (data || []) as DeliveryNotification[];
  },

  async markNotificationsRead(ids?: string[]): Promise<void> {
    let query = db.from("delivery_notifications").update({ read_at: new Date().toISOString() }).is("read_at", null);
    if (ids?.length) query = query.in("id", ids);
    const { error } = await query;
    if (error) throw new Error(error.message);
  },

  /**
   * Le marchand transmet une commande à une structure. Adresse, destinataire et montant à encaisser sont lus
   * sur la commande par le serveur ; la structure doit ensuite l'accepter ou la refuser.
   */
  async createDispatch(payload: {
    order_id: string;
    company_id: string;
    delivery_fee: number;
    delivery_note?: string;
    customer_parcel_photo_url?: string;
  }): Promise<string> {
    const { data, error } = await db.rpc("delivery_dispatch_transmit", {
      _order_id: payload.order_id,
      _company_id: payload.company_id,
      _delivery_fee: payload.delivery_fee,
      _note: payload.delivery_note || null,
      _parcel_photo_url: payload.customer_parcel_photo_url || null,
    });
    if (error || !data) {
      throw new Error(error?.message || "Impossible de transmettre la commande.");
    }
    return data as string;
  },

  /**
   * Part 1: Attach or update customer parcel photo
   */
  async updateParcelPhoto(dispatchId: string, photoUrl: string): Promise<boolean> {
    const { error } = await supabase
      .from("delivery_dispatches" as any)
      .update({ customer_parcel_photo_url: photoUrl })
      .eq("id", dispatchId);

    if (error) {
      console.error("Error updating parcel photo:", error);
      return false;
    }
    return true;
  },

  /** Transition de statut contrôlée par le serveur (qui, depuis quel statut, motif obligatoire pour échec/litige/annulation). */
  async updateDispatchStatus(dispatchId: string, status: DeliveryDispatchStatus, note?: string): Promise<boolean> {
    const { error } = await db.rpc("delivery_dispatch_set_status", {
      _dispatch_id: dispatchId,
      _status: status,
      _note: note || null,
    });
    if (error) throw new Error(error.message);
    return true;
  },

  async receiveDispatch(dispatchId: string): Promise<void> {
    const { error } = await db.rpc("delivery_dispatch_receive", { _dispatch_id: dispatchId });
    if (error) throw new Error(error.message);
  },

  async acceptDispatch(dispatchId: string): Promise<void> {
    const { error } = await db.rpc("delivery_dispatch_accept", { _dispatch_id: dispatchId });
    if (error) throw new Error(error.message);
  },

  async refuseDispatch(dispatchId: string, reason: string): Promise<void> {
    const { error } = await db.rpc("delivery_dispatch_refuse", { _dispatch_id: dispatchId, _reason: reason });
    if (error) throw new Error(error.message);
  },

  async assignDispatch(dispatchId: string, driverId: string): Promise<void> {
    const { error } = await db.rpc("delivery_dispatch_assign", { _dispatch_id: dispatchId, _driver_id: driverId });
    if (error) throw new Error(error.message);
  },

  async getDispatchHistory(dispatchId: string): Promise<DeliveryDispatchHistoryEntry[]> {
    const { data, error } = await supabase
      .from("delivery_dispatch_history" as any)
      .select("*")
      .eq("dispatch_id", dispatchId)
      .order("created_at", { ascending: true });
    if (error) {
      console.error("Error fetching dispatch history:", error);
      return [];
    }
    return ((data || []) as unknown) as DeliveryDispatchHistoryEntry[];
  },

  /**
   * Part 4: Cash Tracking - Company submits deposit proof to Seller
   */
  async submitDepositProof(
    dispatchId: string,
    proofUrl: string,
    method: string,
    ref?: string
  ): Promise<boolean> {
    const now = new Date().toISOString();

    const { error } = await supabase
      .from("delivery_cash_transfers" as any)
      .update({
        status: "transfer_initiated_to_seller",
        deposit_proof_url: proofUrl,
        deposit_method: method,
        transaction_reference: ref || null,
        deposited_at: now,
      })
      .eq("dispatch_id", dispatchId);

    if (error) {
      console.error("Error submitting deposit proof:", error);
      throw new Error(error.message);
    }

    await this.updateDispatchStatus(dispatchId, "deposit_pending");
    return true;
  },

  /**
   * Part 4: Seller confirms receipt of deposit
   */
  async confirmSellerDeposit(dispatchId: string): Promise<boolean> {
    const now = new Date().toISOString();

    const { error } = await supabase
      .from("delivery_cash_transfers" as any)
      .update({
        status: "confirmed_by_seller",
        seller_confirmed_at: now,
      })
      .eq("dispatch_id", dispatchId);

    if (error) {
      console.error("Error confirming deposit receipt:", error);
      throw new Error(error.message);
    }

    await this.updateDispatchStatus(dispatchId, "completed");
    return true;
  },

  /**
   * Part 4: Raise a dispute for delayed/unreceived deposit
   */
  async raiseCashDispute(dispatchId: string, reason: string): Promise<boolean> {
    const now = new Date().toISOString();

    const { error } = await supabase
      .from("delivery_cash_transfers" as any)
      .update({
        dispute_raised: true,
        dispute_reason: reason,
        dispute_raised_at: now,
        status: "disputed",
      })
      .eq("dispatch_id", dispatchId);

    if (error) {
      console.error("Error raising cash dispute:", error);
      throw new Error(error.message);
    }

    await this.updateDispatchStatus(dispatchId, "disputed", reason);
    return true;
  },

  /**
   * Fetch Shop Dispatches with Cash Transfer details
   */
  async getShopDispatches(shopId: string): Promise<DeliveryDispatch[]> {
    const { data, error } = await supabase
      .from("delivery_dispatches" as any)
      .select("*, company:delivery_companies(*), driver:delivery_drivers(*), cash_transfer:delivery_cash_transfers(*)")
      .eq("shop_id", shopId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching shop dispatches:", error);
      return [];
    }
    return ((data || []) as unknown) as DeliveryDispatch[];
  },

  /** Performances individuelles des livreurs de la structure (§9). */
  async getDriverStats(companyId: string): Promise<DeliveryDriverStats[]> {
    const { data, error } = await supabase.rpc("delivery_company_driver_stats" as never, { _company_id: companyId } as never);
    if (error) {
      console.error("Error fetching driver stats:", error);
      return [];
    }
    return (data ?? []) as unknown as DeliveryDriverStats[];
  },

  /** Contrôle des opérations par l administration Ecomfy (§11.2). Le serveur refuse tout compte non administrateur. */
  async getAdminOperations(days = 30): Promise<DeliveryAdminOperations> {
    const { data, error } = await supabase.rpc("delivery_admin_operations" as never, { _days: days } as never);
    if (error) throw new Error(error.message);
    return data as unknown as DeliveryAdminOperations;
  },

  /** Boutiques ayant transmis au moins une commande à la structure (filtre « commerçant » du suivi). */
  async getCompanyDispatchShops(companyId: string): Promise<{ shop_id: string; business_name: string }[]> {
    const { data, error } = await supabase.rpc("delivery_company_dispatch_shops" as never, { _company_id: companyId } as never);
    if (error) {
      console.error("Error fetching dispatch shops:", error);
      return [];
    }
    return (data ?? []) as unknown as { shop_id: string; business_name: string }[];
  },

  /**
   * Fetch Delivery Company Dispatches
   */
  async getCompanyDispatches(companyId: string): Promise<DeliveryDispatch[]> {
    const { data, error } = await supabase
      .from("delivery_dispatches" as any)
      .select("*, company:delivery_companies(*), driver:delivery_drivers(*), cash_transfer:delivery_cash_transfers(*)")
      .eq("company_id", companyId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching company dispatches:", error);
      return [];
    }
    return ((data || []) as unknown) as DeliveryDispatch[];
  }
};
