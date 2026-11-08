import { ConnectUsTab } from "./ConnectUsHeader";
import { Button } from "./CUButton";
import { Badge } from "@/components/ui/badge";
import { ConnectUsProfile } from "../types/connectus.types";
import { Globe, Compass, Users, Film, MessageCircle, Bell, ShoppingBag, Radio, User, Briefcase, ArrowLeft, PlusCircle } from "lucide-react";

interface ConnectUsSidebarProps {
  activeTab: ConnectUsTab;
  onTabChange: (tab: ConnectUsTab) => void;
  profile: ConnectUsProfile | null;
  onCreatePostClick: () => void;
  unreadNotificationsCount?: number;
  unreadMessagesCount?: number;
}

export function ConnectUsSidebar({
  activeTab,
  onTabChange,
  profile,
  onCreatePostClick,
  unreadNotificationsCount = 0,
  unreadMessagesCount = 0,
}: ConnectUsSidebarProps) {
  const navItems: { tab: ConnectUsTab; label: string; icon: React.ElementType; badge?: string | number; color?: string }[] = [
    { tab: "feed", label: "Fil d'actualité", icon: Globe, color: "text-[#0E7C66]" },
    { tab: "explore", label: "Explorer", icon: Compass, color: "text-teal-600" },
    { tab: "following", label: "Abonnements", icon: Users, color: "text-blue-600" },
    { tab: "stories", label: "Stories (24 h)", icon: Film, color: "text-amber-500" },
    { tab: "messages", label: "Messages", icon: MessageCircle, badge: unreadMessagesCount > 0 ? unreadMessagesCount : undefined, color: "text-[#0E7C66]" },
    { tab: "notifications", label: "Notifications", icon: Bell, badge: unreadNotificationsCount > 0 ? unreadNotificationsCount : undefined, color: "text-rose-500" },
    { tab: "marketplace", label: "Social commerce", icon: ShoppingBag, color: "text-emerald-600" },
    { tab: "live", label: "Live commerce", icon: Radio, badge: "Bientôt", color: "text-slate-400" },
    { tab: "profile", label: "Mon profil", icon: User, color: "text-indigo-600" },
    { tab: "business", label: "Mes statistiques", icon: Briefcase, color: "text-slate-800" },
  ];

  return (
    <aside className="w-64 shrink-0 hidden md:block space-y-4 sticky top-20" aria-label="Menu ConnectUs">
      <button
        type="button"
        onClick={() => onTabChange("profile")}
        className="w-full bg-white rounded-3xl p-4 border border-slate-200 shadow-xs flex items-center gap-3 text-left hover:border-[#0E7C66] transition-colors"
      >
        {profile?.avatar_url ? (
          <img src={profile.avatar_url} alt="" className="h-12 w-12 rounded-2xl object-cover border border-slate-200" />
        ) : (
          <span className="h-12 w-12 rounded-2xl bg-gradient-to-tr from-[#0E7C66] to-emerald-400 text-white font-extrabold text-lg flex items-center justify-center">
            {(profile?.full_name || "U")[0]?.toUpperCase()}
          </span>
        )}
        <span className="min-w-0 flex-1">
          <span className="block font-bold text-xs text-slate-900 truncate">{profile?.full_name || "Membre Ecomfy"}</span>
          <span className="block text-[11px] text-slate-500 truncate">@{profile?.username || "compte"}</span>
        </span>
      </button>

      <nav className="bg-white rounded-3xl p-3 border border-slate-200 shadow-xs space-y-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.tab;
          return (
            <button
              key={item.tab}
              type="button"
              onClick={() => onTabChange(item.tab)}
              aria-current={isActive ? "page" : undefined}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-2xl text-xs font-bold transition-all text-left ${
                isActive ? "bg-slate-900 text-white" : "text-slate-700 hover:bg-slate-100"
              }`}
            >
              <span className="flex items-center gap-2.5 min-w-0">
                <Icon className={`h-4 w-4 shrink-0 ${isActive ? "text-white" : item.color || "text-slate-500"}`} />
                <span className="truncate">{item.label}</span>
              </span>
              {item.badge !== undefined && (
                <Badge className={`text-[9px] px-1.5 py-0 border-0 ${typeof item.badge === "number" ? "bg-rose-500 text-white font-extrabold" : "bg-slate-100 text-slate-500 font-bold"}`}>
                  {item.badge}
                </Badge>
              )}
            </button>
          );
        })}

        <div className="pt-2">
          <Button onClick={onCreatePostClick} className="w-full rounded-2xl bg-[#0E7C66] hover:bg-[#0A6352] text-white font-extrabold text-xs h-10 gap-2">
            <PlusCircle className="h-4 w-4" /> Publier
          </Button>
        </div>
      </nav>

      <a
        href="/dashboard"
        className="flex items-center justify-center gap-2 text-xs font-bold text-slate-700 hover:text-slate-900 bg-slate-100/80 rounded-3xl p-3 border border-slate-200 transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        <span>Retour au tableau de bord</span>
      </a>
    </aside>
  );
}
