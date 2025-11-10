import { useState, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Upload, X, Image as ImageIcon, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface MultiImageUploaderProps {
  onImagesUploaded: (imageUrls: string[]) => void;
  maxImages?: number;
}

export function MultiImageUploader({ onImagesUploaded, maxImages = 10 }: MultiImageUploaderProps) {
  const [uploadedImages, setUploadedImages] = useState<string[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const handleFileUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    const totalImages = uploadedImages.length + files.length;
    if (totalImages > maxImages) {
      toast.error(`Maximum ${maxImages} images autorisées`);
      return;
    }

    setIsUploading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Non authentifié");

      const uploadPromises = Array.from(files).map(async (file) => {
        // Validate file type
        if (!file.type.startsWith("image/")) {
          throw new Error(`${file.name} n'est pas une image`);
        }

        // Validate file size (max 5MB)
        if (file.size > 5 * 1024 * 1024) {
          throw new Error(`${file.name} est trop volumineux (max 5MB)`);
        }

        const fileName = `product-ref-${Date.now()}-${Math.random().toString(36).substring(7)}.${file.name.split('.').pop()}`;
        const filePath = `${user.id}/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from("generated-images")
          .upload(filePath, file, {
            contentType: file.type,
            upsert: false,
          });

        if (uploadError) throw uploadError;

        const { data: urlData } = supabase.storage
          .from("generated-images")
          .getPublicUrl(filePath);

        return urlData.publicUrl;
      });

      const newImageUrls = await Promise.all(uploadPromises);
      const allImages = [...uploadedImages, ...newImageUrls];
      setUploadedImages(allImages);
      onImagesUploaded(allImages);
      toast.success(`${newImageUrls.length} image(s) uploadée(s)`);
    } catch (error: any) {
      console.error("Error uploading images:", error);
      toast.error(error?.message || "Erreur lors de l'upload");
    } finally {
      setIsUploading(false);
    }
  };

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setIsDragging(false);
      handleFileUpload(e.dataTransfer.files);
    },
    [uploadedImages]
  );

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const removeImage = (index: number) => {
    const newImages = uploadedImages.filter((_, i) => i !== index);
    setUploadedImages(newImages);
    onImagesUploaded(newImages);
    toast.success("Image retirée");
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ImageIcon className="h-5 w-5" />
          Images de Référence du Produit
        </CardTitle>
        <CardDescription>
          Uploadez 5-10 images de votre produit pour un fine-tuning précis (max 5MB par image)
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div
          className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
            isDragging
              ? "border-primary bg-primary/5"
              : "border-border hover:border-primary/50"
          }`}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
        >
          <div className="flex flex-col items-center gap-4">
            <div className="p-4 rounded-full bg-primary/10">
              {isUploading ? (
                <Loader2 className="h-8 w-8 text-primary animate-spin" />
              ) : (
                <Upload className="h-8 w-8 text-primary" />
              )}
            </div>
            <div>
              <p className="font-medium mb-1">
                {isUploading ? "Upload en cours..." : "Glissez-déposez vos images ici"}
              </p>
              <p className="text-sm text-muted-foreground">
                ou cliquez pour sélectionner ({uploadedImages.length}/{maxImages})
              </p>
            </div>
            <input
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              id="multi-image-upload"
              onChange={(e) => handleFileUpload(e.target.files)}
              disabled={isUploading || uploadedImages.length >= maxImages}
            />
            <Label htmlFor="multi-image-upload">
              <Button
                variant="outline"
                disabled={isUploading || uploadedImages.length >= maxImages}
                asChild
              >
                <span>Sélectionner les images</span>
              </Button>
            </Label>
          </div>
        </div>

        {uploadedImages.length > 0 && (
          <div>
            <Label className="text-sm text-muted-foreground mb-2 block">
              Images uploadées ({uploadedImages.length})
            </Label>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
              {uploadedImages.map((imageUrl, index) => (
                <div key={index} className="relative group">
                  <img
                    src={imageUrl}
                    alt={`Référence ${index + 1}`}
                    className="w-full aspect-square object-cover rounded-lg border"
                  />
                  <Button
                    variant="destructive"
                    size="icon"
                    className="absolute top-1 right-1 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={() => removeImage(index)}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
