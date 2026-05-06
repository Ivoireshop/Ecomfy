import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Smartphone, Bell, Download, Check } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { requestNotificationPermission } from "@/hooks/useOrderNotifications";

type BIPEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

export function InstallAppCard() {
  const [deferredPrompt, setDeferredPrompt] = useState<BIPEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [notifPerm, setNotifPerm] = useState<NotificationPermission>(
    typeof Notification !== "undefined" ? Notification.permission : "default",
  );

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BIPEvent);
    };
    window.addEventListener("beforeinstallprompt", handler);
    window.addEventListener("appinstalled", () => setInstalled(true));
    // Detect if already in standalone mode (installed)
    if (window.matchMedia?.("(display-mode: standalone)").matches) setInstalled(true);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);

  const handleInstall = async () => {
    if (deferredPrompt) {
      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === "accepted") {
        toast({ title: "✓ Application installée" });
        setInstalled(true);
      }
      setDeferredPrompt(null);
    } else if (isIOS) {
      toast({
        title: "Installation sur iPhone",
        description: "Touchez le bouton Partager ⬆ puis « Sur l'écran d'accueil »",
      });
    } else {
      toast({
        title: "Installation",
        description: "Ouvrez le menu de votre navigateur et choisissez « Installer l'application » ou « Ajouter à l'écran d'accueil ».",
      });
    }
  };

  const enableNotifications = async () => {
    const p = await requestNotificationPermission();
    setNotifPerm(p);
    if (p === "granted") {
      toast({ title: "🔔 Notifications activées", description: "Vous recevrez une alerte à chaque nouvelle commande." });
      try { new Notification("VisualPro est prêt", { body: "Vous recevrez les notifications de nouvelles commandes ici.", icon: "/app-icon-512.png" }); } catch {}
    } else if (p === "denied") {
      toast({ title: "Notifications bloquées", description: "Activez-les dans les paramètres de votre navigateur.", variant: "destructive" });
    }
  };

  return (
    <Card className="p-5 space-y-4">
      <div className="flex items-start gap-3">
        <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
          <Smartphone className="h-5 w-5 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold">Installer VisualPro sur votre téléphone</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Ajoutez VisualPro à l'écran d'accueil de votre mobile pour recevoir les notifications de nouvelles commandes en temps réel.
          </p>
        </div>
      </div>

      <div className="grid sm:grid-cols-2 gap-3">
        <Button onClick={handleInstall} disabled={installed} className="gap-2 w-full">
          {installed ? <><Check className="h-4 w-4" /> Application installée</> : <><Download className="h-4 w-4" /> Installer l'application</>}
        </Button>
        <Button
          onClick={enableNotifications}
          variant={notifPerm === "granted" ? "secondary" : "outline"}
          disabled={notifPerm === "granted"}
          className="gap-2 w-full"
        >
          {notifPerm === "granted" ? <><Check className="h-4 w-4" /> Notifications activées</> : <><Bell className="h-4 w-4" /> Activer les notifications</>}
        </Button>
      </div>

      {isIOS && !installed && (
        <div className="text-xs text-muted-foreground bg-muted/40 rounded-md p-3">
          <strong>Sur iPhone :</strong> Ouvrez ce lien dans Safari, touchez le bouton Partager <span className="inline-block">⬆</span> puis « Sur l'écran d'accueil » pour installer l'application.
        </div>
      )}
    </Card>
  );
}