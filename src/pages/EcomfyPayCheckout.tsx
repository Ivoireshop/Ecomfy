import React, { useState, useEffect } from "react";
import { useParams, useSearchParams, useNavigate } from "react-router-dom";
import { Helmet } from "react-helmet";
import { supabase } from "@/integrations/supabase/client";
import { PaymentLink, EcomfyPayment } from "@/types/ecomfyPay";
import { ecomfyPayApi } from "@/lib/ecomfyPay";
import { PaymentMethodLogo } from "@/components/ecomfy-pay/PaymentMethodLogo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import {
  ShieldCheck,
  CheckCircle2,
  Lock,
  ArrowRight,
  Loader2,
  Store,
  Truck,
  CreditCard,
} from "lucide-react";

export default function EcomfyPayCheckout() {
  const { linkKey } = useParams<{ linkKey: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [link, setLink] = useState<PaymentLink | null>(null);
  const [shopName, setShopName] = useState<string>("Boutique Partenaire");

  // Montant libre (uniquement si le vendeur l'autorise sur le lien)
  const [customAmount, setCustomAmount] = useState<string>("");
  const [customerName, setCustomerName] = useState<string>("");
  const [customerPhone, setCustomerPhone] = useState<string>("");
  const [selectedMethod, setSelectedMethod] = useState<string>("wave");
  // Paiement enregistré côté serveur mais sans page opérateur à ouvrir : la confirmation arrive plus tard.
  const [isSuccess, setIsSuccess] = useState<boolean>(false);
  const [paymentRef, setPaymentRef] = useState<string>("");

  const formatPrice = (amount: number) =>
    new Intl.NumberFormat("fr-FR").format(amount);

  useEffect(() => {
    const fetchLinkDetails = async () => {
      if (!linkKey) return;
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from("ecomfy_payment_links")
          .select("*, products(name, price), shops(business_name)")
          .eq("link_key", linkKey)
          .maybeSingle();

        if (data) {
          const formatted: PaymentLink = {
            id: data.id,
            link_key: data.link_key,
            shop_id: data.shop_id,
            product_id: data.product_id,
            title: data.title,
            description: data.description,
            amount: Number(data.amount),
            currency: data.currency || "XOF",
            is_active: data.is_active,
            is_sandbox: data.is_sandbox,
            allow_custom_amount: data.allow_custom_amount || false,
            created_at: data.created_at,
            updated_at: data.updated_at,
            products: data.products,
          };
          setLink(formatted);
          setCustomAmount(String(data.amount));
          if (data.shops) {
            setShopName(data.shops.business_name || "Boutique Ecomfy");
          }
        }
      } catch (err) {
        console.error("[Checkout] Error loading link", err);
      } finally {
        setLoading(false);
      }
    };

    fetchLinkDetails();
  }, [linkKey]);

  // Le serveur (ecomfy-pay-initiate) n'accepte que le montant du lien, ou un montant supérieur si le vendeur autorise la saisie libre.
  const calculateTotal = () => {
    if (!link) return 0;
    if (link.allow_custom_amount) {
      const parsed = parseFloat(customAmount);
      return !isNaN(parsed) && parsed >= link.amount ? parsed : 0;
    }
    return link.amount || 0;
  };

  const finalTotal = calculateTotal();

  const handlePay = async (e: React.FormEvent) => {
    e.preventDefault();
    if (finalTotal <= 0) {
      toast({ title: "Montant invalide", description: "Veuillez vérifier le montant à payer.", variant: "destructive" });
      return;
    }

    setSubmitting(true);
    try {
      // Le paiement est créé et validé côté serveur (montant relu en base, référence générée par le serveur).
      const res = await ecomfyPayApi.initiateCustomerPayment({
        shop_id: link.shop_id,
        payment_link_id: link.id,
        amount: finalTotal,
        currency: link.currency,
        payment_method: selectedMethod,
        customer_name: customerName,
        customer_phone: customerPhone,
      });

      if (!res.success) {
        toast({ title: "Paiement non démarré", description: res.error || "Réessayez dans un instant.", variant: "destructive" });
        return;
      }

      if (res.checkout_url) {
        window.location.href = res.checkout_url;
        return;
      }

      setPaymentRef(res.internal_reference || "");
      setIsSuccess(true);
    } catch (err: any) {
      toast({ title: "Échec du paiement", description: err.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="flex flex-col items-center gap-3 text-slate-500">
          <Loader2 className="w-8 h-8 animate-spin text-[#0E7C66]" />
          <p className="text-xs font-semibold">Chargement du guichet de paiement sécurisé Ecomfy Pay...</p>
        </div>
      </div>
    );
  }

  if (!link) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white border border-slate-200/80 rounded-3xl p-6 text-center space-y-4 shadow-sm">
          <h3 className="font-extrabold text-slate-900 text-lg">Lien de Paiement Introuvable</h3>
          <p className="text-xs text-slate-500">Ce lien de paiement est expiré ou n'existe plus.</p>
          <Button onClick={() => navigate("/")} className="bg-[#0E7C66] text-white font-bold rounded-xl text-xs h-10 w-full">
            Retour à l'accueil
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-inter py-6 px-4 flex flex-col justify-between">
      <Helmet>
        <title>Paiement Sécurisé — {link.title} ({shopName})</title>
      </Helmet>

      {/* Header marque */}
      <header className="max-w-md mx-auto w-full flex items-center justify-between py-2 border-b border-slate-200/80 mb-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-[#0E7C66] text-white flex items-center justify-center font-bold text-xs">
            EP
          </div>
          <div>
            <span className="font-extrabold text-slate-900 text-sm block leading-none">Ecomfy Pay</span>
            <span className="text-[10px] text-slate-400 font-medium">Guichet Officiel Sécurisé</span>
          </div>
        </div>

        <Badge className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-0.5 border-0 flex items-center gap-1">
          <Lock className="w-3 h-3 text-emerald-600" />
          <span>SSL 256-bit</span>
        </Badge>
      </header>

      <main className="max-w-md mx-auto w-full flex-1 space-y-5">
        {isSuccess ? (
          /* Écran de Succès du Paiement */
          <div className="bg-white border border-emerald-200 rounded-3xl p-6 text-center space-y-5 shadow-lg animate-in fade-in zoom-in-95">
            <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto shadow-inner">
              <CheckCircle2 className="w-10 h-10" />
            </div>

            <div>
              <Badge className="bg-emerald-600 text-white font-extrabold text-xs px-3 py-1 uppercase rounded-md border-0 mb-2">
                Paiement Enregistré
              </Badge>
              <h2 className="text-xl font-extrabold text-slate-900">
                Paiement en cours de traitement
              </h2>
              <p className="text-xs text-slate-500 mt-1">
                Votre paiement de <strong className="text-slate-900">{formatPrice(finalTotal)} FCFA</strong> à <strong className="text-[#0E7C66]">{shopName}</strong> a été enregistré. Il sera confirmé dès réception par l'opérateur.
              </p>
            </div>

            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 text-left text-xs space-y-2">
              <div className="flex justify-between">
                <span className="text-slate-500">Référence :</span>
                <span className="font-mono font-bold text-slate-900">{paymentRef}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Moyen de paiement :</span>
                <span className="font-bold uppercase text-slate-800">{selectedMethod}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Article / Motif :</span>
                <span className="font-semibold text-slate-800">{link.title}</span>
              </div>
            </div>

            <p className="text-[11px] text-slate-400">
              Conservez cette référence pour tout suivi auprès de la boutique.
            </p>
          </div>
        ) : (
          /* Formulaire de Paiement Dynamique & Ajustable */
          <div className="bg-white border border-slate-200/80 rounded-3xl p-6 shadow-sm space-y-5">
            {/* Infos Boutique & Produit */}
            <div className="border-b border-slate-100 pb-4 space-y-2">
              <div className="flex items-center gap-2 text-xs text-[#0E7C66] font-bold">
                <Store className="w-4 h-4" />
                <span>{shopName}</span>
              </div>

              <h2 className="text-lg font-extrabold text-slate-900 leading-snug">
                {link.title}
              </h2>

              {link.description && (
                <p className="text-xs text-slate-500">{link.description}</p>
              )}
            </div>

            {/* Montant à payer (libre si le vendeur l'autorise) */}
            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-3">
              {/* Option Montant Libre / Ajustable par le client ou livreur */}
              {link.allow_custom_amount && (
                <div className="space-y-1">
                  <Label className="text-xs font-bold text-slate-700">
                    Montant personnalisé (FCFA)
                  </Label>
                  <Input
                    type="number"
                    value={customAmount}
                    onChange={(e) => setCustomAmount(e.target.value)}
                    placeholder="Saisissez le montant exact convenu"
                    className="font-extrabold text-base h-11 bg-white"
                  />
                  <p className="text-[10px] text-slate-400">
                    Saisie libre activée par le vendeur (minimum {formatPrice(link.amount)} FCFA).
                  </p>
                </div>
              )}

              {/* Total final à régler */}
              <div className={`flex items-center justify-between ${link.allow_custom_amount ? "pt-2 border-t border-slate-200" : ""}`}>
                <span className="text-xs font-extrabold text-slate-900">Total à payer :</span>
                <span className="text-xl font-black text-[#0E7C66]">
                  {formatPrice(finalTotal)} FCFA
                </span>
              </div>
            </div>

            {/* Choix du Moyen de Paiement avec Logos Officiels */}
            <form onSubmit={handlePay} className="space-y-4 text-xs font-medium">
              <div>
                <Label className="text-xs font-bold text-slate-800 mb-2 block">
                  Sélectionnez votre moyen de paiement
                </Label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { id: "wave", name: "Wave" },
                    { id: "orange", name: "Orange Money" },
                    { id: "mtn", name: "MTN MoMo" },
                    { id: "moov", name: "Moov Money" },
                    { id: "card", name: "Carte Visa / MC" },
                    { id: "djamo", name: "Djamo Pay" },
                  ].map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setSelectedMethod(m.id)}
                      className={`p-2.5 rounded-2xl border-2 flex items-center gap-2.5 font-bold transition-all text-left ${
                        selectedMethod === m.id
                          ? "border-[#0E7C66] bg-[#0E7C66]/5 text-[#0E7C66]"
                          : "border-slate-200 text-slate-700 hover:border-slate-300"
                      }`}
                    >
                      <PaymentMethodLogo id={m.id} size={32} />
                      <span className="text-xs truncate">{m.name}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Coordonnées Client / Livreur */}
              <div className="space-y-3 pt-2">
                <div>
                  <Label className="text-xs font-bold text-slate-700">Nom et Prénom du client</Label>
                  <Input
                    required
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    placeholder="Ex: Kouassi Koffi"
                    className="mt-1 font-semibold h-10"
                  />
                </div>

                <div>
                  <Label className="text-xs font-bold text-slate-700">Numéro de téléphone portable</Label>
                  <Input
                    required
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    placeholder="Ex: 0700000000"
                    className="mt-1 font-bold h-10"
                  />
                </div>
              </div>

              <Button
                type="submit"
                disabled={submitting || finalTotal <= 0}
                className="w-full bg-[#0E7C66] hover:bg-[#0A5C4C] text-white font-extrabold rounded-2xl h-12 text-sm shadow-lg gap-2 mt-2"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Paiement en cours...</span>
                  </>
                ) : (
                  <>
                    <span>Payer {formatPrice(finalTotal)} FCFA</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </Button>
            </form>
          </div>
        )}
      </main>

      <footer className="max-w-md mx-auto w-full text-center text-[10px] text-slate-400 py-3">
        Propulsé par <strong className="text-slate-600">Ecomfy Pay</strong> — Infrastructure de paiement sécurisée
      </footer>
    </div>
  );
}
