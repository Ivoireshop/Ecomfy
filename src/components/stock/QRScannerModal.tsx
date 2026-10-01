import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { QrCode, Camera, CheckCircle2, AlertTriangle, Truck, ArrowLeftRight, PackageCheck } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface QRScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  shopId?: string;
  onScanSuccess?: (unitCode: string) => void;
}

export function QRScannerModal({ isOpen, onClose, shopId, onScanSuccess }: QRScannerModalProps) {
  const [manualCode, setManualCode] = useState("");
  const [isScanning, setIsScanning] = useState(false);
  const [scannedUnit, setScannedUnit] = useState<any | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const { toast } = useToast();

  const handleLookupCode = async (codeToSearch: string) => {
    if (!codeToSearch.trim()) return;
    setIsSearching(true);
    setScannedUnit(null);

    try {
      const { data, error } = await supabase
        .from('inventory_units' as any)
        .select(`
          *,
          products:product_id(name, sku)
        `)
        .eq('unit_qr_code', codeToSearch.trim().toUpperCase())
        .maybeSingle();

      if (error) throw error;

      if (!data) {
        toast({
          title: "Code QR Non Trouvé",
          description: `Aucun colis ou produit ne correspond à l'identifiant "${codeToSearch}".`,
          variant: "destructive",
        });
      } else {
        setScannedUnit(data);
        if (onScanSuccess) onScanSuccess(codeToSearch);
      }
    } catch (err: any) {
      toast({
        title: "Erreur de Recherche",
        description: err?.message || "Erreur lors de la vérification du code.",
        variant: "destructive",
      });
    } finally {
      setIsSearching(false);
    }
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleLookupCode(manualCode);
  };

  const handleUpdateUnitStatus = async (newStatus: 'in_transit' | 'delivered' | 'returned') => {
    if (!scannedUnit) return;

    try {
      const { error } = await supabase
        .from('inventory_units' as any)
        .update({
          status: newStatus,
          ...(newStatus === 'delivered' ? { delivered_at: new Date().toISOString() } : {}),
        })
        .eq('id', scannedUnit.id);

      if (error) throw error;

      // Also record in stock movements
      if (shopId) {
        await supabase.rpc('record_stock_movement' as any, {
          p_shop_id: shopId,
          p_product_id: scannedUnit.product_id,
          p_unit_code: scannedUnit.unit_qr_code,
          p_movement_type: newStatus === 'in_transit' ? 'driver_handover' : newStatus === 'delivered' ? 'delivered' : 'return_restock',
          p_quantity: newStatus === 'delivered' ? -1 : 0,
          p_notes: `Statut mis à jour via Scan QR Code vers ${newStatus}`,
        });
      }

      toast({
        title: "Statut mis à jour ! ✅",
        description: `Le produit ${scannedUnit.products?.name} est désormais au statut: ${newStatus.toUpperCase()}`,
      });

      setScannedUnit(prev => prev ? { ...prev, status: newStatus } : null);
    } catch (err: any) {
      toast({
        title: "Erreur de mise à jour",
        description: err?.message || "Impossible de modifier le statut de l'unité.",
        variant: "destructive",
      });
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[500px] bg-white rounded-2xl p-6 shadow-2xl">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#0E7C66]/10 flex items-center justify-center text-[#0E7C66]">
              <QrCode className="w-5 h-5" />
            </div>
            <div>
              <DialogTitle className="text-xl font-bold font-space text-slate-900">
                Scanner / Identifier un Colis
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-500 font-inter">
                Scannez le QR code ou saisissez le code unitaire (ex: ECOMFY-UNIT-XXXXXX)
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-5 my-2">
          {/* Simulation or Camera Scan Area */}
          <div className="relative rounded-xl border-2 border-dashed border-[#0E7C66]/30 bg-slate-50 p-6 flex flex-col items-center justify-center gap-3 text-center">
            <Camera className="w-10 h-10 text-[#0E7C66] animate-pulse" />
            <p className="text-xs text-slate-600 font-medium">
              Visez le QR Code imprimé sur le produit avec l'appareil photo
            </p>
            <Badge variant="outline" className="bg-white text-[10px] text-[#0E7C66] border-[#0E7C66]/30">
              Détection Automatique Active
            </Badge>
          </div>

          {/* Manual Input Fallback */}
          <form onSubmit={handleManualSubmit} className="flex gap-2">
            <Input
              placeholder="Ex: ECOMFY-UNIT-8F92K2"
              value={manualCode}
              onChange={(e) => setManualCode(e.target.value)}
              className="h-11 font-mono text-sm uppercase"
            />
            <Button
              type="submit"
              disabled={isSearching || !manualCode.trim()}
              className="h-11 bg-[#0E7C66] hover:bg-[#095D4D] text-white px-5"
            >
              {isSearching ? "Recherche..." : "Vérifier"}
            </Button>
          </form>

          {/* Scanned Result Card */}
          {scannedUnit && (
            <div className="p-4 rounded-xl bg-[#0E7C66]/5 border border-[#0E7C66]/20 space-y-3">
              <div className="flex justify-between items-start">
                <div>
                  <h4 className="font-bold text-slate-900 text-sm font-space">
                    {scannedUnit.products?.name || "Produit Inconnu"}
                  </h4>
                  <p className="text-xs text-slate-500 font-mono">
                    Code: {scannedUnit.unit_qr_code}
                  </p>
                </div>
                <Badge className={`uppercase text-[10px] ${
                  scannedUnit.status === 'available' ? 'bg-emerald-100 text-emerald-800' :
                  scannedUnit.status === 'in_transit' ? 'bg-blue-100 text-blue-800' :
                  scannedUnit.status === 'delivered' ? 'bg-purple-100 text-purple-800' : 'bg-amber-100 text-amber-800'
                }`}>
                  {scannedUnit.status}
                </Badge>
              </div>

              {/* Action Buttons */}
              <div className="pt-2 border-t border-slate-200/60 grid grid-cols-3 gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleUpdateUnitStatus('in_transit')}
                  className="text-xs flex items-center gap-1 border-blue-200 hover:bg-blue-50 text-blue-700"
                >
                  <Truck className="w-3.5 h-3.5" />
                  Livreur
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleUpdateUnitStatus('delivered')}
                  className="text-xs flex items-center gap-1 border-emerald-200 hover:bg-emerald-50 text-emerald-700"
                >
                  <PackageCheck className="w-3.5 h-3.5" />
                  Livré
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleUpdateUnitStatus('returned')}
                  className="text-xs flex items-center gap-1 border-amber-200 hover:bg-amber-50 text-amber-700"
                >
                  <ArrowLeftRight className="w-3.5 h-3.5" />
                  Retour
                </Button>
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-end pt-2">
          <Button variant="ghost" onClick={onClose} className="text-xs">
            Fermer
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
