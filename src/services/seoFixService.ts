// src/services/seoFixService.ts
// Applique réellement les corrections automatiques proposées par l'audit SEO Ecomfy.

import { supabase } from "@/integrations/supabase/client";
import { SeoIssue } from "@/types/seoIntelligence";
import { SEO_LIMITS, productImages } from "@/lib/seoShop";
import { SeoAuditService } from "@/services/seoAuditService";

export class SeoFixService {
  /** Enregistre le titre et la description SEO de la boutique. */
  public static async saveShopMeta(
    shopId: string,
    meta: { seo_title?: string; seo_description?: string }
  ): Promise<void> {
    const payload: { seo_title?: string | null; seo_description?: string | null } = {};
    if (meta.seo_title !== undefined) payload.seo_title = meta.seo_title.trim() || null;
    if (meta.seo_description !== undefined) payload.seo_description = meta.seo_description.trim() || null;

    const { data, error } = await supabase.from("shops").update(payload).eq("id", shopId).select("id");
    if (error) throw new Error(error.message);
    if (!data || data.length === 0) throw new Error("Boutique introuvable ou modification non autorisée.");
  }

  /** Applique la correction associée à une anomalie. */
  public static async applyFix(issue: SeoIssue, shop: any, products: any[]): Promise<void> {
    switch (issue.fixActionKey) {
      case "generate_meta_title":
      case "optimize_meta_title_length":
        return this.saveShopMeta(shop.id, { seo_title: SeoAuditService.suggestTitle(shop) });

      case "generate_meta_desc":
      case "optimize_meta_desc_length":
        return this.saveShopMeta(shop.id, { seo_description: SeoAuditService.suggestDescription(shop) });

      case "generate_all_alt_texts":
        return this.fillMissingAltTexts(products);

      default:
        throw new Error("Cette correction n'est pas disponible automatiquement.");
    }
  }

  /** Renseigne le texte alternatif des images produit qui n'en ont pas, à partir du nom du produit. */
  private static async fillMissingAltTexts(products: any[]): Promise<void> {
    const updates: { id: string; alt: string }[] = [];

    products
      .filter((p) => p?.is_published !== false)
      .forEach((p) => {
        const name = String(p.name || "").trim();
        if (!name) return;
        const images = productImages(p) as { id?: string; alt_text: string | null }[];
        images.forEach((img, index) => {
          if (img.id && !String(img.alt_text || "").trim()) {
            updates.push({ id: img.id, alt: index === 0 ? name : `${name} - vue ${index + 1}` });
          }
        });
      });

    if (updates.length === 0) return;

    const results = await Promise.all(
      updates.map((u) =>
        supabase
          .from("product_images")
          .update({ alt_text: u.alt.slice(0, SEO_LIMITS.titleMax * 2) })
          .eq("id", u.id)
      )
    );
    const failed = results.find((r) => r.error);
    if (failed?.error) throw new Error(failed.error.message);
  }
}
