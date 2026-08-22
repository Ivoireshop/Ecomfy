import { useState, useEffect } from "react";
import { Plus, Sparkles, Store, Eye, Film } from "lucide-react";
import { ConnectUsStory, ConnectUsProfile } from "../types/connectus.types";
import { ConnectUsService } from "../services/connectus.service";
import { CreateStoryModal } from "./CreateStoryModal";
import { StoryViewerModal } from "./StoryViewerModal";

interface StoryBarProps {
  currentAvatarUrl?: string | null;
  currentUserId?: string;
  currentProfile?: ConnectUsProfile | null;
  onOpenDirectMessage?: (targetUser: ConnectUsProfile) => void;
}

const DEMO_STORIES: ConnectUsStory[] = [
  {
    id: "demo-s1",
    user_id: "demo-u1",
    author: {
      id: "demo-u1",
      user_id: "demo-u1",
      username: "koffi_fashion",
      full_name: "Koffi Fashion",
      avatar_url: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400&auto=format&fit=crop&q=80",
      cover_url: null,
      bio: null,
      location: null,
      website_url: null,
      is_verified: true,
      is_business: true,
      followers_count: 10,
      following_count: 5,
      posts_count: 2,
      created_at: new Date().toISOString(),
    },
    media_url: "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=800&auto=format&fit=crop&q=80",
    media_type: "image",
    caption: "Nouvelle collection disponible cette semaine ! 🔥",
    created_at: new Date().toISOString(),
    expires_at: new Date(Date.now() + 20 * 60 * 60 * 1000).toISOString(),
    views_count: 12,
  },
  {
    id: "demo-s2",
    user_id: "demo-u2",
    author: {
      id: "demo-u2",
      user_id: "demo-u2",
      username: "aminata_beauty",
      full_name: "Aminata Beauty",
      avatar_url: "https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=400&auto=format&fit=crop&q=80",
      cover_url: null,
      bio: null,
      location: null,
      website_url: null,
      is_verified: true,
      is_business: true,
      followers_count: 10,
      following_count: 5,
      posts_count: 2,
      created_at: new Date().toISOString(),
    },
    media_url: "https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?w=800&auto=format&fit=crop&q=80",
    media_type: "image",
    caption: "Conseil beauté du jour ✨",
    created_at: new Date().toISOString(),
    expires_at: new Date(Date.now() + 18 * 60 * 60 * 1000).toISOString(),
    views_count: 8,
  },
];

export function StoryBar({
  currentAvatarUrl,
  currentUserId = "me",
  currentProfile,
  onOpenDirectMessage,
}: StoryBarProps) {
  const [activeStories, setActiveStories] = useState<ConnectUsStory[]>([]);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [selectedStory, setSelectedStory] = useState<ConnectUsStory | null>(null);
  const [viewerModalOpen, setViewerModalOpen] = useState(false);
  const [selectedAuthorStories, setSelectedAuthorStories] = useState<ConnectUsStory[]>([]);

  const loadStories = () => {
    const realStories = ConnectUsService.getActiveStories();
    if (realStories.length > 0) {
      setActiveStories(realStories);
    } else {
      setActiveStories(DEMO_STORIES);
    }
  };

  useEffect(() => {
    loadStories();
  }, []);

  // Filter current user's active stories
  const myActiveStories = activeStories.filter(
    (s) => s.user_id === currentUserId || s.author?.id === currentUserId || s.author?.user_id === currentUserId
  );

  // Group other active stories by author
  const otherStoriesMap = new Map<string, ConnectUsStory[]>();
  activeStories.forEach((s) => {
    const authorId = s.user_id || s.author?.id || s.author?.user_id || "anon";
    if (authorId !== currentUserId) {
      if (!otherStoriesMap.has(authorId)) {
        otherStoriesMap.set(authorId, []);
      }
      otherStoriesMap.get(authorId)!.push(s);
    }
  });

  const handleMyStoryClick = () => {
    if (myActiveStories.length > 0) {
      setSelectedAuthorStories(myActiveStories);
      setSelectedStory(myActiveStories[0]);
      setViewerModalOpen(true);
    } else {
      setCreateModalOpen(true);
    }
  };

  const handleOpenAuthorStories = (authorStoriesList: ConnectUsStory[]) => {
    if (authorStoriesList.length === 0) return;
    const firstStory = authorStoriesList[0];
    ConnectUsService.viewStory(firstStory.id, currentUserId, currentProfile);
    setSelectedAuthorStories(authorStoriesList);
    setSelectedStory(firstStory);
    setViewerModalOpen(true);
  };

  const handleCreateStorySubmit = async (
    mediaUrl: string,
    mediaType: "image" | "video",
    caption?: string
  ): Promise<boolean> => {
    const authorToUse = currentProfile || {
      id: currentUserId,
      user_id: currentUserId,
      username: "mon_profil",
      full_name: "Mon Profil",
      avatar_url: currentAvatarUrl || null,
      cover_url: null,
      bio: null,
      location: null,
      website_url: null,
      is_verified: true,
      is_business: false,
      followers_count: 10,
      following_count: 5,
      posts_count: 1,
      created_at: new Date().toISOString(),
    };

    const newStory = await ConnectUsService.createStory(
      currentUserId,
      authorToUse,
      mediaUrl,
      mediaType,
      caption
    );

    if (newStory) {
      loadStories();
      return true;
    }
    return false;
  };

  return (
    <div className="bg-white rounded-3xl p-4 border border-slate-200/80 shadow-xs space-y-2">
      <div className="flex items-center justify-between px-1">
        <span className="text-xs font-bold text-slate-700 tracking-wider uppercase flex items-center gap-1.5">
          <Sparkles className="h-3.5 w-3.5 text-[#0E7C66]" /> Stories & Directs (24h)
        </span>
        <button
          onClick={() => setCreateModalOpen(true)}
          className="text-[10px] text-[#0E7C66] hover:underline font-bold flex items-center gap-1"
        >
          <Plus className="h-3 w-3" /> Nouvelle Story
        </button>
      </div>

      <div className="flex items-center gap-3 overflow-x-auto no-scrollbar py-1">
        {/* "Ma Story" Avatar Button */}
        <button
          type="button"
          onClick={handleMyStoryClick}
          className="flex flex-col items-center gap-1.5 shrink-0 group"
        >
          <div
            className={`relative h-14 w-14 rounded-2xl p-0.5 transition-all transform group-hover:scale-105 ${
              myActiveStories.length > 0
                ? "bg-gradient-to-tr from-emerald-500 via-[#0E7C66] to-teal-400"
                : "bg-slate-100 border-2 border-dashed border-slate-300"
            }`}
          >
            {currentAvatarUrl ? (
              <img src={currentAvatarUrl} alt="" className="h-full w-full object-cover rounded-[14px] bg-white" />
            ) : (
              <div className="h-full w-full rounded-[14px] bg-[#0E7C66] text-white flex items-center justify-center font-bold text-xs">
                {(currentProfile?.full_name || "M")[0]}
              </div>
            )}

            <div className="absolute -bottom-1 -right-1 h-5 w-5 rounded-full bg-[#0E7C66] text-white flex items-center justify-center ring-2 ring-white shadow-xs">
              <Plus className="h-3.5 w-3.5" />
            </div>
          </div>
          <span className="text-[10px] font-bold text-slate-700 truncate max-w-[68px]">
            {myActiveStories.length > 0 ? "Ma Story ✓" : "Ma Story"}
          </span>
        </button>

        {/* Other Authors Stories List */}
        {Array.from(otherStoriesMap.entries()).map(([authorId, authorStoriesList]) => {
          const firstStory = authorStoriesList[0];
          const author = firstStory.author;
          const isMerchant = Boolean(author?.is_business);
          const hasUnseen = authorStoriesList.some((s) => !(s.viewers || []).includes(currentUserId));

          return (
            <button
              key={authorId}
              type="button"
              onClick={() => handleOpenAuthorStories(authorStoriesList)}
              className="flex flex-col items-center gap-1.5 shrink-0 group"
            >
              <div
                className={`relative h-14 w-14 rounded-2xl p-0.5 transition-all transform group-hover:scale-105 ${
                  hasUnseen
                    ? "bg-gradient-to-tr from-amber-400 via-rose-500 to-[#0E7C66]"
                    : "bg-slate-300"
                }`}
              >
                {author?.avatar_url ? (
                  <img
                    src={author.avatar_url}
                    alt={author.full_name || ""}
                    className="h-full w-full object-cover rounded-[14px] border-2 border-white bg-white"
                  />
                ) : (
                  <div className="h-full w-full rounded-[14px] border-2 border-white bg-[#0E7C66] text-white flex items-center justify-center font-bold text-xs">
                    {(author?.full_name || "M")[0]}
                  </div>
                )}
                {isMerchant && (
                  <span className="absolute -bottom-1 -right-1 bg-amber-400 text-slate-950 p-0.5 rounded-full ring-2 ring-white">
                    <Store className="h-2.5 w-2.5" />
                  </span>
                )}
              </div>
              <span className="text-[10px] font-semibold text-slate-700 truncate max-w-[68px]">
                {author?.full_name || "Membre"}
              </span>
            </button>
          );
        })}
      </div>

      {/* Story Modals */}
      <CreateStoryModal
        open={createModalOpen}
        onOpenChange={setCreateModalOpen}
        onSubmitStory={handleCreateStorySubmit}
      />

      <StoryViewerModal
        open={viewerModalOpen}
        onOpenChange={setViewerModalOpen}
        currentUserId={currentUserId}
        story={selectedStory}
        authorStories={selectedAuthorStories}
        allStoriesList={activeStories}
        onSelectStory={setSelectedStory}
        onOpenCreateStory={() => setCreateModalOpen(true)}
      />
    </div>
  );
}
