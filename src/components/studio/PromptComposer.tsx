import React, { useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Send, Loader2 } from "lucide-react";
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
      textareaRef.current.style.height = Math.max(56, Math.min(scrollHeight, 200)) + "px";
    }
  }, [prompt]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
      e.preventDefault();
      if (prompt.trim() && !isGenerating) {
        onGenerate();
      }
    }
  };

  const placeholder = mode === "image" 
    ? "Décrivez l'image que vous souhaitez créer... (Ctrl + Enter pour envoyer)"
    : "Décrivez la vidéo que vous souhaitez créer... (Ctrl + Enter pour envoyer)";

  return (
    <div className="w-full max-w-4xl mx-auto flex flex-col items-center bg-card rounded-2xl shadow-lg border border-border p-3 mt-auto transition-all">
      {/* Uploaded media previews */}
      {media.length > 0 && (
        <div className="w-full pl-2">
          <MediaUploader media={media} onChange={setMedia} mode={mode} />
        </div>
      )}

      <div className="flex w-full items-end gap-2">
        {/* Left Actions - Media upload if empty */}
        {media.length === 0 && (
          <div className="pb-1">
            <MediaUploader media={media} onChange={setMedia} mode={mode} />
          </div>
        )}

        <div className="relative w-full flex items-end bg-muted/30 rounded-xl border border-input focus-within:ring-1 focus-within:ring-ring focus-within:border-primary transition-all">
          <Textarea
            ref={textareaRef}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            className="min-h-[56px] w-full resize-none bg-transparent border-0 focus-visible:ring-0 focus-visible:ring-offset-0 px-4 py-4 text-base custom-scrollbar"
            disabled={isGenerating}
          />
          
          <div className="flex items-center gap-1 pr-2 pb-2">
            <AdvancedSettings mode={mode} settings={settings} onSettingsChange={setSettings} />
            
            <Button 
              size="icon" 
              onClick={onGenerate} 
              disabled={isGenerating || !prompt.trim()}
              className="h-9 w-9 rounded-full ml-1 shrink-0 bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm transition-all"
            >
              {isGenerating ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
