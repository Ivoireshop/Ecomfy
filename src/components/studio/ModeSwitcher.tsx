import { Image as ImageIcon, Video as VideoIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface ModeSwitcherProps {
  mode: "image" | "video";
  onChange: (mode: "image" | "video") => void;
}

export const ModeSwitcher = ({ mode, onChange }: ModeSwitcherProps) => {
  return (
    <div className="flex items-center justify-center p-1 space-x-1 bg-muted/50 rounded-xl max-w-[300px] mx-auto border shadow-sm">
      <button
        onClick={() => onChange("image")}
        className={cn(
          "flex items-center justify-center w-full px-4 py-2 text-sm font-medium transition-all rounded-lg outline-none",
          mode === "image"
            ? "bg-background text-foreground shadow-sm ring-1 ring-border"
            : "text-muted-foreground hover:text-foreground hover:bg-muted"
        )}
      >
        <ImageIcon className="w-4 h-4 mr-2" />
        Images
      </button>
      <button
        onClick={() => onChange("video")}
        className={cn(
          "flex items-center justify-center w-full px-4 py-2 text-sm font-medium transition-all rounded-lg outline-none",
          mode === "video"
            ? "bg-background text-foreground shadow-sm ring-1 ring-border"
            : "text-muted-foreground hover:text-foreground hover:bg-muted"
        )}
      >
        <VideoIcon className="w-4 h-4 mr-2" />
        Vidéos
      </button>
    </div>
  );
};
