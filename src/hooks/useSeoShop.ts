// src/hooks/useSeoShop.ts
// Charge les boutiques de l'utilisateur connecté, la boutique sélectionnée et ses produits (avec images)
// pour le module SEO Intelligence. Remplace l'ancienne boutique de démonstration codée en dur.

import { useState, useEffect, useCallback, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import type { SeoShopData } from "@/hooks/useSeoIntelligence";

export interface SeoShopOption {
  id: string;
  name: string;
}

export function useSeoShop() {
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedShopId = searchParams.get("shop");

  const [shops, setShops] = useState<SeoShopOption[]>([]);
  const [shop, setShop] = useState<any>(null);
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const seq = useRef(0);

  const loadShopData = useCallback(async (shopId: string): Promise<SeoShopData> => {
    const [shopRes, productsRes] = await Promise.all([
      supabase.from("shops").select("*").eq("id", shopId).maybeSingle(),
      supabase
        .from("products")
        .select("*, product_images(id, image_url, alt_text, is_primary, display_order)")
        .eq("shop_id", shopId)
        .order("created_at", { ascending: false })
        .limit(500),
    ]);
    if (shopRes.error) throw new Error(shopRes.error.message);
    if (productsRes.error) throw new Error(productsRes.error.message);
    return { shop: shopRes.data, products: productsRes.data || [] };
  }, []);

  useEffect(() => {
    const current = ++seq.current;
    (async () => {
      try {
        setLoading(true);
        setError(null);

        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;

        const { data: rows, error: shopsError } = await supabase
          .from("shops")
          .select("id, business_name")
          .eq("user_id", session.user.id)
          .order("created_at", { ascending: true });
        if (current !== seq.current) return;
        if (shopsError) throw new Error(shopsError.message);

        const options = (rows || []).map((r) => ({ id: r.id, name: r.business_name || "Ma boutique" }));
        setShops(options);

        const targetId = options.find((o) => o.id === requestedShopId)?.id ?? options[0]?.id;
        if (!targetId) {
          setShop(null);
          setProducts([]);
          return;
        }

        const data = await loadShopData(targetId);
        if (current !== seq.current) return;
        setShop(data.shop);
        setProducts(data.products);
      } catch (e) {
        if (current !== seq.current) return;
        setError(e instanceof Error ? e.message : "Chargement de la boutique impossible.");
      } finally {
        if (current === seq.current) setLoading(false);
      }
    })();
  }, [requestedShopId, loadShopData]);

  /** Recharge la boutique et ses produits ; renvoie les données fraîches. */
  const reload = useCallback(async (): Promise<SeoShopData | void> => {
    if (!shop?.id) return;
    const data = await loadShopData(shop.id);
    setShop(data.shop);
    setProducts(data.products);
    return data;
  }, [shop?.id, loadShopData]);

  const selectShop = useCallback(
    (shopId: string) => setSearchParams({ shop: shopId }, { replace: true }),
    [setSearchParams]
  );

  return { shops, shop, products, loading, error, reload, selectShop };
}
