import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import { Upload, X, Loader2 } from "lucide-react";

interface VideoUploaderProps {
  showcaseSiteId: string;
  currentVideoUrl: string | null;
  videoType: "hero" | "about";
  onVideoUploaded: (url: string) => void;
  onVideoRemoved: () => void;
}

export function VideoUploader({ 
  showcaseSiteId, 
  currentVideoUrl, 
  videoType,
  onVideoUploaded,
  onVideoRemoved 
}: VideoUploaderProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoPreview, setVideoPreview] = useState<string | null>(currentVideoUrl);

  const handleVideoChange = (file: File | null) => {
    setVideoFile(file);
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setVideoPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    } else {
      setVideoPreview(currentVideoUrl);
    }
  };

  const handleUpload = async () => {
    if (!videoFile) return;

    setIsUploading(true);
    try {
      const fileExt = videoFile.name.split('.').pop();
      const fileName = `${showcaseSiteId}/${videoType}-${Date.now()}.${fileExt}`;
      
      toast.info(`Upload de la vidéo en cours...`, { duration: 3000 });
      
      const { error: uploadError } = await supabase.storage
        .from('showcase-videos')
        .upload(fileName, videoFile);

      if (uploadError) {
        console.error('Upload error:', uploadError);
        toast.error(`Erreur lors de l'upload de la vidéo`);
        return;
      }

      const { data } = supabase.storage
        .from('showcase-videos')
        .getPublicUrl(fileName);

      const videoUrl = data.publicUrl;

      // Update the showcase site with the new video URL
      const updateField = videoType === "hero" ? "hero_video_url" : "about_video_url";
      const { error: updateError } = await supabase
        .from("showcase_sites")
        .update({ [updateField]: videoUrl })
        .eq("id", showcaseSiteId);

      if (updateError) {
        console.error('Update error:', updateError);
        toast.error("Erreur lors de la mise à jour du site");
        return;
      }

      setVideoPreview(videoUrl);
      onVideoUploaded(videoUrl);
      toast.success("Vidéo uploadée avec succès!");
    } catch (error) {
      console.error('Error uploading video:', error);
      toast.error("Erreur lors de l'upload de la vidéo");
    } finally {
      setIsUploading(false);
      setVideoFile(null);
    }
  };

  const handleRemove = async () => {
    try {
      const updateField = videoType === "hero" ? "hero_video_url" : "about_video_url";
      const { error } = await supabase
        .from("showcase_sites")
        .update({ [updateField]: null })
        .eq("id", showcaseSiteId);

      if (error) {
        console.error('Remove error:', error);
        toast.error("Erreur lors de la suppression de la vidéo");
        return;
      }

      // Try to delete from storage if there's a current URL
      if (currentVideoUrl) {
        const urlPath = currentVideoUrl.split('/showcase-videos/')[1];
        if (urlPath) {
          await supabase.storage
            .from('showcase-videos')
            .remove([urlPath]);
        }
      }

      setVideoPreview(null);
      onVideoRemoved();
      toast.success("Vidéo supprimée avec succès!");
    } catch (error) {
      console.error('Error removing video:', error);
      toast.error("Erreur lors de la suppression de la vidéo");
    }
  };

  return (
    <Card>
      <CardContent className="p-4 space-y-4">
        <div className="space-y-2">
          <Label>
            Vidéo {videoType === "hero" ? "Hero / Bannière" : "À propos"} (optionnel)
          </Label>
          
          {videoPreview && (
            <div className="relative">
              <video 
                src={videoPreview} 
                className="w-full max-h-64 object-cover rounded-lg border" 
                controls 
              />
              <Button
                type="button"
                variant="destructive"
                size="sm"
                className="absolute top-2 right-2"
                onClick={handleRemove}
              >
                <X className="h-4 w-4 mr-2" />
                Supprimer
              </Button>
            </div>
          )}

          <div className="flex items-start gap-2">
            <div className="flex-1">
              <Input
                type="file"
                accept="video/*"
                onChange={(e) => {
                  const file = e.target.files?.[0] || null;
                  handleVideoChange(file);
                }}
                disabled={isUploading}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Format: MP4, WEBM, MOV (max 50MB)
              </p>
            </div>
            
            {videoFile && (
              <Button
                type="button"
                onClick={handleUpload}
                disabled={isUploading}
              >
                {isUploading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Upload...
                  </>
                ) : (
                  <>
                    <Upload className="h-4 w-4 mr-2" />
                    Upload
                  </>
                )}
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
