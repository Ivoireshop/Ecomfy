import React, { useState, useEffect, useRef } from "react";
import { ECOMFY_AI_COMMANDS, EcomfyCommand } from "@/lib/studio/commandRegistry";
import { Sparkles, X, Layers, Flame, Camera, ShoppingBag, Palette, MessageSquare } from "lucide-react";
import { cn } from "@/lib/utils";

interface SlashCommandAutocompleteProps {
  prompt: string;
  onSelectCommand: (commandToken: string) => void;
  isOpen: boolean;
  onClose: () => void;
  filterText: string;
}

const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  "Tous": <Layers className="w-3.5 h-3.5" />,
  "UGC": <Camera className="w-3.5 h-3.5" />,
  "Publicité": <Flame className="w-3.5 h-3.5" />,
  "Produit": <ShoppingBag className="w-3.5 h-3.5" />,
  "Style Visuel": <Palette className="w-3.5 h-3.5" />,
  "Storytelling": <MessageSquare className="w-3.5 h-3.5" />
};

export const SlashCommandAutocomplete: React.FC<SlashCommandAutocompleteProps> = ({
  onSelectCommand,
  isOpen,
  onClose,
  filterText,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<string>("Tous");
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const categories = ["Tous", "UGC", "Publicité", "Produit", "Style Visuel", "Storytelling"];

  // Filter commands by filterText and selectedCategory
  const filteredCommands = ECOMFY_AI_COMMANDS.filter((cmd) => {
    const matchesCategory = selectedCategory === "Tous" || cmd.category === selectedCategory;
    const cleanFilter = filterText.toLowerCase().trim();

    if (!cleanFilter) return matchesCategory;

    const matchesSearch =
      cmd.command.toLowerCase().includes(cleanFilter) ||
      cmd.name.toLowerCase().includes(cleanFilter) ||
      cmd.description.toLowerCase().includes(cleanFilter) ||
      cmd.aliases.some((a) => a.toLowerCase().includes(cleanFilter));

    return matchesCategory && matchesSearch;
  });

  return (
    <div
      ref={menuRef}
      className="absolute bottom-full mb-3 left-0 w-full max-w-2xl bg-card/95 backdrop-blur-2xl border border-border/80 rounded-2xl shadow-2xl overflow-hidden z-50 animate-in fade-in slide-in-from-bottom-2 duration-200"
    >
      {/* Header Banner */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-gradient-to-r from-[#0E7C66]/10 via-emerald-500/10 to-transparent border-b border-border/60">
        <div className="flex items-center gap-2">
          <div className="p-1 rounded-lg bg-[#0E7C66]/20 text-[#0E7C66]">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-foreground tracking-tight flex items-center gap-1.5">
              Commandes Créatives Studio IA <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[#0E7C66]/20 text-[#0E7C66] font-semibold">/command</span>
            </h4>
            <p className="text-[11px] text-muted-foreground">Sélectionnez une direction créative pour guider l'IA</p>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="text-muted-foreground hover:text-foreground p-1 rounded-lg hover:bg-muted/80 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Category Tabs */}
      <div className="flex items-center gap-1 p-2 bg-muted/30 border-b border-border/40 overflow-x-auto custom-scrollbar">
        {categories.map((cat) => (
          <button
            key={cat}
            type="button"
            onClick={() => setSelectedCategory(cat)}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all shrink-0",
              selectedCategory === cat
                ? "bg-[#0E7C66] text-white shadow-sm shadow-[#0E7C66]/30 font-semibold"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
            )}
          >
            {CATEGORY_ICONS[cat]}
            <span>{cat}</span>
          </button>
        ))}
      </div>

      {/* Command List */}
      <div className="max-h-64 overflow-y-auto p-1.5 space-y-1 custom-scrollbar">
        {filteredCommands.length === 0 ? (
          <div className="p-6 text-center text-xs text-muted-foreground">
            Aucune commande créative ne correspond à « <span className="font-semibold">{filterText}</span> »
          </div>
        ) : (
          filteredCommands.map((cmd) => (
            <button
              key={cmd.command}
              type="button"
              onClick={() => onSelectCommand(cmd.command)}
              className="w-full flex items-start gap-3 p-2.5 rounded-xl hover:bg-muted/70 focus:bg-muted/90 text-left transition-all group border border-transparent hover:border-border/50"
            >
              <span className="font-mono text-xs font-bold px-2 py-1 rounded-lg bg-[#0E7C66]/10 text-[#0E7C66] group-hover:bg-[#0E7C66] group-hover:text-white transition-colors shrink-0">
                {cmd.command}
              </span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-bold text-foreground group-hover:text-[#0E7C66] transition-colors truncate">
                    {cmd.name}
                  </span>
                  <span className="text-[10px] px-2 py-0.5 rounded-md bg-muted text-muted-foreground shrink-0 font-medium">
                    {cmd.category}
                  </span>
                </div>
                <p className="text-[11px] text-muted-foreground truncate mt-0.5">
                  {cmd.description}
                </p>
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  );
};
