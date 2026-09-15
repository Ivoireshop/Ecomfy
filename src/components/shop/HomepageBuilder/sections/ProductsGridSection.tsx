import React from "react";
import { ProductsGridSectionSettings } from "../types";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ShoppingBag, ShoppingCart, Store, Plus } from "lucide-react";
import { thumbUrl } from "@/lib/imageUrl";

interface ProductItem {
  id: string;
  name: string;
  price: number;
  compare_at_price?: number | null;
  category?: string | null;
  short_description?: string | null;
  stock_quantity?: number | null;
  is_featured?: boolean | null;
  is_digital?: boolean | null;
  product_images?: { id: string; image_url: string; is_primary: boolean }[];
}

interface ProductsGridSectionProps {
  settings: ProductsGridSectionSettings;
  products: ProductItem[];
  primaryColor?: string;
  onAddToCart?: (product: ProductItem) => void;
  onViewProduct?: (product: ProductItem) => void;
  formatPrice?: (price: number) => string;
}

export const ProductsGridSection: React.FC<ProductsGridSectionProps> = ({
  settings,
  products = [],
  primaryColor = "#0E7C66",
  onAddToCart,
  onViewProduct,
  formatPrice = (p) => new Intl.NumberFormat("fr-FR").format(p),
}) => {
  // Filter products according to rule
  const filteredProducts = React.useMemo(() => {
    let list = [...products];
    if (settings.selection_rule === "featured") {
      list = list.filter((p) => p.is_featured);
      if (list.length === 0) list = [...products]; // fallback
    } else if (settings.selection_rule === "category" && settings.selected_category) {
      list = list.filter((p) => p.category === settings.selected_category);
    } else if (
      settings.selection_rule === "manual" &&
      Array.isArray(settings.selected_product_ids) &&
      settings.selected_product_ids.length > 0
    ) {
      const idSet = new Set(settings.selected_product_ids);
      list = list.filter((p) => idSet.has(p.id));
    }
    return list.slice(0, settings.limit || 8);
  }, [products, settings]);

  const colClassDesktop =
    settings.columns_desktop === 2
      ? "md:grid-cols-2"
      : settings.columns_desktop === 4
      ? "md:grid-cols-4"
      : "md:grid-cols-3";

  const colClassMobile =
    settings.columns_mobile === 1 ? "grid-cols-1" : "grid-cols-2";

  return (
    <section className="py-12 md:py-16 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
      {(settings.title || settings.subtitle) && (
        <div className="text-center max-w-2xl mx-auto mb-8 md:mb-12 space-y-2">
          {settings.title && (
            <h2 className="font-space font-bold text-2xl sm:text-3xl text-slate-900 tracking-tight">
              {settings.title}
            </h2>
          )}
          {settings.subtitle && (
            <p className="font-inter text-slate-500 text-sm sm:text-base">
              {settings.subtitle}
            </p>
          )}
        </div>
      )}

      {filteredProducts.length === 0 ? (
        <div className="text-center py-12 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
          <ShoppingBag className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500 text-sm font-medium">
            Aucun produit à afficher dans cette section pour le moment.
          </p>
        </div>
      ) : (
        <div className={`grid ${colClassMobile} ${colClassDesktop} gap-4 sm:gap-6`}>
          {filteredProducts.map((product) => {
            const primaryImg = product.product_images?.find((img) => img.is_primary) || product.product_images?.[0];
            const discountPct =
              product.compare_at_price && product.compare_at_price > product.price
                ? Math.round((1 - product.price / product.compare_at_price) * 100)
                : null;

            return (
              <Card
                key={product.id}
                className="overflow-hidden group cursor-pointer border-0 shadow-sm hover:shadow-xl transition-all duration-300 flex flex-col justify-between"
                onClick={() => onViewProduct?.(product)}
              >
                <div className="aspect-square bg-slate-100 relative overflow-hidden">
                  {primaryImg ? (
                    <img
                      src={thumbUrl(primaryImg.image_url, 800)}
                      alt={product.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      loading="lazy"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Store className="h-10 w-10 text-slate-300" />
                    </div>
                  )}

                  {discountPct !== null && settings.show_compare_price && (
                    <Badge className="absolute top-2 left-2 bg-rose-600 text-white rounded-lg font-bold text-[10px] sm:text-xs px-2 py-0.5">
                      -{discountPct}%
                    </Badge>
                  )}

                  {product.is_digital && (
                    <Badge className="absolute top-2 right-2 bg-purple-600 text-white rounded-lg text-[10px] sm:text-xs">
                      Digital
                    </Badge>
                  )}

                  {settings.show_stock_badge &&
                    typeof product.stock_quantity === "number" &&
                    product.stock_quantity <= 5 &&
                    product.stock_quantity > 0 && (
                      <Badge className="absolute bottom-2 left-2 bg-amber-500 text-white text-[10px] font-semibold">
                        Stock limité ({product.stock_quantity})
                      </Badge>
                    )}
                </div>

                <div className="p-3 sm:p-4 flex-1 flex flex-col justify-between">
                  <div>
                    <h3 className="font-semibold text-xs sm:text-sm text-slate-900 line-clamp-2 mb-1 group-hover:text-[#0E7C66] transition-colors">
                      {product.name}
                    </h3>
                    {product.short_description && (
                      <p className="text-[11px] sm:text-xs text-slate-500 line-clamp-2 mb-2">
                        {product.short_description}
                      </p>
                    )}
                  </div>

                  <div className="pt-2.5 border-t border-slate-100 flex flex-col gap-2 mt-2">
                    <div className="flex items-baseline justify-between gap-1 flex-wrap min-w-0">
                      <span
                        className="font-bold text-sm sm:text-base whitespace-nowrap"
                        style={{ color: primaryColor }}
                      >
                        {formatPrice(product.price)} <span className="text-[10px] sm:text-xs text-slate-500 font-normal">FCFA</span>
                      </span>
                      {product.compare_at_price && product.compare_at_price > product.price && (
                        <span className="text-[10px] sm:text-xs text-slate-400 line-through whitespace-nowrap">
                          {formatPrice(product.compare_at_price)} FCFA
                        </span>
                      )}
                    </div>

                    <Button
                      size="sm"
                      className="w-full h-8 sm:h-9 px-3 rounded-xl font-semibold text-xs gap-1.5 shadow-sm transition-all duration-200 hover:opacity-90"
                      style={{ backgroundColor: primaryColor, color: "#FFFFFF" }}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (settings.button_action === "checkout") {
                          onAddToCart?.(product);
                        } else {
                          onViewProduct?.(product);
                        }
                      }}
                    >
                      <ShoppingCart className="w-3.5 h-3.5 shrink-0" />
                      <span className="truncate">{settings.button_text || "Acheter"}</span>
                    </Button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </section>
  );
};
