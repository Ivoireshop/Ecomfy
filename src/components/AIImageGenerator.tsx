import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2, Sparkles, Download } from "lucide-react";

interface AIImageGeneratorProps {
  onImageGenerated: (imageUrl: string, imageType: "logo" | "hero" | "about") => void;
}

const imageTypes = [
  { value: "logo", label: "Logo" },
  { value: "hero", label: "Image Hero" },
  { value: "about", label: "Image À propos" },
];

export const AIImageGenerator = ({ onImageGenerated }: AIImageGeneratorProps) => {
  const [prompt, setPrompt] = useState("");
  const [imageType, setImageType] = useState<"logo" | "hero" | "about">("hero");
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);

  const generateImage = async () => {
    if (!prompt.trim()) {
      toast.error("Veuillez entrer une description pour l'image");
      return;
    }

    setIsGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-ad-visual", {
        body: {
          prompt: prompt,
          productName: `${imageType}-image`,
          category: imageType === "logo" ? "logo" : "website-visual",
        },
      });

      if (error) throw error;

      if (data.imageUrl) {
        setGeneratedImage(data.imageUrl);
        toast.success("Image générée avec succès !");
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

        {generatedImage && (
          <div className="space-y-4 pt-4 border-t">
            <div className="relative">
              <img
                src={generatedImage}
                alt="Generated"
                className="w-full rounded-lg border"
              />
            </div>
            <div className="flex gap-2">
              <Button onClick={handleUseImage} className="flex-1">
                Utiliser cette image
              </Button>
              <Button onClick={handleDownload} variant="outline" size="icon">
                <Download className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
