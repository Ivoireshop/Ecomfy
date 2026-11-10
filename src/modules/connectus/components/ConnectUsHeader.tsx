import { useState, useEffect, useRef } from "react";
import { Button } from "./CUButton";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ConnectUsProfile } from "../types/connectus.types";
import { Globe, Search, PlusCircle, Bell, MessageCircle, ArrowLeft, X, Share2 } from "lucide-react";

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
  activeTab: ConnectUsTab;
  onTabChange: (tab: ConnectUsTab) => void;
  onCreatePostClick: () => void;
  unreadNotificationsCount?: number;
  unreadMessagesCount?: number;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  searchLoading?: boolean;
  onSelectUserForInvite?: (user: ConnectUsProfile) => void;
  onToggleFollowUser?: (userId: string) => void;
  onOpenDirectMessage?: (targetUser: ConnectUsProfile) => void;
  onOpenProfile?: (userId: string) => void;
  followingMap?: Record<string, boolean>;
  searchResults?: ConnectUsProfile[];
}

export function ConnectUsHeader({
  activeTab,
  onTabChange,
  onCreatePostClick,
  unreadNotificationsCount = 0,
  unreadMessagesCount = 0,
  searchQuery,
  onSearchChange,
  searchLoading = false,
  onSelectUserForInvite,
  onToggleFollowUser,
  onOpenDirectMessage,
  onOpenProfile,
  followingMap = {},
  searchResults = [],
}: ConnectUsHeaderProps) {
  const [showSearchResults, setShowSearchResults] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) setShowSearchResults(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setShowSearchResults(false);
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  const shareInvite = () => {
    const text = `Rejoins-moi sur ConnectUs, le réseau social d'Ecomfy : ${window.location.origin}/auth`;
    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`, "_blank", "noopener,noreferrer");
  };

  const iconButton = (tab: ConnectUsTab, label: string, count: number, children: React.ReactNode) => (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      onClick={() => onTabChange(tab)}
      aria-label={count > 0 ? `${label} (${count} non lu${count > 1 ? "s" : ""})` : label}
      aria-current={activeTab === tab ? "page" : undefined}
      className={`relative h-10 w-10 p-0 rounded-full hover:bg-slate-100 ${activeTab === tab ? "bg-slate-100 text-[#0E7C66]" : "text-slate-700"}`}
      title={label}
    >
      {children}
      {count > 0 && (
        <Badge className="absolute -top-1 -right-1 h-5 min-w-[20px] px-1 bg-rose-500 text-white text-[10px] font-extrabold rounded-full flex items-center justify-center border-2 border-white">
          {count > 99 ? "99+" : count}
        </Badge>
      )}
    </Button>
  );

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200/80 shadow-xs">
      <div className="max-w-7xl mx-auto px-3 sm:px-4 h-16 flex items-center justify-between gap-2 sm:gap-4">
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          <a
            href="/dashboard"
            className="flex items-center gap-1.5 text-xs font-bold text-slate-600 hover:text-slate-900 transition-colors bg-slate-100 px-2.5 py-2 rounded-full"
            title="Retour au tableau de bord Ecomfy"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Tableau de bord</span>
            <span className="sr-only sm:hidden">Retour au tableau de bord</span>
          </a>

          <button type="button" onClick={() => onTabChange("feed")} className="flex items-center gap-2" aria-label="ConnectUs, retour au fil d'actualité">
            <span className="h-9 w-9 rounded-2xl bg-gradient-to-tr from-[#0E7C66] via-emerald-500 to-teal-400 flex items-center justify-center">
              <Globe className="h-5 w-5 text-white" />
            </span>
            <span className="hidden sm:block text-left">
              <span className="block font-space font-extrabold text-base tracking-tight text-slate-900 leading-none">ConnectUs</span>
              <span className="block text-[10px] text-slate-500 font-medium">Réseau social & vente Ecomfy</span>
            </span>
          </button>
        </div>

        <div className="flex-1 max-w-md relative" ref={wrapperRef}>
          <div className="relative">
            <Search className="absolute left-3.5 top-3 h-4 w-4 text-slate-400" aria-hidden />
            <Input
              type="search"
              aria-label="Rechercher un membre ou une boutique"
              placeholder="Rechercher un membre ou une boutique"
              value={searchQuery}
              onChange={(e) => {
                onSearchChange(e.target.value);
                setShowSearchResults(true);
              }}
              onFocus={() => setShowSearchResults(true)}
              className="pl-10 pr-9 h-10 rounded-full bg-slate-100 border-transparent focus:bg-white focus:border-[#0E7C66] text-xs transition-all [&::-webkit-search-cancel-button]:hidden"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => {
                  onSearchChange("");
                  setShowSearchResults(false);
                }}
                className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 p-0.5 rounded-full"
                aria-label="Effacer la recherche"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          {showSearchResults && searchQuery.trim().length > 0 && (
            <div className="absolute top-12 left-0 right-0 bg-white rounded-3xl border border-slate-200 shadow-xl p-3 z-50 max-h-80 overflow-y-auto space-y-2">
              {searchQuery.trim().length < 2 ? (
                <p className="p-3 text-center text-xs text-slate-500">Saisissez au moins 2 caractères.</p>
              ) : searchLoading && searchResults.length === 0 ? (
                <p className="p-3 text-center text-xs text-slate-500">Recherche…</p>
              ) : searchResults.length > 0 ? (
                <div className="space-y-1.5">
                  <div className="px-2 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                    {searchResults.length} membre{searchResults.length > 1 ? "s" : ""} trouvé{searchResults.length > 1 ? "s" : ""}
                  </div>
                  {searchResults.map((user) => (
                    <div key={user.id} className="p-2 rounded-2xl hover:bg-slate-50 flex items-center justify-between gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          onOpenProfile?.(user.user_id);
                          setShowSearchResults(false);
                        }}
                        className="flex items-center gap-2.5 min-w-0 text-left"
                      >
                        {user.avatar_url ? (
                          <img src={user.avatar_url} alt="" className="h-9 w-9 rounded-xl object-cover shrink-0" />
                        ) : (
                          <span className="h-9 w-9 rounded-xl bg-[#0E7C66] text-white font-bold text-xs flex items-center justify-center shrink-0">
                            {(user.full_name || "U")[0]?.toUpperCase()}
                          </span>
                        )}
                        <span className="min-w-0">
                          <span className="block font-bold text-xs text-slate-900 truncate">{user.full_name}</span>
                          <span className="block text-[10px] text-slate-500 truncate">@{user.username}</span>
                          {Boolean(user.show_shop_on_profile) && user.shop_name && (
                            <span className="block text-[10px] text-[#0E7C66] font-semibold truncate">🏪 {user.shop_name}</span>
                          )}
                        </span>
                      </button>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <Button
                          size="sm"
                          onClick={() => onToggleFollowUser?.(user.user_id)}
                          className={`rounded-full h-8 px-3 text-[10px] font-bold ${followingMap[user.user_id] ? "bg-emerald-100 text-emerald-800 hover:bg-emerald-200" : "bg-slate-900 text-white hover:bg-slate-800"}`}
                        >
                          {followingMap[user.user_id] ? "Abonné" : "+ Suivre"}
                        </Button>
                        {onOpenDirectMessage && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              onOpenDirectMessage(user);
                              setShowSearchResults(false);
                            }}
                            aria-label={`Écrire à ${user.full_name}`}
                            className="rounded-full h-8 px-2.5 text-[10px] font-bold border-teal-300 text-teal-800 bg-teal-50 hover:bg-teal-100"
                          >
                            <MessageCircle className="h-3.5 w-3.5" />
                          </Button>
                        )}
                        {onSelectUserForInvite && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              onSelectUserForInvite(user);
                              setShowSearchResults(false);
                            }}
                            className="rounded-full h-8 px-2.5 text-[10px] font-bold border-emerald-300 text-[#0E7C66] hover:bg-emerald-50"
                          >
                            Inviter
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-4 text-center space-y-2">
                  <p className="text-xs font-bold text-slate-700">Aucun membre trouvé pour « {searchQuery.trim()} »</p>
                  <p className="text-[11px] text-slate-500">Cette personne n'est peut-être pas encore sur ConnectUs.</p>
                  <Button size="sm" onClick={shareInvite} className="rounded-full bg-[#0E7C66] hover:bg-[#0A6352] text-white text-xs font-bold px-4 gap-1.5">
                    <Share2 className="h-3.5 w-3.5" /> L'inviter via WhatsApp
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center gap-1 sm:gap-2 shrink-0">
          {iconButton("messages", "Messages", unreadMessagesCount, <MessageCircle className="h-5 w-5" />)}
          {iconButton("notifications", "Notifications", unreadNotificationsCount, <Bell className="h-5 w-5" />)}
          <Button
            onClick={onCreatePostClick}
            className="rounded-full bg-[#0E7C66] hover:bg-[#0A6352] text-white font-bold h-10 px-3 sm:px-4 text-xs gap-2 shrink-0"
            aria-label="Créer une publication"
          >
            <PlusCircle className="h-4 w-4" />
            <span className="hidden sm:inline">Publier</span>
          </Button>
        </div>
      </div>
    </header>
  );
}
