import { useEffect, useState } from "react";
import { Loader2, Check, Lock, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  fetchProductThemes,
  ProductThemeRow,
  ProductThemeSettings,
} from "@/lib/productAppearance";

interface Props {
  productId: string;
  shopId: string;
  settings: ProductThemeSettings | null;
  onApply: (next: ProductThemeSettings) => void;
  onReset: () => void;
}

export function ProductThemePicker({ productId, shopId, settings, onApply, onReset }: Props) {
  const [themes, setThemes] = useState<ProductThemeRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      setThemes(await fetchProductThemes());
      setLoading(false);
    })();
  }, []);

  const applyTheme = (t: ProductThemeRow) => {
    if (t.is_premium) {
      toast.info("Thème premium — bientôt disponible à l'achat.");
      return;
    }
    const c = t.configuration_json || {};
    const next: ProductThemeSettings = {
      product_id: productId,
      shop_id: shopId,
      theme_slug: t.slug,
      background_color: c.background_color || null,
      section_bg_color: c.section_bg_color || null,
      card_bg_color: c.card_bg_color || null,
      text_color: c.text_color || null,
      title_color: c.title_color || null,
      button_color: c.button_color || null,
      button_text_color: c.button_text_color || null,
      border_color: c.border_color || null,
      badge_color: c.badge_color || null,
      background_mode: "solid",
      gradient_from: settings?.gradient_from ?? null,
      gradient_to: settings?.gradient_to ?? null,
      background_image_url: settings?.background_image_url ?? null,
      visible_sections: settings?.visible_sections ?? null,
      section_order: settings?.section_order ?? null,
      custom_css_settings: settings?.custom_css_settings ?? {},
    };
    onApply(next);
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Loader2 className="h-3.5 w-3.5 animate-spin" /> Chargement des thèmes…
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">Thèmes professionnels</h3>
        <Button size="sm" variant="ghost" className="h-7 px-2 text-xs gap-1" onClick={onReset}>
          <RotateCcw className="h-3 w-3" /> Design par défaut
        </Button>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {themes.map((t) => {
          const c = t.configuration_json || {};
          const selected = settings?.theme_slug === t.slug;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => applyTheme(t)}
              className={`relative text-left rounded-lg border-2 overflow-hidden transition ${
                selected ? "border-primary ring-2 ring-primary/30" : "border-border hover:border-primary/40"
              }`}
            >
              <div
                className="aspect-[4/3] p-2 flex flex-col justify-between"
                style={{
                  background: c.background_color || "#fff",
                  color: c.text_color || "#111",
                }}
              >
                <div className="text-[10px] font-bold" style={{ color: c.title_color || c.text_color }}>
                  {t.name}
                </div>
                <div className="flex gap-1">
                  <span className="h-3 w-3 rounded-full" style={{ background: c.button_color }} />
                  <span className="h-3 w-3 rounded-full" style={{ background: c.badge_color }} />
                  <span className="h-3 w-3 rounded-full border" style={{ background: c.card_bg_color, borderColor: c.border_color }} />
                </div>
                <div
                  className="text-[9px] px-1.5 py-0.5 rounded self-start"
                  style={{ background: c.button_color, color: c.button_text_color }}
                >
                  Commander
                </div>
              </div>
              <div className="px-2 py-1.5 bg-card border-t text-[10px] flex items-center justify-between">
                <span className="truncate">{t.theme_type}</span>
                {t.is_premium ? (
                  <span className="flex items-center gap-0.5 text-amber-600 font-semibold">
                    <Lock className="h-2.5 w-2.5" /> Premium
                  </span>
                ) : (
                  <span className="text-emerald-600 font-semibold">Gratuit</span>
                )}
              </div>
              {selected && (
                <div className="absolute top-1 right-1 h-5 w-5 rounded-full bg-primary text-primary-foreground flex items-center justify-center">
                  <Check className="h-3 w-3" />
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
