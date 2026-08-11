import React, { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Plus, X, Image as ImageIcon, FileUp } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export interface MediaFile {
  id: string;
  url: string; // base64 string
  file: File;
}

interface MediaUploaderProps {
  media: MediaFile[];
  onChange: (media: MediaFile[]) => void;
  maxFiles?: number;
  mode: "image" | "video";
}

export const MediaUploader = ({ media, onChange, maxFiles = 5, mode }: MediaUploaderProps) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const processFile = (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast.error("Veuillez sélectionner un fichier image valide");
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      toast.error("L'image ne doit pas dépasser 10 Mo");
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      const newMediaFile: MediaFile = {
        id: Math.random().toString(36).substring(7),
        url: dataUrl,
        file,
      };
      
      // Prevent exceeding maxFiles
      if (media.length >= maxFiles) {
        toast.error(`Vous ne pouvez ajouter que ${maxFiles} image(s) maximum.`);
        return;
      }
      
      // For images, if the backend only supports 1 image for text-to-image/image-edit
      // we might want to restrict it here or just let the main component warn.
      if (mode === "image" && media.length >= 1) {
        toast.info("Attention: le modèle d'image actuel n'utilise que la première image fournie comme référence.");
      }
      
      onChange([...media, newMediaFile]);
    };
    reader.readAsDataURL(file);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    // Process files up to the remaining limit
    const remainingSlots = maxFiles - media.length;
    Array.from(files).slice(0, remainingSlots).forEach(processFile);
    
    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const removeMedia = (id: string) => {
    onChange(media.filter((m) => m.id !== id));
  };

  return (
    <div className="flex flex-wrap gap-2 items-center mb-3">
      {media.map((item) => (
        <div key={item.id} className="relative group rounded-lg overflow-hidden border border-border bg-muted h-16 w-16">
          <img src={item.url} alt="Preview" className="h-full w-full object-cover" />
          <button
            onClick={() => removeMedia(item.id)}
            className="absolute top-1 right-1 p-0.5 bg-background/80 hover:bg-destructive hover:text-destructive-foreground rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
            title="Supprimer"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      ))}
      
      {media.length < maxFiles && (
        <div className="relative">
          <input
            type="file"
            ref={fileInputRef}
            className="hidden"
            accept="image/png, image/jpeg, image/webp"
            multiple
            onChange={handleFileChange}
          />
          <Button 
            variant="outline" 
            size="icon" 
            className="h-10 w-10 rounded-full border-dashed text-muted-foreground hover:text-primary hover:border-primary shrink-0 transition-colors"
            onClick={() => fileInputRef.current?.click()}
            title="Ajouter une image"
          >
            <Plus className="h-5 w-5" />
          </Button>
        </div>
      )}
    </div>
  );
};
