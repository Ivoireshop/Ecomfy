import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Loader2, Upload, X, Video as VideoIcon, GripVertical } from "lucide-react";
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

interface GalleryVideo {
  id: string;
  video_url: string;
  video_caption: string | null;
  video_order: number;
  section_type: string;
  section_title: string | null;
}

interface VideoGalleryManagerProps {
  showcaseId: string;
}

const SECTION_TYPES = [
  { value: "author", label: "Section Auteur/Biographie" },
  { value: "formations", label: "Formations" },
  { value: "events", label: "Conférences/Événements" },
  { value: "portfolio", label: "Portfolio/Galerie" },
  { value: "custom", label: "Section Personnalisée" },
];

interface SortableVideoProps {
  video: GalleryVideo;
  onDelete: (id: string) => void;
  onUpdateCaption: (id: string, caption: string) => void;
}

function SortableVideo({ video, onDelete, onUpdateCaption }: SortableVideoProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: video.id,
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
          <video
            src={video.video_url}
            controls
            className="w-full h-48 object-cover"
          />
          <div className="absolute top-2 right-2 flex gap-2">
            <Button
              size="icon"
              variant="destructive"
              className="h-8 w-8"
              onClick={() => onDelete(video.id)}
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
            placeholder="Légende de la vidéo..."
            value={video.video_caption || ""}
            onChange={(e) => onUpdateCaption(video.id, e.target.value)}
            className="text-sm"
          />
        </CardContent>
      </Card>
    </div>
  );
}

export const VideoGalleryManager = ({ showcaseId }: VideoGalleryManagerProps) => {
  const [videos, setVideos] = useState<GalleryVideo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [selectedSection, setSelectedSection] = useState("author");
  const [sectionTitle, setSectionTitle] = useState("");
  const [filterSection, setFilterSection] = useState<string>("all");

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  useEffect(() => {
    loadGalleryVideos();
  }, [showcaseId]);

  const loadGalleryVideos = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from("showcase_gallery_videos" as any)
        .select("*")
        .eq("showcase_site_id", showcaseId)
        .order("video_order", { ascending: true });

      if (error) throw error;
      setVideos((data as any) as GalleryVideo[] || []);
    } catch (error) {
      console.error("Error loading gallery videos:", error);
      toast.error("Erreur lors du chargement de la galerie vidéos");
    } finally {
      setIsLoading(false);
    }
  };

  const uploadVideo = async (file: File) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Non authentifié");

      const fileExt = file.name.split(".").pop();
      const fileName = `${user.id}/gallery-video-${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("showcase-videos")
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      const { data } = supabase.storage
        .from("showcase-videos")
        .getPublicUrl(fileName);

      return data.publicUrl;
    } catch (error) {
      console.error("Error uploading video:", error);
      throw error;
    }
  };

  const handleAddVideos = async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    setIsUploading(true);
    try {
      const uploadPromises = Array.from(files).map(async (file, index) => {
        const videoUrl = await uploadVideo(file);
        const maxOrder = Math.max(...videos.map((vid) => vid.video_order), -1);

        const newVideo = {
          showcase_site_id: showcaseId,
          section_type: selectedSection,
          section_title: sectionTitle || null,
          video_url: videoUrl,
          video_caption: null,
          video_order: maxOrder + index + 1,
        };

        const { data, error } = await supabase
          .from("showcase_gallery_videos" as any)
          .insert(newVideo)
          .select()
          .single();

        if (error) throw error;
        return data;
      });

      await Promise.all(uploadPromises);
      await loadGalleryVideos();
      toast.success(`${files.length} vidéo(s) ajoutée(s) avec succès !`);
      setSectionTitle("");
    } catch (error) {
      console.error("Error adding videos:", error);
      toast.error("Erreur lors de l'ajout des vidéos");
    } finally {
      setIsUploading(false);
    }
  };

  const handleDeleteVideo = async (id: string) => {
    try {
      const { error } = await supabase
        .from("showcase_gallery_videos" as any)
        .delete()
        .eq("id", id);

      if (error) throw error;

      setVideos(videos.filter((vid) => vid.id !== id));
      toast.success("Vidéo supprimée");
    } catch (error) {
      console.error("Error deleting video:", error);
      toast.error("Erreur lors de la suppression");
    }
  };

  const handleUpdateCaption = async (id: string, caption: string) => {
    try {
      const { error } = await supabase
        .from("showcase_gallery_videos" as any)
        .update({ video_caption: caption })
        .eq("id", id);

      if (error) throw error;

      setVideos(
        videos.map((vid) =>
          vid.id === id ? { ...vid, video_caption: caption } : vid
        )
      );
      toast.success("Légende mise à jour");
    } catch (error) {
      console.error("Error updating caption:", error);
      toast.error("Erreur lors de la mise à jour");
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;

    if (!over || active.id === over.id) return;

    const filteredVideos = filterSection === "all"
      ? videos
      : videos.filter((vid) => vid.section_type === filterSection);

    const oldIndex = filteredVideos.findIndex((vid) => vid.id === active.id);
    const newIndex = filteredVideos.findIndex((vid) => vid.id === over.id);

    const reorderedFiltered = arrayMove(filteredVideos, oldIndex, newIndex);

    try {
      const updates = reorderedFiltered.map((vid, index) => ({
        id: vid.id,
        video_order: index,
      }));

      for (const update of updates) {
        await supabase
          .from("showcase_gallery_videos" as any)
          .update({ video_order: update.video_order })
          .eq("id", update.id);
      }

      await loadGalleryVideos();
      toast.success("Ordre mis à jour");
    } catch (error) {
      console.error("Error updating order:", error);
      toast.error("Erreur lors de la réorganisation");
    }
  };

  const filteredVideos = filterSection === "all"
    ? videos
    : videos.filter((vid) => vid.section_type === filterSection);

  const groupedVideos = filteredVideos.reduce((acc, vid) => {
    const section = vid.section_type;
    if (!acc[section]) acc[section] = [];
    acc[section].push(vid);
    return acc;
  }, {} as Record<string, GalleryVideo[]>);

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
              <VideoIcon className="h-5 w-5" />
              Gestionnaire de Galerie de Vidéos
            </CardTitle>
            <CardDescription>
              Ajoutez des vidéos pour différentes sections de votre site vitrine
            </CardDescription>
          </div>
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
            <Label htmlFor="videos">Ajouter des vidéos</Label>
            <Input
              id="videos"
              type="file"
              accept="video/*"
              multiple
              onChange={(e) => handleAddVideos(e.target.files)}
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
            Toutes ({videos.length})
          </Button>
          {SECTION_TYPES.map((type) => {
            const count = videos.filter((vid) => vid.section_type === type.value).length;
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
        {filteredVideos.length === 0 ? (
          <div className="text-center py-12 border-2 border-dashed rounded-lg">
            <VideoIcon className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">Aucune vidéo dans cette section</p>
            <p className="text-sm text-muted-foreground mt-1">
              Ajoutez des vidéos pour commencer votre galerie
            </p>
          </div>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={filteredVideos.map((vid) => vid.id)}
              strategy={verticalListSortingStrategy}
            >
              <div className="space-y-6">
                {filterSection === "all" ? (
                  Object.entries(groupedVideos).map(([section, sectionVideos]) => (
                    <div key={section}>
                      <div className="flex items-center gap-2 mb-3">
                        <Badge variant="secondary">
                          {SECTION_TYPES.find((t) => t.value === section)?.label || section}
                        </Badge>
                        <span className="text-sm text-muted-foreground">
                          {sectionVideos.length} vidéo(s)
                        </span>
                      </div>
                      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {sectionVideos.map((video) => (
                          <SortableVideo
                            key={video.id}
                            video={video}
                            onDelete={handleDeleteVideo}
                            onUpdateCaption={handleUpdateCaption}
                          />
                        ))}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filteredVideos.map((video) => (
                      <SortableVideo
                        key={video.id}
                        video={video}
                        onDelete={handleDeleteVideo}
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
