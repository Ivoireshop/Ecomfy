import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, CheckCircle2, CreditCard, Smartphone, LogOut, Receipt, Zap, Star, X, Check, Sparkles, TrendingUp, Users } from "lucide-react";
import { Session } from "@supabase/supabase-js";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface Subscription {
  id: string;
  status: string;
  amount: number;
  start_date: string | null;
  end_date: string | null;
}

const Subscription = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [session, setSession] = useState<Session | null>(null);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showMMModal, setShowMMModal] = useState(false);
  const [mmProvider, setMmProvider] = useState<string | null>(null);
  const [mmPhone, setMmPhone] = useState("");
  const [submittingMM, setSubmittingMM] = useState(false);
  const [promoCode, setPromoCode] = useState("");
  const [isValidatingPromo, setIsValidatingPromo] = useState(false);
  const [promoDiscount, setPromoDiscount] = useState(0);
  const [promoError, setPromoError] = useState("");
  const [isFounder, setIsFounder] = useState(false);
  const [testimonials, setTestimonials] = useState<any[]>([]);
  const [purchasedCredits, setPurchasedCredits] = useState(0);
  const [selectedPack, setSelectedPack] = useState<{size: number, price: number} | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (!session) {
        navigate("/auth");
      }
    });

    const { data: { subscription: authSubscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session);
        if (!session) {
          navigate("/auth");
        }
      }
    );

    return () => authSubscription.unsubscribe();
  }, [navigate]);

  useEffect(() => {
    if (session?.user) {
      checkFounderStatus();
      loadSubscription();
      loadTestimonials();
    }
  }, [session]);

  const loadTestimonials = async () => {
    try {
      const { data, error } = await supabase
        .from("feedback")
        .select("full_name, comment, rating, country, photo_url")
        .eq("status", "published")
        .gte("rating", 4)
        .order("created_at", { ascending: false })
        .limit(6);

      if (error) throw error;
      setTestimonials(data || []);
    } catch (error) {
      console.error("Error loading testimonials:", error);
    }
  };

  const checkFounderStatus = async () => {
    if (!session?.user?.id) return;

    try {
      const { data: roleData } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", session.user.id)
        // @ts-ignore - Role types will be updated after migration
        .in("role", ["founder", "co_founder"]);

      setIsFounder(roleData && roleData.length > 0);
    } catch (error) {
      console.error("Error checking founder status:", error);
    }
  };

  useEffect(() => {
    // Vérifier les paramètres de retour de paiement
    const urlParams = new URLSearchParams(window.location.search);
    const paymentStatus = urlParams.get("payment") || urlParams.get("status");

    if (paymentStatus === "success" || paymentStatus === "completed") {
      toast({
        title: "Paiement réussi ! 🎉",
        description: "Votre abonnement a été activé avec succès",
      });
      loadSubscription();
      // Rediriger vers l'accueil
      window.history.replaceState({}, "", "/");
      navigate("/");
    } else if (paymentStatus === "failed" || paymentStatus === "failure") {
      toast({
        title: "Paiement échoué",
        description: "Le paiement n'a pas pu être effectué. Veuillez réessayer.",
        variant: "destructive",
      });
      // Nettoyer l'URL
      window.history.replaceState({}, "", "/subscription");
    }
  }, []);

  const loadSubscription = async () => {
    try {
      const { data, error } = await supabase
        .from("subscriptions")
        .select("*")
        .eq("user_id", session?.user?.id)
        .single();

      if (error) throw error;
      setSubscription(data);

      // Load purchased credits
      const { data: profileData } = await supabase
        .from("profiles")
        .select("purchased_credits")
        .eq("id", session?.user?.id)
        .single();
      
      setPurchasedCredits(profileData?.purchased_credits || 0);
    } catch (error) {
      console.error("Erreur lors du chargement de l'abonnement:", error);
      toast({
        title: "Erreur",
        description: "Impossible de charger votre abonnement",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const validatePromoCode = async () => {
    if (!promoCode.trim()) {
      setPromoDiscount(0);
      setPromoError("");
      return;
    }

    setIsValidatingPromo(true);
    setPromoError("");

    try {
      // @ts-ignore - RPC types will be updated after migration
      const { data, error } = await supabase.rpc("validate_promo_code", {
        promo_code: promoCode.trim().toUpperCase(),
      });

      if (error) throw error;

      if (!data || !Array.isArray(data) || data.length === 0 || !data[0].is_valid) {
        setPromoError(data?.[0]?.message || "Code promo invalide");
        setPromoDiscount(0);
        return;
      }

      setPromoDiscount(data[0].discount_percentage);
      toast({
        title: "Code promo appliqué !",
        description: `Vous bénéficiez de ${data[0].discount_percentage}% de réduction`,
      });
    } catch (error) {
      console.error("Error validating promo code:", error);
      setPromoError("Erreur lors de la validation du code");
      setPromoDiscount(0);
    } finally {
      setIsValidatingPromo(false);
    }
  };

  const handlePayment = async (
    method: string,
    options?: { provider?: string; phone?: string }
  ) => {
    setIsProcessing(true);
    try {
      const amount = selectedPack ? selectedPack.price : 10000;
      const paymentType = selectedPack ? 'credits' : 'subscription';
      
      const { data, error } = await supabase.functions.invoke("process-payment", {
        body: {
          amount,
          payment_method: method,
          user_id: session?.user?.id,
          provider: options?.provider,
          phone: options?.phone,
          promo_code: promoCode.trim().toUpperCase() || undefined,
          payment_type: paymentType,
          credits_pack: selectedPack ? { size: selectedPack.size, price: selectedPack.price } : undefined,
        },
      });

      if (error) throw error;

      // Debug: log raw response for visibility
      console.log("process-payment response:", data);

      const paymentUrl = data?.payment_url || data?.url || data?.checkout_url || data?.link;
      if (paymentUrl && typeof paymentUrl === "string") {
        window.location.assign(paymentUrl);
        return;
      }

      console.error("Paiement: réponse inattendue", data);
      throw new Error("Impossible d'ouvrir la page de paiement. Veuillez réessayer.");
    } catch (error) {
      console.error("Erreur lors du paiement:", error);
      toast({
        title: "Erreur",
        description:
          error instanceof Error ? error.message : "Une erreur est survenue lors du paiement",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate("/");
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const isActive = subscription?.status === "active";

  const creditPacks = [
    { size: 5, price: 500, popular: false },
    { size: 10, price: 1000, popular: false },
    { size: 20, price: 2000, popular: false },
    { size: 30, price: 3000, popular: false },
    { size: 40, price: 4000, popular: false },
    { size: 50, price: 5000, popular: true, showcase: true },
  ];

  const comparisonFeatures = [
    { name: "Générations d'images", free: "3 / mois", pro: "Illimitées" },
    { name: "Générations de vidéos", free: "1 / mois", pro: "5 / mois" },
    { name: "Sites vitrine", free: "❌", pro: "Illimités" },
    { name: "Édition d'images IA", free: "❌", pro: "✅" },
    { name: "Tous les styles", free: "Limité", pro: "✅" },
    { name: "Formats multiples", free: "❌", pro: "✅" },
    { name: "Génération prioritaire", free: "❌", pro: "✅" },
    { name: "Support prioritaire", free: "❌", pro: "✅" },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-background to-primary/5">
      {/* Header */}
      <header className="border-b bg-background/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="text-2xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
            VisualPro
          </h1>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => navigate("/payment-history")}>
              <Receipt className="mr-2 h-4 w-4" />
              Historique
            </Button>
            {isActive && (
              <Button size="sm" onClick={() => navigate("/generator")}>
                Générateur
              </Button>
            )}
            <Button variant="ghost" size="sm" onClick={handleSignOut}>
              <LogOut className="mr-2 h-4 w-4" />
              Déconnexion
            </Button>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8 md:py-16">
        {/* Hero Section */}
        <div className="text-center mb-16 max-w-4xl mx-auto">
          <Badge className="mb-4" variant="secondary">
            <Sparkles className="w-3 h-3 mr-1" />
            Plateforme de création visuelle pour l'Afrique
          </Badge>
          
          <h1 className="text-4xl md:text-6xl font-bold mb-6 bg-gradient-to-r from-primary via-purple-600 to-secondary bg-clip-text text-transparent leading-tight">
            {isFounder
              ? "Accès Illimité Fondateur"
              : isActive 
              ? "Votre Abonnement Pro est Actif 🎉" 
              : "Créez des Visuels Pros en Quelques Secondes"}
          </h1>
          
          <p className="text-lg md:text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
            {isFounder
              ? "Vous avez un accès complet et illimité à toutes les fonctionnalités premium de VisualPro"
              : isActive 
              ? "Profitez de toutes les fonctionnalités premium pour développer votre présence en ligne" 
              : "Transformez vos idées en publicités professionnelles avec l'IA. Rejoignez des centaines d'entrepreneurs africains qui créent déjà."}
          </p>

          {/* Social Proof Stats */}
          {!isFounder && !isActive && (
            <div className="grid grid-cols-3 gap-4 md:gap-8 mb-8 max-w-2xl mx-auto">
              <div className="text-center">
                <div className="text-2xl md:text-3xl font-bold text-primary mb-1">500+</div>
                <div className="text-xs md:text-sm text-muted-foreground">Utilisateurs actifs</div>
              </div>
              <div className="text-center">
                <div className="text-2xl md:text-3xl font-bold text-primary mb-1">10k+</div>
                <div className="text-xs md:text-sm text-muted-foreground">Visuels créés</div>
              </div>
              <div className="text-center">
                <div className="text-2xl md:text-3xl font-bold text-primary mb-1">4.8/5</div>
                <div className="text-xs md:text-sm text-muted-foreground flex items-center justify-center gap-1">
                  <Star className="w-3 h-3 fill-primary text-primary" />
                  Satisfaction
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Status Card for Active Users */}
        {(isActive || isFounder) && (
          <Card className="mb-12 max-w-2xl mx-auto border-primary/20 shadow-lg">
            <CardHeader className="bg-gradient-to-r from-primary/10 to-secondary/10">
              <CardTitle className="flex items-center gap-2">
                <CheckCircle2 className="h-6 w-6 text-primary" />
                Statut de l'abonnement
                <Badge variant="default" className="ml-auto">
                  {isFounder ? "Accès Illimité" : "Pro Actif"}
                </Badge>
              </CardTitle>
              <CardDescription>
                {isFounder
                  ? "Accès complet à toutes les fonctionnalités sans limitation"
                  : `Votre abonnement est valide jusqu'au ${subscription?.end_date ? new Date(subscription.end_date).toLocaleDateString('fr-FR', { year: 'numeric', month: 'long', day: 'numeric' }) : "N/A"}`}
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="grid md:grid-cols-2 gap-4">
                <Button className="w-full" size="lg" onClick={() => navigate("/generator")}>
                  <Zap className="mr-2 h-5 w-5" />
                  Créer un visuel
                </Button>
                <Button variant="outline" className="w-full" size="lg" onClick={() => navigate("/showcase-manager")}>
                  <TrendingUp className="mr-2 h-5 w-5" />
                  Mes sites vitrine
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Credits display for non-subscribed users */}
        {!isActive && !isFounder && purchasedCredits > 0 && (
          <Card className="mb-12 max-w-2xl mx-auto border-primary/20 shadow-lg">
            <CardHeader className="bg-gradient-to-r from-purple-500/10 to-pink-500/10">
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="h-6 w-6 text-purple-600" />
                Vos Crédits
                <Badge variant="secondary" className="ml-auto text-lg">
                  {purchasedCredits} créations
                </Badge>
              </CardTitle>
              <CardDescription>
                Vous avez {purchasedCredits} créations d'images disponibles
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="grid md:grid-cols-2 gap-4">
                <Button className="w-full" size="lg" onClick={() => navigate("/generator")}>
                  <Zap className="mr-2 h-5 w-5" />
                  Créer un visuel
                </Button>
                {purchasedCredits >= 50 && (
                  <Button variant="outline" className="w-full" size="lg" onClick={() => navigate("/showcase-manager")}>
                    <TrendingUp className="mr-2 h-5 w-5" />
                    Créer un site vitrine
                  </Button>
                )}
              </div>
              {purchasedCredits < 50 && (
                <p className="text-sm text-muted-foreground text-center mt-4">
                  💡 Achetez le pack de 50 crédits (5000 FCFA) pour débloquer la création de sites vitrine
                </p>
              )}
            </CardContent>
          </Card>
        )}

        {/* Comparison Table for Non-Active Users */}
        {!isActive && !isFounder && (
          <>
            {/* Credit Packs Section */}
            <div className="mb-16 max-w-6xl mx-auto">
              <div className="text-center mb-8">
                <Badge className="mb-3" variant="secondary">
                  <Sparkles className="w-3 h-3 mr-1" />
                  Nouveau !
                </Badge>
                <h2 className="text-3xl md:text-4xl font-bold mb-3">Packs de Crédits à la Carte</h2>
                <p className="text-muted-foreground">
                  Achetez uniquement ce dont vous avez besoin, sans engagement
                </p>
              </div>

              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
                {creditPacks.map((pack) => (
                  <Card 
                    key={pack.size} 
                    className={`relative cursor-pointer transition-all hover:shadow-lg ${
                      selectedPack?.size === pack.size ? 'border-primary border-2' : ''
                    } ${pack.popular ? 'border-purple-500/50' : ''}`}
                    onClick={() => setSelectedPack(pack)}
                  >
                    {pack.popular && (
                      <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                        <Badge className="bg-gradient-to-r from-purple-500 to-pink-500">
                          ⭐ Recommandé
                        </Badge>
                      </div>
                    )}
                    <CardContent className="pt-6 pb-6">
                      <div className="text-center">
                        <div className="text-4xl font-bold text-primary mb-2">
                          {pack.size}
                        </div>
                        <div className="text-sm text-muted-foreground mb-4">créations d'images</div>
                        <div className="text-2xl font-bold mb-4">
                          {pack.price.toLocaleString()} FCFA
                        </div>
                        <div className="text-xs text-muted-foreground mb-4">
                          {Math.round(pack.price / pack.size)} FCFA / création
                        </div>
                        {pack.showcase && (
                          <Badge variant="secondary" className="mb-2">
                            🎨 Accès sites vitrine inclus
                          </Badge>
                        )}
                        <Button 
                          variant={selectedPack?.size === pack.size ? "default" : "outline"}
                          className="w-full"
                        >
                          {selectedPack?.size === pack.size ? "Sélectionné ✓" : "Choisir"}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {selectedPack && (
                <Card className="border-2 border-primary/20 shadow-xl">
                  <CardHeader className="bg-gradient-to-r from-primary/5 to-secondary/5">
                    <CardTitle className="text-xl flex items-center gap-2">
                      <CheckCircle2 className="h-5 w-5 text-primary" />
                      Pack sélectionné: {selectedPack.size} créations pour {selectedPack.price.toLocaleString()} FCFA
                    </CardTitle>
                    <CardDescription>
                      Procédez au paiement pour obtenir vos crédits immédiatement
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="pt-6">
                    <div className="grid gap-4 md:grid-cols-2 mb-4">
                      <Button
                        variant="outline"
                        className="h-auto py-6 flex flex-col items-center gap-2"
                        onClick={() => setShowMMModal(true)}
                        disabled={isProcessing}
                      >
                        <Smartphone className="h-8 w-8 text-primary" />
                        <span className="font-semibold">Mobile Money</span>
                        <span className="text-xs text-muted-foreground">
                          Orange, MTN, Moov, Wave
                        </span>
                      </Button>

                      <Button
                        variant="outline"
                        className="h-auto py-6 flex flex-col items-center gap-2"
                        onClick={() => handlePayment("card")}
                        disabled={isProcessing}
                      >
                        <CreditCard className="h-8 w-8 text-primary" />
                        <span className="font-semibold">Carte Bancaire</span>
                        <span className="text-xs text-muted-foreground">
                          Visa, Mastercard
                        </span>
                      </Button>
                    </div>
                    {isProcessing && (
                      <div className="text-center py-4 bg-primary/5 rounded-lg">
                        <Loader2 className="h-6 w-6 animate-spin mx-auto text-primary mb-2" />
                        <p className="text-sm font-medium">Redirection vers le paiement...</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}
            </div>

            <div className="text-center mb-12">
              <div className="inline-block px-6 py-3 bg-muted rounded-full">
                <span className="text-sm font-medium">OU</span>
              </div>
            </div>

            <div className="mb-16 max-w-5xl mx-auto">
              <div className="text-center mb-8">
                <h2 className="text-3xl md:text-4xl font-bold mb-3">Abonnement Mensuel Illimité</h2>
                <p className="text-muted-foreground">Pour une utilisation intensive sans limites</p>
              </div>

              <div className="grid md:grid-cols-2 gap-6">
                {/* Free Plan */}
                <Card className="relative overflow-hidden">
                  <CardHeader>
                    <CardTitle className="text-2xl">Gratuit</CardTitle>
                    <CardDescription>Pour découvrir la plateforme</CardDescription>
                    <div className="mt-4">
                      <span className="text-4xl font-bold">0 FCFA</span>
                      <span className="text-muted-foreground ml-2">/ mois</span>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-3">
                      {comparisonFeatures.map((feature, idx) => (
                        <li key={idx} className="flex items-center gap-3">
                          <div className="flex-shrink-0 w-5 h-5 rounded-full bg-muted flex items-center justify-center">
                            {feature.free === "❌" ? (
                              <X className="w-3 h-3 text-muted-foreground" />
                            ) : (
                              <Check className="w-3 h-3 text-muted-foreground" />
                            )}
                          </div>
                          <span className="text-sm flex-1">{feature.name}</span>
                          <span className="text-sm font-medium text-muted-foreground">{feature.free}</span>
                        </li>
                      ))}
                    </ul>
                    <Button variant="outline" className="w-full mt-6" disabled>
                      Plan actuel
                    </Button>
                  </CardContent>
                </Card>

                {/* Pro Plan */}
                <Card className="relative overflow-hidden border-primary shadow-xl">
                  <div className="absolute top-0 right-0 bg-gradient-to-l from-primary to-secondary text-primary-foreground px-4 py-1 text-sm font-semibold">
                    Le plus populaire ⭐
                  </div>
                  <CardHeader className="bg-gradient-to-br from-primary/5 to-secondary/5">
                    <CardTitle className="text-2xl text-primary">Pro</CardTitle>
                    <CardDescription>Pour les entrepreneurs sérieux</CardDescription>
                    <div className="mt-4">
                      {promoDiscount > 0 ? (
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-2xl font-bold line-through text-muted-foreground">10 000</span>
                            <Badge variant="default">-{promoDiscount}%</Badge>
                          </div>
                          <span className="text-4xl font-bold text-primary">
                            {Math.round(10000 * (1 - promoDiscount / 100)).toLocaleString()} FCFA
                          </span>
                        </div>
                      ) : (
                        <span className="text-4xl font-bold">10 000 FCFA</span>
                      )}
                      <span className="text-muted-foreground ml-2">/ mois</span>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-3">
                      {comparisonFeatures.map((feature, idx) => (
                        <li key={idx} className="flex items-center gap-3">
                          <div className="flex-shrink-0 w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center">
                            <Check className="w-3 h-3 text-primary" />
                          </div>
                          <span className="text-sm flex-1">{feature.name}</span>
                          <span className="text-sm font-bold text-primary">{feature.pro}</span>
                        </li>
                      ))}
                    </ul>
                    <Button className="w-full mt-6" size="lg" onClick={() => {
                      setSelectedPack(null); // Clear selected pack for subscription
                      const pricingSection = document.getElementById('pricing-section');
                      pricingSection?.scrollIntoView({ behavior: 'smooth' });
                    }}>
                      <Sparkles className="mr-2 h-4 w-4" />
                      Passer à Pro maintenant
                    </Button>
                  </CardContent>
                </Card>
              </div>
            </div>

            {/* Testimonials Section */}
            {testimonials.length > 0 && (
              <div className="mb-16 max-w-6xl mx-auto">
                <div className="text-center mb-8">
                  <Badge className="mb-3" variant="secondary">
                    <Users className="w-3 h-3 mr-1" />
                    Témoignages
                  </Badge>
                  <h2 className="text-3xl md:text-4xl font-bold mb-3">
                    Ce que disent nos utilisateurs
                  </h2>
                  <p className="text-muted-foreground">
                    Rejoignez des centaines d'entrepreneurs satisfaits
                  </p>
                </div>

                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {testimonials.slice(0, 6).map((testimonial, idx) => (
                    <Card key={idx} className="hover:shadow-lg transition-shadow">
                      <CardContent className="pt-6">
                        <div className="flex items-start gap-3 mb-4">
                          <Avatar className="w-12 h-12">
                            <AvatarImage src={testimonial.photo_url} />
                            <AvatarFallback className="bg-primary/10 text-primary">
                              {testimonial.full_name?.[0]?.toUpperCase() || "U"}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1">
                            <p className="font-semibold text-sm">
                              {testimonial.full_name || "Utilisateur"}
                            </p>
                            {testimonial.country && (
                              <p className="text-xs text-muted-foreground">{testimonial.country}</p>
                            )}
                            <div className="flex gap-1 mt-1">
                              {[...Array(testimonial.rating)].map((_, i) => (
                                <Star key={i} className="w-3 h-3 fill-primary text-primary" />
                              ))}
                            </div>
                          </div>
                        </div>
                        <p className="text-sm text-muted-foreground italic">
                          "{testimonial.comment}"
                        </p>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}

            {/* Pricing Section */}
            <div id="pricing-section" className="max-w-4xl mx-auto">
              <div className="text-center mb-8">
                <h3 className="text-2xl font-bold mb-2">Paiement de l'Abonnement Mensuel</h3>
                <p className="text-muted-foreground">Activez votre abonnement illimité maintenant</p>
              </div>
              {/* Promo Code */}
              <Card className="mb-8">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Sparkles className="h-5 w-5 text-primary" />
                    Code promo
                  </CardTitle>
                  <CardDescription>
                    Vous avez un code promo ? Bénéficiez d'une réduction immédiate
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex gap-2">
                    <Input
                      placeholder="Entrez votre code promo"
                      value={promoCode}
                      onChange={(e) => {
                        setPromoCode(e.target.value.toUpperCase());
                        setPromoError("");
                        setPromoDiscount(0);
                      }}
                      className={promoError ? "border-destructive" : ""}
                    />
                    <Button
                      onClick={validatePromoCode}
                      disabled={isValidatingPromo || !promoCode.trim()}
                      variant="outline"
                    >
                      {isValidatingPromo ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        "Appliquer"
                      )}
                    </Button>
                  </div>
                  {promoError && (
                    <p className="text-sm text-destructive mt-2">{promoError}</p>
                  )}
                  {promoDiscount > 0 && (
                    <div className="flex items-center gap-2 mt-2 p-3 bg-primary/10 rounded-lg">
                      <CheckCircle2 className="h-5 w-5 text-primary flex-shrink-0" />
                      <p className="text-sm text-primary font-medium">
                        Excellent ! Réduction de {promoDiscount}% appliquée - Économisez {Math.round(10000 * promoDiscount / 100).toLocaleString()} FCFA
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Payment Methods */}
              {!selectedPack && (
                <Card className="border-2 border-primary/20 shadow-xl">
                <CardHeader className="bg-gradient-to-r from-primary/5 to-secondary/5">
                  <CardTitle className="text-2xl">Choisissez votre méthode de paiement</CardTitle>
                  <CardDescription>
                    Paiement sécurisé - Activation immédiate après confirmation
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-6">
                  <div className="grid gap-4 md:grid-cols-2 mb-6">
                    <Button
                      variant="outline"
                      className="h-auto py-8 flex flex-col items-center gap-3 hover:border-primary hover:bg-primary/5 transition-all"
                      onClick={() => setShowMMModal(true)}
                      disabled={isProcessing}
                    >
                      <Smartphone className="h-10 w-10 text-primary" />
                      <div className="text-center">
                        <div className="font-semibold text-lg mb-1">Mobile Money</div>
                        <div className="text-xs text-muted-foreground">
                          Orange, MTN, Moov, Wave
                        </div>
                      </div>
                    </Button>

                    <Button
                      variant="outline"
                      className="h-auto py-8 flex flex-col items-center gap-3 hover:border-primary hover:bg-primary/5 transition-all"
                      onClick={() => handlePayment("card")}
                      disabled={isProcessing}
                    >
                      <CreditCard className="h-10 w-10 text-primary" />
                      <div className="text-center">
                        <div className="font-semibold text-lg mb-1">Carte Bancaire</div>
                        <div className="text-xs text-muted-foreground">
                          Visa, Mastercard
                        </div>
                      </div>
                    </Button>
                  </div>

                  {isProcessing && (
                    <div className="text-center py-8 bg-primary/5 rounded-lg">
                      <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary mb-3" />
                      <p className="text-sm font-medium">
                        Redirection vers le paiement sécurisé...
                      </p>
                    </div>
                  )}

                  {/* Trust badges */}
                  <div className="flex items-center justify-center gap-6 mt-6 pt-6 border-t text-xs text-muted-foreground">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-primary" />
                      Paiement sécurisé
                    </div>
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-primary" />
                      Activation instantanée
                    </div>
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-primary" />
                      Support 24/7
                    </div>
                  </div>
                </CardContent>
              </Card>
              )}
            </div>
          </>
        )}

        {/* Mobile Money Dialog */}
        <Dialog open={showMMModal} onOpenChange={setShowMMModal}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Paiement Mobile Money</DialogTitle>
              <DialogDescription>
                Sélectionnez votre réseau et entrez le numéro à débiter.
              </DialogDescription>
            </DialogHeader>

            <div className="grid grid-cols-2 gap-3">
              {[
                { key: "orange", label: "Orange" },
                { key: "mtn", label: "MTN" },
                { key: "moov", label: "Moov" },
                { key: "wave", label: "Wave" },
              ].map((p) => (
                <Button
                  key={p.key}
                  type="button"
                  variant={mmProvider === p.key ? "default" : "outline"}
                  onClick={() => setMmProvider(p.key)}
                >
                  {p.label}
                </Button>
              ))}
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Numéro de téléphone</label>
              <Input
                inputMode="numeric"
                placeholder="Ex: 0700000000"
                value={mmPhone}
                onChange={(e) => setMmPhone(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Le montant {promoDiscount > 0 
                  ? `de ${Math.round(10000 * (1 - promoDiscount / 100)).toLocaleString()} FCFA` 
                  : "de 10 000 FCFA"} sera débité après validation sur votre téléphone.
              </p>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowMMModal(false)}
              >
                Annuler
              </Button>
              <Button
                type="button"
                onClick={async () => {
                  // Validation minimale
                  if (!mmProvider) {
                    toast({
                      title: "Réseau requis",
                      description: "Veuillez sélectionner un réseau.",
                      variant: "destructive",
                    });
                    return;
                  }
                  const digits = mmPhone.replace(/\D/g, "");
                  if (digits.length < 8 || digits.length > 14) {
                    toast({
                      title: "Numéro invalide",
                      description: "Veuillez entrer un numéro valide (8 à 14 chiffres).",
                      variant: "destructive",
                    });
                    return;
                  }
                  setSubmittingMM(true);
                  try {
                    await handlePayment("mobile_money", {
                      provider: mmProvider,
                      phone: digits,
                    });
                  } finally {
                    setSubmittingMM(false);
                    setShowMMModal(false);
                  }
                }}
                disabled={submittingMM}
              >
                {submittingMM ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Redirection...
                  </>
                ) : (
                  "Continuer"
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
};

export default Subscription;