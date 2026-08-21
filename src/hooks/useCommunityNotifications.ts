import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuthReady } from "@/hooks/useAuthReady";
import { toast } from "sonner";

const seen = new Set<string>();

const firstNameToken = (name: string | null | undefined) => {
  if (!name) return "";
  const t = name.trim().split(/\s+/)[0] || "";
  return t.replace(/[^a-zA-ZÀ-ÿ0-9_.-]/g, "").toLowerCase();
};

export const useCommunityNotifications = () => {
  const { session } = useAuthReady();
  const navigate = useNavigate();
  const meRef = useRef<{ id: string; token: string; name: string } | null>(null);

  useEffect(() => {
    if (!session?.user) return;
    let cancelled = false;

    (async () => {
      const { data: prof } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", session.user.id)
        .maybeSingle();
      if (cancelled) return;
      const name = (prof?.full_name || session.user.email || "").toString();
      meRef.current = {
        id: session.user.id,
        token: firstNameToken(name),
        name,
      };
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

          let reason: "mention" | "reply" | null = null;

          const token = meRef.current.token;
          if (token) {
            const mentions = Array.from(String(m.body || "").matchAll(/@([a-zA-ZÀ-ÿ0-9_.-]+)/g))
              .map((x) => x[1].toLowerCase());
            if (mentions.includes(token)) reason = "mention";
          }

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

          if (typeof Notification !== "undefined" && Notification.permission === "granted" && document.visibilityState !== "visible") {
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
  }, [session?.user, navigate]);
};
