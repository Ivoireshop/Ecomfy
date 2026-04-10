import { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { Loader2, Plus, Save, Image as ImageIcon, Upload, Palette, Globe, MessageSquare, Store, Zap, CreditCard, X, FileText, DollarSign, Box, ToggleLeft, Menu } from "lucide-react";
import { ShopSidebar, type ActiveSection } from "@/components/shop/ShopSidebar";
import { ProductsTable } from "@/components/shop/ProductsTable";
import { ShopOverview } from "@/components/shop/ShopOverview";
import { OrdersList } from "@/components/shop/OrdersList";
import { ShopSettings } from "@/components/shop/ShopSettings";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";

interface Product {
  id: string;
  name: string;
  description: string | null;
  short_description: string | null;
  price: number;
  compare_at_price: number | null;
  category: string;
  stock_quantity: number;
  is_published: boolean;
  is_digital: boolean;
  is_featured: boolean;
  display_order: number;
  currency: string | null;
  sku: string | null;
  weight: number | null;
  created_at?: string;
  product_images?: { id: string; image_url: string; is_primary: boolean; display_order: number }[];
}

interface Order {
  id: string;
  order_number: string;
  customer_name: string;
  customer_phone: string;
  customer_email: string | null;
  customer_address: string | null;
  customer_city: string | null;
  total: number;
  payment_method: string;
  payment_status: string;
  order_status: string;
  is_read: boolean;
  created_at: string;
  order_items?: { id: string; product_name: string; quantity: number; unit_price: number; total_price: number; product_image_url: string | null; product_id: string }[];
}

const CATEGORIES = [
  "Mode & Vêtements", "Électronique", "Beauté & Soins", "Maison & Déco",
  "Alimentation", "Sport", "Accessoires", "Digital", "Autre"
];

const ShopEditor = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [shop, setShop] = useState<any>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [productDialogOpen, setProductDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [activeSection, setActiveSection] = useState<ActiveSection>("overview");
  const [searchQuery, setSearchQuery] = useState("");
  const [activating, setActivating] = useState(false);
  const [showActivationModal, setShowActivationModal] = useState(false);
  const [activationPhone, setActivationPhone] = useState("");
  const [activationProvider, setActivationProvider] = useState("");
  const [shopActivationPaid, setShopActivationPaid] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [newProduct, setNewProduct] = useState({
    name: "", description: "", short_description: "", price: 0, compare_at_price: 0,
    category: "Autre", stock_quantity: 10, is_digital: false, is_published: true,
    sku: "", weight: 0, is_featured: false,
  });
  const [productImages, setProductImages] = useState<File[]>([]);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [unreadOrders, setUnreadOrders] = useState(0);

  const fetchData = useCallback(async () => {
    if (!id) return;
    const { data: { session } } = await supabase.auth.getSession();
    const [shopRes, productsRes, ordersRes, profileRes] = await Promise.all([
      supabase.from("shops").select("*").eq("id", id).single() as any,
      supabase.from("products").select("*, product_images(*)").eq("shop_id", id).order("display_order") as any,
      supabase.from("orders").select("*, order_items(*)").eq("shop_id", id).order("created_at", { ascending: false }) as any,
      session ? supabase.from("profiles").select("shop_activation_paid").eq("id", session.user.id).single() as any : null,
    ]);
    if (shopRes.data) setShop(shopRes.data);
    if (productsRes.data) setProducts(productsRes.data);
    if (ordersRes.data) {
      setOrders(ordersRes.data);
      setUnreadOrders(ordersRes.data.filter((o: Order) => !o.is_read).length);
    }
    if (profileRes?.data) setShopActivationPaid(profileRes.data.shop_activation_paid || false);
    setLoading(false);
  }, [id]);

  useEffect(() => { fetchData(); }, [fetchData]);

  useEffect(() => {
    if (!id) return;
    const channel = supabase.channel(`shop-orders-${id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "orders", filter: `shop_id=eq.${id}` }, (payload) => {
        const newOrder = payload.new as Order;
        setOrders(prev => [newOrder, ...prev]);
        setUnreadOrders(prev => prev + 1);
        toast({ title: "🛒 Nouvelle commande !", description: `${newOrder.customer_name} - ${newOrder.order_number}` });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [id]);

  const isActivated = shopActivationPaid || shop?.is_activated;

  const handleActivateShop = async () => {
    if (!activationProvider) { toast({ title: "Choisissez un opérateur", variant: "destructive" }); return; }
    if (activationProvider !== "wave" && !activationPhone) { toast({ title: "Entrez votre numéro", variant: "destructive" }); return; }
    setActivating(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Non connecté");
      const { data, error } = await supabase.functions.invoke("process-payment", {
        body: { amount: 1300, payment_method: "mobile_money", user_id: session.user.id, provider: activationProvider, phone: activationPhone, payment_type: "shop_activation" },
      });
      if (error) throw error;
      const paymentUrl = data?.payment_url || data?.url || data?.checkout_url || data?.link;
      if (paymentUrl) { window.location.assign(paymentUrl); return; }
      throw new Error("Impossible d'ouvrir la page de paiement");
    } catch (err) {
      toast({ title: "Erreur", description: err instanceof Error ? err.message : "Erreur de paiement", variant: "destructive" });
    } finally { setActivating(false); }
  };

  const uploadShopImage = async (file: File, type: 'logo' | 'banner' | 'favicon') => {
    if (!shop) return;
    try {
      const ext = file.name.split('.').pop();
      const path = `${shop.id}/${type}-${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage.from('shop-images').upload(path, file);
      if (uploadError) throw uploadError;
      const { data: urlData } = supabase.storage.from('shop-images').getPublicUrl(path);
      const field = type === 'logo' ? 'logo_url' : type === 'banner' ? 'banner_url' : 'favicon_url';
      await supabase.from('shops').update({ [field]: urlData.publicUrl }).eq('id', shop.id);
      setShop({ ...shop, [field]: urlData.publicUrl });
      toast({ title: `✓ ${type === 'logo' ? 'Logo' : type === 'banner' ? 'Bannière' : 'Favicon'} mis à jour` });
    } catch { toast({ title: "Erreur d'upload", variant: "destructive" }); }
  };

  const saveShop = async () => {
    if (!shop) return;
    setSaving(true);
    const { error } = await supabase.from("shops").update({
      business_name: shop.business_name, business_description: shop.business_description,
      whatsapp_number: shop.whatsapp_number, phone_number: shop.phone_number, email: shop.email,
      city: shop.city, primary_color: shop.primary_color, secondary_color: shop.secondary_color,
      chatbot_enabled: shop.chatbot_enabled, chatbot_welcome_message: shop.chatbot_welcome_message,
      is_published: shop.is_published, seo_title: shop.seo_title, seo_description: shop.seo_description,
      logo_url: shop.logo_url, banner_url: shop.banner_url, favicon_url: shop.favicon_url,
      facebook_pixels: shop.facebook_pixels, tiktok_pixels: shop.tiktok_pixels,
      snapchat_pixels: shop.snapchat_pixels, google_analytics_ids: shop.google_analytics_ids,
      google_analytics_code: shop.google_analytics_code, checkout_fields: shop.checkout_fields,
      cod_delivery_rate: shop.cod_delivery_rate, payment_methods: shop.payment_methods,
    }).eq("id", shop.id) as any;
    if (error) toast({ title: "Erreur", description: error.message, variant: "destructive" });
    else toast({ title: "✓ Sauvegardé" });
    setSaving(false);
  };

  const resetProductForm = () => {
    setNewProduct({ name: "", description: "", short_description: "", price: 0, compare_at_price: 0, category: "Autre", stock_quantity: 10, is_digital: false, is_published: true, sku: "", weight: 0, is_featured: false });
    setProductImages([]);
  };

  const saveProduct = async () => {
    if (!id) return;
    const productData = {
      name: newProduct.name, description: newProduct.description, short_description: newProduct.short_description,
      price: newProduct.price, compare_at_price: newProduct.compare_at_price || null, category: newProduct.category,
      stock_quantity: newProduct.stock_quantity, is_digital: newProduct.is_digital, is_published: newProduct.is_published,
      is_featured: newProduct.is_featured, sku: newProduct.sku || null, weight: newProduct.weight || null, shop_id: id,
    };
    let result;
    if (editingProduct) {
      result = await supabase.from("products").update(productData).eq("id", editingProduct.id) as any;
    } else {
      result = await supabase.from("products").insert(productData) as any;
    }
    if (result.error) {
      toast({ title: "Erreur", description: result.error.message, variant: "destructive" });
    } else {
      if (!editingProduct && productImages.length > 0 && result.data?.[0]?.id) {
        for (const file of productImages) await uploadProductImage(result.data[0].id, file);
      }
      toast({ title: editingProduct ? "Produit modifié ✓" : "Produit ajouté ✓" });
      setProductDialogOpen(false);
      setEditingProduct(null);
      resetProductForm();
      fetchData();
    }
  };

  const deleteProduct = async (productId: string) => {
    if (!confirm("Supprimer ce produit ?")) return;
    await supabase.from("products").delete().eq("id", productId) as any;
    toast({ title: "Produit supprimé" });
    fetchData();
  };

  const uploadProductImage = async (productId: string, file: File) => {
    setUploadingImage(true);
    const ext = file.name.split(".").pop();
    const path = `products/${productId}/${Date.now()}.${ext}`;
    const { error: uploadError } = await supabase.storage.from("shop-images").upload(path, file);
    if (uploadError) { toast({ title: "Erreur", description: uploadError.message, variant: "destructive" }); setUploadingImage(false); return; }
    const { data: urlData } = supabase.storage.from("shop-images").getPublicUrl(path);
    await supabase.from("product_images").insert({ product_id: productId, image_url: urlData.publicUrl, is_primary: false }) as any;
    setUploadingImage(false);
    fetchData();
  };

  const updateOrderStatus = async (orderId: string, status: string) => {
    await supabase.from("orders").update({ order_status: status, is_read: true }).eq("id", orderId) as any;
    toast({ title: "Statut mis à jour" });
    fetchData();
  };

  const markOrderRead = async (orderId: string) => {
    await supabase.from("orders").update({ is_read: true }).eq("id", orderId) as any;
    setUnreadOrders(prev => Math.max(0, prev - 1));
    setOrders(prev => prev.map(o => o.id === orderId ? { ...o, is_read: true } : o));
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  if (!shop) return <div className="min-h-screen flex items-center justify-center"><p>Boutique introuvable</p></div>;

  const primaryColor = shop.primary_color || "#2563eb";
  const totalRevenue = orders.reduce((sum, o) => sum + o.total, 0);
  const newOrders = orders.filter(o => o.order_status === "new").length;

  const openPreview = () => window.open(shop?.is_activated && shop?.is_published ? `/shop/${shop.slug}` : `/shop-preview/${shop.id}`, "_blank");

  const sidebarProps = {
    shopName: shop.business_name,
    slug: shop.slug,
    primaryColor,
    logoUrl: shop.logo_url,
    activeSection,
    onSectionChange: (s: ActiveSection) => { setActiveSection(s); setMobileSidebarOpen(false); },
    unreadOrders,
    productCount: products.length,
    isActivated: !!isActivated,
    onBack: () => navigate("/shop-manager"),
    onSave: saveShop,
    saving,
    onPreview: openPreview,
    isPublished: shop.is_published,
  };

  return (
    <div className="min-h-screen bg-background flex">
      {/* Desktop Sidebar */}
      <div className="hidden md:block">
        <ShopSidebar {...sidebarProps} />
      </div>

      {/* Mobile Header + Sheet Sidebar */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-30 bg-card border-b px-3 py-2.5 flex items-center justify-between">
        <Sheet open={mobileSidebarOpen} onOpenChange={setMobileSidebarOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon"><Menu className="h-5 w-5" /></Button>
          </SheetTrigger>
          <SheetContent side="left" className="p-0 w-[260px]">
            <ShopSidebar {...sidebarProps} />
          </SheetContent>
        </Sheet>
        <span className="font-semibold text-sm truncate">{shop.business_name}</span>
        <Button variant="ghost" size="icon" onClick={saveShop} disabled={saving}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
        </Button>
      </div>

      {/* Main Content */}
      <main className="flex-1 min-w-0">
        {/* Activation Banner */}
        {!isActivated && (
          <div className="bg-gradient-to-r from-orange-500 to-amber-500 text-white px-4 md:px-6 py-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Zap className="h-5 w-5" />
                <div>
                  <p className="font-semibold text-sm">Activez vos boutiques pour les rendre visibles</p>
                  <p className="text-xs opacity-90">Paiement unique de 2$ · Toutes vos boutiques activées à vie</p>
                </div>
              </div>
              <Button size="sm" variant="secondary" className="font-semibold shadow-lg" onClick={() => setShowActivationModal(true)}>
                Activer · 2$
              </Button>
            </div>
          </div>
        )}

        {/* Activation Modal */}
        <Dialog open={showActivationModal} onOpenChange={setShowActivationModal}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Zap className="h-5 w-5 text-orange-500" /> Activer vos boutiques
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="bg-muted/50 rounded-xl p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Frais d'activation</span>
                  <span className="font-bold text-lg">1 300 FCFA</span>
                </div>
                <p className="text-xs text-muted-foreground">≈ 2$ USD · Paiement unique · Toutes vos boutiques activées</p>
              </div>
              <div className="space-y-2">
                <Label>Opérateur Mobile Money</Label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { id: "wave", label: "Wave", color: "bg-blue-500" },
                    { id: "orange", label: "Orange Money", color: "bg-orange-500" },
                    { id: "mtn", label: "MTN MoMo", color: "bg-yellow-500" },
                    { id: "moov", label: "Moov Money", color: "bg-blue-600" },
                  ].map(op => (
                    <button key={op.id} onClick={() => setActivationProvider(op.id)}
                      className={`p-3 rounded-xl border-2 text-sm font-medium transition-all ${activationProvider === op.id ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'}`}>
                      <div className={`h-2 w-2 rounded-full ${op.color} inline-block mr-2`} />{op.label}
                    </button>
                  ))}
                </div>
              </div>
              {activationProvider && activationProvider !== "wave" && (
                <div className="space-y-1.5">
                  <Label>Numéro de téléphone</Label>
                  <Input value={activationPhone} onChange={(e) => setActivationPhone(e.target.value)} placeholder="07 XX XX XX XX" />
                </div>
              )}
              <Button onClick={handleActivateShop} disabled={activating || !activationProvider} className="w-full gap-2" size="lg">
                {activating ? <Loader2 className="h-4 w-4 animate-spin" /> : <CreditCard className="h-4 w-4" />}
                Payer 1 300 FCFA
              </Button>
              <p className="text-[10px] text-center text-muted-foreground">Commission de 0,025$ prélevée sur chaque vente</p>
            </div>
          </DialogContent>
        </Dialog>

        {/* Product Dialog */}
        <Dialog open={productDialogOpen} onOpenChange={(open) => { setProductDialogOpen(open); if (!open) { setEditingProduct(null); resetProductForm(); } }}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto p-0">
            <div className="sticky top-0 z-10 bg-card border-b px-6 py-4">
              <DialogTitle className="text-lg font-bold">
                {editingProduct ? "Modifier le produit" : "Créer un produit"}
              </DialogTitle>
            </div>
            <div className="flex flex-col lg:flex-row gap-0">
              {/* Main Form */}
              <div className="flex-1 px-6 pb-6 space-y-6">
                {/* Name & Description */}
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <Label className="text-sm font-medium">Nom <span className="text-destructive">*</span></Label>
                    <Input value={newProduct.name} onChange={(e) => setNewProduct({ ...newProduct, name: e.target.value })} placeholder="Ex: chemise d'été bleue..." className="h-11" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-sm font-medium">Catégorie</Label>
                    <Select value={newProduct.category} onValueChange={(v) => setNewProduct({ ...newProduct, category: v })}>
                      <SelectTrigger className="h-11"><SelectValue placeholder="Sélectionner une catégorie" /></SelectTrigger>
                      <SelectContent>
                        {CATEGORIES.map(cat => <SelectItem key={cat} value={cat}>{cat}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-sm font-medium">Description détaillée</Label>
                    <Textarea value={newProduct.description} onChange={(e) => setNewProduct({ ...newProduct, description: e.target.value })} placeholder="Écrivez quelque chose" rows={6} className="resize-none" />
                  </div>
                </div>

                <div className="border-t" />

                {/* Pricing - YouCan style */}
                <div className="space-y-4">
                  <h3 className="font-semibold flex items-center gap-2">
                    <DollarSign className="h-4 w-4" /> Tarification
                  </h3>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-1.5">
                      <Label className="text-sm">Prix</Label>
                      <Input type="number" value={newProduct.price || ""} onChange={(e) => setNewProduct({ ...newProduct, price: Number(e.target.value) })} placeholder="0" className="h-11" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-sm">Comparer au prix</Label>
                      <Input type="number" value={newProduct.compare_at_price || ""} onChange={(e) => setNewProduct({ ...newProduct, compare_at_price: Number(e.target.value) })} placeholder="0" className="h-11" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-sm">Prix de revient</Label>
                      <Input type="number" disabled placeholder="—" className="h-11" />
                    </div>
                  </div>
                  {newProduct.compare_at_price > 0 && newProduct.price > 0 && newProduct.compare_at_price > newProduct.price && (
                    <p className="text-xs text-green-600">-{Math.round((1 - newProduct.price / newProduct.compare_at_price) * 100)}% de réduction</p>
                  )}
                </div>

                <div className="border-t" />

                {/* Images */}
                {!editingProduct && (
                  <>
                    <div className="space-y-4">
                      <h3 className="font-semibold flex items-center gap-2">
                        <ImageIcon className="h-4 w-4" /> Images
                      </h3>
                      <div className="border-2 border-dashed rounded-xl p-6 text-center hover:border-primary/50 transition-colors">
                        {productImages.length > 0 ? (
                          <div className="space-y-3">
                            <div className="flex flex-wrap gap-3 justify-center">
                              {productImages.map((file, i) => (
                                <div key={i} className="relative group">
                                  <img src={URL.createObjectURL(file)} alt="" className="h-20 w-20 object-cover rounded-lg" />
                                  <button onClick={() => setProductImages(prev => prev.filter((_, idx) => idx !== i))}
                                    className="absolute -top-1.5 -right-1.5 h-5 w-5 bg-destructive text-destructive-foreground rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                    <X className="h-3 w-3" />
                                  </button>
                                </div>
                              ))}
                            </div>
                            <label className="cursor-pointer">
                              <input type="file" accept="image/*" multiple className="hidden" onChange={(e) => { if (e.target.files) setProductImages(prev => [...prev, ...Array.from(e.target.files!)]); }} />
                              <span className="text-sm text-primary hover:underline">+ Ajouter d'autres photos</span>
                            </label>
                          </div>
                        ) : (
                          <label className="cursor-pointer space-y-2 block">
                            <input type="file" accept="image/*" multiple className="hidden" onChange={(e) => { if (e.target.files) setProductImages(Array.from(e.target.files)); }} />
                            <div className="h-12 w-12 mx-auto rounded-xl bg-muted flex items-center justify-center">
                              <Upload className="h-6 w-6 text-muted-foreground" />
                            </div>
                            <p className="text-sm font-medium">Choisissez le fichier à télécharger</p>
                            <p className="text-xs text-muted-foreground">PNG, JPG, WEBP · Taille recommandée 800x800</p>
                          </label>
                        )}
                      </div>
                    </div>
                    <div className="border-t" />
                  </>
                )}

                {/* Settings toggles */}
                <div className="space-y-4">
                  <h3 className="font-semibold flex items-center gap-2">
                    <ToggleLeft className="h-4 w-4" /> Paramètres
                  </h3>
                  <div className="space-y-3">
                    {[
                      { label: "Produit publié", desc: "Visible dans la boutique", key: "is_published" as const },
                      { label: "Produit vedette", desc: "Mis en avant sur la page d'accueil", key: "is_featured" as const },
                      { label: "Produit digital", desc: "Pas de livraison physique requise", key: "is_digital" as const },
                    ].map(item => (
                      <div key={item.key} className="flex items-center justify-between p-3 rounded-xl bg-muted/30">
                        <div><p className="text-sm font-medium">{item.label}</p><p className="text-xs text-muted-foreground">{item.desc}</p></div>
                        <Switch checked={newProduct[item.key] as boolean} onCheckedChange={(v) => setNewProduct({ ...newProduct, [item.key]: v })} />
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Right Sidebar - YouCan style */}
              <div className="w-full lg:w-[220px] border-t lg:border-t-0 lg:border-l bg-muted/20 p-5 space-y-5">
                <div>
                  <h4 className="font-semibold text-sm mb-3">Visibilité</h4>
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={newProduct.is_published} onChange={(e) => setNewProduct({ ...newProduct, is_published: e.target.checked })} className="rounded" />
                    Boutique en ligne
                  </label>
                </div>
                <div>
                  <h4 className="font-semibold text-sm mb-3">Détails de stockage</h4>
                  <div className="space-y-2">
                    <Input value={newProduct.sku} onChange={(e) => setNewProduct({ ...newProduct, sku: e.target.value })} placeholder="SKU" className="h-9 text-sm" />
                    <Input type="number" value={newProduct.weight || ""} onChange={(e) => setNewProduct({ ...newProduct, weight: Number(e.target.value) })} placeholder="Poids" className="h-9 text-sm" />
                  </div>
                </div>
                <div>
                  <h4 className="font-semibold text-sm mb-3">Inventaire</h4>
                  <Input type="number" value={newProduct.stock_quantity} onChange={(e) => setNewProduct({ ...newProduct, stock_quantity: Number(e.target.value) })} className="h-9 text-sm" />
                </div>
              </div>
            </div>

            {/* Submit */}
            <div className="sticky bottom-0 bg-card border-t px-6 py-4">
              <Button onClick={saveProduct} disabled={!newProduct.name || newProduct.price <= 0} className="w-full gap-2" size="lg">
                {editingProduct ? <><Save className="h-4 w-4" /> Enregistrer</> : <><Plus className="h-4 w-4" /> Ajouter le produit</>}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Page Content */}
        <div className="px-4 md:px-8 py-6 md:py-8 mt-[52px] md:mt-0">
          {activeSection === "overview" && (
            <ShopOverview orders={orders} productCount={products.length} totalRevenue={totalRevenue} newOrders={newOrders} onViewAllOrders={() => setActiveSection("orders")} />
          )}

          {activeSection === "products" && (
            <ProductsTable
              products={products}
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              onAddProduct={() => { resetProductForm(); setEditingProduct(null); setProductDialogOpen(true); }}
              onEditProduct={(product) => {
                setEditingProduct(product);
                setNewProduct({
                  name: product.name, description: product.description || "", short_description: product.short_description || "",
                  price: product.price, compare_at_price: product.compare_at_price || 0, category: product.category,
                  stock_quantity: product.stock_quantity, is_digital: product.is_digital, is_published: product.is_published,
                  sku: product.sku || "", weight: product.weight || 0, is_featured: product.is_featured,
                });
                setProductDialogOpen(true);
              }}
              onDeleteProduct={deleteProduct}
              onUploadImage={uploadProductImage}
              primaryColor={primaryColor}
              orders={orders}
            />
          )}

          {activeSection === "orders" && (
            <OrdersList orders={orders} onUpdateStatus={updateOrderStatus} onMarkRead={markOrderRead} />
          )}

          {activeSection === "appearance" && (
            <div className="space-y-6 max-w-2xl">
              <h2 className="text-xl font-bold">Boutique</h2>
              <Card className="p-6 space-y-5">
                <h3 className="font-bold text-lg flex items-center gap-2"><ImageIcon className="h-5 w-5" /> Identité visuelle</h3>
                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-3">
                    <Label>Logo</Label>
                    <div className="flex items-center gap-4">
                      <div className="h-20 w-20 rounded-2xl border-2 border-dashed border-border flex items-center justify-center overflow-hidden bg-muted/30">
                        {shop.logo_url ? <img src={shop.logo_url} alt="" className="h-full w-full object-cover" /> : <Store className="h-8 w-8 text-muted-foreground" />}
                      </div>
                      <label className="cursor-pointer">
                        <input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && uploadShopImage(e.target.files[0], 'logo')} />
                        <Button size="sm" variant="outline" className="gap-1.5" asChild><span><Upload className="h-3 w-3" /> Changer</span></Button>
                      </label>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <Label>Favicon</Label>
                    <div className="flex items-center gap-4">
                      <div className="h-16 w-16 rounded-xl border-2 border-dashed border-border flex items-center justify-center overflow-hidden bg-muted/30">
                        {shop.favicon_url ? <img src={shop.favicon_url} alt="" className="h-full w-full object-contain" /> : <Globe className="h-6 w-6 text-muted-foreground" />}
                      </div>
                      <label className="cursor-pointer">
                        <input type="file" accept="image/png,image/x-icon,image/svg+xml" className="hidden" onChange={(e) => e.target.files?.[0] && uploadShopImage(e.target.files[0], 'favicon')} />
                        <Button size="sm" variant="outline" className="gap-1.5" asChild><span><Upload className="h-3 w-3" /> Changer</span></Button>
                      </label>
                    </div>
                  </div>
                </div>
                <div className="space-y-3">
                  <Label>Bannière</Label>
                  <div className="rounded-xl border-2 border-dashed border-border overflow-hidden bg-muted/30">
                    {shop.banner_url ? <img src={shop.banner_url} alt="" className="w-full h-32 object-cover" /> : <div className="h-32 flex items-center justify-center"><ImageIcon className="h-8 w-8 text-muted-foreground" /></div>}
                  </div>
                  <label className="cursor-pointer">
                    <input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && uploadShopImage(e.target.files[0], 'banner')} />
                    <Button size="sm" variant="outline" className="gap-1.5" asChild><span><Upload className="h-3 w-3" /> Changer la bannière</span></Button>
                  </label>
                </div>
              </Card>

              <Card className="p-6 space-y-5">
                <h3 className="font-bold text-lg flex items-center gap-2"><Palette className="h-5 w-5" /> Couleurs</h3>
                <div className="grid grid-cols-2 gap-6">
                  {[
                    { label: "Couleur principale", key: "primary_color", fallback: "#2563eb" },
                    { label: "Couleur secondaire", key: "secondary_color", fallback: "#7c3aed" },
                  ].map(c => (
                    <div key={c.key} className="space-y-2">
                      <Label>{c.label}</Label>
                      <div className="flex items-center gap-3">
                        <input type="color" value={shop[c.key] || c.fallback} onChange={(e) => setShop({ ...shop, [c.key]: e.target.value })} className="h-12 w-12 rounded-xl cursor-pointer border-2 border-border" />
                        <Input value={shop[c.key] || c.fallback} onChange={(e) => setShop({ ...shop, [c.key]: e.target.value })} className="font-mono" />
                      </div>
                    </div>
                  ))}
                </div>
                <div className="rounded-xl overflow-hidden border">
                  <div className="h-16 flex items-center px-4" style={{ background: `linear-gradient(135deg, ${shop.primary_color || "#2563eb"}, ${shop.secondary_color || "#7c3aed"})` }}>
                    <span className="text-white font-bold">{shop.business_name}</span>
                  </div>
                  <div className="p-4 bg-muted/30 text-sm text-muted-foreground">Aperçu des couleurs</div>
                </div>
              </Card>

              <Card className="p-6 space-y-5">
                <h3 className="font-bold text-lg flex items-center gap-2"><Globe className="h-5 w-5" /> SEO</h3>
                <div className="space-y-3">
                  <div className="space-y-1.5"><Label>Titre SEO</Label><Input value={shop.seo_title || ""} onChange={(e) => setShop({ ...shop, seo_title: e.target.value })} placeholder={shop.business_name} /></div>
                  <div className="space-y-1.5"><Label>Description SEO</Label><Textarea value={shop.seo_description || ""} onChange={(e) => setShop({ ...shop, seo_description: e.target.value })} placeholder="Description pour les moteurs de recherche" rows={3} /></div>
                </div>
              </Card>

              <Card className="p-6 space-y-5">
                <h3 className="font-bold text-lg flex items-center gap-2"><MessageSquare className="h-5 w-5" /> Chatbot IA</h3>
                <div className="flex items-center justify-between">
                  <div><p className="font-medium">Assistant intelligent</p><p className="text-sm text-muted-foreground">Un chatbot IA aide vos visiteurs en temps réel</p></div>
                  <Switch checked={shop.chatbot_enabled} onCheckedChange={(v) => setShop({ ...shop, chatbot_enabled: v })} />
                </div>
                {shop.chatbot_enabled && (
                  <div className="space-y-1.5"><Label>Message d'accueil</Label><Input value={shop.chatbot_welcome_message || ""} onChange={(e) => setShop({ ...shop, chatbot_welcome_message: e.target.value })} /></div>
                )}
              </Card>
            </div>
          )}

          {activeSection === "settings" && (
            <ShopSettings shop={shop} setShop={setShop} onDeleteShop={() => navigate("/shop-manager")} />
          )}
        </div>
      </main>
    </div>
  );
};

export default ShopEditor;
