import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import {
  User, Settings2, BarChart3, CreditCard, ShoppingCart,
  Trash2, Plus, X, GripVertical, Facebook, Globe, AlertTriangle, Loader2, ShieldCheck, Link2, Copy, Check,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { CheckoutMobilePreview } from "./CheckoutMobilePreview";
import { DnsConfigurationAssistant } from "@/components/DnsConfigurationAssistant";

type SettingsTab = "general" | "payment" | "analytics" | "checkout" | "domain" | "danger";

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

const SETTINGS_NAV: { id: SettingsTab; label: string; icon: React.ElementType }[] = [
  { id: "general", label: "Général", icon: Settings2 },
  { id: "payment", label: "Paiement", icon: CreditCard },
  { id: "checkout", label: "Check-out", icon: ShoppingCart },
  { id: "analytics", label: "Analytiques et Pixels", icon: BarChart3 },
  { id: "domain", label: "Domaine personnalisé", icon: Globe },
  { id: "danger", label: "Zone de danger", icon: Trash2 },
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
    <div className="flex flex-col md:flex-row gap-0 max-w-5xl">
      {/* Settings sub-nav */}
      <div className="md:w-[220px] shrink-0 border-b md:border-b-0 md:border-r">
        <nav className="flex md:flex-col overflow-x-auto md:overflow-x-visible p-2 md:p-3 gap-0.5">
          {SETTINGS_NAV.map(item => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${
                activeTab === item.id
                  ? "bg-primary/10 text-primary border-l-2 border-primary"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
              }`}
            >
              <item.icon className="h-4 w-4 shrink-0" />
              {item.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Content */}
      <div className="flex-1 p-4 md:p-6 space-y-6">
        {activeTab === "general" && (
          <>
            <h2 className="text-xl font-bold">Informations générales</h2>
            <Card className="p-6 space-y-4">
              <div className="space-y-1.5">
                <Label>Nom de la boutique</Label>
                <Input value={shop.business_name} onChange={(e) => setShop({ ...shop, business_name: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label className="flex items-center gap-1.5"><Link2 className="h-3.5 w-3.5" /> Lien public de la boutique</Label>
                <div className="flex items-stretch rounded-md border bg-background overflow-hidden focus-within:ring-2 focus-within:ring-ring">
                  <span className="px-2.5 py-2 text-xs sm:text-sm text-muted-foreground bg-muted/60 border-r select-none whitespace-nowrap">
                    visuelpro.cloud/shop/
                  </span>
                  <Input
                    value={shop.slug || ""}
                    onChange={(e) => setShop({
                      ...shop,
                      slug: e.target.value
                        .toLowerCase()
                        .normalize("NFD")
                        .replace(/[\u0300-\u036f]/g, "")
                        .replace(/[^a-z0-9-]/g, "-")
                        .replace(/-+/g, "-")
                        .slice(0, 50),
                    })}
                    placeholder="ma-boutique"
                    className="border-0 rounded-none focus-visible:ring-0 focus-visible:ring-offset-0 text-sm"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="rounded-none border-l"
                    onClick={() => {
                      const url = `https://visuelpro.cloud/shop/${shop.slug || ""}`;
                      navigator.clipboard.writeText(url);
                      setLinkCopied(true);
                      toast({ title: "Lien copié ✓", description: url });
                      setTimeout(() => setLinkCopied(false), 2000);
                    }}
                  >
                    {linkCopied ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Ce lien fonctionne pour <strong>tout le monde</strong> (Facebook, TikTok, Snapchat, Google, WhatsApp…). Lettres, chiffres et tirets uniquement. Cliquez sur <strong>Sauvegarder</strong> pour confirmer.
                </p>
              </div>
              <div className="space-y-1.5">
                <Label>Description</Label>
                <Textarea value={shop.business_description || ""} onChange={(e) => setShop({ ...shop, business_description: e.target.value })} rows={3} />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5"><Label>WhatsApp</Label><Input value={shop.whatsapp_number || ""} onChange={(e) => setShop({ ...shop, whatsapp_number: e.target.value })} /></div>
                <div className="space-y-1.5"><Label>Téléphone</Label><Input value={shop.phone_number || ""} onChange={(e) => setShop({ ...shop, phone_number: e.target.value })} /></div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5"><Label>Email</Label><Input value={shop.email || ""} onChange={(e) => setShop({ ...shop, email: e.target.value })} /></div>
                <div className="space-y-1.5"><Label>Ville</Label><Input value={shop.city || ""} onChange={(e) => setShop({ ...shop, city: e.target.value })} /></div>
              </div>
            </Card>
            <Card className="p-6 space-y-4">
              <h3 className="font-bold text-lg">Confirmation de commande</h3>
              <p className="text-sm text-muted-foreground">
                Ces informations s'affichent sur la page de remerciement après chaque commande.
              </p>
              <div className="space-y-1.5">
                <Label>Numéro du conseiller livraison</Label>
                <Input
                  value={shop.delivery_advisor_phone || ""}
                  onChange={(e) => setShop({ ...shop, delivery_advisor_phone: e.target.value })}
                  placeholder="07 XX XX XX XX"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Message de confirmation</Label>
                <Textarea
                  rows={3}
                  value={shop.order_confirmation_message || ""}
                  onChange={(e) => setShop({ ...shop, order_confirmation_message: e.target.value })}
                  placeholder="Félicitations ! Un conseiller va vous appeler pour la livraison."
                />
              </div>
            </Card>
            <Card className="p-6 space-y-4">
              <h3 className="font-bold text-lg">Publication</h3>
              <div className="flex items-center justify-between">
                <div><p className="font-medium">Boutique en ligne</p><p className="text-sm text-muted-foreground">Rendre la boutique visible aux visiteurs</p></div>
                <Switch checked={shop.is_published} onCheckedChange={(v) => setShop({ ...shop, is_published: v })} />
              </div>
              <div className="flex items-center justify-between">
                <div><p className="font-medium">Preuve sociale</p><p className="text-sm text-muted-foreground">Afficher les notifications de commandes récentes aux visiteurs</p></div>
                <div className="flex items-center gap-2">
                  {savingSocialProof && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
                  <Switch checked={shop.social_proof_enabled || false} onCheckedChange={updateSocialProof} disabled={savingSocialProof} />
                </div>
              </div>
            </Card>
          </>
        )}

        {activeTab === "payment" && (
          <>
            <h2 className="text-xl font-bold">Paramètres de paiement</h2>
            <Card className="p-6 space-y-4">
              <h3 className="font-semibold">Choisissez comment être payé par vos clients</h3>
              {[
                { id: "cod", label: "Paiement à la livraison (COD)", desc: "Le client paie à la réception" },
                { id: "mobile_money", label: "Mobile Money", desc: "Wave, Orange Money, MTN MoMo" },
              ].map(method => (
                <div key={method.id} className="flex items-center justify-between p-4 rounded-xl border">
                  <div>
                    <p className="font-medium">{method.label}</p>
                    <p className="text-sm text-muted-foreground">{method.desc}</p>
                  </div>
                  <Switch
                    checked={paymentMethods.includes(method.id)}
                    onCheckedChange={() => togglePaymentMethod(method.id)}
                  />
                </div>
              ))}
            </Card>

            {paymentMethods.includes("cod") && (
              <Card className="p-6 space-y-4">
                <h3 className="font-semibold">Paramètres COD</h3>
                <div className="space-y-1.5">
                  <Label>Taux de délivrabilité (COD uniquement)</Label>
                  <Input
                    type="number"
                    value={shop.cod_delivery_rate ?? 100}
                    onChange={(e) => setShop({ ...shop, cod_delivery_rate: Number(e.target.value) })}
                    min={0} max={100}
                  />
                  <p className="text-xs text-muted-foreground">Pourcentage estimé de livraisons abouties</p>
                </div>
              </Card>
            )}
          </>
        )}

        {activeTab === "checkout" && (
          <>
            <h2 className="text-xl font-bold">Informations de paiement</h2>
            <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6 items-start">
              <div className="space-y-4 min-w-0">
            <Card className="p-6 space-y-4">
              <h3 className="font-semibold">Mode de checkout</h3>
              <div className="flex items-center justify-between p-4 rounded-xl border">
                <div>
                  <p className="font-medium">Checkout sur une seule page</p>
                  <p className="text-sm text-muted-foreground">Panier, informations et paiement sur la même page (sans étapes)</p>
                </div>
                <Switch
                  checked={shop.theme_config?.single_page_checkout || false}
                  onCheckedChange={(v) => setShop({ ...shop, theme_config: { ...(shop.theme_config || {}), single_page_checkout: v } })}
                />
              </div>
              <div className="flex items-center justify-between p-4 rounded-xl border">
                <div>
                  <p className="font-medium">Masquer le menu / navigation</p>
                  <p className="text-sm text-muted-foreground">Cache l'en-tête et le fil d'Ariane sur la fiche produit (idéal pour les landing pages)</p>
                </div>
                <Switch
                  checked={shop.theme_config?.hide_product_header || false}
                  onCheckedChange={(v) => setShop({ ...shop, theme_config: { ...(shop.theme_config || {}), hide_product_header: v } })}
                />
              </div>
              <div className="flex items-center justify-between p-4 rounded-xl border">
                <div>
                  <p className="font-medium">Bouton Commander flottant</p>
                  <p className="text-sm text-muted-foreground">Le bouton reste visible en bas de l'écran même en scrollant</p>
                </div>
                <Switch
                  checked={shop.theme_config?.sticky_order_button || false}
                  onCheckedChange={(v) => setShop({ ...shop, theme_config: { ...(shop.theme_config || {}), sticky_order_button: v } })}
                />
              </div>
              <div className="flex items-center justify-between p-4 rounded-xl border">
                <div>
                  <p className="font-medium">Paiement obligatoire pour l'intérieur du pays</p>
                  <p className="text-sm text-muted-foreground">Les clients hors Abidjan doivent payer par Mobile Money avant de valider. Seuls les clients d'Abidjan peuvent payer à la livraison.</p>
                </div>
                <Switch
                  checked={shop.theme_config?.force_mobile_money_interior || false}
                  onCheckedChange={(v) => setShop({ ...shop, theme_config: { ...(shop.theme_config || {}), force_mobile_money_interior: v } })}
                />
              </div>
            </Card>
            <Card className="p-6 space-y-3">
              <p className="text-sm text-muted-foreground mb-2">Configurez les champs affichés lors du checkout client</p>
              {checkoutFields.map(field => (
                <div key={field.id} className="flex items-center gap-3 p-3 rounded-xl border">
                  <GripVertical className="h-4 w-4 text-muted-foreground shrink-0" />
                  <Switch
                    checked={field.enabled}
                    onCheckedChange={(v) => updateCheckoutField(field.id, "enabled", v)}
                  />
                  <div className="flex-1 min-w-0">
                    <span className="text-sm font-medium">{field.label}</span>
                    <Badge variant="outline" className="ml-2 text-[10px]">{field.type === "tel" ? "Téléphone" : field.type === "email" ? "E-mail" : "Texte"}</Badge>
                  </div>
                  <label className="flex items-center gap-1.5 text-xs text-muted-foreground shrink-0">
                    <input
                      type="checkbox"
                      checked={field.required}
                      onChange={(e) => updateCheckoutField(field.id, "required", e.target.checked)}
                      className="rounded"
                      disabled={!field.enabled}
                    />
                    Obligatoire
                  </label>
                </div>
              ))}
            </Card>
              </div>
              <div className="lg:block">
                <CheckoutMobilePreview shop={shop} />
              </div>
            </div>
          </>
        )}

        {activeTab === "analytics" && (
          <>
            <h2 className="text-xl font-bold">Analytiques et Pixels</h2>
            <p className="text-sm text-muted-foreground flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-orange-500" />
              L'ajout de trop de pixels peut affecter la vitesse de votre page.
            </p>

            {/* Master switch */}
            <Card className="p-5 flex items-center justify-between gap-4">
              <div>
                <p className="font-semibold flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-emerald-600" />
                  Suivi serveur (Conversions API)
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  Active le suivi côté serveur (Meta CAPI, TikTok Events API, Snap CAPI, GA4 Measurement Protocol).
                  Les événements <code>PageView, ViewContent, AddToCart, Purchase</code> sont envoyés en double avec
                  un même <code>event_id</code> pour la déduplication automatique côté Meta / TikTok.
                </p>
              </div>
              <Switch
                checked={shop.tracking_enabled !== false}
                onCheckedChange={(v) => setShop({ ...shop, tracking_enabled: v })}
              />
            </Card>

            {/* Google Analytics */}
            <Card className="overflow-hidden">
              <div className="bg-red-500 text-white px-5 py-3 flex items-center justify-between">
                <div className="flex items-center gap-2 font-semibold text-sm">
                  <Globe className="h-4 w-4" /> Paramètres Google Analytics
                </div>
              </div>
              <div className="p-5 space-y-4">
                <div className="space-y-1.5">
                  <Label>Identifiants de suivi Google</Label>
                  <div className="flex gap-2">
                    <Input value={newGaId} onChange={(e) => setNewGaId(e.target.value)} placeholder="G-XXXXXXXXXX" />
                    <Button onClick={() => addPixel("google_analytics_ids", newGaId, setNewGaId)} className="shrink-0 gap-1"><Plus className="h-4 w-4" /> Ajouter</Button>
                  </div>
                </div>
                {(shop.google_analytics_ids || []).map((id: string, i: number) => (
                  <div key={i} className="flex items-center justify-between px-4 py-2.5 rounded-lg border">
                    <span className="font-mono text-sm">{id}</span>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => removePixel("google_analytics_ids", i)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
                <div className="space-y-1.5">
                  <Label>Google Analytics (code personnalisé)</Label>
                  <Textarea value={shop.google_analytics_code || ""} onChange={(e) => setShop({ ...shop, google_analytics_code: e.target.value })} placeholder="Collez votre script Google Analytics ici" rows={4} className="font-mono text-xs" />
                </div>
              </div>
            </Card>

            {/* Facebook Pixel */}
            <Card className="overflow-hidden">
              <div className="bg-blue-600 text-white px-5 py-3 flex items-center justify-between">
                <div className="flex items-center gap-2 font-semibold text-sm">
                  <Facebook className="h-4 w-4" /> Paramètres de pixel Facebook
                </div>
              </div>
              <div className="p-5 space-y-4">
                <div className="flex gap-2">
                  <Input value={newFbPixel} onChange={(e) => setNewFbPixel(e.target.value)} placeholder="ID du pixel Facebook" />
                  <Button onClick={() => addPixel("facebook_pixels", newFbPixel, setNewFbPixel)} className="shrink-0 gap-1"><Plus className="h-4 w-4" /> Ajouter</Button>
                </div>
                {(shop.facebook_pixels || []).map((px: string, i: number) => (
                  <div key={i} className="flex items-center justify-between px-4 py-2.5 rounded-lg border">
                    <span className="font-mono text-sm">{px}</span>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => removePixel("facebook_pixels", i)}><Trash2 className="h-4 w-4" /></Button>
                  </div>
                ))}
                <div className="space-y-1.5 border-t pt-4">
                  <Label className="flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-emerald-600" /> Access Token (Conversions API)</Label>
                  <Input
                    type="password"
                    value={shop.facebook_access_token || ""}
                    onChange={(e) => setShop({ ...shop, facebook_access_token: e.target.value })}
                    placeholder="EAAG... (token CAPI permanent)"
                  />
                  <p className="text-xs text-muted-foreground">
                    Gestionnaire d'événements Meta → Paramètres → Conversions API → Générer un jeton d'accès. Permet de tracer les achats serveur même si le pixel est bloqué.
                  </p>
                </div>
                <div className="space-y-1.5">
                  <Label>Code d'événement test (optionnel)</Label>
                  <Input
                    value={shop.facebook_test_event_code || ""}
                    onChange={(e) => setShop({ ...shop, facebook_test_event_code: e.target.value })}
                    placeholder="TEST12345"
                  />
                  <p className="text-xs text-muted-foreground">À retirer une fois la configuration validée dans Test Events.</p>
                </div>
              </div>
            </Card>

            {/* TikTok Pixel */}
            <Card className="overflow-hidden">
              <div className="bg-gray-900 text-white px-5 py-3 flex items-center justify-between">
                <div className="flex items-center gap-2 font-semibold text-sm">
                  <span className="text-base">♪</span> Paramètres de pixel TikTok
                </div>
              </div>
              <div className="p-5 space-y-4">
                <div className="flex gap-2">
                  <Input value={newTiktokPixel} onChange={(e) => setNewTiktokPixel(e.target.value)} placeholder="ID du pixel TikTok" />
                  <Button onClick={() => addPixel("tiktok_pixels", newTiktokPixel, setNewTiktokPixel)} className="shrink-0 gap-1"><Plus className="h-4 w-4" /> Ajouter</Button>
                </div>
                {(shop.tiktok_pixels || []).map((px: string, i: number) => (
                  <div key={i} className="flex items-center justify-between px-4 py-2.5 rounded-lg border">
                    <span className="font-mono text-sm">{px}</span>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => removePixel("tiktok_pixels", i)}><Trash2 className="h-4 w-4" /></Button>
                  </div>
                ))}
                <div className="space-y-1.5 border-t pt-4">
                  <Label className="flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-emerald-600" /> Access Token (Events API)</Label>
                  <Input
                    type="password"
                    value={shop.tiktok_access_token || ""}
                    onChange={(e) => setShop({ ...shop, tiktok_access_token: e.target.value })}
                    placeholder="Token Events API TikTok"
                  />
                  <p className="text-xs text-muted-foreground">TikTok Events Manager → Settings → Events API → Generate Access Token.</p>
                </div>
              </div>
            </Card>

            {/* Snapchat Pixel */}
            <Card className="overflow-hidden">
              <div className="bg-yellow-400 text-black px-5 py-3 flex items-center justify-between">
                <div className="flex items-center gap-2 font-semibold text-sm">
                  <span className="text-base">👻</span> Paramètres de pixel Snapchat
                </div>
              </div>
              <div className="p-5 space-y-4">
                <div className="flex gap-2">
                  <Input value={newSnapPixel} onChange={(e) => setNewSnapPixel(e.target.value)} placeholder="ID du pixel Snapchat" />
                  <Button onClick={() => addPixel("snapchat_pixels", newSnapPixel, setNewSnapPixel)} className="shrink-0 gap-1"><Plus className="h-4 w-4" /> Ajouter</Button>
                </div>
                {(shop.snapchat_pixels || []).map((px: string, i: number) => (
                  <div key={i} className="flex items-center justify-between px-4 py-2.5 rounded-lg border">
                    <span className="font-mono text-sm">{px}</span>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => removePixel("snapchat_pixels", i)}><Trash2 className="h-4 w-4" /></Button>
                  </div>
                ))}
                <div className="space-y-1.5 border-t pt-4">
                  <Label className="flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-emerald-600" /> Access Token (Conversions API)</Label>
                  <Input
                    type="password"
                    value={shop.snapchat_access_token || ""}
                    onChange={(e) => setShop({ ...shop, snapchat_access_token: e.target.value })}
                    placeholder="Token CAPI Snapchat"
                  />
                </div>
              </div>
            </Card>

            {/* Google Ads + GA4 Measurement Protocol */}
            <Card className="overflow-hidden">
              <div className="bg-emerald-600 text-white px-5 py-3 flex items-center gap-2 font-semibold text-sm">
                <Globe className="h-4 w-4" /> Google Ads & GA4 (suivi serveur)
              </div>
              <div className="p-5 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label>GA4 Measurement ID</Label>
                    <Input
                      value={shop.ga4_measurement_id || ""}
                      onChange={(e) => setShop({ ...shop, ga4_measurement_id: e.target.value })}
                      placeholder="G-XXXXXXXXXX"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>GA4 API Secret</Label>
                    <Input
                      type="password"
                      value={shop.ga4_api_secret || ""}
                      onChange={(e) => setShop({ ...shop, ga4_api_secret: e.target.value })}
                      placeholder="Measurement Protocol secret"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label>Google Ads Conversion ID</Label>
                    <Input
                      value={shop.google_ads_conversion_id || ""}
                      onChange={(e) => setShop({ ...shop, google_ads_conversion_id: e.target.value })}
                      placeholder="AW-XXXXXXXXXX"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Conversion Label (Achat)</Label>
                    <Input
                      value={shop.google_ads_conversion_label || ""}
                      onChange={(e) => setShop({ ...shop, google_ads_conversion_label: e.target.value })}
                      placeholder="abcDEFghIJKlmnoPQ"
                    />
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  GA4 → Admin → Data Streams → Measurement Protocol API secrets pour générer le secret. Le coût par achat sera disponible dans Google Ads une fois la conversion liée à Google Ads.
                </p>
              </div>
            </Card>
          </>
        )}

        {activeTab === "danger" && (
          <>
            <h2 className="text-xl font-bold text-destructive">Zone de danger</h2>
          </>
        )}

        {activeTab === "domain" && (
          <>
            <h2 className="text-xl font-bold">Domaine personnalisé</h2>
            <p className="text-sm text-muted-foreground -mt-2">
              Connectez votre propre nom de domaine (acheté sur OVH, Hostinger, Namecheap, Cloudflare, Lovable…) à votre boutique. Vos clients verront votre adresse personnalisée à la place de visuelpro.cloud.
            </p>
            <DnsConfigurationAssistant
              resourceId={shop.id}
              resourceType="shop"
              currentBaseUrl={`visuelpro.cloud/shop/${shop.slug || ""}`}
              currentDomain={shop.custom_domain || ""}
              verificationCode={shop.domain_verification_code || ""}
              domainStatus={shop.domain_status || "not_configured"}
              propagationPercentage={shop.dns_propagation_percentage || 0}
              sslStatus={shop.ssl_status || "pending"}
              onDomainSave={async (domain) => {
                const cleaned = domain.toLowerCase().replace(/^https?:\/\//, "").replace(/\/$/, "");
                const { data, error } = await supabase
                  .from("shops")
                  .update({ custom_domain: cleaned })
                  .eq("id", shop.id)
                  .select()
                  .single();
                if (error) throw error;
                if (data) setShop({ ...shop, ...data });
              }}
            />
          </>
        )}

        {activeTab === "_danger_placeholder" && (
          <>
            <h2 className="text-xl font-bold text-destructive">Zone de danger</h2>
            <Card className="p-6 border-destructive/30 space-y-4">
              <div>
                <h3 className="font-bold text-lg">Supprimer la boutique</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Cette action supprimera définitivement votre boutique <strong>"{shop.business_name}"</strong>, tous ses produits et commandes. Cette action est irréversible.
                </p>
              </div>
              <Button variant="destructive" onClick={() => setDeleteConfirmOpen(true)} className="gap-2">
                <Trash2 className="h-4 w-4" /> Supprimer définitivement
              </Button>
            </Card>

            <Dialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle className="text-destructive flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5" /> Confirmer la suppression
                  </DialogTitle>
                  <DialogDescription>
                    Tapez <strong>{shop.business_name}</strong> pour confirmer la suppression.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <Input
                    value={deleteConfirmText}
                    onChange={(e) => setDeleteConfirmText(e.target.value)}
                    placeholder={shop.business_name}
                  />
                  <Button
                    variant="destructive"
                    className="w-full gap-2"
                    disabled={deleteConfirmText !== shop.business_name || deleting}
                    onClick={handleDeleteShop}
                  >
                    {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                    Supprimer définitivement
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </>
        )}
      </div>
    </div>
  );
}
