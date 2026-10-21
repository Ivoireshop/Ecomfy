import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Helmet } from "react-helmet";
import { supabase } from "@/integrations/supabase/client";
import { useAuthReady } from "@/hooks/useAuthReady";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Hash, Pin, Smile, Send, Reply, Trash2, MoreVertical, X, ShieldCheck, AtSign, ChevronUp, ChevronDown, Volume2, Square, Heart, SmilePlus } from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";
import EmojiPicker, { EmojiStyle, Theme } from "emoji-picker-react";
import { COMMUNITY_MAX_BODY, isConnectUsPayload, mentionName, splitMentions } from "@/lib/communityChat";

type Message = {
  id: string;
  user_id: string;
  body: string;
  is_pinned: boolean;
  reply_to_id: string | null;
  created_at: string;
};

type ProfileLite = { id: string; full_name: string | null; avatar_url: string | null; is_founder?: boolean };

type Reaction = {
  id: string;
  message_id: string;
  user_id: string;
  emoji: string;
};

const QUICK_REACTIONS = ["❤️", "👍", "😂", "🔥", "🎉", "👏"];

// Colonnes explicites : ne jamais tirer `select *` (les lignes ConnectUs de la table peuvent peser plusieurs Mo)
const MESSAGE_COLUMNS = "id,user_id,body,is_pinned,reply_to_id,created_at";

const Avatar = ({ p, size = 40 }: { p?: ProfileLite | null; size?: number }) => {
  const initials = (p?.full_name || "?").trim().split(/\s+/).map((s) => s[0]).slice(0, 2).join("").toUpperCase();
  const style = { width: size, height: size, fontSize: size * 0.4 } as const;
  return p?.avatar_url ? (
    <img src={p.avatar_url} alt="" style={style} className="rounded-full object-cover flex-shrink-0" />
  ) : (
    <div style={style} className="rounded-full bg-gradient-to-br from-primary to-secondary text-white font-semibold flex items-center justify-center flex-shrink-0">
      {initials}
    </div>
  );
};

const renderBody = (body: string) =>
  splitMentions(body).map((part, i) =>
    part.mention ? (
      <span key={i} className="text-primary font-medium bg-primary/10 px-1 rounded">{part.text}</span>
    ) : (
      <span key={i}>{part.text}</span>
    )
  );

const PAGE_SIZE = 50;

const Community = () => {
  const { session, isReady } = useAuthReady();
  const navigate = useNavigate();
  // L'objet `session.user` change à chaque rafraîchissement du jeton : on ne dépend que de l'identifiant
  const userId = session?.user?.id;
  const [messages, setMessages] = useState<Message[]>([]);
  const [pinned, setPinned] = useState<Message[]>([]);
  const [parents, setParents] = useState<Record<string, Message>>({});
  const [profiles, setProfiles] = useState<Record<string, ProfileLite>>({});
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [isFounder, setIsFounder] = useState(false);
  const [replyTo, setReplyTo] = useState<Message | null>(null);
  const [showPinned, setShowPinned] = useState(true);
  const [openedPinned, setOpenedPinned] = useState<Message | null>(null);
  const [showMentions, setShowMentions] = useState(false);
  const [mentionQuery, setMentionQuery] = useState("");
  const [mentionList, setMentionList] = useState<ProfileLite[]>([]);
  const [onlineCount, setOnlineCount] = useState(0);
  const [speakingId, setSpeakingId] = useState<string | null>(null);
  const [reactions, setReactions] = useState<Reaction[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const requestedProfiles = useRef<Set<string>>(new Set());
  const messagesRef = useRef<Message[]>([]);
  messagesRef.current = messages;

  useEffect(() => {
    if (isReady && !session) navigate("/auth", { replace: true });
  }, [isReady, session, navigate]);

  useEffect(() => {
    if (!userId) return;
    void (async () => {
      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId)
        // @ts-ignore
        .in("role", ["founder", "co_founder"]);
      setIsFounder((data || []).length > 0);
    })();
  }, [userId]);

  const loadProfiles = useCallback(async (ids: string[]) => {
    const need = Array.from(new Set(ids.filter((id) => id && !requestedProfiles.current.has(id))));
    if (!need.length) return;
    need.forEach((id) => requestedProfiles.current.add(id));
    const { data } = await supabase.rpc("get_community_profiles", { _ids: need });
    if (data) setProfiles((p) => ({ ...p, ...Object.fromEntries(data.map((d) => [d.id, d])) }));
    else need.forEach((id) => requestedProfiles.current.delete(id));
  }, []);

  const scrollToBottom = (smooth = true) => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: smooth ? "smooth" : "auto" });
  };

  const isNearBottom = () => {
    const el = scrollRef.current;
    return !el || el.scrollHeight - el.scrollTop - el.clientHeight < 160;
  };

  const loadReactionsFor = async (list: Message[]) => {
    if (!list.length) return;
    const { data: rx } = await supabase
      .from("community_message_reactions" as any)
      .select("id,message_id,user_id,emoji")
      .in("message_id", list.map((m) => m.id));
    const fetched = ((rx as any) || []) as Reaction[];
    setReactions((prev) => {
      const ids = new Set(list.map((m) => m.id));
      return [...prev.filter((r) => !ids.has(r.message_id)), ...fetched];
    });
  };

  // Aperçu des réponses : le message cité peut être plus ancien que la page chargée
  const loadParents = async (list: Message[]) => {
    const known = new Set([...list.map((m) => m.id), ...messagesRef.current.map((m) => m.id)]);
    const missing = Array.from(new Set(list.map((m) => m.reply_to_id).filter((id): id is string => !!id && !known.has(id))));
    if (!missing.length) return;
    const { data } = await supabase.from("community_messages").select(MESSAGE_COLUMNS).eq("kind", "chat").in("id", missing);
    const found = (data as Message[]) || [];
    if (!found.length) return;
    setParents((p) => ({ ...p, ...Object.fromEntries(found.map((m) => [m.id, m])) }));
    void loadProfiles(found.map((m) => m.user_id));
  };

  const loadMessages = async () => {
    setLoading(true);
    setLoadError(false);
    const { data, error } = await supabase
      .from("community_messages")
      .select(MESSAGE_COLUMNS)
      .eq("kind", "chat")
      .order("created_at", { ascending: false })
      .limit(PAGE_SIZE);
    if (error) {
      setLoadError(true);
      setLoading(false);
      return;
    }
    const list = ((data as Message[]) || []).slice().reverse();
    setMessages(list);
    setHasMore((data?.length || 0) === PAGE_SIZE);

    const { data: pins } = await supabase
      .from("community_messages")
      .select(MESSAGE_COLUMNS)
      .eq("kind", "chat")
      .eq("is_pinned", true)
      .order("created_at", { ascending: false })
      .limit(20);
    const pinList = (pins as Message[]) || [];
    setPinned(pinList);

    await Promise.all([
      loadProfiles([...list, ...pinList].map((m) => m.user_id)),
      loadReactionsFor(list),
      loadParents(list),
    ]);
    setLoading(false);
    setTimeout(() => scrollToBottom(false), 50);
  };

  const loadOlder = async () => {
    const oldest = messages[0];
    if (!oldest || loadingOlder) return;
    setLoadingOlder(true);
    const el = scrollRef.current;
    const prevHeight = el?.scrollHeight ?? 0;
    const prevTop = el?.scrollTop ?? 0;
    const { data, error } = await supabase
      .from("community_messages")
      .select(MESSAGE_COLUMNS)
      .eq("kind", "chat")
      .lt("created_at", oldest.created_at)
      .order("created_at", { ascending: false })
      .limit(PAGE_SIZE);
    if (error) {
      toast.error("Impossible de charger les messages précédents");
      setLoadingOlder(false);
      return;
    }
    const older = ((data as Message[]) || []).slice().reverse();
    setHasMore((data?.length || 0) === PAGE_SIZE);
    setMessages((prev) => {
      const ids = new Set(prev.map((m) => m.id));
      return [...older.filter((m) => !ids.has(m.id)), ...prev];
    });
    await Promise.all([loadProfiles(older.map((m) => m.user_id)), loadReactionsFor(older), loadParents(older)]);
    setLoadingOlder(false);
    // Garde la position de lecture : le contenu ajouté au-dessus ne doit pas faire sauter la liste
    requestAnimationFrame(() => {
      if (el) el.scrollTop = prevTop + (el.scrollHeight - prevHeight);
    });
  };

  const speakMessage = (m: Message) => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      toast.error("Lecture vocale non supportée sur ce navigateur");
      return;
    }
    const synth = window.speechSynthesis;
    if (speakingId === m.id) {
      synth.cancel();
      setSpeakingId(null);
      return;
    }
    synth.cancel();
    const cleaned = (m.body || "")
      .replace(/@([\p{L}0-9_.-]+)/gu, "$1")
      .replace(/\p{Extended_Pictographic}|️|‍/gu, "")
      .trim();
    if (!cleaned) return;
    const u = new SpeechSynthesisUtterance(cleaned);
    const voice = synth.getVoices().find((v) => v.lang?.toLowerCase().startsWith("fr"));
    if (voice) u.voice = voice;
    u.lang = voice?.lang || "fr-FR";
    u.rate = 1;
    u.pitch = 1;
    u.onend = () => setSpeakingId((id) => (id === m.id ? null : id));
    u.onerror = () => setSpeakingId((id) => (id === m.id ? null : id));
    setSpeakingId(m.id);
    synth.speak(u);
  };

  useEffect(() => {
    return () => {
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  useEffect(() => {
    if (!userId) return;
    void loadMessages();

    const channel = supabase
      .channel("community_messages_live", { config: { presence: { key: userId } } })
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "community_messages" },
        async (payload) => {
          const m = payload.new as Message;
          // Les blobs ConnectUs partagent la table : ce ne sont pas des messages du salon
          if (isConnectUsPayload(m.body)) return;
          const stick = m.user_id === userId || isNearBottom();
          setMessages((prev) => prev.some((x) => x.id === m.id) ? prev : [...prev, m]);
          void loadParents([m]);
          await loadProfiles([m.user_id]);
          if (stick) setTimeout(() => scrollToBottom(true), 50);
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "community_messages" },
        (payload) => {
          const m = payload.new as Message;
          if (isConnectUsPayload(m.body)) return;
          setMessages((prev) => prev.map((x) => x.id === m.id ? m : x));
          setPinned((prev) => {
            const rest = prev.filter((x) => x.id !== m.id);
            return m.is_pinned ? [m, ...rest] : rest;
          });
          if (m.is_pinned) void loadProfiles([m.user_id]);
        }
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "community_messages" },
        (payload) => {
          const id = (payload.old as Message).id;
          setMessages((prev) => prev.filter((x) => x.id !== id));
          setPinned((prev) => prev.filter((x) => x.id !== id));
          setReactions((prev) => prev.filter((r) => r.message_id !== id));
        }
      )
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState() as Record<string, unknown[]>;
        setOnlineCount(Object.keys(state).length);
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await channel.track({ user_id: userId, online_at: new Date().toISOString() });
        }
      });

    const reactionsChannel = supabase
      .channel("community_reactions_live")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "community_message_reactions" },
        (payload) => {
          const r = payload.new as Reaction;
          // Réaction sur un message non affiché : inutile de la garder en mémoire
          if (!messagesRef.current.some((m) => m.id === r.message_id)) return;
          setReactions((prev) => {
            if (prev.some((x) => x.id === r.id)) return prev;
            // L'événement temps réel peut arriver avant la réponse de l'insertion : il remplace la version optimiste
            const i = prev.findIndex(
              (x) => x.id.startsWith("tmp-") && x.message_id === r.message_id && x.user_id === r.user_id && x.emoji === r.emoji
            );
            if (i === -1) return [...prev, r];
            const next = prev.slice();
            next[i] = r;
            return next;
          });
        }
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "community_message_reactions" },
        (payload) => {
          const r = payload.old as Reaction;
          setReactions((prev) => prev.filter((x) => x.id !== r.id));
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
      void supabase.removeChannel(reactionsChannel);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  const pinnedMessages = pinned;

  const handleSend = async () => {
    const text = body.trim();
    if (!text || !userId || sending) return;
    setSending(true);
    const payload: { user_id: string; body: string; reply_to_id?: string } = { user_id: userId, body: text };
    if (replyTo) payload.reply_to_id = replyTo.id;
    const { data, error } = await supabase
      .from("community_messages")
      .insert(payload)
      .select(MESSAGE_COLUMNS)
      .single();
    setSending(false);
    if (error) { toast.error("Impossible d'envoyer"); return; }
    // Affichage immédiat, sans attendre le temps réel (dédoublonné par id)
    const sent = data as Message;
    setMessages((prev) => prev.some((x) => x.id === sent.id) ? prev : [...prev, sent]);
    void loadProfiles([sent.user_id]);
    setTimeout(() => scrollToBottom(true), 50);
    setBody("");
    setReplyTo(null);
    setShowMentions(false);
    textareaRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Pendant une composition (clavier IME/mobile), Entrée valide le mot et n'envoie pas le message
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      void handleSend();
    }
  };

  const updateMentionState = (value: string, cursor: number) => {
    const m = value.slice(0, cursor).match(/@([a-zA-ZÀ-ÖØ-öø-ÿ0-9_.-]*)$/);
    if (m) {
      setShowMentions(true);
      setMentionQuery(m[1].toLowerCase());
    } else {
      setShowMentions(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setBody(e.target.value);
    updateMentionState(e.target.value, e.target.selectionStart);
  };

  useEffect(() => {
    if (!showMentions) return;
    let cancelled = false;
    const t = setTimeout(async () => {
      const { data } = await supabase.rpc("search_community_profiles", { _query: mentionQuery || "", _limit: 6 });
      if (!cancelled) setMentionList((data as ProfileLite[]) || []);
    }, 150);
    return () => { cancelled = true; clearTimeout(t); };
  }, [showMentions, mentionQuery]);

  const insertMention = (p: ProfileLite) => {
    const name = mentionName(p.full_name);
    if (!name) return;
    const el = textareaRef.current;
    const cursor = el?.selectionStart ?? body.length;
    const before = body.slice(0, cursor).replace(/@([a-zA-ZÀ-ÖØ-öø-ÿ0-9_.-]*)$/, `@${name} `);
    setBody(before + body.slice(cursor));
    setShowMentions(false);
    setTimeout(() => {
      el?.focus();
      el?.setSelectionRange(before.length, before.length);
    }, 0);
  };

  const startMention = () => {
    const el = textareaRef.current;
    const cursor = el?.selectionStart ?? body.length;
    const prevChar = body.slice(0, cursor).slice(-1);
    const insert = prevChar && !/\s/.test(prevChar) ? " @" : "@";
    const pos = cursor + insert.length;
    setBody(body.slice(0, cursor) + insert + body.slice(cursor));
    setMentionQuery("");
    setShowMentions(true);
    setTimeout(() => {
      el?.focus();
      el?.setSelectionRange(pos, pos);
    }, 0);
  };

  const insertEmoji = (emoji: string) => {
    const el = textareaRef.current;
    const cursor = el?.selectionStart ?? body.length;
    setBody((b) => b.slice(0, cursor) + emoji + b.slice(cursor));
    setTimeout(() => {
      el?.focus();
      el?.setSelectionRange(cursor + emoji.length, cursor + emoji.length);
    }, 0);
  };

  const togglePin = async (m: Message) => {
    if (!isFounder) return;
    const { error } = await supabase
      .from("community_messages")
      .update({ is_pinned: !m.is_pinned })
      .eq("id", m.id);
    if (error) { toast.error("Impossible d'épingler"); return; }
    const updated = { ...m, is_pinned: !m.is_pinned };
    setMessages((prev) => prev.map((x) => x.id === m.id ? updated : x));
    setPinned((prev) => {
      const rest = prev.filter((x) => x.id !== m.id);
      return updated.is_pinned ? [updated, ...rest] : rest;
    });
    toast.success(m.is_pinned ? "Désépinglé" : "Épinglé");
  };

  const deleteMessage = async (m: Message) => {
    if (!confirm("Supprimer ce message ?")) return;
    const { error } = await supabase.from("community_messages").delete().eq("id", m.id);
    if (error) { toast.error("Impossible de supprimer"); return; }
    setMessages((prev) => prev.filter((x) => x.id !== m.id));
    setPinned((prev) => prev.filter((x) => x.id !== m.id));
    if (replyTo?.id === m.id) setReplyTo(null);
  };

  const findMessage = (id: string | null) =>
    id ? (messages.find((m) => m.id === id) || parents[id] || null) : null;

  const toggleReaction = async (messageId: string, emoji: string) => {
    if (!userId) return;
    const mine = reactions.find(
      (r) => r.message_id === messageId && r.user_id === userId && r.emoji === emoji
    );
    if (mine) {
      // Réaction encore en cours d'enregistrement : on attend sa version définitive
      if (mine.id.startsWith("tmp-")) return;
      setReactions((prev) => prev.filter((r) => r.id !== mine.id));
      const { error } = await supabase.from("community_message_reactions" as any).delete().eq("id", mine.id);
      if (error) {
        setReactions((prev) => prev.some((r) => r.id === mine.id) ? prev : [...prev, mine]);
        toast.error("Réaction impossible");
      }
    } else {
      const optimistic: Reaction = {
        id: `tmp-${Date.now()}-${Math.random()}`,
        message_id: messageId,
        user_id: userId,
        emoji,
      };
      setReactions((prev) => [...prev, optimistic]);
      const { data, error } = await supabase
        .from("community_message_reactions" as any)
        .insert({ message_id: messageId, user_id: userId, emoji })
        .select("id,message_id,user_id,emoji")
        .single();
      if (error) {
        setReactions((prev) => prev.filter((r) => r.id !== optimistic.id));
        if (!String(error.message || "").includes("duplicate")) toast.error("Réaction impossible");
      } else if (data) {
        const real = data as unknown as Reaction;
        // Le temps réel a pu déjà remplacer la version optimiste : jamais de doublon
        setReactions((prev) =>
          prev.some((r) => r.id === real.id)
            ? prev.filter((r) => r.id !== optimistic.id)
            : prev.map((r) => r.id === optimistic.id ? real : r)
        );
      }
    }
  };

  return (
    <>
      <Helmet>
        <title>Communauté Ecomfy — Salon Général</title>
        <meta name="description" content="Discutez en temps réel avec la communauté Ecomfy : posez vos questions, partagez vos idées, échangez avec d'autres entrepreneurs." />
      </Helmet>

      <div className="flex flex-col h-[calc(100dvh-4rem)] md:h-dvh bg-background">
        {/* Channel header */}
        <div className="border-b bg-card/50 backdrop-blur px-4 md:px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0">
            <Hash className="w-5 h-5 text-muted-foreground flex-shrink-0" />
            <h1 className="text-lg md:text-xl font-semibold truncate">Général</h1>
            <span className="hidden sm:inline text-sm text-muted-foreground border-l ml-2 pl-3">
              Discussion générale de la communauté
            </span>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground bg-muted/60 px-2 py-1 rounded-full" title={`${onlineCount} membre${onlineCount > 1 ? "s" : ""} en ligne`}>
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-75 animate-ping" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
              </span>
              <span className="font-medium tabular-nums">{onlineCount}</span>
              <span className="hidden sm:inline">en ligne</span>
            </div>
            {pinnedMessages.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowPinned((v) => !v)}
              className="gap-1.5"
            >
              <Pin className="w-4 h-4" />
              <span className="hidden sm:inline">{pinnedMessages.length} épinglé{pinnedMessages.length > 1 ? "s" : ""}</span>
              {showPinned ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </Button>
            )}
          </div>
        </div>

        {/* Pinned banner */}
        {showPinned && pinnedMessages.length > 0 && (
          <div className="border-b bg-amber-50/50 dark:bg-amber-950/20 px-3 md:px-4 py-1.5 space-y-1 max-h-28 overflow-y-auto">
            {pinnedMessages.map((m) => {
              const p = profiles[m.user_id];
              const firstLine = (m.body || "").split("\n")[0];
              return (
                <button
                  key={m.id}
                  onClick={() => setOpenedPinned(m)}
                  className="w-full flex items-center gap-2 text-xs rounded-md hover:bg-amber-100/60 dark:hover:bg-amber-900/30 px-2 py-1 text-left"
                  title="Cliquez pour lire le message épinglé"
                >
                  <Pin className="w-3 h-3 text-amber-600 flex-shrink-0" />
                  <span className="font-medium flex-shrink-0">{p?.full_name?.split(" ")[0] || "Membre"} :</span>
                  <span className="truncate text-muted-foreground">{firstLine}</span>
                </button>
              );
            })}
          </div>
        )}

        {/* Pinned message dialog */}
        <Dialog open={!!openedPinned} onOpenChange={(o) => !o && setOpenedPinned(null)}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Pin className="w-4 h-4 text-amber-600" />
                Message épinglé
              </DialogTitle>
            </DialogHeader>
            {openedPinned && (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Avatar p={profiles[openedPinned.user_id]} size={32} />
                  <div>
                    <div className="text-sm font-semibold">{profiles[openedPinned.user_id]?.full_name || "Membre"}</div>
                    <div className="text-[11px] text-muted-foreground">
                      {formatDistanceToNow(new Date(openedPinned.created_at), { addSuffix: true, locale: fr })}
                    </div>
                  </div>
                </div>
                <div className="text-sm whitespace-pre-wrap break-words leading-relaxed">
                  {renderBody(openedPinned.body)}
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Messages */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto px-2 md:px-4 py-4">
          {loading ? (
            <div className="text-center text-muted-foreground py-10">Chargement…</div>
          ) : loadError ? (
            <div className="text-center text-muted-foreground py-16 space-y-3">
              <p>Impossible de charger les messages.</p>
              <Button variant="outline" size="sm" onClick={() => void loadMessages()}>Réessayer</Button>
            </div>
          ) : messages.length === 0 ? (
            <div className="text-center text-muted-foreground py-16">
              <Hash className="w-10 h-10 mx-auto mb-2 opacity-40" />
              <p>Soyez le premier à lancer la conversation dans <strong>#Général</strong>.</p>
            </div>
          ) : (
            <div className="max-w-4xl mx-auto space-y-0.5">
              {hasMore && (
                <div className="text-center pb-2">
                  <Button variant="ghost" size="sm" onClick={() => void loadOlder()} disabled={loadingOlder}>
                    {loadingOlder ? "Chargement…" : "Messages précédents"}
                  </Button>
                </div>
              )}
              {messages.map((m, idx) => {
                const prev = messages[idx - 1];
                const p = profiles[m.user_id];
                const same =
                  prev && prev.user_id === m.user_id &&
                  new Date(m.created_at).getTime() - new Date(prev.created_at).getTime() < 5 * 60 * 1000 &&
                  !m.reply_to_id;
                const parent = findMessage(m.reply_to_id);
                const parentP = parent ? profiles[parent.user_id] : null;
                const isOwn = userId === m.user_id;
                const canDelete = isOwn || isFounder;

                const msgReactions = reactions.filter((r) => r.message_id === m.id);
                const grouped = msgReactions.reduce<Record<string, { count: number; mine: boolean }>>((acc, r) => {
                  const cur = acc[r.emoji] || { count: 0, mine: false };
                  cur.count += 1;
                  if (r.user_id === userId) cur.mine = true;
                  acc[r.emoji] = cur;
                  return acc;
                }, {});

                return (
                  <div
                    key={m.id}
                    className={`group relative flex gap-2 md:gap-3 px-2 md:px-3 py-1.5 rounded-md ${same ? "" : "mt-3"} ${m.is_pinned ? "border-l-2 border-amber-500" : ""} ${isOwn ? "bg-primary/5 hover:bg-primary/10" : "hover:bg-accent/40"}`}
                  >
                    <div className="w-8 md:w-10 flex-shrink-0">
                      {same ? (
                        <span className="opacity-0 group-hover:opacity-60 text-[10px] text-muted-foreground block text-right pr-1 pt-1">
                          {new Date(m.created_at).toLocaleTimeString("fr", { hour: "2-digit", minute: "2-digit" })}
                        </span>
                      ) : (
                        <Avatar p={p} size={32} />
                      )}
                    </div>
                    <div className="flex-1 min-w-0 overflow-hidden">
                      {parent && (
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-0.5 truncate">
                          <Reply className="w-3 h-3" />
                          <span className="font-medium">{parentP?.full_name || "Membre"}</span>
                          <span className="truncate opacity-80">{parent.body}</span>
                        </div>
                      )}
                      {!same && (
                        <div className="flex items-baseline gap-2 mb-0.5">
                          <span className="font-semibold text-[13px] md:text-sm truncate max-w-[140px] md:max-w-none">{p?.full_name || "Membre"}</span>
                          {p?.is_founder && (
                            <Badge className="text-[9px] gap-1 h-4"><ShieldCheck className="w-2.5 h-2.5" />Fondateur</Badge>
                          )}
                          <span className="text-[10px] md:text-[11px] text-muted-foreground">
                            {formatDistanceToNow(new Date(m.created_at), { addSuffix: true, locale: fr })}
                          </span>
                          {m.is_pinned && <Pin className="w-3 h-3 text-amber-600" />}
                        </div>
                      )}
                      <div className="text-[13px] md:text-sm whitespace-pre-wrap break-words leading-relaxed overflow-wrap-anywhere">
                        {renderBody(m.body)}
                      </div>
                      {/* Reactions */}
                      {Object.keys(grouped).length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1.5">
                          {Object.entries(grouped).map(([emoji, { count, mine }]) => (
                            <button
                              key={emoji}
                              onClick={() => toggleReaction(m.id, emoji)}
                              className={`inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[11px] transition-colors ${
                                mine ? "bg-primary/15 border-primary/40 text-primary" : "bg-muted/60 border-transparent hover:bg-muted"
                              }`}
                            >
                              <span>{emoji}</span>
                              <span className="tabular-nums">{count}</span>
                            </button>
                          ))}
                          <Popover>
                            <PopoverTrigger asChild>
                              <button className="inline-flex items-center rounded-full border border-dashed px-1.5 py-0.5 text-[11px] text-muted-foreground hover:bg-muted">
                                <SmilePlus className="w-3 h-3" />
                              </button>
                            </PopoverTrigger>
                            <PopoverContent side="top" align="start" className="p-1 w-auto">
                              <div className="flex gap-1">
                                {QUICK_REACTIONS.map((e) => (
                                  <button
                                    key={e}
                                    onClick={() => toggleReaction(m.id, e)}
                                    className="text-lg p-1 rounded hover:bg-accent"
                                  >
                                    {e}
                                  </button>
                                ))}
                              </div>
                            </PopoverContent>
                          </Popover>
                        </div>
                      )}
                    </div>
                    <div className="md:opacity-0 md:group-hover:opacity-100 transition-opacity flex items-start gap-0.5 md:gap-1 flex-shrink-0">
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button size="icon" variant="ghost" className="h-7 w-7" title="Réagir">
                            <Heart className="w-3.5 h-3.5" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent side="top" align="end" className="p-1 w-auto">
                          <div className="flex gap-1">
                            {QUICK_REACTIONS.map((e) => (
                              <button
                                key={e}
                                onClick={() => toggleReaction(m.id, e)}
                                className="text-lg p-1 rounded hover:bg-accent"
                              >
                                {e}
                              </button>
                            ))}
                          </div>
                        </PopoverContent>
                      </Popover>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7"
                        onClick={() => speakMessage(m)}
                        title={speakingId === m.id ? "Arrêter la lecture" : "Écouter le message"}
                      >
                        {speakingId === m.id ? <Square className="w-3.5 h-3.5 text-primary" /> : <Volume2 className="w-3.5 h-3.5" />}
                      </Button>
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => { setReplyTo(m); textareaRef.current?.focus(); }} title="Répondre">
                        <Reply className="w-3.5 h-3.5" />
                      </Button>
                      {(isFounder || canDelete) && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button size="icon" variant="ghost" className="h-7 w-7"><MoreVertical className="w-3.5 h-3.5" /></Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {isFounder && (
                              <DropdownMenuItem onClick={() => togglePin(m)}>
                                <Pin className="w-3.5 h-3.5 mr-2" />
                                {m.is_pinned ? "Désépingler" : "Épingler"}
                              </DropdownMenuItem>
                            )}
                            {canDelete && (
                              <DropdownMenuItem onClick={() => deleteMessage(m)} className="text-destructive">
                                <Trash2 className="w-3.5 h-3.5 mr-2" /> Supprimer
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Composer */}
        <div className="border-t bg-card/50 backdrop-blur p-3 md:p-4">
          <div className="max-w-4xl mx-auto">
            {replyTo && (
              <div className="flex items-center justify-between gap-2 text-xs bg-muted px-3 py-1.5 rounded-t-md border border-b-0">
                <div className="flex items-center gap-1.5 min-w-0">
                  <Reply className="w-3 h-3 text-primary" />
                  <span>Répondre à <strong>{profiles[replyTo.user_id]?.full_name || "Membre"}</strong></span>
                  <span className="text-muted-foreground truncate">— {replyTo.body}</span>
                </div>
                <Button size="icon" variant="ghost" className="h-5 w-5" onClick={() => setReplyTo(null)}>
                  <X className="w-3 h-3" />
                </Button>
              </div>
            )}
            <div className="relative">
              {showMentions && mentionList.length > 0 && (
                <div className="absolute bottom-full left-0 mb-2 w-72 bg-popover border rounded-md shadow-lg overflow-hidden z-20">
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground px-3 py-1.5 border-b bg-muted/50">
                    Mentionner un membre
                  </div>
                  {mentionList.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => insertMention(p)}
                      className="flex items-center gap-2 w-full px-3 py-1.5 text-sm hover:bg-accent text-left"
                    >
                      <Avatar p={p} size={24} />
                      <span className="truncate">{p.full_name}</span>
                    </button>
                  ))}
                </div>
              )}
              <div className={`flex items-end gap-2 bg-background border rounded-md p-2 ${replyTo ? "rounded-t-none" : ""}`}>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button size="icon" variant="ghost" className="h-8 w-8 flex-shrink-0"><Smile className="w-4 h-4" /></Button>
                  </PopoverTrigger>
                  <PopoverContent side="top" align="start" className="p-0 border-0 w-auto">
                    <EmojiPicker
                      onEmojiClick={(e) => insertEmoji(e.emoji)}
                      emojiStyle={EmojiStyle.NATIVE}
                      theme={Theme.AUTO}
                      width={320}
                      height={400}
                      lazyLoadEmojis
                      searchPlaceholder="Rechercher…"
                    />
                  </PopoverContent>
                </Popover>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8 flex-shrink-0"
                  onClick={startMention}
                  title="Mentionner"
                >
                  <AtSign className="w-4 h-4" />
                </Button>
                <Textarea
                  ref={textareaRef}
                  value={body}
                  onChange={handleChange}
                  onKeyDown={handleKeyDown}
                  placeholder="Message #Général · @ pour mentionner"
                  rows={1}
                  maxLength={COMMUNITY_MAX_BODY}
                  className="flex-1 min-h-[36px] max-h-32 resize-none border-0 focus-visible:ring-0 px-1 py-1.5 bg-transparent"
                />
                <Button
                  size="icon"
                  onClick={() => void handleSend()}
                  disabled={!body.trim() || sending}
                  className="h-8 w-8 flex-shrink-0"
                >
                  <Send className="w-4 h-4" />
                </Button>
              </div>
            </div>
            <p className="text-[10px] text-muted-foreground mt-1.5 px-1">
              @ Mentions · Entrée pour envoyer · Maj+Entrée pour saut de ligne
            </p>
          </div>
        </div>
      </div>
    </>
  );
};

export default Community;