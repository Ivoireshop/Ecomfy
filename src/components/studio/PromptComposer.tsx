import React, { useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Send, Loader2, Sparkles } from "lucide-react";
import { MediaUploader, MediaFile } from "./MediaUploader";
import { AdvancedSettings, StudioSettings } from "./AdvancedSettings";

interface PromptComposerProps {
  prompt: string;
  setPrompt: (val: string) => void;
  media: MediaFile[];
  setMedia: (media: MediaFile[]) => void;
  mode: "image" | "video";
  settings: StudioSettings;
  setSettings: (settings: StudioSettings) => void;
  onGenerate: () => void;
  isGenerating: boolean;
}

export const PromptComposer = ({
  prompt,
  setPrompt,
  media,
  setMedia,
  mode,
  settings,
  setSettings,
  onGenerate,
  isGenerating,
}: PromptComposerProps) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "0px";
      const scrollHeight = textareaRef.current.scrollHeight;
      textareaRef.current.style.height = Math.max(56, Math.min(scrollHeight, 180)) + "px";
    }
  }, [prompt]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if ((prompt.trim() || media.length > 0) && !isGenerating) {
        onGenerate();
      }
    }
  };

  const placeholder = mode === "image" 
    ? "Décrivez l'image à générer ou importez une photo produit de référence... (Entrée pour lancer)"
    : "Décrivez la vidéo à générer ou importez vos photos de référence... (Entrée pour lancer)";

  return (
    <div className="w-full max-w-4xl mx-auto flex flex-col items-center bg-card/90 backdrop-blur-xl rounded-3xl shadow-2xl border border-border/80 p-3.5 transition-all">
      {/* Uploaded media previews */}
      {media.length > 0 && (
        <div className="w-full pb-2 px-1">
          <MediaUploader media={media} onChange={setMedia} mode={mode} />
        </div>
      )}

      <div className="flex w-full items-end gap-2">
        {/* Left Actions - Media upload button */}
        {media.length === 0 && (
          <div className="pb-1.5 shrink-0">
            <MediaUploader media={media} onChange={setMedia} mode={mode} />
          </div>
        )}

        <div className="relative w-full flex items-end bg-muted/40 hover:bg-muted/60 focus-within:bg-background rounded-2xl border border-border/60 focus-within:border-[#0E7C66] focus-within:ring-2 focus-within:ring-[#0E7C66]/20 transition-all">
          <Textarea
            ref={textareaRef}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            className="min-h-[56px] w-full resize-none bg-transparent border-0 focus-visible:ring-0 focus-visible:ring-offset-0 px-4 py-3.5 text-sm sm:text-base font-normal text-foreground placeholder:text-muted-foreground/70 custom-scrollbar"
            disabled={isGenerating}
          />
          
          <div className="flex items-center gap-1.5 pr-2.5 pb-2.5 shrink-0">
            <AdvancedSettings mode={mode} settings={settings} onSettingsChange={setSettings} />
            
            <Button 
              size="icon" 
              onClick={onGenerate} 
              disabled={isGenerating || (!prompt.trim() && media.length === 0)}
              className="h-10 w-10 rounded-xl ml-1 shrink-0 bg-[#0E7C66] hover:bg-[#0A6352] text-white shadow-md shadow-[#0E7C66]/20 disabled:opacity-40 transition-all"
              title="Lancer la génération (Entrée)"
            >
              {isGenerating ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-4 w-4 ml-0.5" />}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
