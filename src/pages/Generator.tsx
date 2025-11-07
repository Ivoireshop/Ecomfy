import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sparkles, Loader2, Video } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ImageEditor } from "@/components/ImageEditor";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const Generator = () => {
  const navigate = useNavigate();
  const [productName, setProductName] = useState("");
  const [niche, setNiche] = useState("");
  const [description, setDescription] = useState("");
  const [benefits, setBenefits] = useState("");
  const [container, setContainer] = useState("");
  const [platform, setPlatform] = useState("");
  const [style, setStyle] = useState("");
  const [price, setPrice] = useState("");
  const [promotionalPrice, setPromotionalPrice] = useState("");
  const [posology, setPosology] = useState("");
  const [productImage, setProductImage] = useState<string | null>(null);
  const [personDescription, setPersonDescription] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [freeGenerationsRemaining, setFreeGenerationsRemaining] = useState<number | null>(null);
  const [hasActiveSubscription, setHasActiveSubscription] = useState(false);
  const [videoGenerationsRemaining, setVideoGenerationsRemaining] = useState<number>(5);
  const [isGeneratingVideo, setIsGeneratingVideo] = useState(false);
  const [generationType, setGenerationType] = useState<"image" | "video">("image");
  const [isTouchUI, setIsTouchUI] = useState(false);
  const [isFounder, setIsFounder] = useState(false);
  const [videoDuration, setVideoDuration] = useState<10 | 15>(10);
  
  useEffect(() => {
    const check = () => {
      const hasTouch = ("ontouchstart" in window) || (navigator.maxTouchPoints ?? 0) > 0;
      setIsTouchUI(hasTouch || window.innerWidth <= 1024);
    };
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);
  const { toast } = useToast();

  useEffect(() => {
    loadUserGenerationStatus();
  }, []);

  const loadUserGenerationStatus = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Check founder/co-founder role (unlimited access)
      const { data: roleData } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        // @ts-ignore enum differences
        .in("role", ["founder", "co_founder"]);

      const isFounderOrCo = Array.isArray(roleData) && roleData.length > 0;
      setIsFounder(isFounderOrCo);

      if (isFounderOrCo) {
        setHasActiveSubscription(true); // unlock all features in UI
        setVideoGenerationsRemaining(999999);
        setFreeGenerationsRemaining(999999);
        return;
      }

      // Check subscription (regular users)
      const { data: subData } = await supabase
        .from("subscriptions")
        .select("status, video_generations_remaining")
        .eq("user_id", user.id)
        .single();

      const hasActiveSub = subData?.status === "active";
      setHasActiveSubscription(hasActiveSub);
      setVideoGenerationsRemaining(subData?.video_generations_remaining || 0);

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

  const handleGenerateVideo = async () => {
    if (!productName || !niche || !description || !platform || !price) {
      toast({
        title: "Champs manquants",
        description: "Veuillez remplir tous les champs obligatoires",
        variant: "destructive",
      });
      return;
    }

    if (!hasActiveSubscription) {
      toast({
        title: "Abonnement requis",
        description: "La génération de vidéos nécessite un abonnement actif",
        variant: "destructive",
      });
      navigate("/subscription");
      return;
    }

    setIsGeneratingVideo(true);

    try {
      // Verify user is authenticated before calling function
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError || !session) {
        toast({
          title: "Session expirée",
          description: "Veuillez vous reconnecter pour continuer",
          variant: "destructive",
        });
        navigate("/auth");
        return;
      }
      const { data, error } = await supabase.functions.invoke("generate-video", {
        body: {
          productName,
          niche,
          description,
          benefits,
          platform,
          style,
          price,
          personDescription,
          duration: videoDuration,
        },
      });

      if (error) throw error;
      if (data?.error) {
        const msg = data.details ? `${data.error}: ${data.details}` : data.error;
        throw new Error(msg);
      }

      setVideoGenerationsRemaining(data.videoGenerationsRemaining || 0);

      toast({
        title: "Vidéo en cours de génération",
        description: "Votre vidéo sera disponible dans quelques minutes dans la bibliothèque",
      });

      setTimeout(() => navigate("/library"), 2000);
    } catch (error) {
      console.error("Erreur lors de la génération vidéo:", error);
      toast({
        title: "Erreur",
        description: error instanceof Error ? error.message : "Une erreur est survenue",
        variant: "destructive",
      });
    } finally {
      setIsGeneratingVideo(false);
    }
  };

  const handleGenerate = async () => {
    if (!productName || !niche || !description || !platform || !price) {
      toast({
        title: "Champs manquants",
        description: "Veuillez remplir tous les champs obligatoires (nom, niche, description, plateforme, prix)",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    setGeneratedImage(null);

    try {
      // Appel rapide (20s max) au service principal, sinon fallback
      const timeout = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("timeout")), 20000)
      );

      const invokePromise = supabase.functions.invoke("generate-ad-visual", {
        body: {
          productName,
          niche,
          description,
          benefits,
          container,
          platform,
          style,
          price,
          promotionalPrice,
          posology,
          productImage,
          personDescription,
          fast: true,
        },
      });

      const { data, error } = (await Promise.race([invokePromise, timeout])) as any;

      if (error) {
        // Gestion claire des erreurs courantes
        const status = (error as any)?.status as number | undefined;
        if (status === 401) throw new Error("Session expirée ou non authentifiée. Veuillez vous reconnecter.");
        if (status === 402) throw new Error("Crédits insuffisants pour l'IA. Veuillez recharger ou souscrire.");
        if (status === 429) throw new Error("Limite de requêtes atteinte. Réessayez dans quelques instants.");
        if (status === 404) throw new Error("Service de génération indisponible (404). Réessayez plus tard.");
        throw error;
      }

      if (data?.error) {
        throw new Error(data.error);
      }

      if (!data?.imageUrl) {
        throw new Error("Aucune image générée par le service. Réessayez avec plus de détails.");
      }

      setGeneratedImage(data.imageUrl);

      // Met à jour le compteur d'essais gratuits
      await loadUserGenerationStatus();

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

      const successMessage = hasActiveSubscription && data.hasMultipleFormats
        ? `Visuel généré avec ${data.additionalFormats.length + 1} formats optimisés !`
        : "Votre visuel a été généré avec succès";
      
      toast({
        title: "Succès !",
        description: successMessage,
      });
    } catch (error) {
      console.error("Erreur lors de la génération:", error);

      // Fallback: bascule vers le moteur d'image léger si le service principal échoue
      try {
        const promptText = `${productName} - ${niche}. ${description}. ${benefits || ''}`.slice(0, 500);
        const { data: fbData, error: fbError } = await supabase.functions.invoke('generate-feature-image', {
          body: {
            productName,
            niche,
            description,
            benefits,
            container,
            platform,
            style,
            price,
            promotionalPrice,
            posology,
            productImage,
            personDescription
          }
        });

        if (fbError) throw fbError;
        if (fbData?.imageUrl) {
          setGeneratedImage(fbData.imageUrl);
          // Met à jour le compteur éventuel
          await loadUserGenerationStatus();
          toast({
            title: "Visuel généré (moteur alternatif)",
            description: "Le service principal est temporairement indisponible. Un moteur alternatif a été utilisé.",
          });
          return; // ne pas exécuter le finally qui remettrait l'état trop tôt
        }

        throw new Error("Aucune image retournée par le moteur alternatif");
      } catch (fallbackError) {
        console.error('Fallback error:', fallbackError);
        toast({
          title: "Erreur",
          description: error instanceof Error ? error.message : "Une erreur est survenue lors de la génération",
          variant: "destructive",
        });
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <h1 className="text-4xl md:text-5xl font-bold mb-4">
              Créez votre contenu publicitaire
            </h1>
            <p className="text-lg text-muted-foreground">
              Remplissez le formulaire et laissez l'IA créer du contenu professionnel pour vous
            </p>
            
            {isFounder && (
              <Alert className="mt-4 max-w-2xl mx-auto">
                <AlertDescription className="text-center">
                  🔓 Vous avez un accès illimité à la génération d'images et de vidéos.
                </AlertDescription>
              </Alert>
            )}

            {!hasActiveSubscription && freeGenerationsRemaining !== null && (
              <Alert className="mt-4 max-w-2xl mx-auto">
                <AlertDescription className="text-center">
                  {freeGenerationsRemaining > 0 ? (
                    <>
                      🎁 <strong>Essai gratuit :</strong> Il vous reste <strong>{freeGenerationsRemaining}</strong> génération{freeGenerationsRemaining > 1 ? 's' : ''} d'image{freeGenerationsRemaining > 1 ? 's' : ''} gratuite{freeGenerationsRemaining > 1 ? 's' : ''}
                    </>
                  ) : (
                    <>
                      ⚠️ Vous avez utilisé toutes vos générations gratuites. <Button variant="link" className="p-0 h-auto" onClick={() => navigate("/subscription")}>Souscrire maintenant</Button>
                    </>
                  )}
                </AlertDescription>
              </Alert>
            )}

            {hasActiveSubscription && !isFounder && (
              <Alert className="mt-4 max-w-2xl mx-auto">
                <AlertDescription className="text-center">
                  🎬 <strong>Génération de vidéos :</strong> Il vous reste <strong>{videoGenerationsRemaining}</strong> vidéo{videoGenerationsRemaining > 1 ? 's' : ''} ce mois-ci
                </AlertDescription>
              </Alert>
            )}
          </div>

          <Tabs value={generationType} onValueChange={(v) => setGenerationType(v as "image" | "video")} className="mb-6">
            <TabsList className="grid w-full max-w-md mx-auto grid-cols-2">
              <TabsTrigger value="image">
                <Sparkles className="mr-2 h-4 w-4" />
                Image
              </TabsTrigger>
              <TabsTrigger value="video" disabled={!hasActiveSubscription}>
                <Video className="mr-2 h-4 w-4" />
                Vidéo {!hasActiveSubscription && "(Pro)"}
              </TabsTrigger>
            </TabsList>
          </Tabs>

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
                {isTouchUI ? (
                  <select
                    id="niche"
                    value={niche}
                    onChange={(e) => setNiche(e.target.value)}
                    className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                  >
                    <option value="" disabled>Sélectionnez une niche</option>
                    <option value="beaute">Beauté & Cosmétiques</option>
                    <option value="mode">Mode & Accessoires</option>
                    <option value="alimentation">Alimentation & Boissons</option>
                    <option value="tech">Technologie & Électronique</option>
                    <option value="sante">Santé & Bien-être</option>
                    <option value="maison">Maison & Décoration</option>
                  </select>
                ) : (
                  <Select value={niche} onValueChange={setNiche}>
                    <SelectTrigger>
                      <SelectValue placeholder="Sélectionnez une niche" />
                    </SelectTrigger>
                    <SelectContent position="popper" sideOffset={5}>
                      <SelectItem value="beaute">Beauté & Cosmétiques</SelectItem>
                      <SelectItem value="mode">Mode & Accessoires</SelectItem>
                      <SelectItem value="alimentation">Alimentation & Boissons</SelectItem>
                      <SelectItem value="tech">Technologie & Électronique</SelectItem>
                      <SelectItem value="sante">Santé & Bien-être</SelectItem>
                      <SelectItem value="maison">Maison & Décoration</SelectItem>
                    </SelectContent>
                  </Select>
                )}
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
                <Label htmlFor="price">Prix du produit *</Label>
                <Input
                  id="price"
                  placeholder="Ex: 10 000 FCFA"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="promotionalPrice">Prix promotionnel (optionnel)</Label>
                <Input
                  id="promotionalPrice"
                  placeholder="Ex: 15 000 FCFA (sera barré)"
                  value={promotionalPrice}
                  onChange={(e) => setPromotionalPrice(e.target.value)}
                />
                <p className="text-sm text-muted-foreground">
                  Si renseigné, ce prix sera affiché barré pour montrer la réduction
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="posology">Posologie / Mode d'emploi</Label>
                <Textarea
                  id="posology"
                  placeholder="Ex: 2 gélules par jour, matin et soir..."
                  value={posology}
                  onChange={(e) => setPosology(e.target.value)}
                  className="min-h-[80px]"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="productImage">Image du produit (optionnel)</Label>
                <Input
                  id="productImage"
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      const reader = new FileReader();
                      reader.onloadend = () => {
                        setProductImage(reader.result as string);
                      };
                      reader.readAsDataURL(file);
                    }
                  }}
                />
                {productImage && (
                  <p className="text-sm text-muted-foreground">✓ Image chargée</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="personDescription">Mise en scène avec une personne (optionnel)</Label>
                <Textarea
                  id="personDescription"
                  placeholder="Ex: Un homme musclé torse nu tenant le produit, une dame élégante assise sur une table avec le produit, un jeune sportif présentant le produit..."
                  value={personDescription}
                  onChange={(e) => setPersonDescription(e.target.value)}
                  rows={3}
                />
                <p className="text-sm text-muted-foreground">
                  Décrivez une personne ou une scène pour mettre en valeur votre produit (laissez vide si vous voulez uniquement le produit)
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="platform">Plateforme cible *</Label>
                {isTouchUI ? (
                  <select
                    id="platform"
                    value={platform}
                    onChange={(e) => setPlatform(e.target.value)}
                    className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                  >
                    <option value="" disabled>Sélectionnez une plateforme</option>
                    <option value="facebook">Facebook</option>
                    <option value="instagram">Instagram</option>
                    <option value="tiktok">TikTok</option>
                    <option value="all">Toutes les plateformes</option>
                  </select>
                ) : (
                  <Select value={platform} onValueChange={setPlatform}>
                    <SelectTrigger>
                      <SelectValue placeholder="Sélectionnez une plateforme" />
                    </SelectTrigger>
                    <SelectContent position="popper" sideOffset={5}>
                      <SelectItem value="facebook">Facebook</SelectItem>
                      <SelectItem value="instagram">Instagram</SelectItem>
                      <SelectItem value="tiktok">TikTok</SelectItem>
                      <SelectItem value="all">Toutes les plateformes</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="style">Style du visuel</Label>
                {isTouchUI ? (
                  <select
                    id="style"
                    value={style}
                    onChange={(e) => setStyle(e.target.value)}
                    className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                  >
                    <option value="" disabled>Sélectionnez un style</option>
                    <option value="moderne">Moderne</option>
                    <option value="luxueux">Luxueux</option>
                    <option value="humoristique">Humoristique</option>
                    <option value="traditionnel">Traditionnel Africain</option>
                    <option value="minimaliste">Minimaliste</option>
                    <option value="dynamique">Dynamique</option>
                  </select>
                ) : (
                  <Select value={style} onValueChange={setStyle}>
                    <SelectTrigger>
                      <SelectValue placeholder="Sélectionnez un style" />
                    </SelectTrigger>
                    <SelectContent position="popper" sideOffset={5}>
                      <SelectItem value="moderne">Moderne</SelectItem>
                      <SelectItem value="luxueux">Luxueux</SelectItem>
                      <SelectItem value="humoristique">Humoristique</SelectItem>
                      <SelectItem value="traditionnel">Traditionnel Africain</SelectItem>
                      <SelectItem value="minimaliste">Minimaliste</SelectItem>
                      <SelectItem value="dynamique">Dynamique</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              </div>

              {generationType === "image" ? (
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
                      Générer mon image
                    </>
                  )}
                </Button>
              ) : (
                <Button
                  type="button"
                  onClick={handleGenerateVideo}
                  className="w-full text-lg py-6"
                  size="lg"
                  disabled={isGeneratingVideo || !hasActiveSubscription || videoGenerationsRemaining <= 0}
                >
                  {isGeneratingVideo ? (
                    <>
                      <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                      Génération vidéo en cours...
                    </>
                  ) : (
                    <>
                      <Video className="mr-2 h-5 w-5" />
                      Générer ma vidéo (30s max)
                    </>
                  )}
                </Button>
              )}
            </form>

            {generatedImage && !isEditing && (
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
                    onClick={() => setIsEditing(true)}
                    variant="default"
                    className="flex-1"
                  >
                    Éditer l'image
                  </Button>
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

            {isEditing && generatedImage && (
              <ImageEditor
                imageUrl={generatedImage}
                productName={productName}
                onClose={() => setIsEditing(false)}
                onSave={(editedImageUrl) => {
                  setGeneratedImage(editedImageUrl);
                  setIsEditing(false);
                }}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Generator;
