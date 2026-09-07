import { supabase } from "@/integrations/supabase/client";
import { 
  DeliveryCompany, 
  DeliveryHub, 
  DeliveryDriver, 
  DeliveryDispatch, 
  DeliveryCashTransfer,
  DeliveryVerificationStatus,
  DeliveryDispatchStatus,
  DeliveryCashStatus
} from "@/types/delivery";

export interface RegisterCompanyPayload {
  company_name: string;
  country: string;
  country_code: string;
  city: string;
  headquarters_address: string;
  manager_name: string;
  manager_phone: string;
  manager_whatsapp: string;
  manager_photo_url: string;
  manager_id_photo_url: string;
  owner_photo_url: string;
  warehouse_photo_url: string;
  
  has_tax_registration: boolean;
  tax_id_number?: string;
  tax_document_url?: string;
  trade_register_number?: string;
  
  covered_cities: string[];
  total_drivers_count: number;
  
  hubs: Array<{
    city: string;
    address: string;
    hub_name?: string;
    phone?: string;
    photo_url?: string;
  }>;
  
  drivers: Array<{
    full_name: string;
    phone: string;
    whatsapp?: string;
    vehicle_type: string;
    photo_url: string;
    national_id_photo_url: string;
    license_photo_url?: string;
  }>;
}

export const deliveryService = {
  /**
   * Part 2: Register a new delivery company application
   */
  async registerDeliveryCompany(payload: RegisterCompanyPayload): Promise<DeliveryCompany> {
    console.log("[DeliveryService] Initiating delivery company registration payload:", {
      company_name: payload.company_name,
      country: payload.country,
      city: payload.city,
      drivers_count: payload.drivers?.length,
      hubs_count: payload.hubs?.length,
    });

    // 0. Payload Pre-checks
    if (!payload.company_name?.trim()) throw new Error("Le nom de la structure de livraison est requis.");
    if (!payload.manager_name?.trim()) throw new Error("Le nom du responsable est requis.");
    if (!payload.manager_phone?.trim()) throw new Error("Le téléphone du responsable est requis.");
    if (!payload.warehouse_photo_url) throw new Error("La photo de l'entrepôt principal est requise.");
    if (!payload.manager_photo_url) throw new Error("La photo de profil du gérant est requise.");
    if (!payload.manager_id_photo_url) throw new Error("La pièce d'identité du gérant est requise.");

    const { data: userData } = await supabase.auth.getUser();
    const userId = userData.user?.id;

    // 1. Insert Company
    const { data: company, error: companyError } = await supabase
      .from("delivery_companies" as any)
      .insert({
        user_id: userId || null,
        company_name: payload.company_name.trim(),
        country: payload.country,
        country_code: payload.country_code || "CI",
        city: payload.city.trim(),
        headquarters_address: payload.headquarters_address.trim(),
        manager_name: payload.manager_name.trim(),
        manager_phone: payload.manager_phone.trim(),
        manager_whatsapp: payload.manager_whatsapp.trim(),
        manager_photo_url: payload.manager_photo_url,
        manager_id_photo_url: payload.manager_id_photo_url,
        owner_photo_url: payload.owner_photo_url || payload.manager_photo_url,
        warehouse_photo_url: payload.warehouse_photo_url,
        has_tax_registration: payload.has_tax_registration || false,
        tax_id_number: payload.tax_id_number || null,
        tax_document_url: payload.tax_document_url || null,
        trade_register_number: payload.trade_register_number || null,
        covered_cities: payload.covered_cities || [payload.city],
        total_drivers_count: payload.drivers?.length || 0,
        verification_status: "pending_verification",
        trust_badge_active: false,
      })
      .select()
      .single();

    if (companyError || !company) {
      console.error("[DeliveryService] Error inserting company:", companyError);
      const details = companyError?.details || companyError?.hint || companyError?.message;
      throw new Error(`Échec d'enregistrement de la structure : ${details || "Permission refusée ou contrainte de données."}`);
    }

    const companyId = (company as any).id;

    // 2. Insert Storage Hubs
    if (payload.hubs && payload.hubs.length > 0) {
      const hubsToInsert = payload.hubs.map((hub) => ({
        company_id: companyId,
        city: hub.city.trim(),
        address: hub.address.trim(),
        hub_name: hub.hub_name?.trim() || `Point de stockage - ${hub.city}`,
        phone: hub.phone?.trim() || payload.manager_phone,
        photo_url: hub.photo_url || null,
      }));

      const { error: hubsError } = await supabase
        .from("delivery_hubs" as any)
        .insert(hubsToInsert);

      if (hubsError) {
        console.error("[DeliveryService] Error saving delivery hubs:", hubsError);
      }
    }

    // 3. Insert Drivers
    if (payload.drivers && payload.drivers.length > 0) {
      const driversToInsert = payload.drivers.map((driver) => ({
        company_id: companyId,
        full_name: driver.full_name.trim(),
        phone: driver.phone.trim(),
        whatsapp: driver.whatsapp?.trim() || null,
        vehicle_type: driver.vehicle_type || "motorcycle",
        photo_url: driver.photo_url,
        national_id_photo_url: driver.national_id_photo_url,
        license_photo_url: driver.license_photo_url || null,
        is_active: true,
      }));

      const { error: driversError } = await supabase
        .from("delivery_drivers" as any)
        .insert(driversToInsert);

      if (driversError) {
        console.error("[DeliveryService] Error saving delivery drivers:", driversError);
      }
    }

    return (company as unknown) as DeliveryCompany;
  },

  /**
   * Get user's own delivery company application
   */
  async getMyCompany(): Promise<DeliveryCompany | null> {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return null;

    const { data, error } = await supabase
      .from("delivery_companies" as any)
      .select("*, hubs:delivery_hubs(*), drivers:delivery_drivers(*)")
      .eq("user_id", userData.user.id)
      .maybeSingle();

    if (error) {
      console.error("Error fetching my delivery company:", error);
      return null;
    }
    return (data as unknown) as DeliveryCompany | null;
  },

  /**
   * Part 1 & 4: Fetch verified delivery companies matching destination city
   */
  async getVerifiedCompaniesForCity(city: string): Promise<DeliveryCompany[]> {
    const { data, error } = await supabase
      .from("delivery_companies" as any)
      .select("*, hubs:delivery_hubs(*), drivers:delivery_drivers(*)")
      .eq("verification_status", "approved")
      .eq("trust_badge_active", true);

    if (error) {
      console.error("Error fetching verified companies:", error);
      return [];
    }

    const list = ((data || []) as unknown) as DeliveryCompany[];
    if (!city) return list;

    // Filter or prioritize companies covering the city
    return list.sort((a, b) => {
      const aCovers = a.covered_cities?.some((c) => c.toLowerCase().includes(city.toLowerCase()));
      const bCovers = b.covered_cities?.some((c) => c.toLowerCase().includes(city.toLowerCase()));
      if (aCovers && !bCovers) return -1;
      if (!aCovers && bCovers) return 1;
      return (b.rating_score || 5) - (a.rating_score || 5);
    });
  },

  /**
   * Part 3: Foundation Admin - Fetch all applications by status filter
   */
  async getAdminApplications(statusFilter?: DeliveryVerificationStatus | 'all'): Promise<DeliveryCompany[]> {
    let query = supabase
      .from("delivery_companies" as any)
      .select("*, hubs:delivery_hubs(*), drivers:delivery_drivers(*)")
      .order("created_at", { ascending: false });

    if (statusFilter && statusFilter !== 'all') {
      query = query.eq("verification_status", statusFilter);
    }

    const { data, error } = await query;
    if (error) {
      console.error("Error fetching admin delivery applications:", error);
      return [];
    }
    return ((data || []) as unknown) as DeliveryCompany[];
  },

  /**
   * Part 3: Foundation Admin - Update application verification status
   */
  async updateVerificationStatus(
    companyId: string,
    status: DeliveryVerificationStatus,
    reason?: string,
    adminNotes?: string
  ): Promise<boolean> {
    const { data: userData } = await supabase.auth.getUser();

    const updatePayload: any = {
      verification_status: status,
      trust_badge_active: status === "approved",
      rejection_reason: reason || null,
      admin_notes: adminNotes || null,
      updated_at: new Date().toISOString(),
    };

    if (status === "approved") {
      updatePayload.verified_at = new Date().toISOString();
      updatePayload.verified_by = userData.user?.id || null;
    }

    const { error } = await supabase
      .from("delivery_companies" as any)
      .update(updatePayload)
      .eq("id", companyId);

    if (error) {
      console.error("Error updating company status:", error);
      throw new Error(error.message);
    }
    return true;
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
