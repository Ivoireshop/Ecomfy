import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Plus, X, Upload, Sparkles, Loader2, Image as ImageIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useState } from "react";
import { moveToTrash, extractStoragePath } from "@/lib/trashHelper";

interface Feature {
  title: string;
  description: string;
  image_url?: string;
  benefits?: string[];
  category?: string;
  price?: number;
  popularity?: number;
}

interface FeaturesEditorWithImagesProps {
  features: Feature[];
  showcaseId: string;
  onChange: (features: Feature[]) => void;
  onSaveToDatabase?: () => Promise<void>;
}

export function FeaturesEditorWithImages({ features, showcaseId, onChange, onSaveToDatabase }: FeaturesEditorWithImagesProps) {
  const [generatingIndex, setGeneratingIndex] = useState<number | null>(null);
  const [uploadingIndex, setUploadingIndex] = useState<number | null>(null);

  const addFeature = () => {
    onChange([...features, { 
      title: "", 
      description: "", 
      image_url: "", 
      benefits: [],
      category: "",
      price: undefined,
      popularity: undefined
    }]);
  };

  const addBenefit = (featureIndex: number) => {
    const updated = [...features];
    if (!updated[featureIndex].benefits) {
      updated[featureIndex].benefits = [];
    }
    updated[featureIndex].benefits!.push("");
    onChange(updated);
  };

  const removeBenefit = (featureIndex: number, benefitIndex: number) => {
    const updated = [...features];
    updated[featureIndex].benefits = updated[featureIndex].benefits?.filter((_, i) => i !== benefitIndex) || [];
    onChange(updated);
  };

  const updateBenefit = (featureIndex: number, benefitIndex: number, value: string) => {
    const updated = [...features];
    if (updated[featureIndex].benefits) {
      updated[featureIndex].benefits[benefitIndex] = value;
      onChange(updated);
    }
  };

  const deleteImageFromStorage = async (imageUrl: string) => {
    try {
      const storagePath = extractStoragePath(imageUrl);
      if (storagePath) {
        await supabase.storage
          .from('showcase-images')
          .remove([storagePath]);
      }
    } catch (error) {
      console.error('Error deleting image from storage:', error);
    }
  };

  const removeFeature = async (index: number) => {
    const feature = features[index];
    
    // Confirmation dialog
    if (!confirm("Déplacer ce service vers la corbeille ? Vous pourrez le restaurer pendant 30 jours.")) {
      return;
    }

    // Move to trash instead of deleting
    const storagePath = feature.image_url ? extractStoragePath(feature.image_url) : undefined;
    const moved = await moveToTrash({
      showcaseId,
      itemType: 'feature',
      itemData: feature,
      storagePath
    });

    if (moved) {
      // Remove from state
      onChange(features.filter((_, i) => i !== index));
      toast.success("Service déplacé vers la corbeille");
    } else {
      toast.error("Erreur lors du déplacement vers la corbeille");
    }
  };

  const updateFeature = (index: number, field: keyof Feature, value: string) => {
    const updated = [...features];
    // Handle numeric fields
    if (field === 'price' || field === 'popularity') {
      const numValue = value === '' ? undefined : Number(value);
      updated[index] = { ...updated[index], [field]: numValue };
    } else {
      updated[index] = { ...updated[index], [field]: value };
    }
    onChange(updated);
  };

  const generateImageWithAI = async (index: number) => {
    const feature = features[index];
    if (!feature.title) {
      toast.error("Veuillez d'abord entrer un titre pour ce service");
      return;
    }

    setGeneratingIndex(index);
    try {
      const { data, error } = await supabase.functions.invoke('generate-feature-image', {
        body: { 
          prompt: `${feature.title}: ${feature.description || 'service professionnel'}` 
        }
      });

      if (error) throw error;

      if (data.error) {
        toast.error(data.error);
        return;
      }

      updateFeature(index, 'image_url', data.imageUrl);
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
      const oldImageUrl = features[index].image_url;
      if (oldImageUrl) {
        await deleteImageFromStorage(oldImageUrl);
      }

      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}/feature-${Date.now()}.${fileExt}`;
      
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
      const newImageUrl = `${data.publicUrl}?v=${Date.now()}`;
      updateFeature(index, 'image_url', newImageUrl);
      
      // Save immediately to database
      if (onSaveToDatabase) {
        await onSaveToDatabase();
      }
      
      toast.success("Image téléchargée et sauvegardée avec succès !");
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
        <CardTitle>Services / Fonctionnalités</CardTitle>
        <CardDescription>
          Ajoutez des images à vos services (upload ou génération IA)
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {features.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <p>Aucun service ajouté. Cliquez sur "Ajouter un service" pour commencer.</p>
          </div>
        ) : (
          features.map((feature, index) => (
            <Card key={index} className="relative">
              <CardContent className="pt-6 space-y-4">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute top-2 right-2"
                  onClick={() => removeFeature(index)}
                >
                  <X className="h-4 w-4" />
                </Button>

                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-4">
                    <div>
                      <Label>Titre du service</Label>
                      <Input
                        value={feature.title}
                        onChange={(e) => updateFeature(index, "title", e.target.value)}
                        placeholder="Ex: Stratégie Digitale"
                      />
                    </div>

                    <div>
                      <Label>Description</Label>
                      <Textarea
                        value={feature.description}
                        onChange={(e) => updateFeature(index, "description", e.target.value)}
                        placeholder="Décrivez ce service..."
                        rows={4}
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label>Catégorie</Label>
                        <Input
                          value={feature.category || ""}
                          onChange={(e) => updateFeature(index, "category", e.target.value)}
                          placeholder="Ex: Consulting"
                        />
                      </div>
                      
                      <div>
                        <Label>Prix (FCFA)</Label>
                        <Input
                          type="number"
                          value={feature.price || ""}
                          onChange={(e) => updateFeature(index, "price", e.target.value)}
                          placeholder="Ex: 50000"
                        />
                      </div>
                    </div>

                    <div>
                      <Label>Popularité (0-100)</Label>
                      <Input
                        type="number"
                        min="0"
                        max="100"
                        value={feature.popularity || ""}
                        onChange={(e) => updateFeature(index, "popularity", e.target.value)}
                        placeholder="Ex: 85"
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        Plus la valeur est élevée, plus le service sera mis en avant dans le tri par popularité
                      </p>
                    </div>

                    <div>
                      <Label>Bénéfices / Avantages</Label>
                      <div className="space-y-2">
                        {feature.benefits?.map((benefit, benefitIndex) => (
                          <div key={benefitIndex} className="flex items-center gap-2">
                            <Input
                              value={benefit}
                              onChange={(e) => updateBenefit(index, benefitIndex, e.target.value)}
                              placeholder="Ex: Résultats garantis sous 30 jours"
                              className="flex-1"
                            />
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() => removeBenefit(index, benefitIndex)}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        ))}
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => addBenefit(index)}
                          className="w-full"
                        >
                          <Plus className="h-4 w-4 mr-2" />
                          Ajouter un bénéfice
                        </Button>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <Label>Image du service</Label>
                    
                    {feature.image_url ? (
                      <div className="relative group">
                        <img 
                          src={feature.image_url} 
                          alt={feature.title}
                          className="w-full h-48 object-cover rounded-lg border"
                        />
                        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center gap-2">
                          <Button
                            type="button"
                            size="sm"
                            variant="secondary"
                            onClick={async () => {
                              if (confirm("Supprimer cette image ? L'image restera sauvegardée avec le service dans la corbeille.")) {
                                updateFeature(index, 'image_url', '');
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
          ))
        )}

        <Button type="button" onClick={addFeature} variant="outline" className="w-full">
          <Plus className="mr-2 h-4 w-4" />
          Ajouter un service
        </Button>
      </CardContent>
    </Card>
  );
}