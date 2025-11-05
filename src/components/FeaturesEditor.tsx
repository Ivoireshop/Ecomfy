import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, X, GripVertical } from "lucide-react";

interface Feature {
  title: string;
  description: string;
}

interface FeaturesEditorProps {
  features: Feature[];
  onChange: (features: Feature[]) => void;
}

export function FeaturesEditor({ features, onChange }: FeaturesEditorProps) {
  const addFeature = () => {
    onChange([...features, { title: "", description: "" }]);
  };

  const removeFeature = (index: number) => {
    onChange(features.filter((_, i) => i !== index));
  };

  const updateFeature = (index: number, field: keyof Feature, value: string) => {
    const newFeatures = [...features];
    newFeatures[index] = { ...newFeatures[index], [field]: value };
    onChange(newFeatures);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Fonctionnalités / Avantages</CardTitle>
          <Button type="button" onClick={addFeature} size="sm" variant="outline">
            <Plus className="mr-2 h-4 w-4" />
            Ajouter
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {features.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <p>Aucune fonctionnalité ajoutée</p>
            <Button type="button" onClick={addFeature} size="sm" variant="outline" className="mt-4">
              <Plus className="mr-2 h-4 w-4" />
              Ajouter la première fonctionnalité
            </Button>
          </div>
        ) : (
          features.map((feature, index) => (
            <div key={index} className="relative p-4 border rounded-lg space-y-3 bg-muted/30">
              <div className="flex items-start gap-2">
                <GripVertical className="h-5 w-5 text-muted-foreground mt-2 cursor-move" />
                <div className="flex-1 space-y-3">
                  <div>
                    <Label>Titre {index + 1}</Label>
                    <Input
                      value={feature.title}
                      onChange={(e) => updateFeature(index, "title", e.target.value)}
                      placeholder="Ex: Service rapide et efficace"
                    />
                  </div>
                  <div>
                    <Label>Description {index + 1}</Label>
                    <Textarea
                      value={feature.description}
                      onChange={(e) => updateFeature(index, "description", e.target.value)}
                      placeholder="Décrivez cette fonctionnalité..."
                      rows={3}
                    />
                  </div>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => removeFeature(index)}
                  className="text-destructive hover:text-destructive"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
