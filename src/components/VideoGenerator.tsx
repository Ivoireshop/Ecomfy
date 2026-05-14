import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { Upload, X, ImageIcon, Loader2, Video, Film, Clapperboard, Download } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface VideoGeneratorProps {
  hasActiveSubscription: boolean;
  isFounder: boolean;
  videoGenerationsRemaining: number;
  onVideoGenerated?: () => void;
}

interface GeneratedVideoResult {
  videoUrl: string;
  videoId: string;
  message: string;
  isImage?: boolean;
}

export function VideoGenerator({
  hasActiveSubscription,
  isFounder,
  videoGenerationsRemaining,
  onVideoGenerated,
}: VideoGeneratorProps) {
  const navigate = useNavigate();
  const [images, setImages] = useState<{ file: File; preview: string }[]>([]);
  const [prompt, setPrompt] = useState("");
  const [videoDuration, setVideoDuration] = useState<"5" | "10">("10");
  const [videoStyle, setVideoStyle] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [progress, setProgress] = useState<{ step: string; percentage: number } | null>(null);
  const [generatedVideo, setGeneratedVideo] = useState<GeneratedVideoResult | null>(null);

  const MAX_IMAGES = 4;

  const addFiles = async (files: FileList | null) => {
    if (!files) return;
    const remaining = MAX_IMAGES - images.length;
    if (remaining <= 0) {
      toast.error(`Maximum ${MAX_IMAGES} images`);
      return;
    }

    const newImages: { file: File; preview: string }[] = [];
    for (let i = 0; i < Math.min(files.length, remaining); i++) {
      const file = files[i];
      if (!file.type.startsWith("image/")) continue;
      if (file.size > 5 * 1024 * 1024) {
        toast.error(`${file.name} dépasse 5 MB`);
        continue;
      }
      const preview = URL.createObjectURL(file);
      newImages.push({ file, preview });
    }
    setImages((prev) => [...prev, ...newImages]);
  };

  const removeImage = (index: number) => {
    setImages((prev) => {
      URL.revokeObjectURL(prev[index].preview);
      return prev.filter((_, i) => i !== index);
    });
  };

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      addFiles(e.dataTransfer.files);
    },
    [images.length]
  );

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      toast.error("Veuillez entrer un prompt pour la vidéo");
      return;
    }

    if (!hasActiveSubscription && !isFounder) {
      toast.error("La génération de vidéos nécessite un abonnement actif");
      navigate("/subscription");
      return;
    }

    if (!isFounder && videoGenerationsRemaining <= 0) {
      toast.error("Vous avez épuisé vos générations de vidéos ce mois-ci");
      return;
    }

    setIsGenerating(true);
    setProgress({ step: "uploading", percentage: 5 });

    let channel: ReturnType<typeof supabase.channel> | null = null;
    let progressInterval: ReturnType<typeof setInterval> | null = null;

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error("Session expirée, veuillez vous reconnecter");
        navigate("/auth");
        return;
      }

      // Upload images to storage
      const imageUrls: string[] = [];
      for (const img of images) {
        const ext = img.file.name.split(".").pop() || "jpg";
        const path = `${session.user.id}/video-refs/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from("generated-images")
          .upload(path, img.file, { contentType: img.file.type });
        if (upErr) throw upErr;
        const { data: urlData } = supabase.storage.from("generated-images").getPublicUrl(path);
        imageUrls.push(urlData.publicUrl);
      }

      setProgress({ step: "generating", percentage: 10 });

      // Start a smooth progress animation to avoid "stuck" feeling
      let currentProgress = 10;
      progressInterval = setInterval(() => {
        // Keep moving gently while the backend works, without showing 100% before completion.
        if (currentProgress < 94) {
          currentProgress += Math.random() * 1.6;
          currentProgress = Math.min(currentProgress, 94);
          setProgress(prev => prev ? { ...prev, percentage: Math.round(currentProgress) } : null);
        }
      }, 1500);

      // Call edge function (returns immediately with videoId; we poll via realtime)
      const { data, error } = await supabase.functions.invoke("generate-video", {
        body: {
          productName: "Produit vidéo",
          niche: "general",
          description: prompt,
          benefits: "",
          platform: "instagram",
          style: videoStyle || "moderne",
          price: "",
          personDescription: "",
          duration: Number(videoDuration),
          referenceImages: imageUrls,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.details || data.error);

      const videoId = data?.videoId;
      if (!videoId) throw new Error("Réponse invalide du serveur");

      // Subscribe to realtime updates on generated_videos for this row
      channel = supabase
        .channel(`video-progress-${videoId}`)
        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table: "generated_videos",
            filter: `id=eq.${videoId}`,
          },
          (payload: any) => {
            const row = payload.new || {};
            const step = row.progress_step || "processing";
            const pct = typeof row.progress_percentage === "number" ? row.progress_percentage : null;
            if (pct !== null && pct > currentProgress) {
              currentProgress = pct;
              setProgress({ step, percentage: pct });
            } else {
              setProgress((prev) => prev ? { ...prev, step } : { step, percentage: currentProgress });
            }

            if (row.status === "completed") {
              if (progressInterval) clearInterval(progressInterval);
              setProgress({ step: "completed", percentage: 100 });
              toast.success("Vidéo générée avec succès !");
              setGeneratedVideo({
                videoUrl: row.video_url,
                videoId,
                message: "Vidéo générée avec succès !",
                isImage: row.video_url?.endsWith(".mp4") ? false : !row.video_url?.includes("/videos/"),
              });
              setTimeout(() => {
                setProgress(null);
                setIsGenerating(false);
                onVideoGenerated?.();
              }, 1000);
              if (channel) supabase.removeChannel(channel);
            } else if (row.status === "failed") {
              if (progressInterval) clearInterval(progressInterval);
              toast.error("La génération de la vidéo a échoué");
              setProgress(null);
              setIsGenerating(false);
              if (channel) supabase.removeChannel(channel);
            }
          }
        )
        .subscribe();

      const pollInterval = setInterval(async () => {
        try {
          const { data: row } = await supabase
            .from("generated_videos")
            .select("status, video_url, progress_step, progress_percentage")
            .eq("id", videoId)
            .maybeSingle();

          if (!row) return;

          const pct = typeof row.progress_percentage === "number" ? row.progress_percentage : currentProgress;
          if (pct > currentProgress) currentProgress = pct;
          setProgress({ step: row.progress_step || "processing", percentage: Math.round(Math.max(currentProgress, pct)) });

          if (row.status === "completed" && row.video_url) {
            if (progressInterval) clearInterval(progressInterval);
            clearInterval(pollInterval);
            setProgress({ step: "completed", percentage: 100 });
            setGeneratedVideo({
              videoUrl: row.video_url,
              videoId,
              message: "Vidéo générée avec succès !",
              isImage: row.video_url?.endsWith(".mp4") ? false : !row.video_url?.includes("/videos/"),
            });
            setTimeout(() => {
              setProgress(null);
              setIsGenerating(false);
              onVideoGenerated?.();
            }, 1000);
            if (channel) supabase.removeChannel(channel);
          } else if (row.status === "failed") {
            if (progressInterval) clearInterval(progressInterval);
            clearInterval(pollInterval);
            toast.error("La génération de la vidéo a échoué");
            setProgress(null);
            setIsGenerating(false);
            if (channel) supabase.removeChannel(channel);
          }
        } catch (_) { /* ignore polling hiccups */ }
      }, 5000);

      // Safety timeout: avoid leaving the UI blocked for minutes.
      setTimeout(async () => {
        try {
          const { data: row } = await supabase
            .from("generated_videos")
            .select("status, video_url, progress_step, progress_percentage")
            .eq("id", videoId)
            .maybeSingle();
          if (row && row.status === "completed" && row.video_url) return;
          if (row && row.status !== "failed") {
            toast.message("La génération prend plus de temps que prévu. Elle continuera dans la bibliothèque.");
            if (progressInterval) clearInterval(progressInterval);
            clearInterval(pollInterval);
            setProgress(null);
            setIsGenerating(false);
            if (channel) supabase.removeChannel(channel);
          }
        } catch (_) { /* ignore */ }
      }, 2 * 60 * 1000);
    } catch (err: any) {
      if (progressInterval) clearInterval(progressInterval);
      if (channel) supabase.removeChannel(channel);
      console.error("Video generation error:", err);
      toast.error(err?.message || "Erreur lors de la génération");
      setProgress(null);
      setIsGenerating(false);
    }
  };

  const stepLabels: Record<string, string> = {
    uploading: "📤 Upload des images...",
    generating: "🎬 Génération en cours, cela peut prendre 1-2 minutes...",
    initializing: "⏳ Initialisation...",
    generating_image: "🎨 Création de l'image de base...",
    image_generated: "✅ Image créée !",
    animating_video: "🎬 Animation de la vidéo...",
    video_ready: "🎉 Vidéo prête !",
    finalizing: "📦 Finalisation...",
    completed: "✨ Terminé !",
  };

  if (!hasActiveSubscription && !isFounder) {
    return (
      <div className="container mx-auto px-4 max-w-3xl">
        <Card className="border-primary/20">
          <CardHeader className="text-center">
            <div className="mx-auto p-4 rounded-full bg-primary/10 w-fit mb-4">
              <Film className="h-10 w-10 text-primary" />
            </div>
            <CardTitle className="text-2xl">Génération de Vidéos Publicitaires</CardTitle>
            <CardDescription className="text-base">
              Créez des vidéos publicitaires professionnelles de 5 à 10 secondes à partir de vos images et d'un prompt.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="p-4 bg-muted/50 rounded-lg space-y-2">
              <h4 className="font-semibold">Ce que vous pouvez faire :</h4>
              <ul className="space-y-1 text-sm text-muted-foreground">
                <li>🎬 Importer jusqu'à 4 images (produit, modèle, décor...)</li>
                <li>✍️ Décrire votre vidéo avec un prompt</li>
                <li>⚡ Obtenir une vidéo HD en quelques secondes</li>
                <li>📱 Optimisée pour les réseaux sociaux</li>
              </ul>
            </div>
            <Button onClick={() => navigate("/subscription")} className="w-full" size="lg">
              Souscrire pour générer des vidéos
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 max-w-3xl space-y-6">
      {/* Header */}
      <div className="text-center space-y-2">
        <div className="mx-auto p-3 rounded-full bg-primary/10 w-fit">
          <Clapperboard className="h-8 w-8 text-primary" />
        </div>
        <h2 className="text-2xl font-bold">Créer une Vidéo Publicitaire</h2>
        <p className="text-muted-foreground">
          Importez vos images et décrivez la vidéo que vous souhaitez obtenir
        </p>
        {!isFounder && (
          <p className="text-sm text-muted-foreground">
            🎬 Il vous reste <strong>{videoGenerationsRemaining}</strong> vidéo{videoGenerationsRemaining > 1 ? "s" : ""} ce mois-ci
          </p>
        )}
      </div>

      {/* Image Upload Zone */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <ImageIcon className="h-5 w-5" />
            Images de référence
          </CardTitle>
          <CardDescription>
            Importez 1 à 4 images : produit, modèle, décor, inspiration... (max 5 MB chacune)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div
            className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors cursor-pointer ${
              isDragging ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"
            }`}
            onDrop={handleDrop}
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onClick={() => document.getElementById("video-image-upload")?.click()}
          >
            <div className="flex flex-col items-center gap-3">
              <div className="p-3 rounded-full bg-primary/10">
                <Upload className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="font-medium">Glissez-déposez vos images ici</p>
                <p className="text-sm text-muted-foreground">
                  ou cliquez pour sélectionner ({images.length}/{MAX_IMAGES})
                </p>
              </div>
            </div>
            <input
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              id="video-image-upload"
              onChange={(e) => addFiles(e.target.files)}
              disabled={isGenerating || images.length >= MAX_IMAGES}
            />
          </div>

          {images.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {images.map((img, i) => (
                <div key={i} className="relative group rounded-lg overflow-hidden border">
                  <img src={img.preview} alt={`Ref ${i + 1}`} className="w-full aspect-square object-cover" />
                  <Button
                    variant="destructive"
                    size="icon"
                    className="absolute top-1 right-1 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={(e) => { e.stopPropagation(); removeImage(i); }}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                  <span className="absolute bottom-1 left-1 bg-black/60 text-white text-xs px-1.5 py-0.5 rounded">
                    {i === 0 ? "Produit" : i === 1 ? "Modèle" : `Image ${i + 1}`}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Prompt & Options */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Video className="h-5 w-5" />
            Description de la vidéo
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="video-prompt">Décrivez la vidéo que vous souhaitez *</Label>
            <Textarea
              id="video-prompt"
              placeholder="Ex: Montrer le produit avec un zoom progressif, une femme élégante qui le présente, avec des effets de lumière dorée et un mouvement de caméra fluide..."
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={4}
              disabled={isGenerating}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Durée</Label>
              <Select value={videoDuration} onValueChange={(v) => setVideoDuration(v as "5" | "10")}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="5">5 secondes</SelectItem>
                  <SelectItem value="10">10 secondes</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Style</Label>
              <Select value={videoStyle} onValueChange={setVideoStyle}>
                <SelectTrigger>
                  <SelectValue placeholder="Choisir un style" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="moderne">Moderne</SelectItem>
                  <SelectItem value="luxueux">Luxueux</SelectItem>
                  <SelectItem value="dynamique">Dynamique</SelectItem>
                  <SelectItem value="minimaliste">Minimaliste</SelectItem>
                  <SelectItem value="cinematique">Cinématique</SelectItem>
                  <SelectItem value="traditionnel">Traditionnel Africain</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Progress */}
      {progress && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Progression</span>
              <span className="text-sm text-muted-foreground">{progress.percentage}%</span>
            </div>
            <Progress value={progress.percentage} />
            <p className="text-sm text-center text-muted-foreground">
              {stepLabels[progress.step] || progress.step}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Generate Button */}
      <Button
        onClick={handleGenerate}
        className="w-full text-lg py-6"
        size="lg"
        disabled={isGenerating || !prompt.trim() || (!isFounder && videoGenerationsRemaining <= 0)}
      >
        {isGenerating ? (
          <>
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            Génération en cours...
          </>
        ) : (
          <>
            <Film className="mr-2 h-5 w-5" />
            Générer ma vidéo publicitaire
          </>
        )}
      </Button>
      {/* Generated Video Result */}
      {generatedVideo && (
        <Card className="border-primary/30 bg-primary/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              {generatedVideo.isImage ? "🖼️ Image générée (vidéo indisponible)" : "🎉 Votre vidéo MP4 est prête !"}
            </CardTitle>
            <CardDescription>{generatedVideo.message}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-lg overflow-hidden bg-black">
              {generatedVideo.videoUrl.endsWith('.mp4') ? (
                <video
                  src={generatedVideo.videoUrl}
                  controls
                  autoPlay
                  muted
                  playsInline
                  loop
                  className="w-full max-h-[500px] object-contain"
                />
              ) : (
                <img
                  src={generatedVideo.videoUrl}
                  alt="Contenu généré"
                  className="w-full max-h-[500px] object-contain"
                />
              )}
            </div>
            <div className="flex gap-3">
              <Button
                className="flex-1"
                onClick={() => {
                  const ext = generatedVideo.videoUrl.endsWith('.mp4') ? 'mp4' : 'png';
                  const link = document.createElement('a');
                  link.href = generatedVideo.videoUrl;
                  link.download = `video-${generatedVideo.videoId}.${ext}`;
                  link.target = '_blank';
                  document.body.appendChild(link);
                  link.click();
                  document.body.removeChild(link);
                }}
              >
                <Download className="h-4 w-4 mr-2" />
                Télécharger
              </Button>
              <Button variant="outline" onClick={() => navigate("/library")}>
                Voir la bibliothèque
              </Button>
              <Button variant="ghost" onClick={() => setGeneratedVideo(null)}>
                Nouvelle vidéo
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
