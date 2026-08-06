import { useState } from "react";
import { MessageCircle, Send, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export function SupportButton() {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async (type: "suggestion" | "question") => {
    if (!message.trim()) {
      toast({
        title: "Message requis",
        description: "Veuillez saisir votre message",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Non authentifié");

      // Get user profile
      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name, country")
        .eq("id", user.id)
        .single();

      // Submit as feedback with a special comment format
      const prefix = type === "suggestion" ? "[SUGGESTION]" : "[QUESTION]";
      const { error } = await supabase.from("feedback").insert({
        user_id: user.id,
        rating: 0, // Special rating for support messages
        comment: `${prefix} ${message.trim()}`,
        full_name: profile?.full_name || "Utilisateur",
        country: profile?.country || "Non spécifié",
        status: "pending",
      });

      if (error) throw error;

      toast({
        title: "Message envoyé",
        description: type === "suggestion" 
          ? "Merci pour votre suggestion !" 
          : "Nous vous répondrons bientôt.",
      });

      setMessage("");
      setOpen(false);
    } catch (error) {
      console.error("Erreur envoi message:", error);
      toast({
        title: "Erreur",
        description: "Impossible d'envoyer votre message",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          size="lg"
          className="fixed bottom-6 right-6 h-14 w-14 rounded-full shadow-lg hover:shadow-xl z-50 p-0"
        >
          <MessageCircle className="h-6 w-6" />
          <span className="sr-only">Support client</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageCircle className="h-5 w-5" />
            Support Client
          </DialogTitle>
          <DialogDescription>
            Posez une question ou partagez une suggestion
          </DialogDescription>
        </DialogHeader>
        
        <Tabs defaultValue="question" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="question">Question</TabsTrigger>
            <TabsTrigger value="suggestion">Suggestion</TabsTrigger>
          </TabsList>
          
          <TabsContent value="question" className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="question">Votre question</Label>
              <Textarea
                id="question"
                placeholder="Comment puis-je..."
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={6}
                className="resize-none"
              />
              <p className="text-xs text-muted-foreground">
                Notre équipe vous répondra dans les plus brefs délais
              </p>
            </div>
            <Button
              onClick={() => handleSubmit("question")}
              disabled={isLoading || !message.trim()}
              className="w-full"
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Envoi...
                </>
              ) : (
                <>
                  <Send className="mr-2 h-4 w-4" />
                  Envoyer la question
                </>
              )}
            </Button>
          </TabsContent>
          
          <TabsContent value="suggestion" className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="suggestion">Votre suggestion</Label>
              <Textarea
                id="suggestion"
                placeholder="Il serait bien d'ajouter..."
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={6}
                className="resize-none"
              />
              <p className="text-xs text-muted-foreground">
                Vos suggestions nous aident à améliorer Ecomfy
              </p>
            </div>
            <Button
              onClick={() => handleSubmit("suggestion")}
              disabled={isLoading || !message.trim()}
              className="w-full"
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Envoi...
                </>
              ) : (
                <>
                  <Send className="mr-2 h-4 w-4" />
                  Envoyer la suggestion
                </>
              )}
            </Button>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
