import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Settings, Layout, Tag, ShoppingCart as CartIcon, MessageSquare, Home, Smartphone, Monitor, Type, Timer, TrendingDown } from "lucide-react";
import { RichTextEditor } from "./RichTextEditor";
import DOMPurify from "dompurify";

interface ShopThemeSettingsProps {
  shop: any;
  setShop: (shop: any) => void;
}

const THEME_SECTIONS = [
  { id: "header", label: "Paramètres d'en-tête / pied de page", icon: Layout },
  { id: "product", label: "Paramètres du produit", icon: Tag },
  { id: "checkout", label: "Paramètres du check-out", icon: CartIcon },
  { id: "banner", label: "Bannière inférieure du panier", icon: MessageSquare },
  { id: "homepage", label: "Paramètres de la page d'accueil", icon: Home },
];

export function ShopThemeSettings({ shop, setShop }: ShopThemeSettingsProps) {
  const [activeThemeSection, setActiveThemeSection] = useState("header");

  const updateThemeConfig = (key: string, value: any) => {
    const currentConfig = shop.theme_config || {};
    setShop({ ...shop, theme_config: { ...currentConfig, [key]: value } });
  };

  const themeConfig = shop.theme_config || {};

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold">Thème</h2>

      <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-xl p-4 text-sm text-blue-700 dark:text-blue-300">
        ℹ️ À l'exception des paramètres de paiement, tous les autres paramètres sur cette page personnalisent l'apparence de votre boutique.
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Sidebar */}
        <Card className="p-4 lg:col-span-1 h-fit">
          <p className="text-sm font-semibold text-muted-foreground mb-3 flex items-center gap-2"><Settings className="h-4 w-4" /> Réglage des thèmes</p>
          <nav className="space-y-1">
            {THEME_SECTIONS.map(section => (
              <button
                key={section.id}
                onClick={() => setActiveThemeSection(section.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all text-left ${
                  activeThemeSection === section.id
                    ? "bg-primary/10 text-primary font-semibold border-l-3 border-primary"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                }`}
              >
                <section.icon className="h-4 w-4 shrink-0" />
                {section.label}
              </button>
            ))}
          </nav>
        </Card>

        {/* Content */}
        <Card className="p-6 lg:col-span-3">
          {activeThemeSection === "header" && (
            <div className="space-y-6">
              <Tabs defaultValue="mobile">
                <TabsList className="w-full justify-start bg-transparent border-b rounded-none p-0 h-auto gap-0">
                  {["En-tête mobile", "En-tête Ordinateur", "Bas de page", "Barre d'avis ordinateur", "Barre d'avis mobile"].map((tab, i) => {
                    const val = ["mobile", "desktop", "footer", "review_desktop", "review_mobile"][i];
                    return (
                      <TabsTrigger key={val} value={val} className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:text-primary data-[state=active]:shadow-none px-4 py-3 text-sm">
                        {tab}
                      </TabsTrigger>
                    );
                  })}
                </TabsList>

                <TabsContent value="mobile" className="mt-6 space-y-6">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <ColorField label="Arrière-plan" value={themeConfig.header_mobile_bg || "#FFFFFF"} onChange={v => updateThemeConfig("header_mobile_bg", v)} />
                    <ColorField label="Couleur boutons" value={themeConfig.header_mobile_btn || "#000000"} onChange={v => updateThemeConfig("header_mobile_btn", v)} />
                    <div className="space-y-2">
                      <Label className="text-xs">Bordure d'en-tête</Label>
                      <div className="flex items-center justify-between bg-muted/30 rounded-lg px-3 py-2.5">
                        <span className="text-sm">Activer</span>
                        <Switch checked={themeConfig.header_mobile_border !== false} onCheckedChange={v => updateThemeConfig("header_mobile_border", v)} />
                      </div>
                    </div>
                    <ColorField label="Couleur bordure" value={themeConfig.header_mobile_border_color || "#F0F0F0"} onChange={v => updateThemeConfig("header_mobile_border_color", v)} />
                  </div>
                </TabsContent>

                <TabsContent value="desktop" className="mt-6 space-y-6">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <ColorField label="Arrière-plan" value={themeConfig.header_desktop_bg || "#FFFFFF"} onChange={v => updateThemeConfig("header_desktop_bg", v)} />
                    <ColorField label="Couleur boutons" value={themeConfig.header_desktop_btn || "#000000"} onChange={v => updateThemeConfig("header_desktop_btn", v)} />
                    <div className="space-y-2">
                      <Label className="text-xs">Bordure d'en-tête</Label>
                      <div className="flex items-center justify-between bg-muted/30 rounded-lg px-3 py-2.5">
                        <span className="text-sm">Activer</span>
                        <Switch checked={themeConfig.header_desktop_border !== false} onCheckedChange={v => updateThemeConfig("header_desktop_border", v)} />
                      </div>
                    </div>
                    <ColorField label="Couleur bordure" value={themeConfig.header_desktop_border_color || "#F0F0F0"} onChange={v => updateThemeConfig("header_desktop_border_color", v)} />
                  </div>
                </TabsContent>

                <TabsContent value="footer" className="mt-6 space-y-6">
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-sm font-medium">Pied de page personnalisé</span>
                    <Switch checked={themeConfig.footer_custom || false} onCheckedChange={v => updateThemeConfig("footer_custom", v)} />
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <ColorField label="Arrière-plan footer" value={themeConfig.footer_bg || "#FEFEFE"} onChange={v => updateThemeConfig("footer_bg", v)} />
                    <ColorField label="Couleur texte" value={themeConfig.footer_text || "#000000"} onChange={v => updateThemeConfig("footer_text", v)} />
                    <div className="space-y-2">
                      <Label className="text-xs">Bordure footer</Label>
                      <div className="flex items-center justify-between bg-muted/30 rounded-lg px-3 py-2.5">
                        <span className="text-sm">Activer</span>
                        <Switch checked={themeConfig.footer_border !== false} onCheckedChange={v => updateThemeConfig("footer_border", v)} />
                      </div>
                    </div>
                    <ColorField label="Couleur bordure" value={themeConfig.footer_border_color || "#4A4A4AFF"} onChange={v => updateThemeConfig("footer_border_color", v)} />
                  </div>
                </TabsContent>

                <TabsContent value="review_desktop" className="mt-6 space-y-6">
                  <div className="border rounded-xl p-4 bg-muted/20 min-h-[150px]">
                    <p className="text-sm text-muted-foreground mb-3">Contenu de la barre d'avis (ordinateur)</p>
                    <RichTextEditor value={themeConfig.review_bar_desktop_content || ""} onChange={v => updateThemeConfig("review_bar_desktop_content", v)} />
                  </div>
                  <ReviewLivePreview themeConfig={themeConfig} variant="desktop" />
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <ColorField label="Couleur du texte" value={themeConfig.review_desktop_text || "#FFFFFF"} onChange={v => updateThemeConfig("review_desktop_text", v)} />
                    <ColorField label="Couleur arrière-plan" value={themeConfig.review_desktop_bg || "#803160"} onChange={v => updateThemeConfig("review_desktop_bg", v)} />
                    <div className="space-y-2">
                      <Label className="text-xs">Au-dessus de l'en-tête</Label>
                      <div className="flex items-center justify-between bg-muted/30 rounded-lg px-3 py-2.5">
                        <span className="text-sm">Activer</span>
                        <Switch checked={themeConfig.review_desktop_above || false} onCheckedChange={v => updateThemeConfig("review_desktop_above", v)} />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs">Actif</Label>
                      <div className="flex items-center justify-between bg-muted/30 rounded-lg px-3 py-2.5">
                        <span className="text-sm">Activer</span>
                        <Switch checked={themeConfig.review_desktop_active !== false} onCheckedChange={v => updateThemeConfig("review_desktop_active", v)} />
                      </div>
                    </div>
                  </div>
                  <AnimationControls
                    mode={themeConfig.review_desktop_anim || (themeConfig.review_desktop_scroll ? "scroll" : "static")}
                    speed={Number(themeConfig.review_desktop_speed) || (themeConfig.review_desktop_anim === "blink" ? 1.5 : 22)}
                    onModeChange={v => updateThemeConfig("review_desktop_anim", v)}
                    onSpeedChange={v => updateThemeConfig("review_desktop_speed", v)}
                  />
                </TabsContent>

                <TabsContent value="review_mobile" className="mt-6 space-y-6">
                  <div className="border rounded-xl p-4 bg-muted/20 min-h-[150px]">
                    <p className="text-sm text-muted-foreground mb-3">Contenu de la barre d'avis (mobile)</p>
                    <RichTextEditor value={themeConfig.review_bar_mobile_content || ""} onChange={v => updateThemeConfig("review_bar_mobile_content", v)} />
                  </div>
                  <ReviewLivePreview themeConfig={themeConfig} variant="mobile" />
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <ColorField label="Couleur du texte" value={themeConfig.review_mobile_text || "#FFFFFFFF"} onChange={v => updateThemeConfig("review_mobile_text", v)} />
                    <ColorField label="Couleur arrière-plan" value={themeConfig.review_mobile_bg || "#000000FF"} onChange={v => updateThemeConfig("review_mobile_bg", v)} />
                    <div className="space-y-2">
                      <Label className="text-xs">Au-dessus de l'en-tête</Label>
                      <div className="flex items-center justify-between bg-muted/30 rounded-lg px-3 py-2.5">
                        <span className="text-sm">Activer</span>
                        <Switch checked={themeConfig.review_mobile_above || false} onCheckedChange={v => updateThemeConfig("review_mobile_above", v)} />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs">Actif</Label>
                      <div className="flex items-center justify-between bg-muted/30 rounded-lg px-3 py-2.5">
                        <span className="text-sm">Activer</span>
                        <Switch checked={themeConfig.review_mobile_active !== false} onCheckedChange={v => updateThemeConfig("review_mobile_active", v)} />
                      </div>
                    </div>
                  </div>
                  <AnimationControls
                    mode={themeConfig.review_mobile_anim || (themeConfig.review_mobile_scroll ? "scroll" : "static")}
                    speed={Number(themeConfig.review_mobile_speed) || (themeConfig.review_mobile_anim === "blink" ? 1.5 : 22)}
                    onModeChange={v => updateThemeConfig("review_mobile_anim", v)}
                    onSpeedChange={v => updateThemeConfig("review_mobile_speed", v)}
                  />
                </TabsContent>
              </Tabs>
            </div>
          )}

          {activeThemeSection === "product" && (
            <div className="space-y-6">
              <h3 className="font-bold">Paramètres du produit</h3>

              {/* Countdown */}
              <Card className="p-5 space-y-4 border-dashed">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-xl bg-orange-50 dark:bg-orange-950/30 flex items-center justify-center">
                      <Timer className="h-5 w-5 text-orange-600" />
                    </div>
                    <div>
                      <p className="font-semibold text-sm">Compte à rebours</p>
                      <p className="text-xs text-muted-foreground">Crée un sentiment d'urgence pour accélérer les achats</p>
                    </div>
                  </div>
                  <Switch checked={themeConfig.countdown_enabled || false} onCheckedChange={v => updateThemeConfig("countdown_enabled", v)} />
                </div>
                {themeConfig.countdown_enabled && (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pl-13">
                    <div className="space-y-1.5">
                      <Label className="text-xs">Jours</Label>
                      <Input type="number" min={0} max={30} value={themeConfig.countdown_days || 0} onChange={e => updateThemeConfig("countdown_days", parseInt(e.target.value) || 0)} />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Heures</Label>
                      <Input type="number" min={0} max={23} value={themeConfig.countdown_hours || 12} onChange={e => updateThemeConfig("countdown_hours", parseInt(e.target.value) || 0)} />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Minutes</Label>
                      <Input type="number" min={0} max={59} value={themeConfig.countdown_minutes || 0} onChange={e => updateThemeConfig("countdown_minutes", parseInt(e.target.value) || 0)} />
                    </div>
                    <ColorField label="Couleur" value={themeConfig.countdown_color || "#dc2626"} onChange={v => updateThemeConfig("countdown_color", v)} />
                  </div>
                )}
              </Card>

              {/* Stock urgency */}
              <Card className="p-5 space-y-4 border-dashed">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-xl bg-red-50 dark:bg-red-950/30 flex items-center justify-center">
                      <TrendingDown className="h-5 w-5 text-red-600" />
                    </div>
                    <div>
                      <p className="font-semibold text-sm">Indicateur de stock</p>
                      <p className="text-xs text-muted-foreground">Affiche un compteur de stock animé pour mettre la pression</p>
                    </div>
                  </div>
                  <Switch checked={themeConfig.stock_urgency_enabled !== false} onCheckedChange={v => updateThemeConfig("stock_urgency_enabled", v)} />
                </div>
                {themeConfig.stock_urgency_enabled !== false && (
                  <div className="grid grid-cols-2 gap-4 pl-13">
                    <div className="space-y-1.5">
                      <Label className="text-xs">Texte personnalisé</Label>
                      <Input value={themeConfig.stock_urgency_text || "🔥 Dépêchez-vous ! Seulement {stock} restant(s) en stock"} onChange={e => updateThemeConfig("stock_urgency_text", e.target.value)} placeholder="Utilisez {stock} pour le nombre" />
                    </div>
                    <ColorField label="Couleur barre" value={themeConfig.stock_urgency_color || "#ef4444"} onChange={v => updateThemeConfig("stock_urgency_color", v)} />
                  </div>
                )}
              </Card>

              {/* Product page layout */}
              <div className="space-y-3">
                <Label className="text-sm font-semibold">Mise en page</Label>
                <div className="grid grid-cols-3 gap-3">
                  {["standard", "large_image", "gallery"].map(layout => (
                    <button key={layout} onClick={() => updateThemeConfig("product_layout", layout)}
                      className={`p-4 rounded-xl border-2 text-center transition-all text-sm ${themeConfig.product_layout === layout ? "border-primary bg-primary/5 font-semibold" : "border-muted hover:border-muted-foreground/30"}`}>
                      {layout === "standard" ? "Standard" : layout === "large_image" ? "Grande image" : "Galerie"}
                    </button>
                  ))}
                </div>
              </div>

              {/* Related products toggle */}
              <Card className="p-5 space-y-2 border-dashed">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-sm">Suggestions « Autres produits »</p>
                    <p className="text-xs text-muted-foreground">Affiche d'autres produits de la boutique sous chaque fiche produit. Désactivez pour focaliser le visiteur sur le produit de la publicité.</p>
                  </div>
                  <Switch checked={!!themeConfig.show_related_products} onCheckedChange={v => updateThemeConfig("show_related_products", v)} />
                </div>
              </Card>
            </div>
          )}

          {activeThemeSection === "checkout" && (
            <div className="space-y-6">
              <h3 className="font-bold">Paramètres du check-out</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <ColorField label="Couleur bouton" value={themeConfig.checkout_btn_color || shop.primary_color || "#2563eb"} onChange={v => updateThemeConfig("checkout_btn_color", v)} />
                <ColorField label="Texte bouton" value={themeConfig.checkout_btn_text || "#FFFFFF"} onChange={v => updateThemeConfig("checkout_btn_text", v)} />
                <ColorField label="Arrière-plan" value={themeConfig.checkout_bg || "#FFFFFF"} onChange={v => updateThemeConfig("checkout_bg", v)} />
                <ColorField label="Couleur texte" value={themeConfig.checkout_text || "#000000"} onChange={v => updateThemeConfig("checkout_text", v)} />
              </div>
            </div>
          )}

          {activeThemeSection === "banner" && (
            <div className="space-y-6">
              <h3 className="font-bold">Bannière inférieure du panier</h3>
              <div className="flex items-center justify-between">
                <span className="text-sm">Activer la bannière</span>
                <Switch checked={themeConfig.cart_banner_enabled || false} onCheckedChange={v => updateThemeConfig("cart_banner_enabled", v)} />
              </div>
              {themeConfig.cart_banner_enabled && (
                <>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Texte de la bannière</Label>
                    <Input value={themeConfig.cart_banner_text || "🚚 Livraison gratuite pour les commandes de plus de 10 000 FCFA"} onChange={e => updateThemeConfig("cart_banner_text", e.target.value)} />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <ColorField label="Couleur arrière-plan" value={themeConfig.cart_banner_bg || "#FEF3C7"} onChange={v => updateThemeConfig("cart_banner_bg", v)} />
                    <ColorField label="Couleur texte" value={themeConfig.cart_banner_text_color || "#92400E"} onChange={v => updateThemeConfig("cart_banner_text_color", v)} />
                  </div>
                </>
              )}
            </div>
          )}

          {activeThemeSection === "homepage" && (
            <div className="space-y-6">
              <h3 className="font-bold">Paramètres de la page d'accueil</h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div><p className="text-sm font-medium">Section Hero</p><p className="text-xs text-muted-foreground">Bannière principale avec image et texte</p></div>
                  <Switch checked={themeConfig.hero_enabled !== false} onCheckedChange={v => updateThemeConfig("hero_enabled", v)} />
                </div>
                <div className="flex items-center justify-between">
                  <div><p className="text-sm font-medium">Produits en vedette</p><p className="text-xs text-muted-foreground">Afficher les produits marqués comme vedette</p></div>
                  <Switch checked={themeConfig.featured_enabled !== false} onCheckedChange={v => updateThemeConfig("featured_enabled", v)} />
                </div>
                <div className="flex items-center justify-between">
                  <div><p className="text-sm font-medium">Section contact</p><p className="text-xs text-muted-foreground">Section "Une question ?" en bas de page</p></div>
                  <Switch checked={themeConfig.contact_section_enabled !== false} onCheckedChange={v => updateThemeConfig("contact_section_enabled", v)} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Produits par ligne (desktop)</Label>
                  <div className="flex gap-2">
                    {[3, 4, 5].map(n => (
                      <button key={n} onClick={() => updateThemeConfig("products_per_row", n)}
                        className={`px-4 py-2 rounded-lg border-2 text-sm font-medium transition-all ${(themeConfig.products_per_row || 4) === n ? "border-primary bg-primary/5" : "border-muted"}`}>
                        {n} colonnes
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="space-y-2">
      <Label className="text-xs">{label}</Label>
      <div className="flex items-center gap-2 border rounded-lg px-2 py-1.5">
        <input type="color" value={value.substring(0, 7)} onChange={e => onChange(e.target.value)} className="h-8 w-8 rounded cursor-pointer border-0" />
        <Input value={value} onChange={e => onChange(e.target.value)} className="border-0 shadow-none h-8 text-xs font-mono p-0 focus-visible:ring-0" />
      </div>
    </div>
  );
}

function AnimationControls({ mode, speed, onModeChange, onSpeedChange }: { mode: string; speed: number; onModeChange: (v: string) => void; onSpeedChange: (v: number) => void }) {
  const isScroll = mode === "scroll";
  const isBlink = mode === "blink";
  const min = isBlink ? 0.4 : 6;
  const max = isBlink ? 4 : 60;
  const step = isBlink ? 0.1 : 1;
  // For scroll: slider goes left = lent (large duration), right = rapide (small duration). Invert visually.
  const sliderValue = isBlink ? speed : max + min - speed;
  const handleSlider = (v: number[]) => {
    const val = v[0];
    onSpeedChange(isBlink ? val : max + min - val);
  };
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border rounded-xl p-4 bg-muted/10">
      <div className="space-y-2">
        <Label className="text-xs">Type d'animation</Label>
        <Select value={mode} onValueChange={onModeChange}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="static">Statique (sans animation)</SelectItem>
            <SelectItem value="scroll">Défilement linéaire (droite → gauche)</SelectItem>
            <SelectItem value="blink">Scintillement</SelectItem>
          </SelectContent>
        </Select>
      </div>
      {(isScroll || isBlink) && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-xs">Vitesse</Label>
            <span className="text-xs text-muted-foreground">{isBlink ? `${speed.toFixed(1)}s / cycle` : `${speed}s / boucle`}</span>
          </div>
          <Slider min={min} max={max} step={step} value={[sliderValue]} onValueChange={handleSlider} />
          <div className="flex justify-between text-[10px] text-muted-foreground">
            <span>Lent</span><span>Rapide</span>
          </div>
        </div>
      )}
    </div>
  );
}

function ReviewLivePreview({ themeConfig, variant }: { themeConfig: any; variant: "desktop" | "mobile" }) {
  const Icon = variant === "desktop" ? Monitor : Smartphone;
  const html = variant === "desktop"
    ? (themeConfig.review_bar_desktop_content || "")
    : (themeConfig.review_bar_mobile_content || themeConfig.review_bar_desktop_content || "");
  const textColor = variant === "desktop"
    ? (themeConfig.review_desktop_text || "#FFFFFF")
    : (themeConfig.review_mobile_text || "#FFFFFF");
  const bgColor = variant === "desktop"
    ? (themeConfig.review_desktop_bg || "#803160")
    : (themeConfig.review_mobile_bg || "#000000");

  const sanitized = DOMPurify.sanitize(html, {
    ALLOWED_TAGS: ["p", "br", "strong", "b", "em", "i", "u", "s", "span", "div", "img", "a", "ul", "ol", "li", "h1", "h2", "h3", "h4", "h5", "h6", "table", "thead", "tbody", "tr", "td", "th", "hr", "font"],
    ALLOWED_ATTR: ["href", "src", "alt", "title", "target", "rel", "style", "class", "color", "size", "face", "align"],
  });

  const frameClass = variant === "desktop"
    ? "rounded-lg border bg-background overflow-hidden"
    : "mx-auto rounded-[1.4rem] border-[8px] border-slate-900 bg-white overflow-hidden";
  const innerStyle = variant === "mobile" ? { width: 320 } : undefined;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
        <Icon className="h-3.5 w-3.5" />
        Aperçu en direct ({variant === "desktop" ? "ordinateur" : "mobile"}) — tel qu'il s'affichera sur la boutique
      </div>
      <div className={frameClass} style={innerStyle}>
        {html.trim() ? (
          <div style={{ color: textColor, backgroundColor: bgColor }}>
            <div
              className="mx-auto max-w-7xl px-3 py-2 text-center text-sm font-medium leading-relaxed [&_a]:underline [&_img]:mx-auto [&_img]:max-h-28 [&_img]:max-w-full [&_img]:rounded-md [&_p]:mb-1.5 [&_p:last-child]:mb-0"
              dangerouslySetInnerHTML={{ __html: sanitized }}
            />
          </div>
        ) : (
          <div className="px-3 py-4 text-center text-xs text-muted-foreground">
            Saisissez du contenu pour voir l'aperçu…
          </div>
        )}
      </div>
    </div>
  );
}


