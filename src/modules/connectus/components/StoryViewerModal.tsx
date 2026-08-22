import { useState, useEffect } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ConnectUsStory, ConnectUsProfile, ConnectUsStoryViewer } from "../types/connectus.types";
import { ConnectUsService } from "../services/connectus.service";
import {
  X, Eye, Heart, Send, ChevronLeft, ChevronRight, Clock, Plus, Users, UserCheck, ShieldCheck
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";
import { toast } from "@/hooks/use-toast";

interface StoryViewerModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentUserId?: string;
  story: ConnectUsStory | null;
  authorStories?: ConnectUsStory[];
  allStoriesList?: ConnectUsStory[];
  onSelectStory?: (story: ConnectUsStory) => void;
  onOpenCreateStory?: () => void;
  onToggleLikeStory?: (storyId: string) => Promise<any>;
  onReplyStory?: (storyId: string, targetUserId: string, text: string, mediaUrl?: string) => Promise<any>;
}

export function StoryViewerModal({
  open,
  onOpenChange,
  currentUserId = "me",
  story,
  authorStories = [],
  allStoriesList = [],
  onSelectStory,
  onOpenCreateStory,
  onToggleLikeStory,
  onReplyStory,
}: StoryViewerModalProps) {
  const [progress, setProgress] = useState(0);
  const [showViewersDrawer, setShowViewersDrawer] = useState(false);
  const [replyText, setReplyText] = useState("");
  const [liked, setLiked] = useState(false);
  const [likesCount, setLikesCount] = useState(0);
  const [viewsCount, setViewsCount] = useState(0);
  const [viewersList, setViewersList] = useState<ConnectUsStoryViewer[]>([]);

  // Calculate author story sequence
  const currentAuthorStories = authorStories.length > 0
    ? authorStories
    : story
    ? [story]
    : [];

  const storyIndex = currentAuthorStories.findIndex((s) => s.id === story?.id);
  const safeIndex = storyIndex !== -1 ? storyIndex : 0;

  useEffect(() => {
    if (!open || !story) return;

    // Reset local interaction states for current story
    setProgress(0);
    setShowViewersDrawer(false);
    setReplyText("");
    setLiked(Boolean(story.user_liked));
    setLikesCount(story.likes_count || 0);
    setViewsCount(story.views_count || 1);
    setViewersList(story.viewers_details || []);

    // Record view in service
    ConnectUsService.viewStory(story.id, currentUserId);

    // Progress bar animation timer
    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval);
          return 100;
        }
        return prev + 2;
      });
    }, 120);

    return () => clearInterval(interval);
  }, [open, story?.id, currentUserId]);

  if (!story) return null;

  const isOwner = Boolean(
    currentUserId && (currentUserId === story.user_id || currentUserId === story.author?.id || currentUserId === story.author?.user_id)
  );

  const hasPrev = safeIndex > 0;
  const hasNext = safeIndex < currentAuthorStories.length - 1;

  const handlePrev = () => {
    if (hasPrev && onSelectStory) {
      onSelectStory(currentAuthorStories[safeIndex - 1]);
    }
  };

  const handleNext = () => {
    if (hasNext && onSelectStory) {
      onSelectStory(currentAuthorStories[safeIndex + 1]);
    } else {
      onOpenChange(false);
    }
  };

  const handleLike = async () => {
    const newLiked = !liked;
    const newCount = Math.max(0, likesCount + (newLiked ? 1 : -1));
    setLiked(newLiked);
    setLikesCount(newCount);

    if (onToggleLikeStory) {
      await onToggleLikeStory(story.id);
    } else {
      await ConnectUsService.toggleStoryLike(story.id, currentUserId);
    }
    toast({ title: newLiked ? "Story aimée ❤️" : "Like retiré" });
  };

  const handleSendReply = async () => {
    if (!replyText.trim()) return;
    const textToSend = replyText.trim();
    setReplyText("");

    const targetId = story.user_id || story.author?.id || story.author?.user_id;
    if (!targetId) return;

    if (onReplyStory) {
      await onReplyStory(story.id, targetId, textToSend, story.media_url);
    } else {
      await ConnectUsService.replyToStory(story.id, currentUserId, targetId, textToSend, story.media_url);
    }

    toast({
      title: "Réponse envoyée en message privé 💬",
      description: `Votre message a été transmis à ${story.author?.full_name || "l'auteur"}.`,
    });
  };

  let expiresTimeAgo = "24h";
  try {
    if (story.expires_at) {
      expiresTimeAgo = formatDistanceToNow(new Date(story.expires_at), { addSuffix: true, locale: fr });
    }
  } catch (e) {}

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md bg-slate-950 text-white p-0 border-slate-800 rounded-3xl overflow-hidden shadow-2xl h-[90vh] max-h-[700px] flex flex-col">
        {/* Multi-segment Progress Bars Header */}
        <div className="absolute top-3 left-3 right-3 z-30 flex items-center gap-1.5">
          {currentAuthorStories.map((s, idx) => {
            let widthPercent = 0;
            if (idx < safeIndex) widthPercent = 100;
            else if (idx === safeIndex) widthPercent = progress;
            else widthPercent = 0;

            return (
              <div key={s.id || idx} className="h-1 flex-1 bg-white/30 rounded-full overflow-hidden">
                <div
                  className="h-full bg-white transition-all duration-100 ease-linear"
                  style={{ width: `${widthPercent}%` }}
                />
              </div>
            );
          })}
        </div>

        {/* Story Header (Author Profile & Time Remaining) */}
        <div className="absolute top-6 left-3 right-3 z-30 flex items-center justify-between">
          <div className="flex items-center gap-2.5 bg-slate-950/70 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/10">
            {story.author?.avatar_url ? (
              <img src={story.author.avatar_url} alt="" className="h-8 w-8 rounded-full object-cover border border-white/20" />
            ) : (
              <div className="h-8 w-8 rounded-full bg-[#0E7C66] text-white flex items-center justify-center font-bold text-xs">
                {(story.author?.full_name || "M")[0]}
              </div>
            )}

            <div className="min-w-0 text-xs">
              <div className="flex items-center gap-1">
                <span className="font-bold text-white truncate max-w-[130px]">{story.author?.full_name || "Membre"}</span>
                {story.author?.is_verified && <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />}
              </div>
              <p className="text-[10px] text-slate-300 flex items-center gap-1">
                <Clock className="h-3 w-3 text-amber-400" /> Expiration {expiresTimeAgo}
              </p>
            </div>
          </div>

          <Button
            size="sm"
            variant="ghost"
            onClick={() => onOpenChange(false)}
            className="h-8 w-8 p-0 rounded-full bg-slate-950/70 backdrop-blur-md text-white hover:bg-white/20 border border-white/10"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Story Media Display Area */}
        <div className="relative flex-1 flex items-center justify-center bg-black">
          {story.media_type === "image" ? (
            <img src={story.media_url} alt="Story" className="h-full w-full object-contain" />
          ) : (
            <video src={story.media_url} controls autoPlay loop className="h-full w-full object-contain" />
          )}

          {/* Left / Right Navigation Buttons */}
          {hasPrev && (
            <button
              type="button"
              onClick={handlePrev}
              className="absolute left-2 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/40 text-white hover:bg-black/70 backdrop-blur-xs transition-all z-20"
            >
              <ChevronLeft className="h-6 w-6" />
            </button>
          )}

          {hasNext && (
            <button
              type="button"
              onClick={handleNext}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/40 text-white hover:bg-black/70 backdrop-blur-xs transition-all z-20"
            >
              <ChevronRight className="h-6 w-6" />
            </button>
          )}

          {/* Caption Overlay */}
          {story.caption && (
            <div className="absolute bottom-16 left-4 right-4 bg-black/75 backdrop-blur-md p-3 rounded-2xl border border-white/10 text-xs font-semibold text-center leading-relaxed z-20">
              {story.caption}
            </div>
          )}
        </div>

        {/* Viewers Sheet Drawer (When Owner views viewers list) */}
        {showViewersDrawer && (
          <div className="absolute inset-x-0 bottom-0 z-40 bg-slate-900 border-t border-slate-700 rounded-t-3xl p-4 max-h-[60%] overflow-y-auto space-y-3 animate-in slide-in-from-bottom duration-200">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <h4 className="font-bold text-xs text-white flex items-center gap-1.5 uppercase tracking-wider">
                <Eye className="h-4 w-4 text-emerald-400" /> Spectateurs de la Story ({viewersList.length || viewsCount})
              </h4>
              <button
                type="button"
                onClick={() => setShowViewersDrawer(false)}
                className="p-1 text-slate-400 hover:text-white rounded-full"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-2">
              {viewersList.length > 0 ? (
                viewersList.map((vw, idx) => (
                  <div key={idx} className="flex items-center justify-between p-2 rounded-xl bg-slate-800/60 border border-slate-700/50">
                    <div className="flex items-center gap-2.5 min-w-0">
                      {vw.user?.avatar_url ? (
                        <img src={vw.user.avatar_url} alt="" className="h-8 w-8 rounded-full object-cover border border-slate-600" />
                      ) : (
                        <div className="h-8 w-8 rounded-full bg-[#0E7C66] text-white flex items-center justify-center font-bold text-xs">
                          {(vw.user?.full_name || "M")[0]}
                        </div>
                      )}
                      <div className="min-w-0 text-xs">
                        <p className="font-bold text-white truncate">{vw.user?.full_name || "Membre ConnectUs"}</p>
                        <p className="text-[10px] text-slate-400">@{vw.user?.username || "membre"}</p>
                      </div>
                    </div>
                    <Badge className="bg-emerald-950 text-emerald-300 border-emerald-800 text-[9px] gap-1">
                      <UserCheck className="h-2.5 w-2.5" /> Spectateur
                    </Badge>
                  </div>
                ))
              ) : (
                <div className="p-4 text-center text-xs text-slate-400">
                  {viewsCount > 0 ? `${viewsCount} vue(s) unique(s) enregistrée(s)` : "Aucun spectateur pour le moment."}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Story Footer Bar */}
        <div className="p-3 bg-slate-900/95 backdrop-blur-md border-t border-slate-800 flex items-center justify-between gap-3 z-30">
          {isOwner ? (
            /* OWNER CONTROLS & STATS */
            <div className="flex items-center justify-between w-full">
              <button
                type="button"
                onClick={() => setShowViewersDrawer(!showViewersDrawer)}
                className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-white px-3.5 py-1.5 rounded-full text-xs font-bold transition-all border border-slate-700"
              >
                <Eye className="h-4 w-4 text-emerald-400" />
                <span>{viewsCount} vue(s) • Voir spectateurs</span>
              </button>

              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-rose-400 flex items-center gap-1 bg-slate-800/80 px-2.5 py-1 rounded-full border border-slate-700">
                  <Heart className="h-3.5 w-3.5 fill-rose-500 text-rose-500" /> {likesCount}
                </span>

                {onOpenCreateStory && (
                  <Button
                    size="sm"
                    onClick={() => {
                      onOpenChange(false);
                      onOpenCreateStory();
                    }}
                    className="h-8 px-3 rounded-full bg-[#0E7C66] hover:bg-[#0A6352] text-white text-xs font-bold gap-1 shadow-2xs"
                  >
                    <Plus className="h-3.5 w-3.5" /> Story
                  </Button>
                )}
              </div>
            </div>
          ) : (
            /* VIEWER INTERACTION CONTROLS (LIKE & PRIVATE REPLY) */
            <div className="flex items-center gap-2 w-full">
              <button
                type="button"
                onClick={handleLike}
                className={`h-10 w-10 rounded-full flex items-center justify-center border transition-all shrink-0 ${
                  liked
                    ? "bg-rose-500 border-rose-500 text-white shadow-md"
                    : "bg-slate-800 border-slate-700 text-slate-300 hover:text-white hover:bg-slate-700"
                }`}
                title="Aimer la story"
              >
                <Heart className={`h-5 w-5 ${liked ? "fill-white" : ""}`} />
              </button>

              <Input
                type="text"
                placeholder={`Répondre à ${story.author?.full_name || "la story"}...`}
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSendReply()}
                className="h-10 text-xs rounded-full bg-slate-800 border-slate-700 text-white placeholder:text-slate-400 focus:bg-slate-900 flex-1"
              />

              <Button
                type="button"
                onClick={handleSendReply}
                disabled={!replyText.trim()}
                className="h-10 px-4 rounded-full bg-[#0E7C66] hover:bg-[#0A6352] text-white font-bold text-xs gap-1.5 shrink-0"
              >
                <span>Envoyer</span>
                <Send className="h-3.5 w-3.5" />
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
