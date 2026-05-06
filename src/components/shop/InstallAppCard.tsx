import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Smartphone, Bell, Download, Check, HelpCircle, Share, Plus, Settings } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "@/hooks/use-toast";
import { requestNotificationPermission } from "@/hooks/useOrderNotifications";
import { useFCM } from "@/hooks/useFCM";

type BIPEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

export function InstallAppCard({ shopId }: { shopId?: string } = {}) {
  const [deferredPrompt, setDeferredPrompt] = useState<BIPEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [notifPerm, setNotifPerm] = useState<NotificationPermission>(
    typeof Notification !== "undefined" ? Notification.permission : "default",
  );
  const { status: fcmStatus, register: registerFCM } = useFCM(shopId);

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
  const isAndroid = /Android/i.test(navigator.userAgent);

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
      const token = await registerFCM();
      if (token) {
        toast({ title: "🔔 Notifications push activées", description: "Vous recevrez une alerte même quand l'application est fermée." });
      } else {
        toast({ title: "🔔 Notifications activées", description: "Vous recevrez une alerte quand l'application est ouverte." });
      }
      try { new Notification("VisualPro est prêt", { body: "Notifications de nouvelles commandes activées.", icon: "/app-icon-512.png" }); } catch {}
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

      <Dialog>
        <DialogTrigger asChild>
          <Button variant="ghost" size="sm" className="w-full gap-2 text-primary">
            <HelpCircle className="h-4 w-4" /> Guide pas à pas (avec captures)
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Comment installer & activer les notifications</DialogTitle>
          </DialogHeader>

          <Tabs defaultValue={isIOS ? "ios" : isAndroid ? "android" : "ios"}>
            <TabsList className="grid grid-cols-3 w-full">
              <TabsTrigger value="ios">iPhone</TabsTrigger>
              <TabsTrigger value="android">Android</TabsTrigger>
              <TabsTrigger value="desktop">Ordinateur</TabsTrigger>
            </TabsList>

            {/* ===== iPhone ===== */}
            <TabsContent value="ios" className="space-y-5 pt-4">
              <section>
                <h4 className="font-semibold mb-2">📲 Installer l'application</h4>
                <ol className="space-y-3 text-sm">
                  <li className="flex gap-3">
                    <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold">1</span>
                    <div>
                      Ouvrez cette page <strong>uniquement avec Safari</strong> (pas Chrome, pas Facebook, pas Instagram).
                    </div>
                  </li>
                  <li className="flex gap-3">
                    <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold">2</span>
                    <div>
                      Regardez <strong>en bas de l'écran</strong> (ou en haut sur iPad). Vous verrez une barre avec plusieurs icônes.
                      Touchez l'icône <strong>Partager</strong> :
                      <div className="mt-2 inline-flex items-center gap-2 px-3 py-2 bg-muted rounded-md">
                        <Share className="h-5 w-5 text-primary" />
                        <span className="text-xs">un carré avec une flèche ⬆ qui sort vers le haut</span>
                      </div>
                    </div>
                  </li>
                  <li className="flex gap-3">
                    <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold">3</span>
                    <div>
                      Si vous ne voyez pas la barre du bas, <strong>touchez une fois en bas de l'écran</strong> ou <strong>faites défiler vers le haut</strong>, la barre Safari apparaîtra.
                    </div>
                  </li>
                  <li className="flex gap-3">
                    <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold">4</span>
                    <div>
                      Dans le menu qui s'ouvre, <strong>faites glisser vers le bas</strong> et choisissez :
                      <div className="mt-2 inline-flex items-center gap-2 px-3 py-2 bg-muted rounded-md">
                        <Plus className="h-5 w-5 text-primary" />
                        <span className="text-xs font-medium">« Sur l'écran d'accueil »</span>
                      </div>
                    </div>
                  </li>
                  <li className="flex gap-3">
                    <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold">5</span>
                    <div>Touchez <strong>« Ajouter »</strong> en haut à droite. L'icône VisualPro apparaît sur votre écran d'accueil.</div>
                  </li>
                </ol>
              </section>

              <section>
                <h4 className="font-semibold mb-2">🔔 Activer les notifications (iPhone)</h4>
                <p className="text-sm text-muted-foreground mb-2">
                  ⚠️ Sur iPhone, les notifications fonctionnent <strong>uniquement après avoir installé l'application</strong> (étapes ci-dessus).
                </p>
                <ol className="space-y-3 text-sm">
                  <li className="flex gap-3">
                    <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold">1</span>
                    <div>Une fois installée, ouvrez l'app <strong>VisualPro depuis votre écran d'accueil</strong> (pas depuis Safari).</div>
                  </li>
                  <li className="flex gap-3">
                    <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold">2</span>
                    <div>Allez dans <strong>Boutique → Facturation</strong> et touchez <strong>« Activer les notifications »</strong>. iOS vous demandera l'autorisation : touchez <strong>Autoriser</strong>.</div>
                  </li>
                  <li className="flex gap-3">
                    <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold">3</span>
                    <div>
                      Si vous avez touché « Refuser » par erreur :
                      <div className="mt-1 pl-2 border-l-2 border-primary/30 text-xs space-y-1">
                        <div>• Ouvrez <strong>Réglages</strong> de l'iPhone</div>
                        <div>• Faites défiler jusqu'à <strong>VisualPro</strong></div>
                        <div>• Touchez <strong>Notifications</strong> → activez <strong>« Autoriser les notifications »</strong></div>
                      </div>
                    </div>
                  </li>
                </ol>
              </section>
            </TabsContent>

            {/* ===== Android ===== */}
            <TabsContent value="android" className="space-y-5 pt-4">
              <section>
                <h4 className="font-semibold mb-2">📲 Installer l'application</h4>
                <ol className="space-y-3 text-sm">
                  <li className="flex gap-3">
                    <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold">1</span>
                    <div>Ouvrez cette page avec <strong>Chrome</strong> (recommandé).</div>
                  </li>
                  <li className="flex gap-3">
                    <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold">2</span>
                    <div>Touchez le bouton <strong>« Installer l'application »</strong> ci-dessus, ou ouvrez le menu <strong>⋮</strong> en haut à droite de Chrome puis choisissez <strong>« Installer l'application »</strong> ou <strong>« Ajouter à l'écran d'accueil »</strong>.</div>
                  </li>
                </ol>
              </section>

              <section>
                <h4 className="font-semibold mb-2">🔔 Activer les notifications</h4>
                <ol className="space-y-3 text-sm">
                  <li className="flex gap-3">
                    <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold">1</span>
                    <div>Touchez <strong>« Activer les notifications »</strong>. Chrome demandera l'autorisation → touchez <strong>Autoriser</strong>.</div>
                  </li>
                  <li className="flex gap-3">
                    <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold">2</span>
                    <div>
                      Si elles sont bloquées :
                      <div className="mt-1 pl-2 border-l-2 border-primary/30 text-xs space-y-1">
                        <div>• Dans Chrome, touchez le <strong>cadenas 🔒</strong> à gauche de l'adresse du site</div>
                        <div>• Touchez <strong>Autorisations</strong> → <strong>Notifications</strong> → activez l'interrupteur</div>
                        <div>• Rechargez la page et réessayez</div>
                      </div>
                    </div>
                  </li>
                </ol>
              </section>
            </TabsContent>

            {/* ===== Desktop ===== */}
            <TabsContent value="desktop" className="space-y-5 pt-4">
              <section>
                <h4 className="font-semibold mb-2">💻 Installer & activer (Chrome / Edge)</h4>
                <ol className="space-y-3 text-sm">
                  <li className="flex gap-3">
                    <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold">1</span>
                    <div>Cliquez sur l'icône <strong>installation</strong> à droite de la barre d'adresse (un petit écran avec flèche ⤓), ou menu <strong>⋮</strong> → <strong>« Installer VisualPro »</strong>.</div>
                  </li>
                  <li className="flex gap-3">
                    <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold">2</span>
                    <div>Pour les notifications : cliquez sur le <strong>cadenas 🔒</strong> à gauche de l'URL → <strong>Notifications : Autoriser</strong>, puis rechargez.</div>
                  </li>
                </ol>
              </section>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>
    </Card>
  );
}