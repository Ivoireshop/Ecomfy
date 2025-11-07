import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sparkles, Loader2, Video, Volume2, Play, Pause, Download } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { ImageEditor } from "@/components/ImageEditor";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AdTemplateSelector } from "@/components/AdTemplateSelector";

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
  const [videoProgress, setVideoProgress] = useState<{step: string, percentage: number} | null>(null);

  // Voix off states
  const [voiceoverText, setVoiceoverText] = useState("");
  const [selectedVoice, setSelectedVoice] = useState("Alice");
  const [isGeneratingVoice, setIsGeneratingVoice] = useState(false);
  const [generatedAudio, setGeneratedAudio] = useState<string | null>(null);
  const [generatedAudioBase64, setGeneratedAudioBase64] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);
  const [freeVideoGenerationsRemaining, setFreeVideoGenerationsRemaining] = useState<number>(0);

  // Template state
  const [selectedTemplate, setSelectedTemplate] = useState<any | null>(null);

  // Voix africaines (ElevenLabs)
  const voices = [
    { value: "Alice", label: "Alice (Féminine - Accent Africain)" },
    { value: "Matilda", label: "Matilda (Féminine - Accent Africain)" },
    { value: "Jessica", label: "Jessica (Féminine - Accent West African)" },
    { value: "Callum", label: "Callum (Masculin - Accent Africain)" },
    { value: "George", label: "George (Masculin - Accent Africain)" },
    { value: "Daniel", label: "Daniel (Masculin - Accent West African)" },
  ];
  
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

  // Cleanup any realtime subscriptions on unmount
  useEffect(() => {
    return () => {
      supabase.channel('video-progress').unsubscribe();
    };
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
        .select("free_generations_remaining, free_video_generations_remaining")
        .eq("id", user.id)
        .single();

      setFreeGenerationsRemaining(profileData?.free_generations_remaining || 0);
      setFreeVideoGenerationsRemaining(profileData?.free_video_generations_remaining || 0);
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
          template: selectedTemplate, // Add template data
        },
      });

      if (error) throw error;
      if (data?.error) {
        const msg = data.details ? `${data.error}: ${data.details}` : data.error;
        throw new Error(msg);
      }

      setVideoGenerationsRemaining(data.videoGenerationsRemaining || 0);
      const videoId = data.videoId;

      // Set up realtime listener for video progress
      const channel = supabase
        .channel(`video-progress-${videoId}`)
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'generated_videos',
            filter: `id=eq.${videoId}`,
          },
          (payload) => {
            const { progress_step, progress_percentage, status } = payload.new;
            
            setVideoProgress({ 
              step: progress_step || 'processing', 
              percentage: progress_percentage || 0 
            });

            // Show toast for each progress step
            const stepMessages: Record<string, string> = {
              initializing: "⏳ Initialisation de la génération...",
              generating_image: "🎨 Génération de l'image de base...",
              image_generated: "✅ Image générée avec succès!",
              animating_video: "🎬 Animation de la vidéo en cours...",
              video_ready: "🎉 Vidéo prête, finalisation...",
              finalizing: "📦 Téléchargement et enregistrement...",
              completed: "✨ Vidéo terminée avec succès!"
            };

            if (stepMessages[progress_step]) {
              toast({
                title: stepMessages[progress_step],
                description: `Progression: ${progress_percentage}%`,
              });
            }

            if (status === 'completed') {
              setTimeout(() => {
                setVideoProgress(null);
                navigate("/library");
              }, 2000);
              supabase.removeChannel(channel);
            } else if (status === 'failed') {
              toast({
                title: "Erreur",
                description: "La génération de la vidéo a échoué",
                variant: "destructive",
              });
              setVideoProgress(null);
              setIsGeneratingVideo(false);
              supabase.removeChannel(channel);
            }
          }
        )
        .subscribe();

      toast({
        title: "Vidéo en cours de génération",
        description: "Suivez la progression ci-dessous",
      });
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
          template: selectedTemplate, // Add template data
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

  // --- Voix off & vidéo MP4 depuis l'image ---
  const generateVoiceover = async () => {
    if (!voiceoverText.trim()) {
      toast({
        title: "Texte manquant",
        description: "Veuillez entrer un texte pour la voix off",
        variant: "destructive",
      });
      return;
    }

    setIsGeneratingVoice(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-voiceover", {
        body: {
          text: voiceoverText,
          voice: selectedVoice,
        },
      });

      if (error) throw error;

      if (data?.audioContent) {
        const audioUrl = `data:audio/mpeg;base64,${data.audioContent}`;
        setGeneratedAudio(audioUrl);
        setGeneratedAudioBase64(data.audioContent);
        toast({ title: "Voix off prête", description: "La voix off a été générée avec succès" });
      } else {
        toast({ title: "Erreur", description: "Erreur lors de la génération de la voix off", variant: "destructive" });
      }
    } catch (err: any) {
      console.error("Error generating voiceover:", err);
      toast({ title: "Erreur", description: err?.message || "Une erreur est survenue", variant: "destructive" });
    } finally {
      setIsGeneratingVoice(false);
    }
  };

  const togglePlayPause = () => {
    if (!audioRef.current || !generatedAudio) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play();
      setIsPlaying(true);
    }
  };

  const handleDownloadAudio = () => {
    if (!generatedAudio) return;
    const link = document.createElement("a");
    link.href = generatedAudio;
    link.download = `voiceover-${selectedVoice}.mp3`;
    link.click();
    toast({ title: "Téléchargé", description: "Voix off téléchargée" });
  };

  const createVideoMP4 = async () => {
    if (!generatedImage || !generatedAudioBase64) {
      toast({ title: "Image et voix off requises", description: "Générez d'abord l'image et la voix off", variant: "destructive" });
      return;
    }

    if (!isFounder && !hasActiveSubscription && freeVideoGenerationsRemaining <= 0) {
      toast({ title: "Essai gratuit utilisé", description: "Abonnez-vous pour créer des vidéos avec voix off", variant: "destructive" });
      return;
    }

    setIsGeneratingVideo(true);
    try {
      // 1) Récupérer l'utilisateur
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Utilisateur non authentifié");

      // 2) Uploader l'image (si data URL) dans le stockage pour obtenir une URL publique
      let imagePublicUrl = generatedImage as string;
      if (imagePublicUrl.startsWith("data:")) {
        const base64Data = imagePublicUrl.split(",")[1];
        const byteString = atob(base64Data);
        const byteArray = new Uint8Array(byteString.length);
        for (let i = 0; i < byteString.length; i++) byteArray[i] = byteString.charCodeAt(i);
        const imagePath = `${user.id}/videos/image-${Date.now()}.png`;
        const { error: upErr } = await supabase.storage
          .from('generated-content')
          .upload(imagePath, byteArray, { contentType: 'image/png', upsert: true });
        if (upErr) throw upErr;
        const { data: imgUrlData } = supabase.storage.from('generated-content').getPublicUrl(imagePath);
        imagePublicUrl = imgUrlData.publicUrl;
      }

      // 3) Uploader l'audio MP3 en stockage et obtenir une URL publique
      const audioBase64 = generatedAudioBase64!;
      const audioBinary = atob(audioBase64);
      const audioArray = new Uint8Array(audioBinary.length);
      for (let i = 0; i < audioBinary.length; i++) audioArray[i] = audioBinary.charCodeAt(i);
      const audioPath = `${user.id}/videos/audio-${Date.now()}.mp3`;
      const { error: audErr } = await supabase.storage
        .from('generated-content')
        .upload(audioPath, audioArray, { contentType: 'audio/mpeg', upsert: true });
      if (audErr) throw audErr;
      const { data: audUrlData } = supabase.storage.from('generated-content').getPublicUrl(audioPath);
      const audioPublicUrl = audUrlData.publicUrl;

      // 4) Appeler la fonction avec des URLs (payload léger)
      const { data, error } = await supabase.functions.invoke("create-video-from-image", {
        body: {
          imageUrl: imagePublicUrl,
          audioUrl: audioPublicUrl,
          duration: 10,
        },
      });

      if (error) throw error;

      if (data?.videoUrl) {
        toast({ 
          title: "Vidéo MP4 créée !", 
          description: "La vidéo a été sauvegardée dans votre bibliothèque. Cliquez sur 'Bibliothèque' dans le menu pour la voir."
        });
        // Navigate after a short delay to let user see the toast
        setTimeout(() => navigate("/library"), 2000);
        await loadUserGenerationStatus();
      } else if (data?.audioUrl) {
        const imgLink = document.createElement("a");
        imgLink.href = generatedImage;
        imgLink.download = `image-${Date.now()}.png`;
        imgLink.click();

        setTimeout(() => {
          const audioLink = document.createElement("a");
          audioLink.href = data.audioUrl;
          audioLink.download = `audio-${Date.now()}.mp3`;
          audioLink.click();
        }, 500);

        toast({ title: "Téléchargements prêts", description: "Image et audio téléchargés séparément" });
        await loadUserGenerationStatus();
      } else {
        toast({ title: "Erreur", description: "Erreur lors de la création de la vidéo", variant: "destructive" });
      }
    } catch (err: any) {
      console.error("Error creating video:", err);
      toast({ title: "Erreur", description: err?.message || "Une erreur est survenue", variant: "destructive" });
    } finally {
      setIsGeneratingVideo(false);
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

              {/* Template Selector */}
              <div className="space-y-4 pt-4 border-t">
                <AdTemplateSelector
                  selectedTemplateId={selectedTemplate?.id || null}
                  onSelectTemplate={setSelectedTemplate}
                />
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

            {videoProgress && (
              <div className="mt-6 p-4 bg-muted rounded-lg space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Progression de la vidéo</span>
                  <span className="text-sm text-muted-foreground">{videoProgress.percentage}%</span>
                </div>
                <Progress value={videoProgress.percentage} className="w-full" />
                <p className="text-xs text-muted-foreground text-center">
                  {videoProgress.step === 'initializing' && '⏳ Initialisation...'}
                  {videoProgress.step === 'generating_image' && '🎨 Génération de l\'image...'}
                  {videoProgress.step === 'image_generated' && '✅ Image générée!'}
                  {videoProgress.step === 'animating_video' && '🎬 Animation en cours...'}
                  {videoProgress.step === 'video_ready' && '🎉 Vidéo prête!'}
                  {videoProgress.step === 'finalizing' && '📦 Finalisation...'}
                  {videoProgress.step === 'completed' && '✨ Terminé!'}
                </p>
              </div>
            )}

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
                <div className="mt-4 flex flex-col gap-2">
                  <div className="flex gap-2">
                    <Button
                      onClick={() => setIsEditing(true)}
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
                        toast({ title: "Téléchargé", description: "Image téléchargée avec succès" });
                      }}
                      className="flex-1"
                    >
                      <Download className="mr-2 h-4 w-4" />
                      Télécharger l'image seule
                    </Button>
                  </div>
                  <Button
                    onClick={() => setGeneratedImage(null)}
                    variant="outline"
                    className="w-full"
                  >
                    Générer un autre visuel
                  </Button>
                </div>

                {/* Voix off - affichée juste sous l'image générée */}
                <div className="space-y-4 p-4 mt-6 bg-muted/50 rounded-lg border-2 border-dashed">
                  <div className="flex items-center gap-2">
                    <Volume2 className="h-5 w-5 text-primary" />
                    <h3 className="font-semibold">Ajouter une voix off (optionnel)</h3>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    💡 Vous pouvez télécharger l'image seule ci-dessus, ou ajouter une voix off pour créer une vidéo MP4 dynamique.
                  </p>
                  
                  <div>
                    <Label htmlFor="voiceover-text">Texte de la voix off (20-30 secondes max)</Label>
                    <Textarea
                      id="voiceover-text"
                      placeholder="Ex: Découvrez notre nouvelle collection de formations digitales qui transformeront votre avenir..."
                      value={voiceoverText}
                      onChange={(e) => {
                        const text = e.target.value;
                        if (text.length <= 300) setVoiceoverText(text);
                      }}
                      rows={3}
                      maxLength={300}
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      {voiceoverText.length}/300 caractères (~{Math.ceil(voiceoverText.length / 10)} s)
                    </p>
                  </div>

                  <div>
                    <Label htmlFor="voice">Voix avec accent africain</Label>
                    <Select value={selectedVoice} onValueChange={setSelectedVoice}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {voices.map((voice) => (
                          <SelectItem key={voice.value} value={voice.value}>
                            {voice.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {!generatedAudio ? (
                    <Button
                      onClick={generateVoiceover}
                      disabled={isGeneratingVoice || !voiceoverText.trim()}
                      className="w-full"
                    >
                      {isGeneratingVoice ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Génération de la voix off...
                        </>
                      ) : (
                        <>
                          <Volume2 className="mr-2 h-4 w-4" />
                          Générer la voix off
                        </>
                      )}
                    </Button>
                  ) : (
                    <div className="space-y-2">
                      <audio
                        ref={audioRef}
                        src={generatedAudio}
                        onEnded={() => setIsPlaying(false)}
                        className="hidden"
                      />
                      <div className="flex gap-2">
                        <Button onClick={togglePlayPause} variant="outline" className="flex-1">
                          {isPlaying ? (
                            <>
                              <Pause className="mr-2 h-4 w-4" />
                              Pause
                            </>
                          ) : (
                            <>
                              <Play className="mr-2 h-4 w-4" />
                              Écouter
                            </>
                          )}
                        </Button>
                        <Button onClick={handleDownloadAudio} variant="outline" className="flex-1">
                          <Download className="mr-2 h-4 w-4" />
                          Télécharger l'audio seul
                        </Button>
                      </div>

                      {/* Bouton vidéo MP4 (optionnel) */}
                      <div className="space-y-2 pt-3 border-t mt-3">
                        <p className="text-sm text-muted-foreground mb-2">
                          📹 Vous pouvez aussi combiner image + audio en vidéo MP4 :
                        </p>
                        {!isFounder && !hasActiveSubscription && freeVideoGenerationsRemaining <= 0 && (
                          <Alert>
                            <AlertDescription>
                              Essai gratuit utilisé. Abonnez-vous pour créer des vidéos avec voix off.
                            </AlertDescription>
                          </Alert>
                        )}
                        <Button
                          onClick={createVideoMP4}
                          disabled={isGeneratingVideo || (!isFounder && !hasActiveSubscription && freeVideoGenerationsRemaining <= 0)}
                          className="w-full"
                          variant="default"
                        >
                          {isGeneratingVideo ? (
                            <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              Création de la vidéo MP4...
                            </>
                          ) : (
                            <>
                              <Download className="mr-2 h-4 w-4" />
                              Télécharger vidéo MP4 (Image + Voix Off)
                              {!isFounder && !hasActiveSubscription && freeVideoGenerationsRemaining > 0 && (
                                <span className="ml-2 text-xs">({freeVideoGenerationsRemaining} essai gratuit)</span>
                              )}
                            </>
                          )}
                        </Button>
                      </div>
                    </div>
                  )}
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
