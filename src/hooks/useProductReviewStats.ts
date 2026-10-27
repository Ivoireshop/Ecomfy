import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface ProductReviewStats {
  count: number;
  average: number;
}

/** Nombre et note moyenne des avis approuvés d'un produit (aucune valeur inventée : 0 tant qu'il n'y en a pas). */
export function useProductReviewStats(shopId?: string | null, productId?: string | null): ProductReviewStats {
  const [stats, setStats] = useState<ProductReviewStats>({ count: 0, average: 0 });

  useEffect(() => {
    if (!shopId || !productId) return;
    let cancelled = false;
    (async () => {
      const { data, error } = await (supabase as any).rpc("get_product_review_stats", { p_shop_id: shopId, p_product_id: productId });
      if (cancelled || error) return;
      const row = Array.isArray(data) ? data[0] : data;
      setStats({ count: Number(row?.review_count) || 0, average: Number(row?.average_rating) || 0 });
    })();
    return () => { cancelled = true; };
  }, [shopId, productId]);

  return stats;
}
