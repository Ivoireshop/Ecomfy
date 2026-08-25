import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { 
  Loader2, Plus, Copy, CheckCircle2, XCircle, Users, 
  Tag, Sparkles, MessageCircle, DollarSign, 
  Truck, UserCheck, ArrowLeft, RefreshCw, Trash2, Crown, Store, Gift
} from "lucide-react";
import { Session } from "@supabase/supabase-js";

export interface PromoCode {
  id: string;
  code: string;
  discount_percentage?: number;
  discount_amount?: number;
  discount_type?: "percentage" | "fixed_amount" | "free_shipping";
  max_uses: number;
  current_uses: number;
  min_order_amount?: number;
  target_user_email?: string | null;
  target_user_phone?: string | null;
  expires_at: string;
  created_at: string;
  is_active: boolean;
  shop_id?: string | null;
}

interface PromoCodeManagerProps {
  shopId?: string;
  shopSlug?: string;
  shopName?: string;
  isEmbedded?: boolean;
  mode?: "founder" | "merchant";
}

export default function PromoCodeManager({ 
  shopId, 
  shopSlug, 
  shopName, 
  isEmbedded = false,
  mode: propMode
}: PromoCodeManagerProps) {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [promoCodes, setPromoCodes] = useState<PromoCode[]>([]);

  // Mode: if shopId is provided -> merchant mode, otherwise founder SaaS mode
  const mode: "founder" | "merchant" = propMode || (shopId ? "merchant" : "founder");
  const isFounderMode = mode === "founder";

  // Form State
  const [discountType, setDiscountType] = useState<"percentage" | "fixed_amount" | "free_shipping">(
    isFounderMode ? "percentage" : "percentage"
  );
  const [discountValue, setDiscountValue] = useState<number>(20);
  const [maxUses, setMaxUses] = useState<number>(isFounderMode ? 50 : 20);
  const [minOrderAmount, setMinOrderAmount] = useState<number>(0);
  const [validityDays, setValidityDays] = useState<number>(isFounderMode ? 30 : 7);
  const [customCode, setCustomCode] = useState<string>("");
  const [useCustomCode, setUseCustomCode] = useState<boolean>(false);

  // Target Attachment State
  const [targetType, setTargetType] = useState<"all" | "specific_user">("all");
  const [targetEmailOrPhone, setTargetEmailOrPhone] = useState<string>("");

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      loadPromoCodes();
    });

    const { data: { subscription: authSubscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session);
      }
    );

    return () => authSubscription.unsubscribe();
  }, [shopId, mode]);

  const loadPromoCodes = async () => {
    setIsLoading(true);
    try {
      let query = (supabase as any).from("promo_codes").select("*");

      if (isFounderMode) {
        // Founder mode: get global SaaS codes (shop_id is null)
        query = query.is("shop_id", null);
      } else if (shopId) {
        // Merchant mode: get codes for this specific shop
        query = query.eq("shop_id", shopId);
      }

      const { data, error } = await query.order("created_at", { ascending: false });

      if (error) throw error;
      setPromoCodes((data as any) || []);
    } catch (error: any) {
      console.error("Error loading promo codes:", error);
      toast({
        title: "Erreur de chargement",
        description: error.message || "Impossible de charger les codes promo",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const generateRandomCode = () => {
    const prefix = isFounderMode ? "ECOMFY" : "PROMO";
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let randomPart = "";
    for (let i = 0; i < 4; i++) {
      randomPart += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return `${prefix}-${randomPart}`;
  };

  // Apply Presets
  const applyPreset = (preset: string) => {
    setUseCustomCode(true);

    if (isFounderMode) {
      // FOUNDER SAAS PRESETS
      if (preset === "pass_vip") {
        setCustomCode(`VIP-ECOMFY20`);
        setDiscountType("percentage");
        setDiscountValue(20);
        setMaxUses(50);
        setValidityDays(30);
        toast({ title: "Preset Fondateur Appliqué", description: "Réduction Pass VIP : -20% (sur 35 000 FCFA/mois)" });
      } else if (preset === "academy") {
        setCustomCode(`ACADEMY30`);
        setDiscountType("percentage");
        setDiscountValue(30);
        setMaxUses(30);
        setValidityDays(30);
        toast({ title: "Preset Fondateur Appliqué", description: "Offre Formation Academy : -30%" });
      } else if (preset === "launch_50") {
        setCustomCode(`FOUNDER50`);
        setDiscountType("percentage");
        setDiscountValue(50);
        setMaxUses(100);
        setValidityDays(7);
        toast({ title: "Preset Fondateur Appliqué", description: "Offre Lancement Fondateur : -50% pendant 7 jours" });
      } else if (preset === "fixed_10k") {
        setCustomCode(`REDUC10K`);
        setDiscountType("fixed_amount");
        setDiscountValue(10000);
        setMaxUses(20);
        setValidityDays(14);
        toast({ title: "Preset Fondateur Appliqué", description: "Réduction Fixe de 10 000 FCFA sur l'Abonnement SaaS" });
      }
    } else {
      // MERCHANT E-COMMERCE PRESETS
      if (preset === "welcome") {
        setCustomCode(`BIENVENUE15`);
        setDiscountType("percentage");
        setDiscountValue(15);
        setMaxUses(50);
        setValidityDays(14);
        setMinOrderAmount(5000);
        toast({ title: "Preset Boutique Appliqué", description: "Offre de Bienvenue Client : -15% sur la commande" });
      } else if (preset === "vip") {
        setCustomCode(`VIP25`);
        setDiscountType("percentage");
        setDiscountValue(25);
        setMaxUses(20);
        setValidityDays(30);
        setMinOrderAmount(10000);
        toast({ title: "Preset Boutique Appliqué", description: "Remise Client Fidèle VIP : -25%" });
      } else if (preset === "flash") {
        setCustomCode(`FLASH50`);
        setDiscountType("percentage");
        setDiscountValue(50);
        setMaxUses(100);
        setValidityDays(2);
        setMinOrderAmount(0);
        toast({ title: "Preset Boutique Appliqué", description: "Vente Flash Articles : -50% pendant 48h" });
      } else if (preset === "freeship") {
        setCustomCode(`LIVRAISONFREE`);
        setDiscountType("free_shipping");
        setDiscountValue(0);
        setMaxUses(100);
        setValidityDays(14);
        setMinOrderAmount(8000);
        toast({ title: "Preset Boutique Appliqué", description: "Livraison Offerte dès 8 000 FCFA d'achat" });
      }
    }
  };

  const createPromoCode = async () => {
    if (!session?.user?.id) {
      toast({ title: "Erreur", description: "Vous devez être connecté", variant: "destructive" });
      return;
    }

    let finalCode = useCustomCode ? customCode.toUpperCase().trim() : generateRandomCode();

    if (!finalCode || finalCode.length < 3) {
      toast({
        title: "Code invalide",
        description: "Le code promo doit contenir au moins 3 caractères",
        variant: "destructive",
      });
      return;
    }

    // Check if code already exists
    const { data: existing } = await (supabase as any)
      .from("promo_codes")
      .select("code")
      .eq("code", finalCode);

    if (existing && existing.length > 0) {
      toast({
        title: "Code existant",
        description: `Le code ${finalCode} existe déjà. Choisissez un autre nom.`,
        variant: "destructive",
      });
      return;
    }

    setIsCreating(true);
    try {
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + validityDays);

      const payload: any = {
        code: finalCode,
        discount_percentage: discountType === "percentage" ? discountValue : 0,
        discount_amount: discountType === "fixed_amount" ? discountValue : 0,
        discount_type: isFounderMode && discountType === "free_shipping" ? "percentage" : discountType,
        max_uses: maxUses,
        min_order_amount: isFounderMode ? 0 : minOrderAmount,
        target_user_email: targetType === "specific_user" && targetEmailOrPhone.includes("@") ? targetEmailOrPhone.trim().toLowerCase() : null,
        target_user_phone: targetType === "specific_user" && !targetEmailOrPhone.includes("@") ? targetEmailOrPhone.trim() : null,
        expires_at: expiresAt.toISOString(),
        created_by: session.user.id,
        shop_id: isFounderMode ? null : (shopId || null),
        is_active: true,
      };

      const { error } = await (supabase as any).from("promo_codes").insert(payload);

      if (error) throw error;

      toast({
        title: isFounderMode ? "👑 Code Promo Abonnement Créé !" : "🎉 Code Promo Articles Créé !",
        description: `Le code ${finalCode} est actif.`,
      });

      setCustomCode("");
      setTargetEmailOrPhone("");
      setUseCustomCode(false);
      loadPromoCodes();
    } catch (error: any) {
      console.error("Error creating promo code:", error);
      toast({
        title: "Erreur de création",
        description: error.message || "Impossible de créer le code promo",
        variant: "destructive",
      });
    } finally {
      setIsCreating(false);
    }
  };

  const copyToClipboard = (code: string) => {
    navigator.clipboard.writeText(code);
    toast({
      title: "Code copié !",
      description: `Le code ${code} a été copié dans votre presse-papier.`,
    });
  };

  const shareViaWhatsApp = (codeObj: PromoCode) => {
    const targetPhone = codeObj.target_user_phone ? codeObj.target_user_phone.replace(/[^\d]/g, "") : "";

    let msg = "";

    if (isFounderMode) {
      // Founder SaaS Subscription WhatsApp Message
      let discountDesc = "";
      if (codeObj.discount_type === "percentage" || codeObj.discount_percentage) {
        discountDesc = `-${codeObj.discount_percentage}% de réduction sur votre abonnement Ecomfy`;
      } else {
        discountDesc = `une remise exceptionnelle de ${(codeObj.discount_amount || 0).toLocaleString()} FCFA sur votre abonnement Ecomfy`;
      }

      msg = `Bonjour 👋 !\n\n👑 L'équipe Fondatrice d'*Ecomfy Cloud* est heureuse de vous offrir un code privilège sur la plateforme :\n\n🎟️ Code Promo : *${codeObj.code}*\n🎁 Bénéficiez de ${discountDesc} !\n\nActivez votre offre directement ici : https://ecomfy.cloud/subscription\n\nÀ très vite sur Ecomfy !`;
    } else {
      // Merchant E-Commerce Shop WhatsApp Message
      const brand = shopName || "Notre Boutique";
      const storeLink = shopSlug ? `https://${shopSlug}.ecomfy.cloud` : "https://ecomfy.cloud";

      let discountDesc = "";
      if (codeObj.discount_type === "percentage" || codeObj.discount_percentage) {
        discountDesc = `-${codeObj.discount_percentage}% de réduction`;
      } else if (codeObj.discount_type === "fixed_amount" || codeObj.discount_amount) {
        discountDesc = `une réduction de ${(codeObj.discount_amount || 0).toLocaleString()} FCFA`;
      } else {
        discountDesc = `la Livraison Gratuite`;
      }

      msg = `Bonjour 👋 !\n\n🎁 Toute l'équipe de *${brand}* vous offre un code promo exclusif sur nos produits : *${codeObj.code}* !\n\n🔥 Profitez de ${discountDesc} sur votre commande.\n\nCommandez vite ici : ${storeLink}\n\nÀ très vite !`;
    }

    const encoded = encodeURIComponent(msg);
    if (targetPhone) {
      window.open(`https://wa.me/${targetPhone}?text=${encoded}`, "_blank");
    } else {
      window.open(`https://wa.me/?text=${encoded}`, "_blank");
    }
  };

  const toggleCodeStatus = async (id: string, currentStatus: boolean) => {
    try {
      const { error } = await (supabase as any)
        .from("promo_codes")
        .update({ is_active: !currentStatus })
        .eq("id", id);

      if (error) throw error;

      toast({
        title: "Statut mis à jour",
        description: `Le code est maintenant ${!currentStatus ? "Actif" : "Désactivé"}`,
      });

      loadPromoCodes();
    } catch (error: any) {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    }
  };

  const deleteCode = async (id: string) => {
    try {
      const { error } = await (supabase as any).from("promo_codes").delete().eq("id", id);
      if (error) throw error;
      toast({ title: "Code supprimé", description: "Le code promo a été supprimé." });
      setPromoCodes(prev => prev.filter(c => c.id !== id));
    } catch (error: any) {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16 text-slate-500 font-inter">
        <Loader2 className="h-6 w-6 animate-spin text-[#0E7C66] mr-2" />
        <span>Chargement des codes promo {isFounderMode ? "abonnements" : "boutique"}...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6 font-inter text-slate-900">

      {/* Header Banner if Standalone Page */}
      {!isEmbedded && (
        <header className="border-b bg-slate-950 text-white p-4">
          <div className="max-w-6xl mx-auto flex items-center justify-between">
            <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="text-slate-400 hover:text-white">
              <ArrowLeft className="h-4 w-4 mr-2" /> Retour
            </Button>
            <span className="font-space font-bold text-sm">
              {isFounderMode ? "Codes Promo Abonnements SaaS Ecomfy (Fondateur)" : "Codes Promo Produits Boutique"}
            </span>
          </div>
        </header>
      )}

      <div className="max-w-5xl mx-auto space-y-6">

        {/* Title Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-space font-bold text-slate-900 flex items-center gap-2">
              {isFounderMode ? (
                <>
                  <Crown className="h-6 w-6 text-amber-500" />
                  <span>Gestion des Codes Promo Abonnements (Fondateur Ecomfy)</span>
                </>
              ) : (
                <>
                  <Tag className="h-6 w-6 text-[#0E7C66]" />
                  <span>Gestion des Codes Promo Articles & Produits</span>
                </>
              )}
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              {isFounderMode
                ? "Créez des réductions (10%, 20%, 50%...) applicables uniquement sur les abonnements SaaS Ecomfy (Pass VIP 35 000 FCFA, Formations, Crédits IA) et attribuez-les aux marchands."
                : "Générez des réductions sur les articles de votre boutique (pourcentage, montant fixe, livraison offerte) et partagez-les à vos clients."}
            </p>
          </div>

          <Button size="sm" variant="outline" onClick={loadPromoCodes} className="rounded-full text-xs font-bold gap-1.5 self-start sm:self-auto">
            <RefreshCw className="h-3.5 w-3.5" />
            <span>Actualiser</span>
          </Button>
        </div>

        {/* Presets Quick Bar (Tailored to Mode) */}
        <Card className={`rounded-3xl border-slate-200 shadow-sm p-5 space-y-3 text-white ${
          isFounderMode 
            ? "bg-gradient-to-r from-amber-950 via-slate-900 to-emerald-950"
            : "bg-gradient-to-r from-emerald-900 via-teal-900 to-slate-900"
        }`}>
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-amber-400" />
            <span className="text-xs font-bold uppercase tracking-wider font-space text-amber-200">
              {isFounderMode ? "Raccourcis Promos Abonnements Ecomfy" : "Modèles Promos Articles Boutique (1-Clic)"}
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {isFounderMode ? (
              <>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => applyPreset("pass_vip")}
                  className="rounded-2xl text-xs font-bold bg-white/10 hover:bg-white/20 text-white border border-white/20 justify-start gap-2"
                >
                  <span>👑 Pass VIP (-20%)</span>
                </Button>

                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => applyPreset("academy")}
                  className="rounded-2xl text-xs font-bold bg-white/10 hover:bg-white/20 text-white border border-white/20 justify-start gap-2"
                >
                  <span>🎓 Academy (-30%)</span>
                </Button>

                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => applyPreset("launch_50")}
                  className="rounded-2xl text-xs font-bold bg-white/10 hover:bg-white/20 text-white border border-white/20 justify-start gap-2"
                >
                  <span>⚡ Offre Fondateur (-50%)</span>
                </Button>

                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => applyPreset("fixed_10k")}
                  className="rounded-2xl text-xs font-bold bg-white/10 hover:bg-white/20 text-white border border-white/20 justify-start gap-2"
                >
                  <span>🎁 Réduction -10 000 FCFA</span>
                </Button>
              </>
            ) : (
              <>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => applyPreset("welcome")}
                  className="rounded-2xl text-xs font-bold bg-white/10 hover:bg-white/20 text-white border border-white/20 justify-start gap-2"
                >
                  <span>🚀 Bienvenue Client (-15%)</span>
                </Button>

                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => applyPreset("vip")}
                  className="rounded-2xl text-xs font-bold bg-white/10 hover:bg-white/20 text-white border border-white/20 justify-start gap-2"
                >
                  <span>👑 Fidélité VIP (-25%)</span>
                </Button>

                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => applyPreset("flash")}
                  className="rounded-2xl text-xs font-bold bg-white/10 hover:bg-white/20 text-white border border-white/20 justify-start gap-2"
                >
                  <span>⚡ Vente Flash (-50%)</span>
                </Button>

                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => applyPreset("freeship")}
                  className="rounded-2xl text-xs font-bold bg-white/10 hover:bg-white/20 text-white border border-white/20 justify-start gap-2"
                >
                  <span>🚚 Livraison Offerte</span>
                </Button>
              </>
            )}
          </div>
        </Card>

        {/* Create Code Card */}
        <Card className="rounded-3xl border-slate-200 shadow-md bg-white p-6 space-y-6">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <h3 className="font-space font-bold text-base text-slate-900 flex items-center gap-2">
              <Plus className="h-5 w-5 text-[#0E7C66]" />
              <span>
                {isFounderMode ? "Créer un Code Promo Abonnement Ecomfy" : "Créer un Code Promo Articles"}
              </span>
            </h3>

            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant={!useCustomCode ? "default" : "outline"}
                onClick={() => setUseCustomCode(false)}
                className={`rounded-full text-xs font-bold ${!useCustomCode ? "bg-[#0E7C66] text-white" : ""}`}
              >
                Générer Auto
              </Button>
              <Button
                size="sm"
                variant={useCustomCode ? "default" : "outline"}
                onClick={() => setUseCustomCode(true)}
                className={`rounded-full text-xs font-bold ${useCustomCode ? "bg-[#0E7C66] text-white" : ""}`}
              >
                Nom Personnalisé
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* Left Column: Code Name & Discount Type */}
            <div className="space-y-4">
              {useCustomCode ? (
                <div className="space-y-1">
                  <Label className="text-xs font-bold">Code Promo Personnalisé</Label>
                  <Input
                    placeholder={isFounderMode ? "Ex: ECOMFY-VIP20, FOUNDER50" : "Ex: WELCOME15, FLASH50"}
                    value={customCode}
                    onChange={(e) => setCustomCode(e.target.value)}
                    className="text-xs font-mono font-bold uppercase"
                  />
                </div>
              ) : (
                <div className="space-y-1">
                  <Label className="text-xs font-bold">Aperçu du Code Généré</Label>
                  <Input
                    value={isFounderMode ? "Génération Auto (ex: ECOMFY-9X2K)" : "Génération Auto (ex: PROMO-8X92K)"}
                    disabled
                    className="text-xs font-mono font-bold bg-slate-50 text-slate-500"
                  />
                </div>
              )}

              <div className="space-y-1">
                <Label className="text-xs font-bold">Type de Réduction</Label>
                <Select value={discountType} onValueChange={(v: any) => setDiscountType(v)}>
                  <SelectTrigger className="text-xs font-medium">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="percentage">Pourcentage (%)</SelectItem>
                    <SelectItem value="fixed_amount">Montant Fixe en FCFA sur l'Abonnement</SelectItem>
                    {!isFounderMode && (
                      <SelectItem value="free_shipping">🚚 Livraison Offerte (Articles Boutique)</SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>

              {discountType !== "free_shipping" && (
                <div className="space-y-2">
                  <Label className="text-xs font-bold">
                    {discountType === "percentage" ? "Valeur du Pourcentage (%)" : "Montant de la Réduction (FCFA)"}
                  </Label>
                  <Input
                    type="number"
                    min="1"
                    value={discountValue}
                    onChange={(e) => setDiscountValue(Number(e.target.value))}
                    className="text-xs font-bold"
                  />

                  {discountType === "percentage" && (
                    <div className="flex items-center gap-1.5 flex-wrap pt-1">
                      <span className="text-[10px] text-slate-400 font-semibold mr-1">Raccourcis :</span>
                      {[10, 15, 20, 25, 30, 40, 50].map((pct) => (
                        <button
                          key={pct}
                          type="button"
                          onClick={() => setDiscountValue(pct)}
                          className={`text-[11px] font-bold px-2.5 py-0.5 rounded-lg border transition-all ${
                            discountValue === pct
                              ? "bg-[#0E7C66] text-white border-[#0E7C66]"
                              : "bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200"
                          }`}
                        >
                          -{pct}%
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Right Column: Targeting & Quotas */}
            <div className="space-y-4">
              
              <div className="space-y-1">
                <Label className="text-xs font-bold">
                  {isFounderMode ? "Attachement & Ciblage Marchand Ecomfy" : "Attachement & Ciblage Client"}
                </Label>
                <Select value={targetType} onValueChange={(v: any) => setTargetType(v)}>
                  <SelectTrigger className="text-xs font-medium">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">
                      {isFounderMode ? "🌐 Tous les utilisateurs / marchands Ecomfy" : "🌐 Tous les acheteurs de la boutique"}
                    </SelectItem>
                    <SelectItem value="specific_user">
                      {isFounderMode ? "👤 Attribuer à un marchand spécifique (Email)" : "👤 Attribuer à un client spécifique (Email / Tél)"}
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {targetType === "specific_user" && (
                <div className="space-y-1">
                  <Label className="text-xs font-bold">
                    {isFounderMode ? "E-mail du Marchand Cible" : "E-mail ou Téléphone du Client Cible"}
                  </Label>
                  <Input
                    placeholder={isFounderMode ? "Ex: marchand@gmail.com" : "Ex: client@gmail.com ou +22507000000"}
                    value={targetEmailOrPhone}
                    onChange={(e) => setTargetEmailOrPhone(e.target.value)}
                    className="text-xs"
                  />
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs font-bold">Quota Utilisations Max</Label>
                  <Input
                    type="number"
                    min="1"
                    value={maxUses}
                    onChange={(e) => setMaxUses(Number(e.target.value))}
                    className="text-xs font-bold"
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-bold">Validité (Jours)</Label>
                  <Input
                    type="number"
                    min="1"
                    value={validityDays}
                    onChange={(e) => setValidityDays(Number(e.target.value))}
                    className="text-xs font-bold"
                  />
                </div>
              </div>

              {!isFounderMode && (
                <div className="space-y-1">
                  <Label className="text-xs font-bold">Montant Minimum de Commande (FCFA)</Label>
                  <Input
                    type="number"
                    min="0"
                    value={minOrderAmount}
                    onChange={(e) => setMinOrderAmount(Number(e.target.value))}
                    className="text-xs font-bold"
                  />
                </div>
              )}

            </div>

          </div>

          <Button
            onClick={createPromoCode}
            disabled={isCreating}
            className="w-full rounded-full bg-[#0E7C66] hover:bg-[#0A6352] text-white font-bold text-xs gap-2 py-3 shadow-lg"
          >
            {isCreating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            <span>
              {isFounderMode ? "Générer et Activer le Code Abonnement Ecomfy" : "Générer et Activer le Code Promo Articles"}
            </span>
          </Button>
        </Card>

        {/* Existing Promo Codes List */}
        <div className="space-y-4">
          <h3 className="font-space font-bold text-lg text-slate-900 flex items-center justify-between">
            <span>
              {isFounderMode ? "Codes Promo Abonnements Actifs" : "Codes Promo Articles Actifs"} ({promoCodes.length})
            </span>
          </h3>

          {promoCodes.length === 0 ? (
            <Card className="rounded-3xl border-slate-200 p-8 text-center text-slate-500">
              <Tag className="h-10 w-10 mx-auto text-slate-300 mb-2" />
              <p className="font-bold text-sm text-slate-700">Aucun code promo créé dans ce mode</p>
              <p className="text-xs text-slate-400 mt-1">Utilisez le formulaire ci-dessus pour générer votre premier code.</p>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {promoCodes.map((c) => {
                const isExpired = new Date(c.expires_at) < new Date();
                const isFull = c.current_uses >= c.max_uses;
                const isValid = c.is_active && !isExpired && !isFull;

                return (
                  <Card key={c.id} className="rounded-2xl border-slate-200 p-5 bg-white shadow-sm hover:shadow transition-all space-y-4 flex flex-col justify-between">
                    <div className="space-y-3">
                      
                      <div className="flex items-start justify-between gap-2">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="text-xl font-space font-extrabold text-slate-900 tracking-wider font-mono bg-slate-100 px-3 py-1 rounded-xl border border-slate-200">
                              {c.code}
                            </span>
                            <Button size="icon" variant="ghost" onClick={() => copyToClipboard(c.code)} className="h-8 w-8 text-slate-500 hover:text-slate-900">
                              <Copy className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>

                        <div className="flex items-center gap-1">
                          <Button
                            size="sm"
                            variant={c.is_active ? "outline" : "default"}
                            onClick={() => toggleCodeStatus(c.id, c.is_active)}
                            disabled={isExpired || isFull}
                            className="rounded-full text-[11px] font-bold h-7"
                          >
                            {c.is_active ? "Désactiver" : "Activer"}
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => deleteCode(c.id)}
                            className="h-7 w-7 text-slate-400 hover:text-rose-600"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>

                      {/* Badges Info */}
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {isValid ? (
                          <Badge className="bg-emerald-500 text-white border-0 text-[10px] font-bold">
                            <CheckCircle2 className="h-3 w-3 mr-1" /> Actif
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="text-[10px]">
                            <XCircle className="h-3 w-3 mr-1" />
                            {isExpired ? "Expiré" : isFull ? "Épuisé" : "Inactif"}
                          </Badge>
                        )}

                        <Badge className="bg-[#0E7C66]/10 text-[#0E7C66] border border-[#0E7C66]/30 text-[10px] font-bold">
                          {c.discount_type === "free_shipping"
                            ? "🚚 Livraison Offerte"
                            : c.discount_amount
                            ? `-${c.discount_amount.toLocaleString()} FCFA sur Abonnement`
                            : `-${c.discount_percentage}% sur Abonnement`}
                        </Badge>

                        <Badge variant="outline" className="text-[10px] text-slate-600">
                          <Users className="h-3 w-3 mr-1 text-slate-400" />
                          {c.current_uses}/{c.max_uses} utilisations
                        </Badge>
                      </div>

                      {/* Target Attachment Badge */}
                      <div className="text-xs text-slate-500">
                        {c.target_user_email ? (
                          <span className="inline-flex items-center gap-1 font-semibold text-purple-700 bg-purple-50 border border-purple-200 px-2 py-0.5 rounded-full text-[11px]">
                            <UserCheck className="h-3 w-3 text-purple-600" /> Attribué à : {c.target_user_email}
                          </span>
                        ) : c.target_user_phone ? (
                          <span className="inline-flex items-center gap-1 font-semibold text-purple-700 bg-purple-50 border border-purple-200 px-2 py-0.5 rounded-full text-[11px]">
                            <UserCheck className="h-3 w-3 text-purple-600" /> Attribué à : {c.target_user_phone}
                          </span>
                        ) : (
                          <span className="text-[11px] text-slate-400">
                            {isFounderMode ? "🌐 Public pour tous les marchands Ecomfy" : "🌐 Public pour tous les clients de la boutique"}
                          </span>
                        )}
                      </div>

                    </div>

                    {/* Card Actions Footer */}
                    <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-400">
                      <span className="text-[10px]">
                        Expire le {new Date(c.expires_at).toLocaleDateString("fr-FR")}
                      </span>

                      <Button
                        size="sm"
                        onClick={() => shareViaWhatsApp(c)}
                        className="rounded-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] gap-1.5 h-8 px-3 shadow-sm"
                      >
                        <MessageCircle className="h-3.5 w-3.5" />
                        <span>Partager WhatsApp</span>
                      </Button>
                    </div>

                  </Card>
                );
              })}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
