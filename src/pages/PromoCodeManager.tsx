import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Plus, Copy, CheckCircle2, XCircle, ArrowLeft, Percent, Users, Calendar } from "lucide-react";
import { Session } from "@supabase/supabase-js";

interface PromoCode {
  id: string;
  code: string;
  discount_percentage: number;
  max_uses: number;
  current_uses: number;
  expires_at: string;
  created_at: string;
  is_active: boolean;
}

const PromoCodeManager = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [promoCodes, setPromoCodes] = useState<PromoCode[]>([]);
  const [discountPercentage, setDiscountPercentage] = useState(20);
  const [maxUses, setMaxUses] = useState(20);
  const [isFounder, setIsFounder] = useState(false);
  const [customCode, setCustomCode] = useState("");
  const [useCustomCode, setUseCustomCode] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (!session) {
        navigate("/auth");
      } else {
        checkFounderRole(session.user.id);
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

  const checkFounderRole = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId)
        // @ts-ignore - Role types will be updated after migration
        .in("role", ["founder", "co_founder"]);

      if (error) throw error;

      if (!data || data.length === 0) {
        toast({
          title: "Accès refusé",
          description: "Seuls les fondateurs peuvent gérer les codes promo",
          variant: "destructive",
        });
        navigate("/");
        return;
      }

      setIsFounder(true);
      loadPromoCodes();
    } catch (error) {
      console.error("Error checking founder role:", error);
      navigate("/");
    }
  };

  const loadPromoCodes = async () => {
    try {
      // @ts-ignore - Table types will be updated after migration
      const { data, error } = await (supabase as any)
        .from("promo_codes")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      // @ts-ignore - Type will be available after migration
      setPromoCodes(data || []);
    } catch (error) {
      console.error("Error loading promo codes:", error);
      toast({
        title: "Erreur",
        description: "Impossible de charger les codes promo",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const generateCode = () => {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let code = "";
    for (let i = 0; i < 8; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  };

  const createPromoCode = async () => {
    if (!session?.user?.id) return;

    // Validate custom code if using custom
    if (useCustomCode) {
      if (!customCode || customCode.trim().length < 4) {
        toast({
          title: "Code invalide",
          description: "Le code personnalisé doit contenir au moins 4 caractères",
          variant: "destructive",
        });
        return;
      }
      
      // Check if code already exists
      const { data: existing } = await (supabase as any)
        .from("promo_codes")
        .select("code")
        .eq("code", customCode.toUpperCase().trim());
      
      if (existing && existing.length > 0) {
        toast({
          title: "Code existant",
          description: "Ce code promo existe déjà. Veuillez en choisir un autre.",
          variant: "destructive",
        });
        return;
      }
    }

    setIsCreating(true);
    try {
      const code = useCustomCode ? customCode.toUpperCase().trim() : generateCode();
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 48); // 48 hours from now

      // @ts-ignore - Table types will be updated after migration
      const { error } = await (supabase as any)
        .from("promo_codes")
        .insert({
          code,
          discount_percentage: discountPercentage,
          max_uses: maxUses,
          expires_at: expiresAt.toISOString(),
          created_by: session.user.id,
        });

      if (error) throw error;

      toast({
        title: "Code promo créé !",
        description: `Le code ${code} a été créé avec succès`,
      });

      setCustomCode("");
      loadPromoCodes();
    } catch (error) {
      console.error("Error creating promo code:", error);
      toast({
        title: "Erreur",
        description: "Impossible de créer le code promo",
        variant: "destructive",
      });
    } finally {
      setIsCreating(false);
    }
  };

  const copyToClipboard = (code: string) => {
    navigator.clipboard.writeText(code);
    toast({
      title: "Copié !",
      description: `Le code ${code} a été copié dans le presse-papiers`,
    });
  };

  const toggleCodeStatus = async (id: string, currentStatus: boolean) => {
    try {
      // @ts-ignore - Table types will be updated after migration
      const { error } = await (supabase as any)
        .from("promo_codes")
        .update({ is_active: !currentStatus })
        .eq("id", id);

      if (error) throw error;

      toast({
        title: "Statut mis à jour",
        description: `Le code a été ${!currentStatus ? "activé" : "désactivé"}`,
      });

      loadPromoCodes();
    } catch (error) {
      console.error("Error updating code status:", error);
      toast({
        title: "Erreur",
        description: "Impossible de mettre à jour le statut",
        variant: "destructive",
      });
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isFounder) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="container mx-auto px-4 py-4">
          <Button variant="ghost" onClick={() => navigate("/")}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Retour
          </Button>
        </div>
      </header>

      <div className="container mx-auto px-4 py-12">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <h1 className="text-4xl font-bold mb-4">Gestion des Codes Promo</h1>
            <p className="text-lg text-muted-foreground">
              Créez et gérez les codes promotionnels pour vos utilisateurs
            </p>
          </div>

          {/* Create New Code */}
          <Card className="mb-8">
            <CardHeader>
              <CardTitle>Créer un nouveau code promo</CardTitle>
              <CardDescription>
                Le code sera valide pendant 48 heures après sa création
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center gap-4 mb-4">
                  <Button
                    variant={!useCustomCode ? "default" : "outline"}
                    onClick={() => setUseCustomCode(false)}
                    className="flex-1"
                  >
                    Générer automatiquement
                  </Button>
                  <Button
                    variant={useCustomCode ? "default" : "outline"}
                    onClick={() => setUseCustomCode(true)}
                    className="flex-1"
                  >
                    Code personnalisé
                  </Button>
                </div>

                {useCustomCode && (
                  <div className="space-y-2">
                    <Label htmlFor="customCode">Code personnalisé</Label>
                    <Input
                      id="customCode"
                      type="text"
                      placeholder="Ex: PROMO2025"
                      value={customCode}
                      onChange={(e) => setCustomCode(e.target.value)}
                      maxLength={20}
                    />
                    <p className="text-xs text-muted-foreground">Minimum 4 caractères, maximum 20</p>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="discount">Réduction (%)</Label>
                    <Input
                      id="discount"
                      type="number"
                      min="20"
                      max="50"
                      value={discountPercentage}
                      onChange={(e) => setDiscountPercentage(Number(e.target.value))}
                    />
                    <p className="text-xs text-muted-foreground">Entre 20% et 50%</p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="maxUses">Utilisations max</Label>
                    <Input
                      id="maxUses"
                      type="number"
                      min="1"
                      max="20"
                      value={maxUses}
                      onChange={(e) => setMaxUses(Number(e.target.value))}
                    />
                    <p className="text-xs text-muted-foreground">Maximum 20 personnes</p>
                  </div>
                </div>
                <Button onClick={createPromoCode} disabled={isCreating} className="w-full">
                  {isCreating ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Création...
                    </>
                  ) : (
                    <>
                      <Plus className="mr-2 h-4 w-4" />
                      {useCustomCode ? "Créer le code personnalisé" : "Générer un code promo"}
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Promo Codes List */}
          <Card>
            <CardHeader>
              <CardTitle>Codes promo existants</CardTitle>
              <CardDescription>
                {promoCodes.length} code{promoCodes.length !== 1 ? "s" : ""} créé{promoCodes.length !== 1 ? "s" : ""}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {promoCodes.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  Aucun code promo créé pour le moment
                </p>
              ) : (
                <div className="space-y-4">
                  {promoCodes.map((code) => {
                    const isExpired = new Date(code.expires_at) < new Date();
                    const isFull = code.current_uses >= code.max_uses;
                    const isValid = code.is_active && !isExpired && !isFull;

                    return (
                      <div
                        key={code.id}
                        className="border rounded-lg p-4 space-y-3"
                      >
                        <div className="flex items-start justify-between">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="text-2xl font-bold font-mono">{code.code}</span>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => copyToClipboard(code.code)}
                              >
                                <Copy className="h-4 w-4" />
                              </Button>
                            </div>
                            <div className="flex items-center gap-2 flex-wrap">
                              {isValid ? (
                                <Badge variant="default">
                                  <CheckCircle2 className="mr-1 h-3 w-3" />
                                  Actif
                                </Badge>
                              ) : (
                                <Badge variant="secondary">
                                  <XCircle className="mr-1 h-3 w-3" />
                                  {isExpired ? "Expiré" : isFull ? "Épuisé" : "Inactif"}
                                </Badge>
                              )}
                              <Badge variant="outline">
                                <Percent className="mr-1 h-3 w-3" />
                                -{code.discount_percentage}%
                              </Badge>
                              <Badge variant="outline">
                                <Users className="mr-1 h-3 w-3" />
                                {code.current_uses}/{code.max_uses}
                              </Badge>
                              <Badge variant="outline">
                                <Calendar className="mr-1 h-3 w-3" />
                                Expire le {new Date(code.expires_at).toLocaleDateString("fr-FR", {
                                  day: "2-digit",
                                  month: "2-digit",
                                  year: "numeric",
                                  hour: "2-digit",
                                  minute: "2-digit"
                                })}
                              </Badge>
                            </div>
                          </div>
                          <Button
                            variant={code.is_active ? "destructive" : "default"}
                            size="sm"
                            onClick={() => toggleCodeStatus(code.id, code.is_active)}
                            disabled={isExpired || isFull}
                          >
                            {code.is_active ? "Désactiver" : "Activer"}
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default PromoCodeManager;
