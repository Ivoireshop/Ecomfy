import { useState } from "react";
import { Bell, Loader2 } from "lucide-react";
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
  const { status, register } = useFCM();

  // Banner stays visible until a token is actually registered server-side.
  // (We intentionally no longer honour a dismiss flag — too many users hid it
  // and then never received notifications.)
  if (typeof window === "undefined") return null;
  if (!("Notification" in window)) return null;
  if (status === "registered") return null;

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
    <Card className="p-4 mb-4 border-primary/30 bg-primary/5 flex items-center gap-3">
      <div className="h-10 w-10 shrink-0 rounded-full bg-primary/15 flex items-center justify-center">
        <Bell className="h-5 w-5 text-primary" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-sm">Activez les notifications de commandes</p>
        <p className="text-xs text-muted-foreground">
          Recevez une alerte instantanée sur votre téléphone à chaque nouvelle commande.
        </p>
      </div>
      <Button onClick={handleEnable} size="sm" disabled={busy} className="gap-2 shrink-0">
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Bell className="h-4 w-4" />}
        Activer
      </Button>
    </Card>
  );
}