import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Plus, Trash2, Upload, X } from "lucide-react";

interface Experience {
  title: string;
  company: string;
  period: string;
  description: string;
}

interface BiographyEditorProps {
  biographyTitle: string;
  biographyContent: string;
  biographyImageUrl?: string;
  biographyImagePosition?: string;
  professionalExperience: Experience[];
  onBiographyTitleChange: (value: string) => void;
  onBiographyContentChange: (value: string) => void;
  onBiographyImageUpload: (file: File) => Promise<void>;
  onBiographyImageRemove?: () => Promise<void>;
  onBiographyImagePositionChange: (position: string) => void;
  onExperienceChange: (experiences: Experience[]) => void;
}

export const BiographyEditor = ({
  biographyTitle,
  biographyContent,
  biographyImageUrl,
  biographyImagePosition = "left",
  professionalExperience = [],
  onBiographyTitleChange,
  onBiographyContentChange,
  onBiographyImageUpload,
  onBiographyImageRemove,
  onBiographyImagePositionChange,
  onExperienceChange,
}: BiographyEditorProps) => {
  const addExperience = () => {
    onExperienceChange([
      ...professionalExperience,
      { title: "", company: "", period: "", description: "" }
    ]);
  };

  const updateExperience = (index: number, field: keyof Experience, value: string) => {
    const updated = [...professionalExperience];
    updated[index] = { ...updated[index], [field]: value };
    onExperienceChange(updated);
  };

  const removeExperience = (index: number) => {
    if (!confirm("Supprimer cette expérience ? Cette action est irréversible.")) {
      return;
    }
    onExperienceChange(professionalExperience.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Biographie</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="biographyTitle">Titre de la section</Label>
            <Input
              id="biographyTitle"
              value={biographyTitle}
              onChange={(e) => onBiographyTitleChange(e.target.value)}
              placeholder="Biographie"
            />
          </div>

          <div>
            <Label htmlFor="biographyContent">Contenu de la biographie</Label>
            <Textarea
              id="biographyContent"
              value={biographyContent}
              onChange={(e) => onBiographyContentChange(e.target.value)}
              placeholder="Racontez votre parcours, votre histoire, vos motivations..."
              className="min-h-[200px]"
            />
          </div>

          <div>
            <Label htmlFor="biographyImage">Photo de biographie</Label>
            <div className="mt-2">
              {biographyImageUrl && (
                <div className="mb-4 relative inline-block">
                  <img
                    src={biographyImageUrl}
                    alt="Biography"
                    className="w-32 h-32 object-cover rounded-lg"
                  />
                  {onBiographyImageRemove && (
                    <Button
                      type="button"
                      variant="destructive"
                      size="icon"
                      className="absolute -top-2 -right-2 h-6 w-6"
                      onClick={onBiographyImageRemove}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              )}
              <Input
                id="biographyImage"
                type="file"
                accept="image/*"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) onBiographyImageUpload(file);
                }}
                className="cursor-pointer"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Photo qui apparaîtra à côté du contenu de la biographie
              </p>
            </div>
          </div>

          {biographyImageUrl && (
            <div>
              <Label htmlFor="biographyImagePosition">Position de l'image</Label>
              <RadioGroup
                id="biographyImagePosition"
                value={biographyImagePosition}
                onValueChange={onBiographyImagePositionChange}
                className="flex gap-4 mt-2"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="left" id="position-left" />
                  <Label htmlFor="position-left" className="cursor-pointer">
                    Gauche
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="right" id="position-right" />
                  <Label htmlFor="position-right" className="cursor-pointer">
                    Droite
                  </Label>
                </div>
              </RadioGroup>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Expérience Professionnelle</CardTitle>
            <Button onClick={addExperience} size="sm">
              <Plus className="h-4 w-4 mr-2" />
              Ajouter une expérience
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {professionalExperience.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">
              Aucune expérience ajoutée. Cliquez sur "Ajouter une expérience" pour commencer.
            </p>
          ) : (
            professionalExperience.map((exp, index) => (
              <Card key={index} className="relative">
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute top-2 right-2"
                  onClick={() => removeExperience(index)}
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
                <CardContent className="pt-6 space-y-4">
                  <div className="grid md:grid-cols-2 gap-4">
                    <div>
                      <Label>Poste</Label>
                      <Input
                        value={exp.title}
                        onChange={(e) => updateExperience(index, 'title', e.target.value)}
                        placeholder="Ex: Directeur Marketing"
                      />
                    </div>
                    <div>
                      <Label>Entreprise</Label>
                      <Input
                        value={exp.company}
                        onChange={(e) => updateExperience(index, 'company', e.target.value)}
                        placeholder="Ex: TechCorp Afrique"
                      />
                    </div>
                  </div>
                  <div>
                    <Label>Période</Label>
                    <Input
                      value={exp.period}
                      onChange={(e) => updateExperience(index, 'period', e.target.value)}
                      placeholder="Ex: 2020 - 2023"
                    />
                  </div>
                  <div>
                    <Label>Description</Label>
                    <Textarea
                      value={exp.description}
                      onChange={(e) => updateExperience(index, 'description', e.target.value)}
                      placeholder="Décrivez vos responsabilités et réalisations..."
                      className="min-h-[100px]"
                    />
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
};
