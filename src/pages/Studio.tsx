import { useState, useEffect } from "react";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { ModeSwitcher } from "@/components/studio/ModeSwitcher";
import { PromptComposer } from "@/components/studio/PromptComposer";
import { MediaFile } from "@/components/studio/MediaUploader";
import { AdvancedSettings, StudioSettings } from "@/components/studio/AdvancedSettings";
import { GenerationCard } from "@/components/studio/GenerationCard";
import { EmptyState } from "@/components/studio/EmptyState";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

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
        // Image Generation
        const body: any = {
          mode: media.length > 0 ? "image-edit" : "text-to-image",
          prompt: prompt,
          style: settings.style,
          // Extract format/ratio if needed by backend, currently handled in edge function
        };

        if (media.length > 0) {
          body.sourceImage = media[0].url; // Current backend only supports 1 image for sourceImage
        }

        const { data, error } = await supabase.functions.invoke("generate-ai-image", {
          body,
        });

        if (error) throw error;
        if (data?.error) throw new Error(data.error);

        setGeneratedResult(data.imageUrl);
        toast.success("Image générée avec succès !");
        
      } else {
        // Video Generation
        const { data, error } = await supabase.functions.invoke("generate-video", {
          body: {
            description: prompt,
            duration: parseInt(settings.videoDuration),
            referenceImages: media.map(m => m.url),
            platform: settings.aspectRatio === "9:16" ? "tiktok" : settings.aspectRatio === "16:9" ? "youtube" : "instagram",
            style: settings.style,
            productName: "Génération Studio", // Fallback for required fields if any
            niche: "Créatif",
            price: "N/A"
          },
        });

        if (error) throw error;
        if (data?.error) throw new Error(data.error);

        // Videos usually return videoId and require polling/listening, but here we'll assume it returns videoUrl directly or sets up the channel.
        // Let's implement a simplified channel listener if a videoId is returned.
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
            
          // Do not set isGenerating to false here, wait for the channel update
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
    
    // For images or immediate video response
    if (mode === "image" || !isGenerating) {
      setIsGenerating(false);
    }
  };

  const handleAnimateImage = async (url: string) => {
    // Convert url to MediaFile (we need the base64, so we might need to fetch it or just pass the URL if backend supports it)
    // For simplicity, we can fetch it to base64, but let's assume we can pass the URL or we just keep it as is.
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
        setPrompt(""); // Clear prompt to let user write the animation instructions
        setGeneratedResult(null); // Clear the image result to show the composer clearly
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
    <div className="min-h-screen flex flex-col bg-background selection:bg-primary/20">
      <Header />
      
      <main className="flex-1 flex flex-col relative w-full max-w-[1400px] mx-auto px-4 py-6 mt-16 md:mt-20 overflow-x-hidden">
        {/* Top Controls */}
        <div className="w-full flex justify-center mb-6 relative z-10">
          <ModeSwitcher mode={mode} onChange={(newMode) => {
            setMode(newMode);
            // Optionally clear generated result when switching modes
          }} />
        </div>

        {/* Dynamic Content Area */}
        <div className="flex-1 flex flex-col w-full relative">
          
          {!generatedResult && !isGenerating && (
            <EmptyState mode={mode} onSuggestionClick={(p) => setPrompt(p)} />
          )}

          {isGenerating && !generatedResult && (
            <div className="flex-1 flex flex-col items-center justify-center min-h-[300px] animate-in fade-in zoom-in duration-500">
              <div className="relative flex items-center justify-center w-20 h-20 bg-muted rounded-2xl shadow-inner mb-6">
                <Loader2 className="w-10 h-10 text-primary animate-spin" />
              </div>
              <h3 className="text-xl font-semibold mb-2 text-foreground">
                {mode === "image" ? "Création de votre image..." : "Génération de votre vidéo..."}
              </h3>
              <p className="text-muted-foreground text-sm max-w-sm text-center">
                L'intelligence artificielle travaille sur votre requête. Cela prend généralement quelques secondes.
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
