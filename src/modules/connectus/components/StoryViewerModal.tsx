import { useState, useEffect } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ConnectUsStory } from "../types/connectus.types";
import { X, Eye, ChevronLeft, ChevronRight, Store, Clock } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";

interface StoryViewerModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  story: ConnectUsStory | null;
  storiesList?: ConnectUsStory[];
  onSelectStory?: (story: ConnectUsStory) => void;
}

export function StoryViewerModal({
  open,
  onOpenChange,
  story,
  storiesList = [],
  onSelectStory,
}: StoryViewerModalProps) {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (!open || !story) return;
    setProgress(0);
    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval);
          return 100;
        }
        return prev + 2;
      });
    }, 100);

    return () => clearInterval(interval);
  }, [open, story]);

  if (!story) return null;

  const currentIdx = storiesList.findIndex((s) => s.id === story.id);
  const hasPrev = currentIdx > 0;
  const hasNext = currentIdx !== -1 && currentIdx < storiesList.length - 1;

  const handlePrev = () => {
    if (hasPrev && onSelectStory) {
      onSelectStory(storiesList[currentIdx - 1]);
    }
  };

  const handleNext = () => {
    if (hasNext && onSelectStory) {
      onSelectStory(storiesList[currentIdx + 1]);
    } else {
      onOpenChange(false);
    }
  };

  let expiresTimeAgo = "24h";
  try {
    if (story.expires_at) {
      expiresTimeAgo = formatDistanceToNow(new Date(story.expires_at), { addSuffix: true, locale: fr });
    }
  } catch (e) {}

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md bg-slate-950 text-white p-0 border-slate-800 rounded-3xl overflow-hidden shadow-2xl h-[90vh] max-h-[680px] flex flex-col">
        {/* Story Progress Bar */}
        <div className="absolute top-3 left-3 right-3 z-30 flex items-center gap-1">
          <div className="h-1 flex-1 bg-white/30 rounded-full overflow-hidden">
            <div
              className="h-full bg-white transition-all duration-100 ease-linear"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* Story Header */}
        <div className="absolute top-6 left-3 right-3 z-30 flex items-center justify-between">
          <div className="flex items-center gap-2.5 bg-slate-950/60 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/10">
            {story.author?.avatar_url ? (
              <img src={story.author.avatar_url} alt="" className="h-8 w-8 rounded-full object-cover border border-white/20" />
            ) : (
              <div className="h-8 w-8 rounded-full bg-[#0E7C66] text-white flex items-center justify-center font-bold text-xs">
                {(story.author?.full_name || "M")[0]}
              </div>
            )}

            <div className="min-w-0 text-xs">
              <p className="font-bold text-white truncate max-w-[140px]">{story.author?.full_name || "Membre"}</p>
              <p className="text-[10px] text-slate-300 flex items-center gap-1">
                <Clock className="h-3 w-3 text-amber-400" /> Expiration : {expiresTimeAgo}
              </p>
            </div>
          </div>

          <Button
            size="sm"
            variant="ghost"
            onClick={() => onOpenChange(false)}
            className="h-8 w-8 p-0 rounded-full bg-slate-950/60 backdrop-blur-md text-white hover:bg-white/20 border border-white/10"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Story Media Viewer */}
        <div className="relative flex-1 flex items-center justify-center bg-black">
          {story.media_type === "image" ? (
            <img src={story.media_url} alt="Story" className="h-full w-full object-contain" />
          ) : (
            <video src={story.media_url} controls autoPlay loop className="h-full w-full object-contain" />
          )}

          {/* Navigation Controls */}
          {hasPrev && (
            <button
              onClick={handlePrev}
              className="absolute left-2 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/40 text-white hover:bg-black/70 backdrop-blur-xs transition-all"
            >
              <ChevronLeft className="h-6 w-6" />
            </button>
          )}

          {hasNext && (
            <button
              onClick={handleNext}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/40 text-white hover:bg-black/70 backdrop-blur-xs transition-all"
            >
              <ChevronRight className="h-6 w-6" />
            </button>
          )}

          {/* Caption Overlay */}
          {story.caption && (
            <div className="absolute bottom-12 left-4 right-4 bg-black/70 backdrop-blur-md p-3 rounded-2xl border border-white/10 text-xs font-medium text-center leading-relaxed">
              {story.caption}
            </div>
          )}
        </div>

        {/* Story Footer - Views Counter */}
        <div className="p-3 bg-slate-900/90 backdrop-blur-xs border-t border-slate-800 flex items-center justify-between text-xs text-slate-300">
          <div className="flex items-center gap-1.5 font-semibold text-emerald-400">
            <Eye className="h-4 w-4" />
            <span>{story.views_count || 1} vue(s)</span>
          </div>
          <span className="text-[10px] text-slate-400 font-medium">ConnectUs Social Story (24h)</span>
        </div>
      </DialogContent>
    </Dialog>
  );
}
