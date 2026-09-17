import React, { useState } from "react";
import { SingleProductCheckoutSectionSettings } from "../types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { ShoppingBag, CheckCircle2, ShieldCheck, Truck, Sparkles, Clock, Star } from "lucide-react";
import { toast } from "@/hooks/use-toast";

interface SingleProductCheckoutSectionProps {
  settings: SingleProductCheckoutSectionSettings;
  products: any[];
  primaryColor?: string;
  onDirectOrder?: (orderData: {
    product: any;
    quantity: number;
    customer_name: string;
    customer_phone: string;
    customer_address?: string;
  }) => Promise<boolean | void>;
}

export const SingleProductCheckoutSection: React.FC<SingleProductCheckoutSectionProps> = ({
  settings,
  products = [],
  primaryColor = "#0E7C66",
  onDirectOrder,
}) => {
  const targetProduct = React.useMemo(() => {
    if (settings.product_id) {
      const found = products.find((p) => p.id === settings.product_id);
      if (found) return found;
    }
    // Fallback to first published product
    return products.find((p) => p.is_published) || products[0] || null;
  }, [settings.product_id, products]);

  const [quantity, setQuantity] = useState(1);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  if (!targetProduct) {
    return (
      <section className="py-12 bg-slate-50 border-y border-slate-200 text-center px-4">
        <p className="text-slate-500 text-sm font-medium">
          {settings.title || "Offre Spéciale"} - Veuillez sélectionner un produit dans le panneau d'édition.
        </p>
      </section>
    );
  }

  const primaryImage =
    targetProduct.product_images?.find((img: any) => img.is_primary)?.image_url ||
    targetProduct.product_images?.[0]?.image_url ||
    "/placeholder.svg";

  const totalPrice = targetProduct.price * quantity;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast({ title: "Champ requis", description: "Veuillez entrer votre nom complet.", variant: "destructive" });
      return;
    }
    if (!phone.trim() || phone.trim().length < 8) {
      toast({ title: "Numéro invalide", description: "Veuillez entrer un numéro de téléphone valide.", variant: "destructive" });
      return;
    }

    setLoading(true);
    try {
      if (onDirectOrder) {
        await onDirectOrder({
          product: targetProduct,
          quantity,
          customer_name: name.trim(),
          customer_phone: phone.trim(),
          customer_address: address.trim(),
        });
      } else {
        // Fallback simulation/success
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
      setSuccess(true);
      toast({
        title: "Commande validée ! 🎉",
        description: "Merci pour votre achat. Notre équipe vous contactera sous peu.",
      });
    } catch (err: any) {
      console.error(err);
      toast({
        title: "Échec de la commande",
        description: err.message || "Une erreur est survenue lors de la validation.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="py-12 md:py-20 px-4 md:px-8 bg-slate-900 text-white relative overflow-hidden" style={{ backgroundColor: settings.bg_color || undefined }}>
      <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8 md:gap-12 items-center relative z-10">
        
        {/* Left Column: Product Spotlight */}
        <div className="lg:col-span-6 space-y-6">
          {settings.badge && (
            <Badge className="bg-amber-400 text-slate-900 hover:bg-amber-400 font-bold px-3 py-1 text-xs uppercase tracking-wider rounded-full shadow-lg flex items-center gap-1.5 w-fit">
              <Sparkles className="w-3.5 h-3.5 fill-slate-900" />
              {settings.badge}
            </Badge>
          )}

          <div className="space-y-2">
            <h2 className="text-2xl md:text-4xl font-extrabold text-white leading-tight font-space">
              {settings.title || targetProduct.name}
            </h2>
            {settings.subtitle && (
              <p className="text-slate-300 text-base font-medium">{settings.subtitle}</p>
            )}
          </div>

          <div className="relative rounded-2xl overflow-hidden border border-slate-700/60 bg-slate-800/80 shadow-2xl group">
            <img
              src={primaryImage}
              alt={targetProduct.name}
              className="w-full h-72 md:h-96 object-cover object-center group-hover:scale-105 transition-transform duration-500"
            />
            {targetProduct.compare_at_price > targetProduct.price && (
              <div className="absolute top-4 left-4 bg-rose-600 text-white font-black text-xs px-3 py-1.5 rounded-xl shadow-md uppercase">
                Économisez {Math.round(((targetProduct.compare_at_price - targetProduct.price) / targetProduct.compare_at_price) * 100)}%
              </div>
            )}
          </div>

          <div className="p-4 rounded-xl bg-slate-800/60 border border-slate-700/40 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-slate-400 text-xs font-semibold uppercase tracking-wider">Prix Spécial</span>
              <div className="flex items-baseline gap-2">
                {targetProduct.compare_at_price > targetProduct.price && (
                  <span className="text-slate-400 line-through text-sm">
                    {targetProduct.compare_at_price.toLocaleString("fr-FR")} {targetProduct.currency || "FCFA"}
                  </span>
                )}
                <span className="text-2xl font-black text-amber-400 font-space">
                  {targetProduct.price.toLocaleString("fr-FR")} {targetProduct.currency || "FCFA"}
                </span>
              </div>
            </div>
            {targetProduct.short_description && (
              <p className="text-slate-300 text-xs leading-relaxed line-clamp-3">
                {targetProduct.short_description}
              </p>
            )}
          </div>

          {/* Guarantee Badges */}
          <div className="grid grid-cols-3 gap-3 pt-2">
            <div className="flex items-center gap-2 p-2.5 rounded-lg bg-slate-800/40 border border-slate-700/30">
              <Truck className="w-4 h-4 text-amber-400 shrink-0" />
              <span className="text-[11px] text-slate-300 font-medium leading-tight">Livraison Rapide</span>
            </div>
            <div className="flex items-center gap-2 p-2.5 rounded-lg bg-slate-800/40 border border-slate-700/30">
              <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
              <span className="text-[11px] text-slate-300 font-medium leading-tight">Paiement Sécurisé</span>
            </div>
            <div className="flex items-center gap-2 p-2.5 rounded-lg bg-slate-800/40 border border-slate-700/30">
              <Star className="w-4 h-4 text-amber-400 shrink-0" />
              <span className="text-[11px] text-slate-300 font-medium leading-tight">Qualité Garantie</span>
            </div>
          </div>
        </div>

        {/* Right Column: Instant Checkout Form */}
        <div className="lg:col-span-6">
          <Card className="p-6 md:p-8 rounded-2xl bg-white text-slate-900 shadow-2xl border-0">
            {success ? (
              <div className="py-8 text-center space-y-4">
                <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
                  <CheckCircle2 className="w-10 h-10" />
                </div>
                <h3 className="text-xl font-extrabold text-slate-900 font-space">Commande Enregistrée !</h3>
                <p className="text-slate-600 text-sm max-w-sm mx-auto">
                  Merci {name}, votre commande pour <strong>{targetProduct.name}</strong> a bien été enregistrée. Nous vous contacterons rapidement.
                </p>
                <Button
                  onClick={() => setSuccess(false)}
                  variant="outline"
                  className="mt-4 rounded-xl text-xs font-semibold"
                >
                  Passer une autre commande
                </Button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="flex items-center justify-between border-b pb-4">
                  <div className="flex items-center gap-2">
                    <ShoppingBag className="w-5 h-5 text-slate-900" />
                    <h3 className="font-bold text-lg text-slate-900 font-space">Commander Directement</h3>
                  </div>
                  <Badge variant="secondary" className="bg-amber-100 text-amber-800 font-bold text-xs">
                    Paiement à la livraison
                  </Badge>
                </div>

                {/* Quantity selector */}
                <div className="space-y-2">
                  <Label className="text-xs font-bold text-slate-700 uppercase tracking-wider">Quantité</Label>
                  <div className="flex items-center gap-3">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-10 w-10 text-lg font-bold rounded-xl border-slate-300"
                      onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                    >
                      -
                    </Button>
                    <span className="text-lg font-extrabold text-slate-900 w-8 text-center">{quantity}</span>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-10 w-10 text-lg font-bold rounded-xl border-slate-300"
                      onClick={() => setQuantity((q) => q + 1)}
                    >
                      +
                    </Button>
                    <div className="ml-auto text-right">
                      <span className="text-xs text-slate-500 block">Total</span>
                      <span className="text-lg font-extrabold text-slate-900 font-space">
                        {totalPrice.toLocaleString("fr-FR")} {targetProduct.currency || "FCFA"}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Form Inputs */}
                <div className="space-y-3 pt-2">
                  <div>
                    <Label className="text-xs font-semibold text-slate-700">Votre Nom Complet *</Label>
                    <Input
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Ex: Jean Kouassi"
                      className="h-11 bg-slate-50 border-slate-200 focus-visible:ring-primary/20 text-sm mt-1 rounded-xl"
                    />
                  </div>

                  <div>
                    <Label className="text-xs font-semibold text-slate-700">Numéro de Téléphone (WhatsApp/Appel) *</Label>
                    <Input
                      required
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="Ex: 0700000000"
                      className="h-11 bg-slate-50 border-slate-200 focus-visible:ring-primary/20 text-sm mt-1 rounded-xl"
                    />
                  </div>

                  <div>
                    <Label className="text-xs font-semibold text-slate-700">Ville & Quartier de Livraison</Label>
                    <Input
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                      placeholder="Ex: Abidjan, Cocody Angré"
                      className="h-11 bg-slate-50 border-slate-200 focus-visible:ring-primary/20 text-sm mt-1 rounded-xl"
                    />
                  </div>
                </div>

                <Button
                  type="submit"
                  disabled={loading}
                  className="w-full h-13 text-base font-bold shadow-lg rounded-xl gap-2 mt-4 text-white uppercase tracking-wider"
                  style={{ backgroundColor: primaryColor }}
                >
                  {loading ? (
                    "Traitement de la commande..."
                  ) : (
                    <>
                      <ShoppingBag className="w-5 h-5" />
                      {settings.button_text || "Valider ma commande maintenant"}
                    </>
                  )}
                </Button>
              </form>
            )}
          </Card>
        </div>
      </div>
    </section>
  );
};
