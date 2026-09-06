import React, { useEffect, useState } from "react";
import { 
  ShieldCheck, 
  CheckCircle2, 
  XCircle, 
  AlertCircle, 
  Clock, 
  Search, 
  Filter, 
  Eye, 
  UserCheck, 
  Building2, 
  Truck, 
  MapPin, 
  Phone, 
  FileText, 
  Store,
  ExternalLink,
  MessageSquare,
  BadgeCheck,
  RefreshCw
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/use-toast";
import { deliveryService } from "@/lib/deliveryService";
import { DeliveryCompany, DeliveryVerificationStatus } from "@/types/delivery";

export default function DeliveryAdminPage() {
  const { toast } = useToast();
  const [loading, setLoading] = useState<boolean>(true);
  const [applications, setApplications] = useState<DeliveryCompany[]>([]);
  const [activeTab, setActiveTab] = useState<DeliveryVerificationStatus | 'all'>("pending_verification");
  const [searchTerm, setSearchTerm] = useState<string>("");

  // Modal / Drawer State for detailed inspection
  const [selectedApp, setSelectedApp] = useState<DeliveryCompany | null>(null);
  const [isInspectOpen, setIsInspectOpen] = useState<boolean>(false);
  
  // Action State
  const [actionReason, setActionReason] = useState<string>("");
  const [adminNotes, setAdminNotes] = useState<string>("");
  const [actionSubmitting, setActionSubmitting] = useState<boolean>(false);

  const fetchApplications = async () => {
    setLoading(true);
    try {
      const data = await deliveryService.getAdminApplications(activeTab);
      setApplications(data);
    } catch (err) {
      console.error(err);
      toast({ variant: "destructive", title: "Erreur de chargement", description: "Impossible de récupérer les candidatures." });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchApplications();
  }, [activeTab]);

  const handleUpdateStatus = async (status: DeliveryVerificationStatus) => {
    if (!selectedApp) return;

    if (status === 'rejected' && !actionReason.trim()) {
      toast({ variant: "destructive", title: "Motif obligatoire", description: "Veuillez fournir un motif pour justifier le refus." });
      return;
    }

    if (status === 'action_required' && !adminNotes.trim()) {
      toast({ variant: "destructive", title: "Instructions requises", description: "Veuillez préciser le complément d'information demandé." });
      return;
    }

    setActionSubmitting(true);
    try {
      await deliveryService.updateVerificationStatus(
        selectedApp.id,
        status,
        actionReason,
        adminNotes
      );

      toast({
        title: status === 'approved' ? "Structure Validée !" : "Statut mis à jour",
        description: status === 'approved' 
          ? `La structure '${selectedApp.company_name}' dispose maintenant du Badge Partenaire Vérifié Ecomfy.` 
          : "Le dossier a été mis à jour.",
      });

      setIsInspectOpen(false);
      setSelectedApp(null);
      setActionReason("");
      setAdminNotes("");
      fetchApplications();
    } catch (err: any) {
      console.error(err);
      toast({ variant: "destructive", title: "Erreur", description: err.message });
    } finally {
      setActionSubmitting(false);
    }
  };

  const filteredApps = applications.filter((app) =>
    app.company_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    app.city.toLowerCase().includes(searchTerm.toLowerCase()) ||
    app.manager_name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 sm:p-6 lg:p-8 font-sans">
      <div className="max-w-7xl mx-auto space-y-6">

        {/* Top Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-5">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-semibold uppercase">
              <ShieldCheck className="w-4 h-4" /> Espace Fondation — Validation des Livraisons
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white mt-2">
              Back-Office Ecomfy Livraison
            </h1>
            <p className="text-xs text-slate-400">
              Audit rigoureux des structures candidates et vérification des pièces d'identité avant activation.
            </p>
          </div>

          <Button
            onClick={fetchApplications}
            variant="outline"
            size="sm"
            className="border-slate-800 text-slate-300 hover:bg-slate-900"
          >
            <RefreshCw className="w-4 h-4 mr-2" /> Actualiser la liste
          </Button>
        </div>

        {/* Search & Tabs */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <Tabs value={activeTab} onValueChange={(val) => setActiveTab(val as any)} className="w-full sm:w-auto">
            <TabsList className="bg-slate-900 border border-slate-800 p-1">
              <TabsTrigger value="pending_verification" className="data-[state=active]:bg-emerald-500 data-[state=active]:text-slate-950 text-xs font-semibold">
                En attente
              </TabsTrigger>
              <TabsTrigger value="under_review" className="data-[state=active]:bg-amber-500 data-[state=active]:text-slate-950 text-xs font-semibold">
                En examen
              </TabsTrigger>
              <TabsTrigger value="action_required" className="data-[state=active]:bg-purple-500 data-[state=active]:text-slate-950 text-xs font-semibold">
                Complément requis
              </TabsTrigger>
              <TabsTrigger value="approved" className="data-[state=active]:bg-emerald-500 data-[state=active]:text-slate-950 text-xs font-semibold">
                Validées (Vérifiées)
              </TabsTrigger>
              <TabsTrigger value="rejected" className="data-[state=active]:bg-red-500 data-[state=active]:text-white text-xs font-semibold">
                Refusées
              </TabsTrigger>
              <TabsTrigger value="all" className="text-xs">
                Toutes
              </TabsTrigger>
            </TabsList>
          </Tabs>

          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 absolute left-3 top-3 text-slate-500" />
            <Input
              placeholder="Rechercher par nom, ville, gérant..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 bg-slate-900 border-slate-800 text-xs text-white"
            />
          </div>
        </div>

        {/* Applications Grid */}
        {loading ? (
          <div className="py-20 text-center text-slate-500 text-sm">
            Chargement des candidatures de livraison...
          </div>
        ) : filteredApps.length === 0 ? (
          <div className="py-20 text-center text-slate-500 text-sm bg-slate-900/50 rounded-2xl border border-slate-800">
            Aucune candidature trouvée pour ce statut.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredApps.map((app) => {
              const isApproved = app.verification_status === "approved";
              const isPending = app.verification_status === "pending_verification";
              const isRejected = app.verification_status === "rejected";
              const isActionReq = app.verification_status === "action_required";

              return (
                <Card key={app.id} className="bg-slate-900 border-slate-800 hover:border-slate-700 transition-all flex flex-col justify-between">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="text-lg font-bold text-white flex items-center gap-2">
                          {app.company_name}
                          {app.trust_badge_active && (
                            <span title="Partenaire vérifié Ecomfy">
                              <BadgeCheck className="w-5 h-5 text-emerald-400 shrink-0" />
                            </span>
                          )}
                        </CardTitle>
                        <CardDescription className="text-xs text-slate-400 flex items-center gap-1 mt-1">
                          <MapPin className="w-3.5 h-3.5 text-slate-500" /> {app.city}, {app.country}
                        </CardDescription>
                      </div>

                      <Badge
                        className={`text-[10px] ${
                          isApproved
                            ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
                            : isPending
                            ? "bg-amber-500/20 text-amber-300 border-amber-500/40"
                            : isRejected
                            ? "bg-red-500/20 text-red-300 border-red-500/40"
                            : "bg-purple-500/20 text-purple-300 border-purple-500/40"
                        }`}
                      >
                        {app.verification_status}
                      </Badge>
                    </div>
                  </CardHeader>

                  <CardContent className="space-y-3 text-xs">
                    <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 space-y-1">
                      <div className="flex justify-between text-slate-400">
                        <span>Gérant :</span>
                        <span className="text-white font-medium">{app.manager_name}</span>
                      </div>
                      <div className="flex justify-between text-slate-400">
                        <span>WhatsApp :</span>
                        <span className="text-emerald-400 font-mono">{app.manager_whatsapp}</span>
                      </div>
                      <div className="flex justify-between text-slate-400">
                        <span>Livreurs rattachés :</span>
                        <span className="text-white font-bold">{app.drivers?.length || app.total_drivers_count}</span>
                      </div>
                    </div>

                    <div className="text-[11px] text-slate-400">
                      <span className="font-semibold text-slate-300">Villes de livraison :</span>{" "}
                      {app.covered_cities?.slice(0, 3).join(", ")}
                      {app.covered_cities?.length > 3 && ` +${app.covered_cities.length - 3}`}
                    </div>
                  </CardContent>

                  <CardFooter className="pt-3 border-t border-slate-800">
                    <Button
                      onClick={() => {
                        setSelectedApp(app);
                        setActionReason(app.rejection_reason || "");
                        setAdminNotes(app.admin_notes || "");
                        setIsInspectOpen(true);
                      }}
                      variant="outline"
                      size="sm"
                      className="w-full border-slate-700 text-emerald-400 hover:bg-slate-800"
                    >
                      <Eye className="w-4 h-4 mr-2" /> Inspecter le Dossier & Pièces
                    </Button>
                  </CardFooter>
                </Card>
              );
            })}
          </div>
        )}

        {/* Inspection & Audit Modal */}
        <Dialog open={isInspectOpen} onOpenChange={setIsInspectOpen}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto bg-slate-900 border-slate-800 text-slate-100">
            {selectedApp && (
              <>
                <DialogHeader className="border-b border-slate-800 pb-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <DialogTitle className="text-xl font-bold text-white flex items-center gap-2">
                        Audit Dossier : {selectedApp.company_name}
                      </DialogTitle>
                      <DialogDescription className="text-xs text-slate-400">
                        Revue complète des pièces justificatives, gérant, entrepôt et livreurs.
                      </DialogDescription>
                    </div>
                    <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/40">
                      {selectedApp.verification_status}
                    </Badge>
                  </div>
                </DialogHeader>

                <div className="space-y-6 pt-4">
                  {/* Section 1: Manager & Company Photos */}
                  <div>
                    <h3 className="text-sm font-semibold text-emerald-400 mb-3 flex items-center gap-2">
                      <UserCheck className="w-4 h-4" /> Photos du Responsable & Entrepôt
                    </h3>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <div className="p-2 rounded-lg bg-slate-950 border border-slate-800 space-y-1 text-center">
                        <span className="text-[10px] text-slate-400 block">Photo Gérant</span>
                        {selectedApp.manager_photo_url ? (
                          <img src={selectedApp.manager_photo_url} alt="Gérant" className="w-full h-28 object-cover rounded-md" />
                        ) : (
                          <div className="h-28 bg-slate-900 rounded flex items-center justify-center text-xs text-slate-600">Absente</div>
                        )}
                      </div>

                      <div className="p-2 rounded-lg bg-slate-950 border border-slate-800 space-y-1 text-center">
                        <span className="text-[10px] text-slate-400 block">CNI / Passeport Gérant</span>
                        {selectedApp.manager_id_photo_url ? (
                          <img src={selectedApp.manager_id_photo_url} alt="CNI Gérant" className="w-full h-28 object-cover rounded-md" />
                        ) : (
                          <div className="h-28 bg-slate-900 rounded flex items-center justify-center text-xs text-slate-600">Absente</div>
                        )}
                      </div>

                      <div className="p-2 rounded-lg bg-slate-950 border border-slate-800 space-y-1 text-center">
                        <span className="text-[10px] text-slate-400 block">Photo Propriétaire</span>
                        {selectedApp.owner_photo_url ? (
                          <img src={selectedApp.owner_photo_url} alt="Propriétaire" className="w-full h-28 object-cover rounded-md" />
                        ) : (
                          <div className="h-28 bg-slate-900 rounded flex items-center justify-center text-xs text-slate-600">Absente</div>
                        )}
                      </div>

                      <div className="p-2 rounded-lg bg-slate-950 border border-slate-800 space-y-1 text-center">
                        <span className="text-[10px] text-slate-400 block">Photo Entrepôt</span>
                        {selectedApp.warehouse_photo_url ? (
                          <img src={selectedApp.warehouse_photo_url} alt="Entrepôt" className="w-full h-28 object-cover rounded-md" />
                        ) : (
                          <div className="h-28 bg-slate-900 rounded flex items-center justify-center text-xs text-slate-600">Absente</div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Section 2: Drivers Verification */}
                  <div>
                    <h3 className="text-sm font-semibold text-emerald-400 mb-3 flex items-center gap-2">
                      <Truck className="w-4 h-4" /> Livreurs Rattachés ({selectedApp.drivers?.length || 0})
                    </h3>

                    {selectedApp.drivers && selectedApp.drivers.length > 0 ? (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-60 overflow-y-auto pr-1">
                        {selectedApp.drivers.map((drv, idx) => (
                          <div key={idx} className="p-3 rounded-lg bg-slate-950 border border-slate-800 flex items-center gap-3">
                            <img src={drv.photo_url} alt={drv.full_name} className="w-12 h-12 object-cover rounded-full border border-slate-700" />
                            <div className="space-y-0.5 text-xs">
                              <span className="font-bold text-white block">{drv.full_name}</span>
                              <span className="text-[11px] text-slate-400 block">{drv.phone} ({drv.vehicle_type})</span>
                              <div className="flex gap-2 text-[10px] text-emerald-400">
                                {drv.national_id_photo_url && <span>✓ CNI fournie</span>}
                                {drv.license_photo_url && <span>✓ Permis fourni</span>}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="p-3 rounded-lg bg-slate-950 text-xs text-slate-500">
                        Aucun livreur individuel détaillé dans la base.
                      </div>
                    )}
                  </div>

                  {/* Section 3: Foundation Action Panel */}
                  <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-4 pt-4">
                    <h3 className="text-sm font-bold text-white flex items-center gap-2">
                      <ShieldCheck className="w-4 h-4 text-emerald-400" /> Décision de la Fondation Ecomfy
                    </h3>

                    <div className="space-y-2">
                      <Label className="text-xs text-slate-300">Notes internes d'audit ou instructions complémentaires :</Label>
                      <Textarea
                        placeholder="Ex: Pièce d'identité lisible, entrepôt valide à Koumassi. Approuvé."
                        value={adminNotes}
                        onChange={(e) => setAdminNotes(e.target.value)}
                        className="bg-slate-900 border-slate-800 text-xs text-white"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label className="text-xs text-slate-300">Motif en cas de Refus (Envoyé au partenaire) :</Label>
                      <Input
                        placeholder="Ex: Photo d'entrepôt floue ou absence de CNI du gérant."
                        value={actionReason}
                        onChange={(e) => setActionReason(e.target.value)}
                        className="bg-slate-900 border-slate-800 text-xs text-white"
                      />
                    </div>
                  </div>
                </div>

                <DialogFooter className="flex flex-col sm:flex-row gap-2 border-t border-slate-800 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => handleUpdateStatus('action_required')}
                    disabled={actionSubmitting}
                    className="border-purple-500/40 text-purple-300 hover:bg-purple-950"
                  >
                    Demander Complément
                  </Button>

                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => handleUpdateStatus('rejected')}
                    disabled={actionSubmitting}
                    className="border-red-500/40 text-red-400 hover:bg-red-950"
                  >
                    <XCircle className="w-4 h-4 mr-1" /> Refuser
                  </Button>

                  <Button
                    type="button"
                    onClick={() => handleUpdateStatus('approved')}
                    disabled={actionSubmitting}
                    className="bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold"
                  >
                    <CheckCircle2 className="w-4 h-4 mr-1" /> Valider & Attribuer Badge Vérifié
                  </Button>
                </DialogFooter>
              </>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
