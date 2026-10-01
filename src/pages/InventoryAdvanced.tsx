import React, { useState } from "react";
import { useAuthReady } from "@/hooks/useAuthReady";
import { useStockManagement } from "@/hooks/useStockManagement";
import { AppSidebar } from "@/components/AppSidebar";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { QrCode, Package, Truck, CheckCircle2, RotateCcw, Plus, Search, RefreshCw, BarChart3, Boxes } from "lucide-react";
import { QRScannerModal } from "@/components/stock/QRScannerModal";
import { StockMovementsTable } from "@/components/stock/StockMovementsTable";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export default function InventoryAdvanced() {
  const { session, isReady } = useAuthReady();

  // Fetch current user's shop
  const { data: currentShop } = useQuery({
    queryKey: ['user-active-shop', session?.user?.id],
    queryFn: async () => {
      if (!session?.user?.id) return null;
      const { data } = await supabase
        .from('shops')
        .select('id, name')
        .eq('user_id', session.user.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      return data;
    },
    enabled: !!session?.user?.id,
  });

  const shopId = currentShop?.id;

  const {
    movements,
    isLoadingMovements,
    units,
    isLoadingUnits,
    metrics,
    recordMovement,
    isRecordingMovement,
    generateUnitQr,
    isGeneratingQr,
  } = useStockManagement(shopId);

  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [isNewMovementOpen, setIsNewMovementOpen] = useState(false);
  const [isGenerateQrOpen, setIsGenerateQrOpen] = useState(false);

  // Form states
  const [selectedProductId, setSelectedProductId] = useState("");
  const [movementType, setMovementType] = useState<any>("restock");
  const [quantity, setQuantity] = useState(1);
  const [notes, setNotes] = useState("");
  const [qrCount, setQrCount] = useState(5);

  // Fetch shop products for dropdown
  const { data: products = [] } = useQuery({
    queryKey: ['shop-products-dropdown', shopId],
    queryFn: async () => {
      if (!shopId) return [];
      const { data } = await supabase
        .from('products')
        .select('id, name, sku, stock')
        .eq('shop_id', shopId);
      return data || [];
    },
    enabled: !!shopId,
  });

  const handleCreateMovement = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProductId) return;

    recordMovement(
      {
        productId: selectedProductId,
        movementType,
        quantity: movementType === 'restock' || movementType === 'return_restock' ? Math.abs(quantity) : -Math.abs(quantity),
        notes,
      },
      {
        onSuccess: () => {
          setIsNewMovementOpen(false);
          setSelectedProductId("");
          setNotes("");
          setQuantity(1);
        },
      }
    );
  };

  const handleGenerateQr = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProductId) return;

    generateUnitQr(
      { productId: selectedProductId, count: qrCount },
      {
        onSuccess: () => {
          setIsGenerateQrOpen(false);
          setSelectedProductId("");
        },
      }
    );
  };

  return (
    <SidebarProvider defaultOpen={true}>
      <div className="flex min-h-screen w-full bg-slate-50/50">
        <AppSidebar />
        <main className="flex-1 overflow-y-auto">
          {/* Header */}
          <div className="sticky top-0 z-10 flex h-16 items-center justify-between border-b border-slate-200 bg-white/95 px-6 backdrop-blur">
            <div className="flex items-center gap-4">
              <SidebarTrigger />
              <div>
                <h1 className="text-lg font-bold font-space text-slate-900 flex items-center gap-2">
                  <Boxes className="w-5 h-5 text-[#0E7C66]" />
                  Gestion & Traçabilité du Stock
                </h1>
                <p className="text-xs text-slate-500 font-inter">
                  Boutique : <span className="font-semibold text-slate-800">{currentShop?.name || "Chargement..."}</span>
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button
                onClick={() => setIsScannerOpen(true)}
                className="bg-[#0E7C66] hover:bg-[#095D4D] text-white gap-2 shadow-sm font-medium text-xs h-9"
              >
                <QrCode className="w-4 h-4" />
                Scanner QR Code
              </Button>
            </div>
          </div>

          <div className="p-6 space-y-6 max-w-7xl mx-auto">
            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card className="border-slate-200 shadow-sm bg-white">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-xs font-semibold text-slate-600">Unités Tracées Total</CardTitle>
                  <Package className="w-4 h-4 text-[#0E7C66]" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold font-space text-slate-900">{metrics.totalUnits}</div>
                  <p className="text-[11px] text-slate-500 mt-1">Colis ou unités avec QR Code</p>
                </CardContent>
              </Card>

              <Card className="border-slate-200 shadow-sm bg-white">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-xs font-semibold text-slate-600">En Transit (Livreurs)</CardTitle>
                  <Truck className="w-4 h-4 text-blue-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold font-space text-blue-700">{metrics.inTransitUnits}</div>
                  <p className="text-[11px] text-blue-600 mt-1">Colis actuellement chez les livreurs</p>
                </CardContent>
              </Card>

              <Card className="border-slate-200 shadow-sm bg-white">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-xs font-semibold text-slate-600">Livrées avec Succès</CardTitle>
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold font-space text-emerald-700">{metrics.deliveredUnits}</div>
                  <p className="text-[11px] text-emerald-600 mt-1">Confirmées reçues par le client</p>
                </CardContent>
              </Card>

              <Card className="border-slate-200 shadow-sm bg-white">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-xs font-semibold text-slate-600">Retours Entrepôt</CardTitle>
                  <RotateCcw className="w-4 h-4 text-amber-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold font-space text-amber-700">{metrics.returnedUnits}</div>
                  <p className="text-[11px] text-amber-600 mt-1">Colis réintégrés en stock</p>
                </CardContent>
              </Card>
            </div>

            {/* Main Tabs */}
            <Tabs defaultValue="movements" className="space-y-4">
              <div className="flex items-center justify-between">
                <TabsList className="bg-slate-100 p-1 border border-slate-200 rounded-xl">
                  <TabsTrigger value="movements" className="text-xs font-medium px-4">
                    Journal des Mouvements
                  </TabsTrigger>
                  <TabsTrigger value="units" className="text-xs font-medium px-4">
                    Unités Physiques & QR Codes ({units.length})
                  </TabsTrigger>
                </TabsList>

                <div className="flex gap-2">
                  <Dialog open={isNewMovementOpen} onOpenChange={setIsNewMovementOpen}>
                    <DialogTrigger asChild>
                      <Button variant="outline" size="sm" className="text-xs gap-1.5 border-slate-300">
                        <Plus className="w-3.5 h-3.5" /> Mouvement Manuel
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="bg-white rounded-2xl">
                      <DialogHeader>
                        <DialogTitle className="text-lg font-bold font-space">Nouveau Mouvement de Stock</DialogTitle>
                      </DialogHeader>
                      <form onSubmit={handleCreateMovement} className="space-y-4 py-2">
                        <div>
                          <Label className="text-xs font-semibold">Produit</Label>
                          <Select value={selectedProductId} onValueChange={setSelectedProductId}>
                            <SelectTrigger className="mt-1">
                              <SelectValue placeholder="Sélectionner un produit" />
                            </SelectTrigger>
                            <SelectContent>
                              {products.map((p: any) => (
                                <SelectItem key={p.id} value={p.id}>
                                  {p.name} (Stock actuel: {p.stock})
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        <div>
                          <Label className="text-xs font-semibold">Type de Mouvement</Label>
                          <Select value={movementType} onValueChange={setMovementType}>
                            <SelectTrigger className="mt-1">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="restock">Entrée Stock (Réapprovisionnement)</SelectItem>
                              <SelectItem value="adjustment">Ajustement (Inventaire/Casse)</SelectItem>
                              <SelectItem value="return_restock">Retour Entrepôt</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        <div>
                          <Label className="text-xs font-semibold">Quantité</Label>
                          <Input
                            type="number"
                            min="1"
                            value={quantity}
                            onChange={(e) => setQuantity(parseInt(e.target.value) || 1)}
                            className="mt-1"
                          />
                        </div>

                        <div>
                          <Label className="text-xs font-semibold">Notes / Motif</Label>
                          <Input
                            placeholder="Ex: Livraison fournisseur #904"
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            className="mt-1"
                          />
                        </div>

                        <Button
                          type="submit"
                          disabled={isRecordingMovement || !selectedProductId}
                          className="w-full bg-[#0E7C66] hover:bg-[#095D4D] text-white"
                        >
                          {isRecordingMovement ? "Enregistrement..." : "Valider le Mouvement"}
                        </Button>
                      </form>
                    </DialogContent>
                  </Dialog>

                  <Dialog open={isGenerateQrOpen} onOpenChange={setIsGenerateQrOpen}>
                    <DialogTrigger asChild>
                      <Button variant="outline" size="sm" className="text-xs gap-1.5 border-[#0E7C66]/30 text-[#0E7C66] hover:bg-[#0E7C66]/5">
                        <QrCode className="w-3.5 h-3.5" /> Générer QR Codes
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="bg-white rounded-2xl">
                      <DialogHeader>
                        <DialogTitle className="text-lg font-bold font-space">Générer des QR Codes Unités</DialogTitle>
                      </DialogHeader>
                      <form onSubmit={handleGenerateQr} className="space-y-4 py-2">
                        <div>
                          <Label className="text-xs font-semibold">Produit</Label>
                          <Select value={selectedProductId} onValueChange={setSelectedProductId}>
                            <SelectTrigger className="mt-1">
                              <SelectValue placeholder="Sélectionner un produit" />
                            </SelectTrigger>
                            <SelectContent>
                              {products.map((p: any) => (
                                <SelectItem key={p.id} value={p.id}>
                                  {p.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        <div>
                          <Label className="text-xs font-semibold">Nombre d'unités / QR à générer</Label>
                          <Input
                            type="number"
                            min="1"
                            max="50"
                            value={qrCount}
                            onChange={(e) => setQrCount(parseInt(e.target.value) || 1)}
                            className="mt-1"
                          />
                        </div>

                        <Button
                          type="submit"
                          disabled={isGeneratingQr || !selectedProductId}
                          className="w-full bg-[#0E7C66] hover:bg-[#095D4D] text-white"
                        >
                          {isGeneratingQr ? "Génération..." : "Générer les QR Codes"}
                        </Button>
                      </form>
                    </DialogContent>
                  </Dialog>
                </div>
              </div>

              {/* Tab 1: Movements Journal */}
              <TabsContent value="movements" className="mt-0">
                <StockMovementsTable movements={movements} isLoading={isLoadingMovements} />
              </TabsContent>

              {/* Tab 2: Inventory Physical Units */}
              <TabsContent value="units" className="mt-0 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {units.map((unit) => (
                    <div key={unit.id} className="p-4 rounded-xl border border-slate-200 bg-white shadow-sm flex flex-col justify-between space-y-3">
                      <div className="flex justify-between items-start">
                        <div>
                          <h4 className="font-bold text-slate-900 text-sm">{unit.products?.name || "Produit"}</h4>
                          <p className="text-xs text-slate-400 font-mono mt-0.5">{unit.unit_qr_code}</p>
                        </div>
                        <Badge variant="outline" className="uppercase text-[10px]">
                          {unit.status}
                        </Badge>
                      </div>

                      <div className="flex items-center justify-between text-[11px] text-slate-500 border-t border-slate-100 pt-2">
                        <span>Créé le: {new Date(unit.created_at).toLocaleDateString("fr-FR")}</span>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            navigator.clipboard.writeText(unit.unit_qr_code);
                          }}
                          className="h-6 text-[10px] px-2 text-[#0E7C66]"
                        >
                          Copier Code
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </TabsContent>
            </Tabs>
          </div>
        </main>

        {/* Scanner Modal */}
        <QRScannerModal
          isOpen={isScannerOpen}
          onClose={() => setIsScannerOpen(false)}
          shopId={shopId}
        />
      </div>
    </SidebarProvider>
  );
}
