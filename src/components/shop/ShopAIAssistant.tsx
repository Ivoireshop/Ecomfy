import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Mic, MicOff, Send, Sparkles, X, Volume2, VolumeX, Loader2, MessageCircle } from "lucide-react";

interface Props {
  shopId: string;
  shopName: string;
  primaryColor?: string;
  secondaryColor?: string;
}

interface Msg { role: "user" | "assistant"; content: string }

const LANG_LABELS: Record<string, { greet: string; flag: string }> = {
  fr: { greet: "Bonjour 👋", flag: "🇫🇷" },
  en: { greet: "Hello 👋", flag: "🇬🇧" },
  es: { greet: "Hola 👋", flag: "🇪🇸" },
  pt: { greet: "Olá 👋", flag: "🇵🇹" },
  ar: { greet: "مرحبا 👋", flag: "🇸🇦" },
  dioula: { greet: "I ni sɔgɔma", flag: "🇨🇮" },
  baoule: { greet: "Akwaba", flag: "🇨🇮" },
};

interface AssistantConfig {
  id: string;
  enabled: boolean;
  name: string;
  personality: string;
  source_mode: string;
  greeting_languages: string[];
  conversation_language: string;
  voice_id: string;
  auto_open: boolean;
  custom_greeting: string | null;
  welcome_bubble: string | null;
  voice_enabled: boolean;
}

export function ShopAIAssistant({ shopId, shopName, primaryColor = "#2563eb", secondaryColor = "#7c3aed" }: Props) {
  const [config, setConfig] = useState<AssistantConfig | null>(null);
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [listening, setListening] = useState(false);
  const [voiceMode, setVoiceMode] = useState(true);
  const [muted, setMuted] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const recognitionRef = useRef<any>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const hasGreetedRef = useRef(false);
  const autoGreetedRef = useRef(false);

  // Load config
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("shop_ai_assistants")
        .select("*")
        .eq("shop_id", shopId)
        .maybeSingle();
      if (cancelled) return;
      if (data && data.enabled) {
        setConfig(data as AssistantConfig);
      }
    })();
    return () => { cancelled = true; };
  }, [shopId]);

  // Auto voice greeting on arrival (no text UI shown).
  // Browsers block autoplay until a user gesture: we attach a one-shot
  // listener so the first tap/scroll triggers the greeting silently.
  useEffect(() => {
    if (!config || autoGreetedRef.current) return;
    if (!config.voice_enabled || muted) return;

    const trigger = async () => {
      if (autoGreetedRef.current) return;
      autoGreetedRef.current = true;
      const custom = config.custom_greeting?.trim();
      const spoken = custom ||
        `Bonjour et bienvenue sur ${shopName}. Je suis ${config.name}, votre assistante personnelle. Découvrez nos produits, et n'hésitez pas à me poser une question.`;
      await speak(spoken);
    };

    // Try immediate autoplay (works on desktop / sometimes mobile)
    const t = setTimeout(() => { void trigger(); }, 800);

    const onGesture = () => { void trigger(); };
    window.addEventListener("pointerdown", onGesture, { once: true });
    window.addEventListener("scroll", onGesture, { once: true, passive: true });
    window.addEventListener("keydown", onGesture, { once: true });

    return () => {
      clearTimeout(t);
      window.removeEventListener("pointerdown", onGesture);
      window.removeEventListener("scroll", onGesture);
      window.removeEventListener("keydown", onGesture);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config, muted, shopName]);

  // Scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // First greeting when opened
  useEffect(() => {
    if (!open || !config || hasGreetedRef.current) return;
    hasGreetedRef.current = true;
    const langs = (config.greeting_languages || []).filter((l) => LANG_LABELS[l]);
    const greetingHead = langs.length
      ? langs.map((l) => `${LANG_LABELS[l].flag} ${LANG_LABELS[l].greet}`).join(" · ")
      : "Bonjour 👋";
    const custom = config.custom_greeting?.trim();
    const greet = custom
      ? `${greetingHead}\n\n${custom}`
      : `${greetingHead}\n\nJe suis ${config.name}, l'assistante de **${shopName}**. Comment puis-je vous aider à choisir le produit qui vous correspond ?`;
    setMessages([{ role: "assistant", content: greet }]);
  }, [open, config]);

  const stopAudio = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = "";
    }
    setSpeaking(false);
  };

  const speak = async (text: string) => {
    if (!config || muted) return;
    try {
      stopAudio();
      setSpeaking(true);
      const { data, error } = await supabase.functions.invoke("shop-ai-assistant-tts", {
        body: { text, voiceId: config.voice_id, shopId },
      });
      if (error || !data?.audioBase64 || data?.error) {
        setSpeaking(false);
        return;
      }
      const audio = new Audio(`data:${data.mime || "audio/mpeg"};base64,${data.audioBase64}`);
      audioRef.current = audio;
      audio.onended = () => setSpeaking(false);
      audio.onerror = () => setSpeaking(false);
      await audio.play().catch(() => setSpeaking(false));
    } catch {
      setSpeaking(false);
    }
  };

  const sendMessage = async (text: string) => {
    if (!text.trim() || loading || !config) return;
    const newMsgs: Msg[] = [...messages, { role: "user", content: text }];
    setMessages(newMsgs);
    setInput("");
    setLoading(true);
    stopAudio();

    try {
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/shop-ai-assistant-chat`;
      const resp = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          shopId,
          messages: newMsgs.map((m) => ({ role: m.role, content: m.content })),
        }),
      });

      if (resp.status === 429) {
        setMessages([...newMsgs, { role: "assistant", content: "Beaucoup de monde en ce moment, réessayez dans un instant 🙏" }]);
        setLoading(false);
        return;
      }
      if (resp.status === 402) {
        setMessages([...newMsgs, { role: "assistant", content: "L'assistant est temporairement indisponible. Contactez-nous directement." }]);
        setLoading(false);
        return;
      }
      if (!resp.ok || !resp.body) throw new Error("stream failed");

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      let full = "";
      setMessages([...newMsgs, { role: "assistant", content: "" }]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        let nl: number;
        while ((nl = buf.indexOf("\n")) !== -1) {
          let line = buf.slice(0, nl);
          buf = buf.slice(nl + 1);
          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (line.startsWith(":") || !line.trim()) continue;
          if (!line.startsWith("data: ")) continue;
          const json = line.slice(6).trim();
          if (json === "[DONE]") continue;
          try {
            const parsed = JSON.parse(json);
            const delta = parsed.choices?.[0]?.delta?.content;
            if (delta) {
              full += delta;
              setMessages((prev) => {
                const next = [...prev];
                next[next.length - 1] = { role: "assistant", content: full };
                return next;
              });
            }
          } catch {
            buf = line + "\n" + buf;
            break;
          }
        }
      }

      if (voiceMode && full) await speak(full);
    } catch (err) {
      console.error(err);
      setMessages([...newMsgs, { role: "assistant", content: "Désolé, problème technique. Réessayez ?" }]);
    } finally {
      setLoading(false);
    }
  };

  const startListening = () => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) {
      alert("Votre navigateur ne supporte pas la reconnaissance vocale. Utilisez Chrome ou Safari.");
      return;
    }
    stopAudio();
    const recog = new SR();
    recog.lang = config?.conversation_language && config.conversation_language !== "auto"
      ? ({ fr: "fr-FR", en: "en-US", es: "es-ES", pt: "pt-PT", ar: "ar-SA" }[config.conversation_language] || "fr-FR")
      : "fr-FR";
    recog.interimResults = false;
    recog.maxAlternatives = 1;
    recog.continuous = false;
    recognitionRef.current = recog;
    setListening(true);
    recog.onresult = (e: any) => {
      const transcript = e.results[0][0].transcript;
      setListening(false);
      if (transcript) void sendMessage(transcript);
    };
    recog.onerror = () => setListening(false);
    recog.onend = () => setListening(false);
    recog.start();
  };

  const stopListening = () => {
    recognitionRef.current?.stop?.();
    setListening(false);
  };

  if (!config) return null;

  const gradient = `linear-gradient(135deg, ${primaryColor}, ${secondaryColor})`;

  return (
    <>
      {/* Small voice/mic floating button — no text bubble, mobile-friendly */}
      {!open && (
        <div className="fixed bottom-5 right-5 z-[60]">
          <button
            onClick={() => setOpen(true)}
            className="relative h-12 w-12 rounded-full shadow-xl flex items-center justify-center text-white transition-transform hover:scale-105 active:scale-95"
            style={{ background: gradient }}
            aria-label={speaking ? "Assistant en train de parler" : "Parler à l'assistant"}
          >
            {speaking && (
              <span className="absolute inset-0 rounded-full animate-ping opacity-40" style={{ background: gradient }} />
            )}
            <Mic className="h-5 w-5 relative" />
          </button>
        </div>
      )}

      {/* Chat panel */}
      {open && (
        <Card className="fixed bottom-4 right-4 left-4 sm:left-auto sm:right-5 sm:bottom-5 z-[60] w-auto sm:w-[400px] h-[78vh] sm:h-[620px] max-h-[85vh] shadow-2xl flex flex-col overflow-hidden border-0 rounded-3xl">
          {/* Header */}
          <div className="p-4 text-white relative" style={{ background: gradient }}>
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="h-12 w-12 rounded-full bg-white/20 backdrop-blur flex items-center justify-center">
                  <Sparkles className="h-6 w-6" />
                </div>
                {speaking && <span className="absolute inset-0 rounded-full ring-2 ring-white animate-pulse" />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-bold text-lg leading-tight">{config.name}</div>
                <div className="text-xs opacity-90 flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-green-400 animate-pulse" />
                  {speaking ? "Parle..." : listening ? "Vous écoute..." : "En ligne"}
                </div>
              </div>
              <button
                onClick={() => setMuted((m) => { if (!m) stopAudio(); return !m; })}
                className="h-9 w-9 rounded-full bg-white/15 hover:bg-white/25 flex items-center justify-center transition"
                title={muted ? "Activer le son" : "Couper le son"}
              >
                {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
              </button>
              <button
                onClick={() => { setOpen(false); stopAudio(); stopListening(); }}
                className="h-9 w-9 rounded-full bg-white/15 hover:bg-white/25 flex items-center justify-center transition"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Mode toggle */}
          {config.voice_enabled && (
            <div className="px-3 pt-3 flex gap-1.5 bg-gray-50">
              <button
                onClick={() => setVoiceMode(true)}
                className={`flex-1 text-xs font-semibold py-1.5 rounded-full transition ${voiceMode ? "bg-gray-900 text-white" : "bg-white text-gray-600 border border-gray-200"}`}
              >
                🎙️ Vocal
              </button>
              <button
                onClick={() => setVoiceMode(false)}
                className={`flex-1 text-xs font-semibold py-1.5 rounded-full transition ${!voiceMode ? "bg-gray-900 text-white" : "bg-white text-gray-600 border border-gray-200"}`}
              >
                💬 Texte
              </button>
            </div>
          )}

          {/* Messages */}
          <ScrollArea className="flex-1 bg-gray-50">
            <div className="p-4 space-y-3">
              {messages.map((m, i) => (
                <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div
                    className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm whitespace-pre-wrap leading-relaxed shadow-sm ${
                      m.role === "user"
                        ? "text-white rounded-br-sm"
                        : "bg-white text-gray-900 border border-gray-100 rounded-bl-sm"
                    }`}
                    style={m.role === "user" ? { background: gradient } : undefined}
                  >
                    {m.content || (loading && i === messages.length - 1 ? <Loader2 className="h-4 w-4 animate-spin" /> : "")}
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>
          </ScrollArea>

          {/* Input */}
          <div className="p-3 border-t bg-white">
            <form onSubmit={(e) => { e.preventDefault(); sendMessage(input); }} className="flex items-center gap-2">
              {config.voice_enabled && voiceMode && (
                <button
                  type="button"
                  onClick={listening ? stopListening : startListening}
                  className={`h-11 w-11 rounded-full flex items-center justify-center text-white transition shadow-md flex-shrink-0 ${listening ? "animate-pulse" : ""}`}
                  style={{ background: listening ? "#dc2626" : gradient }}
                  title={listening ? "Arrêter" : "Parler"}
                >
                  {listening ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
                </button>
              )}
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={listening ? "Écoute..." : `Écrire à ${config.name}...`}
                disabled={loading || listening}
                className="flex-1 h-11 rounded-full border-gray-200 px-4"
              />
              <Button
                type="submit"
                size="icon"
                disabled={loading || !input.trim()}
                className="h-11 w-11 rounded-full flex-shrink-0"
                style={{ background: gradient }}
              >
                <Send className="h-4 w-4" />
              </Button>
            </form>
            <p className="text-[10px] text-center text-gray-400 mt-2">
              <MessageCircle className="h-2.5 w-2.5 inline mr-1" />
              Assistant IA — Propulsé par Ecomfy
            </p>
          </div>
        </Card>
      )}
    </>
  );
}

export default ShopAIAssistant;