import { ConnectUsTab } from "./ConnectUsHeader";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ConnectUsProfile } from "../types/connectus.types";
import {
  Globe, Compass, Users, Film, MessageCircle, Bell, ShoppingBag, Radio, User, Briefcase, BarChart2, Settings, ArrowLeft, PlusCircle
} from "lucide-react";

interface ConnectUsSidebarProps {
  activeTab: ConnectUsTab;
  onTabChange: (tab: ConnectUsTab) => void;
  profile: ConnectUsProfile | null;
  onCreatePostClick: () => void;
  unreadNotificationsCount?: number;
}

export function ConnectUsSidebar({
  activeTab,
  onTabChange,
  profile,
  onCreatePostClick,
  unreadNotificationsCount = 2,
}: ConnectUsSidebarProps) {
  const navItems: { tab: ConnectUsTab; label: string; icon: React.ElementType; badge?: string | number; color?: string }[] = [
    { tab: "feed", label: "Fil d'Actualité", icon: Globe, color: "text-[#0E7C66]" },
    { tab: "explore", label: "Explorer", icon: Compass, color: "text-teal-600" },
    { tab: "following", label: "Abonnements", icon: Users, color: "text-blue-600" },
    { tab: "stories", label: "Stories (24h)", icon: Film, color: "text-amber-500" },
    { tab: "messages", label: "Messenger Ecomfy", icon: MessageCircle, color: "text-[#0E7C66]" },
    { tab: "notifications", label: "Notifications", icon: Bell, badge: unreadNotificationsCount > 0 ? unreadNotificationsCount : undefined, color: "text-rose-500" },
    { tab: "marketplace", label: "Social Commerce", icon: ShoppingBag, color: "text-emerald-600" },
    { tab: "live", label: "Live Commerce", icon: Radio, badge: "EN DIRECT", color: "text-rose-600 animate-pulse" },
    { tab: "profile", label: "Mon Profil Social", icon: User, color: "text-indigo-600" },
    { tab: "business", label: "Business Manager", icon: Briefcase, color: "text-slate-800" },
  ];

  return (
    <div className="w-64 shrink-0 hidden md:block space-y-4">
      {/* User Card Snapshot */}
      <div className="bg-white rounded-3xl p-4 border border-slate-200 shadow-xs flex items-center gap-3">
        {profile?.avatar_url ? (
          <img src={profile.avatar_url} alt="" className="h-12 w-12 rounded-2xl object-cover border border-slate-200 shadow-2xs" />
        ) : (
          <div className="h-12 w-12 rounded-2xl bg-gradient-to-tr from-[#0E7C66] to-emerald-400 text-white font-extrabold text-lg flex items-center justify-center shadow-2xs">
            {(profile?.full_name || "U")[0]?.toUpperCase()}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className="font-bold text-xs text-slate-900 truncate">{profile?.full_name || "Membre Ecomfy"}</p>
          <p className="text-[10px] text-slate-400 font-medium">@{profile?.username || "compte"}</p>
        </div>
      </div>

      {/* Main ConnectUs Vertical Navigation */}
      <div className="bg-white rounded-3xl p-3 border border-slate-200 shadow-xs space-y-1">
        <p className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider px-3 py-1">
          MENU CONNECTUS
        </p>

        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.tab;
          return (
            <button
              key={item.tab}
              onClick={() => onTabChange(item.tab)}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-2xl text-xs font-bold transition-all text-left ${
                isActive
                  ? "bg-slate-900 text-white shadow-xs"
                  : "text-slate-700 hover:bg-slate-100"
              }`}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <Icon className={`h-4 w-4 shrink-0 ${isActive ? "text-white" : item.color || "text-slate-500"}`} />
                <span className="truncate">{item.label}</span>
              </div>

              {item.badge && (
                <Badge
                  className={`text-[9px] px-1.5 py-0 border-0 ${
                    typeof item.badge === "number"
                      ? "bg-rose-500 text-white font-extrabold"
                      : "bg-rose-100 text-rose-700 uppercase font-bold"
                  }`}
                >
                  {item.badge}
                </Badge>
              )}
            </button>
          );
        })}

        {/* Quick Action Button */}
        <div className="pt-2">
          <Button
            onClick={onCreatePostClick}
            className="w-full rounded-2xl bg-[#0E7C66] hover:bg-[#0A6352] text-white font-extrabold text-xs h-10 shadow-sm gap-2"
          >
            <PlusCircle className="h-4 w-4" /> Publier un contenu
          </Button>
        </div>
      </div>

      {/* Return to Ecomfy Main Dashboard */}
      <div className="bg-slate-100/80 rounded-3xl p-3 border border-slate-200">
        <a
          href="/dashboard"
          className="flex items-center justify-center gap-2 text-xs font-bold text-slate-700 hover:text-slate-900 py-1 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Retour au Dashboard Ecomfy</span>
        </a>
      </div>
    </div>
  );
}
