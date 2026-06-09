import { useEffect, useMemo, useRef, useState } from "react";
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
import { Hash, Pin, Smile, Send, Reply, Trash2, MoreVertical, X, ShieldCheck, AtSign, ChevronUp, ChevronDown, Volume2, Square, Circle } from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";
import EmojiPicker, { EmojiStyle, Theme } from "emoji-picker-react";

type Message = {
  id: string;
  user_id: string;
  body: string;
  is_pinned: boolean;
  reply_to_id: string | null;
  created_at: string;
};

type ProfileLite = { id: string; full_name: string | null; avatar_url: string | null };

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

const renderBody = (body: string) => {
  // Highlight @mentions
  const parts = body.split(/(@[\p{L}0-9_.-]+)/gu);
  return parts.map((p, i) =>
    p.startsWith("@") ? (
      <span key={i} className="text-primary font-medium bg-primary/10 px-1 rounded">{p}</span>
    ) : (
      <span key={i}>{p}</span>
    )
  );
};

const PAGE_SIZE = 50;

const Community = () => {
  const { session, isReady } = useAuthReady();
  const navigate = useNavigate();
  const [messages, setMessages] = useState<Message[]>([]);
  const [profiles, setProfiles] = useState<Record<string, ProfileLite>>({});
  const [loading, setLoading] = useState(true);
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
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (isReady && !session) navigate("/auth", { replace: true });
  }, [isReady, session, navigate]);

  useEffect(() => {
    if (!session?.user) return;
    void (async () => {
      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", session.user.id)
        // @ts-ignore
        .in("role", ["founder", "co_founder"]);
      setIsFounder((data || []).length > 0);
    })();
  }, [session?.user]);

  const loadProfiles = async (ids: string[]) => {
    const need = Array.from(new Set(ids.filter((id) => id && !profiles[id])));
    if (!need.length) return;
    const { data } = await supabase.from("profiles").select("id, full_name, avatar_url").in("id", need);
    if (data) setProfiles((p) => ({ ...p, ...Object.fromEntries(data.map((d: any) => [d.id, d])) }));
  };

  const scrollToBottom = (smooth = true) => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: smooth ? "smooth" : "auto" });
  };

  const loadMessages = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("community_messages")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(PAGE_SIZE);
    const list = ((data as Message[]) || []).slice().reverse();
    setMessages(list);
    await loadProfiles(list.map((m) => m.user_id));
    setLoading(false);
    setTimeout(() => scrollToBottom(false), 50);
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
      .replace(/([\u2700-\u27BF]|[\uE000-\uF8FF]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|\uD83E[\uDD00-\uDDFF])/g, "")
      .trim();
    if (!cleaned) return;
    const u = new SpeechSynthesisUtterance(cleaned);
    const voices = synth.getVoices();
    const fr = voices.find((v) => /fr(-|_)?/i.test(v.lang)) || voices.find((v) => v.lang?.toLowerCase().startsWith("fr"));
    if (fr) u.voice = fr;
    u.lang = fr?.lang || "fr-FR";
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
    if (!session?.user) return;
    void loadMessages();

    const channel = supabase
      .channel("community_messages_live", { config: { presence: { key: session.user.id } } })
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "community_messages" },
        async (payload) => {
          const m = payload.new as Message;
          setMessages((prev) => prev.some((x) => x.id === m.id) ? prev : [...prev, m]);
          await loadProfiles([m.user_id]);
          setTimeout(() => scrollToBottom(true), 50);
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "community_messages" },
        (payload) => {
          const m = payload.new as Message;
          setMessages((prev) => prev.map((x) => x.id === m.id ? m : x));
        }
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "community_messages" },
        (payload) => {
          const id = (payload.old as Message).id;
          setMessages((prev) => prev.filter((x) => x.id !== id));
        }
      )
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState() as Record<string, unknown[]>;
        setOnlineCount(Object.keys(state).length);
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await channel.track({ user_id: session.user.id, online_at: new Date().toISOString() });
        }
      });

    return () => { void supabase.removeChannel(channel); };
  }, [session?.user]);

  const pinnedMessages = useMemo(() => messages.filter((m) => m.is_pinned), [messages]);

  const handleSend = async () => {
    const text = body.trim();
    if (!text || !session?.user || sending) return;
    setSending(true);
    const payload: any = { user_id: session.user.id, body: text };
    if (replyTo) payload.reply_to_id = replyTo.id;
    const { error } = await supabase.from("community_messages").insert(payload);
    setSending(false);
    if (error) { toast.error("Impossible d'envoyer"); return; }
    setBody("");
    setReplyTo(null);
    setShowMentions(false);
    textareaRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void handleSend();
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const v = e.target.value;
    setBody(v);
    const cursor = e.target.selectionStart;
    const before = v.slice(0, cursor);
    const m = before.match(/@([\p{L}0-9_.-]*)$/u);
    if (m) {
      setShowMentions(true);
      setMentionQuery(m[1].toLowerCase());
    } else {
      setShowMentions(false);
    }
  };

  useEffect(() => {
    if (!showMentions) return;
    const t = setTimeout(async () => {
      let q = supabase.from("profiles").select("id, full_name, avatar_url").not("full_name", "is", null).limit(6);
      if (mentionQuery) q = q.ilike("full_name", `%${mentionQuery}%`);
      const { data } = await q;
      setMentionList((data as ProfileLite[]) || []);
    }, 150);
    return () => clearTimeout(t);
  }, [showMentions, mentionQuery]);

  const insertMention = (p: ProfileLite) => {
    const name = (p.full_name || "").split(/\s+/)[0].replace(/[^\p{L}0-9_.-]/gu, "");
    setBody((b) => b.replace(/@([\p{L}0-9_.-]*)$/u, `@${name} `));
    setShowMentions(false);
    textareaRef.current?.focus();
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
    if (error) toast.error("Impossible d'épingler");
    else toast.success(m.is_pinned ? "Désépinglé" : "Épinglé");
  };

  const deleteMessage = async (m: Message) => {
    if (!confirm("Supprimer ce message ?")) return;
    const { error } = await supabase.from("community_messages").delete().eq("id", m.id);
    if (error) toast.error("Impossible de supprimer");
  };

  const findMessage = (id: string | null) => id ? messages.find((m) => m.id === id) : null;

  return (
    <>
      <Helmet>
        <title>Communauté VisualPro — Salon Général</title>
        <meta name="description" content="Discutez en temps réel avec la communauté VisualPro : posez vos questions, partagez vos idées, échangez avec d'autres entrepreneurs." />
      </Helmet>

      <div className="flex flex-col h-[calc(100vh-64px)] bg-background">
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
          ) : messages.length === 0 ? (
            <div className="text-center text-muted-foreground py-16">
              <Hash className="w-10 h-10 mx-auto mb-2 opacity-40" />
              <p>Soyez le premier à lancer la conversation dans <strong>#Général</strong>.</p>
            </div>
          ) : (
            <div className="max-w-4xl mx-auto space-y-0.5">
              {messages.map((m, idx) => {
                const prev = messages[idx - 1];
                const p = profiles[m.user_id];
                const same =
                  prev && prev.user_id === m.user_id &&
                  new Date(m.created_at).getTime() - new Date(prev.created_at).getTime() < 5 * 60 * 1000 &&
                  !m.reply_to_id;
                const parent = findMessage(m.reply_to_id);
                const parentP = parent ? profiles[parent.user_id] : null;
                const isOwn = session?.user?.id === m.user_id;
                const canDelete = isOwn || isFounder;

                return (
                  <div
                    key={m.id}
                    className={`group flex gap-3 px-3 py-1.5 rounded-md ${same ? "" : "mt-3"} ${m.is_pinned ? "border-l-2 border-amber-500" : ""} ${isOwn ? "bg-primary/5 hover:bg-primary/10" : "hover:bg-accent/40"}`}
                  >
                    <div className="w-10 flex-shrink-0">
                      {same ? (
                        <span className="opacity-0 group-hover:opacity-60 text-[10px] text-muted-foreground block text-right pr-1 pt-1">
                          {new Date(m.created_at).toLocaleTimeString("fr", { hour: "2-digit", minute: "2-digit" })}
                        </span>
                      ) : (
                        <Avatar p={p} size={40} />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      {parent && (
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-0.5 truncate">
                          <Reply className="w-3 h-3" />
                          <span className="font-medium">{parentP?.full_name || "Membre"}</span>
                          <span className="truncate opacity-80">{parent.body}</span>
                        </div>
                      )}
                      {!same && (
                        <div className="flex items-baseline gap-2 mb-0.5">
                          <span className="font-semibold text-sm">{p?.full_name || "Membre"}</span>
                          {isFounder && m.user_id === session?.user?.id && (
                            <Badge className="text-[9px] gap-1 h-4"><ShieldCheck className="w-2.5 h-2.5" />Fondateur</Badge>
                          )}
                          <span className="text-[11px] text-muted-foreground">
                            {formatDistanceToNow(new Date(m.created_at), { addSuffix: true, locale: fr })}
                          </span>
                          {m.is_pinned && <Pin className="w-3 h-3 text-amber-600" />}
                        </div>
                      )}
                      <div className="text-sm whitespace-pre-wrap break-words leading-relaxed">
                        {renderBody(m.body)}
                      </div>
                    </div>
                    <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-start gap-1">
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
                  onClick={() => { setBody((b) => b + "@"); textareaRef.current?.focus(); }}
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