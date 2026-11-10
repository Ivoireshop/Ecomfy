import { useState, useEffect, useRef } from "react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "./CUButton";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ConnectUsStory, ConnectUsStoryViewer } from "../types/connectus.types";
import { ConnectUsService } from "../services/connectus.service";
import { X, Eye, Heart, Send, ChevronLeft, ChevronRight, Clock, Plus, UserCheck, ShieldCheck, Trash2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";
import { toast } from "@/hooks/use-toast";

interface StoryViewerModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentUserId: string;
  story: ConnectUsStory | null;
  authorStories?: ConnectUsStory[];
  onSelectStory?: (story: ConnectUsStory) => void;
  onOpenCreateStory?: () => void;
  onStoryDeleted?: () => void;
}

const IMAGE_DURATION_MS = 6000;
const TICK_MS = 100;

export function StoryViewerModal({
  open,
  onOpenChange,
  currentUserId,
  story,
  authorStories = [],
  onSelectStory,
  onOpenCreateStory,
  onStoryDeleted,
}: StoryViewerModalProps) {
  const [progress, setProgress] = useState(0);
  const [showViewers, setShowViewers] = useState(false);
  const [replyText, setReplyText] = useState("");
  const [liked, setLiked] = useState(false);
  const [likesCount, setLikesCount] = useState(0);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [viewersList, setViewersList] = useState<ConnectUsStoryViewer[]>([]);
  const advancedRef = useRef(false);

  const sequence = authorStories.length > 0 ? authorStories : story ? [story] : [];
  const index = Math.max(0, sequence.findIndex((s) => s.id === story?.id));
  const hasPrev = index > 0;
  const hasNext = index < sequence.length - 1;
  const isOwner = Boolean(story && currentUserId === story.user_id);
  const isVideo = story?.media_type === "video";

  const goNext = () => {
    if (advancedRef.current) return;
    advancedRef.current = true;
    if (hasNext && onSelectStory) onSelectStory(sequence[index + 1]);
    else onOpenChange(false);
  };

  // Changement de story : remise à zéro + enregistrement de la vue (jamais pour l'auteur)
  useEffect(() => {
    if (!open || !story) return;
    advancedRef.current = false;
    setProgress(0);
    setShowViewers(false);
    setConfirmDelete(false);
    setReplyText("");
    setLiked(Boolean(story.user_liked));
    setLikesCount(story.likes_count || 0);
    setViewersList(story.viewers_details || []);
    if (story.user_id !== currentUserId) {
      ConnectUsService.viewStory(story.id).catch(() => undefined);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, story?.id]);

  // Photos : minuterie de 6 s. Vidéos : la progression suit la lecture (voir onTimeUpdate).
  useEffect(() => {
    if (!open || !story || isVideo || showViewers) return;
    const timer = setInterval(() => setProgress((p) => Math.min(100, p + (TICK_MS / IMAGE_DURATION_MS) * 100)), TICK_MS);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, story?.id, isVideo, showViewers]);

  useEffect(() => {
    if (open && progress >= 100 && !isVideo) goNext();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [progress]);

  if (!story) return null;

  const handleLike = async () => {
    const wasLiked = liked;
    setLiked(!wasLiked);
    setLikesCount((c) => Math.max(0, c + (wasLiked ? -1 : 1)));
    try {
      const res = await ConnectUsService.toggleStoryLike(story.id, currentUserId);
      setLiked(res.user_liked);
      setLikesCount(res.likes_count);
    } catch {
      setLiked(wasLiked);
      setLikesCount(story.likes_count || 0);
      toast({ title: "J'aime non enregistré", variant: "destructive" });
    }
  };

  const handleSendReply = async () => {
    const text = replyText.trim();
    if (!text) return;
    setReplyText("");
    try {
      await ConnectUsService.replyToStory(currentUserId, story.user_id, text);
      toast({ title: "Réponse envoyée", description: `Votre message a été transmis à ${story.author?.full_name || "l'auteur"}.` });
    } catch (e) {
      setReplyText(text);
      toast({ title: "Réponse non envoyée", description: e instanceof Error ? e.message : "Réessayez.", variant: "destructive" });
    }
  };

  const handleDelete = async () => {
    const ok = await ConnectUsService.deleteStory(story.id, currentUserId);
    if (ok) {
      toast({ title: "Story supprimée ✓" });
      onOpenChange(false);
      onStoryDeleted?.();
    } else {
      toast({ title: "Suppression impossible", variant: "destructive" });
    }
  };

  const expiresIn = (() => {
    const t = new Date(story.expires_at).getTime();
    return Number.isNaN(t) ? "" : formatDistanceToNow(new Date(t), { addSuffix: true, locale: fr });
  })();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md bg-slate-950 text-white p-0 border-slate-800 rounded-3xl overflow-hidden shadow-2xl h-[90vh] max-h-[700px] flex flex-col [&>button]:hidden">
        <DialogTitle className="sr-only">Story de {story.author?.full_name || "un membre"}</DialogTitle>
        <DialogDescription className="sr-only">Visionneuse de story</DialogDescription>

        <div className="absolute top-3 left-3 right-3 z-30 flex items-center gap-1.5">
          {sequence.map((s, idx) => (
            <div key={s.id} className="h-1 flex-1 bg-white/30 rounded-full overflow-hidden">
              <div className="h-full bg-white transition-[width] duration-100 ease-linear" style={{ width: `${idx < index ? 100 : idx === index ? progress : 0}%` }} />
            </div>
          ))}
        </div>

        <div className="absolute top-6 left-3 right-3 z-30 flex items-center justify-between">
          <div className="flex items-center gap-2.5 bg-slate-950/70 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/10">
            {story.author?.avatar_url ? (
              <img src={story.author.avatar_url} alt="" className="h-8 w-8 rounded-full object-cover border border-white/20" />
            ) : (
              <div className="h-8 w-8 rounded-full bg-[#0E7C66] text-white flex items-center justify-center font-bold text-xs">{(story.author?.full_name || "M")[0]?.toUpperCase()}</div>
            )}
            <div className="min-w-0 text-xs">
              <div className="flex items-center gap-1">
                <span className="font-bold text-white truncate max-w-[130px]">{story.author?.full_name || "Membre"}</span>
                {story.author?.is_verified && <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />}
              </div>
              <p className="text-[10px] text-slate-300 flex items-center gap-1"><Clock className="h-3 w-3 text-amber-400" /> Expire {expiresIn}</p>
            </div>
          </div>

          <Button size="sm" variant="ghost" onClick={() => onOpenChange(false)} aria-label="Fermer" className="h-9 w-9 p-0 rounded-full bg-slate-950/70 backdrop-blur-md text-white hover:bg-white/20 border border-white/10">
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="relative flex-1 flex items-center justify-center bg-black min-h-0">
          {story.media_type === "image" ? (
            <img src={story.media_url} alt="Story" className="h-full w-full object-contain" />
          ) : (
            <video
              key={story.id}
              src={story.media_url}
              autoPlay
              playsInline
              controls
              onTimeUpdate={(e) => {
                const v = e.currentTarget;
                if (v.duration > 0) setProgress((v.currentTime / v.duration) * 100);
              }}
              onEnded={goNext}
              className="h-full w-full object-contain"
            />
          )}

          {hasPrev && (
            <button type="button" onClick={() => onSelectStory?.(sequence[index - 1])} aria-label="Story précédente" className="absolute left-2 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/40 text-white hover:bg-black/70 z-20">
              <ChevronLeft className="h-6 w-6" />
            </button>
          )}
          {hasNext && (
            <button type="button" onClick={goNext} aria-label="Story suivante" className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/40 text-white hover:bg-black/70 z-20">
              <ChevronRight className="h-6 w-6" />
            </button>
          )}

          {story.caption && (
            <div className="absolute bottom-4 left-4 right-4 bg-black/75 backdrop-blur-md p-3 rounded-2xl border border-white/10 text-xs font-semibold text-center leading-relaxed z-20">{story.caption}</div>
          )}
        </div>

        {showViewers && (
          <div className="absolute inset-x-0 bottom-0 z-40 bg-slate-900 border-t border-slate-700 rounded-t-3xl p-4 max-h-[60%] overflow-y-auto space-y-3">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <h4 className="font-bold text-xs text-white flex items-center gap-1.5 uppercase tracking-wider">
                <Eye className="h-4 w-4 text-emerald-400" /> Spectateurs ({viewersList.length || story.views_count})
              </h4>
              <button type="button" onClick={() => setShowViewers(false)} aria-label="Fermer la liste" className="p-1 text-slate-400 hover:text-white rounded-full">
                <X className="h-4 w-4" />
              </button>
            </div>
            {viewersList.length > 0 ? (
              viewersList.map((vw) => (
                <div key={vw.user.id} className="flex items-center justify-between p-2 rounded-xl bg-slate-800/60 border border-slate-700/50">
                  <div className="flex items-center gap-2.5 min-w-0">
                    {vw.user.avatar_url ? (
                      <img src={vw.user.avatar_url} alt="" className="h-8 w-8 rounded-full object-cover border border-slate-600" />
                    ) : (
                      <div className="h-8 w-8 rounded-full bg-[#0E7C66] text-white flex items-center justify-center font-bold text-xs">{(vw.user.full_name || "M")[0]?.toUpperCase()}</div>
                    )}
                    <div className="min-w-0 text-xs">
                      <p className="font-bold text-white truncate">{vw.user.full_name || "Membre"}</p>
                      <p className="text-[10px] text-slate-400">@{vw.user.username}</p>
                    </div>
                  </div>
                  <Badge className="bg-emerald-950 text-emerald-300 border-emerald-800 text-[9px] gap-1"><UserCheck className="h-2.5 w-2.5" /> Vu</Badge>
                </div>
              ))
            ) : (
              <p className="p-4 text-center text-xs text-slate-400">Aucun spectateur pour le moment.</p>
            )}
          </div>
        )}

        <div className="p-3 bg-slate-900/95 border-t border-slate-800 flex items-center justify-between gap-3 z-30">
          {isOwner ? (
            <div className="flex items-center justify-between w-full gap-2">
              <button type="button" onClick={() => setShowViewers((v) => !v)} className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-white px-3.5 py-2 rounded-full text-xs font-bold border border-slate-700">
                <Eye className="h-4 w-4 text-emerald-400" />
                <span>{story.views_count} vue{story.views_count > 1 ? "s" : ""}</span>
              </button>

              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-rose-400 flex items-center gap-1 bg-slate-800/80 px-2.5 py-1.5 rounded-full border border-slate-700">
                  <Heart className="h-3.5 w-3.5 fill-rose-500 text-rose-500" /> {likesCount}
                </span>
                {confirmDelete ? (
                  <Button size="sm" onClick={handleDelete} className="h-8 px-3 rounded-full bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold">Confirmer</Button>
                ) : (
                  <Button size="sm" variant="ghost" onClick={() => setConfirmDelete(true)} aria-label="Supprimer la story" className="h-8 w-8 p-0 rounded-full text-slate-300 hover:text-rose-400 hover:bg-slate-800">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
                {onOpenCreateStory && (
                  <Button
                    size="sm"
                    onClick={() => {
                      onOpenChange(false);
                      onOpenCreateStory();
                    }}
                    className="h-8 px-3 rounded-full bg-[#0E7C66] hover:bg-[#0A6352] text-white text-xs font-bold gap-1"
                  >
                    <Plus className="h-3.5 w-3.5" /> Story
                  </Button>
                )}
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2 w-full">
              <button
                type="button"
                onClick={handleLike}
                aria-pressed={liked}
                aria-label={liked ? "Retirer mon j'aime" : "Aimer la story"}
                className={`h-10 w-10 rounded-full flex items-center justify-center border transition-all shrink-0 ${liked ? "bg-rose-500 border-rose-500 text-white" : "bg-slate-800 border-slate-700 text-slate-300 hover:text-white hover:bg-slate-700"}`}
              >
                <Heart className={`h-5 w-5 ${liked ? "fill-white" : ""}`} />
              </button>
              <Input
                type="text"
                placeholder={`Répondre à ${story.author?.full_name || "la story"}…`}
                value={replyText}
                maxLength={500}
                onChange={(e) => setReplyText(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSendReply()}
                className="h-10 text-xs rounded-full bg-slate-800 border-slate-700 text-white placeholder:text-slate-400 focus:bg-slate-900 flex-1"
              />
              <Button type="button" onClick={handleSendReply} disabled={!replyText.trim()} aria-label="Envoyer la réponse" className="h-10 px-4 rounded-full bg-[#0E7C66] hover:bg-[#0A6352] text-white font-bold text-xs gap-1.5 shrink-0">
                <Send className="h-3.5 w-3.5" />
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
