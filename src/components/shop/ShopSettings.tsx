import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import {
  Settings2, BarChart3, CreditCard, ShoppingCart,
  Trash2, Plus, GripVertical, Facebook, Globe, AlertTriangle, Loader2, ShieldCheck, Link2, Copy, Check, Bell, Languages, Truck,
  Store, Phone, MapPin, Mail, MessageSquare, Eye, Box, HeartHandshake, ShieldAlert, Rocket, Search, Smartphone, Zap, X
} from "lucide-react";
import { Database } from "@/integrations/supabase/types";
import { isPremiumShop } from "@/lib/premium";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { CheckoutMobilePreview } from "./CheckoutMobilePreview";
import { DnsConfigurationAssistant } from "@/components/DnsConfigurationAssistant";
import { NotificationSettings } from "./NotificationSettings";
import { LanguageSettings } from "./LanguageSettings";
import { ShopDeliveryPartners } from "./ShopDeliveryPartners";

type SettingsTab = "general" | "payment" | "checkout" | "delivery" | "notifications" | "languages" | "analytics" | "domain" | "danger";

interface CheckoutField {
  id: string;
  label: string;
  type: string;
  enabled: boolean;
  required: boolean;
}

interface ShopSettingsProps {
  shop: any;
  setShop: (shop: any) => void;
  onDeleteShop: () => void;
}

const SETTINGS_NAV: { id: SettingsTab; label: string; icon: React.ElementType, description?: string }[] = [
  { id: "general", label: "Général", icon: Store, description: "Informations de base" },
  { id: "payment", label: "Paiement", icon: CreditCard, description: "Modes de paiement" },
  { id: "checkout", label: "Check-out", icon: ShoppingCart, description: "Formulaire client" },
  { id: "delivery", label: "Livraison", icon: Truck, description: "Frais & transporteurs" },
  { id: "notifications", label: "Notifications", icon: Bell, description: "Alertes commandes" },
  { id: "languages", label: "Langues", icon: Languages, description: "Traductions" },
  { id: "analytics", label: "Pixels & Suivi", icon: BarChart3, description: "Facebook, GA4, TikTok..." },
  { id: "domain", label: "Nom de domaine", icon: Globe, description: "Adresse personnalisée" },
  { id: "danger", label: "Zone de danger", icon: ShieldAlert, description: "Actions critiques" },
];

export function ShopSettings({ shop, setShop, onDeleteShop }: ShopSettingsProps) {
  const [activeTab, setActiveTab] = useState<SettingsTab>("general");
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [savingSocialProof, setSavingSocialProof] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);

  // Pixel state
  const [newFbPixel, setNewFbPixel] = useState("");
  const [newTiktokPixel, setNewTiktokPixel] = useState("");
  const [newSnapPixel, setNewSnapPixel] = useState("");
  const [newGaId, setNewGaId] = useState("");

  const checkoutFields: CheckoutField[] = shop.checkout_fields || [
    { id: "first_name", label: "Prénom", type: "text", enabled: true, required: true },
    { id: "phone", label: "Numéro de téléphone", type: "tel", enabled: true, required: true },
    { id: "country", label: "Pays", type: "text", enabled: true, required: true },
    { id: "city", label: "Ville / Commune", type: "text", enabled: true, required: true },
    { id: "address", label: "Adresse de livraison", type: "text", enabled: true, required: false },
    { id: "email", label: "E-mail", type: "email", enabled: false, required: false },
    { id: "last_name", label: "Nom de famille", type: "text", enabled: false, required: false },
  ];

  const addPixel = (field: string, value: string, setter: (v: string) => void) => {
    if (!value.trim()) return;
    const current = shop[field] || [];
    if (current.includes(value.trim())) { toast({ title: "Pixel déjà ajouté", variant: "destructive" }); return; }
    setShop({ ...shop, [field]: [...current, value.trim()] });
    setter("");
  };

  const removePixel = (field: string, index: number) => {
    const current = [...(shop[field] || [])];
    current.splice(index, 1);
    setShop({ ...shop, [field]: current });
  };

  const updateCheckoutField = (fieldId: string, key: keyof CheckoutField, value: boolean) => {
    const updated = checkoutFields.map(f => f.id === fieldId ? { ...f, [key]: value } : f);
    setShop({ ...shop, checkout_fields: updated });
  };

  const updateSocialProof = async (enabled: boolean) => {
    const previous = shop.social_proof_enabled || false;
    setShop({ ...shop, social_proof_enabled: enabled });
    setSavingSocialProof(true);
    const { error } = await supabase.from("shops").update({ social_proof_enabled: enabled }).eq("id", shop.id) as any;
    setSavingSocialProof(false);
    if (error) {
      setShop({ ...shop, social_proof_enabled: previous });
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: enabled ? "Preuve sociale activée ✓" : "Preuve sociale désactivée" });
  };

  const handleDeleteShop = async () => {
    if (deleteConfirmText !== shop.business_name) return;
    setDeleting(true);
    try {
      await supabase.from("products").delete().eq("shop_id", shop.id);
      await supabase.from("orders").delete().eq("shop_id", shop.id);
      await supabase.from("shops").delete().eq("id", shop.id);
      toast({ title: "Boutique supprimée" });
      onDeleteShop();
    } catch {
      toast({ title: "Erreur lors de la suppression", variant: "destructive" });
    } finally { setDeleting(false); }
  };

  const paymentMethods = shop.payment_methods || ["cod"];
  const togglePaymentMethod = (method: string) => {
    const current = [...paymentMethods];
    const idx = current.indexOf(method);
    if (idx >= 0) current.splice(idx, 1);
    else current.push(method);
    setShop({ ...shop, payment_methods: current });
  };

  return (
    <div className="max-w-[1400px] mx-auto space-y-8 pb-12">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border/50 pb-6">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-primary/10 rounded-xl text-primary shrink-0 shadow-sm">
            <Settings2 className="h-8 w-8" />
          </div>
          <div>
            <h1 className="text-2xl md:text-3xl font-extrabold text-foreground tracking-tight">Paramètres</h1>
            <p className="text-muted-foreground mt-1 text-sm md:text-base">
              Gérez l'ensemble des configurations de votre boutique <span className="font-semibold text-foreground">{shop.business_name}</span>.
            </p>
          </div>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-8 items-start">
        {/* Sidebar Navigation */}
        <div className="w-full lg:w-[280px] shrink-0 sticky top-24">
          <nav className="flex lg:flex-col overflow-x-auto lg:overflow-x-visible gap-2 pb-4 lg:pb-0 scrollbar-hide">
            {SETTINGS_NAV.map((item) => {
              const isActive = activeTab === item.id;
              const isDanger = item.id === "danger";
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`
                    group flex items-center justify-between px-4 py-3.5 rounded-xl text-left transition-all duration-200 min-w-[200px] lg:min-w-0
                    ${isActive 
                      ? isDanger 
                        ? "bg-destructive text-destructive-foreground shadow-md font-semibold" 
                        : "bg-primary text-primary-foreground shadow-md font-semibold ring-1 ring-primary/20" 
                      : isDanger 
                        ? "text-destructive hover:bg-destructive/10 hover:text-destructive font-medium border border-transparent"
                        : "text-foreground hover:bg-muted/60 hover:text-foreground font-medium border border-transparent hover:border-border/50"
                    }
                  `}
                >
                  <div className="flex items-center gap-3">
                    <item.icon className={`h-5 w-5 ${isActive ? "" : isDanger ? "text-destructive" : "text-muted-foreground group-hover:text-primary"}`} />
                    <div className="flex flex-col">
                      <span className="text-sm tracking-tight">{item.label}</span>
                      <span className={`text-[11px] ${isActive ? "opacity-80" : "text-muted-foreground"}`}>{item.description}</span>
                    </div>
                  </div>
                </button>
              );
            })}
          </nav>
        </div>

        {/* Content Area */}
        <div className="flex-1 min-w-0 w-full animate-in fade-in slide-in-from-bottom-2 duration-300">
          
          {/* ==================== GENERAL TAB ==================== */}
          {activeTab === "general" && (
            <div className="space-y-8">
              <div>
                <h2 className="text-2xl font-bold flex items-center gap-2 mb-1"><Store className="h-6 w-6 text-primary" /> Informations générales</h2>
                <p className="text-muted-foreground text-sm">Définissez l'identité et les coordonnées de votre boutique en ligne.</p>
              </div>

              {/* Card 1: Identité */}
              <Card className="p-6 md:p-8 rounded-2xl shadow-sm border-border/50 bg-card overflow-hidden relative">
                <div className="flex items-center gap-3 mb-6">
                  <div className="p-2.5 bg-indigo-50 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400 rounded-xl">
                    <Search className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold">Identité de la boutique</h3>
                    <p className="text-sm text-muted-foreground">Les informations affichées à vos clients.</p>
                  </div>
                </div>

                <div className="space-y-6">
                  <div className="space-y-2">
                    <Label className="text-sm font-semibold">Nom de la boutique</Label>
                    <Input 
                      value={shop.business_name} 
                      onChange={(e) => setShop({ ...shop, business_name: e.target.value })} 
                      className="h-11 bg-muted/30 focus-visible:bg-background transition-colors"
                      placeholder="Ex: Ma Super Boutique"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-sm font-semibold flex items-center gap-1.5"><Link2 className="h-4 w-4" /> Lien public de la boutique</Label>
                    <div className="flex items-stretch rounded-xl border border-border/60 overflow-hidden focus-within:ring-2 focus-within:ring-primary/20 transition-all shadow-sm">
                      <span className="px-4 py-2.5 text-sm font-medium text-muted-foreground bg-muted/40 border-r border-border/60 flex items-center select-none">
                        ecomfy.cloud/shop/
                      </span>
                      <Input
                        value={shop.slug || ""}
                        onChange={(e) => setShop({
                          ...shop,
                          slug: e.target.value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-").slice(0, 50),
                        })}
                        placeholder="ma-boutique"
                        className="border-0 rounded-none focus-visible:ring-0 focus-visible:ring-offset-0 text-base font-medium"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        className="rounded-none border-l h-auto px-4 hover:bg-primary/5 hover:text-primary transition-colors"
                        onClick={() => {
                          const url = `https://ecomfy.cloud/shop/${shop.slug || ""}`;
                          navigator.clipboard.writeText(url);
                          setLinkCopied(true);
                          toast({ title: "Lien copié ✓", description: url });
                          setTimeout(() => setLinkCopied(false), 2000);
                        }}
                      >
                        {linkCopied ? <Check className="h-5 w-5 text-emerald-500" /> : <Copy className="h-5 w-5" />}
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      Ce lien peut être partagé partout (TikTok, Facebook, WhatsApp). N'utilisez que des lettres, chiffres et tirets.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-sm font-semibold">Description</Label>
                    <Textarea 
                      value={shop.business_description || ""} 
                      onChange={(e) => setShop({ ...shop, business_description: e.target.value })} 
                      rows={3} 
                      className="bg-muted/30 focus-visible:bg-background transition-colors resize-none"
                      placeholder="Décrivez votre boutique en quelques mots..."
                    />
                  </div>
                </div>
              </Card>

              {/* Card 2: Contact */}
              <Card className="p-6 md:p-8 rounded-2xl shadow-sm border-border/50 bg-card">
                <div className="flex items-center gap-3 mb-6">
                  <div className="p-2.5 bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400 rounded-xl">
                    <MapPin className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold">Contact & Localisation</h3>
                    <p className="text-sm text-muted-foreground">Pour que vos clients puissent vous joindre facilement.</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label className="text-sm font-semibold flex items-center gap-1.5"><MessageSquare className="h-4 w-4 text-green-500" /> WhatsApp</Label>
                    <Input value={shop.whatsapp_number || ""} onChange={(e) => setShop({ ...shop, whatsapp_number: e.target.value })} className="h-11" placeholder="+225 00 00 00 00" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm font-semibold flex items-center gap-1.5"><Phone className="h-4 w-4 text-muted-foreground" /> Téléphone classique</Label>
                    <Input value={shop.phone_number || ""} onChange={(e) => setShop({ ...shop, phone_number: e.target.value })} className="h-11" placeholder="+225 00 00 00 00" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm font-semibold flex items-center gap-1.5"><Mail className="h-4 w-4 text-muted-foreground" /> Email de support</Label>
                    <Input value={shop.email || ""} onChange={(e) => setShop({ ...shop, email: e.target.value })} className="h-11" placeholder="contact@maboutique.com" type="email" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm font-semibold flex items-center gap-1.5"><MapPin className="h-4 w-4 text-muted-foreground" /> Ville principale</Label>
                    <Input value={shop.city || ""} onChange={(e) => setShop({ ...shop, city: e.target.value })} className="h-11" placeholder="Ex: Abidjan, Yopougon" />
                  </div>
                </div>
              </Card>

              {/* Card 3: Post-purchase */}
              <Card className="p-6 md:p-8 rounded-2xl shadow-sm border-border/50 bg-card">
                <div className="flex items-center gap-3 mb-6">
                  <div className="p-2.5 bg-amber-50 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400 rounded-xl">
                    <HeartHandshake className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold">Page de Remerciement</h3>
                    <p className="text-sm text-muted-foreground">Le message affiché au client juste après son achat.</p>
                  </div>
                </div>
                
                <div className="space-y-6">
                  <div className="space-y-2">
                    <Label className="text-sm font-semibold">Message de confirmation</Label>
                    <Textarea
                      rows={3}
                      value={shop.order_confirmation_message || ""}
                      onChange={(e) => setShop({ ...shop, order_confirmation_message: e.target.value })}
                      placeholder="Félicitations ! Un conseiller va vous appeler d'ici peu pour valider la livraison."
                      className="resize-none"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm font-semibold">Numéro du conseiller livraison (Optionnel)</Label>
                    <Input
                      value={shop.delivery_advisor_phone || ""}
                      onChange={(e) => setShop({ ...shop, delivery_advisor_phone: e.target.value })}
                      placeholder="07 XX XX XX XX"
                      className="h-11 md:w-1/2"
                    />
                    <p className="text-xs text-muted-foreground">Si renseigné, un bouton "Appeler le conseiller" s'affichera.</p>
                  </div>
                </div>
              </Card>

              {/* Card 4: Publication */}
              <Card className="p-6 md:p-8 rounded-2xl shadow-sm border-border/50 bg-card">
                <div className="flex items-center gap-3 mb-6">
                  <div className="p-2.5 bg-fuchsia-50 text-fuchsia-600 dark:bg-fuchsia-900/30 dark:text-fuchsia-400 rounded-xl">
                    <Rocket className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold">Visibilité & Engagement</h3>
                    <p className="text-sm text-muted-foreground">Contrôlez l'accès public à votre boutique.</p>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 rounded-xl border border-border/60 hover:border-primary/30 transition-colors bg-muted/10">
                    <div className="pr-4">
                      <p className="font-bold">Boutique en ligne</p>
                      <p className="text-sm text-muted-foreground mt-0.5">Rendre la boutique accessible aux visiteurs sur internet.</p>
                    </div>
                    <Switch checked={shop.is_published} onCheckedChange={(v) => setShop({ ...shop, is_published: v })} className="data-[state=checked]:bg-primary" />
                  </div>
                  
                  <div className="flex items-center justify-between p-4 rounded-xl border border-border/60 hover:border-primary/30 transition-colors bg-muted/10">
                    <div className="pr-4">
                      <p className="font-bold flex items-center gap-2">Preuve sociale {savingSocialProof && <Loader2 className="h-3 w-3 animate-spin text-primary" />}</p>
                      <p className="text-sm text-muted-foreground mt-0.5">Afficher de fausses notifications de ventes récentes pour booster la confiance ("Quelqu'un de Bamako a acheté...").</p>
                    </div>
                    <Switch checked={shop.social_proof_enabled || false} onCheckedChange={updateSocialProof} disabled={savingSocialProof} className="data-[state=checked]:bg-primary" />
                  </div>
                </div>
              </Card>
            </div>
          )}

          {/* ==================== PAYMENT TAB ==================== */}
          {activeTab === "payment" && (
            <div className="space-y-8">
              <div>
                <h2 className="text-2xl font-bold flex items-center gap-2 mb-1"><CreditCard className="h-6 w-6 text-primary" /> Modes de paiement</h2>
                <p className="text-muted-foreground text-sm">Définissez comment vos clients peuvent régler leurs commandes.</p>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {[
                  { id: "cod", label: "Paiement à la livraison", desc: "Le client paie en espèces à la réception de son colis (Cash on Delivery).", icon: Box, color: "text-blue-600", bg: "bg-blue-50 dark:bg-blue-900/30" },
                  { id: "mobile_money", label: "Mobile Money", desc: "Acceptez Wave, Orange Money, MTN MoMo, Moov Money de manière sécurisée.", icon: Smartphone, color: "text-orange-500", bg: "bg-orange-50 dark:bg-orange-900/30" },
                ].map(method => {
                  const isActive = paymentMethods.includes(method.id);
                  return (
                    <label 
                      key={method.id} 
                      className={`group relative flex flex-col p-6 rounded-2xl border-2 cursor-pointer transition-all duration-300 ${
                        isActive ? "border-primary bg-primary/5 ring-4 ring-primary/10 shadow-md" : "border-border/60 hover:border-border bg-card hover:bg-muted/30 shadow-sm"
                      }`}
                    >
                      <div className="flex justify-between items-start mb-4">
                        <div className={`p-3 rounded-xl ${method.bg} ${method.color}`}>
                          <method.icon className="h-6 w-6" />
                        </div>
                        <Switch
                          checked={isActive}
                          onCheckedChange={() => togglePaymentMethod(method.id)}
                          className="mt-1 pointer-events-none" // handled by label click
                        />
                      </div>
                      <h3 className={`font-bold text-lg mb-1 ${isActive ? "text-primary" : "text-foreground"}`}>{method.label}</h3>
                      <p className="text-sm text-muted-foreground leading-relaxed">{method.desc}</p>
                    </label>
                  );
                })}
              </div>

              {paymentMethods.includes("cod") && (
                <Card className="p-6 md:p-8 rounded-2xl shadow-sm border-border/50 bg-card mt-8 animate-in fade-in zoom-in-95 duration-300">
                  <div className="flex items-center gap-3 mb-4">
                    <Box className="h-5 w-5 text-blue-600" />
                    <h3 className="font-bold text-lg">Paramètres spécifiques au COD</h3>
                  </div>
                  <div className="space-y-2">
                    <Label className="font-semibold">Taux de délivrabilité estimé (%)</Label>
                    <div className="flex items-center gap-4">
                      <Input
                        type="number"
                        value={shop.cod_delivery_rate ?? 100}
                        onChange={(e) => setShop({ ...shop, cod_delivery_rate: Number(e.target.value) })}
                        min={0} max={100}
                        className="h-11 w-32 font-mono text-lg"
                      />
                      <p className="text-sm text-muted-foreground max-w-md">
                        Ce pourcentage est utilisé dans vos statistiques pour estimer le chiffre d'affaires réel généré par les commandes en attente de livraison.
                      </p>
                    </div>
                  </div>
                </Card>
              )}
            </div>
          )}

          {/* ==================== CHECKOUT TAB ==================== */}
          {activeTab === "checkout" && (
            <div className="space-y-8">
              <div>
                <h2 className="text-2xl font-bold flex items-center gap-2 mb-1"><ShoppingCart className="h-6 w-6 text-primary" /> Expérience de Check-out</h2>
                <p className="text-muted-foreground text-sm">Optimisez le formulaire d'achat pour maximiser votre taux de conversion.</p>
              </div>

              <div className="grid grid-cols-1 xl:grid-cols-[1fr_360px] gap-8 items-start">
                <div className="space-y-6 min-w-0">
                  {/* Mode de checkout */}
                  <Card className="p-6 md:p-8 rounded-2xl shadow-sm border-border/50 bg-card">
                    <h3 className="font-bold text-lg mb-6 flex items-center gap-2"><Zap className="h-5 w-5 text-amber-500" /> Optimisations du tunnel</h3>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between p-4 rounded-xl border hover:bg-muted/20 transition-colors">
                        <div className="pr-4">
                          <p className="font-bold">Checkout sur une seule page</p>
                          <p className="text-sm text-muted-foreground mt-0.5">Fusionne le panier et le formulaire de paiement sur la même vue (friction minimale).</p>
                        </div>
                        <Switch checked={shop.theme_config?.single_page_checkout || false} onCheckedChange={(v) => setShop({ ...shop, theme_config: { ...(shop.theme_config || {}), single_page_checkout: v } })} />
                      </div>
                      
                      <div className="flex items-center justify-between p-4 rounded-xl border hover:bg-muted/20 transition-colors">
                        <div className="pr-4">
                          <p className="font-bold">Masquer l'en-tête (Mode Landing Page)</p>
                          <p className="text-sm text-muted-foreground mt-0.5">Cache la navigation du site sur la fiche produit pour éviter que le client ne se disperse.</p>
                        </div>
                        <Switch checked={shop.theme_config?.hide_product_header || false} onCheckedChange={(v) => setShop({ ...shop, theme_config: { ...(shop.theme_config || {}), hide_product_header: v } })} />
                      </div>
                      
                      <div className="flex items-center justify-between p-4 rounded-xl border hover:bg-muted/20 transition-colors">
                        <div className="pr-4">
                          <p className="font-bold">Bouton Commander fixe (Sticky)</p>
                          <p className="text-sm text-muted-foreground mt-0.5">Garde un bouton d'achat toujours visible en bas de l'écran sur mobile.</p>
                        </div>
                        <Switch checked={shop.theme_config?.sticky_order_button || false} onCheckedChange={(v) => setShop({ ...shop, theme_config: { ...(shop.theme_config || {}), sticky_order_button: v } })} />
                      </div>
                      
                      <div className="flex items-center justify-between p-4 rounded-xl border bg-orange-50/50 dark:bg-orange-950/20 border-orange-200 dark:border-orange-900/30 hover:bg-orange-50 dark:hover:bg-orange-900/40 transition-colors">
                        <div className="pr-4">
                          <p className="font-bold text-orange-900 dark:text-orange-200">Paiement anticipé obligatoire (Intérieur)</p>
                          <p className="text-sm text-orange-800/80 dark:text-orange-300/80 mt-0.5">Les clients hors de la capitale doivent payer par Mobile Money pour valider leur commande (limite les retours impayés).</p>
                        </div>
                        <Switch checked={shop.theme_config?.force_mobile_money_interior || false} onCheckedChange={(v) => setShop({ ...shop, theme_config: { ...(shop.theme_config || {}), force_mobile_money_interior: v } })} />
                      </div>
                    </div>
                  </Card>

                  {/* Champs du formulaire */}
                  <Card className="p-6 md:p-8 rounded-2xl shadow-sm border-border/50 bg-card">
                    <h3 className="font-bold text-lg mb-2">Champs du formulaire client</h3>
                    <p className="text-sm text-muted-foreground mb-6">Activez uniquement les champs dont vous avez réellement besoin. Moins il y a de champs, plus vous aurez de commandes.</p>
                    
                    <div className="space-y-3">
                      {checkoutFields.map(field => (
                        <div key={field.id} className={`flex items-center gap-4 p-4 rounded-xl border transition-all ${field.enabled ? "bg-background shadow-sm border-border" : "bg-muted/40 border-dashed border-border/60 opacity-70"}`}>
                          <GripVertical className="h-5 w-5 text-muted-foreground shrink-0 cursor-grab active:cursor-grabbing hover:text-foreground transition-colors" />
                          <Switch
                            checked={field.enabled}
                            onCheckedChange={(v) => updateCheckoutField(field.id, "enabled", v)}
                            className="data-[state=checked]:bg-primary"
                          />
                          <div className="flex-1 min-w-0">
                            <span className={`font-semibold ${field.enabled ? "text-foreground" : "text-muted-foreground line-through decoration-muted-foreground/40"}`}>{field.label}</span>
                            <Badge variant="outline" className="ml-3 text-[10px] font-mono tracking-wider">{(field.type || "").toUpperCase()}</Badge>
                          </div>
                          
                          {/* Required Checkbox Styled as a nice toggle button */}
                          <div className={`flex items-center gap-2 ${!field.enabled ? "opacity-50 pointer-events-none" : ""}`}>
                             <label className="flex items-center gap-2 cursor-pointer bg-muted/40 hover:bg-muted/80 px-3 py-1.5 rounded-lg border border-border/50 transition-colors">
                              <Checkbox 
                                checked={field.required} 
                                onCheckedChange={(v) => updateCheckoutField(field.id, "required", v as boolean)}
                                disabled={!field.enabled}
                                className="h-4 w-4"
                              />
                              <span className="text-xs font-semibold select-none">Obligatoire</span>
                             </label>
                          </div>
                        </div>
                      ))}
                    </div>
                  </Card>
                </div>
                
                {/* Mobile Preview sticky */}
                <div className="xl:sticky xl:top-24 flex justify-center">
                  <div className="scale-95 origin-top">
                    <CheckoutMobilePreview shop={shop} />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ==================== EXISTING COMPONENTS TABS ==================== */}
          {activeTab === "notifications" && (
            <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
               <NotificationSettings shop={shop} setShop={setShop} />
            </div>
          )}
          {activeTab === "delivery" && (
            <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
              <ShopDeliveryPartners shopId={shop.id} />
            </div>
          )}
          {activeTab === "languages" && (
            <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
              <LanguageSettings shop={shop} setShop={setShop} />
            </div>
          )}
          {activeTab === "domain" && (
            <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
              <h2 className="text-2xl font-bold flex items-center gap-2 mb-1"><Globe className="h-6 w-6 text-primary" /> Domaine personnalisé</h2>
              <p className="text-muted-foreground text-sm mb-6">
                Connectez votre propre nom de domaine (acheté sur OVH, Hostinger, GoDaddy, etc.) pour remplacer ecomfy.cloud.
              </p>
              
              {!isPremiumShop(shop) ? (
                <Card className="p-8 text-center bg-gradient-to-br from-emerald-50 to-white dark:from-emerald-950/20 dark:to-background border-emerald-200 dark:border-emerald-900/50">
                  <div className="mx-auto w-12 h-12 bg-emerald-100 dark:bg-emerald-900/50 text-emerald-600 rounded-full flex items-center justify-center mb-4">
                    <Globe className="h-6 w-6" />
                  </div>
                  <h3 className="text-xl font-bold mb-2">Fonctionnalité Premium</h3>
                  <p className="text-muted-foreground mb-6 max-w-md mx-auto">
                    La connexion d'un nom de domaine personnalisé nécessite un abonnement Premium. Mettez à niveau votre boutique pour débloquer cette fonctionnalité et renforcer votre image de marque.
                  </p>
                  <Button className="bg-emerald-600 hover:bg-emerald-700 text-white">
                    Passer à l'abonnement Premium
                  </Button>
                </Card>
              ) : (
                <DnsConfigurationAssistant
                  resourceId={shop.id}
                  resourceType="shop"
                  currentBaseUrl={`ecomfy.cloud/shop/${shop.slug || ""}`}
                  currentDomain={shop.custom_domain || ""}
                  verificationCode={shop.domain_verification_code || ""}
                  domainStatus={shop.domain_status || "not_configured"}
                  propagationPercentage={shop.dns_propagation_percentage || 0}
                  sslStatus={shop.ssl_status || "pending"}
                  onDomainSave={async (domain) => {
                    const cleaned = domain.toLowerCase().replace(/^https?:\/\//, "").replace(/\/$/, "");
                    const { data, error } = await supabase.from("shops").update({ custom_domain: cleaned }).eq("id", shop.id).select().single();
                    if (error) throw error;
                    if (data) setShop({ ...shop, ...data });
                  }}
                />
              )}
            </div>
          )}

          {/* ==================== ANALYTICS TAB ==================== */}
          {activeTab === "analytics" && (
            <div className="space-y-8">
              <div>
                <h2 className="text-2xl font-bold flex items-center gap-2 mb-1"><BarChart3 className="h-6 w-6 text-primary" /> Analytiques & Suivi (Pixels)</h2>
                <p className="text-muted-foreground text-sm">Connectez vos plateformes publicitaires pour remonter les événements d'achat de façon ultra précise.</p>
              </div>

              {/* Master switch */}
              <Card className="p-6 md:p-8 rounded-2xl shadow-sm border-border/50 bg-gradient-to-br from-emerald-500/10 to-transparent border-emerald-500/20">
                <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
                  <div>
                    <h3 className="text-lg font-bold flex items-center gap-2 text-emerald-700 dark:text-emerald-400">
                      <ShieldCheck className="h-5 w-5" />
                      Suivi Serveur Avancé (Conversions API)
                    </h3>
                    <p className="text-sm text-muted-foreground mt-2 max-w-2xl leading-relaxed">
                      Active le suivi côté serveur (Meta CAPI, TikTok Events API, Snap CAPI, GA4 Measurement Protocol).
                      Les événements (PageView, AddToCart, Purchase) sont envoyés simultanément par le navigateur et par notre serveur avec une déduplication automatique pour contourner les bloqueurs de publicité (AdBlock, iOS 14+).
                    </p>
                  </div>
                  <Switch
                    checked={shop.tracking_enabled !== false}
                    onCheckedChange={(v) => setShop({ ...shop, tracking_enabled: v })}
                    className="data-[state=checked]:bg-emerald-600 scale-125 md:scale-150 origin-right shrink-0"
                  />
                </div>
              </Card>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Facebook Pixel */}
                <Card className="rounded-2xl shadow-sm border-border/50 bg-card overflow-hidden">
                  <div className="bg-[#1877F2] text-white px-6 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-3 font-bold">
                      <Facebook className="h-6 w-6" /> Pixel Meta (Facebook & Instagram)
                    </div>
                  </div>
                  <div className="p-6 space-y-6">
                    <div className="space-y-3">
                      <Label className="font-semibold text-foreground">Identifiants de Pixel (Côté Client)</Label>
                      <div className="flex gap-2">
                        <Input value={newFbPixel} onChange={(e) => setNewFbPixel(e.target.value)} placeholder="Ex: 1234567890" className="h-11" />
                        <Button onClick={() => addPixel("facebook_pixels", newFbPixel, setNewFbPixel)} className="h-11 px-6"><Plus className="h-4 w-4 mr-1" /> Ajouter</Button>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {(shop.facebook_pixels || []).map((px: string, i: number) => (
                          <Badge key={i} variant="secondary" className="px-3 py-1.5 text-sm font-mono border-border/50 gap-2">
                            {px} <button onClick={() => removePixel("facebook_pixels", i)} className="text-destructive hover:text-destructive/80"><X className="h-3.5 w-3.5"/></button>
                          </Badge>
                        ))}
                      </div>
                    </div>
                    
                    <div className="space-y-4 pt-4 border-t border-border/50">
                      <div className="space-y-2">
                        <Label className="font-semibold flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400"><ShieldCheck className="h-4 w-4" /> Jeton d'accès (Conversions API)</Label>
                        <Input type="password" value={shop.facebook_access_token || ""} onChange={(e) => setShop({ ...shop, facebook_access_token: e.target.value })} placeholder="EAAG..." className="h-11 font-mono text-xs" />
                      </div>
                      <div className="space-y-2">
                        <Label className="font-semibold text-muted-foreground">Code de test d'événement (Optionnel)</Label>
                        <Input value={shop.facebook_test_event_code || ""} onChange={(e) => setShop({ ...shop, facebook_test_event_code: e.target.value })} placeholder="TEST12345" className="h-11" />
                      </div>
                    </div>
                  </div>
                </Card>

                {/* TikTok Pixel */}
                <Card className="rounded-2xl shadow-sm border-border/50 bg-card overflow-hidden">
                  <div className="bg-[#000000] dark:bg-zinc-900 border-b border-zinc-800 text-white px-6 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-3 font-bold">
                      <span className="text-2xl leading-none">♪</span> Pixel TikTok
                    </div>
                  </div>
                  <div className="p-6 space-y-6">
                    <div className="space-y-3">
                      <Label className="font-semibold text-foreground">Identifiants de Pixel (Côté Client)</Label>
                      <div className="flex gap-2">
                        <Input value={newTiktokPixel} onChange={(e) => setNewTiktokPixel(e.target.value)} placeholder="Ex: C1234567890" className="h-11" />
                        <Button onClick={() => addPixel("tiktok_pixels", newTiktokPixel, setNewTiktokPixel)} className="h-11 px-6 bg-black text-white hover:bg-zinc-800"><Plus className="h-4 w-4 mr-1" /> Ajouter</Button>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {(shop.tiktok_pixels || []).map((px: string, i: number) => (
                          <Badge key={i} variant="secondary" className="px-3 py-1.5 text-sm font-mono border-border/50 gap-2">
                            {px} <button onClick={() => removePixel("tiktok_pixels", i)} className="text-destructive hover:text-destructive/80"><X className="h-3.5 w-3.5"/></button>
                          </Badge>
                        ))}
                      </div>
                    </div>
                    
                    <div className="space-y-4 pt-4 border-t border-border/50">
                      <div className="space-y-2">
                        <Label className="font-semibold flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400"><ShieldCheck className="h-4 w-4" /> Jeton d'accès (Events API)</Label>
                        <Input type="password" value={shop.tiktok_access_token || ""} onChange={(e) => setShop({ ...shop, tiktok_access_token: e.target.value })} placeholder="Token Events API TikTok" className="h-11 font-mono text-xs" />
                      </div>
                    </div>
                  </div>
                </Card>

                {/* Google Analytics & Ads */}
                <Card className="rounded-2xl shadow-sm border-border/50 bg-card overflow-hidden">
                  <div className="bg-[#4285F4] text-white px-6 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-3 font-bold">
                      <Globe className="h-6 w-6" /> Google Analytics 4 & Google Ads
                    </div>
                  </div>
                  <div className="p-6 space-y-6">
                    <div className="space-y-3">
                      <Label className="font-semibold text-foreground">Measurement ID (GA4)</Label>
                      <div className="flex gap-2">
                        <Input value={newGaId} onChange={(e) => setNewGaId(e.target.value)} placeholder="Ex: G-XXXXXXXXXX" className="h-11" />
                        <Button onClick={() => addPixel("google_analytics_ids", newGaId, setNewGaId)} className="h-11 px-6"><Plus className="h-4 w-4 mr-1" /> Ajouter</Button>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {(shop.google_analytics_ids || []).map((px: string, i: number) => (
                          <Badge key={i} variant="secondary" className="px-3 py-1.5 text-sm font-mono border-border/50 gap-2">
                            {px} <button onClick={() => removePixel("google_analytics_ids", i)} className="text-destructive hover:text-destructive/80"><X className="h-3.5 w-3.5"/></button>
                          </Badge>
                        ))}
                      </div>
                    </div>
                    
                    <div className="space-y-4 pt-4 border-t border-border/50">
                      <div className="space-y-2">
                        <Label className="font-semibold flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400"><ShieldCheck className="h-4 w-4" /> GA4 API Secret (Measurement Protocol)</Label>
                        <Input type="password" value={shop.ga4_api_secret || ""} onChange={(e) => setShop({ ...shop, ga4_api_secret: e.target.value })} placeholder="Secret généré dans GA4" className="h-11 font-mono text-xs" />
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4 mt-4">
                         <div className="space-y-2">
                          <Label className="font-semibold text-xs">Ads Conversion ID</Label>
                          <Input value={shop.google_ads_conversion_id || ""} onChange={(e) => setShop({ ...shop, google_ads_conversion_id: e.target.value })} placeholder="AW-XXXXXXXXXX" className="h-10 text-sm" />
                        </div>
                        <div className="space-y-2">
                          <Label className="font-semibold text-xs">Conversion Label (Achat)</Label>
                          <Input value={shop.google_ads_conversion_label || ""} onChange={(e) => setShop({ ...shop, google_ads_conversion_label: e.target.value })} placeholder="abcDEFghIJKlm" className="h-10 text-sm" />
                        </div>
                      </div>
                    </div>
                  </div>
                </Card>
                
                {/* Snapchat Pixel */}
                <Card className="rounded-2xl shadow-sm border-border/50 bg-card overflow-hidden">
                  <div className="bg-[#FFFC00] text-black px-6 py-4 flex items-center justify-between border-b border-black/5">
                    <div className="flex items-center gap-3 font-bold">
                      <span className="text-2xl leading-none">👻</span> Pixel Snapchat
                    </div>
                  </div>
                  <div className="p-6 space-y-6">
                    <div className="space-y-3">
                      <Label className="font-semibold text-foreground">Identifiants de Pixel (Côté Client)</Label>
                      <div className="flex gap-2">
                        <Input value={newSnapPixel} onChange={(e) => setNewSnapPixel(e.target.value)} placeholder="ID du pixel Snapchat" className="h-11" />
                        <Button onClick={() => addPixel("snapchat_pixels", newSnapPixel, setNewSnapPixel)} className="h-11 px-6 bg-yellow-400 text-black hover:bg-yellow-500"><Plus className="h-4 w-4 mr-1" /> Ajouter</Button>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {(shop.snapchat_pixels || []).map((px: string, i: number) => (
                          <Badge key={i} variant="secondary" className="px-3 py-1.5 text-sm font-mono border-border/50 gap-2 bg-yellow-50/50">
                            {px} <button onClick={() => removePixel("snapchat_pixels", i)} className="text-destructive hover:text-destructive/80"><X className="h-3.5 w-3.5"/></button>
                          </Badge>
                        ))}
                      </div>
                    </div>
                    
                    <div className="space-y-4 pt-4 border-t border-border/50">
                      <div className="space-y-2">
                        <Label className="font-semibold flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400"><ShieldCheck className="h-4 w-4" /> Jeton d'accès (Conversions API)</Label>
                        <Input type="password" value={shop.snapchat_access_token || ""} onChange={(e) => setShop({ ...shop, snapchat_access_token: e.target.value })} placeholder="Token CAPI Snapchat" className="h-11 font-mono text-xs" />
                      </div>
                    </div>
                  </div>
                </Card>
              </div>
            </div>
          )}

          {/* ==================== DANGER TAB ==================== */}
          {activeTab === "danger" && (
            <div className="space-y-8 max-w-3xl">
              <div>
                <h2 className="text-2xl font-bold flex items-center gap-2 mb-1 text-destructive"><ShieldAlert className="h-6 w-6" /> Zone de danger</h2>
                <p className="text-muted-foreground text-sm">Actions critiques et irréversibles relatives à votre boutique.</p>
              </div>
              
              <Card className="p-8 rounded-2xl shadow-sm border-destructive/30 bg-destructive/5 relative overflow-hidden">
                <div className="absolute top-0 right-0 p-8 opacity-5 pointer-events-none text-destructive">
                  <ShieldAlert className="w-32 h-32" />
                </div>
                <div className="relative z-10">
                  <h3 className="font-bold text-xl text-destructive mb-3">Supprimer la boutique</h3>
                  <p className="text-foreground font-medium mb-1">
                    Cette action supprimera définitivement votre boutique <strong className="text-destructive bg-destructive/10 px-2 py-0.5 rounded">"{shop.business_name}"</strong>.
                  </p>
                  <ul className="list-disc list-inside text-sm text-muted-foreground mb-8 space-y-1">
                    <li>Tous les produits seront perdus.</li>
                    <li>Toutes les commandes et l'historique client seront supprimés.</li>
                    <li>Le sous-domaine sera libéré et le domaine personnalisé déconnecté.</li>
                    <li className="font-bold text-foreground">Cette action ne peut pas être annulée.</li>
                  </ul>
                  <Button variant="destructive" size="lg" onClick={() => setDeleteConfirmOpen(true)} className="gap-2 shadow-lg hover:shadow-destructive/20 transition-all font-bold">
                    <Trash2 className="h-5 w-5" /> Je comprends, supprimer définitivement
                  </Button>
                </div>
              </Card>

              <Dialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
                <DialogContent className="border-destructive/30 border-2 rounded-2xl max-w-md">
                  <DialogHeader className="mb-4">
                    <div className="mx-auto w-16 h-16 bg-destructive/10 text-destructive rounded-full flex items-center justify-center mb-4">
                      <AlertTriangle className="h-8 w-8" />
                    </div>
                    <DialogTitle className="text-xl text-center font-bold text-foreground">Confirmer la suppression</DialogTitle>
                    <DialogDescription className="text-center text-base mt-2">
                      Vous êtes sur le point de supprimer la boutique <strong className="text-foreground">{shop.business_name}</strong>.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <p className="text-sm font-medium text-center">Veuillez taper le nom exact de la boutique pour confirmer :</p>
                    <Input
                      value={deleteConfirmText}
                      onChange={(e) => setDeleteConfirmText(e.target.value)}
                      placeholder={shop.business_name}
                      className="h-12 text-center text-lg font-bold placeholder:font-normal"
                    />
                  </div>
                  <DialogFooter className="mt-6">
                    <Button variant="outline" className="h-12 w-full" onClick={() => setDeleteConfirmOpen(false)}>Annuler</Button>
                    <Button
                      variant="destructive"
                      className="w-full h-12 gap-2 text-base font-bold shadow-lg"
                      disabled={deleteConfirmText !== shop.business_name || deleting}
                      onClick={handleDeleteShop}
                    >
                      {deleting ? <Loader2 className="h-5 w-5 animate-spin" /> : <Trash2 className="h-5 w-5" />}
                      Supprimer
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
