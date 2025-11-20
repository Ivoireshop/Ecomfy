import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Plus, X, Upload, Sparkles, Loader2, Image as ImageIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useState } from "react";

interface Formation {
  title: string;
  description: string;
  price: string;
  image_url?: string;
}

interface FormationsEditorProps {
  formations: Formation[];
  textAlign: string;
  onChange: (formations: Formation[]) => void;
  onTextAlignChange: (align: string) => void;
}

export function FormationsEditor({ formations, textAlign, onChange, onTextAlignChange }: FormationsEditorProps) {
  const [generatingIndex, setGeneratingIndex] = useState<number | null>(null);
  const [uploadingIndex, setUploadingIndex] = useState<number | null>(null);

  const addFormation = () => {
    onChange([...formations, { title: "", description: "", price: "", image_url: "" }]);
  };

  const deleteImageFromStorage = async (imageUrl: string) => {
    try {
      const url = new URL(imageUrl);
      const pathParts = url.pathname.split('/showcase-images/');
      if (pathParts.length > 1) {
        const filePath = pathParts[1].split('?')[0]; // Remove query params
        await supabase.storage
          .from('showcase-images')
          .remove([filePath]);
      }
    } catch (error) {
      console.error('Error deleting image from storage:', error);
    }
  };

  const removeFormation = async (index: number) => {
    const formation = formations[index];
    
    // Confirmation dialog
    if (!confirm("Êtes-vous sûr de vouloir supprimer cette formation ? Cette action est irréversible.")) {
      return;
    }

    // Delete image from storage if exists
    if (formation.image_url) {
      toast.info("Suppression de l'image en cours...");
      await deleteImageFromStorage(formation.image_url);
    }

    onChange(formations.filter((_, i) => i !== index));
    toast.success("Formation supprimée définitivement");
  };

  const updateFormation = (index: number, field: keyof Formation, value: string) => {
    const updated = [...formations];
    updated[index] = { ...updated[index], [field]: value };
    onChange(updated);
  };

  const generateImageWithAI = async (index: number) => {
    const formation = formations[index];
    if (!formation.title) {
      toast.error("Veuillez d'abord entrer un titre pour cette formation");
      return;
    }

    setGeneratingIndex(index);
    try {
      const { data, error } = await supabase.functions.invoke('generate-feature-image', {
        body: { 
          prompt: `Formation professionnelle: ${formation.title}. ${formation.description || 'cours de formation'}` 
        }
      });

      if (error) throw error;

      if (data.error) {
        toast.error(data.error);
        return;
      }

      updateFormation(index, 'image_url', data.imageUrl);
      toast.success("Image générée avec succès !");
    } catch (error: any) {
      console.error('Error generating image:', error);
      toast.error("Erreur lors de la génération de l'image");
    } finally {
      setGeneratingIndex(null);
    }
  };

  const handleImageUpload = async (index: number, file: File) => {
    setUploadingIndex(index);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Non authentifié");

      // Delete old image first
      const oldImageUrl = formations[index].image_url;
      if (oldImageUrl) {
        await deleteImageFromStorage(oldImageUrl);
      }

      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}/formation-${Date.now()}.${fileExt}`;
      
      const { error: uploadError } = await supabase.storage
        .from('showcase-images')
        .upload(fileName, file, {
          cacheControl: '0',
          upsert: false
        });

      if (uploadError) throw uploadError;

      const { data } = supabase.storage
        .from('showcase-images')
        .getPublicUrl(fileName);

      // Add cache-busting parameter
      updateFormation(index, 'image_url', `${data.publicUrl}?v=${Date.now()}`);
      toast.success("Image téléchargée avec succès !");
    } catch (error: any) {
      console.error('Error uploading image:', error);
      toast.error("Erreur lors du téléchargement");
    } finally {
      setUploadingIndex(null);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Formations Professionnelles</CardTitle>
        <CardDescription>
          Gérez vos formations avec images et options de présentation
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Text Alignment Option */}
        <div>
          <Label className="mb-3 block">Alignement du texte</Label>
          <RadioGroup value={textAlign} onValueChange={onTextAlignChange} className="grid grid-cols-3 gap-4">
            <div>
              <RadioGroupItem value="left" id="align-left" className="peer sr-only" />
              <Label
                htmlFor="align-left"
                className="flex flex-col items-center justify-center rounded-lg border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary cursor-pointer"
              >
                <div className="text-sm font-medium">Gauche</div>
              </Label>
            </div>
            <div>
              <RadioGroupItem value="center" id="align-center" className="peer sr-only" />
              <Label
                htmlFor="align-center"
                className="flex flex-col items-center justify-center rounded-lg border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary cursor-pointer"
              >
                <div className="text-sm font-medium">Centré</div>
              </Label>
            </div>
            <div>
              <RadioGroupItem value="right" id="align-right" className="peer sr-only" />
              <Label
                htmlFor="align-right"
                className="flex flex-col items-center justify-center rounded-lg border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary cursor-pointer"
              >
                <div className="text-sm font-medium">Droite</div>
              </Label>
            </div>
          </RadioGroup>
        </div>

        {/* Formations List */}
        {formations.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground border-2 border-dashed rounded-lg">
            <p>Aucune formation ajoutée. Cliquez sur "Ajouter une formation" pour commencer.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {formations.map((formation, index) => (
              <Card key={index} className="relative">
                <CardContent className="pt-6 space-y-4">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute top-2 right-2"
                    onClick={() => removeFormation(index)}
                  >
                    <X className="h-4 w-4" />
                  </Button>

                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="space-y-4">
                      <div>
                        <Label>Titre de la formation</Label>
                        <Input
                          value={formation.title}
                          onChange={(e) => updateFormation(index, "title", e.target.value)}
                          placeholder="Ex: Marketing Digital Avancé"
                        />
                      </div>

                      <div>
                        <Label>Description</Label>
                        <Textarea
                          value={formation.description}
                          onChange={(e) => updateFormation(index, "description", e.target.value)}
                          placeholder="Décrivez cette formation..."
                          rows={3}
                        />
                      </div>

                      <div>
                        <Label>Prix</Label>
                        <Input
                          value={formation.price}
                          onChange={(e) => updateFormation(index, "price", e.target.value)}
                          placeholder="Ex: 50 000 FCFA"
                        />
                      </div>
                    </div>

                    <div className="space-y-4">
                      <Label>Image de la formation</Label>
                      
                      {formation.image_url ? (
                        <div className="relative group">
                          <img 
                            src={formation.image_url} 
                            alt={formation.title}
                            className="w-full h-64 object-cover rounded-lg border"
                          />
                          <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center gap-2">
                            <Button
                              type="button"
                              size="sm"
                              variant="secondary"
                              onClick={async () => {
                                if (confirm("Supprimer cette image ? Cette action est irréversible.")) {
                                  await deleteImageFromStorage(formation.image_url!);
                                  updateFormation(index, 'image_url', '');
                                  toast.success("Image supprimée");
                                }
                              }}
                            >
                              <X className="h-4 w-4 mr-1" />
                              Supprimer
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <div className="border-2 border-dashed rounded-lg p-6 text-center space-y-3">
                          <ImageIcon className="h-12 w-12 mx-auto text-muted-foreground" />
                          <div className="space-y-2">
                            <p className="text-sm text-muted-foreground">Choisissez une option</p>
                            <div className="flex flex-col gap-2">
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                disabled={generatingIndex === index}
                                onClick={() => generateImageWithAI(index)}
                                className="w-full"
                              >
                                {generatingIndex === index ? (
                                  <>
                                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                    Génération...
                                  </>
                                ) : (
                                  <>
                                    <Sparkles className="h-4 w-4 mr-2" />
                                    Générer avec IA
                                  </>
                                )}
                              </Button>
                              
                              <label className="w-full">
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  disabled={uploadingIndex === index}
                                  className="w-full"
                                  asChild
                                >
                                  <span>
                                    {uploadingIndex === index ? (
                                      <>
                                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                        Upload...
                                      </>
                                    ) : (
                                      <>
                                        <Upload className="h-4 w-4 mr-2" />
                                        Importer une image
                                      </>
                                    )}
                                  </span>
                                </Button>
                                <input
                                  type="file"
                                  accept="image/*"
                                  className="hidden"
                                  disabled={uploadingIndex === index}
                                  onChange={(e) => {
                                    const file = e.target.files?.[0];
                                    if (file) handleImageUpload(index, file);
                                  }}
                                />
                              </label>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        <Button type="button" onClick={addFormation} variant="outline" className="w-full">
          <Plus className="mr-2 h-4 w-4" />
          Ajouter une formation
        </Button>
      </CardContent>
    </Card>
  );
}