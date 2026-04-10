import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Settings, Layout, Tag, ShoppingCart as CartIcon, MessageSquare, Home, Smartphone, Monitor, Type, Timer, TrendingDown } from "lucide-react";

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
                    <div 
                      contentEditable 
                      suppressContentEditableWarning
                      className="min-h-[100px] p-3 rounded-lg border bg-white dark:bg-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                      style={{ whiteSpace: "pre-wrap" }}
                      onInput={e => updateThemeConfig("review_bar_desktop_content", (e.target as HTMLDivElement).innerHTML)}
                      dangerouslySetInnerHTML={{ __html: themeConfig.review_bar_desktop_content || "" }}
                    />
                  </div>
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
                </TabsContent>

                <TabsContent value="review_mobile" className="mt-6 space-y-6">
                  <div className="border rounded-xl p-4 bg-muted/20 min-h-[150px]">
                    <p className="text-sm text-muted-foreground mb-3">Contenu de la barre d'avis (mobile)</p>
                    <div 
                      contentEditable 
                      suppressContentEditableWarning
                      className="min-h-[100px] p-3 rounded-lg border bg-white dark:bg-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                      style={{ whiteSpace: "pre-wrap" }}
                      onInput={e => updateThemeConfig("review_bar_mobile_content", (e.target as HTMLDivElement).innerHTML)}
                      dangerouslySetInnerHTML={{ __html: themeConfig.review_bar_mobile_content || "" }}
                    />
                  </div>
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
                        <Switch checked={themeConfig.review_mobile_active || false} onCheckedChange={v => updateThemeConfig("review_mobile_active", v)} />
                      </div>
                    </div>
                  </div>
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
