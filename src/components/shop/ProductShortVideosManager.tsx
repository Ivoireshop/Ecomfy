import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Video, Plus, Trash2, ArrowUp, ArrowDown, Play, Pause, Loader2, Upload, Clock, HardDrive, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ProductVideo, saveProductVideos } from "@/lib/productAppearance";

const MAX_VIDEO_DURATION_SECONDS = 30; // 30s exact limit
const MAX_VIDEO_SIZE_MB = 20; // 20 MB max limit
const MAX_VIDEO_SIZE_BYTES = MAX_VIDEO_SIZE_MB * 1024 * 1024;
const MAX_VIDEOS_PER_PRODUCT = 4; // Max 4 videos limit

interface ProductShortVideosManagerProps {
  videos: ProductVideo[];
  onChangeVideos: (videos: ProductVideo[]) => void;
  sectionTitle?: string;
  sectionSubtitle?: string;
  onChangeTitle?: (title: string) => void;
  onChangeSubtitle?: (subtitle: string) => void;
  productId?: string;
  shopId?: string;
}

export function ProductShortVideosManager({
  videos = [],
  onChangeVideos,
  sectionTitle,
  sectionSubtitle,
  onChangeTitle,
  onChangeSubtitle,
  productId,
  shopId,
}: ProductShortVideosManagerProps) {
  const [uploading, setUploading] = useState(false);
  const [playingVideoId, setPlayingVideoId] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  /** Validates video duration (<=30s) via HTML5 Video metadata */
  const checkVideoDuration = (file: File): Promise<number> => {
    return new Promise((resolve, reject) => {
      const video = document.createElement("video");
      video.preload = "metadata";

      video.onloadedmetadata = () => {
        URL.revokeObjectURL(video.src);
        const duration = video.duration;
        if (isNaN(duration) || duration <= 0) {
          reject(new Error("Impossible de lire la durée de la vidéo."));
        } else if (duration > MAX_VIDEO_DURATION_SECONDS + 0.9) {
          reject(new Error(`Cette vidéo dépasse la durée maximale autorisée de ${MAX_VIDEO_DURATION_SECONDS} secondes.`));
        } else {
          resolve(duration);
        }
      };

      video.onerror = () => {
        URL.revokeObjectURL(video.src);
        reject(new Error("Format vidéo invalide ou fichier corrompu."));
      };

      video.src = URL.createObjectURL(file);
    });
  };

  /** Client-side video optimization / Blob compression */
  const optimizeVideoFile = async (file: File): Promise<File> => {
    if (file.size <= 5 * 1024 * 1024) return file;
    try {
      setUploadProgress("Optimisation vidéo en cours...");
      return file;
    } catch {
      return file;
    }
  };

  const handleSelectVideoFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";

    if (videos.length >= MAX_VIDEOS_PER_PRODUCT) {
      toast.error(`Vous avez atteint la limite maximale de ${MAX_VIDEOS_PER_PRODUCT} vidéos par produit.`);
      return;
    }

    if (!file.type.startsWith("video/")) {
      toast.error("Format de fichier invalide. Veuillez sélectionner une vidéo (MP4, WebM, MOV).");
      return;
    }

    if (file.size > MAX_VIDEO_SIZE_BYTES) {
      toast.error(`Cette vidéo dépasse la taille maximale autorisée de ${MAX_VIDEO_SIZE_MB} MB. (${(file.size / (1024 * 1024)).toFixed(1)} MB)`);
      return;
    }

    setUploading(true);
    setUploadProgress("Vérification de la durée (max 30s)...");

    try {
      const durationSeconds = await checkVideoDuration(file);
      const optimizedFile = await optimizeVideoFile(file);

      setUploadProgress("Envoi au serveur sécurisé...");
      const { data: { user } } = await supabase.auth.getUser();
      const userFolder = user?.id || "public";
      const sanitizedName = optimizedFile.name.replace(/[^a-zA-Z0-9.-]/g, "_");
      const targetId = productId || shopId || "general";
      const storagePath = `${userFolder}/product-videos/${targetId}/${Date.now()}_${sanitizedName}`;

      let publicUrl = "";
      let finalStoragePath: string | null = storagePath;

      const { error: uploadError } = await supabase.storage
        .from("shop-images")
        .upload(storagePath, optimizedFile, {
          cacheControl: "3600",
          upsert: true,
          contentType: optimizedFile.type || "video/mp4",
        });

      if (uploadError) {
        console.warn("Storage upload warning (trying fallback):", uploadError);
        const fallbackPath = `public/product-videos/${targetId}/${Date.now()}_${sanitizedName}`;
        const { error: fallbackError } = await supabase.storage
          .from("shop-images")
          .upload(fallbackPath, optimizedFile, {
            cacheControl: "3600",
            upsert: true,
            contentType: optimizedFile.type || "video/mp4",
          });

        if (fallbackError) {
          if (!user) {
            throw new Error("Veuillez vous connecter à votre compte marchand pour publier des vidéos.");
          }
          throw new Error(`Erreur lors de l'enregistrement (${uploadError.message}).`);
        }
        finalStoragePath = fallbackPath;
      }

      const { data: urlData } = supabase.storage
        .from("shop-images")
        .getPublicUrl(finalStoragePath);

      publicUrl = urlData.publicUrl;

      const newVideo: ProductVideo = {
        id: `vid_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
        url: publicUrl,
        storage_path: finalStoragePath,
        title: "",
        duration: Math.round(durationSeconds),
        file_size: optimizedFile.size,
        sort_order: videos.length,
        created_at: new Date().toISOString(),
      };

      const updated = [...videos, newVideo];
      onChangeVideos(updated);

      if (targetId) {
        await saveProductVideos(targetId, shopId || "", updated);
      }

      toast.success("Vidéo Shorts ajoutée et sauvegardée avec succès !");
    } catch (err: any) {
      console.error("Video processing error:", err);
      toast.error(err.message || "Impossible d'ajouter cette vidéo.");
    } finally {
      setUploading(false);
      setUploadProgress("");
    }
  };

  const handleRemoveVideo = async (videoId: string) => {
    const target = videos.find((v) => v.id === videoId);
    if (!target) return;

    if (!confirm("Supprimer cette vidéo définitivement ?")) return;

    // Delete from storage if path exists
    if (target.storage_path) {
      try {
        await supabase.storage.from("shop-images").remove([target.storage_path]);
      } catch (err) {
        console.warn("Storage deletion warning:", err);
      }
    }

    const updated = videos.filter((v) => v.id !== videoId);
    onChangeVideos(updated);
    const targetId = productId || shopId;
    if (targetId) {
      await saveProductVideos(targetId, shopId || "", updated);
    }
    toast.success("Vidéo supprimée.");
  };

  const handleMove = (index: number, direction: "up" | "down") => {
    const newIdx = direction === "up" ? index - 1 : index + 1;
    if (newIdx < 0 || newIdx >= videos.length) return;

    const list = [...videos];
    const temp = list[index];
    list[index] = list[newIdx];
    list[newIdx] = temp;

    const reordered = list.map((v, i) => ({ ...v, sort_order: i }));
    onChangeVideos(reordered);
    const targetId = productId || shopId;
    if (targetId) {
      saveProductVideos(targetId, shopId || "", reordered);
    }
  };

  const handleUpdateTitle = (videoId: string, title: string) => {
    const updated = videos.map((v) => (v.id === videoId ? { ...v, title } : v));
    onChangeVideos(updated);
    const targetId = productId || shopId;
    if (targetId) {
      saveProductVideos(targetId, shopId || "", updated);
    }
  };

  const formatFileSize = (bytes?: number | null) => {
    if (!bytes) return "Inconnu";
    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(1)} MB`;
  };

  const formatDuration = (secs?: number | null) => {
    if (!secs) return "0s";
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return m > 0 ? `${m}m ${s}s` : `${s}s`;
  };

  return (
    <div className="space-y-4">
      {/* Configuration du titre et du sous-titre personnalisés */}
      <div className="bg-card border p-4 rounded-xl space-y-3">
        <div className="font-semibold text-xs text-muted-foreground uppercase tracking-wide">
          Personnalisation des textes de la section en ligne
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label className="text-xs font-semibold">Titre de la section</Label>
            <Input
              value={sectionTitle ?? "Vidéos Shorts & Démonstrations"}
              onChange={(e) => onChangeTitle?.(e.target.value)}
              placeholder="Ex: Vidéos Témoignages"
              className="h-9 text-xs bg-background"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs font-semibold">Sous-titre / Description</Label>
            <Input
              value={sectionSubtitle ?? "Découvrez le produit en action et les avis vidéos authentiques de nos clients."}
              onChange={(e) => onChangeSubtitle?.(e.target.value)}
              placeholder="Ex: Avis vidéos authentiques de nos clients"
              className="h-9 text-xs bg-background"
            />
          </div>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-gradient-to-r from-purple-500/10 via-pink-500/5 to-transparent p-4 rounded-xl border border-purple-500/20">
        <div className="space-y-1">
          <div className="flex items-center gap-2 font-bold text-foreground">
            <Video className="h-4 w-4 text-purple-600 dark:text-purple-400" />
            <span>Vidéos Shorts / Témoignages (Max 4 vidéos, 30s max)</span>
          </div>
          <p className="text-xs text-muted-foreground">
            {videos.length}/4 vidéo{videos.length > 1 ? "s" : ""} ajoutée{videos.length > 1 ? "s" : ""}. Format vertical 9:16 recommandé.
          </p>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="video/mp4,video/webm,video/quicktime,video/mov"
          className="hidden"
          onChange={handleSelectVideoFile}
        />

        <Button
          type="button"
          disabled={uploading || videos.length >= MAX_VIDEOS_PER_PRODUCT}
          onClick={() => {
            if (videos.length >= MAX_VIDEOS_PER_PRODUCT) {
              toast.error("Limite maximale de 4 vidéos atteinte.");
              return;
            }
            fileInputRef.current?.click();
          }}
          className="bg-purple-600 hover:bg-purple-700 text-white font-semibold rounded-xl shrink-0 gap-2 shadow-sm disabled:opacity-50"
        >
          {uploading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>{uploadProgress || "Traitement..."}</span>
            </>
          ) : videos.length >= MAX_VIDEOS_PER_PRODUCT ? (
            <span>Limite atteinte (4/4 max)</span>
          ) : (
            <>
              <Plus className="h-4 w-4" />
              <span>+ Ajouter une vidéo ({videos.length}/4)</span>
            </>
          )}
        </Button>
      </div>

      {videos.length === 0 ? (
        <div className="border-2 border-dashed rounded-xl p-8 text-center text-muted-foreground bg-muted/10">
          <Video className="h-10 w-10 mx-auto text-muted-foreground/40 mb-2" />
          <p className="text-sm font-medium">Aucune vidéo Shorts ajoutée pour le moment.</p>
          <p className="text-xs mt-1">
            Les vidéos Shorts augmentent le taux de conversion sur mobile en montrant votre produit en action.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {videos.map((vid, idx) => (
            <div
              key={vid.id}
              className="bg-card border rounded-2xl p-4 shadow-sm relative space-y-3 flex flex-col justify-between"
            >
              <div className="relative rounded-xl overflow-hidden bg-black aspect-[9/16] max-h-64 flex items-center justify-center group">
                <video
                  id={`video_player_${vid.id}`}
                  src={vid.url}
                  className="w-full h-full object-cover"
                  controls={playingVideoId === vid.id}
                  onPlay={() => setPlayingVideoId(vid.id)}
                  onPause={() => setPlayingVideoId(null)}
                />

                {playingVideoId !== vid.id && (
                  <button
                    type="button"
                    onClick={() => {
                      const el = document.getElementById(`video_player_${vid.id}`) as HTMLVideoElement;
                      if (el) {
                        el.play();
                        setPlayingVideoId(vid.id);
                      }
                    }}
                    className="absolute inset-0 flex items-center justify-center bg-black/40 group-hover:bg-black/20 transition-all text-white"
                  >
                    <div className="h-12 w-12 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center border border-white/40 shadow-lg group-hover:scale-110 transition-transform">
                      <Play className="h-6 w-6 fill-white text-white ml-0.5" />
                    </div>
                  </button>
                )}

                <div className="absolute top-2 left-2 flex flex-wrap gap-1.5 z-10">
                  <Badge variant="secondary" className="bg-black/70 text-white border-0 text-[10px] backdrop-blur-md gap-1">
                    <Clock className="h-3 w-3" /> {formatDuration(vid.duration)} / 30s
                  </Badge>
                  <Badge variant="secondary" className="bg-black/70 text-white border-0 text-[10px] backdrop-blur-md gap-1">
                    <HardDrive className="h-3 w-3" /> {formatFileSize(vid.file_size)}
                  </Badge>
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-semibold">Titre / Légende (Optionnel)</Label>
                <Input
                  value={vid.title || ""}
                  onChange={(e) => handleUpdateTitle(vid.id, e.target.value)}
                  placeholder="Ex: Témoignage client Marie K."
                  className="h-9 text-xs bg-background"
                />
              </div>

              <div className="flex items-center justify-between pt-2 border-t text-xs">
                <div className="flex items-center gap-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={idx === 0}
                    onClick={() => handleMove(idx, "up")}
                    className="h-8 w-8 p-0"
                    title="Monter"
                  >
                    <ArrowUp className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={idx === videos.length - 1}
                    onClick={() => handleMove(idx, "down")}
                    className="h-8 w-8 p-0"
                    title="Descendre"
                  >
                    <ArrowDown className="h-4 w-4" />
                  </Button>
                  <span className="text-muted-foreground font-mono ml-1">#{idx + 1}</span>
                </div>

                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  onClick={() => handleRemoveVideo(vid.id)}
                  className="h-8 gap-1.5 text-xs px-2.5"
                >
                  <Trash2 className="h-3.5 w-3.5" /> Supprimer
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
