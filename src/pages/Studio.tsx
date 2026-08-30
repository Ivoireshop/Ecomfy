import { useState } from "react";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { ModeSwitcher } from "@/components/studio/ModeSwitcher";
import { PromptComposer } from "@/components/studio/PromptComposer";
import { MediaFile } from "@/components/studio/MediaUploader";
import { StudioSettings } from "@/components/studio/AdvancedSettings";
import { GenerationCard } from "@/components/studio/GenerationCard";
import { EmptyState } from "@/components/studio/EmptyState";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Sparkles } from "lucide-react";

export default function Studio() {
  const [mode, setMode] = useState<"image" | "video">("image");
  const [prompt, setPrompt] = useState("");
  const [media, setMedia] = useState<MediaFile[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedResult, setGeneratedResult] = useState<string | null>(null);
  
  const [settings, setSettings] = useState<StudioSettings>({
    aspectRatio: "1:1",
    style: "professional",
    videoDuration: "10",
  });

  const handleGenerate = async () => {
    if (!prompt.trim() && media.length === 0) {
      toast.error("Veuillez entrer une description ou ajouter une image.");
      return;
    }

    setIsGenerating(true);
    setGeneratedResult(null);

    try {
      if (mode === "image") {
        const body: any = {
          mode: media.length > 0 ? "image-edit" : "text-to-image",
          prompt: prompt,
          style: settings.style,
          aspectRatio: settings.aspectRatio,
        };

        if (media.length > 0) {
          body.sourceImage = media[0].url;
        }

        const { data, error } = await supabase.functions.invoke("generate-ai-image", {
          body,
        });

        if (error) {
          const status = (error as any)?.status;
          if (status === 403 || status === 402) {
            window.dispatchEvent(new Event("open-credits-dialog"));
            throw new Error("Vous avez utilisé vos 3 générations gratuites. Veuillez recharger vos crédits IA ou souscrire à un abonnement.");
          }
          let serverMsg = "";
          try {
            if ((error as any).context && typeof (error as any).context.json === "function") {
              const errJson = await (error as any).context.json();
              if (errJson?.error) serverMsg = errJson.error;
            }
          } catch (_) {}
          throw new Error(serverMsg || "Le service de génération d'images rencontre une petite pause. Veuillez réessayer dans un instant.");
        }
        if (data?.error) throw new Error(data.error);

        setGeneratedResult(data.imageUrl);
        toast.success("Image générée avec succès !");
        
      } else {
        const { data, error } = await supabase.functions.invoke("generate-video", {
          body: {
            description: prompt,
            duration: parseInt(settings.videoDuration),
            referenceImages: media.map(m => m.url),
            platform: settings.aspectRatio === "9:16" ? "tiktok" : settings.aspectRatio === "16:9" ? "youtube" : "instagram",
            style: settings.style,
            productName: "Génération Studio",
            niche: "Créatif",
            price: "N/A"
          },
        });

        if (error) throw error;
        if (data?.error) throw new Error(data.error);

        if (data.videoId) {
          toast.info("Vidéo en cours de préparation, cela peut prendre quelques minutes...");
          
          const channel = supabase
            .channel(`video-progress-${data.videoId}`)
            .on(
              'postgres_changes',
              {
                event: 'UPDATE',
                schema: 'public',
                table: 'generated_videos',
                filter: `id=eq.${data.videoId}`,
              },
              (payload: any) => {
                if (payload.new.status === 'completed' && payload.new.video_url) {
                  setGeneratedResult(payload.new.video_url);
                  setIsGenerating(false);
                  toast.success("Vidéo générée avec succès !");
                  supabase.removeChannel(channel);
                } else if (payload.new.status === 'error') {
                  setIsGenerating(false);
                  toast.error("Erreur lors de la génération de la vidéo.");
                  supabase.removeChannel(channel);
                }
              }
            )
            .subscribe();
            
          return;
        } else if (data.videoUrl) {
          setGeneratedResult(data.videoUrl);
          toast.success("Vidéo générée avec succès !");
        }
      }
    } catch (error: any) {
      console.error("Generation error:", error);
      toast.error(error.message || "La génération n'a pas pu être terminée. Réessayez dans quelques instants.");
    }
    
    if (mode === "image" || !isGenerating) {
      setIsGenerating(false);
    }
  };

  const handleAnimateImage = async (url: string) => {
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = reader.result as string;
        setMedia([{
          id: Math.random().toString(36).substring(7),
          url: dataUrl,
          file: new File([blob], "generated_image.png", { type: "image/png" })
        }]);
        setMode("video");
        setPrompt("");
        setGeneratedResult(null);
        toast.info("Mode vidéo activé. Décrivez comment animer cette image !");
      };
      reader.readAsDataURL(blob);
    } catch (error) {
      toast.error("Erreur lors du transfert de l'image.");
    }
  };

  const handleDownload = () => {
    if (!generatedResult) return;
    const link = document.createElement("a");
    link.href = generatedResult;
    link.download = `ecomfy-${mode}-${Date.now()}.${mode === "video" ? "mp4" : "png"}`;
    link.click();
  };

  return (
    <div className="min-h-screen flex flex-col bg-background selection:bg-[#0E7C66]/20 relative overflow-x-hidden">
      {/* Background glow effects */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-96 bg-gradient-to-b from-[#0E7C66]/10 via-emerald-500/5 to-transparent blur-3xl pointer-events-none -z-10" />

      <Header />
      
      <main className="flex-1 flex flex-col relative w-full max-w-7xl mx-auto px-4 py-6 md:py-10">
        {/* Top Mode Switcher */}
        <div className="w-full flex justify-center mb-8 relative z-10">
          <ModeSwitcher 
            mode={mode} 
            onChange={(newMode) => {
              setMode(newMode);
            }} 
          />
        </div>

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col w-full relative">
          
          {!generatedResult && !isGenerating && (
            <EmptyState mode={mode} onSuggestionClick={(p) => setPrompt(p)} />
          )}

          {isGenerating && !generatedResult && (
            <div className="flex-1 flex flex-col items-center justify-center min-h-[350px] my-auto animate-in fade-in zoom-in duration-500">
              <div className="relative flex items-center justify-center w-24 h-24 bg-card rounded-3xl border border-border shadow-xl mb-6">
                <Loader2 className="w-12 h-12 text-[#0E7C66] animate-spin" />
                <Sparkles className="w-5 h-5 text-amber-500 absolute top-2 right-2 animate-bounce" />
              </div>
              <h3 className="text-2xl font-black text-foreground mb-2 tracking-tight">
                {mode === "image" ? "Génération DALL-E 3 HD en cours..." : "Génération vidéo IA en cours..."}
              </h3>
              <p className="text-muted-foreground text-sm max-w-md text-center font-medium leading-relaxed">
                L'intelligence artificielle compose votre rendu studio en qualité maximale. Cela prend quelques secondes.
              </p>
            </div>
          )}

          {generatedResult && (
            <GenerationCard
              url={generatedResult}
              mode={mode}
              onAnimateImage={handleAnimateImage}
              onDownload={handleDownload}
              onRegenerate={handleGenerate}
            />
          )}

          {/* Prompt Composer pinned at the bottom */}
          <div className="w-full mt-auto pt-6 sticky bottom-4 z-20">
            <PromptComposer
              prompt={prompt}
              setPrompt={setPrompt}
              media={media}
              setMedia={setMedia}
              mode={mode}
              settings={settings}
              setSettings={setSettings}
              onGenerate={handleGenerate}
              isGenerating={isGenerating}
            />
          </div>
        </div>
      </main>
      
      <Footer />
    </div>
  );
}
