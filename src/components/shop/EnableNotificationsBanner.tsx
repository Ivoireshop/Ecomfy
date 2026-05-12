import { useState } from "react";
import { Bell, Loader2, Volume2, VolumeX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { toast } from "@/hooks/use-toast";
import { useFCM } from "@/hooks/useFCM";
import { requestNotificationPermission } from "@/hooks/useOrderNotifications";

/**
 * Persistent banner that prompts the seller to enable push notifications.
 * Shown until permission is granted AND an FCM token is registered.
 * Required because iOS/Android only register a push token after an explicit
 * user gesture — auto-registration on mount alone is not enough.
 */
export function EnableNotificationsBanner() {
  const [perm, setPerm] = useState<NotificationPermission>(
    typeof Notification !== "undefined" ? Notification.permission : "default",
  );
  const [busy, setBusy] = useState(false);
  const [voiceOn, setVoiceOn] = useState<boolean>(
    typeof window !== "undefined" ? localStorage.getItem("vp_voice_notify") !== "off" : true,
  );
  const { status, register } = useFCM();

  // Banner stays visible until a token is actually registered server-side.
  // (We intentionally no longer honour a dismiss flag — too many users hid it
  // and then never received notifications.)
  if (typeof window === "undefined") return null;
  if (!("Notification" in window)) return null;
  if (status === "registered") {
    // Once notifications are set up, expose only the voice toggle.
    return (
      <Card className="p-3 mb-4 flex items-center gap-2.5">
        <div className="h-8 w-8 shrink-0 rounded-full bg-primary/10 flex items-center justify-center">
          {voiceOn ? <Volume2 className="h-4 w-4 text-primary" /> : <VolumeX className="h-4 w-4 text-muted-foreground" />}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-xs sm:text-sm leading-tight">Annonce vocale des commandes</p>
          <p className="text-[11px] sm:text-xs text-muted-foreground leading-snug">
            Une voix annoncera "Vous avez une nouvelle commande" à chaque commande.
          </p>
        </div>
        <Button
          size="sm"
          variant={voiceOn ? "default" : "outline"}
          onClick={() => {
            const next = !voiceOn;
            setVoiceOn(next);
            localStorage.setItem("vp_voice_notify", next ? "on" : "off");
            if (next && "speechSynthesis" in window) {
              try {
                const u = new SpeechSynthesisUtterance("Annonce vocale activée");
                u.lang = "fr-FR";
                window.speechSynthesis.speak(u);
              } catch {}
            }
            toast({ title: next ? "🔊 Voix activée" : "🔇 Voix désactivée" });
          }}
          className="h-8 px-3 text-xs gap-1.5 shrink-0"
        >
          {voiceOn ? "Désactiver" : "Activer la voix"}
        </Button>
      </Card>
    );
  }

  const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);
  const isStandalone =
    window.matchMedia?.("(display-mode: standalone)").matches ||
    (window.navigator as any).standalone === true;

  const handleEnable = async () => {
    setBusy(true);
    try {
      if (isIOS && !isStandalone) {
        toast({
          title: "Installation requise",
          description: "Sur iPhone, ajoutez d'abord VisualPro à l'écran d'accueil via Safari (bouton Partager → Sur l'écran d'accueil), puis réessayez depuis l'app.",
        });
        return;
      }
      const p = await requestNotificationPermission();
      setPerm(p);
      if (p !== "granted") {
        toast({
          title: "Notifications refusées",
          description: "Activez-les dans les paramètres du navigateur pour recevoir les commandes.",
          variant: "destructive",
        });
        return;
      }
      const token = await register();
      if (token) {
        toast({ title: "🔔 Notifications activées", description: "Vous recevrez une alerte à chaque nouvelle commande, même app fermée." });
        try { new Notification("VisualPro", { body: "Notifications activées avec succès." }); } catch {}
      } else {
        toast({
          title: "Échec de l'enregistrement",
          description: "Token non créé. Réinstallez l'app depuis l'écran d'accueil ou réessayez.",
          variant: "destructive",
        });
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="p-3 mb-4 border-primary/30 bg-primary/5 flex items-center gap-2.5">
      <div className="h-8 w-8 shrink-0 rounded-full bg-primary/15 flex items-center justify-center">
        <Bell className="h-4 w-4 text-primary" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-xs sm:text-sm leading-tight">Activez les notifications</p>
        <p className="text-[11px] sm:text-xs text-muted-foreground leading-snug">
          Alerte instantanée à chaque commande.
        </p>
      </div>
      <Button onClick={handleEnable} size="sm" disabled={busy} className="h-8 px-3 text-xs gap-1.5 shrink-0">
        {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Bell className="h-3.5 w-3.5" />}
        Activer
      </Button>
    </Card>
  );
}