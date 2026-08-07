import { useEffect, useState } from "react";
import { Loader2, Save, Palette, Eye } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  fetchProductThemeSettings,
  upsertProductThemeSettings,
  resetProductThemeSettings,
  ensureReadableTextColor,
  isValidHex,
  ProductThemeSettings,
  buildProductPageStyle,
} from "@/lib/productAppearance";
import { ProductAudioManager } from "./ProductAudioManager";
import { ProductThemePicker } from "./ProductThemePicker";

interface Props {
  productId: string;
  shopId: string;
  shopSlug?: string;
  productSlug?: string;
}

function emptySettings(productId: string, shopId: string): ProductThemeSettings {
  return {
    product_id: productId,
    shop_id: shopId,
    theme_slug: null,
    background_color: "#FFFFFF",
    section_bg_color: "#F8FAFC",
    card_bg_color: "#FFFFFF",
    text_color: "#1F2937",
    title_color: "#0F172A",
    button_color: "#EC4899",
    button_text_color: "#FFFFFF",
    border_color: "#E5E7EB",
    badge_color: "#F59E0B",
    background_mode: "solid",
  };
}

const COLOR_FIELDS: { key: keyof ProductThemeSettings; label: string }[] = [
  { key: "background_color", label: "Fond de la fiche" },
  { key: "section_bg_color", label: "Fond des sections" },
  { key: "card_bg_color", label: "Fond des cartes" },
  { key: "text_color", label: "Texte principal" },
  { key: "title_color", label: "Titres" },
  { key: "button_color", label: "Boutons" },
  { key: "button_text_color", label: "Texte des boutons" },
  { key: "border_color", label: "Bordures" },
  { key: "badge_color", label: "Badges promo" },
];

export function ProductAppearancePanel({ productId, shopId, shopSlug, productSlug }: Props) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<ProductThemeSettings | null>(null);
  const [device, setDevice] = useState<"mobile" | "desktop">("mobile");

  useEffect(() => {
    (async () => {
      setLoading(true);
      const s = await fetchProductThemeSettings(productId);
      setSettings(s || emptySettings(productId, shopId));
      setLoading(false);
    })();
  }, [productId, shopId]);

  const update = (patch: Partial<ProductThemeSettings>) =>
    setSettings((prev) => (prev ? { ...prev, ...patch } : prev));

  const onColorChange = (key: keyof ProductThemeSettings, value: string) => {
    if (!isValidHex(value)) {
      update({ [key]: value } as any);
      return;
    }
    update({ [key]: value } as any);
    // Auto-contrast safety
    if (key === "background_color" && settings?.text_color) {
      const fixed = ensureReadableTextColor(value, settings.text_color);
      if (fixed !== settings.text_color) {
        update({ text_color: fixed, title_color: fixed });
        toast.info("Texte ajusté pour rester lisible sur le nouveau fond.");
      }
    }
  };

  const save = async () => {
    if (!settings) return;
    setSaving(true);
    const { success, error } = await upsertProductThemeSettings(settings);
    setSaving(false);
    if (success) toast.success("Apparence enregistrée");
    else toast.error(error || "Échec de l'enregistrement");
  };

  const reset = async () => {
    if (!confirm("Revenir au design par défaut ? Le contenu de la fiche est conservé.")) return;
    await resetProductThemeSettings(productId);
    setSettings(emptySettings(productId, shopId));
    toast.success("Thème réinitialisé");
  };

  const previewUrl =
    shopSlug && productSlug ? `/shop/${shopSlug}/p/${productSlug}` : shopSlug ? `/shop/${shopSlug}` : null;

  if (loading || !settings) {
    return (
      <div className="flex items-center gap-2 text-xs text-muted-foreground p-4">
        <Loader2 className="h-3.5 w-3.5 animate-spin" /> Chargement…
      </div>
    );
  }

  const previewStyle = buildProductPageStyle(settings);

  return (
    <div className="space-y-4">
      <Tabs defaultValue="themes" className="w-full">
        <TabsList className="grid grid-cols-2 w-full h-10 p-1 bg-muted/50 rounded-lg">
          <TabsTrigger value="themes" className="text-xs font-medium rounded-md">Thèmes</TabsTrigger>
          <TabsTrigger value="colors" className="text-xs font-medium rounded-md">Couleurs & Fond</TabsTrigger>
        </TabsList>

        <TabsContent value="themes" className="mt-4">
          <ProductThemePicker
            productId={productId}
            shopId={shopId}
            settings={settings}
            onApply={(next) => setSettings(next)}
            onReset={reset}
          />
        </TabsContent>

        <TabsContent value="colors" className="mt-4 space-y-4">
          <div>
            <Label className="text-xs font-semibold text-muted-foreground">Mode de fond</Label>
            <div className="grid grid-cols-3 gap-2 mt-2">
              {(["solid", "gradient", "image"] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => update({ background_mode: m })}
                  className={`h-9 text-xs font-medium rounded-md border transition-colors ${
                    settings.background_mode === m
                      ? "bg-primary text-primary-foreground border-primary shadow-sm"
                      : "bg-background hover:bg-muted"
                  }`}
                >
                  {m === "solid" ? "Uni" : m === "gradient" ? "Dégradé" : "Image"}
                </button>
              ))}
            </div>
          </div>

          {settings.background_mode === "gradient" && (
            <div className="grid grid-cols-2 gap-4">
              <ColorField label="Dégradé départ" value={settings.gradient_from || "#FFFFFF"} onChange={(v) => update({ gradient_from: v })} />
              <ColorField label="Dégradé arrivée" value={settings.gradient_to || "#EC4899"} onChange={(v) => update({ gradient_to: v })} />
            </div>
          )}

          {settings.background_mode === "image" && (
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-muted-foreground">URL image de fond</Label>
              <Input
                value={settings.background_image_url || ""}
                onChange={(e) => update({ background_image_url: e.target.value })}
                placeholder="https://…"
                className="h-9 text-xs"
              />
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            {COLOR_FIELDS.map((f) => (
              <ColorField
                key={f.key as string}
                label={f.label}
                value={(settings[f.key] as string) || "#FFFFFF"}
                onChange={(v) => onColorChange(f.key, v)}
              />
            ))}
          </div>
        </TabsContent>
      </Tabs>

      {/* Live preview */}
      <div className="border rounded-lg overflow-hidden">
        <div className="flex items-center justify-between px-2 py-1.5 bg-muted/40 border-b">
          <div className="flex items-center gap-1.5">
            <Eye className="h-3.5 w-3.5" />
            <span className="text-[11px] font-medium">Aperçu</span>
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setDevice("mobile")}
              className={`text-[10px] px-2 py-0.5 rounded ${device === "mobile" ? "bg-primary text-primary-foreground" : "bg-card"}`}
            >
              Mobile
            </button>
            <button
              type="button"
              onClick={() => setDevice("desktop")}
              className={`text-[10px] px-2 py-0.5 rounded ${device === "desktop" ? "bg-primary text-primary-foreground" : "bg-card"}`}
            >
              Bureau
            </button>
          </div>
        </div>
        <div className="p-3 bg-muted/20 flex justify-center">
          <div
            style={previewStyle}
            className={`rounded-md shadow-sm overflow-hidden transition-all ${
              device === "mobile" ? "w-[260px]" : "w-full max-w-[420px]"
            }`}
          >
            <div className="p-3 space-y-2">
              <div className="text-base font-bold" style={{ color: settings.title_color || undefined }}>
                Mon produit
              </div>
              <div className="text-xs opacity-80">Aperçu de la description courte du produit.</div>
              <div
                className="rounded p-2 text-xs"
                style={{
                  background: settings.card_bg_color || undefined,
                  border: `1px solid ${settings.border_color || "transparent"}`,
                }}
              >
                Section / carte produit
              </div>
              <button
                type="button"
                className="w-full rounded py-2 text-xs font-semibold"
                style={{
                  background: settings.button_color || undefined,
                  color: settings.button_text_color || undefined,
                }}
              >
                Commander
              </button>
              <span
                className="inline-block text-[10px] font-bold px-1.5 py-0.5 rounded"
                style={{ background: settings.badge_color || undefined, color: "#fff" }}
              >
                PROMO
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
        <Button size="sm" variant="outline" onClick={reset} className="text-xs">
          Design par défaut
        </Button>
        <div className="flex items-center gap-3">
          {previewUrl && (
            <a href={previewUrl} target="_blank" rel="noreferrer" className="text-xs text-primary hover:underline font-medium">
              Voir comme client →
            </a>
          )}
          <Button size="sm" onClick={save} disabled={saving} className="gap-2 shadow-sm">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Enregistrer l'apparence
          </Button>
        </div>
      </div>
    </div>
  );
}

function ColorField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  const safe = isValidHex(value) ? value : "#FFFFFF";
  return (
    <div className="space-y-1.5">
      <Label className="text-[11px] font-medium text-muted-foreground">{label}</Label>
      <div className="flex items-center gap-2 bg-background border rounded-md p-1 shadow-sm">
        <input
          type="color"
          value={safe}
          onChange={(e) => onChange(e.target.value.toUpperCase())}
          className="h-7 w-8 rounded cursor-pointer p-0 border-0 flex-shrink-0"
          aria-label={label}
        />
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="#FFFFFF"
          className="h-7 text-xs font-mono border-0 focus-visible:ring-0 px-1 bg-transparent"
        />
      </div>
    </div>
  );
}
