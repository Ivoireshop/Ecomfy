import { useState, useEffect } from "react";
import { Plus, Sparkles, Store } from "lucide-react";
import { ConnectUsStory, ConnectUsProfile } from "../types/connectus.types";
import { ConnectUsService } from "../services/connectus.service";
import { CreateStoryModal } from "./CreateStoryModal";
import { StoryViewerModal } from "./StoryViewerModal";

interface StoryBarProps {
  currentAvatarUrl?: string | null;
  currentUserId?: string;
  currentProfile?: ConnectUsProfile | null;
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

export function StoryBar({ currentAvatarUrl, currentUserId = "me", currentProfile }: StoryBarProps) {
  const [activeStories, setActiveStories] = useState<ConnectUsStory[]>([]);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [selectedStory, setSelectedStory] = useState<ConnectUsStory | null>(null);
  const [viewerModalOpen, setViewerModalOpen] = useState(false);

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

  const handleOpenStory = (story: ConnectUsStory) => {
    if (currentUserId) {
      ConnectUsService.viewStory(story.id, currentUserId);
    }
    setSelectedStory(story);
    setViewerModalOpen(true);
  };

  return (
    <div className="bg-white rounded-3xl p-4 border border-slate-200/80 shadow-xs space-y-2">
      <div className="flex items-center justify-between px-1">
        <span className="text-xs font-bold text-slate-700 tracking-wider uppercase flex items-center gap-1.5">
          <Sparkles className="h-3.5 w-3.5 text-[#0E7C66]" /> Stories & Directs
        </span>
        <span className="text-[10px] text-slate-400 font-semibold">24h d'expiration</span>
      </div>

      <div className="flex items-center gap-3 overflow-x-auto no-scrollbar py-1">
        {/* Create Story Button */}
        <button
          onClick={() => setCreateModalOpen(true)}
          className="flex flex-col items-center gap-1.5 shrink-0 group"
        >
          <div className="relative h-14 w-14 rounded-2xl bg-slate-100 border-2 border-dashed border-slate-300 flex items-center justify-center group-hover:border-[#0E7C66] transition-all">
            {currentAvatarUrl ? (
              <img src={currentAvatarUrl} alt="" className="h-full w-full object-cover rounded-2xl opacity-60" />
            ) : null}
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="h-7 w-7 rounded-full bg-[#0E7C66] text-white flex items-center justify-center shadow-md">
                <Plus className="h-4 w-4" />
              </div>
            </div>
          </div>
          <span className="text-[10px] font-bold text-slate-700 truncate max-w-[64px]">Ma Story</span>
        </button>

        {/* Stories Items List */}
        {activeStories.map((story) => {
          const author = story.author;
          const isMerchant = Boolean(author?.is_business);

          return (
            <button
              key={story.id}
              onClick={() => handleOpenStory(story)}
              className="flex flex-col items-center gap-1.5 shrink-0 group"
            >
              <div className="relative h-14 w-14 rounded-2xl p-0.5 transition-all transform group-hover:scale-105 bg-gradient-to-tr from-amber-400 via-rose-500 to-[#0E7C66]">
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
              <span className="text-[10px] font-semibold text-slate-700 truncate max-w-[64px]">
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
        story={selectedStory}
        storiesList={activeStories}
        onSelectStory={setSelectedStory}
      />
    </div>
  );
}
