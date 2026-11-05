import { useCallback, useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, Truck, Settings, Users, Package, Banknote } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DispatchTable } from "@/components/delivery/DispatchTable";
import { DriversList } from "@/components/delivery/DriversList";
import { DeliveryCashTab } from "@/components/delivery/DeliveryCashTab";
import { useDeliveryEvents } from "@/hooks/useDeliveryEvents";
import {
  canManageCash,
  canManageDeliveries,
  deliveryRpc,
  type ProviderDriverRow,
  type ProviderInfo,
} from "@/lib/deliveryRpc";

const ROLE_LABELS: Record<string, string> = {
  owner: "Propriétaire",
  admin: "Administrateur",
  dispatcher: "Dispatcher",
  cashier: "Caissier",
};

export default function DeliveryDashboard() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(true);
  const [provider, setProvider] = useState<ProviderInfo | null>(null);
  const [stats, setStats] = useState({ pending: 0, inTransit: 0, delivered: 0, failed: 0, activeDrivers: 0 });

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { navigate("/auth?redirect=/delivery-dashboard"); return; }

    // Propriétaire, ou membre actif (admin, dispatcher, caissier) : la lecture directe de delivery_providers
    // est réservée au propriétaire, d'où la fonction serveur.
    const [prov] = await deliveryRpc<ProviderInfo>("get_my_delivery_provider");
    if (!prov) { navigate("/delivery-signup"); return; }
    setProvider(prov);

    const [deliveriesResponse, team] = await Promise.all([
      supabase.from("order_deliveries").select("status").eq("provider_id", prov.provider_id),
      deliveryRpc<ProviderDriverRow>("get_provider_drivers", { _provider_id: prov.provider_id }),
    ]);

    const rows = deliveriesResponse.data ?? [];
    setStats({
      pending: rows.filter(d => d.status === "pending").length,
      inTransit: rows.filter(d => d.status === "in_transit" || d.status === "picked_up").length,
      delivered: rows.filter(d => d.status === "delivered").length,
      failed: rows.filter(d => d.status === "failed").length,
      activeDrivers: team.filter(m => m.role === "driver" && m.is_active).length,
    });

    setLoading(false);
  }, [navigate]);

  useEffect(() => { void load(); }, [load]);

  // Alertes en direct (échec, annulation de commande, livraison) puis rechargement silencieux.
  useDeliveryEvents("provider_id", provider?.provider_id, "provider", () => {
    void load(true);
    queryClient.invalidateQueries({ queryKey: ["provider-deliveries"] });
    queryClient.invalidateQueries({ queryKey: ["provider-payments"] });
  });

  if (loading || !provider) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="h-6 w-6 animate-spin" /></div>;

  const isOwner = provider.member_role === "owner";
  const showCash = canManageCash(provider.member_role);

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-8 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-white p-6 rounded-xl border border-slate-100 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="h-14 w-14 rounded-xl bg-primary/10 flex items-center justify-center">
            <Truck className="h-7 w-7 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-800">{provider.company_name}</h1>
            <p className="text-sm text-slate-500 flex items-center gap-2">
              <span>Tableau de bord Dispatch</span>
              <span className="w-1 h-1 rounded-full bg-slate-300"></span>
              <span className="font-mono text-xs bg-slate-100 px-2 py-0.5 rounded text-slate-600">
                Code Entreprise: {provider.provider_id.substring(0, 8).toUpperCase()}
              </span>
              {!isOwner && (
                <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded" data-testid="member-role">
                  {ROLE_LABELS[provider.member_role] ?? provider.member_role}
                </span>
              )}
            </p>
          </div>
        </div>
        {isOwner && (
          <Button asChild variant="outline" size="sm" className="rounded-lg">
            <Link to="/delivery-signup"><Settings className="h-4 w-4 mr-2" /> Paramètres</Link>
          </Button>
        )}
      </div>

      <Tabs defaultValue="dispatch" className="space-y-6">
        <TabsList className="bg-white border border-slate-100 shadow-sm p-1">
          <TabsTrigger value="dispatch" className="data-[state=active]:bg-primary/5 data-[state=active]:text-primary gap-2">
            <Package className="w-4 h-4" />
            Missions & Dispatch
          </TabsTrigger>
          {showCash && (
            <TabsTrigger value="cash" className="data-[state=active]:bg-primary/5 data-[state=active]:text-primary gap-2">
              <Banknote className="w-4 h-4" />
              Caisse
            </TabsTrigger>
          )}
          {isOwner && (
            <TabsTrigger value="team" className="data-[state=active]:bg-primary/5 data-[state=active]:text-primary gap-2">
              <Users className="w-4 h-4" />
              Mon Équipe
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="dispatch" className="space-y-6 mt-0">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <Card className="p-4 bg-white shadow-sm border-slate-100">
              <div className="text-sm font-medium text-slate-500">À assigner / récupérer</div>
              <div className="text-3xl font-bold text-orange-600 mt-1" data-testid="stat-pending">{stats.pending}</div>
            </Card>
            <Card className="p-4 bg-white shadow-sm border-slate-100">
              <div className="text-sm font-medium text-slate-500">En cours de livraison</div>
              <div className="text-3xl font-bold text-blue-600 mt-1" data-testid="stat-in-transit">{stats.inTransit}</div>
            </Card>
            <Card className="p-4 bg-white shadow-sm border-slate-100">
              <div className="text-sm font-medium text-slate-500">Livrées</div>
              <div className="text-3xl font-bold text-green-600 mt-1" data-testid="stat-delivered">{stats.delivered}</div>
            </Card>
            <Card className="p-4 bg-white shadow-sm border-slate-100">
              <div className="text-sm font-medium text-slate-500">Échecs à relancer</div>
              <div className="text-3xl font-bold text-red-600 mt-1" data-testid="stat-failed">{stats.failed}</div>
            </Card>
            <Card className="p-4 bg-white shadow-sm border-slate-100">
              <div className="text-sm font-medium text-slate-500">Livreurs actifs</div>
              <div className="text-3xl font-bold text-slate-800 mt-1">{stats.activeDrivers}</div>
            </Card>
          </div>

          <DispatchTable providerId={provider.provider_id} canManage={canManageDeliveries(provider.member_role)} />
        </TabsContent>

        {showCash && (
          <TabsContent value="cash" className="mt-0">
            <DeliveryCashTab providerId={provider.provider_id} />
          </TabsContent>
        )}

        {isOwner && (
          <TabsContent value="team" className="mt-0">
            <DriversList providerId={provider.provider_id} />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
