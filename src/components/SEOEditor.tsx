import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Search, X, Plus } from "lucide-react";

interface SEOEditorProps {
  seoTitle: string;
  seoDescription: string;
  seoKeywords: string[];
  ogImageUrl: string;
  onSEOChange: (field: string, value: any) => void;
}

export const SEOEditor = ({
  seoTitle,
  seoDescription,
  seoKeywords,
  ogImageUrl,
  onSEOChange,
}: SEOEditorProps) => {
  const [newKeyword, setNewKeyword] = useState("");

  const handleAddKeyword = () => {
    if (!newKeyword.trim()) {
      toast.error("Veuillez entrer un mot-clé");
      return;
    }
    
    const keywords = [...seoKeywords, newKeyword.trim()];
    onSEOChange("seoKeywords", keywords);
    setNewKeyword("");
    toast.success("Mot-clé ajouté");
  };

  const handleRemoveKeyword = (index: number) => {
    const keywords = seoKeywords.filter((_, i) => i !== index);
    onSEOChange("seoKeywords", keywords);
    toast.success("Mot-clé supprimé");
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Search className="h-5 w-5" />
          Optimisation SEO
        </CardTitle>
        <CardDescription>
          Optimisez votre site pour les moteurs de recherche et les réseaux sociaux
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label htmlFor="seoTitle">Titre SEO</Label>
          <Input
            id="seoTitle"
            value={seoTitle}
            onChange={(e) => onSEOChange("seoTitle", e.target.value)}
            placeholder="Titre optimisé pour les moteurs de recherche (max 60 caractères)"
            maxLength={60}
          />
          <p className="text-xs text-muted-foreground mt-1">
            {seoTitle.length}/60 caractères
          </p>
        </div>

        <div>
          <Label htmlFor="seoDescription">Description SEO</Label>
          <Textarea
            id="seoDescription"
            value={seoDescription}
            onChange={(e) => onSEOChange("seoDescription", e.target.value)}
            placeholder="Description pour les résultats de recherche (max 160 caractères)"
            maxLength={160}
            rows={3}
          />
          <p className="text-xs text-muted-foreground mt-1">
            {seoDescription.length}/160 caractères
          </p>
        </div>

        <div>
          <Label>Mots-clés SEO</Label>
          <div className="flex gap-2 mb-2">
            <Input
              value={newKeyword}
              onChange={(e) => setNewKeyword(e.target.value)}
              placeholder="Ajouter un mot-clé"
              onKeyPress={(e) => e.key === "Enter" && handleAddKeyword()}
            />
            <Button onClick={handleAddKeyword} size="icon">
              <Plus className="h-4 w-4" />
            </Button>
          </div>
          <div className="flex flex-wrap gap-2">
            {seoKeywords.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aucun mot-clé ajouté</p>
            ) : (
              seoKeywords.map((keyword, index) => (
                <Badge key={index} variant="secondary" className="gap-1">
                  {keyword}
                  <button
                    onClick={() => handleRemoveKeyword(index)}
                    className="ml-1 hover:text-destructive"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))
            )}
          </div>
        </div>

        <div>
          <Label htmlFor="ogImageUrl">Image de partage social (Open Graph)</Label>
          <Input
            id="ogImageUrl"
            value={ogImageUrl}
            onChange={(e) => onSEOChange("ogImageUrl", e.target.value)}
            placeholder="URL de l'image pour le partage sur les réseaux sociaux"
          />
          {ogImageUrl && (
            <div className="mt-2">
              <img
                src={ogImageUrl}
                alt="OG Preview"
                className="w-full max-w-sm rounded-lg border"
              />
            </div>
          )}
        </div>

        <div className="pt-4 border-t space-y-2 text-sm text-muted-foreground">
          <p><strong>💡 Conseils SEO :</strong></p>
          <ul className="list-disc list-inside space-y-1">
            <li>Utilisez des mots-clés pertinents dans le titre et la description</li>
            <li>Gardez le titre sous 60 caractères et la description sous 160 caractères</li>
            <li>Utilisez une image attrayante de 1200x630px pour le partage social</li>
            <li>Ajoutez 5-10 mots-clés pertinents pour votre activité</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
};
