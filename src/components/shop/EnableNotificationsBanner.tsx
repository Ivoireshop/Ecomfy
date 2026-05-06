import { useEffect, useState } from "react";
import { Bell, X, Loader2 } from "lucide-react";
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
  const [dismissed, setDismissed] = useState(false);
  const [busy, setBusy] = useState(false);
  const { status, register } = useFCM();

  useEffect(() => {
    setDismissed(sessionStorage.getItem("notif-banner-dismissed") === "1");
  }, []);

  // Hide once permission granted AND token registered
  if (typeof window === "undefined") return null;
  if (!("Notification" in window)) return null;
  if (perm === "granted" && status === "registered") return null;
  if (dismissed) return null;

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
        toast({ title: "Erreur", description: "Impossible d'enregistrer le token. Réessayez.", variant: "destructive" });
      }
    } finally {
      setBusy(false);
    }
  };

  const handleDismiss = () => {
    sessionStorage.setItem("notif-banner-dismissed", "1");
    setDismissed(true);
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
      <Button onClick={handleDismiss} size="icon" variant="ghost" className="shrink-0">
        <X className="h-4 w-4" />
      </Button>
    </Card>
  );
}