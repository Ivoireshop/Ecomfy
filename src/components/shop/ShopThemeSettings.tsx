import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Settings, Layout, Tag, ShoppingCart as CartIcon, MessageSquare, Home, Smartphone, Monitor, Type, Timer, TrendingDown, Plus, Trash2, ArrowUp, ArrowDown, Store, Palette } from "lucide-react";
import { RichTextEditor } from "./RichTextEditor";
import DOMPurify from "dompurify";
import { getCheckoutThemeStyles } from "@/lib/productAppearance";

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
    <div className="max-w-7xl mx-auto space-y-8 pb-12">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-primary/10 rounded-xl text-primary shrink-0">
            <Layout className="h-8 w-8" />
          </div>
          <div>
            <h2 className="text-2xl md:text-3xl font-bold text-foreground">Apparence & Thème</h2>
            <p className="text-muted-foreground mt-1 text-sm md:text-base">
              Personnalisez le design de votre boutique pour refléter votre identité.
            </p>
          </div>
        </div>
      </div>

      <div className="bg-blue-50/50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900/50 rounded-xl p-4 flex items-start gap-3">
        <div className="mt-0.5 text-blue-500"><Settings className="h-5 w-5" /></div>
        <p className="text-sm text-blue-800 dark:text-blue-300 leading-relaxed">
          <strong>À l'exception des paramètres de paiement</strong>, tous les paramètres sur cette page personnalisent l'apparence publique de votre boutique.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8">
        {/* Sidebar */}
        <div className="lg:col-span-3">
          <Card className="p-4 rounded-2xl shadow-sm border-border/50 sticky top-24">
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-4 px-2">Réglages</p>
            <nav className="space-y-1.5">
              {THEME_SECTIONS.map(section => {
                const isActive = activeThemeSection === section.id;
                return (
                  <button
                    key={section.id}
                    onClick={() => setActiveThemeSection(section.id)}
                    className={`w-full flex items-center gap-3 px-3.5 py-3 rounded-xl text-sm font-medium transition-all text-left group ${
                      isActive
                        ? "bg-primary text-primary-foreground shadow-sm shadow-primary/25"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground"
                    }`}
                  >
                    <section.icon className={`h-4 w-4 shrink-0 transition-colors ${isActive ? "text-primary-foreground" : "text-muted-foreground group-hover:text-primary"}`} />
                    {section.label}
                  </button>
                );
              })}
            </nav>
          </Card>
        </div>

        {/* Content */}
        <div className="lg:col-span-9 space-y-6">
          {activeThemeSection === "header" && (
            <Card className="p-6 md:p-8 rounded-2xl shadow-sm border-border/50 animate-in fade-in slide-in-from-bottom-2 duration-300">
              {/* Global Header Display Mode Setting */}
              <div className="p-5 rounded-2xl bg-gradient-to-r from-primary/10 via-primary/5 to-transparent border-2 border-primary/20 space-y-4 mb-8">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <h3 className="font-extrabold text-base flex items-center gap-2 text-foreground">
                      <Store className="h-5 w-5 text-primary" /> Mode d'affichage du Logo & du Nom dans l'en-tête
                    </h3>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Choisissez comment votre marque s'affiche en haut de la vitrine d'accueil et sur toutes vos fiches produits.
                    </p>
                  </div>
                  <span className="text-[11px] font-bold px-3 py-1 rounded-full bg-primary/15 text-primary border border-primary/30 shrink-0 self-start sm:self-auto">
                    ✨ S'applique à l'accueil &amp; aux fiches produits
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                  {[
                    {
                      id: "logo_only",
                      title: "Logo uniquement",
                      desc: "Affichage idéal par défaut — Masque le nom texte pour éviter tout doublon si le nom est déjà écrit dans l'image du logo.",
                      badge: "Recommandé"
                    },
                    {
                      id: "both",
                      title: "Logo + Nom de boutique",
                      desc: "Affiche l'image du logo suivie du nom texte de la boutique côte à côte.",
                      badge: "Classique"
                    },
                    {
                      id: "name_only",
                      title: "Nom texte uniquement",
                      desc: "Masque l'image du logo et affiche uniquement le nom texte de la boutique.",
                      badge: "Texte pur"
                    },
                  ].map((mode) => {
                    const isSelected = (themeConfig.header_display_mode || "logo_only") === mode.id;
                    return (
                      <button
                        key={mode.id}
                        type="button"
                        onClick={() => updateThemeConfig("header_display_mode", mode.id)}
                        className={`p-4 rounded-xl border-2 text-left transition-all relative flex flex-col justify-between cursor-pointer ${
                          isSelected
                            ? "border-primary bg-background shadow-md ring-2 ring-primary/20"
                            : "border-muted/80 bg-background/60 hover:border-primary/40 hover:bg-background"
                        }`}
                      >
                        <div>
                          <div className="flex items-center justify-between gap-1 mb-1.5">
                            <span className={`font-black text-sm ${isSelected ? "text-primary" : "text-foreground"}`}>
                              {mode.title}
                            </span>
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                              isSelected ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                            }`}>
                              {mode.badge}
                            </span>
                          </div>
                          <p className="text-xs text-muted-foreground leading-relaxed">
                            {mode.desc}
                          </p>
                        </div>
                        {isSelected && (
                          <div className="mt-3 text-[11px] font-extrabold text-primary flex items-center gap-1">
                            ✓ Sélectionné
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              <Tabs defaultValue="mobile" className="w-full">
                <div className="w-full overflow-x-auto pb-3 pt-1 scrollbar-thin scrollbar-thumb-muted-foreground/20 mb-6">
                  <TabsList className="inline-flex h-auto p-1.5 bg-muted/60 rounded-2xl border gap-1.5 min-w-max">
                    {[
                      { id: "mobile", label: "En-tête Mobile", icon: Smartphone },
                      { id: "desktop", label: "En-tête Ordinateur", icon: Monitor },
                      { id: "footer", label: "Pied de page (Footer)", icon: Layout },
                      { id: "review_desktop", label: "Barre d'avis Ordinateur", icon: MessageSquare },
                      { id: "review_mobile", label: "Barre d'avis Mobile", icon: Smartphone },
                    ].map((tab) => (
                      <TabsTrigger 
                        key={tab.id} 
                        value={tab.id} 
                        className="rounded-xl px-4 py-2.5 text-xs font-bold gap-2 data-[state=active]:bg-background data-[state=active]:text-primary data-[state=active]:shadow-md transition-all cursor-pointer"
                      >
                        <tab.icon className="h-3.5 w-3.5" />
                        {tab.label}
                      </TabsTrigger>
                    ))}
                  </TabsList>
                </div>

                <TabsContent value="mobile" className="space-y-6">
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 p-5 rounded-2xl bg-muted/20 border">
                    <ColorField label="Arrière-plan en-tête" value={themeConfig.header_mobile_bg || "#FFFFFF"} onChange={v => updateThemeConfig("header_mobile_bg", v)} />
                    <ColorField label="Couleur des icônes" value={themeConfig.header_mobile_btn || "#000000"} onChange={v => updateThemeConfig("header_mobile_btn", v)} />
                    <div className="space-y-2">
                      <Label className="text-xs font-semibold">Bordure inférieure</Label>
                      <div className="flex items-center justify-between bg-background border rounded-xl px-3 py-2.5 h-11">
                        <span className="text-xs font-medium">Activer la bordure</span>
                        <Switch checked={themeConfig.header_mobile_border !== false} onCheckedChange={v => updateThemeConfig("header_mobile_border", v)} />
                      </div>
                    </div>
                    <ColorField label="Couleur de bordure" value={themeConfig.header_mobile_border_color || "#F0F0F0"} onChange={v => updateThemeConfig("header_mobile_border_color", v)} />
                  </div>
                </TabsContent>

                <TabsContent value="desktop" className="space-y-6">
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 p-5 rounded-2xl bg-muted/20 border">
                    <ColorField label="Arrière-plan en-tête" value={themeConfig.header_desktop_bg || "#FFFFFF"} onChange={v => updateThemeConfig("header_desktop_bg", v)} />
                    <ColorField label="Couleur des icônes" value={themeConfig.header_desktop_btn || "#000000"} onChange={v => updateThemeConfig("header_desktop_btn", v)} />
                    <div className="space-y-2">
                      <Label className="text-xs font-semibold">Bordure inférieure</Label>
                      <div className="flex items-center justify-between bg-background border rounded-xl px-3 py-2.5 h-11">
                        <span className="text-xs font-medium">Activer la bordure</span>
                        <Switch checked={themeConfig.header_desktop_border !== false} onCheckedChange={v => updateThemeConfig("header_desktop_border", v)} />
                      </div>
                    </div>
                    <ColorField label="Couleur de bordure" value={themeConfig.header_desktop_border_color || "#F0F0F0"} onChange={v => updateThemeConfig("header_desktop_border_color", v)} />
                  </div>

                  {/* Réglages d'animation & format du Logo */}
                  <div className="space-y-4 p-5 rounded-2xl bg-muted/20 border">
                    <div>
                      <h4 className="font-bold text-base flex items-center gap-2">
                        <Store className="h-5 w-5 text-primary" /> Format &amp; Effet Visuel du Logo
                      </h4>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Tous les formats de logo (rectangulaire, carré, circulaire, GIF animé, PNG, SVG) sont pris en charge sans aucun rognage ni zoom forcé.
                      </p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t">
                      <div className="space-y-2">
                        <Label className="text-xs font-semibold">Effet d'animation du logo</Label>
                        <Select 
                          value={themeConfig.logo_effect || "none"} 
                          onValueChange={v => updateThemeConfig("logo_effect", v)}
                        >
                          <SelectTrigger className="h-10 text-sm">
                            <SelectValue placeholder="Choisir un effet" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">Statique (Net par défaut)</SelectItem>
                            <SelectItem value="shimmer">✨ Scintillement lumineux (Animation / GIF)</SelectItem>
                            <SelectItem value="glow">🌟 Aura Lumineuse (Neon Glow)</SelectItem>
                            <SelectItem value="bounce">🎈 Rebond au survol (Hover Bounce)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      {shop.logo_url && (
                        <div className="space-y-2">
                          <Label className="text-xs font-semibold">Aperçu en direct du logo</Label>
                          <div className="h-10 rounded-xl border bg-card p-2 flex items-center justify-center overflow-hidden">
                            <img 
                              src={shop.logo_url} 
                              alt="Logo" 
                              className={`max-h-7 w-auto max-w-[200px] object-contain ${
                                themeConfig.logo_effect === "shimmer" ? "animate-pulse brightness-110" : ""
                              } ${
                                themeConfig.logo_effect === "glow" ? "drop-shadow-[0_0_8px_rgba(37,99,235,0.8)]" : ""
                              } ${
                                themeConfig.logo_effect === "bounce" ? "hover:animate-bounce" : ""
                              }`}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="footer" className="space-y-6">
                  <div className="flex items-center justify-between p-4 rounded-xl border bg-muted/20">
                    <div>
                      <p className="font-bold text-sm">Pied de page (Footer) personnalisé</p>
                      <p className="text-xs text-muted-foreground">Activer des couleurs sur mesure pour le bas de page.</p>
                    </div>
                    <Switch checked={themeConfig.footer_custom || false} onCheckedChange={v => updateThemeConfig("footer_custom", v)} />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 p-5 rounded-2xl bg-muted/20 border">
                    <ColorField label="Arrière-plan footer" value={themeConfig.footer_bg || "#FEFEFE"} onChange={v => updateThemeConfig("footer_bg", v)} />
                    <ColorField label="Couleur texte" value={themeConfig.footer_text || "#000000"} onChange={v => updateThemeConfig("footer_text", v)} />
                    <div className="space-y-2">
                      <Label className="text-xs font-semibold">Bordure supérieure</Label>
                      <div className="flex items-center justify-between bg-background border rounded-xl px-3 py-2.5 h-11">
                        <span className="text-xs font-medium">Activer la bordure</span>
                        <Switch checked={themeConfig.footer_border !== false} onCheckedChange={v => updateThemeConfig("footer_border", v)} />
                      </div>
                    </div>
                    <ColorField label="Couleur bordure" value={themeConfig.footer_border_color || "#4A4A4A"} onChange={v => updateThemeConfig("footer_border_color", v)} />
                  </div>
                  
                  {/* Option Premium : Masquer le branding Ecomfy */}
                  <div className="pt-6 mt-6 border-t border-border">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 rounded-xl border border-emerald-500/30 bg-emerald-50/50 dark:bg-emerald-950/20">
                      <div>
                        <h4 className="font-semibold flex items-center gap-2">
                          <span className="text-emerald-600 dark:text-emerald-400">👑 Premium :</span>
                          Masquer "Propulsé par Ecomfy"
                        </h4>
                        <p className="text-sm text-muted-foreground mt-1 max-w-lg">
                          Retirez la mention Ecomfy du pied de page de votre boutique pour une apparence 100% en marque blanche.
                        </p>
                      </div>
                      <Switch 
                        checked={themeConfig.hide_ecomfy_branding === true} 
                        onCheckedChange={v => {
                          import("@/lib/premium").then(({ isPremiumShop }) => {
                            if (!isPremiumShop(shop)) {
                              import("@/hooks/use-toast").then(({ toast }) => {
                                toast({
                                  title: "Fonctionnalité Premium",
                                  description: "Cette option est réservée aux abonnements Premium.",
                                  variant: "destructive"
                                });
                              });
                              return;
                            }
                            updateThemeConfig("hide_ecomfy_branding", v);
                          });
                        }} 
                      />
                    </div>
                  </div>

                </TabsContent>

                <TabsContent value="review_desktop" className="space-y-6">
                  <MessagesEditor
                    label="Messages de la barre d'avis (ordinateur)"
                    messages={getMessages(themeConfig, "desktop")}
                    separator={themeConfig.review_desktop_separator ?? " • "}
                    onChangeMessages={v => {
                      updateThemeConfig("review_desktop_messages", v);
                      updateThemeConfig("review_bar_desktop_content", v[0] || "");
                    }}
                    onChangeSeparator={v => updateThemeConfig("review_desktop_separator", v)}
                  />
                  <ReviewLivePreview themeConfig={themeConfig} variant="desktop" />
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 p-5 rounded-2xl bg-muted/20 border">
                    <ColorField label="Couleur du texte" value={themeConfig.review_desktop_text || "#FFFFFF"} onChange={v => updateThemeConfig("review_desktop_text", v)} />
                    <ColorField label="Couleur arrière-plan" value={themeConfig.review_desktop_bg || "#803160"} onChange={v => updateThemeConfig("review_desktop_bg", v)} />
                    <div className="space-y-2">
                      <Label className="text-xs font-semibold">Positionnement</Label>
                      <div className="flex items-center justify-between bg-background border rounded-xl px-3 py-2.5 h-11">
                        <span className="text-xs font-medium">Au-dessus de l'en-tête</span>
                        <Switch checked={themeConfig.review_desktop_above || false} onCheckedChange={v => updateThemeConfig("review_desktop_above", v)} />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs font-semibold">Statut d'affichage</Label>
                      <div className="flex items-center justify-between bg-background border rounded-xl px-3 py-2.5 h-11">
                        <span className="text-xs font-medium">Activer la barre</span>
                        <Switch checked={themeConfig.review_desktop_active !== false} onCheckedChange={v => updateThemeConfig("review_desktop_active", v)} />
                      </div>
                    </div>
                  </div>
                  <AnimationControls
                    mode={themeConfig.review_desktop_anim || (themeConfig.review_desktop_scroll ? "scroll" : "static")}
                    speed={Number(themeConfig.review_desktop_speed) || (themeConfig.review_desktop_anim === "blink" ? 1.5 : 22)}
                    blinkAlign={themeConfig.review_desktop_blink_align || "center"}
                    onModeChange={v => updateThemeConfig("review_desktop_anim", v)}
                    onSpeedChange={v => updateThemeConfig("review_desktop_speed", v)}
                    onBlinkAlignChange={v => updateThemeConfig("review_desktop_blink_align", v)}
                  />
                </TabsContent>

                <TabsContent value="review_mobile" className="space-y-6">
                  <MessagesEditor
                    label="Messages de la barre d'avis (mobile)"
                    messages={getMessages(themeConfig, "mobile")}
                    separator={themeConfig.review_mobile_separator ?? " • "}
                    onChangeMessages={v => {
                      updateThemeConfig("review_mobile_messages", v);
                      updateThemeConfig("review_bar_mobile_content", v[0] || "");
                    }}
                    onChangeSeparator={v => updateThemeConfig("review_mobile_separator", v)}
                  />
                  <ReviewLivePreview themeConfig={themeConfig} variant="mobile" />
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 p-5 rounded-2xl bg-muted/20 border">
                    <ColorField label="Couleur du texte" value={themeConfig.review_mobile_text || themeConfig.review_desktop_text || "#FFFFFF"} onChange={v => updateThemeConfig("review_mobile_text", v)} />
                    <ColorField label="Couleur arrière-plan" value={themeConfig.review_mobile_bg || themeConfig.review_desktop_bg || "#803160"} onChange={v => updateThemeConfig("review_mobile_bg", v)} />
                    <div className="space-y-2">
                      <Label className="text-xs font-semibold">Positionnement</Label>
                      <div className="flex items-center justify-between bg-background border rounded-xl px-3 py-2.5 h-11">
                        <span className="text-xs font-medium">Au-dessus de l'en-tête</span>
                        <Switch checked={themeConfig.review_mobile_above || false} onCheckedChange={v => updateThemeConfig("review_mobile_above", v)} />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs font-semibold">Statut d'affichage</Label>
                      <div className="flex items-center justify-between bg-background border rounded-xl px-3 py-2.5 h-11">
                        <span className="text-xs font-medium">Activer la barre</span>
                        <Switch checked={themeConfig.review_mobile_active !== false} onCheckedChange={v => updateThemeConfig("review_mobile_active", v)} />
                      </div>
                    </div>
                  </div>
                  <AnimationControls
                    mode={themeConfig.review_mobile_anim || (themeConfig.review_mobile_scroll ? "scroll" : "static")}
                    speed={Number(themeConfig.review_mobile_speed) || (themeConfig.review_mobile_anim === "blink" ? 1.5 : 22)}
                    blinkAlign={themeConfig.review_mobile_blink_align || "center"}
                    onModeChange={v => updateThemeConfig("review_mobile_anim", v)}
                    onSpeedChange={v => updateThemeConfig("review_mobile_speed", v)}
                    onBlinkAlignChange={v => updateThemeConfig("review_mobile_blink_align", v)}
                  />
                </TabsContent>
              </Tabs>
            </Card>
          )}

          {activeThemeSection === "product" && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg"><Tag className="h-5 w-5" /></div>
                <h3 className="text-xl font-bold">Fiche Produit</h3>
              </div>

              {/* Compte à rebours */}
              <Card className="p-6 md:p-8 rounded-2xl shadow-sm border-border/50 overflow-hidden relative">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-4">
                    <div className="h-12 w-12 rounded-xl bg-orange-50 text-orange-600 flex items-center justify-center shrink-0">
                      <Timer className="h-6 w-6" />
                    </div>
                    <div>
                      <p className="text-lg font-bold">Compte à rebours</p>
                      <p className="text-sm text-muted-foreground">Crée un sentiment d'urgence pour accélérer les achats.</p>
                    </div>
                  </div>
                  <Switch checked={themeConfig.countdown_enabled || false} onCheckedChange={v => updateThemeConfig("countdown_enabled", v)} />
                </div>
                {themeConfig.countdown_enabled && (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-5 bg-muted/20 border rounded-xl animate-in fade-in">
                    <div className="space-y-2">
                      <Label className="text-xs font-semibold">Jours</Label>
                      <Input type="number" min={0} max={30} value={themeConfig.countdown_days || 0} onChange={e => updateThemeConfig("countdown_days", parseInt(e.target.value) || 0)} className="h-11 bg-background" />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs font-semibold">Heures</Label>
                      <Input type="number" min={0} max={23} value={themeConfig.countdown_hours || 12} onChange={e => updateThemeConfig("countdown_hours", parseInt(e.target.value) || 0)} className="h-11 bg-background" />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs font-semibold">Minutes</Label>
                      <Input type="number" min={0} max={59} value={themeConfig.countdown_minutes || 0} onChange={e => updateThemeConfig("countdown_minutes", parseInt(e.target.value) || 0)} className="h-11 bg-background" />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs font-semibold">Couleur d'accentuation</Label>
                      <div className="flex items-center gap-2 border bg-background rounded-lg p-1 h-11">
                        <input type="color" value={(themeConfig.countdown_color || "#dc2626").substring(0, 7)} onChange={e => updateThemeConfig("countdown_color", e.target.value)} className="h-8 w-8 rounded cursor-pointer border-0 p-0" />
                        <Input value={themeConfig.countdown_color || "#dc2626"} onChange={e => updateThemeConfig("countdown_color", e.target.value)} className="border-0 shadow-none h-8 text-sm font-mono p-0 focus-visible:ring-0 bg-transparent" />
                      </div>
                    </div>
                  </div>
                )}
              </Card>

              {/* Indicateur de stock */}
              <Card className="p-6 md:p-8 rounded-2xl shadow-sm border-border/50 overflow-hidden relative">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-4">
                    <div className="h-12 w-12 rounded-xl bg-red-50 text-red-600 flex items-center justify-center shrink-0">
                      <TrendingDown className="h-6 w-6" />
                    </div>
                    <div>
                      <p className="text-lg font-bold">Indicateur de stock</p>
                      <p className="text-sm text-muted-foreground">Affiche un compteur de stock animé pour mettre la pression.</p>
                    </div>
                  </div>
                  <Switch checked={themeConfig.stock_urgency_enabled !== false} onCheckedChange={v => updateThemeConfig("stock_urgency_enabled", v)} />
                </div>
                {themeConfig.stock_urgency_enabled !== false && (
                  <div className="space-y-6 pt-2 animate-in fade-in">
                    <div className="space-y-3">
                      <Label className="text-sm font-semibold block">Style d'affichage du stock</Label>
                      <div className="grid md:grid-cols-2 gap-3">
                        <button type="button" onClick={() => updateThemeConfig("stock_display_style", "bar")}
                          className={`flex items-start gap-3 p-4 rounded-xl border-2 text-left transition-all ${(!themeConfig.stock_display_style || themeConfig.stock_display_style === "bar") ? "border-primary bg-primary/5 ring-1 ring-primary/20" : "border-border/60 hover:border-border hover:bg-muted/30"}`}>
                          <div className={`p-2 rounded-lg shrink-0 ${(!themeConfig.stock_display_style || themeConfig.stock_display_style === "bar") ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}><Layout className="h-4 w-4" /></div>
                          <div>
                            <p className={`font-bold ${(!themeConfig.stock_display_style || themeConfig.stock_display_style === "bar") ? "text-primary" : ""}`}>📊 Barre d'urgence</p>
                            <p className="text-xs text-muted-foreground mt-0.5">Diminue visuellement à chaque commande</p>
                          </div>
                        </button>
                        <button type="button" onClick={() => updateThemeConfig("stock_display_style", "text")}
                          className={`flex items-start gap-3 p-4 rounded-xl border-2 text-left transition-all ${themeConfig.stock_display_style === "text" ? "border-primary bg-primary/5 ring-1 ring-primary/20" : "border-border/60 hover:border-border hover:bg-muted/30"}`}>
                          <div className={`p-2 rounded-lg shrink-0 ${themeConfig.stock_display_style === "text" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}><Type className="h-4 w-4" /></div>
                          <div>
                            <p className={`font-bold ${themeConfig.stock_display_style === "text" ? "text-primary" : ""}`}>✓ Étiquette « En stock »</p>
                            <p className="text-xs text-muted-foreground mt-0.5">Texte coloré avec quantité restante</p>
                          </div>
                        </button>
                      </div>
                    </div>

                    <div className="grid md:grid-cols-12 gap-6 p-5 bg-muted/20 border rounded-xl">
                      <div className="md:col-span-12 space-y-2">
                        <Label className="text-xs font-semibold">Texte personnalisé</Label>
                        <Input value={themeConfig.stock_urgency_text || "🔥 Dépêchez-vous ! Seulement {stock} restant(s) en stock"} onChange={e => updateThemeConfig("stock_urgency_text", e.target.value)} placeholder="Utilisez {stock} pour le nombre" className="h-11 bg-background" />
                        <p className="text-[11px] text-muted-foreground">La variable <code>{`{stock}`}</code> sera remplacée par le chiffre dynamique.</p>
                      </div>
                      <div className="md:col-span-6 space-y-2">
                        <Label className="text-xs font-semibold">Couleur barre / texte urgence</Label>
                        <div className="flex items-center gap-2 border bg-background rounded-lg p-1 h-11">
                          <input type="color" value={(themeConfig.stock_urgency_color || "#ef4444").substring(0, 7)} onChange={e => updateThemeConfig("stock_urgency_color", e.target.value)} className="h-8 w-8 rounded cursor-pointer border-0 p-0" />
                          <Input value={themeConfig.stock_urgency_color || "#ef4444"} onChange={e => updateThemeConfig("stock_urgency_color", e.target.value)} className="border-0 shadow-none h-8 text-sm font-mono p-0 focus-visible:ring-0 bg-transparent" />
                        </div>
                      </div>
                      <div className="md:col-span-6 space-y-2">
                        <Label className="text-xs font-semibold">Couleur étiquette « En stock »</Label>
                        <div className="flex items-center gap-2 border bg-background rounded-lg p-1 h-11">
                          <input type="color" value={(themeConfig.stock_text_color || "#16a34a").substring(0, 7)} onChange={e => updateThemeConfig("stock_text_color", e.target.value)} className="h-8 w-8 rounded cursor-pointer border-0 p-0" />
                          <Input value={themeConfig.stock_text_color || "#16a34a"} onChange={e => updateThemeConfig("stock_text_color", e.target.value)} className="border-0 shadow-none h-8 text-sm font-mono p-0 focus-visible:ring-0 bg-transparent" />
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </Card>

              {/* Avis & Etoiles */}
              <Card className="p-6 md:p-8 rounded-2xl shadow-sm border-border/50">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-4">
                    <div className="h-12 w-12 rounded-xl bg-yellow-50 text-yellow-600 flex items-center justify-center shrink-0">
                      <Plus className="h-6 w-6" />
                    </div>
                    <div>
                      <p className="text-lg font-bold">Avis & Étoiles</p>
                      <p className="text-sm text-muted-foreground">Affiche 5 étoiles et un compteur d'avis pour renforcer la confiance.</p>
                    </div>
                  </div>
                  <Switch checked={themeConfig.reviews_enabled !== false} onCheckedChange={v => updateThemeConfig("reviews_enabled", v)} />
                </div>

                {themeConfig.reviews_enabled !== false && (
                  <div className="space-y-6 animate-in fade-in">
                    <div className="grid md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <Label className="text-sm font-semibold">Nombre d'avis de départ</Label>
                        <Input type="number" min={0} value={themeConfig.reviews_base_count ?? 128} onChange={e => updateThemeConfig("reviews_base_count", Number(e.target.value) || 0)} className="h-11" />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-sm font-semibold">Note moyenne (sur 5)</Label>
                        <Input type="number" min={1} max={5} step={0.1} value={themeConfig.reviews_rating ?? 5} onChange={e => updateThemeConfig("reviews_rating", Math.min(5, Math.max(1, Number(e.target.value) || 5)))} className="h-11" />
                      </div>
                    </div>

                    <div className="space-y-3">
                      <div className="flex items-center justify-between p-4 rounded-xl border bg-muted/10">
                        <div>
                          <p className="text-sm font-bold text-foreground">Augmentation automatique</p>
                          <p className="text-xs text-muted-foreground mt-0.5">Ajoute +1 avis pour chaque commande passée sur la boutique.</p>
                        </div>
                        <Switch checked={themeConfig.reviews_increment_with_orders !== false} onCheckedChange={v => updateThemeConfig("reviews_increment_with_orders", v)} />
                      </div>
                      
                      <div className={`p-4 rounded-xl border transition-colors ${themeConfig.reviews_realistic_mode ? "bg-primary/5 border-primary/20" : "bg-muted/10"}`}>
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-bold text-foreground">Mode de variation réaliste</p>
                            <p className="text-xs text-muted-foreground mt-0.5">Le nombre d'avis varie légèrement chaque jour pour paraître crédible.</p>
                          </div>
                          <Switch checked={!!themeConfig.reviews_realistic_mode} onCheckedChange={v => updateThemeConfig("reviews_realistic_mode", v)} />
                        </div>
                        
                        {themeConfig.reviews_realistic_mode && (
                          <div className="grid grid-cols-2 gap-4 mt-4 pt-4 border-t border-border/50">
                            <div className="space-y-2">
                              <Label className="text-xs font-semibold">Avis minimum</Label>
                              <Input type="number" min={0} value={themeConfig.reviews_min ?? 120} onChange={e => updateThemeConfig("reviews_min", Math.max(0, Number(e.target.value) || 0))} className="h-10 bg-background" />
                            </div>
                            <div className="space-y-2">
                              <Label className="text-xs font-semibold">Avis maximum</Label>
                              <Input type="number" min={0} value={themeConfig.reviews_max ?? 180} onChange={e => updateThemeConfig("reviews_max", Math.max(0, Number(e.target.value) || 0))} className="h-10 bg-background" />
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Personnalisation des Couleurs des Avis */}
                    <div className="space-y-4 pt-4 border-t border-border">
                      <h4 className="font-bold text-sm flex items-center gap-2 text-foreground">
                        <Palette className="h-4 w-4 text-primary" /> Couleurs de la Section &amp; Cartes d'Avis Clients
                      </h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 p-4 rounded-xl bg-muted/20 border">
                        <ColorField 
                          label="Fond de la section avis" 
                          value={themeConfig.reviews_section_bg || "#F9FAFB"} 
                          onChange={v => updateThemeConfig("reviews_section_bg", v)} 
                        />
                        <ColorField 
                          label="Fond des cartes d'avis" 
                          value={themeConfig.reviews_card_bg || "#FFFFFF"} 
                          onChange={v => updateThemeConfig("reviews_card_bg", v)} 
                        />
                        <ColorField 
                          label="Couleur des titres" 
                          value={themeConfig.reviews_title_color || "#0F172A"} 
                          onChange={v => updateThemeConfig("reviews_title_color", v)} 
                        />
                        <ColorField 
                          label="Couleur du texte" 
                          value={themeConfig.reviews_text_color || "#1F2937"} 
                          onChange={v => updateThemeConfig("reviews_text_color", v)} 
                        />
                      </div>
                    </div>
                  </div>
                )}
              </Card>

              {/* Mise en page */}
              <Card className="p-6 md:p-8 rounded-2xl shadow-sm border-border/50">
                <div className="flex items-center gap-4 mb-6">
                  <div className="h-12 w-12 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                    <Monitor className="h-6 w-6" />
                  </div>
                  <div>
                    <p className="text-lg font-bold">Mise en page des images</p>
                    <p className="text-sm text-muted-foreground">Définissez comment les images du produit sont présentées.</p>
                  </div>
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {[
                    { id: "standard", label: "Standard", desc: "Image fixe + miniatures", icon: <Monitor className="h-5 w-5"/> },
                    { id: "large_image", label: "Grande image", desc: "Mise en avant maximale", icon: <Layout className="h-5 w-5"/> },
                    { id: "gallery", label: "Galerie défilante", desc: "Plusieurs images visibles", icon: <Home className="h-5 w-5"/> },
                  ].map(layout => (
                    <button key={layout.id} onClick={() => updateThemeConfig("product_layout", layout.id)}
                      className={`flex flex-col items-center gap-2 p-5 rounded-xl border-2 text-center transition-all ${themeConfig.product_layout === layout.id || (!themeConfig.product_layout && layout.id === "standard") ? "border-primary bg-primary/5 shadow-sm ring-1 ring-primary/20 text-primary" : "border-border/60 hover:border-border hover:bg-muted/30 text-muted-foreground"}`}>
                      <div className={`p-3 rounded-full mb-1 ${themeConfig.product_layout === layout.id || (!themeConfig.product_layout && layout.id === "standard") ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
                        {layout.icon}
                      </div>
                      <span className="font-bold text-sm text-foreground">{layout.label}</span>
                      <span className="text-[11px] leading-tight">{layout.desc}</span>
                    </button>
                  ))}
                </div>
              </Card>

              {/* Suggestions Autres produits */}
              <Card className="p-6 md:p-8 rounded-2xl shadow-sm border-border/50">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="h-12 w-12 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center shrink-0">
                      <Tag className="h-6 w-6" />
                    </div>
                    <div>
                      <p className="text-lg font-bold">Suggestions « Autres produits »</p>
                      <p className="text-sm text-muted-foreground">Affiche d'autres produits de la boutique sous la fiche produit.</p>
                    </div>
                  </div>
                  <Switch checked={!!themeConfig.show_related_products} onCheckedChange={v => updateThemeConfig("show_related_products", v)} />
                </div>
              </Card>
            </div>
          )}

          {activeThemeSection === "checkout" && (
            <Card className="p-6 md:p-8 rounded-2xl shadow-sm border-border/50 animate-in fade-in slide-in-from-bottom-2 duration-300 space-y-6">
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <div className="p-2 bg-primary/10 text-primary rounded-lg">
                    <CartIcon className="h-5 w-5" />
                  </div>
                  <h3 className="text-xl font-bold">Paramètres du check-out</h3>
                </div>
                <p className="text-sm text-muted-foreground">
                  Personnalisez l'arrière-plan et les couleurs du formulaire de commande pour vos clients.
                </p>
              </div>

              {/* Masquer le formulaire de commande en bas de page */}
              <div className="p-5 rounded-2xl bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent border-2 border-amber-500/30 space-y-3">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-base font-extrabold text-foreground flex items-center gap-2">
                      <CartIcon className="h-5 w-5 text-amber-600" /> Masquer le formulaire doublon sous le pied de page
                    </p>
                    <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                      Activez cette option pour masquer le deuxième formulaire de commande sous le pied de page (Footer). Le formulaire principal reste <strong>incrusté directement sur la fiche produit</strong> et le bouton "Commander" effectue un <strong>défilement fluide (scroll)</strong> vers celui-ci, sans aucun Pop-up.
                    </p>
                  </div>
                  <Switch 
                    checked={themeConfig.hide_bottom_checkout === true} 
                    onCheckedChange={(v) => {
                      updateThemeConfig("hide_bottom_checkout", v);
                      if (v && themeConfig.checkout_form_position === "modal") {
                        updateThemeConfig("checkout_form_position", "inline");
                      }
                    }} 
                    className="data-[state=checked]:bg-amber-600"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 p-5 bg-muted/20 border rounded-2xl">
                <ColorField 
                  label="Couleur du titre du produit" 
                  value={themeConfig.product_title_color || (getCheckoutThemeStyles(themeConfig.checkout_bg, shop.primary_color).isDark ? "#FFFFFF" : "#0F172A")} 
                  onChange={v => updateThemeConfig("product_title_color", v)} 
                />
                <ColorField 
                  label="Couleur de fond (Checkout)" 
                  value={themeConfig.checkout_bg || "#FFFFFF"} 
                  onChange={v => updateThemeConfig("checkout_bg", v)} 
                />
                <ColorField 
                  label="Couleur bouton de commande" 
                  value={themeConfig.checkout_btn_color || shop.primary_color || "#2563eb"} 
                  onChange={v => updateThemeConfig("checkout_btn_color", v)} 
                />
                <ColorField 
                  label="Texte du bouton" 
                  value={themeConfig.checkout_btn_text || "#FFFFFF"} 
                  onChange={v => updateThemeConfig("checkout_btn_text", v)} 
                />
                <ColorField 
                  label="Couleur de texte générale" 
                  value={themeConfig.checkout_text || "#000000"} 
                  onChange={v => updateThemeConfig("checkout_text", v)} 
                />
              </div>

              <div className="flex items-center justify-between p-4 rounded-xl border bg-muted/10">
                <div>
                  <p className="font-bold text-sm">Afficher la section Méthodes de paiement</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Affiche ou masque les boutons "Paiement à la livraison" et "Mobile Money" sur le formulaire de commande public.</p>
                </div>
                <Switch 
                  checked={themeConfig.hide_payment_method_section !== true} 
                  onCheckedChange={v => updateThemeConfig("hide_payment_method_section", !v)} 
                />
              </div>

              <div className="flex items-center justify-between p-4 rounded-xl border bg-muted/10">
                <div>
                  <p className="font-bold text-sm">Afficher les indications de format sous le téléphone</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Désactivez pour masquer le texte expliquant le format (ex: Orange 07, MTN 05, Moov 01). La détection d'erreur rouge reste 100% active en cas de numéro invalide.</p>
                </div>
                <Switch 
                  checked={themeConfig.hide_phone_format_hint !== true} 
                  onCheckedChange={v => updateThemeConfig("hide_phone_format_hint", !v)} 
                />
              </div>

              {/* Aperçu en temps réel de la carte de Checkout avec la couleur sélectionnée */}
              <div className="space-y-3">
                <Label className="text-sm font-semibold flex items-center gap-2">
                  <span>Aperçu en temps réel du formulaire Checkout</span>
                </Label>
                {(() => {
                  const currentBg = themeConfig.checkout_bg || "#FFFFFF";
                  const contrastStyles = getCheckoutThemeStyles(currentBg, shop.primary_color);
                  const btnBg = themeConfig.checkout_btn_color || shop.primary_color || "#2563eb";
                  const btnText = themeConfig.checkout_btn_text || "#FFFFFF";

                  return (
                    <div 
                      className="p-6 rounded-2xl border shadow-md transition-all space-y-4"
                      style={{ backgroundColor: contrastStyles.containerBg, borderColor: contrastStyles.summaryBorder }}
                    >
                      <h4 className="font-bold text-lg flex items-center gap-2" style={{ color: contrastStyles.headingColor }}>
                        <CartIcon className="h-5 w-5" /> Finaliser votre commande
                      </h4>

                      <div className="p-4 rounded-xl space-y-2 border" style={{ backgroundColor: contrastStyles.summaryBg, borderColor: contrastStyles.summaryBorder }}>
                        <div className="text-xs font-bold uppercase tracking-wider" style={{ color: contrastStyles.mutedTextColor }}>Récapitulatif de commande</div>
                        <div className="flex justify-between text-sm font-semibold" style={{ color: contrastStyles.textColor }}>
                          <span>1x Produit Démo Ecomfy</span>
                          <span>15 000 FCFA</span>
                        </div>
                      </div>

                      <div className="space-y-3">
                        <div>
                          <label className="text-xs font-semibold block mb-1" style={{ color: contrastStyles.textColor }}>Nom complet</label>
                          <input 
                            type="text" 
                            disabled 
                            placeholder="Ex: Koffi Konan" 
                            className={`w-full h-10 rounded-lg px-3 text-sm border outline-none ${contrastStyles.inputPlaceholderClass}`}
                            style={{ 
                              backgroundColor: contrastStyles.inputBg, 
                              borderColor: contrastStyles.inputBorder,
                              color: contrastStyles.inputTextColor
                            }} 
                          />
                        </div>
                        <div>
                          <label className="text-xs font-semibold block mb-1" style={{ color: contrastStyles.textColor }}>Numéro WhatsApp / Téléphone</label>
                          <input 
                            type="text" 
                            disabled 
                            placeholder="+225 0700000000" 
                            className={`w-full h-10 rounded-lg px-3 text-sm border outline-none ${contrastStyles.inputPlaceholderClass}`}
                            style={{ 
                              backgroundColor: contrastStyles.inputBg, 
                              borderColor: contrastStyles.inputBorder,
                              color: contrastStyles.inputTextColor
                            }} 
                          />
                        </div>
                      </div>

                      <button 
                        type="button" 
                        disabled 
                        className="w-full h-11 rounded-xl font-bold text-sm shadow-sm transition-all"
                        style={{ backgroundColor: btnBg, color: btnText }}
                      >
                        Valider et Payer (15 000 FCFA)
                      </button>
                    </div>
                  );
                })()}
              </div>
            </Card>
          )}

          {activeThemeSection === "banner" && (
            <Card className="p-6 md:p-8 rounded-2xl shadow-sm border-border/50 animate-in fade-in slide-in-from-bottom-2 duration-300">
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
            </Card>
          )}

          {activeThemeSection === "homepage" && (
            <Card className="p-6 md:p-8 rounded-2xl shadow-sm border-border/50 animate-in fade-in slide-in-from-bottom-2 duration-300 space-y-6">
              <div>
                <h3 className="text-xl font-bold mb-1">Paramètres de la page d'accueil</h3>
                <p className="text-sm text-muted-foreground">
                  Personnalisez la bannière principale, le message d'accueil et la disposition de votre vitrine publique.
                </p>
              </div>

              {/* Bannière Hero */}
              <div className="space-y-4 p-5 rounded-2xl bg-muted/20 border">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-base font-bold">Section Hero & Bannière Principale</p>
                    <p className="text-xs text-muted-foreground">Affiche l'image de bannière et le message d'accueil en haut de votre boutique.</p>
                  </div>
                  <Switch checked={themeConfig.hero_enabled !== false} onCheckedChange={v => updateThemeConfig("hero_enabled", v)} />
                </div>

                {themeConfig.hero_enabled !== false && (
                  <div className="space-y-4 pt-2 border-t">
                    <div className="space-y-2">
                      <Label className="text-xs font-semibold">Image de bannière (URL)</Label>
                      <div className="flex gap-2">
                        <Input 
                          placeholder="https://example.com/banner.jpg" 
                          value={themeConfig.hero_banner_url || shop.banner_url || ""} 
                          onChange={e => {
                            const val = e.target.value;
                            updateThemeConfig("hero_banner_url", val);
                            setShop({ ...shop, banner_url: val, theme_config: { ...(shop.theme_config || {}), hero_banner_url: val } });
                          }} 
                          className="h-10 text-sm font-mono"
                        />
                      </div>
                      <p className="text-[11px] text-muted-foreground">
                        Téléversez une image haute définition (format idéal: 1920x800 px ou 1200x600 px).
                      </p>
                      {(themeConfig.hero_banner_url || shop.banner_url) && (
                        <div className="h-32 rounded-xl overflow-hidden border relative bg-black/10 mt-2">
                          <img 
                            src={themeConfig.hero_banner_url || shop.banner_url} 
                            alt="Aperçu de la bannière" 
                            className="w-full h-full object-cover" 
                          />
                          <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
                            <span className="text-white text-xs font-bold bg-black/60 px-3 py-1 rounded-full backdrop-blur-sm">Aperçu en direct</span>
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label className="text-xs font-semibold">Titre principal (Hero Title)</Label>
                        <Input 
                          placeholder={shop.business_name || "Bienvenue dans notre boutique"} 
                          value={themeConfig.hero_title || ""} 
                          onChange={e => updateThemeConfig("hero_title", e.target.value)} 
                          className="h-10 text-sm"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs font-semibold">Texte du bouton d'action (CTA)</Label>
                        <Input 
                          placeholder="Voir les produits" 
                          value={themeConfig.hero_cta_text || ""} 
                          onChange={e => updateThemeConfig("hero_cta_text", e.target.value)} 
                          className="h-10 text-sm"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-xs font-semibold">Sous-titre / Slogan</Label>
                      <Input 
                        placeholder={shop.business_description || "Découvrez nos meilleurs produits et offres exclusives."} 
                        value={themeConfig.hero_subtitle || ""} 
                        onChange={e => updateThemeConfig("hero_subtitle", e.target.value)} 
                        className="h-10 text-sm"
                      />
                    </div>

                    <div className="space-y-2 pt-2 border-t">
                      <Label className="text-xs font-semibold">Affichage dans l'en-tête (Header)</Label>
                      <div className="grid grid-cols-3 gap-2">
                        {[
                          { id: "logo_only", label: "Logo uniquement" },
                          { id: "both", label: "Logo + Nom" },
                          { id: "name_only", label: "Nom uniquement" },
                        ].map(item => (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => updateThemeConfig("header_display_mode", item.id)}
                            className={`p-2.5 rounded-xl border-2 text-xs font-bold transition-all ${
                              (themeConfig.header_display_mode || "logo_only") === item.id 
                                ? "border-primary bg-primary/10 text-primary font-bold"
                                : "border-muted text-muted-foreground hover:border-primary/40"
                            }`}
                          >
                            {item.label}
                          </button>
                        ))}
                      </div>
                      <p className="text-[11px] text-muted-foreground">"Logo uniquement" (recommandé) évite d'afficher le nom texte à côté du logo image s'il est présent.</p>
                    </div>

                    <div className="space-y-2 pt-2 border-t">
                      <Label className="text-xs font-semibold">Affichage du logo & titre dans le Hero</Label>
                      <div className="grid grid-cols-3 gap-2">
                        {[
                          { id: "logo_only", label: "Logo uniquement" },
                          { id: "both", label: "Logo + Titre" },
                          { id: "name_only", label: "Titre uniquement" },
                        ].map(item => (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => updateThemeConfig("hero_display_mode", item.id)}
                            className={`p-2.5 rounded-xl border-2 text-xs font-bold transition-all ${
                              (themeConfig.hero_display_mode || "logo_only") === item.id 
                                ? "border-primary bg-primary/10 text-primary font-bold" 
                                : "border-muted text-muted-foreground hover:border-primary/40"
                            }`}
                          >
                            {item.label}
                          </button>
                        ))}
                      </div>
                      <p className="text-[11px] text-muted-foreground">Évite de répéter le logo et le grand titre en double sur la bannière d'accueil.</p>
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label className="text-xs font-semibold">Ombrage / Assombrissement de l'image ({themeConfig.hero_overlay_opacity ?? 60}%)</Label>
                      </div>
                      <Slider 
                        min={0} max={90} step={5} 
                        value={[themeConfig.hero_overlay_opacity ?? 60]} 
                        onValueChange={v => updateThemeConfig("hero_overlay_opacity", v[0])} 
                      />
                      <p className="text-[11px] text-muted-foreground">Ajustez pour rendre le texte parfaitement lisible sur votre image de bannière.</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Section Produits Vedettes */}
              <div className="space-y-4 p-5 rounded-2xl bg-muted/20 border">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-base font-bold">Section Produits en vedette</p>
                    <p className="text-xs text-muted-foreground">Met en avant vos meilleurs produits en haut du catalogue d'accueil.</p>
                  </div>
                  <Switch checked={themeConfig.featured_enabled !== false} onCheckedChange={v => updateThemeConfig("featured_enabled", v)} />
                </div>

                {themeConfig.featured_enabled !== false && (
                  <div className="space-y-3 pt-2 border-t">
                    <div className="space-y-2">
                      <Label className="text-xs font-semibold">Titre de la section</Label>
                      <Input 
                        placeholder="Produits vedettes" 
                        value={themeConfig.featured_title || ""} 
                        onChange={e => updateThemeConfig("featured_title", e.target.value)} 
                        className="h-10 text-sm"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Section Tous les Produits (Facultative) */}
              <div className="space-y-4 p-5 rounded-2xl bg-muted/20 border">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-base font-bold">Afficher "Tous les produits" sur l'accueil</p>
                    <p className="text-xs text-muted-foreground">
                      Désactivé par défaut (recommandé) pour afficher uniquement vos <b>Produits vedettes</b> sur l'accueil sans doublons. Activez pour afficher la liste complète en dessous.
                    </p>
                  </div>
                  <Switch 
                    checked={themeConfig.show_all_products_on_home === true} 
                    onCheckedChange={v => updateThemeConfig("show_all_products_on_home", v)} 
                  />
                </div>
              </div>

              {/* Disposition et Contact */}
              <div className="space-y-4 p-5 rounded-2xl bg-muted/20 border">
                <div className="flex items-center justify-between">
                  <div><p className="text-sm font-medium">Section contact en bas de page</p><p className="text-xs text-muted-foreground">Affiche le bloc WhatsApp et téléphone avant le footer.</p></div>
                  <Switch checked={themeConfig.contact_section_enabled !== false} onCheckedChange={v => updateThemeConfig("contact_section_enabled", v)} />
                </div>
                <div className="space-y-1.5 pt-2 border-t">
                  <Label className="text-xs font-semibold">Nombre de colonnes de produits (Desktop)</Label>
                  <div className="flex gap-2">
                    {[3, 4, 5].map(n => (
                      <button key={n} type="button" onClick={() => updateThemeConfig("products_per_row", n)}
                        className={`px-4 py-2 rounded-lg border-2 text-sm font-medium transition-all ${(themeConfig.products_per_row || 4) === n ? "border-primary bg-primary/5 text-primary font-bold" : "border-muted text-muted-foreground"}`}>
                        {n} colonnes
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  const safeVal = value || "#FFFFFF";
  return (
    <div className="space-y-2">
      <Label className="text-xs font-semibold text-foreground/90">{label}</Label>
      <div className="flex items-center gap-2 border bg-background rounded-xl px-2.5 py-1.5 h-11 focus-within:ring-2 focus-within:ring-primary/20 transition-all shadow-xs">
        <input 
          type="color" 
          value={safeVal.substring(0, 7)} 
          onChange={e => onChange(e.target.value)} 
          className="h-7 w-7 rounded-lg cursor-pointer border shrink-0 p-0 shadow-xs" 
        />
        <Input 
          value={safeVal} 
          onChange={e => onChange(e.target.value)} 
          className="border-0 shadow-none h-7 text-xs font-mono p-0 focus-visible:ring-0 uppercase font-semibold text-foreground" 
        />
      </div>
    </div>
  );
}

function AnimationControls({ mode, speed, blinkAlign = "center", onModeChange, onSpeedChange, onBlinkAlignChange }: { mode: string; speed: number; blinkAlign?: string; onModeChange: (v: string) => void; onSpeedChange: (v: number) => void; onBlinkAlignChange?: (v: string) => void }) {
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
    <div className={`grid grid-cols-1 gap-4 border rounded-xl p-4 bg-muted/10 ${isBlink ? "md:grid-cols-3" : "md:grid-cols-2"}`}>
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
      {isBlink && onBlinkAlignChange && (
        <div className="space-y-2">
          <Label className="text-xs">Position du message</Label>
          <Select value={blinkAlign} onValueChange={onBlinkAlignChange}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="center">Centré</SelectItem>
              <SelectItem value="left">À gauche</SelectItem>
              <SelectItem value="right">À droite</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}
    </div>
  );
}

function ReviewLivePreview({ themeConfig, variant }: { themeConfig: any; variant: "desktop" | "mobile" }) {
  const Icon = variant === "desktop" ? Monitor : Smartphone;
  const messages = getMessages(themeConfig, variant === "desktop" ? "desktop" : "mobile");
  const separator = variant === "desktop"
    ? (themeConfig.review_desktop_separator ?? " • ")
    : (themeConfig.review_mobile_separator ?? " • ");
  const html = joinMessages(messages, separator);
  const textColor = variant === "desktop"
    ? (themeConfig.review_desktop_text || "#FFFFFF")
    : (themeConfig.review_mobile_text || themeConfig.review_desktop_text || "#FFFFFF");
  const bgColor = variant === "desktop"
    ? (themeConfig.review_desktop_bg || "#803160")
    : (themeConfig.review_mobile_bg || themeConfig.review_desktop_bg || "#803160");
  const blinkAlign = variant === "desktop"
    ? (themeConfig.review_desktop_blink_align || "center")
    : (themeConfig.review_mobile_blink_align || "center");
  const alignClass = blinkAlign === "left" ? "text-left" : blinkAlign === "right" ? "text-right" : "text-center";
  const imgClass = blinkAlign === "left" ? "[&_img]:mx-0" : blinkAlign === "right" ? "[&_img]:ml-auto [&_img]:mr-0" : "[&_img]:mx-auto";

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
              className={`mx-auto max-w-7xl px-3 py-2 ${alignClass} text-sm font-medium leading-relaxed [&_a]:underline ${imgClass} [&_img]:max-h-28 [&_img]:max-w-full [&_img]:rounded-md [&_p]:mb-1.5 [&_p:last-child]:mb-0`}
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

export function getMessages(cfg: any, prefix: "desktop" | "mobile"): string[] {
  const key = prefix === "desktop" ? "review_desktop_messages" : "review_mobile_messages";
  const arr = cfg?.[key];
  if (Array.isArray(arr) && arr.length > 0) return arr.filter((m: any) => typeof m === "string");
  // Fallback to legacy single content field
  const legacy = prefix === "desktop"
    ? (cfg?.review_bar_desktop_content || "")
    : (cfg?.review_bar_mobile_content || cfg?.review_bar_desktop_content || "");
  return legacy ? [legacy] : [];
}

export function joinMessages(messages: string[], separator: string): string {
  const cleaned = messages.map(m => (m || "").trim()).filter(Boolean);
  if (cleaned.length === 0) return "";
  const sep = `<span class="vp-review-sep" style="opacity:0.6;margin:0 0.5em;">${DOMPurify.sanitize(separator || "")}</span>`;
  return cleaned.join(sep);
}

function MessagesEditor({
  label,
  messages,
  separator,
  onChangeMessages,
  onChangeSeparator,
}: {
  label: string;
  messages: string[];
  separator: string;
  onChangeMessages: (v: string[]) => void;
  onChangeSeparator: (v: string) => void;
}) {
  const list = messages.length > 0 ? messages : [""];
  const update = (idx: number, value: string) => {
    const next = [...list];
    next[idx] = value;
    onChangeMessages(next);
  };
  const remove = (idx: number) => {
    const next = list.filter((_, i) => i !== idx);
    onChangeMessages(next.length ? next : [""]);
  };
  const move = (idx: number, dir: -1 | 1) => {
    const target = idx + dir;
    if (target < 0 || target >= list.length) return;
    const next = [...list];
    [next[idx], next[target]] = [next[target], next[idx]];
    onChangeMessages(next);
  };
  const add = () => onChangeMessages([...list, ""]);
  return (
    <div className="border rounded-xl p-4 bg-muted/20 space-y-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">{label}</p>
        <Button type="button" size="sm" variant="outline" onClick={add} className="gap-1">
          <Plus className="h-3.5 w-3.5" /> Ajouter un message
        </Button>
      </div>
      <div className="space-y-3">
        {list.map((msg, idx) => (
          <div key={idx} className="border rounded-lg p-3 bg-background space-y-2">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-semibold text-muted-foreground">
                Message {idx + 1}{idx === 0 ? " — défile en premier" : ""}
              </span>
              <div className="flex items-center gap-1">
                <Button type="button" size="icon" variant="ghost" className="h-7 w-7" disabled={idx === 0} onClick={() => move(idx, -1)} title="Monter">
                  <ArrowUp className="h-3.5 w-3.5" />
                </Button>
                <Button type="button" size="icon" variant="ghost" className="h-7 w-7" disabled={idx === list.length - 1} onClick={() => move(idx, 1)} title="Descendre">
                  <ArrowDown className="h-3.5 w-3.5" />
                </Button>
                <Button type="button" size="icon" variant="ghost" className="h-7 w-7 text-destructive" disabled={list.length === 1 && !msg} onClick={() => remove(idx)} title="Supprimer">
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
            <RichTextEditor value={msg} onChange={v => update(idx, v)} />
          </div>
        ))}
      </div>
      <div className="space-y-2">
        <Label className="text-xs">Séparateur entre les messages</Label>
        <Input
          value={separator}
          onChange={e => onChangeSeparator(e.target.value)}
          placeholder=" • "
          className="h-9"
        />
        <p className="text-[11px] text-muted-foreground">
          Affiché entre chaque message (ex. « • », « | », « — »). Le premier message de la liste est aussi celui qui défile en premier.
        </p>
      </div>
    </div>
  );
}


