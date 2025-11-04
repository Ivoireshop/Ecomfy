import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sparkles, Loader2, LogOut } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Alert, AlertDescription } from "@/components/ui/alert";

const Generator = () => {
  const navigate = useNavigate();
  const [productName, setProductName] = useState("");
  const [niche, setNiche] = useState("");
  const [description, setDescription] = useState("");
  const [benefits, setBenefits] = useState("");
  const [container, setContainer] = useState("");
  const [platform, setPlatform] = useState("");
  const [style, setStyle] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [freeGenerationsRemaining, setFreeGenerationsRemaining] = useState<number | null>(null);
  const [hasActiveSubscription, setHasActiveSubscription] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    loadUserGenerationStatus();
  }, []);

  const loadUserGenerationStatus = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Check subscription
      const { data: subData } = await supabase
        .from("subscriptions")
        .select("status")
        .eq("user_id", user.id)
        .single();

      const hasActiveSub = subData?.status === "active";
      setHasActiveSubscription(hasActiveSub);

      // Check free generations
      const { data: profileData } = await supabase
        .from("profiles")
        .select("free_generations_remaining")
        .eq("id", user.id)
        .single();

      setFreeGenerationsRemaining(profileData?.free_generations_remaining || 0);
    } catch (error) {
      console.error("Error loading generation status:", error);
    }
  };

  const handleSignOut = async () => {
    try {
      await supabase.auth.signOut();
      navigate("/");
      toast({
        title: "Déconnecté",
        description: "Vous avez été déconnecté avec succès.",
      });
    } catch (error) {
      console.error("Erreur lors de la déconnexion:", error);
      toast({
        title: "Erreur",
        description: "Une erreur est survenue lors de la déconnexion",
        variant: "destructive",
      });
    }
  };

  const handleGenerate = async () => {
    if (!productName || !niche || !description || !platform) {
      toast({
        title: "Champs manquants",
        description: "Veuillez remplir tous les champs obligatoires",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    setGeneratedImage(null);

    try {
      const { data, error } = await supabase.functions.invoke("generate-ad-visual", {
        body: {
          productName,
          niche,
          description,
          benefits,
          container,
          platform,
          style,
        },
      });

      if (error) throw error;

      if (data.error) {
        throw new Error(data.error);
      }

      setGeneratedImage(data.imageUrl);
      
      // Update free generations count
      await loadUserGenerationStatus();
      
      // Check if user should be redirected to subscription
      if (!hasActiveSubscription && data.freeGenerationsRemaining !== undefined) {
        if (data.freeGenerationsRemaining <= 0) {
          toast({
            title: "Essai gratuit terminé",
            description: "Vous avez utilisé toutes vos générations gratuites. Souscrivez maintenant pour continuer !",
            variant: "destructive",
          });
          setTimeout(() => navigate("/subscription"), 2000);
          return;
        }
      }
      
      toast({
        title: "Succès !",
        description: "Votre visuel a été généré avec succès",
      });
    } catch (error) {
      console.error("Erreur lors de la génération:", error);
      toast({
        title: "Erreur",
        description: error instanceof Error ? error.message : "Une erreur est survenue lors de la génération",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="text-2xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
            VisualPro
          </h1>
          <Button variant="outline" onClick={handleSignOut}>
            <LogOut className="mr-2 h-4 w-4" />
            Déconnexion
          </Button>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <h1 className="text-4xl md:text-5xl font-bold mb-4">
              Créez votre visuel publicitaire
            </h1>
            <p className="text-lg text-muted-foreground">
              Remplissez le formulaire et laissez l'IA créer un visuel professionnel pour vous
            </p>
            
            {!hasActiveSubscription && freeGenerationsRemaining !== null && (
              <Alert className="mt-4 max-w-2xl mx-auto">
                <AlertDescription className="text-center">
                  {freeGenerationsRemaining > 0 ? (
                    <>
                      🎁 <strong>Essai gratuit :</strong> Il vous reste <strong>{freeGenerationsRemaining}</strong> génération{freeGenerationsRemaining > 1 ? 's' : ''} gratuite{freeGenerationsRemaining > 1 ? 's' : ''}
                    </>
                  ) : (
                    <>
                      ⚠️ Vous avez utilisé toutes vos générations gratuites. <Button variant="link" className="p-0 h-auto" onClick={() => navigate("/subscription")}>Souscrire maintenant</Button>
                    </>
                  )}
                </AlertDescription>
              </Alert>
            )}
          </div>

          <div className="bg-card rounded-xl shadow-lg p-8 border">
            <form className="space-y-6" onSubmit={(e) => { e.preventDefault(); handleGenerate(); }}>
              <div className="space-y-2">
                <Label htmlFor="productName">Nom du produit *</Label>
                <Input
                  id="productName"
                  placeholder="Ex: Crème Éclat Naturel"
                  value={productName}
                  onChange={(e) => setProductName(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="niche">Niche du produit *</Label>
                <Select value={niche} onValueChange={setNiche}>
                  <SelectTrigger>
                    <SelectValue placeholder="Sélectionnez une niche" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="beaute">Beauté & Cosmétiques</SelectItem>
                    <SelectItem value="mode">Mode & Accessoires</SelectItem>
                    <SelectItem value="alimentation">Alimentation & Boissons</SelectItem>
                    <SelectItem value="tech">Technologie & Électronique</SelectItem>
                    <SelectItem value="sante">Santé & Bien-être</SelectItem>
                    <SelectItem value="maison">Maison & Décoration</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description du produit *</Label>
                <Textarea
                  id="description"
                  placeholder="Décrivez votre produit en quelques mots..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={4}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="benefits">Avantages / Bienfaits</Label>
                <Textarea
                  id="benefits"
                  placeholder="Quels sont les principaux bénéfices de votre produit ?"
                  value={benefits}
                  onChange={(e) => setBenefits(e.target.value)}
                  rows={3}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="container">Type de contenant</Label>
                <Input
                  id="container"
                  placeholder="Ex: Pot, Flacon, Bouteille, Sachet..."
                  value={container}
                  onChange={(e) => setContainer(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="platform">Plateforme cible *</Label>
                <Select value={platform} onValueChange={setPlatform}>
                  <SelectTrigger>
                    <SelectValue placeholder="Sélectionnez une plateforme" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="facebook">Facebook</SelectItem>
                    <SelectItem value="instagram">Instagram</SelectItem>
                    <SelectItem value="tiktok">TikTok</SelectItem>
                    <SelectItem value="all">Toutes les plateformes</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="style">Style du visuel</Label>
                <Select value={style} onValueChange={setStyle}>
                  <SelectTrigger>
                    <SelectValue placeholder="Sélectionnez un style" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="moderne">Moderne</SelectItem>
                    <SelectItem value="luxueux">Luxueux</SelectItem>
                    <SelectItem value="humoristique">Humoristique</SelectItem>
                    <SelectItem value="traditionnel">Traditionnel Africain</SelectItem>
                    <SelectItem value="minimaliste">Minimaliste</SelectItem>
                    <SelectItem value="dynamique">Dynamique</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Button
                type="submit"
                className="w-full text-lg py-6"
                size="lg"
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Génération en cours...
                  </>
                ) : (
                  <>
                    <Sparkles className="mr-2 h-5 w-5" />
                    Générer mon visuel
                  </>
                )}
              </Button>
            </form>

            {generatedImage && (
              <div className="mt-8">
                <h2 className="text-2xl font-bold mb-4 text-center">Votre visuel généré</h2>
                <div className="relative rounded-lg overflow-hidden shadow-xl">
                  <img 
                    src={generatedImage} 
                    alt="Visuel publicitaire généré" 
                    className="w-full h-auto"
                  />
                </div>
                <div className="mt-4 flex gap-4">
                  <Button
                    onClick={() => {
                      const link = document.createElement("a");
                      link.href = generatedImage;
                      link.download = `${productName.replace(/\s+/g, "-")}-ad.png`;
                      link.click();
                    }}
                    className="flex-1"
                  >
                    Télécharger
                  </Button>
                  <Button
                    onClick={() => setGeneratedImage(null)}
                    variant="outline"
                    className="flex-1"
                  >
                    Générer un autre visuel
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Generator;
