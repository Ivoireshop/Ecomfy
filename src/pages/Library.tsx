import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Download, Trash2, Edit } from "lucide-react";
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
import { ImageTextEditor } from "@/components/ImageTextEditor";
import { signGeneratedImageUrl } from "@/lib/generatedImageUrl";

interface ImageFormat {
  id: string;
  format_name: string;
  format_size: string;
  platform: string;
  image_url: string;
}

interface GeneratedImage {
  id: string;
  image_url: string;
  product_details: any;
  created_at: string;
  formats?: ImageFormat[];
}

interface GeneratedVideo {
  id: string;
  video_url: string;
  product_details: any;
  status: string;
  created_at: string;
}

// Une vidéo restée « processing » au-delà de ce délai est considérée comme échouée
// (la fonction serveur a été interrompue avant de pouvoir écrire son statut final).
const STALE_PROCESSING_MS = 20 * 60 * 1000;
const VIDEO_POLL_MS = 10_000;
// Libellé générique posé par le Studio IA sur toutes les vidéos : inutilisable comme titre.
const GENERIC_TITLES = ["Génération Studio"];

const getVideoStatus = (video: GeneratedVideo): "processing" | "failed" | "completed" => {
  if (video.status === "failed" || video.status === "error") return "failed";
  if (video.status === "processing") {
    const age = Date.now() - new Date(video.created_at).getTime();
    return age > STALE_PROCESSING_MS ? "failed" : "processing";
  }
  return "completed";
};

const isVideoFile = (url: string) => /\.(mp4|webm|mov)(\?|#|$)/i.test(url);

/** Titre lisible : nom du produit, sinon la description saisie dans le Studio IA. */
const getMediaTitle = (details: any): string => {
  const name = typeof details?.productName === "string" ? details.productName.trim() : "";
  if (name && !GENERIC_TITLES.includes(name)) return name;
  const text = [details?.originalPrompt, details?.userExplicitDemand, details?.description]
    .find((v) => typeof v === "string" && v.trim());
  if (text) {
    const clean = text.trim().replace(/\s+/g, " ");
    return clean.length > 60 ? `${clean.slice(0, 57)}…` : clean;
  }
  return name || "Sans titre";
};

const toFileName = (title: string, fallback: string) => {
  const clean = title.replace(/[^\p{L}\p{N} _-]/gu, "").trim().replace(/\s+/g, "-").slice(0, 50);
  return clean || fallback;
};

const Library = () => {
  const [images, setImages] = useState<GeneratedImage[]>([]);
  const [videos, setVideos] = useState<GeneratedVideo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleteType, setDeleteType] = useState<"image" | "video">("image");
  const [editingImage, setEditingImage] = useState<GeneratedImage | null>(null);
  const { toast } = useToast();

  const loadVideos = useCallback(async (userId: string) => {
    const { data: videosData, error: videosError } = await supabase
      .from("generated_videos")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(100);

    if (videosError) throw videosError;
    const signedVideos = await Promise.all(
      (videosData || []).map(async (v) => ({
        ...v,
        video_url: await signGeneratedImageUrl(v.video_url),
      })),
    );
    setVideos(signedVideos);
  }, []);

  useEffect(() => {
    loadLibrary();
  }, []);

  // Les vidéos du Studio IA se génèrent en arrière-plan : tant qu'une est en cours,
  // on rafraîchit seulement la liste des vidéos pour afficher son résultat sans recharger la page.
  const hasProcessingVideo = videos.some((v) => getVideoStatus(v) === "processing");
  useEffect(() => {
    if (!hasProcessingVideo) return;
    const timer = setInterval(async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) await loadVideos(user.id);
      } catch (error) {
        console.error("Error refreshing videos:", error);
      }
    }, VIDEO_POLL_MS);
    return () => clearInterval(timer);
  }, [hasProcessingVideo, loadVideos]);

  const loadLibrary = async ({ silent = false } = {}) => {
    try {
      if (!silent) setIsLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Load images WITHOUT the heavy join to avoid timeout
      const { data: imagesData, error: imagesError } = await supabase
        .from("generated_images")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(100);

      if (imagesError) throw imagesError;

      // Load formats separately for the loaded images
      const imageIds = (imagesData || []).map(img => img.id);
      let formatsMap: Record<string, ImageFormat[]> = {};
      
      if (imageIds.length > 0) {
        const { data: formatsData } = await supabase
          .from("image_formats")
          .select("*")
          .in("image_id", imageIds);
        
        if (formatsData) {
          for (const fmt of formatsData) {
            if (!formatsMap[fmt.image_id]) formatsMap[fmt.image_id] = [];
            formatsMap[fmt.image_id].push(fmt);
          }
        }
      }

      const imagesWithFormats = (imagesData || []).map(img => ({
        ...img,
        formats: formatsMap[img.id] || [],
      }));
      // Re-sign URLs from the now-private `generated-images` bucket so the
      // owner can still view historical rows that were saved as public URLs.
      const signedImages = await Promise.all(
        imagesWithFormats.map(async (img) => ({
          ...img,
          image_url: await signGeneratedImageUrl(img.image_url),
          formats: await Promise.all(
            (img.formats || []).map(async (f) => ({
              ...f,
              image_url: await signGeneratedImageUrl(f.image_url),
            })),
          ),
        })),
      );
      setImages(signedImages);

      await loadVideos(user.id);
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
      // .select() : la RLS ignore silencieusement une suppression refusée, on vérifie qu'une ligne a bien disparu.
      const { data: deleted, error } = await supabase
        .from(table)
        .delete()
        .eq("id", deleteId)
        .select("id");

      if (error) throw error;
      if (!deleted || deleted.length === 0) throw new Error("Aucune ligne supprimée");

      if (deleteType === "image") {
        setImages(prev => prev.filter(img => img.id !== deleteId));
      } else {
        setVideos(prev => prev.filter(vid => vid.id !== deleteId));
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

  const handleDownload = async (url: string, filename: string) => {
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);
    } catch (error) {
      console.error("Error downloading file:", error);
      toast({
        title: "Erreur",
        description: "Impossible de télécharger le fichier",
        variant: "destructive",
      });
    }
  };

  const handleSaveEditedImage = async (imageBlob: Blob) => {
    if (!editingImage) return;

    // Les erreurs remontent à l'éditeur, qui reste ouvert pour que l'utilisateur ne perde pas son travail.
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Session expirée");

      // Upload edited image to storage
      const fileName = `${user.id}/images/${editingImage.id}-edited-${Date.now()}.png`;
      const { error: uploadError } = await supabase.storage
        .from("generated-content")
        .upload(fileName, imageBlob, {
          contentType: "image/png",
          upsert: true,
        });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: urlData } = supabase.storage
        .from("generated-content")
        .getPublicUrl(fileName);

      // Update the image record. .select() : sans politique UPDATE la RLS ignore la requête
      // sans erreur, on vérifie donc qu'une ligne a réellement été modifiée.
      const { data: updated, error: updateError } = await supabase
        .from("generated_images")
        .update({ image_url: urlData.publicUrl })
        .eq("id", editingImage.id)
        .eq("user_id", user.id)
        .select("id");

      if (updateError) throw updateError;
      if (!updated || updated.length === 0) throw new Error("Aucune ligne mise à jour");

      // Reload library
      await loadLibrary({ silent: true });
      setEditingImage(null);

      toast({
        title: "Succès",
        description: "Image modifiée enregistrée",
      });
    } catch (error) {
      console.error("Error saving edited image:", error);
      throw error;
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="container mx-auto px-3 md:px-4 py-4 md:py-8">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-2xl md:text-4xl font-bold mb-3 md:mb-6">Ma Bibliothèque</h1>
        <div className="mb-4 rounded-lg border border-amber-300/60 bg-amber-50 dark:bg-amber-950/30 px-3 py-2 text-xs md:text-sm text-amber-900 dark:text-amber-200">
          Les visuels et vidéos sont conservés <strong>30 jours</strong>. Pensez à télécharger ceux que vous voulez garder.
        </div>

        <Tabs defaultValue="images" className="w-full">
          <TabsList className="grid w-full max-w-md grid-cols-2">
            <TabsTrigger value="images">Images ({images.length})</TabsTrigger>
            <TabsTrigger value="videos">Vidéos ({videos.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="images" className="mt-4 md:mt-8">
            {images.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <p>Aucune image générée pour le moment</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 md:gap-4">
                {images.map((image) => (
                  <div key={image.id} className="bg-card rounded-lg overflow-hidden shadow-lg border">
                    <img 
                      src={image.image_url} 
                      alt={getMediaTitle(image.product_details)}
                      className="w-full aspect-square object-contain bg-muted"
                      loading="lazy"
                    />
                    <div className="p-2 md:p-3">
                      <h3 className="font-semibold text-xs md:text-sm mb-1 line-clamp-2">
                        {getMediaTitle(image.product_details)}
                      </h3>
                      <p className="text-xs text-muted-foreground mb-2">
                        {new Date(image.created_at).toLocaleDateString("fr-FR")}
                      </p>
                      
                      {image.formats && image.formats.length > 0 && (
                        <div className="mb-3">
                          <p className="text-xs font-medium text-primary mb-2">
                            ✨ {image.formats.length + 1} formats disponibles
                          </p>
                          <details className="text-xs">
                            <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                              Voir tous les formats
                            </summary>
                            <div className="mt-2 space-y-1 pl-2">
                              <div className="flex justify-between items-center">
                                <span>Original</span>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-6 px-2"
                                  onClick={() => handleDownload(
                                    image.image_url,
                                    `${toFileName(getMediaTitle(image.product_details), 'image')}-original.png`
                                  )}
                                >
                                  <Download className="h-3 w-3" />
                                </Button>
                              </div>
                              {image.formats.map((format) => (
                                <div key={format.id} className="flex justify-between items-center">
                                  <span>{format.format_name} ({format.format_size})</span>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-6 px-2"
                                    onClick={() => handleDownload(
                                      format.image_url,
                                      `${toFileName(getMediaTitle(image.product_details), 'image')}-${toFileName(format.format_name.toLowerCase(), 'format')}.png`
                                    )}
                                  >
                                    <Download className="h-3 w-3" />
                                  </Button>
                                </div>
                              ))}
                            </div>
                          </details>
                        </div>
                      )}
                      
                      <div className="space-y-2">
                        <Button
                          size="sm"
                          className="w-full"
                          onClick={() => setEditingImage(image)}
                        >
                          <Edit className="h-4 w-4 mr-2" />
                          Éditer le Texte
                        </Button>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            className="flex-1"
                            onClick={() => handleDownload(
                              image.image_url, 
                              `${toFileName(getMediaTitle(image.product_details), 'image')}.png`
                            )}
                          >
                            <Download className="h-4 w-4 mr-1" />
                            Original
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
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-6">
                {videos.map((video) => {
                  const status = getVideoStatus(video);
                  const title = getMediaTitle(video.product_details);
                  const isVideo = isVideoFile(video.video_url);
                  const extension = isVideo ? video.video_url.match(/\.(mp4|webm|mov)/i)![1].toLowerCase() : "png";

                  return (
                    <div key={video.id} className="bg-card rounded-lg overflow-hidden shadow-lg border">
                      <div className="w-full aspect-video bg-muted flex items-center justify-center">
                        {status === "processing" ? (
                          <div className="text-center">
                            <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2 text-primary" />
                            <p className="text-sm text-muted-foreground">Génération en cours...</p>
                          </div>
                        ) : status === "failed" ? (
                          <div className="text-center">
                            <p className="text-sm text-destructive">Échec de la génération</p>
                          </div>
                        ) : isVideo ? (
                          <video
                            src={video.video_url}
                            className="w-full h-full object-cover"
                            controls
                            loop
                            muted
                            playsInline
                            preload="metadata"
                          />
                        ) : (
                          // Anciennes entrées : le « média » est une image fixe
                          <img
                            src={video.video_url}
                            alt={title}
                            className="w-full h-full object-cover"
                            loading="lazy"
                          />
                        )}
                      </div>
                      <div className="p-4">
                        <h3 className="font-semibold mb-2 line-clamp-2">{title}</h3>
                        <p className="text-sm text-muted-foreground mb-4">
                          {new Date(video.created_at).toLocaleDateString("fr-FR")}
                        </p>
                        {status !== "processing" && (
                          <div className="flex gap-2">
                            {status === "completed" && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="flex-1"
                                onClick={() =>
                                  handleDownload(video.video_url, `${toFileName(title, "video")}.${extension}`)
                                }
                              >
                                <Download className="h-4 w-4 mr-1" />
                                {isVideo ? `Télécharger ${extension.toUpperCase()}` : "Télécharger PNG"}
                              </Button>
                            )}
                            <Button
                              size="sm"
                              variant="destructive"
                              className={status === "failed" ? "flex-1" : undefined}
                              onClick={() => {
                                setDeleteId(video.id);
                                setDeleteType("video");
                              }}
                            >
                              <Trash2 className="h-4 w-4" />
                              {status === "failed" && <span className="ml-2">Supprimer</span>}
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
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

      {editingImage && (
        <ImageTextEditor
          imageUrl={editingImage.image_url}
          isOpen={!!editingImage}
          onClose={() => setEditingImage(null)}
          onSave={handleSaveEditedImage}
        />
      )}
    </div>
  );
};

export default Library;