import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Plus, Trash2, Upload, Image as ImageIcon, Save } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Testimonial {
  id?: string;
  full_name: string;
  testimonial_text: string;
  result_image_url?: string;
  display_order: number;
}

interface TestimonialsEditorProps {
  showcaseSiteId: string;
  testimonials: Testimonial[];
  onTestimonialsChange: (testimonials: Testimonial[]) => void;
}

export function TestimonialsEditor({ 
  showcaseSiteId, 
  testimonials, 
  onTestimonialsChange 
}: TestimonialsEditorProps) {
  const [isUploading, setIsUploading] = useState<number | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const addTestimonial = () => {
    const newTestimonial: Testimonial = {
      full_name: "",
      testimonial_text: "",
      result_image_url: "",
      display_order: testimonials.length,
    };
    onTestimonialsChange([...testimonials, newTestimonial]);
  };

  const removeTestimonial = (index: number) => {
    const updated = testimonials.filter((_, i) => i !== index);
    onTestimonialsChange(updated);
  };

  const updateTestimonial = (index: number, field: keyof Testimonial, value: string) => {
    const updated = [...testimonials];
    updated[index] = { ...updated[index], [field]: value };
    onTestimonialsChange(updated);
  };

  const handleImageUpload = async (index: number, file: File) => {
    setIsUploading(index);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${showcaseSiteId}/testimonials/${Date.now()}.${fileExt}`;
      
      const { error: uploadError } = await supabase.storage
        .from('showcase-images')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('showcase-images')
        .getPublicUrl(fileName);

      updateTestimonial(index, 'result_image_url', publicUrl);
      toast.success("Image téléchargée avec succès");
    } catch (error) {
      console.error('Error uploading image:', error);
      toast.error("Erreur lors du téléchargement de l'image");
    } finally {
      setIsUploading(null);
    }
  };

  const saveTestimonials = async () => {
    setIsSaving(true);
    try {
      // First, delete existing testimonials
      await supabase
        .from("showcase_testimonials")
        .delete()
        .eq("showcase_site_id", showcaseSiteId);

      // Then insert new testimonials
      if (testimonials.length > 0) {
        const testimonialsToInsert = testimonials.map((t, index) => ({
          showcase_site_id: showcaseSiteId,
          full_name: t.full_name,
          testimonial_text: t.testimonial_text,
          result_image_url: t.result_image_url || null,
          display_order: index,
        }));

        const { error: testimonialsError } = await supabase
          .from("showcase_testimonials")
          .insert(testimonialsToInsert);

        if (testimonialsError) {
          console.error("Error saving testimonials:", testimonialsError);
          toast.error("Erreur lors de la sauvegarde des témoignages");
          return;
        }
      }

      toast.success("Témoignages sauvegardés avec succès !");
    } catch (error) {
      console.error("Error saving testimonials:", error);
      toast.error("Une erreur est survenue lors de la sauvegarde");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Témoignages</span>
          <Button onClick={addTestimonial} size="sm">
            <Plus className="h-4 w-4 mr-2" />
            Ajouter un témoignage
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {testimonials.length === 0 ? (
          <p className="text-muted-foreground text-center py-8">
            Aucun témoignage ajouté. Cliquez sur "Ajouter un témoignage" pour commencer.
          </p>
        ) : (
          testimonials.map((testimonial, index) => (
            <Card key={index} className="border-2">
              <CardHeader>
                <CardTitle className="text-lg flex items-center justify-between">
                  <span>Témoignage {index + 1}</span>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => removeTestimonial(index)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Nom complet</Label>
                  <Input
                    placeholder="Ex: Jean Dupont"
                    value={testimonial.full_name}
                    onChange={(e) => updateTestimonial(index, 'full_name', e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Témoignage</Label>
                  <Textarea
                    placeholder="Ex: Grâce à cette formation, j'ai pu..."
                    value={testimonial.testimonial_text}
                    onChange={(e) => updateTestimonial(index, 'testimonial_text', e.target.value)}
                    rows={4}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Capture d'écran des résultats (optionnel)</Label>
                  <div className="flex gap-4 items-start">
                    <div className="flex-1">
                      {testimonial.result_image_url ? (
                        <div className="space-y-2">
                          <img
                            src={testimonial.result_image_url}
                            alt="Résultats"
                            className="w-full h-48 object-cover rounded-lg"
                          />
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => updateTestimonial(index, 'result_image_url', '')}
                          >
                            Supprimer l'image
                          </Button>
                        </div>
                      ) : (
                        <div className="border-2 border-dashed rounded-lg p-8 text-center">
                          <ImageIcon className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                          <p className="text-sm text-muted-foreground mb-4">
                            Téléchargez une capture d'écran des résultats
                          </p>
                          <div className="relative">
                            <input
                              type="file"
                              accept="image/*"
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) handleImageUpload(index, file);
                              }}
                              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                              disabled={isUploading === index}
                            />
                            <Button
                              variant="outline"
                              disabled={isUploading === index}
                            >
                              {isUploading === index ? (
                                <>
                                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                  Téléchargement...
                                </>
                              ) : (
                                <>
                                  <Upload className="h-4 w-4 mr-2" />
                                  Télécharger une image
                                </>
                              )}
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
        
        {testimonials.length > 0 && (
          <div className="flex justify-end pt-4">
            <Button
              onClick={saveTestimonials}
              disabled={isSaving}
              size="lg"
            >
              {isSaving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Sauvegarde en cours...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Sauvegarder les témoignages
                </>
              )}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
