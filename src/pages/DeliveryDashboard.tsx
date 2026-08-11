import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, Truck, Settings, Users, Package } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DispatchTable } from "@/components/delivery/DispatchTable";
import { DriversList } from "@/components/delivery/DriversList";

export default function DeliveryDashboard() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [provider, setProvider] = useState<any>(null);
  const [stats, setStats] = useState({ pending: 0, inTransit: 0, delivered: 0, activeDrivers: 0 });

  const load = async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { navigate("/auth?redirect=/delivery-dashboard"); return; }
    
    const { data: prov } = await supabase.from("delivery_providers").select("*").eq("user_id", user.id).maybeSingle();
    if (!prov) { navigate("/delivery-signup"); return; }
    setProvider(prov);

    // Fetch stats
    const [deliveriesResponse, driversResponse] = await Promise.all([
      supabase.from("order_deliveries").select("status", { count: "exact" }).eq("provider_id", prov.id),
      supabase.from("delivery_company_members").select("id", { count: "exact" }).eq("provider_id", prov.id).eq("role", "driver").eq("is_active", true)
    ]);

    const pending = deliveriesResponse.data?.filter(d => d.status === "pending").length || 0;
    const inTransit = deliveriesResponse.data?.filter(d => d.status === "in_transit").length || 0;
    const delivered = deliveriesResponse.data?.filter(d => d.status === "delivered").length || 0;
    
    setStats({
      pending,
      inTransit,
      delivered,
      activeDrivers: driversResponse.count || 0
    });

    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  if (loading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="h-6 w-6 animate-spin" /></div>;

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
                Code Entreprise: {provider.id.substring(0, 8).toUpperCase()}
              </span>
            </p>
          </div>
        </div>
        <Button asChild variant="outline" size="sm" className="rounded-lg">
          <Link to="/delivery-signup"><Settings className="h-4 w-4 mr-2" /> Paramètres</Link>
        </Button>
      </div>

      <Tabs defaultValue="dispatch" className="space-y-6">
        <TabsList className="bg-white border border-slate-100 shadow-sm p-1">
          <TabsTrigger value="dispatch" className="data-[state=active]:bg-primary/5 data-[state=active]:text-primary gap-2">
            <Package className="w-4 h-4" />
            Missions & Dispatch
          </TabsTrigger>
          <TabsTrigger value="team" className="data-[state=active]:bg-primary/5 data-[state=active]:text-primary gap-2">
            <Users className="w-4 h-4" />
            Mon Équipe
          </TabsTrigger>
        </TabsList>

        <TabsContent value="dispatch" className="space-y-6 mt-0">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card className="p-4 bg-white shadow-sm border-slate-100">
              <div className="text-sm font-medium text-slate-500">À assigner / récupérer</div>
              <div className="text-3xl font-bold text-orange-600 mt-1">{stats.pending}</div>
            </Card>
            <Card className="p-4 bg-white shadow-sm border-slate-100">
              <div className="text-sm font-medium text-slate-500">En cours de livraison</div>
              <div className="text-3xl font-bold text-blue-600 mt-1">{stats.inTransit}</div>
            </Card>
            <Card className="p-4 bg-white shadow-sm border-slate-100">
              <div className="text-sm font-medium text-slate-500">Livrées</div>
              <div className="text-3xl font-bold text-green-600 mt-1">{stats.delivered}</div>
            </Card>
            <Card className="p-4 bg-white shadow-sm border-slate-100">
              <div className="text-sm font-medium text-slate-500">Livreurs actifs</div>
              <div className="text-3xl font-bold text-slate-800 mt-1">{stats.activeDrivers}</div>
            </Card>
          </div>
          
          <DispatchTable providerId={provider.id} />
        </TabsContent>

        <TabsContent value="team" className="mt-0">
          <DriversList providerId={provider.id} />
        </TabsContent>
      </Tabs>
    </div>
  );
}