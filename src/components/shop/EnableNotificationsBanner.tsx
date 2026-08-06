import { useState } from "react";
import { Bell, Loader2, Volume2, VolumeX, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { useFCM } from "@/hooks/useFCM";
import {
  requestNotificationPermission,
  NOTIFICATION_SOUNDS,
  getSavedSoundId,
  getSavedVolume,
  getSoundFile,
  type NotificationSoundId,
} from "@/hooks/useOrderNotifications";

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
    typeof window !== "undefined" ? localStorage.getItem("vp_voice_notify") === "on" : false,
  );
  const [soundId, setSoundId] = useState<NotificationSoundId>(getSavedSoundId());
  const [volume, setVolume] = useState<number>(getSavedVolume());
  const { status, register } = useFCM();

  // Banner stays visible until a token is actually registered server-side.
  // (We intentionally no longer honour a dismiss flag — too many users hid it
  // and then never received notifications.)
  if (typeof window === "undefined") return null;
  if (!("Notification" in window)) return null;
  const previewSound = (id: NotificationSoundId, vol: number) => {
    try {
      const a = new Audio(getSoundFile(id));
      a.preload = "auto";
      a.volume = vol;
      a.play().catch(() => {});
    } catch {}
  };
  const testNotification = () => {
    previewSound(soundId, volume);
    if (Notification.permission === "granted") {
      try {
        const options: NotificationOptions & { renotify?: boolean; vibrate?: number[] } = {
          body: "Test du son système pour les commandes.",
          icon: "/app-icon-512.png",
          badge: "/app-icon-512.png",
          tag: `visualpro-test-${Date.now()}`,
          renotify: true,
          requireInteraction: true,
          silent: false,
          vibrate: [300, 80, 300, 80, 700],
        };
        new Notification("💰 VisualPro", options);
      } catch {}
    }
  };

  if (status === "registered") {
    return (
      <Card className="p-4 mb-4 space-y-4">
        <div className="flex items-start gap-2.5">
          <div className="h-8 w-8 shrink-0 rounded-full bg-emerald-100 dark:bg-emerald-950/40 flex items-center justify-center">
            <Bell className="h-4 w-4 text-emerald-600" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm leading-tight">🔔 Notifications activées</p>
            <p className="text-xs text-muted-foreground leading-snug mt-0.5">
              Personnalisez la sonnerie qui retentit à chaque nouvelle commande.
            </p>
          </div>
        </div>

        {/* Sound picker */}
        <div className="space-y-2">
          <Label className="text-xs font-semibold">Sonnerie</Label>
          <div className="flex gap-2">
            <Select
              value={soundId}
              onValueChange={(v) => {
                const id = v as NotificationSoundId;
                setSoundId(id);
                localStorage.setItem("vp_notif_sound", id);
                previewSound(id, volume);
              }}
            >
              <SelectTrigger className="h-9 text-xs flex-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {NOTIFICATION_SOUNDS.map(s => (
                  <SelectItem key={s.id} value={s.id} className="text-xs">{s.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              size="sm"
              variant="outline"
              onClick={testNotification}
              className="h-9 px-3 gap-1.5 shrink-0"
            >
              <Play className="h-3.5 w-3.5" />
              Tester
            </Button>
          </div>
        </div>

        {/* Volume slider */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-xs font-semibold flex items-center gap-1.5">
              {volume === 0 ? <VolumeX className="h-3.5 w-3.5" /> : <Volume2 className="h-3.5 w-3.5" />}
              Volume
            </Label>
            <span className="text-xs text-muted-foreground">{Math.round(volume * 100)}%</span>
          </div>
          <Slider
            value={[volume * 100]}
            min={0}
            max={100}
            step={5}
            onValueChange={(v) => {
              const next = (v[0] || 0) / 100;
              setVolume(next);
              localStorage.setItem("vp_notif_volume", String(next));
            }}
            onValueCommit={() => previewSound(soundId, volume)}
          />
        </div>

        {/* Voice toggle */}
        <div className="flex items-center justify-between gap-3 pt-1 border-t">
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold">Annonce vocale</p>
            <p className="text-[11px] text-muted-foreground leading-snug">
              Dit seulement : nouvelle commande + ville ou pays.
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
            className="h-8 px-3 text-xs shrink-0"
          >
            {voiceOn ? "Désactiver" : "Activer"}
          </Button>
        </div>

        <p className="text-[10px] text-muted-foreground leading-snug pt-1 border-t">
          📱 App fermée ou écran verrouillé : le téléphone joue le son système de notification.
          La sonnerie Ecomfy personnalisée se joue quand l'app est ouverte.
        </p>
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
          description: "Sur iPhone, ajoutez d'abord Ecomfy à l'écran d'accueil via Safari (bouton Partager → Sur l'écran d'accueil), puis réessayez depuis l'app.",
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
        toast({ title: "🔔 Notifications activées", description: "Vous recevrez une alerte sonore à chaque commande selon les réglages du téléphone." });
        try { new Notification("Ecomfy", { body: "Notifications activées avec succès.", icon: "/app-icon-512.png", silent: false }); } catch {}
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
    <div className="bg-[#E3F1EC] border border-[#C9E5DC] rounded-[14px] p-[16px_20px] flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm">
      <div className="flex items-center gap-[14px]">
        <div className="w-[36px] h-[36px] rounded-[10px] bg-white flex items-center justify-center text-[#0E7C66] shrink-0 shadow-sm">
          <Bell className="h-[18px] w-[18px]" />
        </div>
        <div>
          <h4 className="m-0 text-[14px] font-semibold text-[#0F1B2C] mb-[2px]">Activez les notifications</h4>
          <p className="m-0 text-[13px] text-[#5B6472]">
            Recevez une alerte instantanée à chaque nouvelle commande.
          </p>
        </div>
      </div>
      <button 
        onClick={handleEnable} 
        disabled={busy} 
        className="bg-[#0F1B2C] text-white border-none py-[9px] px-[16px] rounded-[9px] text-[13px] font-semibold flex items-center justify-center gap-[6px] cursor-pointer shrink-0 hover:bg-black transition-colors"
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Bell className="h-4 w-4" />}
        Activer
      </button>
    </div>
  );
}