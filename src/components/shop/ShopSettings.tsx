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
  Trash2, Plus, X, GripVertical, Facebook, Globe, AlertTriangle, Loader2,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

type SettingsTab = "general" | "payment" | "analytics" | "checkout" | "danger";

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
  { id: "danger", label: "Zone de danger", icon: Trash2 },
];

export function ShopSettings({ shop, setShop, onDeleteShop }: ShopSettingsProps) {
  const [activeTab, setActiveTab] = useState<SettingsTab>("general");
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);

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
              <h3 className="font-bold text-lg">Publication</h3>
              <div className="flex items-center justify-between">
                <div><p className="font-medium">Boutique en ligne</p><p className="text-sm text-muted-foreground">Rendre la boutique visible aux visiteurs</p></div>
                <Switch checked={shop.is_published} onCheckedChange={(v) => setShop({ ...shop, is_published: v })} />
              </div>
              <div className="flex items-center justify-between">
                <div><p className="font-medium">Preuve sociale</p><p className="text-sm text-muted-foreground">Afficher les notifications de commandes récentes aux visiteurs</p></div>
                <Switch checked={shop.social_proof_enabled || false} onCheckedChange={(v) => setShop({ ...shop, social_proof_enabled: v })} />
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
          </>
        )}

        {activeTab === "analytics" && (
          <>
            <h2 className="text-xl font-bold">Analytiques et Pixels</h2>
            <p className="text-sm text-muted-foreground flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-orange-500" />
              L'ajout de trop de pixels peut affecter la vitesse de votre page.
            </p>

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
              <div className="p-5 space-y-3">
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
              </div>
            </Card>

            {/* TikTok Pixel */}
            <Card className="overflow-hidden">
              <div className="bg-gray-900 text-white px-5 py-3 flex items-center justify-between">
                <div className="flex items-center gap-2 font-semibold text-sm">
                  <span className="text-base">♪</span> Paramètres de pixel TikTok
                </div>
              </div>
              <div className="p-5 space-y-3">
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
              </div>
            </Card>

            {/* Snapchat Pixel */}
            <Card className="overflow-hidden">
              <div className="bg-yellow-400 text-black px-5 py-3 flex items-center justify-between">
                <div className="flex items-center gap-2 font-semibold text-sm">
                  <span className="text-base">👻</span> Paramètres de pixel Snapchat
                </div>
              </div>
              <div className="p-5 space-y-3">
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
              </div>
            </Card>
          </>
        )}

        {activeTab === "danger" && (
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
