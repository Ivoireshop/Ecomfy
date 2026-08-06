import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Bell } from "lucide-react";
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

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6 items-start">
        <div className="space-y-4 min-w-0">
          <Card className="p-6 space-y-5">
            <div className="flex items-center justify-between p-4 rounded-xl border bg-muted/30">
              <div>
                <Label className="font-semibold">Notifications activées</Label>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Si désactivé, aucune notification push n'est envoyée pour les nouvelles commandes.
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