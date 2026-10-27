import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuthReady } from "@/hooks/useAuthReady";
import { toast } from "sonner";
import { extractMentions, isConnectUsPayload, mentionToken } from "@/lib/communityChat";

const seen = new Set<string>();

export const useCommunityNotifications = () => {
  const { session } = useAuthReady();
  const navigate = useNavigate();
  // `session.user` change de référence à chaque rafraîchissement du jeton : on ne dépend que de l'identifiant
  const userId = session?.user?.id;
  const meRef = useRef<{ id: string; token: string } | null>(null);

  useEffect(() => {
    if (!userId) {
      meRef.current = null;
      return;
    }
    let cancelled = false;

    (async () => {
      const { data: prof } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", userId)
        .maybeSingle();
      if (cancelled) return;
      // Sans nom complet, aucune mention possible (on n'utilise plus l'adresse e-mail comme jeton)
      meRef.current = { id: userId, token: mentionToken(prof?.full_name) };
    })();

    // Request browser notification permission once
    if (typeof Notification !== "undefined" && Notification.permission === "default") {
      try { Notification.requestPermission().catch(() => {}); } catch {}
    }

    const channel = supabase
      .channel("community_notifications_global")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "community_messages" },
        async (payload) => {
          const m: any = payload.new;
          if (!m || !meRef.current) return;
          if (m.user_id === meRef.current.id) return;
          if (seen.has(m.id)) return;
          // Blobs ConnectUs (réactions, notifications…) : jamais une mention du salon
          if (isConnectUsPayload(m.body)) return;

          let reason: "mention" | "reply" | null = null;

          const token = meRef.current.token;
          if (token && extractMentions(String(m.body || "")).includes(token)) reason = "mention";

          if (!reason && m.reply_to_id) {
            const { data: parent } = await supabase
              .from("community_messages")
              .select("user_id")
              .eq("id", m.reply_to_id)
              .maybeSingle();
            if (parent?.user_id === meRef.current.id) reason = "reply";
          }

          if (!reason) return;
          seen.add(m.id);

          const onCommunityPage = window.location.pathname.startsWith("/community");
          const visible = document.visibilityState === "visible";
          // Le message s'affiche déjà sous les yeux de l'utilisateur : pas de notification en double
          if (onCommunityPage && visible) return;

          const { data: authors } = await supabase
            .rpc("get_community_profiles", { _ids: [m.user_id] });
          const authorName = (authors as any[] | null)?.[0]?.full_name || "Un membre";
          const preview = String(m.body || "").slice(0, 120);
          const title = reason === "mention"
            ? `${authorName} vous a mentionné`
            : `${authorName} a répondu à votre message`;

          toast(title, {
            description: preview,
            action: {
              label: "Voir",
              onClick: () => navigate("/community"),
            },
          });

          if (typeof Notification !== "undefined" && Notification.permission === "granted" && !visible) {
            try {
              const n = new Notification(title, { body: preview, tag: `community-${m.id}` });
              n.onclick = () => { window.focus(); navigate("/community"); n.close(); };
            } catch {}
          }
        }
      )
      .subscribe();

    return () => {
      cancelled = true;
      void supabase.removeChannel(channel);
    };
  }, [userId, navigate]);
};
