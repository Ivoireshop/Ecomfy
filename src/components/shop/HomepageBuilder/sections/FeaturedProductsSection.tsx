import React from "react";
import { FeaturedProductsSectionSettings } from "../types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { ShoppingBag, Star, Sparkles } from "lucide-react";

interface FeaturedProductsSectionProps {
  settings: FeaturedProductsSectionSettings;
  products: any[];
  primaryColor?: string;
  onAddToCart?: (product: any) => void;
  onViewProduct?: (product: any) => void;
}

export const FeaturedProductsSection: React.FC<FeaturedProductsSectionProps> = ({
  settings,
  products = [],
  primaryColor = "#0E7C66",
  onAddToCart,
  onViewProduct,
}) => {
  const featuredList = React.useMemo(() => {
    if (Array.isArray(settings.selected_product_ids) && settings.selected_product_ids.length > 0) {
      return products.filter((p) => settings.selected_product_ids.includes(p.id));
    }
    // Fallback: return products marked as featured or top products
    const featured = products.filter((p) => p.is_featured && p.is_published);
    return featured.length > 0 ? featured : products.filter((p) => p.is_published).slice(0, 4);
  }, [settings.selected_product_ids, products]);

  if (featuredList.length === 0) return null;

  const colsClass =
    settings.columns_desktop === 4
      ? "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4"
      : settings.columns_desktop === 2
      ? "grid-cols-1 sm:grid-cols-2"
      : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3";

  return (
    <section className="py-12 md:py-20 px-4 md:px-8 bg-white border-y border-slate-100">
      <div className="max-w-7xl mx-auto space-y-10">
        
        <div className="text-center space-y-3 max-w-2xl mx-auto">
          {settings.show_badge && (
            <Badge className="bg-amber-100 text-amber-900 hover:bg-amber-100 font-bold px-3 py-1 text-xs uppercase tracking-widest rounded-full mx-auto w-fit gap-1">
              <Sparkles className="w-3.5 h-3.5 fill-amber-500 text-amber-500" />
              {settings.badge_text || "Sélection Vedette"}
            </Badge>
          )}
          <h2 className="text-2xl md:text-4xl font-extrabold text-slate-900 font-space">
            {settings.title || "Nos Produits Vedettes"}
          </h2>
          {settings.subtitle && (
            <p className="text-slate-500 text-sm md:text-base leading-relaxed">
              {settings.subtitle}
            </p>
          )}
        </div>

        <div className={`grid ${colsClass} gap-6 md:gap-8`}>
          {featuredList.map((product) => {
            const primaryImage =
              product.product_images?.find((img: any) => img.is_primary)?.image_url ||
              product.product_images?.[0]?.image_url ||
              "/placeholder.svg";

            const hasDiscount = product.compare_at_price > product.price;

            return (
              <Card
                key={product.id}
                className="group rounded-2xl border-slate-200/80 bg-white overflow-hidden shadow-sm hover:shadow-xl transition-all duration-300 flex flex-col justify-between"
              >
                <div className="relative aspect-square overflow-hidden bg-slate-100 cursor-pointer" onClick={() => onViewProduct?.(product)}>
                  <img
                    src={primaryImage}
                    alt={product.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />

                  <Badge className="absolute top-3 left-3 bg-amber-500 text-slate-900 font-extrabold text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-lg shadow">
                    Vedette
                  </Badge>

                  {hasDiscount && (
                    <Badge className="absolute top-3 right-3 bg-rose-600 text-white font-black text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-lg shadow">
                      -{Math.round(((product.compare_at_price - product.price) / product.compare_at_price) * 100)}%
                    </Badge>
                  )}
                </div>

                <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
                  <div className="space-y-1.5 cursor-pointer" onClick={() => onViewProduct?.(product)}>
                    <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                      {product.category || "Produit"}
                    </span>
                    <h3 className="font-bold text-slate-900 text-base line-clamp-1 group-hover:text-primary transition-colors">
                      {product.name}
                    </h3>
                    {product.short_description && (
                      <p className="text-slate-500 text-xs line-clamp-2 leading-snug">
                        {product.short_description}
                      </p>
                    )}
                  </div>

                  <div className="pt-2 border-t border-slate-100 space-y-3">
                    <div className="flex items-baseline justify-between">
                      <div className="flex items-baseline gap-2">
                        <span className="text-xl font-extrabold text-slate-900 font-space">
                          {product.price.toLocaleString("fr-FR")} {product.currency || "FCFA"}
                        </span>
                        {hasDiscount && (
                          <span className="text-xs text-slate-400 line-through">
                            {product.compare_at_price.toLocaleString("fr-FR")}
                          </span>
                        )}
                      </div>
                    </div>

                    <Button
                      onClick={() => onAddToCart?.(product)}
                      className="w-full h-11 text-xs font-bold rounded-xl gap-2 text-white uppercase tracking-wider shadow-sm font-space"
                      style={{ backgroundColor: primaryColor }}
                    >
                      <ShoppingBag className="w-4 h-4" />
                      {settings.button_text || "Commander"}
                    </Button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      </div>
    </section>
  );
};
