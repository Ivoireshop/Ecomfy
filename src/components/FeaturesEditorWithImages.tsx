import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Plus, X, Upload, Sparkles, Loader2, Image as ImageIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useState } from "react";

interface Feature {
  title: string;
  description: string;
  image_url?: string;
}

interface FeaturesEditorWithImagesProps {
  features: Feature[];
  onChange: (features: Feature[]) => void;
}

export function FeaturesEditorWithImages({ features, onChange }: FeaturesEditorWithImagesProps) {
  const [generatingIndex, setGeneratingIndex] = useState<number | null>(null);
  const [uploadingIndex, setUploadingIndex] = useState<number | null>(null);

  const addFeature = () => {
    onChange([...features, { title: "", description: "", image_url: "" }]);
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

  const removeFeature = async (index: number) => {
    const feature = features[index];
    
    // Confirmation dialog
    if (!confirm("Êtes-vous sûr de vouloir supprimer ce service ? Cette action est irréversible.")) {
      return;
    }

    // Delete image from storage if exists
    if (feature.image_url) {
      toast.info("Suppression de l'image en cours...");
      await deleteImageFromStorage(feature.image_url);
    }

    // Remove from state
    onChange(features.filter((_, i) => i !== index));
    toast.success("Service supprimé définitivement");
  };

  const updateFeature = (index: number, field: keyof Feature, value: string) => {
    const updated = [...features];
    updated[index] = { ...updated[index], [field]: value };
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
      updateFeature(index, 'image_url', `${data.publicUrl}?v=${Date.now()}`);
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
                              if (confirm("Supprimer cette image ? Cette action est irréversible.")) {
                                await deleteImageFromStorage(feature.image_url!);
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