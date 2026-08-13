import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { Bell, Loader2, Volume2, VolumeX, Play } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { useWebPush } from "@/hooks/useWebPush";
import {
  requestNotificationPermission,
  NOTIFICATION_SOUNDS,
  getSavedSoundId,
  getSavedVolume,
  getSoundFile,
  type NotificationSoundId,
} from "@/hooks/useOrderNotifications";
import {
  buildOrderNotification,
  mergeNotifSettings,
  type NotifLang,
  type NotifTemplate,
} from "@/lib/notificationFormat";

interface Props {
  shop: any;
  setShop: (shop: any) => void;
}

const LANGS: { value: NotifLang; label: string }[] = [
  { value: "fr", label: "🇫🇷 Français" },
  { value: "en", label: "🇬🇧 English" },
  { value: "es", label: "🇪🇸 Español" },
  { value: "pt", label: "🇵🇹 Português" },
  { value: "ar", label: "🇸🇦 العربية" },
];

const TEMPLATES: { value: NotifTemplate; label: string; desc: string }[] = [
  { value: "detailed", label: "Détaillé", desc: "Toutes les infos client (recommandé)" },
  { value: "compact", label: "Compact", desc: "Sans le téléphone, plus court" },
  { value: "minimal", label: "Minimal", desc: "Juste produit + total" },
  { value: "custom", label: "Personnalisé", desc: "Tu choisis le titre et les champs" },
];

// Demo order used to render the live preview.
const DEMO_ORDER = {
  customer_name: "Aïcha Koné",
  customer_phone: "+225 07 58 15 27 61",
  customer_city: "Cocody",
  customer_country: "Côte d'Ivoire",
  total: 24500,
  items: [
    { product_name: "Sérum éclaircissant Vitamine C", quantity: 2 },
    { product_name: "Crème de nuit anti-âge", quantity: 1 },
    { product_name: "Masque purifiant argile", quantity: 1 },
  ],
};

export function NotificationSettings({ shop, setShop }: Props) {
  const settings = mergeNotifSettings(shop?.notification_settings);
  const update = (patch: Partial<typeof settings>) =>
    setShop({ ...shop, notification_settings: { ...settings, ...patch } });

  const preview = buildOrderNotification(DEMO_ORDER, shop?.business_name || "Ma boutique", settings);
  const isCustom = settings.template === "custom";

  // Device-specific Notification Settings (Local Storage)
  const [perm, setPerm] = useState<NotificationPermission>(
    typeof Notification !== "undefined" ? Notification.permission : "default",
  );
  const [busy, setBusy] = useState(false);
  const [voiceOn, setVoiceOn] = useState<boolean>(
    typeof window !== "undefined" ? (localStorage.getItem("ecomfy_voice_notify") || localStorage.getItem("vp_voice_notify")) === "on" : false,
  );
  const [soundId, setSoundId] = useState<NotificationSoundId>(getSavedSoundId());
  const [volume, setVolume] = useState<number>(getSavedVolume());
  const { isSubscribed, subscribe } = useWebPush();

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
          tag: `ecomfy-test-${Date.now()}`,
          renotify: true,
          requireInteraction: true,
          silent: false,
          vibrate: [300, 80, 300, 80, 700],
        };
        new Notification("💰 Ecomfy", options);
      } catch {}
    }
  };

  const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);
  const isStandalone =
    window.matchMedia?.("(display-mode: standalone)").matches ||
    (window.navigator as any).standalone === true;

  const handleEnableNotifications = async () => {
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
      await subscribe();
      // Le toast de succès ou d'erreur est géré à l'intérieur de `subscribe()`
      // On teste quand même si c'est activé après
      if (Notification.permission === 'granted') {
        try { new Notification("Ecomfy", { body: "Notifications activées avec succès.", icon: "/app-icon-512.png", silent: false }); } catch {}
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div className="flex items-center gap-2">
        <Bell className="w-5 h-5 text-primary" />
        <h2 className="text-xl font-bold">Notifications de commande</h2>
      </div>
      <p className="text-sm text-muted-foreground -mt-2">
        Personnalise le titre, la langue et le contenu des notifications push qui s'affichent
        à chaque nouvelle commande.
      </p>

      {/* Push Notifications Registration Banner */}
      {!isSubscribed && (
        <Card className="bg-[#E3F1EC] border-[#C9E5DC] p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm mb-6">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center text-[#0E7C66] shrink-0 shadow-sm">
              <Bell className="h-5 w-5" />
            </div>
            <div>
              <h4 className="m-0 text-sm font-semibold text-[#0F1B2C] mb-0.5">Activez les notifications</h4>
              <p className="m-0 text-xs text-[#5B6472]">
                Recevez une alerte instantanée à chaque nouvelle commande.
              </p>
            </div>
          </div>
          <Button 
            onClick={handleEnableNotifications} 
            disabled={busy} 
            className="bg-[#0F1B2C] text-white hover:bg-black font-semibold shrink-0"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Bell className="h-4 w-4 mr-2" />}
            Activer
          </Button>
        </Card>
      )}

      {isSubscribed && (
        <Card className="p-6 mb-6 space-y-6">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 shrink-0 rounded-xl bg-emerald-100 dark:bg-emerald-950/40 flex items-center justify-center">
              <Bell className="h-5 w-5 text-emerald-600" />
            </div>
            <div>
              <p className="font-semibold text-lg leading-tight">🔔 Notifications sur cet appareil activées</p>
              <p className="text-sm text-muted-foreground mt-1">
                Personnalisez la sonnerie et le volume pour cet appareil.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t">
            {/* Sound picker */}
            <div className="space-y-3">
              <Label className="text-sm font-semibold">Sonnerie Ecomfy</Label>
              <div className="flex gap-2">
                <Select
                  value={soundId}
                  onValueChange={(v) => {
                    const id = v as NotificationSoundId;
                    setSoundId(id);
                    localStorage.setItem("ecomfy_notif_sound", id);
                    previewSound(id, volume);
                  }}
                >
                  <SelectTrigger className="flex-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {NOTIFICATION_SOUNDS.map(s => (
                      <SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  variant="outline"
                  onClick={testNotification}
                  className="gap-2 shrink-0"
                >
                  <Play className="h-4 w-4" />
                  Tester
                </Button>
              </div>
            </div>

            {/* Volume slider */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-semibold flex items-center gap-2">
                  {volume === 0 ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
                  Volume
                </Label>
                <span className="text-sm font-medium">{Math.round(volume * 100)}%</span>
              </div>
              <Slider
                value={[volume * 100]}
                min={0}
                max={100}
                step={5}
                onValueChange={(v) => {
                  const next = (v[0] || 0) / 100;
                  setVolume(next);
                  localStorage.setItem("ecomfy_notif_volume", String(next));
                }}
                onValueCommit={() => previewSound(soundId, volume)}
                className="py-2"
              />
            </div>
          </div>

          {/* Voice toggle */}
          <div className="flex items-center justify-between gap-4 pt-4 border-t">
            <div>
              <p className="font-semibold">Annonce vocale (Synthèse vocale)</p>
              <p className="text-sm text-muted-foreground mt-1">
                Dicte : "Tu as une nouvelle commande de X à Y."
              </p>
            </div>
            <Switch
              checked={voiceOn}
              onCheckedChange={(next) => {
                setVoiceOn(next);
                localStorage.setItem("ecomfy_voice_notify", next ? "on" : "off");
                if (next && "speechSynthesis" in window) {
                  try {
                    const u = new SpeechSynthesisUtterance("Annonce vocale activée");
                    u.lang = "fr-FR";
                    window.speechSynthesis.speak(u);
                  } catch {}
                }
                toast({ title: next ? "🔊 Voix activée" : "🔇 Voix désactivée" });
              }}
            />
          </div>
          <p className="text-xs text-muted-foreground italic pt-2">
            * Ces réglages s'appliquent uniquement à cet appareil.
          </p>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6 items-start">
        <div className="space-y-4 min-w-0">
          <Card className="p-6 space-y-5">
            <div className="flex items-center justify-between p-4 rounded-xl border bg-muted/30">
              <div>
                <Label className="font-semibold">Format des notifications (pour les clients et vendeurs)</Label>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Configurez le format du message envoyé lors d'une nouvelle commande.
                </p>
              </div>
              <Switch
                checked={settings.enabled}
                onCheckedChange={(v) => update({ enabled: v })}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Langue de la notification</Label>
                <Select value={settings.language} onValueChange={(v) => update({ language: v as NotifLang })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {LANGS.map(l => <SelectItem key={l.value} value={l.value}>{l.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Modèle</Label>
                <Select value={settings.template} onValueChange={(v) => update({ template: v as NotifTemplate })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {TEMPLATES.map(t => (
                      <SelectItem key={t.value} value={t.value}>
                        <span className="font-medium">{t.label}</span>
                        <span className="text-xs text-muted-foreground ml-2">— {t.desc}</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {isCustom && (
              <div className="space-y-1.5">
                <Label>Titre personnalisé</Label>
                <Input
                  value={settings.custom_title}
                  onChange={(e) => update({ custom_title: e.target.value })}
                  placeholder="💰 Nouvelle commande {shop}"
                />
                <p className="text-xs text-muted-foreground">
                  Utilise <code className="px-1 bg-muted rounded">{"{shop}"}</code> pour insérer
                  automatiquement le nom de ta boutique.
                </p>
              </div>
            )}

            <div className="space-y-1.5">
              <Label>Nombre de produits affichés (max)</Label>
              <Select
                value={String(settings.max_products)}
                onValueChange={(v) => update({ max_products: Number(v) })}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {[1, 2, 3, 4, 5].map(n => (
                    <SelectItem key={n} value={String(n)}>
                      {n} produit{n > 1 ? "s" : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Au-delà, la notification affichera "+N autres".
              </p>
            </div>

            <div className="space-y-2 pt-2 border-t">
              <Label className="text-sm font-semibold">Champs à inclure</Label>
              {[
                { key: "include_customer_name", label: "Nom du client", icon: "👤" },
                { key: "include_products", label: "Produits commandés", icon: "📦" },
                { key: "include_phone", label: "Numéro de téléphone", icon: "📞" },
                { key: "include_place", label: "Ville / Pays", icon: "📍" },
                { key: "include_total", label: "Montant total", icon: "💰" },
              ].map((row) => (
                <div key={row.key} className="flex items-center justify-between py-1.5">
                  <span className="text-sm">{row.icon} {row.label}</span>
                  <Switch
                    checked={Boolean((settings as any)[row.key])}
                    onCheckedChange={(v) => update({ [row.key]: v } as any)}
                  />
                </div>
              ))}
            </div>
          </Card>
        </div>

        {/* Aperçu live */}
        <div className="lg:sticky lg:top-4 space-y-2">
          <Label className="text-xs uppercase tracking-wide text-muted-foreground">Aperçu en direct</Label>
          <Card className="p-4 bg-gradient-to-br from-slate-900 to-slate-800 text-white border-0 shadow-xl">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center text-white font-bold text-sm shrink-0">
                EC
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-sm leading-tight">{preview.title}</div>
                <div className="text-xs text-slate-300 whitespace-pre-line mt-1 leading-snug">
                  {preview.body}
                </div>
                <div className="text-[10px] text-slate-400 mt-2">à l'instant • Ecomfy</div>
              </div>
            </div>
          </Card>
          <p className="text-xs text-muted-foreground">
            Exemple basé sur une commande fictive. La notification réelle utilisera les vraies infos du client.
          </p>
        </div>
      </div>
    </>
  );
}