import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Loader2, Languages } from "lucide-react";
import { SHOP_LANGUAGES } from "@/lib/shopLanguages";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

interface Props {
  shop: any;
  setShop: (s: any) => void;
}

export function LanguageSettings({ shop, setShop }: Props) {
  const enabled: string[] = Array.isArray(shop.enabled_languages) && shop.enabled_languages.length
    ? shop.enabled_languages
    : ["fr"];
  const [saving, setSaving] = useState(false);
  const [translating, setTranslating] = useState<string | null>(null);

  const toggle = async (code: string) => {
    if (code === "fr") return; // Source language always on
    const next = enabled.includes(code) ? enabled.filter((c) => c !== code) : [...enabled, code];
    setSaving(true);
    const { error } = await supabase.from("shops").update({ enabled_languages: next } as any).eq("id", shop.id);
    setSaving(false);
    if (error) {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
      return;
    }
    setShop({ ...shop, enabled_languages: next });
  };

  const pretranslateAll = async (lang: string) => {
    setTranslating(lang);
    try {
      // Shop
      await supabase.functions.invoke("translate-product", {
        body: {
          texts: {
            business_name: shop.business_name || "",
            business_description: shop.business_description || "",
            seo_title: shop.seo_title || "",
            seo_description: shop.seo_description || "",
          },
          target_lang: lang,
          source_lang: "fr",
          shop_id: shop.id,
          persist: true,
          source: "ai_auto",
        },
      });
      // Products
      const { data: products } = await supabase
        .from("products")
        .select("id, name, short_description, description, category")
        .eq("shop_id", shop.id);
      let done = 0;
      for (const p of products || []) {
        const texts: Record<string, string> = {};
        if (p.name) texts.name = p.name;
        if (p.short_description) texts.short_description = p.short_description;
        if (p.description) texts.description = p.description;
        if (p.category) texts.category = p.category;
        if (Object.keys(texts).length === 0) continue;
        await supabase.functions.invoke("translate-product", {
          body: {
            texts,
            target_lang: lang,
            source_lang: "fr",
            shop_id: shop.id,
            product_id: p.id,
            persist: true,
            source: "ai_auto",
          },
        });
        done++;
      }
      toast({ title: "Traduction terminée ✓", description: `Boutique + ${done} produit(s).` });
    } catch (e: any) {
      toast({ title: "Erreur de traduction", description: e?.message, variant: "destructive" });
    } finally {
      setTranslating(null);
    }
  };

  return (
    <>
      <div className="flex items-center gap-2">
        <Languages className="h-5 w-5" />
        <h2 className="text-xl font-bold">Langues de la boutique</h2>
      </div>
      <Card className="p-6 space-y-4">
        <p className="text-sm text-muted-foreground">
          Activez les langues dans lesquelles vos visiteurs pourront consulter votre boutique. La langue source
          est <b>Français</b>. Lorsqu'un visiteur change de langue, les traductions IA sont générées
          automatiquement et mises en cache. Vous pouvez aussi pré-traduire l'ensemble du catalogue dès maintenant.
        </p>
        <div className="space-y-3">
          {SHOP_LANGUAGES.map((l) => {
            const isOn = enabled.includes(l.code);
            const isSource = l.code === "fr";
            return (
              <div key={l.code} className="flex items-center justify-between gap-3 border rounded-lg p-3">
                <div className="flex items-center gap-3 min-w-0">
                  <span className="text-2xl">{l.flag}</span>
                  <div className="min-w-0">
                    <div className="font-medium flex items-center gap-2">
                      {l.label}
                      {isSource && <Badge variant="secondary">Source</Badge>}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {isOn ? "Disponible sur la boutique publique" : "Désactivée"}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {isOn && !isSource && (
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={!!translating}
                      onClick={() => pretranslateAll(l.code)}
                    >
                      {translating === l.code ? (
                        <Loader2 className="h-3 w-3 animate-spin mr-1" />
                      ) : null}
                      Pré-traduire
                    </Button>
                  )}
                  <Switch
                    checked={isOn}
                    disabled={isSource || saving}
                    onCheckedChange={() => toggle(l.code)}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </Card>
    </>
  );
}