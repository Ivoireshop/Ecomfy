import { useState, useEffect, useCallback } from "react";
import { Plus, Sparkles, Store } from "lucide-react";
import { ConnectUsStory, ConnectUsProfile } from "../types/connectus.types";
import { ConnectUsService } from "../services/connectus.service";
import { CreateStoryModal } from "./CreateStoryModal";
import { StoryViewerModal } from "./StoryViewerModal";
import { toast } from "@/hooks/use-toast";

interface StoryBarProps {
  currentUserId: string;
  currentProfile: ConnectUsProfile | null;
  /** Masque l'en-tête quand la barre est déjà sous un titre de page. */
  hideHeader?: boolean;
}

export function StoryBar({ currentUserId, currentProfile, hideHeader = false }: StoryBarProps) {
  const [activeStories, setActiveStories] = useState<ConnectUsStory[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [selectedStory, setSelectedStory] = useState<ConnectUsStory | null>(null);
  const [viewerModalOpen, setViewerModalOpen] = useState(false);
  const [selectedAuthorStories, setSelectedAuthorStories] = useState<ConnectUsStory[]>([]);

  const loadStories = useCallback(async () => {
    if (!currentUserId) return;
    try {
      setActiveStories(await ConnectUsService.getActiveStories(currentUserId));
    } catch (e) {
      console.warn("Stories indisponibles :", e);
    } finally {
      setLoaded(true);
    }
  }, [currentUserId]);

  useEffect(() => {
    loadStories();
  }, [loadStories]);

  const myActiveStories = activeStories.filter((s) => s.user_id === currentUserId);

  const otherStoriesMap = new Map<string, ConnectUsStory[]>();
  for (const s of activeStories) {
    if (s.user_id === currentUserId) continue;
    otherStoriesMap.set(s.user_id, [...(otherStoriesMap.get(s.user_id) || []), s]);
  }

  const openStories = (list: ConnectUsStory[]) => {
    if (list.length === 0) return;
    // Les plus anciennes d'abord : on lit dans l'ordre chronologique.
    const ordered = [...list].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    setSelectedAuthorStories(ordered);
    setSelectedStory(ordered[0]);
    setViewerModalOpen(true);
  };

  const handleCreateStorySubmit = async (file: File, mediaType: "image" | "video", caption?: string): Promise<boolean> => {
    try {
      await ConnectUsService.createStory(currentUserId, file, mediaType, caption);
      await loadStories();
      toast({ title: "Story publiée 🎉", description: "Elle reste visible 24 heures." });
      return true;
    } catch (e) {
      toast({ title: "Story non publiée", description: e instanceof Error ? e.message : "Réessayez.", variant: "destructive" });
      return false;
    }
  };

  const handleViewerClose = (open: boolean) => {
    setViewerModalOpen(open);
    if (!open) loadStories();
  };

  const avatar = currentProfile?.avatar_url;

  return (
    <section aria-label="Stories" className="bg-white rounded-3xl p-4 border border-slate-200/80 shadow-xs space-y-2">
      {!hideHeader && (
        <div className="flex items-center justify-between px-1">
          <span className="text-xs font-bold text-slate-700 tracking-wider uppercase flex items-center gap-1.5">
            <Sparkles className="h-3.5 w-3.5 text-[#0E7C66]" /> Stories (24 h)
          </span>
          <button type="button" onClick={() => setCreateModalOpen(true)} className="text-[11px] text-[#0E7C66] hover:underline font-bold flex items-center gap-1">
            <Plus className="h-3 w-3" /> Nouvelle story
          </button>
        </div>
      )}

      <div className="flex items-center gap-3 overflow-x-auto py-1">
        <button
          type="button"
          onClick={() => (myActiveStories.length > 0 ? openStories(myActiveStories) : setCreateModalOpen(true))}
          className="flex flex-col items-center gap-1.5 shrink-0 group"
          aria-label={myActiveStories.length > 0 ? "Voir ma story" : "Créer ma story"}
        >
          <div
            className={`relative h-14 w-14 rounded-2xl p-0.5 transition-transform group-hover:scale-105 ${
              myActiveStories.length > 0 ? "bg-gradient-to-tr from-emerald-500 via-[#0E7C66] to-teal-400" : "bg-slate-100 border-2 border-dashed border-slate-300"
            }`}
          >
            {avatar ? (
              <img src={avatar} alt="" className="h-full w-full object-cover rounded-[14px] bg-white" />
            ) : (
              <div className="h-full w-full rounded-[14px] bg-[#0E7C66] text-white flex items-center justify-center font-bold text-sm">
                {(currentProfile?.full_name || "M")[0]?.toUpperCase()}
              </div>
            )}
            <span
              onClick={(e) => {
                e.stopPropagation();
                setCreateModalOpen(true);
              }}
              className="absolute -bottom-1 -right-1 h-5 w-5 rounded-full bg-[#0E7C66] text-white flex items-center justify-center ring-2 ring-white"
              role="button"
              aria-label="Ajouter une story"
            >
              <Plus className="h-3.5 w-3.5" />
            </span>
          </div>
          <span className="text-[10px] font-bold text-slate-700 truncate max-w-[68px]">Ma story</span>
        </button>

        {Array.from(otherStoriesMap.entries()).map(([authorId, list]) => {
          const author = list[0].author;
          const hasUnseen = list.some((s) => !(s.viewers || []).includes(currentUserId));
          return (
            <button key={authorId} type="button" onClick={() => openStories(list)} className="flex flex-col items-center gap-1.5 shrink-0 group" aria-label={`Voir les stories de ${author?.full_name}`}>
              <div className={`relative h-14 w-14 rounded-2xl p-0.5 transition-transform group-hover:scale-105 ${hasUnseen ? "bg-gradient-to-tr from-amber-400 via-rose-500 to-[#0E7C66]" : "bg-slate-300"}`}>
                {author?.avatar_url ? (
                  <img src={author.avatar_url} alt="" className="h-full w-full object-cover rounded-[14px] border-2 border-white bg-white" />
                ) : (
                  <div className="h-full w-full rounded-[14px] border-2 border-white bg-[#0E7C66] text-white flex items-center justify-center font-bold text-sm">
                    {(author?.full_name || "M")[0]?.toUpperCase()}
                  </div>
                )}
                {author?.is_business && (
                  <span className="absolute -bottom-1 -right-1 bg-amber-400 text-slate-950 p-0.5 rounded-full ring-2 ring-white">
                    <Store className="h-2.5 w-2.5" />
                  </span>
                )}
              </div>
              <span className="text-[10px] font-semibold text-slate-700 truncate max-w-[68px]">{author?.full_name || "Membre"}</span>
            </button>
          );
        })}

        {loaded && otherStoriesMap.size === 0 && (
          <p className="text-[11px] text-slate-400 pl-1 shrink-0">Les stories de vos abonnés apparaîtront ici.</p>
        )}
      </div>

      <CreateStoryModal open={createModalOpen} onOpenChange={setCreateModalOpen} onSubmitStory={handleCreateStorySubmit} />

      <StoryViewerModal
        open={viewerModalOpen}
        onOpenChange={handleViewerClose}
        currentUserId={currentUserId}
        story={selectedStory}
        authorStories={selectedAuthorStories}
        onSelectStory={setSelectedStory}
        onOpenCreateStory={() => setCreateModalOpen(true)}
        onStoryDeleted={loadStories}
      />
    </section>
  );
}
