import React, { useRef, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Send, Loader2, Sparkles, SlidersHorizontal, X, Terminal } from "lucide-react";
import { MediaUploader, MediaFile } from "./MediaUploader";
import { AdvancedSettings, StudioSettings } from "./AdvancedSettings";
import { SlashCommandAutocomplete } from "./SlashCommandAutocomplete";
import { parseCommandPrompt } from "@/lib/studio/commandParser";

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
  const [showSlashMenu, setShowSlashMenu] = useState(false);
  const [slashFilter, setSlashFilter] = useState("");

  // Parse prompt for active commands
  const parseResult = parseCommandPrompt(prompt);
  const activeCommands = parseResult.commands.filter((c) => !c.isUnknown);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "0px";
      const scrollHeight = textareaRef.current.scrollHeight;
      textareaRef.current.style.height = Math.max(56, Math.min(scrollHeight, 180)) + "px";
    }
  }, [prompt]);

  // Handle slash trigger detection
  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setPrompt(val);

    const cursorPosition = e.target.selectionStart || val.length;
    const textBeforeCursor = val.slice(0, cursorPosition);
    const lastSlashIndex = textBeforeCursor.lastIndexOf("/");

    if (lastSlashIndex !== -1) {
      const queryAfterSlash = textBeforeCursor.slice(lastSlashIndex + 1);
      // Check if there is space after slash
      if (!queryAfterSlash.includes(" ")) {
        setSlashFilter(queryAfterSlash);
        setShowSlashMenu(true);
        return;
      }
    }

    setShowSlashMenu(false);
  };

  const handleSelectCommand = (commandToken: string) => {
    // If prompt already contains this command token, avoid duplicate
    if (prompt.toLowerCase().includes(commandToken.toLowerCase())) {
      setShowSlashMenu(false);
      return;
    }

    // Replace the trailing /query or append command
    const cursorPosition = textareaRef.current?.selectionStart || prompt.length;
    const textBeforeCursor = prompt.slice(0, cursorPosition);
    const lastSlashIndex = textBeforeCursor.lastIndexOf("/");

    let newPrompt = "";
    if (lastSlashIndex !== -1) {
      const beforeSlash = prompt.slice(0, lastSlashIndex);
      const afterCursor = prompt.slice(cursorPosition);
      newPrompt = `${beforeSlash}${commandToken} ${afterCursor}`.replace(/\s+/g, " ");
    } else {
      newPrompt = `${prompt} ${commandToken}`.trim();
    }

    setPrompt(newPrompt);
    setShowSlashMenu(false);

    if (textareaRef.current) {
      textareaRef.current.focus();
    }
  };

  const handleRemoveCommand = (rawToken: string) => {
    const escapedToken = rawToken.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&");
    const updated = prompt.replace(new RegExp(`(?:^|\\s)${escapedToken}(?=\\s|$|[.,!?;])`, "g"), " ").replace(/\s+/g, " ").trim();
    setPrompt(updated);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Escape" && showSlashMenu) {
      e.preventDefault();
      setShowSlashMenu(false);
    } else if (e.key === "Enter" && !e.shiftKey) {
      if (showSlashMenu) {
        // If slash menu is open, Enter does not submit generation
        return;
      }
      e.preventDefault();
      if ((prompt.trim() || media.length > 0) && !isGenerating) {
        onGenerate();
      }
    }
  };

  const placeholder = mode === "image"
    ? "Tapez / pour les commandes créatives (/UGCmodel, /FacebookAds...) ou décrivez votre besoin... (Entrée pour lancer)"
    : "Tapez / pour les commandes vidéo ou décrivez la séquence à animer... (Entrée pour lancer)";

  return (
    <div className="w-full max-w-4xl mx-auto flex flex-col items-center bg-card/90 backdrop-blur-xl rounded-3xl shadow-2xl border border-border/80 p-3.5 transition-all relative">
      {/* Autocomplete Menu */}
      <SlashCommandAutocomplete
        prompt={prompt}
        isOpen={showSlashMenu}
        filterText={slashFilter}
        onSelectCommand={handleSelectCommand}
        onClose={() => setShowSlashMenu(false)}
      />

      {/* Uploaded media previews */}
      {media.length > 0 && (
        <div className="w-full pb-2 px-1">
          <MediaUploader media={media} onChange={setMedia} mode={mode} />
        </div>
      )}

      {/* Active Slash Command Chips */}
      {activeCommands.length > 0 && (
        <div className="w-full flex items-center gap-1.5 flex-wrap pb-2.5 px-1 animate-in fade-in duration-200">
          <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
            <Terminal className="w-3 h-3 text-[#0E7C66]" /> Directions Créatives :
          </span>
          {activeCommands.map((cmd) => (
            <div
              key={cmd.rawToken}
              className="flex items-center gap-1 px-2.5 py-1 rounded-xl bg-[#0E7C66]/15 text-[#0E7C66] border border-[#0E7C66]/30 text-xs font-bold shadow-sm"
            >
              <span>{cmd.rawToken}</span>
              {cmd.commandObj?.name && (
                <span className="text-[10px] font-normal text-muted-foreground border-l border-[#0E7C66]/30 pl-1.5">
                  {cmd.commandObj.name}
                </span>
              )}
              <button
                type="button"
                onClick={() => handleRemoveCommand(cmd.rawToken)}
                className="hover:bg-[#0E7C66]/20 p-0.5 rounded-md transition-colors ml-0.5"
                title="Supprimer la commande"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
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
            onChange={handleTextareaChange}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            className="min-h-[56px] w-full resize-none bg-transparent border-0 focus-visible:ring-0 focus-visible:ring-offset-0 px-4 py-3.5 text-sm sm:text-base font-normal text-foreground placeholder:text-muted-foreground/70 custom-scrollbar"
            disabled={isGenerating}
          />

          <div className="flex items-center gap-1.5 pr-2.5 pb-2.5 shrink-0">
            {/* Quick Slash Commands Trigger Button */}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setShowSlashMenu(!showSlashMenu)}
              className="h-9 px-2.5 text-xs font-bold rounded-xl border-border/70 hover:border-[#0E7C66] hover:bg-[#0E7C66]/10 hover:text-[#0E7C66] transition-all flex items-center gap-1 text-muted-foreground"
              title="Ouvrir le catalogue de commandes /"
            >
              <Terminal className="w-3.5 h-3.5 text-[#0E7C66]" />
              <span>/command</span>
            </Button>

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
