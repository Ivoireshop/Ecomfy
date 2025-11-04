import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Download, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface GeneratedImage {
  id: string;
  image_url: string;
  product_details: any;
  created_at: string;
}

interface GeneratedVideo {
  id: string;
  video_url: string;
  product_details: any;
  status: string;
  created_at: string;
}

const Library = () => {
  const [images, setImages] = useState<GeneratedImage[]>([]);
  const [videos, setVideos] = useState<GeneratedVideo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleteType, setDeleteType] = useState<"image" | "video">("image");
  const { toast } = useToast();

  useEffect(() => {
    loadLibrary();
  }, []);

  const loadLibrary = async () => {
    try {
      setIsLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Load images
      const { data: imagesData, error: imagesError } = await supabase
        .from("generated_images")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (imagesError) throw imagesError;
      setImages(imagesData || []);

      // Load videos
      const { data: videosData, error: videosError } = await supabase
        .from("generated_videos")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (videosError) throw videosError;
      setVideos(videosData || []);
    } catch (error) {
      console.error("Error loading library:", error);
      toast({
        title: "Erreur",
        description: "Impossible de charger votre bibliothèque",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;

    try {
      const table = deleteType === "image" ? "generated_images" : "generated_videos";
      const { error } = await supabase
        .from(table)
        .delete()
        .eq("id", deleteId);

      if (error) throw error;

      if (deleteType === "image") {
        setImages(images.filter(img => img.id !== deleteId));
      } else {
        setVideos(videos.filter(vid => vid.id !== deleteId));
      }

      toast({
        title: "Supprimé",
        description: `${deleteType === "image" ? "L'image" : "La vidéo"} a été supprimée avec succès`,
      });
    } catch (error) {
      console.error("Error deleting:", error);
      toast({
        title: "Erreur",
        description: "Impossible de supprimer",
        variant: "destructive",
      });
    } finally {
      setDeleteId(null);
    }
  };

  const handleDownload = (url: string, filename: string) => {
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl md:text-4xl font-bold mb-8">Ma Bibliothèque</h1>

        <Tabs defaultValue="images" className="w-full">
          <TabsList className="grid w-full max-w-md grid-cols-2">
            <TabsTrigger value="images">Images ({images.length})</TabsTrigger>
            <TabsTrigger value="videos">Vidéos ({videos.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="images" className="mt-8">
            {images.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <p>Aucune image générée pour le moment</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {images.map((image) => (
                  <div key={image.id} className="bg-card rounded-lg overflow-hidden shadow-lg border">
                    <img 
                      src={image.image_url} 
                      alt={image.product_details?.productName || "Image générée"}
                      className="w-full h-48 object-cover"
                    />
                    <div className="p-4">
                      <h3 className="font-semibold mb-2">
                        {image.product_details?.productName || "Sans titre"}
                      </h3>
                      <p className="text-sm text-muted-foreground mb-4">
                        {new Date(image.created_at).toLocaleDateString("fr-FR")}
                      </p>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          className="flex-1"
                          onClick={() => handleDownload(
                            image.image_url, 
                            `${image.product_details?.productName || 'image'}.png`
                          )}
                        >
                          <Download className="h-4 w-4 mr-1" />
                          Télécharger
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => {
                            setDeleteId(image.id);
                            setDeleteType("image");
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="videos" className="mt-8">
            {videos.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <p>Aucune vidéo générée pour le moment</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {videos.map((video) => (
                  <div key={video.id} className="bg-card rounded-lg overflow-hidden shadow-lg border">
                    <div className="w-full h-48 bg-muted flex items-center justify-center">
                      {video.status === "processing" ? (
                        <div className="text-center">
                          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2 text-primary" />
                          <p className="text-sm text-muted-foreground">Génération en cours...</p>
                        </div>
                      ) : (
                        <video 
                          src={video.video_url} 
                          controls
                          className="w-full h-full object-cover"
                        />
                      )}
                    </div>
                    <div className="p-4">
                      <h3 className="font-semibold mb-2">
                        {video.product_details?.productName || "Sans titre"}
                      </h3>
                      <p className="text-sm text-muted-foreground mb-4">
                        {new Date(video.created_at).toLocaleDateString("fr-FR")}
                      </p>
                      {video.status !== "processing" && (
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            className="flex-1"
                            onClick={() => handleDownload(
                              video.video_url, 
                              `${video.product_details?.productName || 'video'}.mp4`
                            )}
                          >
                            <Download className="h-4 w-4 mr-1" />
                            Télécharger
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => {
                              setDeleteId(video.id);
                              setDeleteType("video");
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmer la suppression</AlertDialogTitle>
            <AlertDialogDescription>
              Êtes-vous sûr de vouloir supprimer {deleteType === "image" ? "cette image" : "cette vidéo"} ? 
              Cette action est irréversible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Supprimer</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Library;