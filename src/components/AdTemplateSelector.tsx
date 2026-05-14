import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Check } from "lucide-react";
import { toast } from "sonner";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import exampleHandbag from "@/assets/example-handbag-ad.jpg";
import examplePhone from "@/assets/example-phone-ad.jpg";
import exampleFood from "@/assets/example-food-ad.jpg";
import exampleBeauty from "@/assets/example-beauty-ad.jpg";
import exampleFitness from "@/assets/example-fitness-ad.jpg";
import exampleRealestate from "@/assets/example-realestate-ad.jpg";
import exampleFashion from "@/assets/example-fashion-ad.jpg";
import exampleServices from "@/assets/example-services-ad.jpg";
import exampleTech from "@/assets/example-tech-ad.jpg";

const categoryImages: Record<string, string> = {
  "e-commerce": exampleHandbag,
  "immobilier": exampleRealestate,
  "beaute": exampleBeauty,
  "alimentation": exampleFood,
  "fitness": exampleFitness,
  "mode": exampleFashion,
  "technologie": exampleTech,
  "services": exampleServices,
};

interface AdTemplate {
  id: string;
  name: string;
  category: string;
  description: string;
  thumbnail_url: string | null;
  style_preset: string;
  animation_preset: string;
  prompt_template: string;
  animation_prompt_template: string;
  color_palette: any;
  recommended_duration: number;
  recommended_platforms: string[];
}

interface AdTemplateSelectorProps {
  selectedTemplateId: string | null;
  onSelectTemplate: (template: AdTemplate | null) => void;
}

const categoryLabels: Record<string, string> = {
  "e-commerce": "E-commerce",
  "immobilier": "Immobilier",
  "beaute": "Beauté",
  "alimentation": "Food & Restaurant",
  "fitness": "Fitness & Sport",
  "mode": "Mode & Fashion",
  "technologie": "Tech & Gadgets",
  "services": "Services Pro",
};

const categoryIcons: Record<string, string> = {
  "e-commerce": "🛍️",
  "immobilier": "🏠",
  "beaute": "💄",
  "alimentation": "🍔",
  "fitness": "💪",
  "mode": "👔",
  "technologie": "📱",
  "services": "💼",
};

export function AdTemplateSelector({ selectedTemplateId, onSelectTemplate }: AdTemplateSelectorProps) {
  const [templates, setTemplates] = useState<AdTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  useEffect(() => {
    loadTemplates();
  }, []);

  const loadTemplates = async () => {
    try {
      const { data, error } = await supabase
        .from("ad_templates")
        .select("*")
        .eq("is_active", true)
        .order("category", { ascending: true })
        .order("name", { ascending: true });

      if (error) throw error;

      setTemplates(data || []);
    } catch (error) {
      console.error("Erreur chargement templates:", error);
      toast.error("Impossible de charger les templates");
    } finally {
      setIsLoading(false);
    }
  };

  const categories = Array.from(new Set(templates.map(t => t.category)));

  const filteredTemplates = selectedCategory
    ? templates.filter(t => t.category === selectedCategory)
    : templates;

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="flex gap-2 flex-wrap">
          {[1, 2, 3, 4].map(i => (
            <Skeleton key={i} className="h-8 w-24" />
          ))}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => (
            <Skeleton key={i} className="h-48" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Sparkles className="w-5 h-5 text-primary" />
        <h3 className="text-lg font-semibold">Templates Prédéfinis</h3>
      </div>

      {/* Category filters */}
      <div className="flex gap-2 flex-wrap">
        <Badge
          variant={selectedCategory === null ? "default" : "outline"}
          className="cursor-pointer"
          onClick={() => setSelectedCategory(null)}
        >
          Tous
        </Badge>
        {categories.map(category => (
          <Badge
            key={category}
            variant={selectedCategory === category ? "default" : "outline"}
            className="cursor-pointer"
            onClick={() => setSelectedCategory(category)}
          >
            {categoryIcons[category]} {categoryLabels[category]}
          </Badge>
        ))}
      </div>

      {/* Templates grid */}
      <ScrollArea className="h-[400px] pr-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Default "Sans template" option */}
          <Card
            className={`cursor-pointer transition-all hover:shadow-lg ${
              selectedTemplateId === null
                ? "ring-2 ring-primary border-primary"
                : "hover:border-primary/50"
            }`}
            onClick={() => onSelectTemplate(null)}
          >
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <CardTitle className="text-base flex items-center gap-2">
                    ✨ Sans Template
                    {selectedTemplateId === null && (
                      <Check className="w-4 h-4 text-primary" />
                    )}
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Mode libre - Personnalisez tout
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pb-3">
              <div className="aspect-video bg-gradient-to-br from-primary/20 to-secondary/20 rounded-md flex items-center justify-center">
                <Sparkles className="w-12 h-12 text-muted-foreground/30" />
              </div>
            </CardContent>
          </Card>

          {/* Template cards */}
          {filteredTemplates.map(template => (
            <Card
              key={template.id}
              className={`cursor-pointer transition-all hover:shadow-lg ${
                selectedTemplateId === template.id
                  ? "ring-2 ring-primary border-primary"
                  : "hover:border-primary/50"
              }`}
              onClick={() => onSelectTemplate(template)}
            >
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <CardTitle className="text-base flex items-center gap-2">
                      {categoryIcons[template.category]} {template.name}
                      {selectedTemplateId === template.id && (
                        <Check className="w-4 h-4 text-primary" />
                      )}
                    </CardTitle>
                    <CardDescription className="text-xs">
                      {template.description}
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pb-3 space-y-3">
                {/* Real category preview image */}
                <div className="aspect-video rounded-md overflow-hidden bg-muted relative">
                  {template.thumbnail_url || categoryImages[template.category] ? (
                    <img
                      src={template.thumbnail_url || categoryImages[template.category]}
                      alt={template.name}
                      loading="lazy"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-3xl">
                      {categoryIcons[template.category]}
                    </div>
                  )}
                  {/* Subtle color accent strip */}
                  <div className="absolute bottom-0 left-0 right-0 h-1.5 flex">
                    <div className="flex-1" style={{ backgroundColor: template.color_palette?.primary || "#2563eb" }} />
                    <div className="flex-1" style={{ backgroundColor: template.color_palette?.secondary || "#7c3aed" }} />
                    <div className="flex-1" style={{ backgroundColor: template.color_palette?.accent || "#f59e0b" }} />
                  </div>
                </div>

                {/* Info badges */}
                <div className="flex flex-wrap gap-1">
                  <Badge variant="secondary" className="text-xs">
                    ⏱️ {template.recommended_duration}s
                  </Badge>
                  <Badge variant="outline" className="text-xs">
                    {template.recommended_platforms[0]}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}
