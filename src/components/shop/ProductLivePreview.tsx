import { useMemo, useState } from "react";
import DOMPurify from "dompurify";
import { Smartphone, Monitor, ShoppingCart, Star, Truck, Shield, Heart, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface PreviewImage {
  id: string;
  image_url: string;
}

interface ProductLivePreviewProps {
  name: string;
  shortDescription: string;
  description: string;
  price: number;
  compareAtPrice: number;
  category: string;
  stock: number;
  images: PreviewImage[];
}

/**
 * Inline live preview of the product card as it would appear to customers.
 * Toggle between mobile (390px) and desktop (1024px) framing.
 */
export function ProductLivePreview({
  name, shortDescription, description, price, compareAtPrice, category, stock, images,
}: ProductLivePreviewProps) {
  const [device, setDevice] = useState<"mobile" | "desktop">("mobile");
  const [activeImg, setActiveImg] = useState(0);

  const safeDescription = useMemo(
    () => DOMPurify.sanitize(description || "", {
      ALLOWED_TAGS: ["p","br","strong","em","i","u","s","span","div","img","a","ul","ol","li","h1","h2","h3","h4","h5","h6","table","thead","tbody","tr","td","th","hr","font","iframe"],
      ALLOWED_ATTR: ["href","src","style","alt","target","rel","width","height","color","size","face","allowfullscreen","frameborder"],
    }),
    [description]
  );

  const discount =
    compareAtPrice > 0 && price > 0 && compareAtPrice > price
      ? Math.round((1 - price / compareAtPrice) * 100)
      : 0;

  const formatPrice = (v: number) => `${(v || 0).toLocaleString("fr-FR")} FCFA`;

  const gallery = images.length > 0 ? images : [];

  return (
    <div className="flex flex-col h-full bg-muted/20">
      {/* Device toggle */}
      <div className="flex items-center justify-center gap-2 p-3 border-b bg-background">
        <Button
          size="sm"
          variant={device === "mobile" ? "default" : "outline"}
          onClick={() => setDevice("mobile")}
          className="gap-1.5"
        >
          <Smartphone className="h-4 w-4" /> Mobile
        </Button>
        <Button
          size="sm"
          variant={device === "desktop" ? "default" : "outline"}
          onClick={() => setDevice("desktop")}
          className="gap-1.5"
        >
          <Monitor className="h-4 w-4" /> Ordinateur
        </Button>
      </div>

      {/* Preview frame */}
      <div className="flex-1 overflow-auto p-4 flex justify-center">
        <div
          className={cn(
            "bg-white shadow-2xl border rounded-xl overflow-hidden transition-all",
            device === "mobile" ? "w-[390px] max-w-full" : "w-full max-w-[1024px]"
          )}
        >
          {/* Fake browser bar */}
          <div className="bg-gray-100 border-b px-3 py-1.5 flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-red-400" />
            <span className="h-2.5 w-2.5 rounded-full bg-yellow-400" />
            <span className="h-2.5 w-2.5 rounded-full bg-green-400" />
            <div className="ml-3 flex-1 truncate text-[10px] text-gray-500 bg-white rounded px-2 py-0.5">
              boutique.shop/produit/{name ? name.toLowerCase().replace(/\s+/g, "-") : "..."}
            </div>
          </div>

          {/* Page body */}
          <div className={cn("p-4", device === "desktop" && "p-8")}>
            <div className={cn("grid gap-6", device === "desktop" ? "grid-cols-2" : "grid-cols-1")}>
              {/* Gallery */}
              <div className="space-y-2">
                <div className="aspect-square w-full bg-gray-100 rounded-lg overflow-hidden flex items-center justify-center">
                  {gallery[activeImg] ? (
                    <img src={gallery[activeImg].image_url} alt={name} className="h-full w-full object-cover" />
                  ) : (
                    <span className="text-gray-400 text-xs">Aucune image</span>
                  )}
                </div>
                {gallery.length > 1 && (
                  <div className="flex gap-2 overflow-x-auto">
                    {gallery.map((img, i) => (
                      <button
                        key={img.id}
                        onClick={() => setActiveImg(i)}
                        className={cn(
                          "h-14 w-14 rounded border-2 overflow-hidden shrink-0",
                          activeImg === i ? "border-pink-500" : "border-transparent"
                        )}
                      >
                        <img src={img.image_url} alt="" className="h-full w-full object-cover" />
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Info */}
              <div className="space-y-3">
                {category && (
                  <span className="inline-block text-[10px] font-semibold uppercase tracking-wide text-pink-600 bg-pink-50 px-2 py-0.5 rounded">
                    {category}
                  </span>
                )}
                <h1 className={cn("font-bold text-gray-900 leading-tight", device === "desktop" ? "text-3xl" : "text-xl")}>
                  {name || "Nom du produit"}
                </h1>
                <div className="flex items-center gap-1 text-yellow-400">
                  {[...Array(5)].map((_, i) => <Star key={i} className="h-4 w-4 fill-current" />)}
                  <span className="text-xs text-gray-500 ml-1">(128 avis)</span>
                </div>
                {shortDescription && (
                  <p className="text-sm text-gray-600">{shortDescription}</p>
                )}
                <div className="flex items-baseline gap-3 pt-1">
                  <span className={cn("font-bold text-pink-600", device === "desktop" ? "text-3xl" : "text-2xl")}>
                    {formatPrice(price)}
                  </span>
                  {compareAtPrice > price && compareAtPrice > 0 && (
                    <span className="text-sm text-gray-400 line-through">{formatPrice(compareAtPrice)}</span>
                  )}
                  {discount > 0 && (
                    <span className="text-xs font-bold bg-red-100 text-red-600 px-2 py-0.5 rounded">-{discount}%</span>
                  )}
                </div>
                <p className={cn("text-xs", stock > 0 ? "text-green-600" : "text-red-600")}>
                  {stock > 0 ? `✓ En stock (${stock} disponibles)` : "Rupture de stock"}
                </p>

                <div className="flex gap-2 pt-2">
                  <button className="flex-1 h-11 rounded-lg bg-pink-500 hover:bg-pink-600 text-white font-semibold text-sm flex items-center justify-center gap-2">
                    <ShoppingCart className="h-4 w-4" /> Ajouter au panier
                  </button>
                  <button className="h-11 w-11 rounded-lg border flex items-center justify-center text-gray-600">
                    <Heart className="h-4 w-4" />
                  </button>
                  <button className="h-11 w-11 rounded-lg border flex items-center justify-center text-gray-600">
                    <Share2 className="h-4 w-4" />
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-2 pt-3 text-xs text-gray-600">
                  <div className="flex items-center gap-1.5"><Truck className="h-3.5 w-3.5" /> Livraison rapide</div>
                  <div className="flex items-center gap-1.5"><Shield className="h-3.5 w-3.5" /> Paiement sécurisé</div>
                </div>
              </div>
            </div>

            {/* Description */}
            {safeDescription && (
              <div className="mt-8 pt-6 border-t">
                <h2 className="font-bold text-gray-900 mb-3">Description</h2>
                <div
                  className="prose prose-sm max-w-none text-gray-700"
                  dangerouslySetInnerHTML={{ __html: safeDescription }}
                />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}