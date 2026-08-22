import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ConnectUsProfile } from "../types/connectus.types";
import {
  Globe, Search, PlusCircle, Bell, User, ShoppingBag, Sparkles, Store, Compass, Radio,
  MessageCircle, Film, Users, Briefcase, ArrowLeft
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
  followingMap = {},
  searchResults = [],
}: ConnectUsHeaderProps) {
  const [showSearchResults, setShowSearchResults] = useState(false);

  return (
    <div className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-xs">
      <div className="max-w-6xl mx-auto px-4 py-3 space-y-3">
        {/* Upper Row: Brand Logo & Actions */}
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <a
              href="/dashboard"
              className="p-2 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition-all flex items-center gap-1 text-xs font-bold shrink-0"
              title="Retourner au tableau de bord Ecomfy"
            >
              <ArrowLeft className="h-4 w-4" />
              <span className="hidden sm:inline">Ecomfy</span>
            </a>

            <div className="h-10 w-10 rounded-2xl bg-gradient-to-tr from-[#0E7C66] via-emerald-500 to-teal-400 flex items-center justify-center text-white font-extrabold text-xl shadow-md shrink-0">
              <Globe className="h-5 w-5 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-space font-bold text-xl text-slate-900 tracking-tight">
                  ConnectUs
                </h1>
                <Badge className="bg-emerald-100 text-emerald-800 border-0 text-[10px] px-2 py-0.5 font-bold uppercase tracking-wider">
                  Social Commerce
                </Badge>
              </div>
              <p className="text-xs text-slate-500 hidden sm:block">
                L'écosystème social natif & commercial d'Ecomfy
              </p>
            </div>
          </div>

          {/* Search Bar with Autocomplete Dropdown */}
          <div className="relative flex-1 max-w-md hidden md:block">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              type="text"
              placeholder="Rechercher un nom (ex: Ulrich, Désirée, Koffi...)"
              value={searchQuery}
              onChange={(e) => {
                onSearchChange(e.target.value);
                setShowSearchResults(true);
              }}
              onFocus={() => setShowSearchResults(true)}
              className="pl-10 h-10 rounded-full bg-slate-100/80 border-transparent focus:bg-white focus:border-[#0E7C66] text-xs transition-all"
            />

            {/* Instant Member Autocomplete Popup */}
            {showSearchResults && searchQuery.trim().length > 0 && (
              <div className="absolute top-12 left-0 right-0 bg-white rounded-3xl border border-slate-200 shadow-2xl p-3 z-50 space-y-2 max-h-[380px] overflow-y-auto">
                <div className="flex items-center justify-between px-2 pb-1 border-b border-slate-100 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  <span>Membres trouvés ({searchResults.length})</span>
                  <button onClick={() => setShowSearchResults(false)} className="text-slate-400 hover:text-slate-700">✕</button>
                </div>

                {searchResults.length > 0 ? (
                  <div className="space-y-1.5">
                    {searchResults.map((user) => (
                      <div
                        key={user.id}
                        className="flex items-center justify-between gap-3 p-2 rounded-2xl hover:bg-slate-50 border border-transparent hover:border-slate-100 transition-all"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="h-9 w-9 rounded-xl bg-gradient-to-tr from-[#0E7C66] to-teal-400 text-white font-bold flex items-center justify-center shrink-0 overflow-hidden text-xs">
                            {user.avatar_url ? (
                              <img src={user.avatar_url} alt="" className="h-full w-full object-cover" />
                            ) : (
                              (user.full_name || "U")[0]?.toUpperCase()
                            )}
                          </div>
                          <div className="min-w-0">
                            <p className="font-bold text-xs text-slate-900 truncate">{user.full_name}</p>
                            <p className="text-[10px] text-slate-500 truncate">@{user.username}</p>
                            {user.shop_name && (
                              <p className="text-[9px] text-[#0E7C66] font-semibold truncate">
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
                  <div className="p-4 text-center text-xs text-slate-500">
                    Aucun membre trouvé commençant par "{searchQuery}".
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Create Post Button */}
          <div className="flex items-center gap-2">
            <Button
              onClick={onCreatePostClick}
              className="rounded-full bg-[#0E7C66] hover:bg-[#0A6352] text-white font-bold h-10 px-4 text-xs shadow-sm gap-2"
            >
              <PlusCircle className="h-4 w-4" />
              <span>Publier</span>
            </Button>
          </div>
        </div>

        {/* Dedicated Internal ConnectUs Sub-Navigation */}
        <div className="flex items-center gap-1 overflow-x-auto no-scrollbar pt-1 border-t border-slate-100 text-xs">
          <button
            onClick={() => onTabChange("feed")}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl font-bold transition-all whitespace-nowrap ${
              activeTab === "feed"
                ? "bg-slate-900 text-white shadow-xs"
                : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            <Globe className="h-4 w-4" />
            <span>Accueil (Feed)</span>
          </button>

          <button
            onClick={() => onTabChange("explore")}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl font-bold transition-all whitespace-nowrap ${
              activeTab === "explore"
                ? "bg-slate-900 text-white shadow-xs"
                : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            <Compass className="h-4 w-4" />
            <span>Explorer</span>
          </button>

          <button
            onClick={() => onTabChange("following")}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl font-bold transition-all whitespace-nowrap ${
              activeTab === "following"
                ? "bg-slate-900 text-white shadow-xs"
                : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            <Users className="h-4 w-4" />
            <span>Abonnements</span>
          </button>

          <button
            onClick={() => onTabChange("stories")}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl font-bold transition-all whitespace-nowrap ${
              activeTab === "stories"
                ? "bg-slate-900 text-white shadow-xs"
                : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            <Film className="h-4 w-4 text-amber-500" />
            <span>Stories</span>
          </button>

          <button
            onClick={() => onTabChange("messages")}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl font-bold transition-all whitespace-nowrap ${
              activeTab === "messages"
                ? "bg-slate-900 text-white shadow-xs"
                : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            <MessageCircle className="h-4 w-4 text-blue-500" />
            <span>Messages</span>
          </button>

          <button
            onClick={() => onTabChange("notifications")}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl font-bold transition-all whitespace-nowrap relative ${
              activeTab === "notifications"
                ? "bg-slate-900 text-white shadow-xs"
                : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            <Bell className="h-4 w-4" />
            <span>Notifications</span>
            {unreadNotificationsCount > 0 && (
              <span className="bg-rose-500 text-white text-[10px] font-extrabold h-4 w-4 rounded-full flex items-center justify-center">
                {unreadNotificationsCount}
              </span>
            )}
          </button>

          <button
            onClick={() => onTabChange("marketplace")}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl font-bold transition-all whitespace-nowrap ${
              activeTab === "marketplace"
                ? "bg-slate-900 text-white shadow-xs"
                : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            <ShoppingBag className="h-4 w-4 text-emerald-600" />
            <span>Social Commerce</span>
          </button>

          <button
            onClick={() => onTabChange("live")}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl font-bold transition-all whitespace-nowrap text-amber-600 hover:bg-amber-50 ${
              activeTab === "live" ? "bg-amber-100 text-amber-900" : ""
            }`}
          >
            <Radio className="h-4 w-4 text-rose-500 animate-pulse" />
            <span>Live</span>
          </button>

          <button
            onClick={() => onTabChange("profile")}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl font-bold transition-all whitespace-nowrap ${
              activeTab === "profile"
                ? "bg-slate-900 text-white shadow-xs"
                : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            <User className="h-4 w-4" />
            <span>Profil</span>
          </button>

          <button
            onClick={() => onTabChange("business")}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl font-bold transition-all whitespace-nowrap ${
              activeTab === "business"
                ? "bg-slate-900 text-white shadow-xs"
                : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            <Briefcase className="h-4 w-4 text-indigo-500" />
            <span>Business</span>
          </button>
        </div>
      </div>
    </div>
  );
}
