import { useState, useEffect, useRef } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  MessageCircle, Send, Paperclip, Image as ImageIcon, X, CheckCheck,
  User, Search, ArrowLeft, ShieldCheck, Store
} from "lucide-react";
import { toast } from "@/hooks/use-toast";
import {
  ConnectUsConversation,
  ConnectUsPrivateMessage,
  ConnectUsProfile
} from "../types/connectus.types";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";

interface ConnectUsDirectMessagesProps {
  currentUserId: string;
  targetUser?: ConnectUsProfile | null;
  conversations?: ConnectUsConversation[];
  onSendMessage: (receiverId: string, content: string, mediaUrl?: string | null) => Promise<ConnectUsPrivateMessage | null>;
  onFetchMessages: (conversationId: string) => Promise<ConnectUsPrivateMessage[]>;
  onClose?: () => void;
}

export function ConnectUsDirectMessages({
  currentUserId,
  targetUser,
  conversations = [],
  onSendMessage,
  onFetchMessages,
  onClose,
}: ConnectUsDirectMessagesProps) {
  const [activeConv, setActiveConv] = useState<ConnectUsConversation | null>(null);
  const [messages, setMessages] = useState<ConnectUsPrivateMessage[]>([]);
  const [inputText, setInputText] = useState("");
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [imagePreviewModal, setImagePreviewModal] = useState<string | null>(null);
  const [zoomImage, setZoomImage] = useState<string | null>(null);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [searchConvQuery, setSearchConvQuery] = useState("");

  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Initialize or select conversation with targetUser or first conversation
  useEffect(() => {
    if (targetUser) {
      const convId = `conv_${[currentUserId, targetUser.id].sort().join("_")}`;
      const existing = conversations.find(c => c.id === convId);
      if (existing) {
        setActiveConv(existing);
      } else {
        const newConv: ConnectUsConversation = {
          id: convId,
          participant_ids: [currentUserId, targetUser.id],
          other_user: targetUser,
          last_message: "Démarrer une discussion",
          last_message_at: new Date().toISOString(),
          unread_count: 0,
        };
        setActiveConv(newConv);
      }
    } else if (conversations.length > 0 && !activeConv) {
      setActiveConv(conversations[0]);
    }
  }, [targetUser, conversations]);

  // Fetch messages when active conversation changes
  useEffect(() => {
    if (!activeConv) return;
    let isMounted = true;
    setLoadingMessages(true);
    onFetchMessages(activeConv.id).then((res) => {
      if (isMounted) {
        setMessages(res || []);
        setLoadingMessages(false);
        setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
      }
    });
    return () => {
      isMounted = false;
    };
  }, [activeConv, onFetchMessages]);

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      toast({
        title: "Fichier trop volumineux",
        description: "Veuillez sélectionner une image de moins de 10 Mo.",
        variant: "destructive",
      });
      return;
    }

    if (!file.type.startsWith("image/")) {
      toast({
        title: "Format non supporté",
        description: "Veuillez choisir une image au format JPG, PNG ou WebP.",
        variant: "destructive",
      });
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target?.result as string;
      setSelectedImage(base64);
      setImagePreviewModal(base64);
    };
    reader.readAsDataURL(file);
  };

  const handleSend = async () => {
    if (!activeConv) return;
    if (!inputText.trim() && !selectedImage) return;

    const receiverId = activeConv.other_user?.id || activeConv.other_user?.user_id;
    if (!receiverId) return;

    const textToSend = inputText.trim();
    const mediaToSend = selectedImage;

    setInputText("");
    setSelectedImage(null);
    setImagePreviewModal(null);

    const created = await onSendMessage(receiverId, textToSend || "📷 Image", mediaToSend);
    if (created) {
      setMessages(prev => [...prev, created]);
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
    }
  };

  const filteredConversations = conversations.filter(c => {
    if (!searchConvQuery.trim()) return true;
    const name = c.other_user?.full_name || "";
    const username = c.other_user?.username || "";
    return name.toLowerCase().includes(searchConvQuery.toLowerCase()) || username.toLowerCase().includes(searchConvQuery.toLowerCase());
  });

  return (
    <Card className="rounded-3xl border border-slate-200 bg-white overflow-hidden shadow-sm flex flex-col md:flex-row h-[620px]">
      {/* Hidden Image Input */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleImageSelect}
        accept="image/jpeg,image/png,image/webp,image/jpg"
        className="hidden"
      />

      {/* Left Conversations Sidebar */}
      <div className="w-full md:w-80 border-r border-slate-100 flex flex-col bg-slate-50/50">
        <div className="p-4 border-b border-slate-100 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-space font-bold text-base text-slate-900 flex items-center gap-2">
              <MessageCircle className="h-5 w-5 text-[#0E7C66]" /> Messagerie Privée
            </h3>
            {onClose && (
              <Button size="sm" variant="ghost" onClick={onClose} className="h-8 w-8 p-0 rounded-full">
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>

          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
            <Input
              type="text"
              placeholder="Rechercher une discussion..."
              value={searchConvQuery}
              onChange={(e) => setSearchConvQuery(e.target.value)}
              className="pl-8 text-xs h-9 rounded-xl bg-white border-slate-200"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {filteredConversations.length > 0 ? (
            filteredConversations.map((conv) => {
              const isActive = activeConv?.id === conv.id;
              const u = conv.other_user;
              return (
                <button
                  key={conv.id}
                  onClick={() => setActiveConv(conv)}
                  className={`w-full text-left p-3 rounded-2xl transition-all flex items-center gap-3 ${
                    isActive ? "bg-white shadow-xs border border-emerald-200" : "hover:bg-white/60"
                  }`}
                >
                  <div className="relative shrink-0">
                    {u?.avatar_url ? (
                      <img src={u.avatar_url} alt="" className="h-10 w-10 rounded-xl object-cover" />
                    ) : (
                      <div className="h-10 w-10 rounded-xl bg-[#0E7C66] text-white flex items-center justify-center font-bold text-xs">
                        {(u?.full_name || "M")[0]}
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-xs text-slate-900 truncate">{u?.full_name}</span>
                      {conv.unread_count && conv.unread_count > 0 ? (
                        <Badge className="bg-[#0E7C66] text-white text-[9px] px-1.5 py-0">{conv.unread_count}</Badge>
                      ) : null}
                    </div>
                    <p className="text-[11px] text-slate-500 truncate mt-0.5">{conv.last_message}</p>
                  </div>
                </button>
              );
            })
          ) : (
            <div className="p-6 text-center text-xs text-slate-400">
              Aucune conversation trouvée.
            </div>
          )}
        </div>
      </div>

      {/* Right Chat View */}
      {activeConv ? (
        <div className="flex-1 flex flex-col bg-white">
          {/* Chat Header */}
          <div className="p-3.5 border-b border-slate-100 flex items-center justify-between bg-white z-10">
            <div className="flex items-center gap-3">
              {activeConv.other_user?.avatar_url ? (
                <img src={activeConv.other_user.avatar_url} alt="" className="h-10 w-10 rounded-xl object-cover border border-slate-100" />
              ) : (
                <div className="h-10 w-10 rounded-xl bg-[#0E7C66] text-white flex items-center justify-center font-bold text-xs">
                  {(activeConv.other_user?.full_name || "M")[0]}
                </div>
              )}
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="font-bold text-sm text-slate-900">{activeConv.other_user?.full_name}</span>
                  {activeConv.other_user?.is_verified && (
                    <ShieldCheck className="h-4 w-4 text-[#0E7C66]" />
                  )}
                </div>
                <p className="text-[10px] text-emerald-600 font-bold">● Abonné mutuel • En ligne</p>
              </div>
            </div>
          </div>

          {/* Messages Feed */}
          <div className="flex-1 p-4 overflow-y-auto space-y-3 bg-[#F8FAFC]">
            {loadingMessages ? (
              <div className="text-center py-10 text-xs text-slate-400">Chargement de la discussion...</div>
            ) : messages.length > 0 ? (
              messages.map((m) => {
                const isMe = m.sender_id === currentUserId;
                let timeStr = "À l'instant";
                try {
                  if (m.created_at) {
                    timeStr = formatDistanceToNow(new Date(m.created_at), { addSuffix: true, locale: fr });
                  }
                } catch (e) {}

                return (
                  <div key={m.id} className={`flex ${isMe ? "justify-end" : "justify-start"}`}>
                    <div
                      className={`max-w-[75%] p-3.5 rounded-2xl text-xs space-y-1.5 shadow-2xs ${
                        isMe
                          ? "bg-[#0E7C66] text-white rounded-br-none"
                          : "bg-white text-slate-900 border border-slate-200/80 rounded-bl-none"
                      }`}
                    >
                      {/* Attached High-Quality Image */}
                      {m.media_url && (
                        <div
                          onClick={() => setZoomImage(m.media_url!)}
                          className="rounded-xl overflow-hidden cursor-pointer hover:opacity-95 transition-opacity max-h-60 bg-black/10 border border-black/10"
                        >
                          <img src={m.media_url} alt="" className="w-full h-full object-cover max-h-60" />
                        </div>
                      )}

                      {m.content && m.content !== "📷 Image" && (
                        <p className="leading-relaxed whitespace-pre-line">{m.content}</p>
                      )}

                      <div className={`flex items-center justify-end gap-1 text-[9px] ${isMe ? "text-emerald-100" : "text-slate-400"}`}>
                        <span>{timeStr}</span>
                        {isMe && <CheckCheck className="h-3 w-3" />}
                      </div>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="text-center py-16 space-y-2">
                <MessageCircle className="h-10 w-10 text-slate-300 mx-auto" />
                <p className="text-xs font-bold text-slate-700">Aucun message pour le moment</p>
                <p className="text-[11px] text-slate-400">Envoyez un message ou une photo pour démarrer l'échange.</p>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Image Preview Overlay Modal before Sending */}
          {imagePreviewModal && (
            <div className="p-3 bg-emerald-50 border-t border-emerald-200 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <img src={imagePreviewModal} alt="" className="h-12 w-12 rounded-lg object-cover border border-emerald-300 shrink-0" />
                <div className="min-w-0 text-xs">
                  <p className="font-bold text-emerald-900 truncate">Image sélectionnée (Haute Qualité)</p>
                  <p className="text-[10px] text-emerald-700">Prête à être envoyée dans la discussion.</p>
                </div>
              </div>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setSelectedImage(null);
                  setImagePreviewModal(null);
                }}
                className="h-8 w-8 p-0 rounded-full text-rose-600 hover:bg-rose-100"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          )}

          {/* Chat Input Bar */}
          <div className="p-3 border-t border-slate-100 bg-white flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              className="h-10 w-10 p-0 rounded-full border-slate-200 text-slate-600 hover:bg-slate-100 shrink-0"
              title="Joindre une photo HD"
            >
              <ImageIcon className="h-4 w-4 text-[#0E7C66]" />
            </Button>

            <Input
              type="text"
              placeholder="Écrire un message privé..."
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSend()}
              className="h-10 text-xs rounded-full bg-slate-100 border-transparent focus:bg-white focus:border-slate-300 flex-1"
            />

            <Button
              type="button"
              onClick={handleSend}
              disabled={!inputText.trim() && !selectedImage}
              className="h-10 px-4 rounded-full bg-[#0E7C66] hover:bg-[#0A6352] text-white font-bold text-xs gap-1.5 shrink-0"
            >
              <span>Envoyer</span>
              <Send className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center p-8 text-center bg-slate-50/50">
          <div className="max-w-sm space-y-3">
            <MessageCircle className="h-12 w-12 text-[#0E7C66] mx-auto opacity-40" />
            <h4 className="font-bold text-sm text-slate-900">Vos conversations privées</h4>
            <p className="text-xs text-slate-500">
              Sélectionnez une discussion à gauche ou visitez le profil d'un membre suivi mutuellement pour démarrer un échange.
            </p>
          </div>
        </div>
      )}

      {/* Fullscreen Image Zoom Viewer */}
      {zoomImage && (
        <div
          onClick={() => setZoomImage(null)}
          className="fixed inset-0 z-50 bg-black/90 backdrop-blur-xs flex items-center justify-center p-4"
        >
          <div className="relative max-w-4xl max-h-[90vh]">
            <img src={zoomImage} alt="" className="max-w-full max-h-[90vh] object-contain rounded-2xl" />
            <button
              onClick={() => setZoomImage(null)}
              className="absolute -top-4 -right-4 bg-white text-slate-900 p-2 rounded-full shadow-lg"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>
      )}
    </Card>
  );
}
