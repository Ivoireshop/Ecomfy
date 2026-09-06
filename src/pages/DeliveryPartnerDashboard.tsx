import React, { useEffect, useState } from "react";
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
  Search
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/use-toast";
import { deliveryService } from "@/lib/deliveryService";
import { DeliveryCompany, DeliveryDispatch, DeliveryDispatchStatus } from "@/types/delivery";
import DeliveryCashTracker from "@/components/delivery/DeliveryCashTracker";

export default function DeliveryPartnerDashboard() {
  const { toast } = useToast();
  const [loading, setLoading] = useState<boolean>(true);
  const [company, setCompany] = useState<DeliveryCompany | null>(null);
  const [dispatches, setDispatches] = useState<DeliveryDispatch[]>([]);

  const loadDashboard = async () => {
    setLoading(true);
    try {
      const myComp = await deliveryService.getMyCompany();
      setCompany(myComp);

      if (myComp) {
        const list = await deliveryService.getCompanyDispatches(myComp.id);
        setDispatches(list);
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

  const handleUpdateStatus = async (dispatchId: string, newStatus: DeliveryDispatchStatus) => {
    try {
      await deliveryService.updateDispatchStatus(dispatchId, newStatus);
      toast({
        title: "Statut mis à jour",
        description: `Le colis est maintenant '${newStatus}'.`,
      });
      loadDashboard();
    } catch (err: any) {
      console.error(err);
      toast({ variant: "destructive", title: "Erreur", description: err.message });
    }
  };

  if (loading) {
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
            <CardTitle>Aucun Espace Livreur Actif</CardTitle>
            <CardDescription>Vous devez enregistrer une structure de livraison.</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  const pendingDispatches = dispatches.filter((d) => d.status === 'assigned' || d.status === 'pending_assignment');
  const activeDispatches = dispatches.filter((d) => d.status === 'picked_up' || d.status === 'in_transit');
  const completedDispatches = dispatches.filter((d) => d.status === 'delivered' || d.status === 'completed' || d.status === 'cod_collected');

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
                <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/40 text-xs">
                  <ShieldCheck className="w-3.5 h-3.5 mr-1" /> Partenaire Certifié
                </Badge>
              </div>
              <p className="text-xs text-slate-400 flex items-center gap-2 mt-1">
                <span>{company.city}, {company.country}</span>
                <span>•</span>
                <span>{company.drivers?.length || company.total_drivers_count} livreurs rattachés</span>
              </p>
            </div>
          </div>

          <Button
            onClick={loadDashboard}
            variant="outline"
            size="sm"
            className="border-slate-800 text-slate-300 hover:bg-slate-900"
          >
            <RefreshCw className="w-4 h-4 mr-2" /> Actualiser
          </Button>
        </div>

        {/* Overview Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <Card className="bg-slate-900 border-slate-800 p-4 space-y-1">
            <span className="text-xs text-slate-400">À Récupérer</span>
            <div className="text-2xl font-bold text-amber-400">{pendingDispatches.length}</div>
          </Card>

          <Card className="bg-slate-900 border-slate-800 p-4 space-y-1">
            <span className="text-xs text-slate-400">En cours de Livraison</span>
            <div className="text-2xl font-bold text-blue-400">{activeDispatches.length}</div>
          </Card>

          <Card className="bg-slate-900 border-slate-800 p-4 space-y-1">
            <span className="text-xs text-slate-400">Livraisons Réussies</span>
            <div className="text-2xl font-bold text-emerald-400">{completedDispatches.length}</div>
          </Card>

          <Card className="bg-slate-900 border-slate-800 p-4 space-y-1">
            <span className="text-xs text-slate-400">Note Vendeurs</span>
            <div className="text-2xl font-bold text-white">⭐ {company.rating_score || 5.0}</div>
          </Card>
        </div>

        {/* Dispatches List */}
        <div className="space-y-4">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Package className="w-5 h-5 text-emerald-400" /> Commandes Assignées à votre Structure
          </h2>

          {dispatches.length === 0 ? (
            <div className="py-16 text-center text-slate-500 text-sm bg-slate-900/50 rounded-2xl border border-slate-800">
              Aucune commande attribuée pour le moment. Dès qu'un marchand sélectionne votre structure, la commande apparaîtra ici.
            </div>
          ) : (
            <div className="space-y-4">
              {dispatches.map((dispatch) => (
                <Card key={dispatch.id} className="bg-slate-900 border-slate-800 p-4 space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-white text-base">{dispatch.recipient_name}</span>
                        <span className="text-emerald-400 font-mono text-xs">{dispatch.recipient_phone}</span>
                        <Badge className="bg-slate-800 text-slate-300 text-[10px]">{dispatch.status}</Badge>
                      </div>
                      <p className="text-xs text-slate-400 mt-0.5">
                        <MapPin className="w-3.5 h-3.5 inline mr-1 text-slate-500" />
                        {dispatch.city} — {dispatch.delivery_address}
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      {dispatch.status === 'assigned' && (
                        <Button
                          onClick={() => handleUpdateStatus(dispatch.id, 'picked_up')}
                          size="sm"
                          className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs"
                        >
                          Confirmer Prise en Charge
                        </Button>
                      )}

                      {dispatch.status === 'picked_up' && (
                        <Button
                          onClick={() => handleUpdateStatus(dispatch.id, 'in_transit')}
                          size="sm"
                          className="bg-blue-500 hover:bg-blue-600 text-white font-bold text-xs"
                        >
                          Démarrer la Livraison
                        </Button>
                      )}

                      {dispatch.status === 'in_transit' && (
                        <Button
                          onClick={() => handleUpdateStatus(dispatch.id, 'cod_collected')}
                          size="sm"
                          className="bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold text-xs"
                        >
                          Marquer Livré & Encaissement COD
                        </Button>
                      )}
                    </div>
                  </div>

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
                  <DeliveryCashTracker dispatch={dispatch} userRole="partner" onUpdate={loadDashboard} />
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
