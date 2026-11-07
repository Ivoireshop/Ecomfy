import { supabase } from "@/integrations/supabase/client";
import {
  DeliveryAuditEntry,
  DeliveryCompany,
  DeliveryCompanyKyc,
  DeliveryDispatch,
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
  license_photo_url: string;
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
    manager_selfie_with_id_url: string;
    warehouse_photo_url?: string;
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

const COMPANY_SELECT = "*, hubs:delivery_hubs(*), drivers:delivery_drivers(*), kyc:delivery_company_kyc(*)";

const normalizeKyc = (value: unknown): DeliveryCompanyKyc | null =>
  ((Array.isArray(value) ? value[0] : value) as DeliveryCompanyKyc | undefined) ?? null;

const withKyc = (row: Record<string, unknown>): DeliveryCompany =>
  ({ ...row, kyc: normalizeKyc(row.kyc) }) as unknown as DeliveryCompany;

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
      license_photo_url: input.license_photo_url,
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
   * Part 1: Seller dispatches order to a delivery partner (2-3 clicks)
   */
  async createDispatch(payload: {
    order_id: string;
    shop_id: string;
    company_id: string;
    delivery_address: string;
    recipient_name: string;
    recipient_phone: string;
    city: string;
    cod_amount: number;
    delivery_fee: number;
    delivery_note?: string;
    customer_parcel_photo_url?: string;
  }): Promise<DeliveryDispatch> {
    // 1. Insert Dispatch record
    const { data: dispatch, error: dispatchErr } = await supabase
      .from("delivery_dispatches" as any)
      .insert({
        order_id: payload.order_id,
        shop_id: payload.shop_id,
        company_id: payload.company_id,
        status: "assigned",
        delivery_address: payload.delivery_address,
        recipient_name: payload.recipient_name,
        recipient_phone: payload.recipient_phone,
        city: payload.city,
        cod_amount: payload.cod_amount,
        delivery_fee: payload.delivery_fee,
        delivery_note: payload.delivery_note || null,
        customer_parcel_photo_url: payload.customer_parcel_photo_url || null,
        assigned_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (dispatchErr || !dispatch) {
      console.error("Error creating order dispatch:", dispatchErr);
      throw new Error(dispatchErr?.message || "Impossible d'assigner le livreur.");
    }

    // 2. Initialize Cash Transfer Audit Record
    const netSeller = payload.cod_amount - payload.delivery_fee;
    const { error: cashErr } = await supabase
      .from("delivery_cash_transfers" as any)
      .insert({
        dispatch_id: (dispatch as any).id,
        company_id: payload.company_id,
        shop_id: payload.shop_id,
        cod_amount: payload.cod_amount,
        delivery_fee: payload.delivery_fee,
        net_seller_amount: netSeller > 0 ? netSeller : payload.cod_amount,
        currency: "XOF",
        status: "pending_collection",
      });

    if (cashErr) {
      console.warn("Warning: Could not create cash audit entry:", cashErr);
    }

    return (dispatch as unknown) as DeliveryDispatch;
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

  /**
   * Update Dispatch Status (Driver / Company / Seller)
   */
  async updateDispatchStatus(
    dispatchId: string,
    status: DeliveryDispatchStatus,
    driverId?: string
  ): Promise<boolean> {
    const updateObj: any = { status };
    const now = new Date().toISOString();

    if (driverId) updateObj.assigned_driver_id = driverId;
    if (status === 'picked_up') updateObj.picked_up_at = now;
    if (status === 'delivered' || status === 'cod_collected') {
      updateObj.delivered_at = now;
      updateObj.cod_collected_at = now;
    }

    const { error } = await supabase
      .from("delivery_dispatches" as any)
      .update(updateObj)
      .eq("id", dispatchId);

    if (error) {
      console.error("Error updating dispatch status:", error);
      throw new Error(error.message);
    }

    // Also sync cash status if collected
    if (status === 'cod_collected' || status === 'delivered') {
      await supabase
        .from("delivery_cash_transfers" as any)
        .update({ status: 'collected_by_driver' })
        .eq("dispatch_id", dispatchId);
    }

    return true;
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

    await supabase
      .from("delivery_dispatches" as any)
      .update({ status: "deposit_pending" })
      .eq("id", dispatchId);

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

    await supabase
      .from("delivery_dispatches" as any)
      .update({
        status: "completed",
        seller_payout_completed_at: now,
      })
      .eq("id", dispatchId);

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

    await supabase
      .from("delivery_dispatches" as any)
      .update({ status: "disputed" })
      .eq("id", dispatchId);

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
