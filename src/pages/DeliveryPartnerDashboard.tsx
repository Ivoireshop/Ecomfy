import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Truck, 
  ShieldCheck, 
  Package, 
  Clock, 
  CheckCircle2, 
  AlertTriangle, 
  Users, 
  DollarSign, 
  RefreshCw,
  Phone,
  MapPin,
  Camera,
  Search,
  Wallet,
  Star,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { deliveryService } from "@/lib/deliveryService";
import { DeliveryWorkspace, DeliveryAssignableDriver, DeliveryDispatch, DeliveryDispatchStatus, DELIVERY_ROLE_LABELS, DeliveryPerm } from "@/types/delivery";
import DeliveryProfileEditor from "@/components/delivery/DeliveryProfileEditor";
import { DeliveryTeamPanel } from "@/components/delivery/DeliveryTeamPanel";
import { DeliveryDriverStatsPanel } from "@/components/delivery/DeliveryDriverStatsPanel";
import DeliveryCashTracker from "@/components/delivery/DeliveryCashTracker";
import { DeliveryNotificationBell } from "@/components/delivery/DeliveryNotificationBell";
import { DeliveryStructureOverview } from "@/components/delivery/DeliveryStructureOverview";

const DISPATCH_STATUS_LABELS: Record<string, string> = {
  transmitted: "Nouvelle", accepted: "Acceptée", refused: "Refusée", preparing: "En préparation",
  pending_assignment: "À affecter", assigned: "Affectée", picked_up: "Récupérée", in_transit: "En livraison",
  delivered: "Livrée", failed: "Échec", returned: "Retournée", cod_collected: "Encaissée",
  deposit_pending: "Reversement en attente", completed: "Terminée", cancelled: "Annulée", disputed: "Litige",
};

export default function DeliveryPartnerDashboard() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [loading, setLoading] = useState<boolean>(true);
  const [showProfile, setShowProfile] = useState<boolean>(false);
  const [company, setCompany] = useState<DeliveryWorkspace | null>(null);
  const [drivers, setDrivers] = useState<DeliveryAssignableDriver[]>([]);
  const [dispatches, setDispatches] = useState<DeliveryDispatch[]>([]);
  // Filtres du §7.2 : statut, livreur affecté, zone (ville), date.
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [driverFilter, setDriverFilter] = useState<string>("all");
  const [periodFilter, setPeriodFilter] = useState<string>("all");
  const [search, setSearch] = useState<string>("");
  const [shopFilter, setShopFilter] = useState<string>("all");
  const [shops, setShops] = useState<{ shop_id: string; business_name: string }[]>([]);

  const loadDashboard = async () => {
    setLoading(true);
    try {
      const ws = await deliveryService.getMyWorkspace();
      setCompany(ws);

      if (ws) {
        const list = await deliveryService.getCompanyDispatches(ws.company_id);
        setDispatches(list);
        setShops(ws.perms.includes("read") ? await deliveryService.getCompanyDispatchShops(ws.company_id) : []);
        // Les livreurs affectables ne sont chargés que pour qui a le droit d'affecter.
        setDrivers(ws.perms.includes("assign") ? await deliveryService.getAssignableDrivers(ws.company_id) : []);
      }
    } catch (err) {
      console.error(err);
      toast({ variant: "destructive", title: "Erreur", description: "Impossible de charger le tableau de bord livraison." });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboard();
  }, []);

  // Temps réel (§10) : une nouvelle transmission ou un changement de statut apparaît sans recharger la page.
  const companyId = company?.company_id;
  useEffect(() => {
    if (!companyId) return;
    const channel = supabase
      .channel(`company-dispatches-${companyId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "delivery_dispatches", filter: `company_id=eq.${companyId}` }, () => {
        deliveryService.getCompanyDispatches(companyId).then(setDispatches);
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [companyId]);

  // Une action serveur à la fois par course ; le message d'erreur du serveur (transition refusée, motif manquant) s'affiche tel quel.
  const [busyId, setBusyId] = useState<string | null>(null);
  const [reasonFor, setReasonFor] = useState<{ id: string; status: "refused" | "failed" } | null>(null);
  const [reason, setReason] = useState("");

  const run = async (dispatchId: string, action: () => Promise<unknown>, success: string) => {
    setBusyId(dispatchId);
    try {
      await action();
      toast({ title: success });
      setReasonFor(null);
      setReason("");
      await loadDashboard();
    } catch (err: any) {
      toast({ variant: "destructive", title: "Action impossible", description: err.message });
    } finally {
      setBusyId(null);
    }
  };

  const handleUpdateStatus = (dispatchId: string, newStatus: DeliveryDispatchStatus, note?: string) =>
    run(dispatchId, () => deliveryService.updateDispatchStatus(dispatchId, newStatus, note), "Statut mis à jour");

  const can = (perm: DeliveryPerm) => !!company?.perms.includes(perm);
  // Les livreurs et l'équipe de gestion font avancer une course ; la réception ne fait que préparer.
  const canMove = can('operate') || company?.role === 'driver';
  const activeDrivers = drivers.filter((d) => d.is_active && d.verification_status === "approved");

  if (loading && !company) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center">
        <RefreshCw className="w-8 h-8 text-emerald-400 animate-spin" />
      </div>
    );
  }

  if (!company) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-4">
        <Card className="max-w-md bg-slate-900 border-slate-800 text-center">
          <CardHeader>
            <CardTitle>Aucun espace livraison actif</CardTitle>
            <CardDescription>Enregistrez une structure de livraison, ou ouvrez le lien d'invitation reçu de votre responsable.</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  const periodStart = periodFilter === "today" ? new Date(new Date().setHours(0, 0, 0, 0)).getTime()
    : periodFilter === "7d" ? Date.now() - 7 * 86400000
    : periodFilter === "30d" ? Date.now() - 30 * 86400000 : 0;
  const needle = search.trim().toLowerCase();
  const filteredDispatches = dispatches.filter((d) => {
    if (statusFilter !== "all" && d.status !== statusFilter) return false;
    if (shopFilter !== "all" && d.shop_id !== shopFilter) return false;
    if (driverFilter === "none" ? !!d.assigned_driver_id : driverFilter !== "all" && d.assigned_driver_id !== driverFilter) return false;
    if (periodStart && new Date(d.transmitted_at ?? d.created_at).getTime() < periodStart) return false;
    if (needle && !`${d.recipient_name} ${d.recipient_phone} ${d.city} ${d.delivery_address}`.toLowerCase().includes(needle)) return false;
    return true;
  });
  const filtersActive = shopFilter !== "all" || statusFilter !== "all" || driverFilter !== "all" || periodFilter !== "all" || needle !== "";
  const selectClass = "h-9 rounded-md bg-slate-900 border border-slate-700 text-xs text-slate-200 px-2";

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 sm:p-6 lg:p-8 font-sans">
      <div className="max-w-7xl mx-auto space-y-6">

        {/* Top Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-5">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
              <Truck className="w-8 h-8" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-extrabold text-white">{company.company_name}</h1>
                {company.verification_status === "approved" && company.trust_badge_active ? (
                  <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/40 text-xs">
                    <ShieldCheck className="w-3.5 h-3.5 mr-1" /> Partenaire Certifié
                  </Badge>
                ) : (
                  <Badge className="bg-amber-500/20 text-amber-300 border-amber-500/40 text-xs">
                    Vérification : {company.verification_status}
                  </Badge>
                )}
              </div>
              <p className="text-xs text-slate-400 flex items-center gap-2 mt-1">
                <span>{company.city}, {company.country}</span>
                <span>•</span>
                <span>{company.drivers_count} {company.drivers_count > 1 ? "livreurs rattachés" : "livreur rattaché"} • {DELIVERY_ROLE_LABELS[company.role]}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <DeliveryNotificationBell />
            {/* Le dossier (KYC, statut, pièces) appartient au propriétaire : lui seul peut le consulter. */}
            {company.role === "owner" && (
              <Button
                onClick={() => navigate("/delivery/status")}
                variant="outline"
                size="sm"
                className="bg-slate-900 hover:text-white border-slate-800 text-slate-300 hover:bg-slate-900"
              >
                <ShieldCheck className="w-4 h-4 mr-2" /> Suivi du dossier
              </Button>
            )}
            {company.role === "owner" && (
              <Button
                onClick={() => navigate("/delivery/fees")}
                variant="outline"
                size="sm"
                className="bg-slate-900 hover:text-white border-slate-800 text-slate-300 hover:bg-slate-900"
              >
                <Wallet className="w-4 h-4 mr-2" /> Cotisation et caution
              </Button>
            )}
            {company.role === "owner" && (
              <Button
                onClick={() => navigate("/delivery/premium")}
                variant="outline"
                size="sm"
                className="bg-slate-900 hover:text-white border-slate-800 text-slate-300 hover:bg-slate-900"
              >
                <Star className="w-4 h-4 mr-2" /> Premium
              </Button>
            )}
            <Button
              onClick={loadDashboard}
              variant="outline"
              size="sm"
              className="bg-slate-900 hover:text-white border-slate-800 text-slate-300 hover:bg-slate-900"
            >
              <RefreshCw className="w-4 h-4 mr-2" /> Actualiser
            </Button>
          </div>
        </div>

        {/* Vue d'ensemble (§3.1) : compteurs par état, livreurs actifs, activité quotidienne */}
        <DeliveryStructureOverview
          dispatches={dispatches}
          activeDrivers={can("assign") ? activeDrivers.length : company.drivers_count}
        />
        <div className="text-xs text-slate-400">Note des vendeurs : ⭐ {company.rating_score || 5.0}</div>

        {company.role === "owner" && (
          <div className="space-y-3">
            <Button
              type="button"
              onClick={() => setShowProfile((v) => !v)}
              aria-expanded={showProfile}
              className="bg-slate-800 text-slate-100 hover:bg-slate-700 border border-slate-700 text-xs"
            >
              {showProfile ? "Masquer le profil" : "Modifier le profil de ma structure"}
            </Button>
            {showProfile && <DeliveryProfileEditor onSaved={() => void loadDashboard()} />}
          </div>
        )}

        {can("manage_team") && <DeliveryTeamPanel companyId={company.company_id} role={company.role} />}

        {can("stats") && <DeliveryDriverStatsPanel companyId={company.company_id} refreshKey={dispatches.map((d) => `${d.id}${d.status}${d.assigned_driver_id ?? ""}`).join("|")} />}

        {/* Dispatches List */}
        <div className="space-y-4">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Package className="w-5 h-5 text-emerald-400" /> Commandes Assignées à votre Structure
          </h2>

          {dispatches.length === 0 ? (
            <div className="py-16 text-center text-slate-500 text-sm bg-slate-900/50 rounded-2xl border border-slate-800">
              Aucune commande attribuée pour le moment. Dès qu'un marchand vous transmet une commande, elle apparaîtra ici et vous serez notifié.
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Client, téléphone, ville…"
                  aria-label="Rechercher une commande"
                  className="h-9 w-full sm:w-56 rounded-md bg-slate-900 border border-slate-700 text-xs text-slate-200 px-3 placeholder:text-slate-500"
                />
                <select aria-label="Filtrer par statut" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className={selectClass}>
                  <option value="all">Tous les statuts</option>
                  {Object.entries(DISPATCH_STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
                {shops.length > 0 && (
                  <select aria-label="Filtrer par commerçant" value={shopFilter} onChange={(e) => setShopFilter(e.target.value)} className={selectClass}>
                    <option value="all">Tous les commerçants</option>
                    {shops.map((s) => <option key={s.shop_id} value={s.shop_id}>{s.business_name}</option>)}
                  </select>
                )}
                <select aria-label="Filtrer par livreur" value={driverFilter} onChange={(e) => setDriverFilter(e.target.value)} className={selectClass}>
                  <option value="all">Tous les livreurs</option>
                  <option value="none">Sans livreur</option>
                  {drivers.map((d) => <option key={d.id} value={d.id}>{d.full_name}</option>)}
                </select>
                <select aria-label="Filtrer par date" value={periodFilter} onChange={(e) => setPeriodFilter(e.target.value)} className={selectClass}>
                  <option value="all">Toutes les dates</option>
                  <option value="today">Aujourd'hui</option>
                  <option value="7d">7 derniers jours</option>
                  <option value="30d">30 derniers jours</option>
                </select>
                {filtersActive && (
                  <button
                    type="button"
                    className="text-xs text-emerald-400 hover:underline"
                    onClick={() => { setShopFilter("all"); setStatusFilter("all"); setDriverFilter("all"); setPeriodFilter("all"); setSearch(""); }}
                  >
                    Réinitialiser
                  </button>
                )}
                <span className="text-xs text-slate-500 ml-auto">{filteredDispatches.length} / {dispatches.length}</span>
              </div>
              {filteredDispatches.length === 0 && (
                <div className="py-10 text-center text-slate-500 text-sm bg-slate-900/50 rounded-2xl border border-slate-800">
                  Aucune commande ne correspond à ces filtres.
                </div>
              )}
              {filteredDispatches.map((dispatch) => (
                <Card key={dispatch.id} className="bg-slate-900 border-slate-800 p-4 space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-white text-base">{dispatch.recipient_name}</span>
                        <span className="text-emerald-400 font-mono text-xs">{dispatch.recipient_phone}</span>
                        <Badge className="bg-slate-800 text-slate-300 text-[10px]">{DISPATCH_STATUS_LABELS[dispatch.status] ?? dispatch.status}</Badge>
                      </div>
                      <p className="text-xs text-slate-400 mt-0.5">
                        <MapPin className="w-3.5 h-3.5 inline mr-1 text-slate-500" />
                        {dispatch.city} — {dispatch.delivery_address}
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      {dispatch.status === 'transmitted' && can('operate') && (
                        <>
                          <Button
                            disabled={busyId === dispatch.id}
                            onClick={() => run(dispatch.id, () => deliveryService.acceptDispatch(dispatch.id), "Commande acceptée")}
                            size="sm"
                            className="bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold text-xs"
                          >
                            Accepter
                          </Button>
                          <Button
                            disabled={busyId === dispatch.id}
                            onClick={() => { setReasonFor({ id: dispatch.id, status: "refused" }); setReason(""); }}
                            size="sm"
                            variant="outline"
                            className="bg-slate-900 border-red-500/40 text-red-400 hover:bg-red-950 hover:text-red-300 text-xs"
                          >
                            Refuser
                          </Button>
                        </>
                      )}

                      {can('read') && (dispatch.status === 'accepted' || dispatch.status === 'preparing' || dispatch.status === 'pending_assignment' || dispatch.status === 'assigned' || dispatch.status === 'failed') && (
                        <>
                          {dispatch.status === 'accepted' && (
                            <Button
                              disabled={busyId === dispatch.id}
                              onClick={() => handleUpdateStatus(dispatch.id, 'preparing')}
                              size="sm"
                              variant="outline"
                              className="bg-slate-900 border-slate-700 text-slate-200 text-xs"
                            >
                              En préparation
                            </Button>
                          )}
                          {!can('assign') ? null : activeDrivers.length === 0 ? (
                            <span className="text-[11px] text-amber-300">Aucun livreur approuvé et actif à qui affecter.</span>
                          ) : (
                            <select
                              aria-label="Affecter à un livreur"
                              defaultValue=""
                              disabled={busyId === dispatch.id}
                              onChange={(e) => e.target.value && run(dispatch.id, () => deliveryService.assignDispatch(dispatch.id, e.target.value), dispatch.status === "assigned" ? "Commande réaffectée" : "Livreur affecté")}
                              className="h-8 rounded-md bg-slate-950 border border-slate-700 text-xs px-2 text-slate-200"
                            >
                              <option value="">{dispatch.status === "assigned" ? "Réaffecter à…" : "Affecter à…"}</option>
                              {activeDrivers.filter((d) => d.id !== dispatch.assigned_driver_id).map((d) => (
                                <option key={d.id} value={d.id}>{d.full_name}</option>
                              ))}
                            </select>
                          )}
                          {dispatch.status === 'failed' && can('operate') && (
                            <Button
                              disabled={busyId === dispatch.id}
                              onClick={() => handleUpdateStatus(dispatch.id, 'returned')}
                              size="sm"
                              variant="outline"
                              className="bg-slate-900 border-slate-700 text-slate-200 text-xs"
                            >
                              Retourné au marchand
                            </Button>
                          )}
                        </>
                      )}

                      {dispatch.status === 'assigned' && canMove && (
                        <Button
                          disabled={busyId === dispatch.id}
                          onClick={() => handleUpdateStatus(dispatch.id, 'picked_up')}
                          size="sm"
                          className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs"
                        >
                          Confirmer Prise en Charge
                        </Button>
                      )}

                      {dispatch.status === 'picked_up' && canMove && (
                        <Button
                          disabled={busyId === dispatch.id}
                          onClick={() => handleUpdateStatus(dispatch.id, 'in_transit')}
                          size="sm"
                          className="bg-blue-500 hover:bg-blue-600 text-white font-bold text-xs"
                        >
                          Démarrer la Livraison
                        </Button>
                      )}

                      {canMove && (dispatch.status === 'picked_up' || dispatch.status === 'in_transit') && (
                        <>
                          <Button
                            disabled={busyId === dispatch.id}
                            onClick={() => handleUpdateStatus(dispatch.id, 'delivered')}
                            size="sm"
                            className="bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold text-xs"
                          >
                            Marquer livré
                          </Button>
                          <Button
                            disabled={busyId === dispatch.id}
                            onClick={() => { setReasonFor({ id: dispatch.id, status: "failed" }); setReason(""); }}
                            size="sm"
                            variant="outline"
                            className="bg-slate-900 border-red-500/40 text-red-400 hover:bg-red-950 hover:text-red-300 text-xs"
                          >
                            Livraison échouée
                          </Button>
                        </>
                      )}

                      {dispatch.status === 'delivered' && dispatch.cod_amount > 0 && can('cash') && (
                        <Button
                          disabled={busyId === dispatch.id}
                          onClick={() => handleUpdateStatus(dispatch.id, 'cod_collected')}
                          size="sm"
                          className="bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold text-xs"
                        >
                          Confirmer l'encaissement
                        </Button>
                      )}
                    </div>
                  </div>

                  {dispatch.status === 'refused' && dispatch.refusal_reason && (
                    <p className="text-xs text-red-300">Refusée : {dispatch.refusal_reason}</p>
                  )}
                  {dispatch.status === 'failed' && dispatch.failure_reason && (
                    <p className="text-xs text-red-300">Échec : {dispatch.failure_reason}</p>
                  )}

                  {reasonFor?.id === dispatch.id && (
                    <div className="space-y-2 rounded-lg border border-slate-700 bg-slate-950 p-3">
                      <label className="text-xs font-semibold text-slate-200">
                        {reasonFor.status === "refused" ? "Motif du refus (visible du marchand)" : "Motif de l'échec de livraison"}
                      </label>
                      <Textarea
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                        placeholder={reasonFor.status === "refused" ? "Ex. zone non couverte" : "Ex. client absent"}
                        className="bg-slate-900 border-slate-700 text-sm"
                      />
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          disabled={busyId === dispatch.id || reason.trim().length < 3}
                          onClick={() =>
                            reasonFor.status === "refused"
                              ? run(dispatch.id, () => deliveryService.refuseDispatch(dispatch.id, reason.trim()), "Commande refusée")
                              : handleUpdateStatus(dispatch.id, "failed", reason.trim())
                          }
                          className="bg-red-500 hover:bg-red-600 text-white text-xs"
                        >
                          Confirmer
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setReasonFor(null)} className="text-xs text-slate-400">
                          Annuler
                        </Button>
                      </div>
                    </div>
                  )}

                  {/* Parcel photo preview if attached */}
                  {dispatch.customer_parcel_photo_url && (
                    <div className="flex items-center gap-3 p-2.5 rounded-lg bg-slate-950 border border-slate-800 text-xs">
                      <img src={dispatch.customer_parcel_photo_url} alt="Photo colis" className="w-12 h-12 object-cover rounded-md border border-slate-700" />
                      <div>
                        <span className="font-semibold text-slate-200 block">Photo du Colis Fournie par le Client</span>
                        <span className="text-[10px] text-slate-400">Référence visuelle du paquet à récupérer</span>
                      </div>
                    </div>
                  )}

                  {/* Cash Cycle Tracker component */}
                  {can("cash") && ["delivered", "cod_collected", "completed", "deposit_pending"].includes(dispatch.status) && <DeliveryCashTracker dispatch={dispatch} userRole="partner" onUpdate={loadDashboard} />}
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
