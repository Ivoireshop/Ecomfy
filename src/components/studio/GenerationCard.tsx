import { Button } from "@/components/ui/button";
import { Download, Film, Sparkles, RefreshCw, Wand2 } from "lucide-react";

interface GenerationCardProps {
  url: string | null;
  mode: "image" | "video";
  onAnimateImage?: (url: string) => void;
  onDownload?: () => void;
  onRegenerate?: () => void;
}

export const GenerationCard = ({ url, mode, onAnimateImage, onDownload, onRegenerate }: GenerationCardProps) => {
  if (!url) return null;

  return (
    <div className="w-full max-w-4xl mx-auto flex flex-col items-center justify-center animate-in fade-in zoom-in duration-500 mb-8 mt-4">
      <div className="relative group w-full rounded-2xl overflow-hidden shadow-2xl border border-border bg-muted flex items-center justify-center min-h-[300px] md:min-h-[500px]">
        {mode === "image" ? (
          <img src={url} alt="Generated" className="w-full h-full object-contain" />
        ) : (
          <video src={url} controls autoPlay loop className="w-full h-full object-contain" />
        )}
      </div>

      <div className="flex flex-wrap items-center justify-center gap-3 mt-6">
        <Button variant="outline" className="shadow-sm hover:shadow" onClick={onDownload}>
          <Download className="w-4 h-4 mr-2" />
          Télécharger
        </Button>
        <Button variant="outline" className="shadow-sm hover:shadow" onClick={onRegenerate}>
          <RefreshCw className="w-4 h-4 mr-2" />
          Régénérer
        </Button>
        {mode === "image" && onAnimateImage && (
          <Button 
            className="shadow-md bg-gradient-to-r from-primary to-primary/80 hover:opacity-90 transition-opacity" 
            onClick={() => onAnimateImage(url)}
          >
            <Film className="w-4 h-4 mr-2" />
            Animer cette image
          </Button>
        )}
      </div>
    </div>
  );
};
