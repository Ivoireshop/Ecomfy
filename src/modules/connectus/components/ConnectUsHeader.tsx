import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ConnectUsProfile } from "../types/connectus.types";
import {
  Globe, Search, PlusCircle, Bell, User, ShoppingBag, Sparkles, Store, Compass, Radio,
  MessageCircle, Film, Users, Briefcase, ArrowLeft, X
} from "lucide-react";

export type ConnectUsTab = 
  | "feed"
  | "explore"
  | "following"
  | "stories"
  | "messages"
  | "notifications"
  | "live"
  | "profile"
  | "marketplace"
  | "business";

interface ConnectUsHeaderProps {
  profile: ConnectUsProfile | null;
  activeTab: ConnectUsTab;
  onTabChange: (tab: ConnectUsTab) => void;
  onCreatePostClick: () => void;
  unreadNotificationsCount?: number;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  onSelectUserForInvite?: (user: ConnectUsProfile) => void;
  onToggleFollowUser?: (userId: string) => void;
  onOpenDirectMessage?: (targetUser: ConnectUsProfile) => void;
  followingMap?: Record<string, boolean>;
  searchResults?: ConnectUsProfile[];
}

export function ConnectUsHeader({
  profile,
  activeTab,
  onTabChange,
  onCreatePostClick,
  unreadNotificationsCount = 2,
  searchQuery,
  onSearchChange,
  onSelectUserForInvite,
  onToggleFollowUser,
  onOpenDirectMessage,
  followingMap = {},
  searchResults = [],
}: ConnectUsHeaderProps) {
  const [showSearchResults, setShowSearchResults] = useState(false);

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200/80 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between gap-4">
        {/* Brand Logo & Back to Ecomfy */}
        <div className="flex items-center gap-3 shrink-0">
          <a
            href="/dashboard"
            className="flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-slate-900 transition-colors bg-slate-100 px-2.5 py-1.5 rounded-full"
            title="Retour au Dashboard Ecomfy"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Dashboard</span>
          </a>

          <div className="flex items-center gap-2">
            <div className="h-9 w-9 rounded-2xl bg-gradient-to-tr from-[#0E7C66] via-emerald-500 to-teal-400 p-0.5 shadow-xs flex items-center justify-center">
              <Globe className="h-5 w-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-space font-extrabold text-base tracking-tight text-slate-900">ConnectUs</span>
                <Badge className="bg-[#0E7C66] text-white text-[9px] font-extrabold px-1.5 py-0 uppercase">Natif</Badge>
              </div>
              <p className="text-[10px] text-slate-500 font-medium hidden md:block">Écosystème Social & Vente Ecomfy</p>
            </div>
          </div>
        </div>

        {/* Central Search Bar with Ultra-Tolerant Member Discovery */}
        <div className="flex-1 max-w-md relative">
          <div className="relative">
            <Search className="absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
            <Input
              type="text"
              placeholder="Rechercher par nom (ex: Ulrich Djaté, Aminata...)"
              value={searchQuery}
              onChange={(e) => {
                onSearchChange(e.target.value);
                setShowSearchResults(true);
              }}
              onFocus={() => setShowSearchResults(true)}
              className="pl-10 pr-9 h-10 rounded-full bg-slate-100 border-transparent focus:bg-white focus:border-[#0E7C66] text-xs transition-all shadow-2xs"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => {
                  onSearchChange("");
                  setShowSearchResults(false);
                }}
                className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 p-0.5 rounded-full"
                title="Effacer la recherche"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          {/* Search Dropdown Panel */}
          {showSearchResults && searchQuery.trim().length > 0 && (
            <div className="absolute top-12 left-0 right-0 bg-white rounded-3xl border border-slate-200 shadow-xl p-3 z-50 max-h-80 overflow-y-auto space-y-2">
              {searchResults.length > 0 ? (
                <div className="space-y-1.5">
                  <div className="px-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    Membres & Vendeurs trouvés ({searchResults.length})
                  </div>
                  {searchResults.map((user) => (
                    <div
                      key={user.id}
                      className="p-2 rounded-2xl hover:bg-slate-50 flex items-center justify-between gap-2 border border-transparent hover:border-slate-100 transition-all"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        {user.avatar_url ? (
                          <img src={user.avatar_url} alt="" className="h-9 w-9 rounded-xl object-cover shrink-0" />
                        ) : (
                          <div className="h-9 w-9 rounded-xl bg-[#0E7C66] text-white font-bold text-xs flex items-center justify-center shrink-0">
                            {(user.full_name || "U")[0]?.toUpperCase()}
                          </div>
                        )}
                        <div className="min-w-0">
                          <p className="font-bold text-xs text-slate-900 truncate">{user.full_name}</p>
                          <p className="text-[10px] text-slate-500 truncate">@{user.username}</p>
                          {Boolean(user.show_shop_on_profile) && user.shop_name && (
                            <p className="text-[9px] text-[#0E7C66] font-semibold truncate mt-0.5">
                              🏪 {user.shop_name}
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <Button
                          size="sm"
                          onClick={() => onToggleFollowUser && onToggleFollowUser(user.id)}
                          className={`rounded-full h-7 px-3 text-[10px] font-bold ${
                            followingMap[user.id]
                              ? "bg-emerald-100 text-emerald-800 border-0"
                              : "bg-slate-900 text-white hover:bg-slate-800"
                          }`}
                        >
                          {followingMap[user.id] ? "Abonné" : "+ Suivre"}
                        </Button>
                        {onOpenDirectMessage && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              onOpenDirectMessage(user);
                              setShowSearchResults(false);
                            }}
                            className="rounded-full h-7 px-2.5 text-[10px] font-bold border-teal-300 text-teal-800 bg-teal-50 hover:bg-teal-100"
                          >
                            Message 💬
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            onSelectUserForInvite && onSelectUserForInvite(user);
                            setShowSearchResults(false);
                          }}
                          className="rounded-full h-7 px-2.5 text-[10px] font-bold border-emerald-300 text-[#0E7C66] hover:bg-emerald-50"
                        >
                          Inviter ✉️
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-4 text-center space-y-2">
                  <p className="text-xs font-bold text-slate-700">Aucun membre inscrit trouvé pour "{searchQuery}"</p>
                  <p className="text-[11px] text-slate-500">Cette personne n'a pas encore de compte sur Connect As ?</p>
                  <Button
                    size="sm"
                    onClick={() => {
                      onSelectUserForInvite && onSelectUserForInvite({
                        id: `invite-${Date.now()}`,
                        user_id: `invite-${Date.now()}`,
                        username: searchQuery.toLowerCase().replace(/[^a-z0-9]/g, "_"),
                        full_name: searchQuery,
                        avatar_url: null,
                        bio: "Membre invité à rejoindre Connect As",
                        location: "Côte d'Ivoire",
                        website_url: null,
                        is_verified: false,
                        is_business: false,
                        followers_count: 0,
                        following_count: 0,
                        posts_count: 0,
                        created_at: new Date().toISOString()
                      });
                      setShowSearchResults(false);
                    }}
                    className="rounded-full bg-[#0E7C66] hover:bg-[#0A6352] text-white text-xs font-bold px-4 py-2 shadow-xs gap-1.5"
                  >
                    <span>✉️ Inviter "{searchQuery}" à rejoindre Connect As</span>
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right Actions Header (Notifications Bell & Create Post) */}
        <div className="flex items-center gap-2 shrink-0">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onTabChange("notifications")}
            className="relative h-10 w-10 p-0 rounded-full text-slate-700 hover:bg-slate-100"
            title="Centre de Notifications"
          >
            <Bell className="h-5 w-5 text-slate-700" />
            {unreadNotificationsCount > 0 ? (
              <Badge className="absolute -top-1 -right-1 h-5 min-w-[20px] px-1 bg-rose-500 text-white text-[10px] font-extrabold rounded-full flex items-center justify-center border-2 border-white shadow-xs">
                {unreadNotificationsCount}
              </Badge>
            ) : null}
          </Button>

          <Button
            onClick={onCreatePostClick}
            className="rounded-full bg-[#0E7C66] hover:bg-[#0A6352] text-white font-bold h-10 px-4 text-xs shadow-xs gap-2 shrink-0"
          >
            <PlusCircle className="h-4 w-4" />
            <span>Publier</span>
          </Button>
        </div>
      </div>
    </header>
  );
}
