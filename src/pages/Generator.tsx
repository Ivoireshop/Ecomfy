import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Video, Volume2, Play, Pause, Download, Wand2, ImageIcon, Aperture, Atom, ArrowDown } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { ImageEditor } from "@/components/ImageEditor";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AdTemplateSelector } from "@/components/AdTemplateSelector";
import { TemplatePreviewDialog } from "@/components/TemplatePreviewDialog";


import { createTextOverlay, dataURLtoBlob } from "@/lib/textOverlay";
import { SimpleWorkflow } from "@/components/SimpleWorkflow";
import { BrandExtractor } from "@/components/BrandExtractor";
import { MultiImageUploader } from "@/components/MultiImageUploader";
import { VariationGenerator } from "@/components/VariationGenerator";

import { AdvancedImageGenerator } from "@/components/AdvancedImageGenerator";
import { Switch } from "@/components/ui/switch";
import { VideoGenerator } from "@/components/VideoGenerator";
import exampleHandbag from "@/assets/example-handbag-ad.jpg";
import examplePhone from "@/assets/example-phone-ad.jpg";
import exampleFood from "@/assets/example-food-ad.jpg";
import exampleBeauty from "@/assets/example-beauty-ad.jpg";
import exampleFitness from "@/assets/example-fitness-ad.jpg";
import exampleRealestate from "@/assets/example-realestate-ad.jpg";

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
  const [purchasedCredits, setPurchasedCredits] = useState<number>(0);
  const [hasActiveSubscription, setHasActiveSubscription] = useState(false);
  const [videoGenerationsRemaining, setVideoGenerationsRemaining] = useState<number>(5);
  const [isGeneratingVideo, setIsGeneratingVideo] = useState(false);
  const [generationType, setGenerationType] = useState<"image" | "video" | "pro" | "advanced">("image");
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
  
  // Text preview and validation state
  const [showTextPreview, setShowTextPreview] = useState(false);
  const [previewTexts, setPreviewTexts] = useState({
    productName: "",
    tagline: "",
    price: "",
    promotionalPrice: "",
    benefits: "",
    callToAction: "Commandez maintenant!",
  });

  // Price display option
  const [showPrice, setShowPrice] = useState(true);

  // Correction post-génération
  const [correctionText, setCorrectionText] = useState("");
  const [isCorrectingAndRegenerating, setIsCorrectingAndRegenerating] = useState(false);

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
        .select("free_generations_remaining, free_video_generations_remaining, purchased_credits")
        .eq("id", user.id)
        .single();

      setFreeGenerationsRemaining(profileData?.free_generations_remaining || 0);
      setFreeVideoGenerationsRemaining(profileData?.free_video_generations_remaining || 0);
      setPurchasedCredits(profileData?.purchased_credits || 0);
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

  const openTextPreview = () => {
    // Bloquer si plus de générations gratuites
    if (!hasActiveSubscription && freeGenerationsRemaining === 0) {
      toast({
        title: "Essai gratuit terminé",
        description: "Vous avez utilisé vos 3 générations gratuites. Souscrivez pour continuer !",
        variant: "destructive",
      });
      setTimeout(() => navigate("/subscription"), 2000);
      return;
    }

    // Validate required fields - price is optional if showPrice is false
    const missingFields = [];
    if (!productName) missingFields.push("nom");
    if (!niche) missingFields.push("niche");
    if (!description) missingFields.push("description");
    if (!platform) missingFields.push("plateforme");
    if (showPrice && !price) missingFields.push("prix");

    if (missingFields.length > 0) {
      toast({
        title: "Champs manquants",
        description: `Veuillez remplir les champs obligatoires : ${missingFields.join(", ")}`,
        variant: "destructive",
      });
      return;
    }

    // Préparer les textes qui seront sur l'image
    const tagline = benefits 
      ? benefits.split(',')[0].trim() 
      : description.substring(0, 60) + (description.length > 60 ? '...' : '');

    setPreviewTexts({
      productName: productName,
      tagline: tagline,
      price: showPrice ? price : "",
      promotionalPrice: showPrice ? (promotionalPrice || "") : "",
      benefits: benefits || "",
      callToAction: "Commandez maintenant!",
    });

    setShowTextPreview(true);
  };

  const handleCorrectAndRegenerate = async () => {
    if (!correctionText.trim()) {
      toast({
        title: "Champ vide",
        description: "Veuillez indiquer les corrections à apporter",
        variant: "destructive",
      });
      return;
    }

    setIsCorrectingAndRegenerating(true);

    try {
      // 1. Construire le texte original complet
      const originalText = `
Nom du produit: ${previewTexts.productName}
Description: ${description}
Bénéfices: ${previewTexts.benefits || benefits}
${showPrice && previewTexts.price ? `Prix: ${previewTexts.price}` : ''}
${showPrice && previewTexts.promotionalPrice ? `Prix promotionnel: ${previewTexts.promotionalPrice}` : ''}
      `.trim();

      // 2. Envoyer à l'Edge Function pour correction
      const { data, error } = await supabase.functions.invoke("correct-text", {
        body: { 
          text: `${originalText}\n\nCorrections demandées: ${correctionText}`
        },
      });

      if (error) throw error;

      if (!data?.correctedText) {
        throw new Error("Aucune correction générée");
      }

      // 3. Extraire les données corrigées du texte
      const correctedLines = data.correctedText.split('\n');
      let correctedProductName = previewTexts.productName;
      let correctedBenefits = previewTexts.benefits || benefits;
      let correctedPrice = previewTexts.price;
      let correctedPromotionalPrice = previewTexts.promotionalPrice;

      correctedLines.forEach((line: string) => {
        if (line.startsWith('Nom du produit:')) {
          correctedProductName = line.replace('Nom du produit:', '').trim();
        } else if (line.startsWith('Bénéfices:')) {
          correctedBenefits = line.replace('Bénéfices:', '').trim();
        } else if (line.startsWith('Prix:') && !line.includes('promotionnel')) {
          correctedPrice = line.replace('Prix:', '').trim();
        } else if (line.startsWith('Prix promotionnel:')) {
          correctedPromotionalPrice = line.replace('Prix promotionnel:', '').trim();
        }
      });

      // 4. Mettre à jour les textes avec les versions corrigées
      setPreviewTexts(prev => ({
        ...prev,
        productName: correctedProductName,
        benefits: correctedBenefits,
        price: correctedPrice,
        promotionalPrice: correctedPromotionalPrice,
      }));

      // 5. Régénérer l'image avec les textes corrigés
      setIsLoading(true);

      const timeout = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("timeout")), 90000)
      );

      const invokePromise = supabase.functions.invoke("generate-ad-visual", {
        body: {
          productName: correctedProductName,
          niche,
          description,
          benefits: correctedBenefits,
          container,
          platform,
          style,
          price: correctedPrice,
          promotionalPrice: correctedPromotionalPrice,
          posology,
          productImage,
          personDescription,
          template: selectedTemplate,
        },
      });

      const response = await Promise.race([invokePromise, timeout]);

      if (response.error) throw response.error;
      if (response.data?.error) throw new Error(response.data.error);

      // Remplacer automatiquement l'image générée
      setGeneratedImage(response.data.imageUrl);
      
      // Mettre à jour les générations restantes
      const { data: updatedProfile } = await supabase
        .from("profiles")
        .select("free_generations_remaining, purchased_credits")
        .single();
      
      if (updatedProfile) {
        setFreeGenerationsRemaining(updatedProfile.free_generations_remaining);
        setPurchasedCredits(updatedProfile.purchased_credits || 0);
      }

      // Réinitialiser le champ de correction
      setCorrectionText("");

      // Scroll automatique vers l'image pour que l'utilisateur voie le changement
      setTimeout(() => {
        const imageElement = document.querySelector('img[alt="Visuel publicitaire généré"]');
        if (imageElement) {
          imageElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 100);

    } catch (error: any) {
      console.error("Erreur correction et régénération:", error);
      toast({
        title: "Erreur",
        description: error?.message || "Une erreur est survenue lors de la correction",
        variant: "destructive",
      });
    } finally {
      setIsCorrectingAndRegenerating(false);
      setIsLoading(false);
    }
  };

  const handleGenerate = async () => {
    // Vérifier l'abonnement et les générations gratuites avant de générer
    if (!hasActiveSubscription && freeGenerationsRemaining === 0) {
      setShowTextPreview(false);
      toast({
        title: "Essai gratuit terminé",
        description: "Vous avez utilisé toutes vos générations gratuites. Veuillez souscrire à un abonnement pour continuer.",
        variant: "destructive",
      });
      setTimeout(() => navigate("/subscription"), 2000);
      return;
    }

    setShowTextPreview(false);
    setIsLoading(true);
    setGeneratedImage(null);

    try {
      // Timeout étendu pour permettre la génération de tous les formats
      const timeout = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("timeout")), 90000)
      );

      // 0) Correction automatique des textes (anti-fautes)
      let corrected = { ...previewTexts };
      try {
        const originalText = `Nom du produit: ${previewTexts.productName}\nSlogan: ${previewTexts.tagline}\n${showPrice && previewTexts.price ? `Prix: ${previewTexts.price}` : ""}\n${showPrice && previewTexts.promotionalPrice ? `Prix promotionnel: ${previewTexts.promotionalPrice}` : ""}\nBénéfices: ${previewTexts.benefits || benefits}\nCTA: ${previewTexts.callToAction}`.trim();

        const { data: corrData, error: corrError } = await supabase.functions.invoke("correct-text", {
          body: { text: originalText },
        });

        if (!corrError && corrData?.correctedText) {
          const lines = String(corrData.correctedText).split("\n");
          for (const line of lines) {
            const l = line.trim();
            if (l.toLowerCase().startsWith("nom du produit:")) {
              corrected.productName = l.split(":").slice(1).join(":").trim();
            } else if (l.toLowerCase().startsWith("slogan:")) {
              corrected.tagline = l.split(":").slice(1).join(":").trim();
            } else if (l.toLowerCase().startsWith("bénéfices:") || l.toLowerCase().startsWith("benefices:")) {
              corrected.benefits = l.split(":").slice(1).join(":").trim();
            } else if (l.toLowerCase().startsWith("cta:")) {
              corrected.callToAction = l.split(":").slice(1).join(":").trim();
            } else if (l.toLowerCase().startsWith("prix promotionnel:")) {
              corrected.promotionalPrice = l.split(":").slice(1).join(":").trim();
            } else if (l.toLowerCase().startsWith("prix:")) {
              corrected.price = l.split(":").slice(1).join(":").trim();
            }
          }
          setPreviewTexts(corrected);
        }
      } catch (e) {
        console.warn("Auto-correction failed, continuing with original texts:", e);
      }

      const invokePromise = supabase.functions.invoke("generate-ad-visual", {
        body: {
          productName: corrected.productName,
          niche,
          description,
          benefits: corrected.benefits || benefits,
          container,
          platform,
          style,
          price: corrected.price,
          promotionalPrice: corrected.promotionalPrice,
          posology,
          productImage,
          personDescription,
          fast: false, // Générer tous les formats pour la bibliothèque
          template: selectedTemplate, // Add template data
          tagline: corrected.tagline,
          callToAction: corrected.callToAction,
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

      // WORKFLOW ZÉRO-FAUTE: Apply text overlays on background
      toast({
        title: "Application du texte...",
        description: "Superposition du texte vectoriel sans fautes sur le fond",
      });

      try {
        const finalImageDataUrl = await createTextOverlay(
          data.imageUrl,
          {
            productName: corrected.productName,
            tagline: corrected.tagline,
            price: corrected.price,
            promotionalPrice: corrected.promotionalPrice,
            callToAction: corrected.callToAction,
            benefits: corrected.benefits,
          },
          platform
        );

        // Save final image with text overlay to library
        const finalBlob = dataURLtoBlob(finalImageDataUrl);
        const finalFileName = `ad-${Date.now()}.png`;
        
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error("User not authenticated");

        // Upload to storage
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from("generated-images")
          .upload(`${user.id}/${finalFileName}`, finalBlob, {
            contentType: "image/png",
            upsert: true,
          });

        if (uploadError) throw uploadError;

        // Get public URL
        const { data: urlData } = supabase.storage
          .from("generated-images")
          .getPublicUrl(uploadData.path);

        const finalImageUrl = urlData.publicUrl;
        
        // Save to database
        await supabase.from("generated_images").insert({
          user_id: user.id,
          image_url: finalImageUrl,
          prompt: `${corrected.productName} - ${niche}`,
          product_details: {
            productName: corrected.productName,
            niche,
            description,
            platform,
            style,
            price: corrected.price,
            promotionalPrice: corrected.promotionalPrice,
            benefits: corrected.benefits,
            tagline: corrected.tagline,
            callToAction: corrected.callToAction,
          },
        });

        setGeneratedImage(finalImageUrl);

      } catch (overlayError) {
        console.error("Error applying text overlay:", overlayError);
        // Fallback: use background image without text overlay
        setGeneratedImage(data.imageUrl);
        toast({
          title: "Attention",
          description: "Le texte vectoriel n'a pas pu être appliqué. L'image de fond est disponible.",
          variant: "destructive",
        });
      }
 
      // Met à jour le compteur d'essais gratuits (le serveur a déjà décrémenté et sauvegardé l'image)
      await loadUserGenerationStatus();

      if (!hasActiveSubscription && data.freeGenerationsRemaining !== undefined) {
        setFreeGenerationsRemaining(data.freeGenerationsRemaining);
        
        const totalRemaining = data.freeGenerationsRemaining + (purchasedCredits > 0 ? purchasedCredits : 0);
        
        if (totalRemaining <= 0) {
          toast({
            title: "🎉 Dernière génération utilisée !",
            description: "Vous avez épuisé vos crédits. Découvrez nos abonnements pour continuer à créer des visuels professionnels sans limite.",
            variant: "destructive",
            duration: 5000,
          });
          setTimeout(() => navigate("/subscription"), 3000);
          return;
        } else if (totalRemaining === 1) {
          toast({
            title: "⚠️ Dernière génération disponible !",
            description: "Il ne vous reste plus qu'une génération. Souscrivez pour continuer à créer des visuels illimités.",
            duration: 4000,
          });
        } else if (data.freeGenerationsRemaining > 0) {
          toast({
            title: "✅ Image générée avec succès",
            description: `Il vous reste ${data.freeGenerationsRemaining} essai${data.freeGenerationsRemaining > 1 ? 's' : ''} gratuit${data.freeGenerationsRemaining > 1 ? 's' : ''}${purchasedCredits > 0 ? ` + ${purchasedCredits} crédit${purchasedCredits > 1 ? 's' : ''}` : ''}`,
            duration: 3000,
          });
        } else if (purchasedCredits > 0) {
          toast({
            title: "✅ Image générée avec succès",
            description: `Il vous reste ${purchasedCredits} crédit${purchasedCredits > 1 ? 's' : ''} acheté${purchasedCredits > 1 ? 's' : ''}`,
            duration: 3000,
          });
        }
      } else {
        toast({
          title: "✅ Image générée avec succès",
          description: "Votre visuel est prêt !",
          duration: 3000,
        });
      }

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

  // Sauvegarde côté client (fallback) si l'edge function n'a pas pu enregistrer
  const saveImageToLibrary = async (url: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      await supabase.from("generated_images").insert({
        user_id: user.id,
        image_url: url,
        prompt: "client-fallback",
        product_details: {
          productName: previewTexts.productName || productName,
          niche,
          description,
          platform,
          style,
          price: previewTexts.price || price,
          promotionalPrice: previewTexts.promotionalPrice || promotionalPrice,
          benefits: previewTexts.benefits || benefits,
          tagline: previewTexts.tagline,
          callToAction: previewTexts.callToAction,
        },
      });
    } catch (e) {
      console.error("Client-side save failed:", e);
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
    <div className="min-h-screen bg-background overflow-x-hidden">
      {/* ===== HERO DYNAMIQUE ===== */}
      <section className="relative overflow-hidden border-b bg-gradient-to-br from-rose-100 via-pink-50 to-orange-50">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_rgba(251,113,133,0.2),_transparent_50%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_left,_rgba(251,146,60,0.15),_transparent_50%)]" />
        <div className="container relative mx-auto px-4 py-6 md:py-12">
          <div className="max-w-2xl mx-auto text-center space-y-3">
            <Badge className="px-3 py-1 bg-white/90 text-rose-700 backdrop-blur-sm shadow-sm font-semibold">
              <Wand2 className="w-3.5 h-3.5 mr-1.5 text-rose-600" />
              Studio Visuels IA
            </Badge>
            <h1 className="text-xl sm:text-2xl md:text-4xl font-bold leading-tight tracking-tight text-slate-900 break-words">
              Créez votre visuel publicitaire
            </h1>
            <p className="text-xs sm:text-sm md:text-base text-slate-600 max-w-xl mx-auto">
              Remplissez le formulaire ci-dessous, l'IA génère votre image prête pour Instagram, Facebook et TikTok.
            </p>
            <div className="pt-2">
              <Button
                size="lg"
                onClick={() => document.getElementById("create")?.scrollIntoView({ behavior: "smooth" })}
                className="rounded-full shadow-lg hover:shadow-xl transition-all bg-rose-600 text-white hover:bg-rose-700"
              >
                Commencer la création
                <ArrowDown className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* ===== GALERIE DÉFILANTE (une image à la fois) ===== */}
      <ExampleSlideshow
        images={[exampleHandbag, examplePhone, exampleFood, exampleBeauty, exampleFitness, exampleRealestate]}
      />

      <div id="create" className="container mx-auto px-4 py-6 md:py-8 scroll-mt-20">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-8 md:mb-12">
            <div className="flex flex-col items-center gap-3 mb-4">
              <h1 className="text-2xl sm:text-3xl md:text-5xl font-bold break-words">
                Créez votre contenu publicitaire
              </h1>
              {!isFounder && !hasActiveSubscription && (freeGenerationsRemaining !== null || purchasedCredits > 0) && (
                <Badge 
                  variant={(freeGenerationsRemaining > 0 || purchasedCredits > 0) ? "default" : "destructive"}
                  className="text-sm px-4 py-1.5"
                >
                  {freeGenerationsRemaining > 0 && (
                    <span>🎁 {freeGenerationsRemaining} essai{freeGenerationsRemaining > 1 ? 's' : ''} gratuit{freeGenerationsRemaining > 1 ? 's' : ''}</span>
                  )}
                  {freeGenerationsRemaining > 0 && purchasedCredits > 0 && <span className="mx-2">+</span>}
                  {purchasedCredits > 0 && (
                    <span>✨ {purchasedCredits} crédit{purchasedCredits > 1 ? 's' : ''}</span>
                  )}
                  {freeGenerationsRemaining <= 0 && purchasedCredits <= 0 && (
                    <span>⚠️ Quota épuisé</span>
                  )}
                </Badge>
              )}
              {hasActiveSubscription && !isFounder && (
                <Badge variant="secondary" className="text-sm px-4 py-1.5">
                  ✨ Abonné Pro - Créations illimitées
                </Badge>
              )}
            </div>
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

            {!hasActiveSubscription && (freeGenerationsRemaining !== null || purchasedCredits > 0) && (
              <Alert className={`mt-4 max-w-2xl mx-auto ${(freeGenerationsRemaining === 0 && purchasedCredits === 0) ? 'border-red-500 bg-red-50 dark:bg-red-950' : ''}`}>
                <AlertDescription className="text-center">
                  {(freeGenerationsRemaining > 0 || purchasedCredits > 0) ? (
                    <div className="space-y-2">
                      {freeGenerationsRemaining > 0 && (
                        <p>
                          🎁 <strong>Essai gratuit :</strong> <strong>{freeGenerationsRemaining}</strong> génération{freeGenerationsRemaining > 1 ? 's' : ''} gratuite{freeGenerationsRemaining > 1 ? 's' : ''}
                        </p>
                      )}
                      {purchasedCredits > 0 && (
                        <p>
                          ✨ <strong>Crédits achetés :</strong> <strong>{purchasedCredits}</strong> création{purchasedCredits > 1 ? 's' : ''} disponible{purchasedCredits > 1 ? 's' : ''}
                        </p>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <p className="text-base font-bold text-red-700 dark:text-red-400">
                        ⚠️ Essai gratuit terminé
                      </p>
                      <p className="text-sm">
                        Vous avez utilisé vos 3 générations gratuites. Achetez des crédits à la carte ou souscrivez à l'abonnement illimité !
                      </p>
                      <Button 
                        size="lg" 
                        className="bg-gradient-to-r from-primary to-secondary hover:opacity-90"
                        onClick={() => navigate("/subscription")}
                      >
                        🚀 Voir les options
                      </Button>
                    </div>
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

          <Tabs value={generationType === "video" ? "image" : generationType} onValueChange={(v) => setGenerationType(v as "image" | "video" | "pro" | "advanced")} className="mb-6">
            <TabsList className="grid w-full max-w-3xl mx-auto grid-cols-3">
              <TabsTrigger value="image">
                <ImageIcon className="mr-2 h-4 w-4 text-red-800" />
                Classique
              </TabsTrigger>
              <TabsTrigger value="advanced">
                <Atom className="mr-2 h-4 w-4 text-blue-600" />
                Avancé
              </TabsTrigger>
              <TabsTrigger value="pro">
                <Aperture className="mr-2 h-4 w-4 text-yellow-600" />
                Mode Pro
              </TabsTrigger>
            </TabsList>
          </Tabs>


          {/* Mode Pro - Workflow Omneky-style */}
          {generationType === "pro" && (
            <div className="container mx-auto px-4 max-w-6xl">
              {!hasActiveSubscription && !isFounder ? (
                <Card className="border-primary/20">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Aperture className="h-5 w-5 text-primary" />
                      Mode Pro - Abonnement Requis
                    </CardTitle>
                    <CardDescription>
                      Le Mode Pro est réservé aux abonnés. Générez vos visuels automatiquement depuis votre URL avec l'IA.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="p-4 bg-muted/50 rounded-lg space-y-2">
                      <h4 className="font-semibold">Fonctionnalités Mode Pro :</h4>
                      <ul className="space-y-1 text-sm text-muted-foreground">
                        <li>✨ Extraction automatique de votre marque depuis votre URL</li>
                        <li>🎨 Génération de 5 variations professionnelles</li>
                        <li>🎯 Optimisé pour le marché africain</li>
                        <li>⚡ Workflow ultra-rapide en 3 étapes</li>
                      </ul>
                    </div>
                    <Button 
                      onClick={() => navigate("/subscription")}
                      className="w-full"
                      size="lg"
                    >
                      Voir les plans d'abonnement
                    </Button>
                  </CardContent>
                </Card>
              ) : (
                <SimpleWorkflow
                  productData={{
                    productName,
                    niche,
                    description,
                    platform: platform || "instagram",
                    price,
                    benefits,
                  }}
                  onComplete={(data) => {
                    console.log("Workflow completed:", data);
                    
                    // Update form fields with extracted data
                    if (data.enrichedProductData) {
                      const enriched = data.enrichedProductData;
                      if (enriched.productName) setProductName(enriched.productName);
                      if (enriched.niche) setNiche(enriched.niche);
                      if (enriched.description) setDescription(enriched.description);
                      if (enriched.price && enriched.price !== "Non spécifié") setPrice(enriched.price);
                      if (enriched.benefits) setBenefits(enriched.benefits);
                    }
                    
                    if (data.selectedVariation) {
                      setGeneratedImage(data.selectedVariation);
                      toast({
                        title: "✨ Génération terminée !",
                        description: "Votre annonce a été générée avec succès",
                      });
                    }
                  }}
                />
              )}
            </div>
          )}

          {/* Mode Avancé - Génération IA style ChatGPT */}
          {generationType === "advanced" && (
            <div className="container mx-auto px-4 max-w-4xl">
              <AdvancedImageGenerator 
                onImageGenerated={(imageUrl) => {
                  setGeneratedImage(imageUrl);
                  toast({
                    title: "✨ Image générée !",
                    description: "Votre image a été générée avec succès et sauvegardée dans la bibliothèque",
                  });
                }}
              />
            </div>
          )}

          {/* Mode Vidéo - Interface dédiée */}
          {generationType === "video" && (
            <VideoGenerator
              hasActiveSubscription={hasActiveSubscription}
              isFounder={isFounder}
              videoGenerationsRemaining={videoGenerationsRemaining}
              onVideoGenerated={loadUserGenerationStatus}
            />
          )}

          {/* Mode Classique - Formulaire */}
          {generationType === "image" && (
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

              {/* Price Display Toggle */}
              <div className="flex items-center justify-between p-4 rounded-lg border bg-muted/30">
                <div className="space-y-1">
                  <Label htmlFor="show-price" className="text-base font-semibold">
                    Afficher le prix sur le visuel
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Désactivez cette option si vous ne souhaitez pas afficher de prix
                  </p>
                </div>
                <Switch
                  id="show-price"
                  checked={showPrice}
                  onCheckedChange={setShowPrice}
                />
              </div>

              {showPrice && (
                <>
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
                </>
              )}

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

              {!hasActiveSubscription && freeGenerationsRemaining === 0 && (
                <Alert className="border-destructive bg-destructive/10">
                  <AlertDescription className="text-center space-y-2">
                    <p className="font-bold text-destructive">
                      ⚠️ Essai gratuit terminé
                    </p>
                    <p className="text-sm">
                      Pour continuer à créer des visuels professionnels avec l'IA
                    </p>
                    <Button 
                      size="sm" 
                      className="bg-gradient-to-r from-primary to-secondary"
                      onClick={() => navigate("/subscription")}
                    >
                      🚀 Souscrire maintenant
                    </Button>
                  </AlertDescription>
                </Alert>
              )}
              <Button
                type="button"
                onClick={openTextPreview}
                className="w-full text-lg py-6"
                size="lg"
                disabled={isLoading || (!hasActiveSubscription && !isFounder && freeGenerationsRemaining !== null && freeGenerationsRemaining <= 0 && purchasedCredits <= 0)}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Génération en cours...
                  </>
                ) : (!hasActiveSubscription && !isFounder && freeGenerationsRemaining !== null && freeGenerationsRemaining <= 0 && purchasedCredits <= 0) ? (
                  "Quota épuisé - Prenez un abonnement"
                ) : (
                  <>
                    <Wand2 className="mr-2 h-5 w-5" />
                    Prévisualiser et générer
                    {!hasActiveSubscription && freeGenerationsRemaining !== null && freeGenerationsRemaining > 0 && (
                      <span className="ml-2 text-xs opacity-80">
                        ({freeGenerationsRemaining} gratuit{freeGenerationsRemaining > 1 ? 's' : ''})
                      </span>
                    )}
                  </>
                )}
              </Button>
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

                {/* Section correction post-génération */}
                <Card className="mt-6">
                  <CardHeader>
                    <CardTitle className="text-lg">Corriger et régénérer</CardTitle>
                    <CardDescription>
                      Indiquez les mots ou phrases à corriger dans l'image, puis cliquez sur "Corriger et régénérer"
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <Label htmlFor="correction-input">Écrivez ici les mots ou phrases à corriger</Label>
                      <Textarea
                        id="correction-input"
                        placeholder="Ex: Changer 'Santé' par 'Santée', corriger 'bienfais' en 'bienfaits'..."
                        value={correctionText}
                        onChange={(e) => setCorrectionText(e.target.value)}
                        className="min-h-[100px] mt-2"
                        disabled={isCorrectingAndRegenerating}
                      />
                    </div>
                    <Button
                      onClick={handleCorrectAndRegenerate}
                      disabled={isCorrectingAndRegenerating || !correctionText.trim()}
                      className="w-full"
                    >
                      {isCorrectingAndRegenerating ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Correction et régénération en cours...
                        </>
                      ) : (
                        <>
                          <Atom className="mr-2 h-4 w-4 text-blue-600" />
                          Corriger et régénérer l'image
                        </>
                      )}
                    </Button>
                  </CardContent>
                </Card>

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
                      Télécharger
                    </Button>
                  </div>
                  <div className="flex gap-2 mt-2">
                    <Button
                      onClick={() => navigate("/library")}
                      variant="outline"
                      className="flex-1"
                    >
                      Voir dans la bibliothèque
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
          )}

          {/* Text Preview Dialog */}
            {showTextPreview && (
              <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                <div className="bg-background rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                  <div className="p-6 space-y-4">
                    <div className="flex items-center justify-between">
                      <h2 className="text-2xl font-bold">Vérifiez les textes avant génération</h2>
                      <Button
                        onClick={() => setShowTextPreview(false)}
                        variant="ghost"
                        size="icon"
                      >
                        ✕
                      </Button>
                    </div>

                    <Alert>
                      <AlertDescription>
                        📝 Vérifiez et modifiez les textes ci-dessous avant de générer votre visuel.
                      </AlertDescription>
                    </Alert>

                    <div className="space-y-4">
                      <div>
                        <Label htmlFor="preview-productName">Nom du produit</Label>
                        <Input
                          id="preview-productName"
                          value={previewTexts.productName}
                          onChange={(e) => setPreviewTexts({...previewTexts, productName: e.target.value})}
                          className="text-lg font-semibold"
                        />
                      </div>

                      <div>
                        <Label htmlFor="preview-tagline">Phrase d'accroche / Slogan</Label>
                        <Textarea
                          id="preview-tagline"
                          value={previewTexts.tagline}
                          onChange={(e) => setPreviewTexts({...previewTexts, tagline: e.target.value})}
                          rows={2}
                          className="resize-none"
                        />
                        <p className="text-xs text-muted-foreground mt-1">
                          Ce texte apparaîtra en évidence sur votre visuel
                        </p>
                      </div>

                      {previewTexts.promotionalPrice && (
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <Label htmlFor="preview-promotionalPrice">Prix promotionnel (barré)</Label>
                            <Input
                              id="preview-promotionalPrice"
                              value={previewTexts.promotionalPrice}
                              onChange={(e) => setPreviewTexts({...previewTexts, promotionalPrice: e.target.value})}
                            />
                          </div>
                          <div>
                            <Label htmlFor="preview-price">Prix actuel</Label>
                            <Input
                              id="preview-price"
                              value={previewTexts.price}
                              onChange={(e) => setPreviewTexts({...previewTexts, price: e.target.value})}
                              className="font-bold"
                            />
                          </div>
                        </div>
                      )}

                      {!previewTexts.promotionalPrice && (
                        <div>
                          <Label htmlFor="preview-price">Prix</Label>
                          <Input
                            id="preview-price"
                            value={previewTexts.price}
                            onChange={(e) => setPreviewTexts({...previewTexts, price: e.target.value})}
                            className="font-bold text-lg"
                          />
                        </div>
                      )}

                      {previewTexts.benefits && (
                        <div>
                          <Label htmlFor="preview-benefits">Avantages / Bénéfices</Label>
                          <Textarea
                            id="preview-benefits"
                            value={previewTexts.benefits}
                            onChange={(e) => setPreviewTexts({...previewTexts, benefits: e.target.value})}
                            rows={2}
                            className="resize-none"
                          />
                        </div>
                      )}

                      <div>
                        <Label htmlFor="preview-cta">Appel à l'action</Label>
                        <Input
                          id="preview-cta"
                          value={previewTexts.callToAction}
                          onChange={(e) => setPreviewTexts({...previewTexts, callToAction: e.target.value})}
                        />
                        <p className="text-xs text-muted-foreground mt-1">
                          Exemple : "Commandez maintenant!", "Achetez aujourd'hui", "Contactez-nous"
                        </p>
                      </div>
                    </div>

                    <div className="flex gap-3 pt-4">
                      <Button
                        onClick={() => setShowTextPreview(false)}
                        variant="outline"
                        className="flex-1"
                      >
                        Annuler
                      </Button>
                      <Button
                        onClick={handleGenerate}
                        className="flex-1"
                        disabled={isLoading}
                      >
                        {isLoading ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Génération...
                          </>
                        ) : (
                          <>
                            <Atom className="mr-2 h-4 w-4 text-blue-600" />
                            Confirmer et générer
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            )}
        </div>
      </div>
    </div>
  );
};

export default Generator;

function ExampleSlideshow({ images }: { images: string[] }) {
  const [index, setIndex] = useState(0);
  useEffect(() => {
    const id = setInterval(() => {
      setIndex((i) => (i + 1) % images.length);
    }, 3500);
    return () => clearInterval(id);
  }, [images.length]);

  return (
    <section className="py-4 md:py-6 bg-muted/30 border-b">
      <div className="container mx-auto px-4 mb-3">
        <p className="text-center text-xs md:text-sm text-muted-foreground">
          ✨ Visuels déjà créés sur la plateforme
        </p>
      </div>
      <div className="container mx-auto px-4">
        <div className="relative mx-auto w-full max-w-[260px] sm:max-w-xs md:max-w-sm">
          <Card className="overflow-hidden shadow-md">
            <div className="aspect-square bg-muted relative">
              {images.map((src, i) => (
                <img
                  key={i}
                  src={src}
                  alt="Visuel publicitaire"
                  loading="lazy"
                  className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-700 ${
                    i === index ? "opacity-100" : "opacity-0"
                  }`}
                />
              ))}
            </div>
          </Card>
          <div className="mt-3 flex justify-center gap-1.5">
            {images.map((_, i) => (
              <button
                key={i}
                onClick={() => setIndex(i)}
                aria-label={`Voir visuel ${i + 1}`}
                className={`h-1.5 rounded-full transition-all ${
                  i === index ? "w-5 bg-rose-600" : "w-1.5 bg-muted-foreground/30"
                }`}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
