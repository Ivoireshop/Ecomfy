import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuthReady } from "@/hooks/useAuthReady";

const STORAGE_KEY = "vp_community_last_seen";

const getLastSeen = (userId: string): string => {
  try {
    return localStorage.getItem(`${STORAGE_KEY}_${userId}`) || new Date(0).toISOString();
  } catch {
    return new Date(0).toISOString();
  }
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

  useEffect(() => {
    if (!session?.user) {
      setCount(0);
      return;
    }
    const userId = session.user.id;

    const fetchCount = async () => {
      const since = getLastSeen(userId);
      const { count: c } = await supabase
        .from("community_messages")
        .select("id", { count: "exact", head: true })
        .gt("created_at", since)
        .neq("user_id", userId);
      setCount(c || 0);
    };

    fetchCount();

    const onSeen = () => setCount(0);
    window.addEventListener("vp:community-seen", onSeen);

    const channel = supabase
      .channel("community_unread_badge")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "community_messages" },
        (payload) => {
          const m: any = payload.new;
          if (!m || m.user_id === userId) return;
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
  }, [session?.user]);

  // Mark seen when navigating to /community
  useEffect(() => {
    if (!session?.user) return;
    if (location.pathname.startsWith("/community")) {
      markCommunitySeen(session.user.id);
      setCount(0);
    }
  }, [location.pathname, session?.user]);

  return count;
};