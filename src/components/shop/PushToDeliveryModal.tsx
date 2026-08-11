import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Truck } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface PushToDeliveryModalProps {
  isOpen: boolean;
  onClose: () => void;
  orderId: string;
  shopId: string;
  onSuccess: () => void;
}

export function PushToDeliveryModal({ isOpen, onClose, orderId, shopId, onSuccess }: PushToDeliveryModalProps) {
  const [loading, setLoading] = useState(false);
  const [providers, setProviders] = useState<any[]>([]);
  const [selectedProviderId, setSelectedProviderId] = useState<string>("");

  useEffect(() => {
    if (isOpen && shopId) {
      loadProviders();
    }
  }, [isOpen, shopId]);

  const loadProviders = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("shop_delivery_connections")
        .select(`
          delivery_provider_id,
          delivery_providers (
            id,
            company_name
          )
        `)
        .eq("shop_id", shopId)
        .eq("status", "active");

      if (error) throw error;
      
      const formatted = data?.map((d: any) => d.delivery_providers).filter(Boolean) || [];
      setProviders(formatted);
      if (formatted.length > 0) {
        setSelectedProviderId(formatted[0].id);
      }
    } catch (err: any) {
      toast.error("Erreur de chargement des partenaires");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handlePush = async () => {
    if (!selectedProviderId) {
      toast.error("Veuillez sélectionner un partenaire");
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc("push_order_to_delivery_provider", {
        p_order_id: orderId,
        p_provider_id: selectedProviderId,
      });

      if (error) throw error;
      
      if (data && (data as any).success === false) {
         toast.error((data as any).error || "Erreur lors de l'assignation");
      } else {
        toast.success("Commande poussée avec succès");
        onSuccess();
        onClose();
      }
    } catch (err: any) {
      toast.error(err.message || "Impossible de pousser la commande");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Truck className="h-5 w-5 text-blue-500" />
            Pousser vers une livraison
          </DialogTitle>
          <DialogDescription>
            Choisissez une structure de livraison partenaire pour expédier cette commande.
          </DialogDescription>
        </DialogHeader>
        
        <div className="py-4">
          {loading && providers.length === 0 ? (
            <div className="flex justify-center p-4">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : providers.length === 0 ? (
            <div className="text-center p-4 text-sm text-muted-foreground bg-muted/50 rounded-lg">
              Aucune structure de livraison partenaire trouvée. 
              Vous devez d'abord vous connecter à un partenaire dans les paramètres de livraison.
            </div>
          ) : (
            <div className="space-y-3">
              <label className="text-sm font-medium">Structure de livraison</label>
              <Select value={selectedProviderId} onValueChange={setSelectedProviderId}>
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionnez une structure" />
                </SelectTrigger>
                <SelectContent>
                  {providers.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.company_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={loading}>
            Annuler
          </Button>
          <Button onClick={handlePush} disabled={loading || !selectedProviderId || providers.length === 0}>
            {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Confirmer et Pousser
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
