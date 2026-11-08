import { useState, useEffect, useRef, useCallback } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "./CUButton";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { MessageCircle, Send, Image as ImageIcon, X, CheckCheck, Search, ArrowLeft, ShieldCheck, Loader2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { ConnectUsConversation, ConnectUsPrivateMessage, ConnectUsProfile } from "../types/connectus.types";
import { ConnectUsService } from "../services/connectus.service";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";

interface ConnectUsDirectMessagesProps {
  currentUserId: string;
  targetUser?: ConnectUsProfile | null;
  onSendMessage: (receiverId: string, content: string, mediaFile?: File | null) => Promise<ConnectUsPrivateMessage | null>;
  onUnreadChange?: (count: number) => void;
  onOpenProfile?: (userId: string) => void;
}

const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

const ago = (iso?: string) => {
  if (!iso) return "";
  const t = new Date(iso).getTime();
  return Number.isNaN(t) ? "" : formatDistanceToNow(new Date(t), { addSuffix: true, locale: fr });
};

export function ConnectUsDirectMessages({ currentUserId, targetUser, onSendMessage, onUnreadChange, onOpenProfile }: ConnectUsDirectMessagesProps) {
  const [conversations, setConversations] = useState<ConnectUsConversation[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [activeConv, setActiveConv] = useState<ConnectUsConversation | null>(null);
  const [messages, setMessages] = useState<ConnectUsPrivateMessage[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [inputText, setInputText] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [zoomImage, setZoomImage] = useState<string | null>(null);
  const [searchConvQuery, setSearchConvQuery] = useState("");
  const [sending, setSending] = useState(false);
  const [mobileChatOpen, setMobileChatOpen] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const activeIdRef = useRef<string | null>(null);
  activeIdRef.current = activeConv?.id ?? null;

  const scrollToEnd = () => setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }), 80);

  const reportUnread = useCallback(
    (list: ConnectUsConversation[]) => onUnreadChange?.(list.reduce((n, c) => n + (c.unread_count || 0), 0)),
    [onUnreadChange]
  );

  const loadConversations = useCallback(async () => {
    try {
      const list = await ConnectUsService.getConversations(currentUserId);
      setConversations(list);
      reportUnread(list);
    } catch {
      toast({ title: "Conversations indisponibles", description: "Rechargez la page dans un instant.", variant: "destructive" });
    } finally {
      setLoadingList(false);
    }
  }, [currentUserId, reportUnread]);

  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  // Ouverture d'une conversation depuis un profil ou la recherche
  useEffect(() => {
    if (!targetUser) return;
    const id = ConnectUsService.conversationId(currentUserId, targetUser.id);
    setActiveConv(
      conversations.find((c) => c.id === id) || {
        id,
        participant_ids: [currentUserId, targetUser.id],
        other_user: targetUser,
        last_message: "",
        unread_count: 0,
      }
    );
    setMobileChatOpen(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetUser?.id, currentUserId]);

  // Messages de la conversation ouverte + marquage « lu »
  useEffect(() => {
    if (!activeConv) return;
    let alive = true;
    setLoadingMessages(true);
    ConnectUsService.getMessages(activeConv.id)
      .then(async (res) => {
        if (!alive) return;
        setMessages(res);
        setLoadingMessages(false);
        scrollToEnd();
        if (res.some((m) => m.receiver_id === currentUserId && m.status !== "read")) {
          await ConnectUsService.markConversationRead(activeConv.id);
          if (alive) loadConversations();
        }
      })
      .catch(() => {
        if (alive) {
          setMessages([]);
          setLoadingMessages(false);
          toast({ title: "Messages indisponibles", variant: "destructive" });
        }
      });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeConv?.id]);

  // Temps réel : nouveaux messages reçus
  useEffect(() => {
    return ConnectUsService.subscribeToMessages(currentUserId, (msg) => {
      if (msg.conversation_id === activeIdRef.current) {
        setMessages((prev) => (prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]));
        ConnectUsService.markConversationRead(msg.conversation_id).then(loadConversations);
        scrollToEnd();
      } else {
        loadConversations();
      }
    });
  }, [currentUserId, loadConversations]);

  useEffect(() => {
    return () => {
      if (imagePreview) URL.revokeObjectURL(imagePreview);
    };
  }, [imagePreview]);

  const clearImage = () => {
    setImageFile(null);
    setImagePreview(null);
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast({ title: "Format non supporté", description: "Choisissez une image JPG, PNG ou WebP.", variant: "destructive" });
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      toast({ title: "Fichier trop volumineux", description: "L'image doit faire moins de 10 Mo.", variant: "destructive" });
      return;
    }
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  };

  const handleSend = async () => {
    if (!activeConv || sending) return;
    if (!inputText.trim() && !imageFile) return;
    const receiverId = activeConv.other_user.id;
    const text = inputText.trim();
    const file = imageFile;

    setSending(true);
    const created = await onSendMessage(receiverId, text, file);
    setSending(false);
    if (!created) return;

    setInputText("");
    clearImage();
    setMessages((prev) => [...prev, created]);
    scrollToEnd();
    loadConversations();
  };

  const filtered = conversations.filter((c) => {
    const q = searchConvQuery.trim().toLowerCase();
    if (!q) return true;
    return (c.other_user.full_name || "").toLowerCase().includes(q) || c.other_user.username.toLowerCase().includes(q);
  });

  const selectConversation = (c: ConnectUsConversation) => {
    setActiveConv(c);
    setMobileChatOpen(true);
  };

  const other = activeConv?.other_user;

  return (
    <Card className="rounded-3xl border border-slate-200 bg-white overflow-hidden shadow-sm flex h-[calc(100vh-11rem)] min-h-[460px] max-h-[680px]">
      <input type="file" ref={fileInputRef} onChange={handleImageSelect} accept="image/jpeg,image/png,image/webp" className="hidden" />

      {/* Liste des conversations */}
      <div className={`${mobileChatOpen ? "hidden md:flex" : "flex"} w-full md:w-80 shrink-0 border-r border-slate-100 flex-col bg-slate-50/50`}>
        <div className="p-4 border-b border-slate-100 space-y-3">
          <h2 className="font-space font-bold text-base text-slate-900 flex items-center gap-2">
            <MessageCircle className="h-5 w-5 text-[#0E7C66]" /> Messages
          </h2>
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
            <Input type="search" placeholder="Rechercher une discussion…" value={searchConvQuery} onChange={(e) => setSearchConvQuery(e.target.value)} className="pl-8 text-xs h-9 rounded-xl bg-white border-slate-200" />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {loadingList ? (
            <div className="p-6 text-center text-xs text-slate-400">Chargement…</div>
          ) : filtered.length > 0 ? (
            filtered.map((conv) => {
              const u = conv.other_user;
              const isActive = activeConv?.id === conv.id;
              return (
                <button
                  key={conv.id}
                  type="button"
                  onClick={() => selectConversation(conv)}
                  className={`w-full text-left p-3 rounded-2xl transition-all flex items-center gap-3 ${isActive ? "bg-white shadow-xs border border-emerald-200" : "hover:bg-white/70"}`}
                >
                  {u.avatar_url ? (
                    <img src={u.avatar_url} alt="" className="h-10 w-10 rounded-xl object-cover shrink-0" />
                  ) : (
                    <div className="h-10 w-10 rounded-xl bg-[#0E7C66] text-white flex items-center justify-center font-bold text-xs shrink-0">{(u.full_name || "M")[0]?.toUpperCase()}</div>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-bold text-xs text-slate-900 truncate">{u.full_name}</span>
                      {conv.unread_count ? <Badge className="bg-[#0E7C66] text-white text-[9px] px-1.5 py-0">{conv.unread_count}</Badge> : null}
                    </div>
                    <p className={`text-[11px] truncate mt-0.5 ${conv.unread_count ? "text-slate-900 font-semibold" : "text-slate-500"}`}>{conv.last_message}</p>
                  </div>
                </button>
              );
            })
          ) : (
            <div className="p-6 text-center text-xs text-slate-500 space-y-1">
              <p className="font-bold text-slate-700">Aucune conversation</p>
              <p>Cherchez un membre en haut de la page puis cliquez sur « Message ».</p>
            </div>
          )}
        </div>
      </div>

      {/* Conversation ouverte */}
      {activeConv && other ? (
        <div className={`${mobileChatOpen ? "flex" : "hidden md:flex"} flex-1 min-w-0 flex-col bg-white`}>
          <div className="p-3 border-b border-slate-100 flex items-center gap-3">
            <Button type="button" variant="ghost" size="sm" onClick={() => setMobileChatOpen(false)} aria-label="Retour aux conversations" className="md:hidden h-9 w-9 p-0 rounded-full">
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <button type="button" onClick={() => onOpenProfile?.(other.id)} className="flex items-center gap-3 min-w-0 text-left">
              {other.avatar_url ? (
                <img src={other.avatar_url} alt="" className="h-10 w-10 rounded-xl object-cover border border-slate-100" />
              ) : (
                <div className="h-10 w-10 rounded-xl bg-[#0E7C66] text-white flex items-center justify-center font-bold text-xs">{(other.full_name || "M")[0]?.toUpperCase()}</div>
              )}
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="font-bold text-sm text-slate-900 truncate">{other.full_name}</span>
                  {other.is_verified && <ShieldCheck className="h-4 w-4 text-[#0E7C66]" />}
                </div>
                <p className="text-[11px] text-slate-500">@{other.username}</p>
              </div>
            </button>
          </div>

          <div className="flex-1 p-4 overflow-y-auto space-y-3 bg-[#F8FAFC]">
            {loadingMessages ? (
              <div className="text-center py-10 text-xs text-slate-400">Chargement de la discussion…</div>
            ) : messages.length > 0 ? (
              messages.map((m) => {
                const isMe = m.sender_id === currentUserId;
                const showText = m.content && !(m.media_url && (m.content === "📷 Photo" || m.content === "📷 Image"));
                return (
                  <div key={m.id} className={`flex ${isMe ? "justify-end" : "justify-start"}`}>
                    <div className={`max-w-[80%] p-3 rounded-2xl text-xs space-y-1.5 ${isMe ? "bg-[#0E7C66] text-white rounded-br-none" : "bg-white text-slate-900 border border-slate-200/80 rounded-bl-none"}`}>
                      {m.media_url && (
                        <button type="button" onClick={() => setZoomImage(m.media_url)} className="block rounded-xl overflow-hidden max-h-60 bg-black/10" aria-label="Agrandir la photo">
                          <img src={m.media_url} alt="" className="w-full object-cover max-h-60" />
                        </button>
                      )}
                      {showText && <p className="leading-relaxed whitespace-pre-line break-words">{m.content}</p>}
                      <div className={`flex items-center justify-end gap-1 text-[9px] ${isMe ? "text-emerald-100" : "text-slate-400"}`}>
                        <span>{ago(m.created_at)}</span>
                        {isMe && <CheckCheck className={`h-3 w-3 ${m.status === "read" ? "text-sky-300" : ""}`} aria-label={m.status === "read" ? "Lu" : "Envoyé"} />}
                      </div>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="text-center py-16 space-y-2">
                <MessageCircle className="h-10 w-10 text-slate-300 mx-auto" />
                <p className="text-xs font-bold text-slate-700">Aucun message pour le moment</p>
                <p className="text-[11px] text-slate-500">Envoyez un message ou une photo pour démarrer l'échange.</p>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {imagePreview && (
            <div className="p-3 bg-emerald-50 border-t border-emerald-200 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <img src={imagePreview} alt="" className="h-12 w-12 rounded-lg object-cover border border-emerald-300 shrink-0" />
                <p className="text-xs font-bold text-emerald-900 truncate">{imageFile?.name}</p>
              </div>
              <Button size="sm" variant="ghost" onClick={clearImage} aria-label="Retirer la photo" className="h-8 w-8 p-0 rounded-full text-rose-600 hover:bg-rose-100">
                <X className="h-4 w-4" />
              </Button>
            </div>
          )}

          <div className="p-3 border-t border-slate-100 bg-white flex items-center gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} aria-label="Joindre une photo" className="h-10 w-10 p-0 rounded-full border-slate-200 shrink-0">
              <ImageIcon className="h-4 w-4 text-[#0E7C66]" />
            </Button>
            <Input
              type="text"
              placeholder="Écrire un message…"
              value={inputText}
              maxLength={4000}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSend()}
              className="h-10 text-xs rounded-full bg-slate-100 border-transparent focus:bg-white focus:border-slate-300 flex-1"
            />
            <Button type="button" onClick={handleSend} disabled={(!inputText.trim() && !imageFile) || sending} className="h-10 px-4 rounded-full bg-[#0E7C66] hover:bg-[#0A6352] text-white font-bold text-xs gap-1.5 shrink-0">
              {sending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
              <span className="hidden sm:inline">Envoyer</span>
            </Button>
          </div>
        </div>
      ) : (
        <div className="hidden md:flex flex-1 items-center justify-center p-8 text-center bg-slate-50/50">
          <div className="max-w-sm space-y-3">
            <MessageCircle className="h-12 w-12 text-[#0E7C66] mx-auto opacity-40" />
            <h3 className="font-bold text-sm text-slate-900">Vos conversations privées</h3>
            <p className="text-xs text-slate-500">Sélectionnez une discussion, ou ouvrez le profil d'un membre et cliquez sur « Message ».</p>
          </div>
        </div>
      )}

      {zoomImage && (
        <div role="dialog" aria-label="Photo agrandie" onClick={() => setZoomImage(null)} className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4">
          <button type="button" onClick={() => setZoomImage(null)} aria-label="Fermer" className="absolute top-4 right-4 bg-white text-slate-900 p-2 rounded-full shadow-lg">
            <X className="h-5 w-5" />
          </button>
          <img src={zoomImage} alt="" className="max-w-full max-h-[90vh] object-contain rounded-2xl" />
        </div>
      )}
    </Card>
  );
}
