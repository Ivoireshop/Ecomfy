import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Sparkles, Download, Check } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { ScrollArea } from "@/components/ui/scroll-area";

interface Variation {
  id: string;
  imageUrl: string;
  style: string;
  description: string;
}

interface VariationGeneratorProps {
  productData: {
    productName: string;
    niche: string;
    description: string;
    platform: string;
    price: string;
    benefits?: string;
    productType?: string;
    features?: string;
    keywords?: string;
    colors?: string[];
  };
  onVariationSelected: (imageUrl: string) => void;
  numberOfVariations?: number;
  autoGenerate?: boolean;
}

export function VariationGenerator({
  productData,
  onVariationSelected,
  numberOfVariations = 5,
  autoGenerate = false,
}: VariationGeneratorProps) {
  const [variations, setVariations] = useState<Variation[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [selectedVariation, setSelectedVariation] = useState<string | null>(null);

  // Auto-generate when component mounts if autoGenerate is true
  useEffect(() => {
    if (autoGenerate && variations.length === 0 && !isGenerating) {
      generateVariations();
    }
  }, [autoGenerate]);

  const styles = [
    { name: "Moderne", prompt: "modern, clean, minimalist design with sharp edges" },
    { name: "Luxe", prompt: "luxury, elegant, premium, high-end sophisticated" },
    { name: "Vibrant", prompt: "vibrant colors, energetic, dynamic, bold" },
    { name: "Nature", prompt: "natural, organic, earthy tones, eco-friendly" },
    { name: "Futuriste", prompt: "futuristic, tech, neon, cyberpunk" },
  ];

  const generateVariations = async () => {
    if (!productData.productName || !productData.niche) {
      toast.error("Données produit manquantes");
      return;
    }

    setIsGenerating(true);
    setVariations([]);

    try {
      const stylesToGenerate = styles.slice(0, numberOfVariations);
      
      // Build enhanced prompt with brand data
      const enhancedDescription = [
        productData.description,
        productData.productType && `Type: ${productData.productType}`,
        productData.features && `Caractéristiques: ${productData.features}`,
        productData.benefits || productData.benefits,
        productData.keywords && `Mots-clés: ${productData.keywords}`,
      ].filter(Boolean).join(". ");

      // Generate all variations in parallel
      const generationPromises = stylesToGenerate.map(async (style) => {
        const { data, error } = await supabase.functions.invoke("generate-ad-visual", {
          body: {
            productName: productData.productName,
            niche: productData.niche,
            description: enhancedDescription,
            platform: productData.platform,
            price: productData.price,
            benefits: productData.benefits,
            style: `${style.prompt}, adapté au marché africain, professionnel et moderne`,
            fast: true,
            variationMode: true,
            colors: productData.colors,
          },
        });

        if (error) throw error;

        return {
          id: `var-${Math.random().toString(36).substring(7)}`,
          imageUrl: data.imageUrl,
          style: style.name,
          description: `Style ${style.name} - ${productData.productName}`,
        };
      });

      // Show progress
      let completedCount = 0;
      const totalCount = generationPromises.length;

      const progressToasts = generationPromises.map((promise) =>
        promise.then((variation) => {
          completedCount++;
          setVariations((prev) => [...prev, variation]);
          toast.success(`Variation ${completedCount}/${totalCount} générée`);
          return variation;
        })
      );

      await Promise.all(progressToasts);
      toast.success("Toutes les variations ont été générées !");
    } catch (error: any) {
      console.error("Error generating variations:", error);
      toast.error(error?.message || "Erreur lors de la génération des variations");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSelectVariation = (variation: Variation) => {
    setSelectedVariation(variation.id);
    onVariationSelected(variation.imageUrl);
    toast.success(`Variation "${variation.style}" sélectionnée`);
  };

  const handleDownloadVariation = (variation: Variation) => {
    const link = document.createElement("a");
    link.href = variation.imageUrl;
    link.download = `variation-${variation.style}-${Date.now()}.png`;
    link.click();
    toast.success("Variation téléchargée");
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="h-5 w-5" />
          Générer des Variations
        </CardTitle>
        <CardDescription>
          Créez {numberOfVariations} variations différentes de votre annonce avec différents styles
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Button
          onClick={generateVariations}
          disabled={isGenerating || variations.length > 0}
          className="w-full"
          size="lg"
        >
          {isGenerating ? (
            <>
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              Génération en cours... ({variations.length}/{numberOfVariations})
            </>
          ) : variations.length > 0 ? (
            <>
              <Check className="mr-2 h-5 w-5" />
              {variations.length} variations générées
            </>
          ) : (
            <>
              <Sparkles className="mr-2 h-5 w-5" />
              Générer {numberOfVariations} Variations
            </>
          )}
        </Button>

        {variations.length > 0 && (
          <ScrollArea className="h-[500px]">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pr-4">
              {variations.map((variation) => (
                <Card
                  key={variation.id}
                  className={`cursor-pointer transition-all hover:shadow-lg ${
                    selectedVariation === variation.id
                      ? "ring-2 ring-primary border-primary"
                      : "hover:border-primary/50"
                  }`}
                  onClick={() => handleSelectVariation(variation)}
                >
                  <CardContent className="p-4 space-y-3">
                    <div className="relative">
                      <img
                        src={variation.imageUrl}
                        alt={variation.description}
                        className="w-full aspect-square object-cover rounded-lg"
                      />
                      {selectedVariation === variation.id && (
                        <div className="absolute top-2 right-2 bg-primary text-primary-foreground rounded-full p-2">
                          <Check className="h-4 w-4" />
                        </div>
                      )}
                    </div>
                    <div className="flex items-center justify-between">
                      <Badge variant="secondary">{variation.style}</Badge>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDownloadVariation(variation);
                        }}
                      >
                        <Download className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
