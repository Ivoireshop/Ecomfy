import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, CheckCircle2, CreditCard, Smartphone, LogOut, Receipt } from "lucide-react";
import { Session } from "@supabase/supabase-js";

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
    }
  }, [session]);

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
      const { data, error } = await supabase.functions.invoke("process-payment", {
        body: {
          amount: 10000,
          payment_method: method,
          user_id: session?.user?.id,
          provider: options?.provider,
          phone: options?.phone,
          promo_code: promoCode.trim().toUpperCase() || undefined,
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

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="text-2xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
            VisualPro
          </h1>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => navigate("/payment-history")}>
              <Receipt className="mr-2 h-4 w-4" />
              Historique
            </Button>
            {isActive && (
              <Button onClick={() => navigate("/generator")}>
                Accéder au générateur
              </Button>
            )}
            <Button variant="outline" onClick={handleSignOut}>
              <LogOut className="mr-2 h-4 w-4" />
              Déconnexion
            </Button>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-12">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <h1 className="text-4xl font-bold mb-4">Votre Abonnement</h1>
            <p className="text-lg text-muted-foreground">
              {isFounder
                ? "Vous avez un accès illimité à toutes les fonctionnalités de VisualPro"
                : isActive 
                ? "Votre abonnement est actif" 
                : "Activez votre abonnement pour créer des visuels et sites vitrine"}
            </p>
          </div>

          {/* Statut actuel */}
          <Card className="mb-8">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                Statut
                {(isActive || isFounder) && (
                  <Badge variant="default" className="ml-2">
                    <CheckCircle2 className="mr-1 h-3 w-3" />
                    {isFounder ? "Accès Illimité" : "Actif"}
                  </Badge>
                )}
                {!isActive && !isFounder && (
                  <Badge variant="secondary">Inactif</Badge>
                )}
              </CardTitle>
              <CardDescription>
                {isFounder
                  ? "Accès illimité à toutes les fonctionnalités de VisualPro"
                  : isActive 
                  ? `Valide jusqu'au ${subscription?.end_date ? new Date(subscription.end_date).toLocaleDateString() : "N/A"}`
                  : "Aucun abonnement actif"}
              </CardDescription>
            </CardHeader>
          </Card>

          {/* Plan d'abonnement */}
          {!isFounder && (
            <Card className="mb-8">
              <CardHeader>
                <CardTitle>Plan Pro</CardTitle>
                <CardDescription>Accès complet à la génération de visuels et création de sites vitrine</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      {promoDiscount > 0 ? (
                        <>
                          <div className="flex items-center gap-2">
                            <span className="text-xl font-bold line-through text-muted-foreground">10 000 FCFA</span>
                            <Badge variant="default" className="text-sm">-{promoDiscount}%</Badge>
                          </div>
                          <span className="text-3xl font-bold text-primary">
                            {Math.round(10000 * (1 - promoDiscount / 100)).toLocaleString()} FCFA
                          </span>
                        </>
                      ) : (
                        <span className="text-3xl font-bold">10 000 FCFA</span>
                      )}
                    </div>
                    <span className="text-muted-foreground">/ mois</span>
                  </div>
                  <ul className="space-y-2">
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="h-5 w-5 text-primary" />
                      <span>Génération illimitée de visuels</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="h-5 w-5 text-primary" />
                      <span>Création de sites vitrine professionnels</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="h-5 w-5 text-primary" />
                      <span>Édition d'images avec IA</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="h-5 w-5 text-primary" />
                      <span>Tous les styles disponibles</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="h-5 w-5 text-primary" />
                      <span>Support prioritaire</span>
                    </li>
                  </ul>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Promo Code Section */}
          {!isActive && !isFounder && (
            <Card className="mb-8">
              <CardHeader>
                <CardTitle>Code promo</CardTitle>
                <CardDescription>
                  Vous avez un code promo ? Entrez-le pour bénéficier d'une réduction
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
                  <div className="flex items-center gap-2 mt-2">
                    <CheckCircle2 className="h-4 w-4 text-primary" />
                    <p className="text-sm text-primary font-medium">
                      Réduction de {promoDiscount}% appliquée !
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Méthodes de paiement */}
          {!isActive && !isFounder && (
            <Card>
              <CardHeader>
                <CardTitle>Choisissez votre méthode de paiement</CardTitle>
                <CardDescription>
                  Sélectionnez le moyen de paiement de votre choix
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 md:grid-cols-2">
                  <Button
                    variant="outline"
                    className="h-auto py-6 flex flex-col items-center gap-2"
                    onClick={() => setShowMMModal(true)}
                    disabled={isProcessing}
                  >
                    <Smartphone className="h-8 w-8" />
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
                    <CreditCard className="h-8 w-8" />
                    <span className="font-semibold">Carte Bancaire</span>
                    <span className="text-xs text-muted-foreground">
                      Visa, Mastercard
                    </span>
                  </Button>
                </div>

                {isProcessing && (
                  <div className="mt-4 text-center">
                    <Loader2 className="h-6 w-6 animate-spin mx-auto text-primary" />
                    <p className="text-sm text-muted-foreground mt-2">
                      Redirection vers le paiement...
                    </p>
                  </div>
                )}

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
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
};

export default Subscription;