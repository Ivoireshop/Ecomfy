import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuthReady } from "@/hooks/useAuthReady";
import { isConnectUsPayload } from "@/lib/communityChat";

const STORAGE_KEY = "vp_community_last_seen";

// Premier passage d'un membre : l'historique existant n'est pas « non lu », on part de maintenant
const getLastSeen = (userId: string): string => {
  const now = new Date().toISOString();
  try {
    const key = `${STORAGE_KEY}_${userId}`;
    const stored = localStorage.getItem(key);
    if (stored) return stored;
    localStorage.setItem(key, now);
  } catch {
    // localStorage indisponible (navigation privée…)
  }
  return now;
};

export const markCommunitySeen = (userId: string) => {
  try {
    localStorage.setItem(`${STORAGE_KEY}_${userId}`, new Date().toISOString());
    window.dispatchEvent(new CustomEvent("vp:community-seen"));
  } catch {}
};

export const useCommunityUnread = () => {
  const { session } = useAuthReady();
  const location = useLocation();
  const [count, setCount] = useState(0);
  // `session.user` change de référence à chaque rafraîchissement du jeton : on ne dépend que de l'identifiant
  const userId = session?.user?.id;

  useEffect(() => {
    if (!userId) {
      setCount(0);
      return;
    }

    const fetchCount = async () => {
      const since = getLastSeen(userId);
      const { count: c } = await supabase
        .from("community_messages")
        .select("id", { count: "exact", head: true })
        .eq("kind", "chat")
        .gt("created_at", since)
        .neq("user_id", userId);
      setCount(c || 0);
    };

    fetchCount();

    const onSeen = () => setCount(0);
    window.addEventListener("vp:community-seen", onSeen);

    const channel = supabase
      // Nom unique : la barre latérale et la barre mobile utilisent toutes deux ce hook
      .channel(`community_unread_badge_${Math.random().toString(36).slice(2)}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "community_messages" },
        (payload) => {
          const m: any = payload.new;
          if (!m || m.user_id === userId) return;
          // Blobs ConnectUs : pas des messages du salon
          if (isConnectUsPayload(m.body)) return;
          // Don't count if user is currently on the community page
          if (window.location.pathname.startsWith("/community")) {
            markCommunitySeen(userId);
            return;
          }
          setCount((prev) => prev + 1);
        }
      )
      .subscribe();

    return () => {
      window.removeEventListener("vp:community-seen", onSeen);
      void supabase.removeChannel(channel);
    };
  }, [userId]);

  // Mark seen when navigating to /community
  useEffect(() => {
    if (!userId) return;
    if (location.pathname.startsWith("/community")) {
      markCommunitySeen(userId);
      setCount(0);
    }
  }, [location.pathname, userId]);

  return count;
};
