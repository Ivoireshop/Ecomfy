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
import { ProductEditor } from "@/components/shop/ProductEditor";
import { ShopStatistics } from "@/components/shop/ShopStatistics";
import { ShopThemeSettings } from "@/components/shop/ShopThemeSettings";
import { BillingBanner } from "@/components/shop/BillingBanner";
import { BillingHistory } from "@/components/shop/BillingHistory";
import { ReviewsModeration } from "@/components/shop/ReviewsModeration";
import { useOrderNotifications } from "@/hooks/useOrderNotifications";
import { useFCM } from "@/hooks/useFCM";
import { useNativePush } from "@/hooks/useNativePush";
import { EnableNotificationsBanner } from "@/components/shop/EnableNotificationsBanner";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { closePaymentWindow, openPaymentWindow, redirectToPaymentUrl } from "@/lib/paymentRedirect";

interface Product {
  id: string;
  slug?: string | null;
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

const toSlug = (value: string) =>
  (value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);

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
  const [showProductEditor, setShowProductEditor] = useState(false);
  const [activeSection, setActiveSection] = useState<ActiveSection>("overview");
  const [searchQuery, setSearchQuery] = useState("");
  const [activating, setActivating] = useState(false);
  const [showActivationModal, setShowActivationModal] = useState(false);
  const [activationPhone, setActivationPhone] = useState("");
  const [activationProvider, setActivationProvider] = useState("");
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [newProduct, setNewProduct] = useState({
    name: "", description: "", short_description: "", price: 0, compare_at_price: 0,
    category: "Autre", stock_quantity: 10, is_digital: false, is_published: true,
    sku: "", weight: 0, is_featured: false,
  });
  const [productImages, setProductImages] = useState<File[]>([]);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [unreadOrders, setUnreadOrders] = useState(0);
  const [visits, setVisits] = useState<{ visited_at: string; product_id?: string | null; session_id?: string | null }[]>([]);

  const fetchData = useCallback(async () => {
    if (!id) return;
    const [shopRes, productsRes, ordersRes, visitsRes] = await Promise.all([
      supabase.from("shops").select("*").eq("id", id).single() as any,
      supabase.from("products").select("*, product_images(*)").eq("shop_id", id).order("display_order") as any,
      supabase.from("orders").select("*, order_items(*)").eq("shop_id", id).order("created_at", { ascending: false }) as any,
      supabase.from("shop_visits" as any).select("visited_at, product_id, session_id").eq("shop_id", id).order("visited_at", { ascending: false }).limit(5000) as any,
    ]);
    if (shopRes.data) setShop(shopRes.data);
    if (productsRes.data) setProducts(productsRes.data);
    if (ordersRes.data) {
      setOrders(ordersRes.data);
      setUnreadOrders(ordersRes.data.filter((o: Order) => !o.is_read).length);
    }
    if (visitsRes?.data) setVisits(visitsRes.data as any);
    setLoading(false);
  }, [id]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Native browser/PWA notifications + sound for new orders
  useOrderNotifications(id);

  // Auto-register FCM push token (so notifications arrive even when PWA is closed)
  useFCM(id);
  // Native iOS/Android push registration (rings even when app is closed/locked)
  useNativePush(id);

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

  // Refresh orders when the tab becomes visible or window regains focus
  useEffect(() => {
    if (!id) return;
    const refresh = () => { fetchData(); };
    const onVis = () => { if (document.visibilityState === "visible") refresh(); };
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("focus", refresh);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("focus", refresh);
    };
  }, [id, fetchData]);

  const isActivated = !!shop?.is_activated;

  const handleActivateShop = async () => {
    if (!activationProvider) { toast({ title: "Choisissez un opérateur", variant: "destructive" }); return; }
    if (activationProvider !== "wave" && !activationPhone) { toast({ title: "Entrez votre numéro", variant: "destructive" }); return; }
    setActivating(true);
    const paymentWindow = openPaymentWindow();
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Non connecté");
      const { data, error } = await supabase.functions.invoke("process-payment", {
        body: { amount: 1300, payment_method: "mobile_money", user_id: session.user.id, provider: activationProvider, phone: activationPhone, payment_type: "shop_activation", shop_id: shop.id },
      });
      if (error) throw error;
      const paymentUrl = data?.payment_url || data?.url || data?.checkout_url || data?.link;
      if (paymentUrl && typeof paymentUrl === "string") { redirectToPaymentUrl(paymentUrl, paymentWindow); return; }
      throw new Error("Impossible d'ouvrir la page de paiement");
    } catch (err) {
      closePaymentWindow(paymentWindow);
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

    // Sanitize and validate the slug (public link). The user can edit it
    // freely in Settings → Général → Lien public, so we make sure it is
    // URL-safe and unique before saving. If they leave it empty, fall
    // back to a slug derived from the business name.
    const sanitize = (v: string) =>
      (v || "")
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 50);
    let nextSlug = sanitize(shop.slug || shop.business_name || "");
    if (!nextSlug) nextSlug = "boutique";
    if (nextSlug !== shop.slug) {
      const { data: clash } = await supabase
        .from("shops")
        .select("id")
        .eq("slug", nextSlug)
        .neq("id", shop.id) as any;
      if (clash && clash.length > 0) {
        nextSlug = `${nextSlug}-${Math.random().toString(36).substring(2, 6)}`;
      }
    }

    const { error } = await supabase.from("shops").update({
      slug: nextSlug,
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
      theme_config: shop.theme_config,
      tracking_enabled: shop.tracking_enabled,
      social_proof_enabled: shop.social_proof_enabled,
      delivery_advisor_phone: shop.delivery_advisor_phone,
      order_confirmation_message: shop.order_confirmation_message,
      facebook_access_token: shop.facebook_access_token,
      facebook_test_event_code: shop.facebook_test_event_code,
      tiktok_access_token: shop.tiktok_access_token,
      snapchat_access_token: shop.snapchat_access_token,
      ga4_measurement_id: shop.ga4_measurement_id,
      ga4_api_secret: shop.ga4_api_secret,
      google_ads_conversion_id: shop.google_ads_conversion_id,
      google_ads_conversion_label: shop.google_ads_conversion_label,
    }).eq("id", shop.id) as any;
    if (error) toast({ title: "Erreur", description: error.message, variant: "destructive" });
    else {
      if (nextSlug !== shop.slug) setShop({ ...shop, slug: nextSlug });
      toast({ title: "✓ Sauvegardé" });
    }
    setSaving(false);
  };

  const resetProductForm = () => {
    setNewProduct({ name: "", description: "", short_description: "", price: 0, compare_at_price: 0, category: "Autre", stock_quantity: 10, is_digital: false, is_published: true, sku: "", weight: 0, is_featured: false });
    setProductImages([]);
  };

  const getUniqueProductSlug = async (value: string, excludeProductId?: string) => {
    if (!id) return toSlug(value) || "produit";
    const base = toSlug(value) || "produit";
    let candidate = base;
    let suffix = 2;

    while (true) {
      let query = supabase.from("products").select("id").eq("shop_id", id).eq("slug", candidate).limit(1) as any;
      if (excludeProductId) query = query.neq("id", excludeProductId);
      const { data } = await query;
      if (!data || data.length === 0) return candidate;
      candidate = `${base}-${suffix++}`;
    }
  };

  const saveProduct = async () => {
    if (!id) return;
    const productSlug = await getUniqueProductSlug((newProduct as any).slug || newProduct.name, editingProduct?.id);
    const productData = {
      name: newProduct.name, description: newProduct.description, short_description: newProduct.short_description,
      price: newProduct.price, compare_at_price: newProduct.compare_at_price || null, category: newProduct.category,
      stock_quantity: newProduct.stock_quantity, is_digital: newProduct.is_digital, is_published: newProduct.is_published,
      is_featured: newProduct.is_featured, sku: newProduct.sku || null, weight: newProduct.weight || null, shop_id: id,
      slug: productSlug,
    };
    let result;
    if (editingProduct) {
      result = await supabase.from("products").update(productData).eq("id", editingProduct.id) as any;
    } else {
      result = await supabase.from("products").insert(productData).select("id") as any;
    }
    if (result.error) {
      toast({ title: "Erreur", description: result.error.message, variant: "destructive" });
    } else {
      if (!editingProduct && productImages.length > 0 && result.data?.[0]?.id) {
        for (const file of productImages) await uploadProductImage(result.data[0].id, file);
      }
      toast({ title: editingProduct ? "Produit modifié ✓" : "Produit ajouté ✓" });
      setProductDialogOpen(false);
      setShowProductEditor(false);
      setEditingProduct(null);
      resetProductForm();
      fetchData();
    }
  };

  const handleProductEditorSave = async (data: any, newImgs: File[]) => {
    if (!id) return;
    setSaving(true);
    const productSlug = await getUniqueProductSlug(data.slug || data.name, editingProduct?.id);
    const productData = {
      name: data.name, description: data.description, short_description: data.short_description,
      price: data.price, compare_at_price: data.compare_at_price || null, category: data.category,
      stock_quantity: data.stock_quantity, is_digital: data.is_digital, is_published: data.is_published,
      is_featured: data.is_featured, sku: data.sku || null, weight: data.weight || null, shop_id: id,
      slug: productSlug,
      bundle_offers: Array.isArray(data.bundle_offers)
        ? data.bundle_offers.filter((o: any) => Number(o?.quantity) > 0 && Number(o?.price) > 0)
        : [],
      bundle_position: data.bundle_position || "after_countdown",
      variants: Array.isArray(data.variants)
        ? data.variants.filter((g: any) => g?.name?.trim() && Array.isArray(g?.options) && g.options.length > 0)
        : [],
    };
    let result;
    if (editingProduct) {
      result = await supabase.from("products").update(productData).eq("id", editingProduct.id) as any;
    } else {
      result = await supabase.from("products").insert(productData).select("id") as any;
    }
    if (result.error) {
      toast({ title: "Erreur", description: result.error.message, variant: "destructive" });
    } else {
      const prodId = editingProduct?.id || result.data?.[0]?.id;
      if (prodId && newImgs.length > 0) {
        for (const file of newImgs) await uploadProductImage(prodId, file);
      }
      toast({ title: editingProduct ? "Produit modifié ✓" : "Produit ajouté ✓" });
      setShowProductEditor(false);
      setEditingProduct(null);
      resetProductForm();
      fetchData();
    }
    setSaving(false);
  };

  const deleteProductImage = async (imageId: string) => {
    await supabase.from("product_images").delete().eq("id", imageId) as any;
    fetchData();
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
      <main className="flex-1 min-w-0 mt-[52px] md:mt-0">
        {/* Billing balance banner */}
        <BillingBanner
          balanceDue={Number(shop.commission_balance_due) || 0}
          threshold={Number(shop.commission_threshold) || 12000}
          paymentDeadline={shop.payment_deadline}
          isSuspended={!!shop.is_suspended}
          shopId={shop.id}
        />
        <div className="px-4 md:px-6 pt-4">
          <EnableNotificationsBanner />
        </div>
        {/* Activation Banner */}
        {!isActivated && (
          <div className="bg-gradient-to-r from-orange-500 to-amber-500 text-white px-4 md:px-6 py-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Zap className="h-5 w-5" />
                <div>
                  <p className="font-semibold text-sm">Activez vos boutiques pour les rendre visibles</p>
                  <p className="text-xs opacity-90">Paiement unique de 2$ · Activation valable pour cette boutique</p>
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
                <p className="text-xs text-muted-foreground">≈ 2$ USD · Paiement unique · Cette boutique sera activée</p>
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

        {/* Full-page Product Editor */}
        {showProductEditor && (
          <div className="fixed inset-0 z-50 bg-background overflow-y-auto">
            <ProductEditor
              initialData={editingProduct ? {
                name: editingProduct.name, description: editingProduct.description || "",
                short_description: editingProduct.short_description || "",
                price: editingProduct.price, compare_at_price: editingProduct.compare_at_price || 0,
                category: editingProduct.category, stock_quantity: editingProduct.stock_quantity,
                is_digital: editingProduct.is_digital, is_published: editingProduct.is_published,
                is_featured: editingProduct.is_featured, sku: editingProduct.sku || "", weight: editingProduct.weight || 0,
                slug: (editingProduct as any).slug || "",
                bundle_offers: (editingProduct as any).bundle_offers || [],
                bundle_position: (editingProduct as any).bundle_position || "after_countdown",
                variants: (editingProduct as any).variants || [],
              } : undefined}
              existingImages={editingProduct?.product_images || []}
              isEditing={!!editingProduct}
              onSave={handleProductEditorSave}
              onCancel={() => { setShowProductEditor(false); setEditingProduct(null); }}
              onUploadImage={editingProduct ? (file) => uploadProductImage(editingProduct.id, file) : undefined}
              onDeleteImage={deleteProductImage}
              saving={saving}
              shopSlug={shop.slug}
              shopActivated={!!isActivated}
              shopPublished={shop.is_published}
              productId={editingProduct?.id}
            />
          </div>
        )}

        {/* Page Content */}
        <div className="px-4 md:px-8 py-6 md:py-8">
          {activeSection === "overview" && (
            <ShopOverview orders={orders} productCount={products.length} totalRevenue={totalRevenue} newOrders={newOrders} onViewAllOrders={() => setActiveSection("orders")} />
          )}

          {activeSection === "statistics" && (
            <ShopStatistics orders={orders} products={products} primaryColor={primaryColor} visits={visits} />
          )}

          {activeSection === "theme" && (
            <ShopThemeSettings shop={shop} setShop={setShop} />
          )}

          {activeSection === "products" && (
            <ProductsTable
              products={products}
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              onAddProduct={() => { resetProductForm(); setEditingProduct(null); setShowProductEditor(true); }}
              onEditProduct={(product) => {
                setEditingProduct(product);
                setShowProductEditor(true);
              }}
              onDeleteProduct={deleteProduct}
              onUploadImage={uploadProductImage}
              onPreviewProduct={
                shop?.is_activated && shop?.is_published
                  ? (product) => window.open(
                      (product as any).slug
                        ? `/shop/${shop.slug}/p/${(product as any).slug}`
                        : `/shop/${shop.slug}/product?product=${product.id}`,
                      "_blank"
                    )
                  : undefined
              }
              primaryColor={primaryColor}
              orders={orders}
              shopSlug={shop.slug}
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

          {activeSection === "billing" && (
            <BillingHistory shopId={shop.id} shop={shop} orderCount={orders.length} />
          )}

          {activeSection === "reviews" && (
            <ReviewsModeration shopId={shop.id} />
          )}
        </div>
      </main>
    </div>
  );
};

export default ShopEditor;
