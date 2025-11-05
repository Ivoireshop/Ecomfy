import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MessageCircle, X, Send, Loader2, Bot, User } from "lucide-react";
import { toast } from "sonner";

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface ShowcaseAIChatProps {
  siteContext: {
    businessName: string;
    businessDescription?: string;
    ownerName: string;
    whatsappNumber: string;
    phoneNumber: string;
    aboutDescription?: string;
    features?: Array<{ title: string; description: string }>;
    formationTitle?: string;
    formationDescription?: string;
    formationPrice?: string;
  };
  theme?: {
    primaryColor?: string;
    secondaryColor?: string;
  };
}

export function ShowcaseAIChat({ siteContext, theme }: ShowcaseAIChatProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content: `Bonjour ! Je suis l'assistant virtuel de ${siteContext.businessName}. Comment puis-je vous aider aujourd'hui ?`,
    },
  ]);
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const streamChat = async (userMessage: string) => {
    const newMessages = [...messages, { role: "user" as const, content: userMessage }];
    setMessages(newMessages);
    setInputValue("");
    setIsLoading(true);

    try {
      const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/showcase-chat`;
      
      const resp = await fetch(CHAT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          messages: newMessages,
          siteContext,
        }),
      });

      if (!resp.ok || !resp.body) {
        throw new Error("Erreur lors de la communication avec l'assistant");
      }

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let textBuffer = "";
      let assistantMessage = "";

      setMessages([...newMessages, { role: "assistant", content: "" }]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        textBuffer += decoder.decode(value, { stream: true });

        let newlineIndex: number;
        while ((newlineIndex = textBuffer.indexOf("\n")) !== -1) {
          let line = textBuffer.slice(0, newlineIndex);
          textBuffer = textBuffer.slice(newlineIndex + 1);

          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (line.startsWith(":") || line.trim() === "") continue;
          if (!line.startsWith("data: ")) continue;

          const jsonStr = line.slice(6).trim();
          if (jsonStr === "[DONE]") break;

          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) {
              assistantMessage += content;
              setMessages([...newMessages, { role: "assistant", content: assistantMessage }]);
            }
          } catch {
            textBuffer = line + "\n" + textBuffer;
            break;
          }
        }
      }
    } catch (error) {
      console.error("Chat error:", error);
      toast.error("Erreur lors de la communication avec l'assistant");
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "Désolé, je rencontre un problème technique. Veuillez contacter directement notre équipe.",
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim() || isLoading) return;
    streamChat(inputValue.trim());
  };

  return (
    <>
      {/* Chat Button */}
      {!isOpen && (
        <Button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-6 right-6 h-14 w-14 rounded-full shadow-2xl z-50"
          size="icon"
          style={{
            backgroundColor: theme?.primaryColor || "#2563eb",
          }}
        >
          <MessageCircle className="h-6 w-6" />
        </Button>
      )}

      {/* Chat Window */}
      {isOpen && (
        <Card className="fixed bottom-6 right-6 w-96 h-[600px] shadow-2xl z-50 flex flex-col">
          <CardHeader className="border-b flex flex-row items-center justify-between py-4">
            <div className="flex items-center gap-2">
              <div
                className="h-10 w-10 rounded-full flex items-center justify-center"
                style={{ backgroundColor: `${theme?.primaryColor || "#2563eb"}20` }}
              >
                <Bot className="h-5 w-5" style={{ color: theme?.primaryColor || "#2563eb" }} />
              </div>
              <div>
                <CardTitle className="text-lg">Assistant IA</CardTitle>
                <p className="text-xs text-muted-foreground">{siteContext.businessName}</p>
              </div>
            </div>
            <Button variant="ghost" size="icon" onClick={() => setIsOpen(false)}>
              <X className="h-4 w-4" />
            </Button>
          </CardHeader>

          <CardContent className="flex-1 p-0 overflow-hidden">
            <ScrollArea className="h-full p-4" ref={scrollAreaRef}>
              <div className="space-y-4">
                {messages.map((msg, idx) => (
                  <div key={idx} className={`flex gap-2 ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                    {msg.role === "assistant" && (
                      <div
                        className="h-8 w-8 rounded-full flex items-center justify-center flex-shrink-0"
                        style={{ backgroundColor: `${theme?.primaryColor || "#2563eb"}20` }}
                      >
                        <Bot className="h-4 w-4" style={{ color: theme?.primaryColor || "#2563eb" }} />
                      </div>
                    )}
                    <div
                      className={`rounded-lg px-4 py-2 max-w-[80%] ${
                        msg.role === "user"
                          ? "text-white"
                          : "bg-muted"
                      }`}
                      style={
                        msg.role === "user"
                          ? { backgroundColor: theme?.primaryColor || "#2563eb" }
                          : undefined
                      }
                    >
                      <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                    </div>
                    {msg.role === "user" && (
                      <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
                        <User className="h-4 w-4" />
                      </div>
                    )}
                  </div>
                ))}
                {isLoading && (
                  <div className="flex gap-2 justify-start">
                    <div
                      className="h-8 w-8 rounded-full flex items-center justify-center"
                      style={{ backgroundColor: `${theme?.primaryColor || "#2563eb"}20` }}
                    >
                      <Bot className="h-4 w-4" style={{ color: theme?.primaryColor || "#2563eb" }} />
                    </div>
                    <div className="rounded-lg px-4 py-2 bg-muted">
                      <Loader2 className="h-4 w-4 animate-spin" />
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>
            </ScrollArea>
          </CardContent>

          <div className="p-4 border-t">
            <form onSubmit={handleSubmit} className="flex gap-2">
              <Input
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder="Posez votre question..."
                disabled={isLoading}
              />
              <Button
                type="submit"
                size="icon"
                disabled={isLoading || !inputValue.trim()}
                style={{ backgroundColor: theme?.primaryColor || "#2563eb" }}
              >
                <Send className="h-4 w-4" />
              </Button>
            </form>
          </div>
        </Card>
      )}
    </>
  );
}
