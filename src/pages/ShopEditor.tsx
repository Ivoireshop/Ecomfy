import { useEffect, useState, useCallback, useRef, lazy, Suspense } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { z } from "zod";
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
import { LockedOrdersScreen } from "@/components/shop/LockedOrdersScreen";
import { ShopSettings } from "@/components/shop/ShopSettings";
import { BillingBanner } from "@/components/shop/BillingBanner";
import { triggerSeoAutoIndex } from "@/lib/seoAutoIndex";
import { ShopPaymentCountdown } from "@/components/shop/ShopPaymentCountdown";
import { ShopPaymentGate } from "@/components/shop/ShopPaymentGate";
import { computeShopPaymentInfo } from "@/lib/shopPaymentStatus";
import { saveProductVideos, fetchProductVideos } from "@/lib/productAppearance";

// Lazy-load heavy section panels (only one section is visible at a time).
// Keeps the editor's initial JS small without changing UI or behavior.
const AbandonedCartsList = lazy(() => import("@/components/shop/AbandonedCartsList").then(m => ({ default: m.AbandonedCartsList })));
const ProductEditor = lazy(() => import("@/components/shop/ProductEditor").then(m => ({ default: m.ProductEditor })));
const ShopAssistantSettings = lazy(() => import("@/components/shop/ShopAssistantSettings").then(m => ({ default: m.ShopAssistantSettings })));
const ShopStatistics = lazy(() => import("@/components/shop/ShopStatistics").then(m => ({ default: m.ShopStatistics })));
const ShopThemeSettings = lazy(() => import("@/components/shop/ShopThemeSettings").then(m => ({ default: m.ShopThemeSettings })));
const ShopThemesManager = lazy(() => import("@/components/shop/ShopThemesManager"));
const BillingHistory = lazy(() => import("@/components/shop/BillingHistory").then(m => ({ default: m.BillingHistory })));
const ReviewsModeration = lazy(() => import("@/components/shop/ReviewsModeration").then(m => ({ default: m.ReviewsModeration })));
const ShopFinances = lazy(() => import("@/components/shop/ShopFinances").then(m => ({ default: m.ShopFinances })));
const ProductAIOptimizer = lazy(() => import("@/components/shop/ProductAIOptimizer").then(m => ({ default: m.ProductAIOptimizer })));
const ShopCollaboratorsManager = lazy(() => import("@/components/shop/ShopCollaboratorsManager").then(m => ({ default: m.ShopCollaboratorsManager })));
const DragDropEditor = lazy(() => import("@/components/shop/DragDropEditor/DragDropEditor").then(m => ({ default: m.DragDropEditor })));

const SectionFallback = () => (
  <div className="flex items-center justify-center py-12">
    <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
  </div>
);
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { closePaymentWindow, openPaymentWindow, redirectToPaymentUrl } from "@/lib/paymentRedirect";
import { prepareImageForUpload, formatSize } from "@/lib/imageCompress";
import { cacheInvalidate } from "@/lib/shopCache";

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

type ProductImageRow = { id: string; image_url: string; is_primary: boolean; display_order: number };

const sortProductImages = (images?: ProductImageRow[] | null) =>
  [...(images || [])].sort((a, b) => {
    if (!!a.is_primary !== !!b.is_primary) return a.is_primary ? -1 : 1;
    return (a.display_order ?? 0) - (b.display_order ?? 0);
  });

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

const productValidationSchema = z.object({
  name: z.string().min(1, "Le nom du produit est requis").max(200, "Le nom est trop long"),
  price: z.number({ invalid_type_error: "Le prix doit être un nombre" }).min(0, "Le prix ne peut pas être négatif"),
  compare_at_price: z.number().min(0, "Le prix barré ne peut pas être négatif").nullable().optional(),
  stock_quantity: z.number().min(0, "Le stock ne peut pas être négatif").int("Le stock doit être un entier"),
  category: z.string().min(1, "La catégorie est requise"),
  weight: z.number().min(0, "Le poids ne peut pas être négatif").nullable().optional(),
});

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
  const [showVisualEditor, setShowVisualEditor] = useState(false);
  const [newProduct, setNewProduct] = useState({
    name: "", description: "", short_description: "", price: 0, compare_at_price: 0,
    category: "Autre", stock_quantity: 10, is_digital: false, is_published: true,
    sku: "", weight: 0, is_featured: false,
  });
  const [productImages, setProductImages] = useState<File[]>([]);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [unreadOrders, setUnreadOrders] = useState(0);
  const [visits, setVisits] = useState<{ visited_at: string; product_id?: string | null; session_id?: string | null }[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [collabRoles, setCollabRoles] = useState<string[] | null>(null);
  const lastPassiveRefreshRef = useRef(0);

  const fetchData = useCallback(async () => {
    if (!id) return;
    const visitsStartDate = new Date();
    visitsStartDate.setDate(visitsStartDate.getDate() - 30);
    const [shopRes, secretsRes, productsRes, ordersRes, visitsRes] = await Promise.all([
      supabase.from("shops").select("*").eq("id", id).single() as any,
      (supabase as any).from("shop_secrets").select("*").eq("shop_id", id).maybeSingle(),
      supabase.from("products").select("*, product_images(*)").eq("shop_id", id).order("display_order") as any,
      supabase.from("orders").select("*, order_items(*)").eq("shop_id", id).order("created_at", { ascending: false }).limit(5000) as any,
      supabase.from("shop_visits" as any).select("visited_at, product_id, session_id, visitor_country, referrer, device_type").eq("shop_id", id).gte("visited_at", visitsStartDate.toISOString()).order("visited_at", { ascending: false }).limit(5000) as any,
    ]);
    if (ordersRes.error) {
      console.error("FAILED TO FETCH ORDERS:", ordersRes.error);
    }
    if (shopRes.data) {
      const secrets = (secretsRes as any)?.data || {};
      setShop({
        ...shopRes.data,
        facebook_access_token: secrets.facebook_access_token ?? null,
        tiktok_access_token: secrets.tiktok_access_token ?? null,
        snapchat_access_token: secrets.snapchat_access_token ?? null,
        ga4_api_secret: secrets.ga4_api_secret ?? null,
        google_ads_conversion_id: secrets.google_ads_conversion_id ?? null,
        google_ads_conversion_label: secrets.google_ads_conversion_label ?? null,
        weekly_finance_email: secrets.weekly_finance_email ?? null,
        weekly_finance_email_enabled: secrets.weekly_finance_email_enabled ?? false,
      });
    }
    if (productsRes.data) {
      setProducts((productsRes.data as Product[]).map(product => ({
        ...product,
        product_images: sortProductImages(product.product_images),
      })));
    }
    if (ordersRes.data) {
      let finalOrders = ordersRes.data;
      if (finalOrders.length > 0) {
        try {
          const orderIds = finalOrders.map((o: any) => o.id);
          const deliveriesRes = await supabase
            .from("order_deliveries")
            .select("*, driver:delivery_company_members(*), provider:delivery_providers(*)")
            .in("order_id", orderIds);
          
          if (deliveriesRes.data) {
            finalOrders = finalOrders.map((o: any) => ({
              ...o,
              order_deliveries: deliveriesRes.data.filter((d: any) => d.order_id === o.id)
            }));
          }
        } catch (e) {
          console.error("Failed to fetch order deliveries", e);
        }
      }
      setOrders(finalOrders);
      setUnreadOrders(finalOrders.filter((o: Order) => !o.is_read).length);
    }
    if (visitsRes?.data) setVisits(visitsRes.data as any);
    setLoading(false);
  }, [id]);

  useEffect(() => { fetchData(); }, [fetchData]);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || !id) return;
      setCurrentUserId(user.id);
      const { data: collab } = await (supabase.from("shop_collaborators" as any) as any)
        .select("roles, status").eq("shop_id", id).eq("user_id", user.id).eq("status", "active").maybeSingle();
      if (collab?.roles) setCollabRoles(collab.roles as string[]);
    })();
  }, [id]);

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
    // Realtime shop status — auto-unlock after payment confirmation
    const shopChannel = supabase.channel(`shop-status-${id}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "shops", filter: `id=eq.${id}` }, (payload) => {
        const next: any = payload.new;
        setShop((prev: any) => {
          const wasLocked = prev && (prev.is_suspended || ["locked","final_suspension","payment_pending"].includes(prev.shop_payment_status));
          const nowActive = next && next.shop_payment_status === "active" && !next.is_suspended;
          if (wasLocked && nowActive) {
            toast({ title: "✅ Boutique déverrouillée", description: "Paiement confirmé. Accès complet aux commandes restauré." });
          }
          return { ...prev, ...next };
        });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); supabase.removeChannel(shopChannel); };
  }, [id]);

  // Refresh orders when the tab becomes visible or window regains focus
  useEffect(() => {
    if (!id) return;
    const refresh = () => {
      const now = Date.now();
      if (now - lastPassiveRefreshRef.current < 30000) return;
      lastPassiveRefreshRef.current = now;
      fetchData();
    };
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
    if (!shop) return;

    let sessionUserId = "";

    // Guard: re-check current activation status before charging anything
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Non connecté");
      sessionUserId = session.user.id;

      const { data: fresh } = await supabase
        .from('shops')
        .select('is_activated, activation_fee_paid')
        .eq('id', shop.id)
        .maybeSingle();

      if (fresh?.is_activated) {
        await fetchData();
        setShowActivationModal(false);
        toast({ title: "Boutique déjà activée", description: "Aucun nouveau paiement n'est nécessaire." });
        return;
      }
    } catch (err) {
      toast({ title: "Erreur", description: err instanceof Error ? err.message : "Vérification impossible", variant: "destructive" });
      return;
    }

    if (!activationProvider) { toast({ title: "Choisissez un opérateur", variant: "destructive" }); return; }
    if (activationProvider !== "wave" && !activationPhone) { toast({ title: "Entrez votre numéro", variant: "destructive" }); return; }
    setActivating(true);
    const paymentWindow = openPaymentWindow();
    try {
      const { data, error } = await supabase.functions.invoke("process-payment", {
        body: { amount: 1300, payment_method: "mobile_money", user_id: sessionUserId, provider: activationProvider, phone: activationPhone, payment_type: "shop_activation", shop_id: shop.id },
      });
      if (error) throw error;
      if (data?.already_activated) {
        closePaymentWindow(paymentWindow);
        await fetchData();
        setShowActivationModal(false);
        toast({ title: "Boutique déjà activée", description: "Vous pouvez continuer vos paramètres et publier votre boutique." });
        return;
      }
      if (data?.success === false) throw new Error(data?.error || "Erreur de paiement");
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
      const prepared = await prepareImageForUpload(file);
      if (!prepared.ok) {
        toast({ title: "Image non ajoutée", description: prepared.reason, variant: "destructive" });
        return;
      }
      if (prepared.wasCompressed) {
        toast({
          title: "Image compressée automatiquement",
          description: `${formatSize(prepared.originalSize)} → ${formatSize(prepared.finalSize)} (sous 2 Mo)`,
        });
      }
      file = prepared.file;
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Connectez-vous pour ajouter une image.");

      const ext = (file.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg';
      const randomId = typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const path = `${user.id}/shop/${shop.id}/${type}-${Date.now()}-${randomId}.${ext}`;
      const { error: uploadError } = await supabase.storage.from('shop-images').upload(path, file);
      if (uploadError) throw uploadError;
      const { data: urlData } = supabase.storage.from('shop-images').getPublicUrl(path);
      const field = type === 'logo' ? 'logo_url' : type === 'banner' ? 'banner_url' : 'favicon_url';
      await supabase.from('shops').update({ [field]: urlData.publicUrl } as any).eq('id', shop.id);
      setShop({ ...shop, [field]: urlData.publicUrl });
      toast({ title: `✓ ${type === 'logo' ? 'Logo' : type === 'banner' ? 'Bannière' : 'Favicon'} mis à jour` });
    } catch (error: any) { toast({ title: "Erreur d'upload", description: error?.message || "L'image n'a pas pu être sauvegardée.", variant: "destructive" }); }
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
      facebook_test_event_code: shop.facebook_test_event_code,
      ga4_measurement_id: shop.ga4_measurement_id,
      notification_settings: shop.notification_settings ?? {},
    }).eq("id", shop.id) as any;

    // Upsert sensitive credentials into the private shop_secrets table.
    const { error: secretsError } = await (supabase as any)
      .from("shop_secrets")
      .upsert({
        shop_id: shop.id,
        facebook_access_token: shop.facebook_access_token ?? null,
        tiktok_access_token: shop.tiktok_access_token ?? null,
        snapchat_access_token: shop.snapchat_access_token ?? null,
        ga4_api_secret: shop.ga4_api_secret ?? null,
        google_ads_conversion_id: shop.google_ads_conversion_id ?? null,
        google_ads_conversion_label: shop.google_ads_conversion_label ?? null,
      }, { onConflict: "shop_id" });

    if (error || secretsError) toast({ title: "Erreur", description: (error || secretsError)?.message, variant: "destructive" });
    else {
      if (nextSlug !== shop.slug) setShop({ ...shop, slug: nextSlug });
      toast({ title: "✓ Sauvegardé" });
      if (shop.is_published && shop.is_activated) {
        triggerSeoAutoIndex(`https://ecomfy.cloud/shop/${nextSlug}`);
      }
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
    try {
      productValidationSchema.parse({
        name: newProduct.name,
        price: Number(newProduct.price),
        compare_at_price: newProduct.compare_at_price ? Number(newProduct.compare_at_price) : null,
        stock_quantity: Number(newProduct.stock_quantity),
        category: newProduct.category,
        weight: newProduct.weight ? Number(newProduct.weight) : null,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        toast({ title: "Erreur", description: error.errors[0].message, variant: "destructive" });
        return;
      }
    }
    const productSlug = editingProduct?.slug || await getUniqueProductSlug((newProduct as any).slug || newProduct.name, editingProduct?.id);
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
      if (newProduct.is_published && shop?.slug) {
        triggerSeoAutoIndex(`https://ecomfy.cloud/shop/${shop.slug}/p/${productSlug}`);
      }
    }
  };

  const handleProductEditorSave = async (data: any, newImgs: File[]): Promise<boolean> => {
    if (!id) return false;
    
    try {
      productValidationSchema.parse({
        name: data.name,
        price: Number(data.price),
        compare_at_price: data.compare_at_price ? Number(data.compare_at_price) : null,
        stock_quantity: Number(data.stock_quantity),
        category: data.category,
        weight: data.weight ? Number(data.weight) : null,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        toast({ title: "Erreur de validation", description: error.errors[0].message, variant: "destructive" });
        return false;
      }
    }
    
    setSaving(true);
    try {
      const productSlug = editingProduct?.slug || await getUniqueProductSlug(data.slug || data.name, editingProduct?.id);
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
        section_order: data.section_order ?? null,
      };
      let prodId = editingProduct?.id;

      if (editingProduct) {
        const { error } = await supabase.from("products").update(productData).eq("id", editingProduct.id) as any;
        if (error) throw error;
      } else {
        const { data: createdProduct, error } = await supabase
          .from("products")
          .insert(productData)
          .select("*, product_images(*)")
          .single() as any;
        if (error) throw error;
        prodId = createdProduct?.id;
        if (createdProduct) setEditingProduct({ ...createdProduct, product_images: [], videos: data.videos || [] });
      }

      if (prodId && Array.isArray(data.videos)) {
        await saveProductVideos(prodId, id, data.videos);
        if (editingProduct) {
          setEditingProduct((prev) => prev ? { ...prev, ...productData, videos: data.videos } : null);
        }
      }

      if (prodId && newImgs.length > 0) {
        const existingCount = editingProduct?.product_images?.length || 0;
        const failed: string[] = [];
        for (let i = 0; i < newImgs.length; i++) {
          const file = newImgs[i];
          const uploaded = await uploadProductImage(prodId, file, false, {
            displayOrder: existingCount + i,
            isPrimary: existingCount === 0 && i === 0,
          });
          if (!uploaded) {
            failed.push(file.name);
          }
        }
        if (failed.length > 0) {
          // Keep editor open so the user can retry just the failed images
          // (text + product row are already saved, no data loss).
          toast({
            title: "Texte enregistré — image(s) à renvoyer",
            description: `${failed.length} image(s) n'ont pas pu être envoyées. Réessayez l'ajout, votre fiche est sauvegardée.`,
            variant: "destructive",
          });
          await fetchData();
          setSaving(false);
          return false;
        }
      }
      toast({
        title: editingProduct ? "Produit modifié ✓" : "Produit ajouté ✓",
        description: newImgs.length > 0
          ? "La fiche et ses images sont sauvegardées. Vous pourrez les retrouver après actualisation ou reconnexion."
          : "La fiche produit est sauvegardée.",
      });
      setShowProductEditor(false);
      setEditingProduct(null);
      resetProductForm();
      await fetchData();
      // Invalidate public-facing caches so the new product + images appear
      // immediately for visitors arriving from ads/links.
      if (shop?.slug) {
        cacheInvalidate(`shop:slug:${shop.slug}`);
        cacheInvalidate(`shop-products:${id}`);
        cacheInvalidate(`product:${id}:`);
      }
      if (data.is_published && shop?.slug) {
        triggerSeoAutoIndex(`https://ecomfy.cloud/shop/${shop.slug}/p/${productSlug}`);
      }
      return true;
    } catch (error: any) {
      toast({ title: "Produit non sauvegardé", description: error?.message || "Vérifiez votre connexion puis réessayez.", variant: "destructive" });
      return false;
    } finally {
      setSaving(false);
    }
  };

  // Silent auto-save: updates the product fields in DB without closing the editor and without re-uploading images.
  const handleProductAutoSave = async (data: any): Promise<boolean> => {
    if (!id || !editingProduct?.id) return false;
    const productData = {
      name: data.name, description: data.description, short_description: data.short_description,
      price: data.price, compare_at_price: data.compare_at_price || null, category: data.category,
      stock_quantity: data.stock_quantity, is_digital: data.is_digital, is_published: data.is_published,
      is_featured: data.is_featured, sku: data.sku || null, weight: data.weight || null,
      bundle_offers: Array.isArray(data.bundle_offers)
        ? data.bundle_offers.filter((o: any) => Number(o?.quantity) > 0 && Number(o?.price) > 0)
        : [],
      bundle_position: data.bundle_position || "after_countdown",
      variants: Array.isArray(data.variants)
        ? data.variants.filter((g: any) => g?.name?.trim() && Array.isArray(g?.options) && g.options.length > 0)
        : [],
      section_order: data.section_order ?? null,
    };
    const { error } = await supabase
      .from("products")
      .update(productData)
      .eq("id", editingProduct.id) as any;
    if (error) return false;
    return true;
  };

  const deleteProductImage = async (imageId: string) => {
    const productId = editingProduct?.id;
    const imageToDelete = editingProduct?.product_images?.find(img => img.id === imageId);
    
    if (imageToDelete?.image_url) {
      try {
        const path = imageToDelete.image_url.split('/shop-images/').pop();
        if (path) await supabase.storage.from("shop-images").remove([path]);
      } catch (e) {
        console.error("Failed to delete image from storage", e);
      }
    }

    const { error } = await supabase.from("product_images").delete().eq("id", imageId) as any;
    if (error) {
      toast({ title: "Image non supprimée", description: error.message, variant: "destructive" });
      return;
    }

    if (productId && imageToDelete?.is_primary) {
      const nextImage = (editingProduct?.product_images || [])
        .filter(img => img.id !== imageId)
        .sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0))[0];
      if (nextImage) {
        await supabase.from("product_images").update({ is_primary: true }).eq("id", nextImage.id) as any;
      }
    }

    setEditingProduct(prev => prev
      ? {
          ...prev,
          product_images: sortProductImages((prev.product_images || [])
            .filter(img => img.id !== imageId)
            .map((img, idx) => imageToDelete?.is_primary && idx === 0 ? { ...img, is_primary: true } : img)),
        }
      : prev
    );
    setProducts(prev => prev.map(product => ({
      ...product,
      product_images: sortProductImages((product.product_images || [])
        .filter(img => img.id !== imageId)
        .map((img, idx) => product.id === productId && imageToDelete?.is_primary && idx === 0 ? { ...img, is_primary: true } : img)),
    })));
    fetchData();
  };

  const setPrimaryProductImage = async (imageId: string) => {
    if (!editingProduct?.id) return;
    const productId = editingProduct.id;
    const { error: resetError } = await supabase
      .from("product_images")
      .update({ is_primary: false })
      .eq("product_id", productId) as any;
    if (resetError) {
      toast({ title: "Image principale non modifiée", description: resetError.message, variant: "destructive" });
      return;
    }
    const { error } = await supabase
      .from("product_images")
      .update({ is_primary: true, display_order: 0 })
      .eq("id", imageId) as any;
    if (error) {
      toast({ title: "Image principale non modifiée", description: error.message, variant: "destructive" });
      return;
    }
    setEditingProduct(prev => prev?.id === productId
      ? { ...prev, product_images: sortProductImages((prev.product_images || []).map(img => ({ ...img, is_primary: img.id === imageId, display_order: img.id === imageId ? 0 : img.display_order }))) }
      : prev
    );
    setProducts(prev => prev.map(product => product.id === productId
      ? { ...product, product_images: sortProductImages((product.product_images || []).map(img => ({ ...img, is_primary: img.id === imageId, display_order: img.id === imageId ? 0 : img.display_order }))) }
      : product
    ));
    toast({ title: "Image principale mise à jour" });
    fetchData();
  };

  const deleteProduct = async (productId: string) => {
    if (!confirm("Voulez-vous vraiment supprimer ce produit ? Cette action est irréversible.")) return;

    // Optimistic removal from UI state
    const previousProducts = [...products];
    setProducts(prev => prev.filter(p => p.id !== productId));
    
    try {
      // 1. Purge product images from storage bucket
      const productToDelete = previousProducts.find(p => p.id === productId);
      if (productToDelete?.product_images?.length) {
        const paths = productToDelete.product_images
          .map(img => img.image_url?.split('/shop-images/').pop())
          .filter(Boolean) as string[];
        if (paths.length > 0) {
          await supabase.storage.from("shop-images").remove(paths);
        }
      }

      // 2. Delete child SQL records to prevent Foreign Key constraints error
      await Promise.allSettled([
        supabase.from("product_images").delete().eq("product_id", productId),
        (supabase as any).from("product_bundles").delete().eq("product_id", productId),
        supabase.from("product_reviews").delete().eq("product_id", productId),
        (supabase as any).from("product_variants").delete().eq("product_id", productId),
        (supabase as any).from("cart_items").delete().eq("product_id", productId),
      ]);

      // 3. Delete product main record
      const { error } = await supabase.from("products").delete().eq("id", productId);

      if (error) {
        console.error("Failed to delete product record:", error);
        setProducts(previousProducts); // Restore state on error
        toast({
          title: "Erreur lors de la suppression",
          description: error.message || "Impossible de supprimer ce produit.",
          variant: "destructive"
        });
        return;
      }

      toast({ title: "Produit supprimé avec succès ✓" });
    } catch (e: any) {
      console.error("Product deletion exception:", e);
      setProducts(previousProducts);
      toast({
        title: "Erreur",
        description: e?.message || "Erreur inattendue lors de la suppression.",
        variant: "destructive"
      });
    } finally {
      fetchData();
    }
  };

  const toggleProductStatus = async (productId: string, currentPublishedState: boolean) => {
    const nextPublishedState = !currentPublishedState;
    // Optimistic UI state update
    setProducts(prev => prev.map(p => p.id === productId ? { ...p, is_published: nextPublishedState } : p));

    const { error } = await supabase
      .from("products")
      .update({ is_published: nextPublishedState })
      .eq("id", productId);

    if (error) {
      console.error("Failed to toggle product published state:", error);
      // Rollback on error
      setProducts(prev => prev.map(p => p.id === productId ? { ...p, is_published: currentPublishedState } : p));
      toast({
        title: "Erreur de modification",
        description: "Impossible de modifier la visibilité du produit.",
        variant: "destructive"
      });
      return;
    }

    toast({
      title: nextPublishedState ? "Produit activé & visible sur la boutique" : "Produit désactivé (masqué)",
    });
  };

  const uploadProductImage = async (
    productId: string,
    file: File,
    refresh = true,
    options: { displayOrder?: number; isPrimary?: boolean } = {}
  ): Promise<boolean> => {
    setUploadingImage(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Connectez-vous pour ajouter une image.");

      const prepared = await prepareImageForUpload(file);
      if (!prepared.ok) {
        toast({ title: "Image non ajoutée", description: prepared.reason, variant: "destructive" });
        return false;
      }
      if (prepared.wasCompressed) {
        toast({
          title: "Image compressée automatiquement",
          description: `${formatSize(prepared.originalSize)} → ${formatSize(prepared.finalSize)} (sous 2 Mo)`,
        });
      }
      file = prepared.file;

      const ext = (file.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
      const randomId = typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const path = `${user.id}/products/${productId}/${Date.now()}-${randomId}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from("shop-images")
        .upload(path, file, { contentType: file.type || undefined, upsert: false });
      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage.from("shop-images").getPublicUrl(path);
      const currentImages = editingProduct?.id === productId ? (editingProduct.product_images || []) : [];
      const shouldBePrimary = options.isPrimary ?? !currentImages.some(img => img.is_primary);
      const displayOrder = options.displayOrder ?? currentImages.length;
      const { data: insertedImage, error: imageError } = await supabase
        .from("product_images")
        .insert({
          product_id: productId,
          image_url: urlData.publicUrl,
          is_primary: shouldBePrimary,
          display_order: displayOrder,
        })
        .select("id, image_url, is_primary, display_order")
        .single() as any;
      if (imageError) {
        await supabase.storage.from("shop-images").remove([path]);
        throw imageError;
      }

      if (shouldBePrimary && insertedImage?.id) {
        await supabase
          .from("product_images")
          .update({ is_primary: false })
          .eq("product_id", productId)
          .neq("id", insertedImage.id) as any;
      }

      if (insertedImage) {
        setEditingProduct(prev => {
          if (prev?.id !== productId) return prev;
          const previous = shouldBePrimary
            ? (prev.product_images || []).map(img => ({ ...img, is_primary: false }))
            : (prev.product_images || []);
          return { ...prev, product_images: sortProductImages([...previous, insertedImage]) };
        });
        setProducts(prev => prev.map(product => {
          if (product.id !== productId) return product;
          const previous = shouldBePrimary
            ? (product.product_images || []).map(img => ({ ...img, is_primary: false }))
            : (product.product_images || []);
          return { ...product, product_images: sortProductImages([...previous, insertedImage]) };
        }));
      }

      if (refresh) fetchData();
      return true;
    } catch (error: any) {
      toast({ title: "Image non sauvegardée", description: error?.message || "L'image n'a pas pu être ajoutée. Vérifiez qu'elle fait moins de 2 Mo.", variant: "destructive" });
      return false;
    } finally {
      setUploadingImage(false);
    }
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

  const isOwner = !!currentUserId && shop?.user_id === currentUserId;
  const allowedSections: ActiveSection[] | undefined = isOwner ? undefined : (() => {
    const r = collabRoles || [];
    const allowed: ActiveSection[] = ["overview"];
    if (r.includes("view_orders") || r.includes("manage_delivered_orders") || r.includes("edit_shop")) {
      allowed.push("orders", "abandoned", "statistics");
    }
    if (r.includes("edit_shop")) allowed.push("products", "appearance", "theme", "shop-themes", "ai-optimizer", "reviews");
    if (r.includes("manage_expenses")) allowed.push("finances", "billing");
    return allowed;
  })();

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
    allowedSections,
    isOwner,
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
            <ShopSidebar {...sidebarProps} onMobileClose={() => setMobileSidebarOpen(false)} />
          </SheetContent>
        </Sheet>
        <span className="font-semibold text-sm truncate">{shop.business_name}</span>
        <Button variant="ghost" size="icon" onClick={saveShop} disabled={saving}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
        </Button>
      </div>

      {/* Main Content */}
      <main className="flex-1 min-w-0 mt-[52px] md:mt-0 pb-24 md:pb-0">
        {/* Payment status: bannière compte à rebours (phase pending). En état
            locked/final, tout l'espace propriétaire est verrouillé via ShopPaymentGate. */}
        {(() => {
          const info = computeShopPaymentInfo(shop);
          if (info.status !== "payment_pending") return null;
          return <ShopPaymentCountdown shopId={shop.id} info={info} />;
        })()}
        {(() => {
          const info = computeShopPaymentInfo(shop);
          if (info.status !== "locked" && info.status !== "final_suspension") return null;
          return (
            <ShopPaymentGate shopId={shop.id} info={info}>
              <div className="min-h-[60vh]" />
            </ShopPaymentGate>
          );
        })()}
        {(() => {
          const info = computeShopPaymentInfo(shop);
          if (info.status === "locked" || info.status === "final_suspension") return null;
          return (
            <>
        {/* Billing balance banner — masquée pour les abonnés actifs */}
        {(() => {
          const sub = (shop as any).subscription_active_until;
          const isSubscribed = sub && new Date(sub).getTime() > Date.now();
          if (isSubscribed) return null;
          return (
            <BillingBanner
              balanceDue={Number(shop.commission_balance_due) || 0}
              threshold={Number(shop.commission_threshold) || 12000}
              paymentDeadline={shop.payment_deadline}
              isSuspended={!!shop.is_suspended}
              shopId={shop.id}
            />
          );
        })()}
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
        <Dialog open={showActivationModal && !isActivated} onOpenChange={(o) => setShowActivationModal(o && !isActivated)}>
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
            <Suspense fallback={<SectionFallback />}>
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
                section_order: (editingProduct as any).section_order || undefined,
                videos: (editingProduct as any).videos || [],
              } : undefined}
              productId={editingProduct?.id}
              shop={shop}
              shopSlug={shop?.slug}
              shopActivated={shop?.is_activated}
              shopPublished={shop?.is_published}
              existingImages={editingProduct?.product_images || []}
              isEditing={!!editingProduct}
              onSave={handleProductEditorSave}
              onAutoSave={handleProductAutoSave}
              onCancel={() => { setShowProductEditor(false); setEditingProduct(null); }}
              onUploadImage={editingProduct ? (file) => uploadProductImage(editingProduct.id, file) : undefined}
              onDeleteImage={deleteProductImage}
              onSetPrimaryImage={setPrimaryProductImage}
              onReorderImages={async (orderedIds) => {
                await Promise.all(
                  orderedIds.map((imgId, idx) =>
                    supabase.from("product_images").update({ display_order: idx }).eq("id", imgId) as any
                  )
                );
                fetchData();
              }}
              saving={saving}
            />
            </Suspense>
          </div>
        )}

        {/* Page Content — la boutique publique reste toujours accessible aux clients.
            Le verrouillage propriétaire s'applique uniquement aux sections sensibles
            (commandes / paniers abandonnés / informations clients). */}
        <div className="px-4 md:px-8 py-6 md:py-8">
          <Suspense fallback={<SectionFallback />}>
          {activeSection === "overview" && (
            <ShopOverview orders={orders} productCount={products.length} totalRevenue={totalRevenue} newOrders={newOrders} onViewAllOrders={() => setActiveSection("orders")} />
          )}

          {activeSection === "statistics" && (
            <ShopStatistics orders={orders} products={products} primaryColor={primaryColor} visits={visits} monthlyGoal={shop.monthly_goal || 1000000} />
          )}

          {activeSection === "theme" && (
            <ShopThemeSettings shop={shop} setShop={setShop} />
          )}

          {activeSection === "shop-themes" && (
            <ShopThemesManager
              shop={shop}
              setShop={setShop}
              products={products}
              onCustomize={() => setActiveSection("theme")}
              onOpenVisualEditor={() => setShowVisualEditor(true)}
            />
          )}

          {activeSection === "products" && (
            <ProductsTable
              products={products}
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              onAddProduct={() => { resetProductForm(); setEditingProduct(null); setShowProductEditor(true); }}
              onEditProduct={async (product) => {
                const loadedVideos = await fetchProductVideos(product.id);
                setEditingProduct({
                  ...product,
                  videos: loadedVideos.length > 0 ? loadedVideos : (Array.isArray((product as any).videos) ? (product as any).videos : [])
                } as any);
                setShowProductEditor(true);
              }}
              onDeleteProduct={deleteProduct}
              onToggleStatus={toggleProductStatus}
              onUploadImage={uploadProductImage}
              onPreviewProduct={
                shop?.is_activated && shop?.is_published
                  ? (product) => {
                      const href = `/shop/${shop.slug}/product?product=${product.id}`;
                      const opened = window.open(href, "_blank", "noopener,noreferrer");
                      if (!opened) window.location.href = href;
                    }
                  : undefined
              }
              primaryColor={primaryColor}
              orders={orders}
              shopSlug={shop.slug}
            />
          )}

          {activeSection === "orders" && (() => {
            const info = computeShopPaymentInfo(shop);
            const ownerLocked = !!shop?.is_suspended || info.isLocked || info.isFinal;
            return ownerLocked
              ? <LockedOrdersScreen shopId={shop.id} paymentDeadline={shop.payment_deadline} ordersCount={orders?.length || 0} isFinal={info.isFinal} />
              : <OrdersList shopId={shop.id} orders={orders} onUpdateStatus={updateOrderStatus} onMarkRead={markOrderRead} onOrderUpdated={() => {}} />;
          })()}

          {activeSection === "abandoned" && shop?.id && (() => {
            const info = computeShopPaymentInfo(shop);
            const ownerLocked = !!shop?.is_suspended || info.isLocked || info.isFinal;
            return ownerLocked
              ? <LockedOrdersScreen shopId={shop.id} paymentDeadline={shop.payment_deadline} ordersCount={orders?.length || 0} isFinal={info.isFinal} />
              : <AbandonedCartsList shopId={shop.id} />;
          })()}

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

          {activeSection === "collaborators" && isOwner && (
            <ShopCollaboratorsManager shopId={shop.id} shopName={shop.business_name} />
          )}

          {activeSection === "finances" && (
            <ShopFinances shopId={shop.id} shop={shop} orders={orders as any} />
          )}

          {activeSection === "ai-optimizer" && (
            <ProductAIOptimizer
              shop={shop as any}
              products={products as any}
              onShopUpdate={(patch) => setShop((s: any) => ({ ...s, ...patch }))}
            />
          )}

          {activeSection === "assistant" && (
            <ShopAssistantSettings shopId={shop.id} isActivated={!!shop.is_activated} />
          )}
          </Suspense>
        </div>
            </>
          );
        })()}
      </main>

      {showVisualEditor && (
        <Suspense fallback={<SectionFallback />}>
          <DragDropEditor 
            shop={shop} 
            setShop={setShop} 
            onClose={() => setShowVisualEditor(false)} 
          />
        </Suspense>
      )}
    </div>
  );
};

export default ShopEditor;
