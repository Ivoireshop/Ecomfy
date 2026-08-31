import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Upload, Sparkles, Send, Download, Image as ImageIcon, Wand2, RefreshCw, Youtube, Facebook, Instagram, Link } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface AdvancedImageGeneratorProps {
  onImageGenerated?: (imageUrl: string) => void;
}

type GenerationMode = "text-to-image" | "image-edit" | "banner" | "banner-replace";

interface BannerPreset {
  name: string;
  width: number;
  height: number;
  platform: string;
  icon: typeof Youtube;
}

const bannerPresets: BannerPreset[] = [
  { name: "YouTube Miniature", width: 1280, height: 720, platform: "youtube", icon: Youtube },
  { name: "YouTube Banner", width: 2560, height: 1440, platform: "youtube", icon: Youtube },
  { name: "Facebook Cover", width: 820, height: 312, platform: "facebook", icon: Facebook },
  { name: "Facebook Post", width: 1200, height: 630, platform: "facebook", icon: Facebook },
  { name: "TikTok Cover", width: 1080, height: 1920, platform: "tiktok", icon: ImageIcon },
  { name: "Instagram Post", width: 1080, height: 1080, platform: "instagram", icon: Instagram },
  { name: "Instagram Story", width: 1080, height: 1920, platform: "instagram", icon: Instagram },
  { name: "LinkedIn Banner", width: 1584, height: 396, platform: "linkedin", icon: ImageIcon },
  { name: "Twitter/X Header", width: 1500, height: 500, platform: "twitter", icon: ImageIcon },
];

// Function to extract YouTube video ID and get thumbnail
const extractYouTubeThumbnail = (url: string): string | null => {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/,
  ];
  
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match && match[1]) {
      // Return the maxresdefault thumbnail (highest quality)
      return `https://img.youtube.com/vi/${match[1]}/maxresdefault.jpg`;
    }
  }
  return null;
};

export function AdvancedImageGenerator({ onImageGenerated }: AdvancedImageGeneratorProps) {
  const [mode, setMode] = useState<GenerationMode>("text-to-image");
  const [prompt, setPrompt] = useState("");
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [bannerToReplace, setBannerToReplace] = useState<string | null>(null);
  const [replacementPhoto, setReplacementPhoto] = useState<string | null>(null);
  const [newText, setNewText] = useState("");
  const [selectedPreset, setSelectedPreset] = useState<BannerPreset>(bannerPresets[0]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [style, setStyle] = useState("professional");
  
  // YouTube link states
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [isLoadingThumbnail, setIsLoadingThumbnail] = useState(false);

  const styles = [
    { value: "professional", label: "Professionnel" },
    { value: "creative", label: "Créatif" },
    { value: "minimalist", label: "Minimaliste" },
    { value: "vibrant", label: "Vibrant" },
    { value: "luxury", label: "Luxueux" },
    { value: "modern", label: "Moderne" },
  ];

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>, target: "main" | "banner" | "photo") => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Veuillez sélectionner un fichier image");
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      toast.error("L'image ne doit pas dépasser 10 Mo");
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      if (target === "main") {
        setUploadedImage(dataUrl);
      } else if (target === "banner") {
        setBannerToReplace(dataUrl);
        setYoutubeUrl(""); // Clear YouTube URL when uploading manually
      } else {
        setReplacementPhoto(dataUrl);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleYouTubeImport = async () => {
    if (!youtubeUrl.trim()) {
      toast.error("Veuillez entrer un lien YouTube");
      return;
    }

    setIsLoadingThumbnail(true);
    
    try {
      const thumbnailUrl = extractYouTubeThumbnail(youtubeUrl);
      
      if (!thumbnailUrl) {
        toast.error("Lien YouTube invalide. Utilisez un format comme youtube.com/watch?v=xxx ou youtu.be/xxx");
        return;
      }

      // Fetch the thumbnail and convert to base64
      const response = await fetch(thumbnailUrl);
      if (!response.ok) {
        // Try fallback to hqdefault if maxresdefault doesn't exist
        const videoId = youtubeUrl.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/)?.[1];
        if (videoId) {
          const fallbackUrl = `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
          const fallbackResponse = await fetch(fallbackUrl);
          if (fallbackResponse.ok) {
            const blob = await fallbackResponse.blob();
            const reader = new FileReader();
            reader.onload = () => {
              setBannerToReplace(reader.result as string);
              toast.success("Miniature YouTube importée avec succès !");
            };
            reader.readAsDataURL(blob);
            return;
          }
        }
        throw new Error("Impossible de récupérer la miniature");
      }

      const blob = await response.blob();
      const reader = new FileReader();
      reader.onload = () => {
        setBannerToReplace(reader.result as string);
        toast.success("Miniature YouTube importée avec succès !");
      };
      reader.readAsDataURL(blob);
      
    } catch (error) {
      console.error("Error fetching YouTube thumbnail:", error);
      toast.error("Erreur lors de l'import de la miniature. Vérifiez le lien.");
    } finally {
      setIsLoadingThumbnail(false);
    }
  };

  const generateImage = async () => {
    if (!prompt.trim() && mode !== "banner-replace") {
      toast.error("Veuillez entrer une description");
      return;
    }

    if ((mode === "image-edit") && !uploadedImage) {
      toast.error("Veuillez importer une image");
      return;
    }

    if (mode === "banner-replace" && (!bannerToReplace || !replacementPhoto)) {
      toast.error("Veuillez importer la bannière et votre photo");
      return;
    }

    setIsGenerating(true);

    try {
      const body: Record<string, unknown> = {
        mode,
        prompt: prompt || `Créer une bannière ${selectedPreset.name} professionnelle`,
        style,
      };

      if (mode === "image-edit" || mode === "banner") {
        body.sourceImage = uploadedImage;
      }

      if (mode === "banner" || mode === "banner-replace") {
        body.preset = selectedPreset;
      }

      if (mode === "banner-replace") {
        body.bannerImage = bannerToReplace;
        body.replacementPhoto = replacementPhoto;
        body.newText = newText;
      }

      const { data, error } = await supabase.functions.invoke("generate-ai-image", {
        body,
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      setGeneratedImage(data.imageUrl);
      onImageGenerated?.(data.imageUrl);
      toast.success("Image générée avec succès !");
    } catch (error: unknown) {
      console.error("Generation error:", error);
      const errorMessage = error instanceof Error ? error.message : "Erreur lors de la génération";
      toast.error(errorMessage);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDownload = () => {
    if (!generatedImage) return;
    
    const link = document.createElement("a");
    link.href = generatedImage;
    link.download = `ai-image-${Date.now()}.png`;
    link.click();
    toast.success("Image téléchargée !");
  };

  const resetForm = () => {
    setPrompt("");
    setUploadedImage(null);
    setBannerToReplace(null);
    setReplacementPhoto(null);
    setNewText("");
    setGeneratedImage(null);
    setYoutubeUrl("");
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Wand2 className="h-5 w-5 text-primary" />
          Génération IA Avancée
        </CardTitle>
        <CardDescription>
          Créez des images et bannières professionnelles - style ChatGPT
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <Tabs value={mode} onValueChange={(v) => { setMode(v as GenerationMode); resetForm(); }}>
          <TabsList className="grid w-full grid-cols-2 lg:grid-cols-4 h-auto">
            <TabsTrigger value="text-to-image" className="text-xs sm:text-sm py-2 flex flex-col sm:flex-row gap-1">
              <Sparkles className="h-3 w-3 sm:h-4 sm:w-4" />
              <span>Prompt</span>
            </TabsTrigger>
            <TabsTrigger value="image-edit" className="text-xs sm:text-sm py-2 flex flex-col sm:flex-row gap-1">
              <ImageIcon className="h-3 w-3 sm:h-4 sm:w-4" />
              <span>Image+Prompt</span>
            </TabsTrigger>
            <TabsTrigger value="banner" className="text-xs sm:text-sm py-2 flex flex-col sm:flex-row gap-1">
              <Youtube className="h-3 w-3 sm:h-4 sm:w-4" />
              <span>Bannières</span>
            </TabsTrigger>
            <TabsTrigger value="banner-replace" className="text-xs sm:text-sm py-2 flex flex-col sm:flex-row gap-1">
              <RefreshCw className="h-3 w-3 sm:h-4 sm:w-4" />
              <span>Remplacer</span>
            </TabsTrigger>
          </TabsList>

          {/* Text to Image Mode */}
          <TabsContent value="text-to-image" className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label>Description de l'image souhaitée</Label>
              <Textarea
                placeholder="Décrivez l'image que vous souhaitez générer... Ex: Une femme africaine souriante tenant un produit cosmétique, fond coloré moderne"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                rows={4}
                className="resize-none"
              />
            </div>

            <div className="space-y-2">
              <Label>Style</Label>
              <Select value={style} onValueChange={setStyle}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {styles.map((s) => (
                    <SelectItem key={s.value} value={s.value}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </TabsContent>

          {/* Image Edit Mode (like ChatGPT) */}
          <TabsContent value="image-edit" className="space-y-4 mt-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Importer votre image</Label>
                <div className="border-2 border-dashed rounded-lg p-4 text-center min-h-[150px] flex items-center justify-center">
                  {uploadedImage ? (
                    <div className="space-y-2">
                      <img 
                        src={uploadedImage} 
                        alt="Image importée" 
                        className="max-h-32 mx-auto rounded-lg object-contain"
                      />
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setUploadedImage(null)}
                      >
                        Changer l'image
                      </Button>
                    </div>
                  ) : (
                    <label className="cursor-pointer block w-full">
                      <Upload className="h-10 w-10 mx-auto text-muted-foreground mb-2" />
                      <p className="text-sm text-muted-foreground">Cliquez pour importer</p>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => handleImageUpload(e, "main")}
                        className="hidden"
                      />
                    </label>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <Label>Ce que vous voulez faire</Label>
                <Textarea
                  placeholder="Décrivez les modifications... Ex: Améliorer la qualité, ajouter un arrière-plan professionnel, retoucher les couleurs"
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  rows={4}
                  className="resize-none"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Style final</Label>
              <Select value={style} onValueChange={setStyle}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {styles.map((s) => (
                    <SelectItem key={s.value} value={s.value}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </TabsContent>

          {/* Banner Generation Mode */}
          <TabsContent value="banner" className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label>Type de bannière</Label>
              <Select 
                value={selectedPreset.name}
                onValueChange={(v) => {
                  const preset = bannerPresets.find((p) => p.name === v);
                  if (preset) setSelectedPreset(preset);
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {bannerPresets.map((preset) => (
                    <SelectItem key={preset.name} value={preset.name}>
                      <div className="flex items-center gap-2">
                        <preset.icon className="h-4 w-4" />
                        <span>{preset.name} ({preset.width}x{preset.height})</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Image de base (optionnel)</Label>
                <div className="border-2 border-dashed rounded-lg p-4 text-center min-h-[120px] flex items-center justify-center">
                  {uploadedImage ? (
                    <div className="space-y-2">
                      <img 
                        src={uploadedImage} 
                        alt="Image de base" 
                        className="max-h-24 mx-auto rounded-lg object-contain"
                      />
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setUploadedImage(null)}
                      >
                        Retirer
                      </Button>
                    </div>
                  ) : (
                    <label className="cursor-pointer block w-full">
                      <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                      <p className="text-xs text-muted-foreground">Votre photo (optionnel)</p>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => handleImageUpload(e, "main")}
                        className="hidden"
                      />
                    </label>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <Label>Description de la bannière</Label>
                <Textarea
                  placeholder="Décrivez votre bannière... Ex: Bannière YouTube moderne pour chaîne tech avec texte 'TUTORIELS IA'"
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  rows={4}
                  className="resize-none"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Style</Label>
              <Select value={style} onValueChange={setStyle}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {styles.map((s) => (
                    <SelectItem key={s.value} value={s.value}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </TabsContent>

          {/* Banner Replace Mode */}
          <TabsContent value="banner-replace" className="space-y-4 mt-4">
            <p className="text-sm text-muted-foreground bg-muted/50 p-3 rounded-lg">
              💡 Importez une bannière existante (ex: YouTube) ou collez un lien vidéo YouTube pour extraire sa miniature, puis remplacez la photo et le texte par les vôtres.
            </p>

            {/* YouTube Link Import */}
            <div className="space-y-2 p-4 border rounded-lg bg-card">
              <Label className="flex items-center gap-2">
                <Youtube className="h-4 w-4 text-red-500" />
                Importer depuis YouTube (optionnel)
              </Label>
              <div className="flex gap-2">
                <Input
                  placeholder="https://youtube.com/watch?v=xxx ou https://youtu.be/xxx"
                  value={youtubeUrl}
                  onChange={(e) => setYoutubeUrl(e.target.value)}
                  className="flex-1"
                />
                <Button
                  onClick={handleYouTubeImport}
                  disabled={isLoadingThumbnail || !youtubeUrl.trim()}
                  variant="secondary"
                >
                  {isLoadingThumbnail ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Link className="h-4 w-4" />
                  )}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Collez le lien d'une vidéo YouTube pour récupérer automatiquement sa miniature
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Bannière modèle à reproduire</Label>
                <div className="border-2 border-dashed rounded-lg p-4 text-center min-h-[120px] flex items-center justify-center">
                  {bannerToReplace ? (
                    <div className="space-y-2">
                      <img 
                        src={bannerToReplace} 
                        alt="Bannière source" 
                        className="max-h-24 mx-auto rounded-lg object-contain"
                      />
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => { setBannerToReplace(null); setYoutubeUrl(""); }}
                      >
                        Changer
                      </Button>
                    </div>
                  ) : (
                    <label className="cursor-pointer block w-full">
                      <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                      <p className="text-xs text-muted-foreground">Importer la bannière modèle</p>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => handleImageUpload(e, "banner")}
                        className="hidden"
                      />
                    </label>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <Label>Votre photo</Label>
                <div className="border-2 border-dashed rounded-lg p-4 text-center min-h-[120px] flex items-center justify-center">
                  {replacementPhoto ? (
                    <div className="space-y-2">
                      <img 
                        src={replacementPhoto} 
                        alt="Votre photo" 
                        className="max-h-24 mx-auto rounded-lg object-contain"
                      />
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setReplacementPhoto(null)}
                      >
                        Changer
                      </Button>
                    </div>
                  ) : (
                    <label className="cursor-pointer block w-full">
                      <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                      <p className="text-xs text-muted-foreground">Importer votre photo</p>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => handleImageUpload(e, "photo")}
                        className="hidden"
                      />
                    </label>
                  )}
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Nouveau texte pour la bannière</Label>
              <Textarea
                placeholder="Entrez le texte à afficher sur votre bannière... Ex: FORMATION IA - INSCRIVEZ-VOUS"
                value={newText}
                onChange={(e) => setNewText(e.target.value)}
                rows={2}
                className="resize-none"
              />
            </div>

            <div className="space-y-2">
              <Label>Instructions supplémentaires (optionnel)</Label>
              <Textarea
                placeholder="Décrivez les modifications... Ex: Garder le même style mais avec mes couleurs préférées (bleu et or)"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                rows={2}
                className="resize-none"
              />
            </div>

            <div className="space-y-2">
              <Label>Format de sortie</Label>
              <Select 
                value={selectedPreset.name}
                onValueChange={(v) => {
                  const preset = bannerPresets.find((p) => p.name === v);
                  if (preset) setSelectedPreset(preset);
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {bannerPresets.map((preset) => (
                    <SelectItem key={preset.name} value={preset.name}>
                      <div className="flex items-center gap-2">
                        <preset.icon className="h-4 w-4" />
                        <span>{preset.name} ({preset.width}x{preset.height})</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </TabsContent>
        </Tabs>

        {/* Generate Button */}
        <Button
          onClick={generateImage}
          disabled={isGenerating}
          className="w-full"
          size="lg"
        >
          {isGenerating ? (
            <>
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              Génération en cours...
            </>
          ) : (
            <>
              <Send className="mr-2 h-5 w-5" />
              Générer l'image
            </>
          )}
        </Button>

        {/* Generated Image Result */}
        {generatedImage && (
          <div className="space-y-4 pt-4 border-t">
            <h3 className="font-semibold flex items-center gap-2">
              <ImageIcon className="h-5 w-5 text-primary" />
              Image générée
            </h3>
            <div className="relative rounded-lg overflow-hidden border bg-muted/20">
              <img
                src={generatedImage}
                alt="Image générée par IA"
                className="w-full object-contain max-h-[400px]"
              />
            </div>
            <div className="flex gap-2">
              <Button onClick={handleDownload} variant="outline" className="flex-1">
                <Download className="mr-2 h-4 w-4" />
                Télécharger
              </Button>
              <Button onClick={() => setGeneratedImage(null)} variant="ghost">
                <RefreshCw className="mr-2 h-4 w-4" />
                Nouvelle
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
