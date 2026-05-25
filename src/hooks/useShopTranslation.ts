import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

interface ShopFields {
  business_name?: string | null;
  business_description?: string | null;
}
interface ProductFields {
  id: string;
  name?: string | null;
  short_description?: string | null;
  description?: string | null;
  category?: string | null;
}

export function useShopTranslations(
  shopId: string | undefined,
  lang: string,
  sourceLang: string = "fr",
) {
  const [shopTr, setShopTr] = useState<Record<string, string>>({});
  const [productTr, setProductTr] = useState<Record<string, Record<string, string>>>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!shopId || lang === sourceLang) {
      setShopTr({});
      setProductTr({});
      return;
    }
    let cancelled = false;
    (async () => {
      setLoading(true);
      const [{ data: shopRows }, { data: prodRows }] = await Promise.all([
        supabase.from("shop_translations").select("*").eq("shop_id", shopId).eq("language", lang).maybeSingle(),
        supabase.from("product_translations").select("*").eq("shop_id", shopId).eq("language", lang),
      ]);
      if (cancelled) return;
      setShopTr((shopRows as any) ?? {});
      const map: Record<string, Record<string, string>> = {};
      (prodRows ?? []).forEach((r: any) => {
        map[r.product_id] = r;
      });
      setProductTr(map);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [shopId, lang, sourceLang]);

  const translateShopOnDemand = async (shop: ShopFields) => {
    if (!shopId || lang === sourceLang) return;
    if (shopTr.business_name || shopTr.business_description) return;
    const texts = {
      business_name: shop.business_name ?? "",
      business_description: shop.business_description ?? "",
    };
    const { data } = await supabase.functions.invoke("translate-product", {
      body: { texts, target_lang: lang, source_lang: sourceLang, shop_id: shopId, persist: true },
    });
    if (data?.success && data.translations) {
      setShopTr((prev) => ({ ...prev, ...data.translations }));
    }
  };

  const translateProductOnDemand = async (p: ProductFields) => {
    if (!shopId || lang === sourceLang) return;
    if (productTr[p.id]) return;
    const texts: Record<string, string> = {};
    if (p.name) texts.name = p.name;
    if (p.short_description) texts.short_description = p.short_description;
    if (p.description) texts.description = p.description;
    if (p.category) texts.category = p.category;
    if (Object.keys(texts).length === 0) return;
    const { data } = await supabase.functions.invoke("translate-product", {
      body: { texts, target_lang: lang, source_lang: sourceLang, shop_id: shopId, product_id: p.id, persist: true },
    });
    if (data?.success && data.translations) {
      setProductTr((prev) => ({ ...prev, [p.id]: data.translations }));
    }
  };

  const mergeShop = <T extends ShopFields>(shop: T): T => ({
    ...shop,
    business_name: shopTr.business_name || shop.business_name,
    business_description: shopTr.business_description || shop.business_description,
  });

  const mergeProduct = <T extends ProductFields>(p: T): T => {
    const tr = productTr[p.id];
    if (!tr) return p;
    return {
      ...p,
      name: tr.name || p.name,
      short_description: tr.short_description || p.short_description,
      description: tr.description || p.description,
      category: tr.category || p.category,
    };
  };

  return {
    loading,
    mergeShop,
    mergeProduct,
    translateShopOnDemand,
    translateProductOnDemand,
    hasShopTr: !!(shopTr.business_name || shopTr.business_description),
    productTrMap: productTr,
  };
}