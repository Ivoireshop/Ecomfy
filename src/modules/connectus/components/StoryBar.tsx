import { useState } from "react";
import { Plus, Sparkles, Store } from "lucide-react";
import { toast } from "@/hooks/use-toast";

interface StoryItem {
  id: string;
  authorName: string;
  avatarUrl: string;
  hasUnseenStory: boolean;
  isMerchant?: boolean;
}

const DEMO_STORIES: StoryItem[] = [
  {
    id: "s1",
    authorName: "Koffi Fashion",
    avatarUrl: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400&auto=format&fit=crop&q=80",
    hasUnseenStory: true,
    isMerchant: true,
  },
  {
    id: "s2",
    authorName: "Aminata Beauty",
    avatarUrl: "https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=400&auto=format&fit=crop&q=80",
    hasUnseenStory: true,
    isMerchant: true,
  },
  {
    id: "s3",
    authorName: "Sékou Tech",
    avatarUrl: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&auto=format&fit=crop&q=80",
    hasUnseenStory: false,
    isMerchant: true,
  },
  {
    id: "s4",
    authorName: "Awa Design",
    avatarUrl: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=400&auto=format&fit=crop&q=80",
    hasUnseenStory: true,
    isMerchant: false,
  }
];

export function StoryBar({ currentAvatarUrl }: { currentAvatarUrl?: string | null }) {
  const [stories, setStories] = useState<StoryItem[]>(DEMO_STORIES);

  const handleOpenStory = (story: StoryItem) => {
    setStories(prev => prev.map(s => s.id === story.id ? { ...s, hasUnseenStory: false } : s));
    toast({
      title: `Story de ${story.authorName} 🎬`,
      description: "Visualisation de la story sociale / produit.",
    });
  };

  const handleCreateStory = () => {
    toast({
      title: "Créer une Story ConnectUs 📸",
      description: "Partagez une photo, vidéo ou produit disponible pendant 24h !",
    });
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
          onClick={handleCreateStory}
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
        {stories.map((s) => (
          <button
            key={s.id}
            onClick={() => handleOpenStory(s)}
            className="flex flex-col items-center gap-1.5 shrink-0 group"
          >
            <div className={`relative h-14 w-14 rounded-2xl p-0.5 transition-all transform group-hover:scale-105 ${
              s.hasUnseenStory
                ? "bg-gradient-to-tr from-amber-400 via-rose-500 to-[#0E7C66]"
                : "bg-slate-200"
            }`}>
              <img
                src={s.avatarUrl}
                alt={s.authorName}
                className="h-full w-full object-cover rounded-[14px] border-2 border-white bg-white"
              />
              {s.isMerchant && (
                <span className="absolute -bottom-1 -right-1 bg-amber-400 text-slate-950 p-0.5 rounded-full ring-2 ring-white">
                  <Store className="h-2.5 w-2.5" />
                </span>
              )}
            </div>
            <span className="text-[10px] font-semibold text-slate-700 truncate max-w-[64px]">
              {s.authorName}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
