import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface StockMovement {
  id: string;
  shop_id: string;
  product_id: string;
  variant_id?: string | null;
  unit_code?: string | null;
  movement_type: 'restock' | 'reservation' | 'driver_handover' | 'delivered' | 'failed_delivery' | 'return_restock' | 'adjustment';
  quantity: number;
  previous_stock: number;
  new_stock: number;
  reference_order_id?: string | null;
  driver_id?: string | null;
  created_at: string;
  notes?: string | null;
  products?: {
    name: string;
    sku: string | null;
  } | null;
  profiles?: {
    full_name: string | null;
  } | null;
}

export interface InventoryUnit {
  id: string;
  shop_id: string;
  product_id: string;
  variant_id?: string | null;
  unit_qr_code: string;
  status: 'available' | 'reserved' | 'in_transit' | 'delivered' | 'returned' | 'damaged';
  current_order_id?: string | null;
  current_driver_id?: string | null;
  assigned_at?: string | null;
  delivered_at?: string | null;
  created_at: string;
  products?: {
    name: string;
    sku: string | null;
  } | null;
}

export function useStockManagement(shopId?: string) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // 1. Fetch Stock Movements History
  const { data: movements = [], isLoading: isLoadingMovements } = useQuery({
    queryKey: ['stock-movements', shopId],
    queryFn: async () => {
      if (!shopId) return [];
      const { data, error } = await supabase
        .from('stock_movements' as any)
        .select(`
          *,
          products:product_id(name, sku),
          profiles:driver_id(full_name)
        `)
        .eq('shop_id', shopId)
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) {
        console.error('Error fetching stock movements:', error);
        return [];
      }
      return data as StockMovement[];
    },
    enabled: !!shopId,
  });

  // 2. Fetch Inventory Units / QR Codes
  const { data: units = [], isLoading: isLoadingUnits } = useQuery({
    queryKey: ['inventory-units', shopId],
    queryFn: async () => {
      if (!shopId) return [];
      const { data, error } = await supabase
        .from('inventory_units' as any)
        .select(`
          *,
          products:product_id(name, sku)
        `)
        .eq('shop_id', shopId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching inventory units:', error);
        return [];
      }
      return data as InventoryUnit[];
    },
    enabled: !!shopId,
  });

  // 3. Record a new Stock Movement (Restock / Adjustment)
  const recordMovementMutation = useMutation({
    mutationFn: async ({
      productId,
      variantId,
      movementType,
      quantity,
      unitCode,
      notes,
    }: {
      productId: string;
      variantId?: string;
      movementType: StockMovement['movement_type'];
      quantity: number;
      unitCode?: string;
      notes?: string;
    }) => {
      if (!shopId) throw new Error("Boutique introuvable");

      const { data, error } = await supabase.rpc('record_stock_movement' as any, {
        p_shop_id: shopId,
        p_product_id: productId,
        p_variant_id: variantId || null,
        p_unit_code: unitCode || null,
        p_movement_type: movementType,
        p_quantity: quantity,
        p_notes: notes || null,
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast({
        title: "Mouvement de stock enregistré",
        description: "Le stock et l'historique ont été mis à jour avec succès.",
      });
      queryClient.invalidateQueries({ queryKey: ['stock-movements', shopId] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
    },
    onError: (err: any) => {
      toast({
        title: "Erreur d'enregistrement",
        description: err?.message || "Impossible d'enregistrer le mouvement de stock.",
        variant: "destructive",
      });
    },
  });

  // 4. Generate a new Unit QR Code
  const generateUnitQrMutation = useMutation({
    mutationFn: async ({ productId, count = 1 }: { productId: string; count?: number }) => {
      if (!shopId) throw new Error("Boutique introuvable");

      const newUnits = Array.from({ length: count }).map(() => ({
        shop_id: shopId,
        product_id: productId,
        unit_qr_code: `ECOMFY-UNIT-${Math.random().toString(36).substring(2, 8).toUpperCase()}`,
        status: 'available',
      }));

      const { data, error } = await supabase
        .from('inventory_units' as any)
        .insert(newUnits)
        .select();

      if (error) throw error;
      return data;
    },
    onSuccess: (data: any) => {
      toast({
        title: "QR Code(s) Généré(s) ✨",
        description: `${data.length} unité(s) physique(s) et QR Code(s) ont été créés avec succès.`,
      });
      queryClient.invalidateQueries({ queryKey: ['inventory-units', shopId] });
    },
    onError: (err: any) => {
      toast({
        title: "Erreur de génération",
        description: err?.message || "Impossible de générer les QR codes.",
        variant: "destructive",
      });
    },
  });

  // 5. Calculate Stock Metrics
  const metrics = {
    totalUnits: units.length,
    availableUnits: units.filter(u => u.status === 'available').length,
    inTransitUnits: units.filter(u => u.status === 'in_transit').length,
    deliveredUnits: units.filter(u => u.status === 'delivered').length,
    returnedUnits: units.filter(u => u.status === 'returned').length,
  };

  return {
    movements,
    isLoadingMovements,
    units,
    isLoadingUnits,
    metrics,
    recordMovement: recordMovementMutation.mutate,
    isRecordingMovement: recordMovementMutation.isPending,
    generateUnitQr: generateUnitQrMutation.mutate,
    isGeneratingQr: generateUnitQrMutation.isPending,
  };
}
