import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Link as LinkIcon, Check, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";

interface BrandData {
  colors: string[];
  fonts: string[];
  logo: string | null;
  images: string[];
  companyName: string;
  description: string;
}

interface BrandExtractorProps {
  onBrandExtracted: (brandData: BrandData) => void;
  onEditRequested?: (brand: BrandData) => void;
}

export function BrandExtractor({ onBrandExtracted, onEditRequested }: BrandExtractorProps) {
  const [url, setUrl] = useState("");
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractedBrand, setExtractedBrand] = useState<BrandData | null>(null);

  const extractBrand = async () => {
    if (!url.trim()) {
      toast.error("Veuillez entrer une URL valide");
      return;
    }

    // Validate URL format
    try {
      new URL(url);
    } catch {
      toast.error("Format d'URL invalide. Exemple: https://example.com");
      return;
    }

    setIsExtracting(true);
    try {
      const { data, error } = await supabase.functions.invoke("extract-brand", {
        body: { url },
      });

      if (error) throw error;

      if (data?.brandData) {
        setExtractedBrand(data.brandData);
        toast.success("Marque extraite avec succès !");
      } else {
        toast.error("Impossible d'extraire les données de la marque");
      }
    } catch (error: any) {
      console.error("Error extracting brand:", error);
      toast.error(error?.message || "Une erreur est survenue lors de l'extraction");
    } finally {
      setIsExtracting(false);
    }
  };

  const handleUseBrand = () => {
    if (!extractedBrand) return;
    onBrandExtracted(extractedBrand);
    toast.success("Données de marque appliquées avec succès !");
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <LinkIcon className="h-5 w-5" />
          Extraction Automatique de Marque
        </CardTitle>
        <CardDescription>
          Entrez l'URL de votre site web pour extraire automatiquement vos couleurs, logo et style
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <div className="flex-1">
            <Label htmlFor="brand-url">URL du site web</Label>
            <Input
              id="brand-url"
              type="url"
              placeholder="https://votre-site.com"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyPress={(e) => e.key === "Enter" && extractBrand()}
            />
          </div>
          <div className="flex items-end">
            <Button
              onClick={extractBrand}
              disabled={isExtracting || !url.trim()}
            >
              {isExtracting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Extraction...
                </>
              ) : (
                <>
                  <Sparkles className="mr-2 h-4 w-4" />
                  Extraire
                </>
              )}
            </Button>
          </div>
        </div>

        {extractedBrand && (
          <div className="space-y-4 p-4 bg-muted/50 rounded-lg border">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold flex items-center gap-2">
                <Check className="h-4 w-4 text-green-500" />
                Marque extraite
              </h3>
              <div className="flex items-center gap-2">
                {onEditRequested && (
                  <Button variant="outline" size="sm" onClick={() => onEditRequested(extractedBrand)}>
                    Modifier
                  </Button>
                )}
                <Button onClick={handleUseBrand} size="sm">
                  Utiliser cette marque
                </Button>
              </div>
            </div>

            <div className={onEditRequested ? "cursor-pointer" : ""} onClick={() => onEditRequested?.(extractedBrand)}>
              <Label className="text-xs text-muted-foreground">Nom de l'entreprise</Label>
              <p className="font-medium">
                {extractedBrand.companyName?.trim() ? extractedBrand.companyName : "Non spécifié"}
              </p>
            </div>

            <div className={onEditRequested ? "cursor-pointer" : ""} onClick={() => onEditRequested?.(extractedBrand)}>
              <Label className="text-xs text-muted-foreground">Description</Label>
              <p className="text-sm">
                {extractedBrand.description?.trim() ? extractedBrand.description : "Non spécifié"}
              </p>
            </div>

            {extractedBrand.colors.length > 0 && (
              <div>
                <Label className="text-xs text-muted-foreground">Palette de couleurs</Label>
                <div className="flex gap-2 mt-2 flex-wrap">
                  {extractedBrand.colors.map((color, idx) => (
                    <div key={idx} className="flex flex-col items-center gap-1">
                      <div
                        className="w-12 h-12 rounded-md border-2 border-border shadow-sm"
                        style={{ backgroundColor: color }}
                      />
                      <span className="text-xs font-mono">{color}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {extractedBrand.fonts.length > 0 && (
              <div>
                <Label className="text-xs text-muted-foreground">Polices détectées</Label>
                <div className="flex gap-2 mt-2 flex-wrap">
                  {extractedBrand.fonts.map((font, idx) => (
                    <Badge key={idx} variant="secondary">
                      {font}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {extractedBrand.logo && (
              <div>
                <Label className="text-xs text-muted-foreground">Logo détecté</Label>
                <img
                  src={extractedBrand.logo}
                  alt="Logo"
                  className="mt-2 max-w-[200px] max-h-[100px] object-contain bg-white p-2 rounded border"
                />
              </div>
            )}

            {extractedBrand.images.length > 0 && (
              <div>
                <Label className="text-xs text-muted-foreground">
                  Images clés ({extractedBrand.images.length})
                </Label>
                <div className="grid grid-cols-3 gap-2 mt-2">
                  {extractedBrand.images.slice(0, 6).map((img, idx) => (
                    <img
                      key={idx}
                      src={img}
                      alt={`Image ${idx + 1}`}
                      className="w-full aspect-video object-cover rounded border"
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
