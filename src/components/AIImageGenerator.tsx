import { useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2, Sparkles, Download, Volume2, Play, Pause } from "lucide-react";
import { Switch } from "@/components/ui/switch";

interface AIImageGeneratorProps {
  onImageGenerated: (imageUrl: string, imageType: "logo" | "hero" | "about") => void;
}

const imageTypes = [
  { value: "logo", label: "Logo" },
  { value: "hero", label: "Image Hero" },
  { value: "about", label: "Image À propos" },
];

// Voix avec accent africain authentique via Eleven Labs
const voices = [
  { value: "Alice", label: "Alice (Féminine - Accent Africain)" },
  { value: "Matilda", label: "Matilda (Féminine - Accent Africain)" },
  { value: "Jessica", label: "Jessica (Féminine - Accent West African)" },
  { value: "Callum", label: "Callum (Masculin - Accent Africain)" },
  { value: "George", label: "George (Masculin - Accent Africain)" },
  { value: "Daniel", label: "Daniel (Masculin - Accent West African)" },
];

export const AIImageGenerator = ({ onImageGenerated }: AIImageGeneratorProps) => {
  const [prompt, setPrompt] = useState("");
  const [imageType, setImageType] = useState<"logo" | "hero" | "about">("hero");
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  
  // Voix off states
  const [enableVoiceover, setEnableVoiceover] = useState(false);
  const [voiceoverText, setVoiceoverText] = useState("");
  const [selectedVoice, setSelectedVoice] = useState("Alice");
  const [isGeneratingVoice, setIsGeneratingVoice] = useState(false);
  const [generatedAudio, setGeneratedAudio] = useState<string | null>(null);
  const [generatedAudioBase64, setGeneratedAudioBase64] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isCreatingVideo, setIsCreatingVideo] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);

  const generateImage = async () => {
    if (!prompt.trim()) {
      toast.error("Veuillez entrer une description pour l'image");
      return;
    }

    setIsGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-ad-visual", {
        body: {
          prompt,
          productName: `${imageType}-image`,
          category: imageType === "logo" ? "logo" : "website-visual",
          fast: false, // Generate all formats
        },
      });

      if (error) throw error;

      if (data?.imageUrl) {
        setGeneratedImage(data.imageUrl);
        toast.success("Image générée et sauvegardée dans la bibliothèque !");
      } else {
        toast.error("Erreur lors de la génération de l'image");
      }
    } catch (error: any) {
      console.error("Error generating image:", error);
      const status = error?.status as number | undefined;
      if (status === 401) toast.error("Session expirée. Veuillez vous reconnecter.");
      else if (status === 402) toast.error("Crédits IA insuffisants. Réessayez plus tard ou ajoutez des crédits.");
      else if (status === 429) toast.error("Trop de requêtes. Patientez un instant et réessayez.");
      else toast.error(error?.message || "Une erreur est survenue lors de la génération");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleUseImage = () => {
    if (!generatedImage) return;
    onImageGenerated(generatedImage, imageType);
    toast.success(`Image ${imageType} appliquée avec succès !`);
    setGeneratedImage(null);
    setPrompt("");
  };

  const handleDownload = () => {
    if (!generatedImage) return;
    const link = document.createElement("a");
    link.href = generatedImage;
    link.download = `${imageType}-generated.png`;
    link.click();
    toast.success("Image téléchargée !");
  };

  const generateVoiceover = async () => {
    if (!voiceoverText.trim()) {
      toast.error("Veuillez entrer un texte pour la voix off");
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
        toast.success("Voix off générée avec succès !");
      } else {
        toast.error("Erreur lors de la génération de la voix off");
      }
    } catch (error: any) {
      console.error("Error generating voiceover:", error);
      toast.error(error?.message || "Une erreur est survenue lors de la génération de la voix off");
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
    toast.success("Voix off téléchargée !");
  };

  const createVideoMP4 = async () => {
    if (!generatedImage || !generatedAudioBase64) {
      toast.error("Image et voix off nécessaires pour créer la vidéo");
      return;
    }

    setIsCreatingVideo(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-video-from-image", {
        body: {
          imageUrl: generatedImage,
          audioBase64: generatedAudioBase64,
          duration: 10,
        },
      });

      if (error) throw error;

      if (data?.videoUrl) {
        // Télécharger la vidéo
        const link = document.createElement("a");
        link.href = data.videoUrl;
        link.download = `video-publicitaire-${Date.now()}.mp4`;
        link.click();
        toast.success("Vidéo MP4 créée et téléchargée !");
      } else if (data?.audioUrl) {
        // Fallback: télécharger image et audio séparément
        toast.info("Téléchargement de l'image et de l'audio séparément");
        
        // Télécharger l'image
        const imgLink = document.createElement("a");
        imgLink.href = generatedImage;
        imgLink.download = `image-${Date.now()}.png`;
        imgLink.click();
        
        // Télécharger l'audio
        setTimeout(() => {
          const audioLink = document.createElement("a");
          audioLink.href = data.audioUrl;
          audioLink.download = `audio-${Date.now()}.mp3`;
          audioLink.click();
        }, 500);
        
        toast.success("Image et audio téléchargés séparément");
      } else {
        toast.error("Erreur lors de la création de la vidéo");
      }
    } catch (error: any) {
      console.error("Error creating video:", error);
      toast.error(error?.message || "Une erreur est survenue lors de la création de la vidéo");
    } finally {
      setIsCreatingVideo(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="h-5 w-5" />
          Génération d'images IA
        </CardTitle>
        <CardDescription>
          Créez des images personnalisées pour votre site vitrine avec l'IA
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label htmlFor="imageType">Type d'image</Label>
          <Select value={imageType} onValueChange={(value: any) => setImageType(value)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {imageTypes.map((type) => (
                <SelectItem key={type.value} value={type.value}>
                  {type.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label htmlFor="prompt">Description de l'image</Label>
          <Textarea
            id="prompt"
            placeholder="Ex: Un logo moderne pour une entreprise de formation digitale, avec des couleurs bleues et oranges"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            rows={4}
          />
        </div>

        <Button
          onClick={generateImage}
          disabled={isGenerating || !prompt.trim()}
          className="w-full"
        >
          {isGenerating ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Génération en cours...
            </>
          ) : (
            <>
              <Sparkles className="mr-2 h-4 w-4" />
              Générer l'image
            </>
          )}
        </Button>

        <div className="flex items-center justify-between pt-4 border-t">
          <div className="flex items-center gap-2">
            <Volume2 className="h-4 w-4" />
            <Label htmlFor="voiceover-toggle">Ajouter une voix off</Label>
          </div>
          <Switch
            id="voiceover-toggle"
            checked={enableVoiceover}
            onCheckedChange={setEnableVoiceover}
          />
        </div>

        {enableVoiceover && (
          <div className="space-y-4 p-4 bg-muted/50 rounded-lg">
            <div>
              <Label htmlFor="voiceover-text">Texte de la voix off</Label>
              <Textarea
                id="voiceover-text"
                placeholder="Ex: Découvrez notre nouvelle collection de formations digitales..."
                value={voiceoverText}
                onChange={(e) => setVoiceoverText(e.target.value)}
                rows={3}
              />
            </div>

            <div>
              <Label htmlFor="voice">Voix</Label>
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

            <Button
              onClick={generateVoiceover}
              disabled={isGeneratingVoice || !voiceoverText.trim()}
              className="w-full"
              variant="secondary"
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

            {generatedAudio && (
              <div className="space-y-2">
                <audio
                  ref={audioRef}
                  src={generatedAudio}
                  onEnded={() => setIsPlaying(false)}
                  className="hidden"
                />
                <div className="flex gap-2">
                  <Button
                    onClick={togglePlayPause}
                    variant="outline"
                    size="icon"
                  >
                    {isPlaying ? (
                      <Pause className="h-4 w-4" />
                    ) : (
                      <Play className="h-4 w-4" />
                    )}
                  </Button>
                  <Button
                    onClick={handleDownloadAudio}
                    variant="outline"
                    size="icon"
                  >
                    <Download className="h-4 w-4" />
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Voix off prête avec accent africain authentique
                </p>
              </div>
            )}
          </div>
        )}

        {generatedImage && (
          <div className="space-y-4 pt-4 border-t">
            <div className="relative">
              <img
                src={generatedImage}
                alt="Generated"
                className="w-full rounded-lg border"
              />
            </div>
            <div className="space-y-2">
              <div className="flex gap-2">
                <Button onClick={handleUseImage} className="flex-1">
                  Utiliser cette image
                </Button>
                <Button onClick={handleDownload} variant="outline" size="icon">
                  <Download className="h-4 w-4" />
                </Button>
              </div>
              
              {enableVoiceover && generatedAudio && generatedImage && (
                <Button 
                  onClick={createVideoMP4} 
                  disabled={isCreatingVideo}
                  className="w-full"
                  variant="secondary"
                >
                  {isCreatingVideo ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Création de la vidéo MP4...
                    </>
                  ) : (
                    <>
                      <Download className="mr-2 h-4 w-4" />
                      Télécharger vidéo MP4 (Image + Voix Off)
                    </>
                  )}
                </Button>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
