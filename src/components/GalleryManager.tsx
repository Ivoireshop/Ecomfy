import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Loader2, Upload, X, Image as ImageIcon, GripVertical, Plus, Save } from "lucide-react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

interface GalleryImage {
  id: string;
  image_url: string;
  image_caption: string | null;
  image_order: number;
  section_type: string;
  section_title: string | null;
}

interface GalleryManagerProps {
  showcaseId: string;
}

const SECTION_TYPES = [
  { value: "author", label: "Section Auteur/Biographie" },
  { value: "formations", label: "Formations" },
  { value: "events", label: "Conférences/Événements" },
  { value: "portfolio", label: "Portfolio/Galerie" },
  { value: "custom", label: "Section Personnalisée" },
];

interface SortableImageProps {
  image: GalleryImage;
  onDelete: (id: string) => void;
  onUpdateCaption: (id: string, caption: string) => void;
}

function SortableImage({ image, onDelete, onUpdateCaption }: SortableImageProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: image.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} className="relative group">
      <Card className="overflow-hidden">
        <div className="relative">
          <img
            src={image.image_url}
            alt={image.image_caption || "Gallery image"}
            className="w-full h-48 object-cover"
          />
          <div className="absolute top-2 right-2 flex gap-2">
            <Button
              size="icon"
              variant="destructive"
              className="h-8 w-8"
              onClick={() => onDelete(image.id)}
            >
              <X className="h-4 w-4" />
            </Button>
            <Button
              size="icon"
              variant="secondary"
              className="h-8 w-8 cursor-move"
              {...attributes}
              {...listeners}
            >
              <GripVertical className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <CardContent className="p-3">
          <Input
            placeholder="Légende de l'image..."
            value={image.image_caption || ""}
            onChange={(e) => onUpdateCaption(image.id, e.target.value)}
            className="text-sm"
          />
        </CardContent>
      </Card>
    </div>
  );
}

export const GalleryManager = ({ showcaseId }: GalleryManagerProps) => {
  const [images, setImages] = useState<GalleryImage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [selectedSection, setSelectedSection] = useState("author");
  const [sectionTitle, setSectionTitle] = useState("");
  const [filterSection, setFilterSection] = useState<string>("all");
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  useEffect(() => {
    loadGalleryImages();
  }, [showcaseId]);

  const loadGalleryImages = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from("showcase_galleries")
        .select("*")
        .eq("showcase_site_id", showcaseId)
        .order("image_order", { ascending: true });

      if (error) throw error;
      setImages(data || []);
    } catch (error) {
      console.error("Error loading gallery:", error);
      toast.error("Erreur lors du chargement de la galerie");
    } finally {
      setIsLoading(false);
    }
  };

  const uploadImage = async (file: File) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Non authentifié");

      const fileExt = file.name.split(".").pop();
      const fileName = `${user.id}/gallery-${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("showcase-images")
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      const { data } = supabase.storage
        .from("showcase-images")
        .getPublicUrl(fileName);

      return data.publicUrl;
    } catch (error) {
      console.error("Error uploading image:", error);
      throw error;
    }
  };

  const handleAddImages = async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    setIsUploading(true);
    try {
      const uploadPromises = Array.from(files).map(async (file, index) => {
        const imageUrl = await uploadImage(file);
        const maxOrder = Math.max(...images.map((img) => img.image_order), -1);

        return {
          showcase_site_id: showcaseId,
          section_type: selectedSection,
          section_title: sectionTitle || null,
          image_url: imageUrl,
          image_caption: null,
          image_order: maxOrder + index + 1,
        };
      });

      const newImages = await Promise.all(uploadPromises);

      const { error } = await supabase
        .from("showcase_galleries")
        .insert(newImages);

      if (error) throw error;

      await loadGalleryImages();
      setHasUnsavedChanges(false); // Images are already saved
      toast.success(`${files.length} image(s) ajoutée(s) et sauvegardée(s) avec succès !`);
      setSectionTitle("");
    } catch (error) {
      console.error("Error adding images:", error);
      toast.error("Erreur lors de l'ajout des images");
    } finally {
      setIsUploading(false);
    }
  };

  const handleDeleteImage = async (id: string) => {
    try {
      const { error } = await supabase
        .from("showcase_galleries")
        .delete()
        .eq("id", id);

      if (error) throw error;

      setImages(images.filter((img) => img.id !== id));
      toast.success("Image supprimée");
    } catch (error) {
      console.error("Error deleting image:", error);
      toast.error("Erreur lors de la suppression");
    }
  };

  const handleUpdateCaption = async (id: string, caption: string) => {
    try {
      const { error } = await supabase
        .from("showcase_galleries")
        .update({ image_caption: caption })
        .eq("id", id);

      if (error) throw error;

      setImages(
        images.map((img) =>
          img.id === id ? { ...img, image_caption: caption } : img
        )
      );
      setHasUnsavedChanges(true);
    } catch (error) {
      console.error("Error updating caption:", error);
    }
  };

  const saveAllChanges = async () => {
    setIsSaving(true);
    try {
      // All changes are already saved in real-time via handleUpdateCaption, handleDragEnd, etc.
      // This button is more for user confirmation
      setHasUnsavedChanges(false);
      toast.success("Modifications sauvegardées avec succès !");
    } catch (error) {
      console.error("Error saving changes:", error);
      toast.error("Erreur lors de la sauvegarde");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;

    if (!over || active.id === over.id) return;

    const filteredImages = filterSection === "all"
      ? images
      : images.filter((img) => img.section_type === filterSection);

    const oldIndex = filteredImages.findIndex((img) => img.id === active.id);
    const newIndex = filteredImages.findIndex((img) => img.id === over.id);

    const reorderedFiltered = arrayMove(filteredImages, oldIndex, newIndex);

    // Update order in database
    try {
      const updates = reorderedFiltered.map((img, index) => ({
        id: img.id,
        image_order: index,
      }));

      for (const update of updates) {
        await supabase
          .from("showcase_galleries")
          .update({ image_order: update.image_order })
          .eq("id", update.id);
      }

      await loadGalleryImages();
      toast.success("Ordre mis à jour");
    } catch (error) {
      console.error("Error updating order:", error);
      toast.error("Erreur lors de la réorganisation");
    }
  };

  const filteredImages = filterSection === "all"
    ? images
    : images.filter((img) => img.section_type === filterSection);

  const groupedImages = filteredImages.reduce((acc, img) => {
    const section = img.section_type;
    if (!acc[section]) acc[section] = [];
    acc[section].push(img);
    return acc;
  }, {} as Record<string, GalleryImage[]>);

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <ImageIcon className="h-5 w-5" />
              Gestionnaire de Galerie d'Images
            </CardTitle>
            <CardDescription>
              Ajoutez des images pour différentes sections de votre site vitrine
            </CardDescription>
          </div>
          {hasUnsavedChanges && images.length > 0 && (
            <Button onClick={saveAllChanges} disabled={isSaving}>
              {isSaving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Sauvegarde...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Sauvegarder les modifications
                </>
              )}
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Upload Section */}
        <div className="space-y-4 p-4 border rounded-lg bg-muted/30">
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="sectionType">Type de section</Label>
              <Select value={selectedSection} onValueChange={setSelectedSection}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SECTION_TYPES.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="sectionTitle">Titre de section (optionnel)</Label>
              <Input
                id="sectionTitle"
                value={sectionTitle}
                onChange={(e) => setSectionTitle(e.target.value)}
                placeholder="Ex: Mes conférences 2024"
              />
            </div>
          </div>

          <div>
            <Label htmlFor="images">Ajouter des images</Label>
            <Input
              id="images"
              type="file"
              accept="image/*"
              multiple
              onChange={(e) => handleAddImages(e.target.files)}
              disabled={isUploading}
            />
            {isUploading && (
              <p className="text-sm text-muted-foreground mt-2 flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Téléchargement en cours...
              </p>
            )}
          </div>
        </div>

        {/* Filter */}
        <div className="flex flex-wrap gap-2">
          <Button
            variant={filterSection === "all" ? "default" : "outline"}
            size="sm"
            onClick={() => setFilterSection("all")}
          >
            Toutes ({images.length})
          </Button>
          {SECTION_TYPES.map((type) => {
            const count = images.filter((img) => img.section_type === type.value).length;
            return (
              <Button
                key={type.value}
                variant={filterSection === type.value ? "default" : "outline"}
                size="sm"
                onClick={() => setFilterSection(type.value)}
              >
                {type.label} ({count})
              </Button>
            );
          })}
        </div>

        {/* Gallery Grid */}
        {filteredImages.length === 0 ? (
          <div className="text-center py-12 border-2 border-dashed rounded-lg">
            <ImageIcon className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">Aucune image dans cette section</p>
            <p className="text-sm text-muted-foreground mt-1">
              Ajoutez des images pour commencer votre galerie
            </p>
          </div>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={filteredImages.map((img) => img.id)}
              strategy={verticalListSortingStrategy}
            >
              <div className="space-y-6">
                {filterSection === "all" ? (
                  Object.entries(groupedImages).map(([section, sectionImages]) => (
                    <div key={section}>
                      <div className="flex items-center gap-2 mb-3">
                        <Badge variant="secondary">
                          {SECTION_TYPES.find((t) => t.value === section)?.label || section}
                        </Badge>
                        <span className="text-sm text-muted-foreground">
                          {sectionImages.length} image(s)
                        </span>
                      </div>
                      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {sectionImages.map((image) => (
                          <SortableImage
                            key={image.id}
                            image={image}
                            onDelete={handleDeleteImage}
                            onUpdateCaption={handleUpdateCaption}
                          />
                        ))}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filteredImages.map((image) => (
                      <SortableImage
                        key={image.id}
                        image={image}
                        onDelete={handleDeleteImage}
                        onUpdateCaption={handleUpdateCaption}
                      />
                    ))}
                  </div>
                )}
              </div>
            </SortableContext>
          </DndContext>
        )}
      </CardContent>
    </Card>
  );
};
