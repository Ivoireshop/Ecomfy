import { Image as ImageIcon, Video as VideoIcon, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

interface ModeSwitcherProps {
  mode: "image" | "video";
  onChange: (mode: "image" | "video") => void;
}

export const ModeSwitcher = ({ mode, onChange }: ModeSwitcherProps) => {
  return (
    <div className="inline-flex items-center justify-center p-1.5 bg-card/80 backdrop-blur-md border border-border/60 rounded-2xl shadow-sm transition-all">
      <button
        type="button"
        onClick={() => onChange("image")}
        className={cn(
          "flex items-center justify-center px-5 py-2.5 text-xs sm:text-sm font-extrabold transition-all rounded-xl outline-none whitespace-nowrap shrink-0 gap-2",
          mode === "image"
            ? "bg-[#0E7C66] text-white shadow-md shadow-[#0E7C66]/20 scale-[1.02]"
            : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
        )}
      >
        <ImageIcon className="w-4 h-4 shrink-0" />
        <span className="whitespace-nowrap">Générer Images HD</span>
      </button>
      <button
        type="button"
        onClick={() => onChange("video")}
        className={cn(
          "flex items-center justify-center px-5 py-2.5 text-xs sm:text-sm font-extrabold transition-all rounded-xl outline-none whitespace-nowrap shrink-0 gap-2",
          mode === "video"
            ? "bg-purple-600 text-white shadow-md shadow-purple-600/20 scale-[1.02]"
            : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
        )}
      >
        <VideoIcon className="w-4 h-4 shrink-0" />
        <span className="whitespace-nowrap">Générer Vidéos IA</span>
      </button>
    </div>
  );
};
