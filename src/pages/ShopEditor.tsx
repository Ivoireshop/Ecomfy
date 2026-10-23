import { useEffect, useState, useCallback, useMemo, useRef, lazy, Suspense } from "react";
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
import { BillingAlertBanner } from "@/components/shop/BillingAlertBanner";
import { StoreRestrictedLockScreen } from "@/components/shop/StoreRestrictedLockScreen";
import { useBillingSystem } from "@/hooks/useBillingSystem";
import { isShopRowRestricted } from "@/lib/billingSystem";
import { triggerSeoAutoIndex } from "@/lib/seoAutoIndex";
import { ShopPaymentCountdown } from "@/components/shop/ShopPaymentCountdown";
import { ShopPaymentGate } from "@/components/shop/ShopPaymentGate";
import { computeShopPaymentInfo } from "@/lib/shopPaymentStatus";
import { SubscriptionRenewalBanner } from "@/components/shop/SubscriptionRenewalBanner";
import { computeShopSubscription, enforceShopSubscriptionExpiry } from "@/lib/shopSubscription";
import { saveProductVideos, fetchProductVideos, fetchProductThemeSettings, upsertProductThemeSettings } from "@/lib/productAppearance";

// Lazy-load heavy section panels (only one section is visible at a time).
// Keeps the editor's initial JS small without changing UI or behavior.
const AbandonedCartsList = lazy(() => import("@/components/shop/AbandonedCartsList").then(m => ({ default: m.AbandonedCartsList })));
const LoyalCustomersList = lazy(() => import("@/components/shop/LoyalCustomersList").then(m => ({ default: m.LoyalCustomersList })));
const PromoCodeManager = lazy(() => import("@/pages/PromoCodeManager"));
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
const HomepageBuilder = lazy(() => import("@/components/shop/HomepageBuilder/HomepageBuilder").then(m => ({ default: m.HomepageBuilder })));

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

const EXCLUDED_FROM_REVENUE = new Set(["cancelled", "returned"]);

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

// Offres en lot : quantité entière (le panier ne compte que des unités) et prix renseignés ; le reste est écarté.
const cleanBundleOffers = (offers: any) => Array.isArray(offers)
  ? offers
      .map((o: any) => ({ quantity: Math.floor(Number(o?.quantity)), price: Number(o?.price), label: String(o?.label ?? "").trim() }))
      .filter((o) => o.quantity > 0 && o.price > 0)
      .map((o) => (o.label ? o : { quantity: o.quantity, price: o.price }))
  : [];

// Le nom d'un groupe est la clé du choix du client : on le rogne, sans quoi « Taille » et « Taille  » divergent.
const cleanVariants = (variants: any) => Array.isArray(variants)
  ? variants
      .map((g: any) => ({
        name: String(g?.name ?? "").trim(),
        options: Array.isArray(g?.options) ? g.options.map((o: any) => String(o ?? "").trim()).filter(Boolean) : [],
      }))
      .filter((g) => g.name && g.options.length > 0)
  : [];

// Un produit visible à 0 FCFA est presque toujours un oubli : la commande part gratuite chez le client.
const PUBLISHED_PRICE_ERROR = "Un produit visible doit avoir un prix supérieur à 0. Saisissez le prix ou passez-le en brouillon.";

const productValidationSchema = z.object({
  name: z.string().min(1, "Le nom du produit est requis").max(200, "Le nom est trop long"),
  price: z.number({ invalid_type_error: "Le prix doit être un nombre" }).min(0, "Le prix ne peut pas être négatif"),
  compare_at_price: z.number().min(0, "Le prix barré ne peut pas être négatif").nullable().optional(),
  stock_quantity: z.number().min(0, "Le stock ne peut pas être négatif").int("Le stock doit être un entier"),
  category: z.string().min(1, "La catégorie est requise"),
  weight: z.number().min(0, "Le poids ne peut pas être négatif").nullable().optional(),
});

// Champs de la boutique modifiables dans l'éditeur et enregistrés par « Enregistrer » (voir saveShop).
const EDITABLE_SHOP_KEYS = [
  "slug", "business_name", "business_description", "whatsapp_number", "phone_number", "email", "city",
  "primary_color", "secondary_color", "chatbot_enabled", "chatbot_welcome_message", "is_published",
  "seo_title", "seo_description", "logo_url", "banner_url", "favicon_url",
  "facebook_pixels", "tiktok_pixels", "snapchat_pixels", "google_analytics_ids", "google_analytics_code",
  "checkout_fields", "cod_delivery_rate", "payment_methods", "theme_config", "tracking_enabled",
  "social_proof_enabled", "delivery_advisor_phone", "order_confirmation_message", "facebook_test_event_code",
  "ga4_measurement_id", "notification_settings",
  "facebook_access_token", "tiktok_access_token", "snapchat_access_token", "ga4_api_secret",
  "google_ads_conversion_id", "google_ads_conversion_label",
] as const;

const pickEditableShopFields = (shop: any) => {
  const picked: Record<string, any> = {};
  for (const key of EDITABLE_SHOP_KEYS) picked[key] = shop?.[key] ?? null;
  return picked;
};

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
  const [visits, setVisits] = useState<{ visited_at: string; product_id?: string | null; session_id?: string | null; visitor_country?: string | null; referrer?: string | null; device_type?: string | null }[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [collabRoles, setCollabRoles] = useState<string[] | null>(null);
  const lastPassiveRefreshRef = useRef(0);
  // Dérivé de la liste : reste exact quand une commande est lue depuis un autre appareil ou onglet.
  const unreadOrders = useMemo(() => orders.filter(o => !o.is_read).length, [orders]);

  // Visites des 30 derniers jours, les plus récentes d'abord. PostgREST plafonne chaque réponse (1 000 lignes)
  // quel que soit .limit() : on lit par pages jusqu'à 5000 visites, sinon les statistiques sous-comptent dès 1 000 visites.
  const fetchVisits = useCallback(async () => {
    if (!id) return null;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 30);
    const rows: any[] = [];
    for (let from = 0; from < 5000; from += 1000) {
      const page = await (supabase.from("shop_visits" as any)
        .select("visited_at, product_id, session_id, visitor_country, referrer, device_type")
        .eq("shop_id", id).gte("visited_at", startDate.toISOString())
        .order("visited_at", { ascending: false })
        .range(from, from + 999) as any);
      if (page.error) return null;
      rows.push(...(page.data || []));
      if (!page.data || page.data.length < 1000) break;
    }
    return rows;
  }, [id]);

  // Copie en mémoire de la boutique et empreinte de ses champs modifiables telle qu'enregistrée en base
  // (dernier chargement ou dernière sauvegarde) : sert à repérer les modifications non enregistrées.
  const shopRef = useRef<any>(null);
  const savedShopSnapshotRef = useRef<string | null>(null);
  useEffect(() => { shopRef.current = shop; }, [shop]);

  // Un rechargement (retour sur l'onglet, fermeture d'un éditeur…) ne doit jamais écraser des réglages non enregistrés :
  // un marchand qui règle ses couleurs puis regarde sa vitrine dans un autre onglet les perdait tous.
  const fetchData = useCallback(async () => {
    if (!id) return;
    const [shopRes, secretsRes, productsRes, visitsData] = await Promise.all([
      supabase.from("shops").select("*").eq("id", id).single() as any,
      (supabase as any).from("shop_secrets").select("*").eq("shop_id", id).maybeSingle(),
      supabase.from("products").select("*, product_images(*)").eq("shop_id", id).order("display_order") as any,
      fetchVisits(),
    ]);
    // Boutique restreinte : la base refuse la lecture directe de `orders` et ne livre que des commandes masquées
    // (noms, téléphones, adresses, notes), via get_shop_orders_secure. Pas d'articles ni de livraisons dans ce cas.
    let ordersRes: { data: any[] | null; error: any };
    if (isShopRowRestricted(shopRes.data)) {
      const rpcRes = await (supabase as any).rpc("get_shop_orders_secure", { _shop_id: id });
      ordersRes = {
        data: rpcRes.data ? (rpcRes.data as any[]).slice(0, 5000).map(o => ({ ...o, order_items: [] })) : null,
        error: rpcRes.error,
      };
    } else {
      // PostgREST plafonne chaque réponse (1 000 lignes) quel que soit .limit() : on lit par pages jusqu'à 5000 commandes.
      const rows: any[] = [];
      ordersRes = { data: rows, error: null };
      for (let from = 0; from < 5000; from += 1000) {
        const page = await (supabase.from("orders").select("*, order_items(*)").eq("shop_id", id)
          .order("created_at", { ascending: false }).order("id", { ascending: false })
          .range(from, from + 999) as any);
        if (page.error) { ordersRes = { data: null, error: page.error }; break; }
        rows.push(...(page.data || []));
        if (!page.data || page.data.length < 1000) break;
      }
    }
    if (ordersRes.error) {
      console.error("FAILED TO FETCH ORDERS:", ordersRes.error);
    }
    if (shopRes.data) {
      const secrets = (secretsRes as any)?.data || {};
      const freshShop = {
        ...shopRes.data,
        facebook_access_token: secrets.facebook_access_token ?? null,
        tiktok_access_token: secrets.tiktok_access_token ?? null,
        snapchat_access_token: secrets.snapchat_access_token ?? null,
        ga4_api_secret: secrets.ga4_api_secret ?? null,
        google_ads_conversion_id: secrets.google_ads_conversion_id ?? null,
        google_ads_conversion_label: secrets.google_ads_conversion_label ?? null,
        weekly_finance_email: secrets.weekly_finance_email ?? null,
        weekly_finance_email_enabled: secrets.weekly_finance_email_enabled ?? false,
      };
      const local = shopRef.current;
      const hasUnsavedEdits = !!local
        && savedShopSnapshotRef.current !== null
        && JSON.stringify(pickEditableShopFields(local)) !== savedShopSnapshotRef.current;
      if (hasUnsavedEdits) {
        // On garde les champs en cours de modification et on rafraîchit le reste (activation, paiement…).
        setShop({ ...freshShop, ...pickEditableShopFields(local) });
      } else {
        savedShopSnapshotRef.current = JSON.stringify(pickEditableShopFields(freshShop));
        setShop(freshShop);
      }
    }
    if (productsRes.data) {
      setProducts((productsRes.data as Product[]).map(product => ({
        ...product,
        product_images: sortProductImages(product.product_images),
      })));
    }
    if (ordersRes.data) {
      let finalOrders = ordersRes.data;
      if (finalOrders.length > 0 && !isShopRowRestricted(shopRes.data)) {
        try {
          // Par lots : avec jusqu'à 5000 commandes, un seul .in() dépasse la longueur d'URL
          // autorisée, la requête échoue et le suivi de livraison disparaît silencieusement.
          const orderIds: string[] = finalOrders.map((o: any) => o.id);
          const chunks: string[][] = [];
          for (let i = 0; i < orderIds.length; i += 100) chunks.push(orderIds.slice(i, i + 100));
          const results = await Promise.all(chunks.map(chunk =>
            supabase
              .from("order_deliveries")
              .select("*")
              .in("order_id", chunk)
          ));
          const failed = results.find(r => r.error);
          if (failed?.error) console.error("Failed to fetch order deliveries", failed.error);
          // Le nom du prestataire vient de la vue publique : `delivery_providers` n'est lisible que par son propriétaire.
          const providerIds = Array.from(new Set(results.flatMap(r => (r.data || []).map((d: any) => d.provider_id)).filter(Boolean)));
          const providerNames = new Map<string, any>();
          if (providerIds.length > 0) {
            const { data: providers } = await (supabase as any).from("delivery_providers_public").select("id, company_name").in("id", providerIds);
            (providers || []).forEach((p: any) => providerNames.set(p.id, p));
          }
          // Nom et téléphone du livreur : absents de delivery_company_members, lus dans le profil via une fonction
          // qui ne répond que pour les livreurs affectés aux commandes de l'appelant.
          const driverIds = Array.from(new Set(results.flatMap(r => (r.data || []).map((d: any) => d.driver_id)).filter(Boolean)));
          const driverContacts = new Map<string, any>();
          for (let i = 0; i < driverIds.length; i += 500) {
            const { data: contacts } = await (supabase as any).rpc("get_delivery_driver_contacts", { _member_ids: driverIds.slice(i, i + 500) });
            (contacts || []).forEach((c: any) => driverContacts.set(c.member_id, c));
          }
          const deliveriesByOrder = new Map<string, any[]>();
          results.forEach(r => (r.data || []).forEach((d: any) => {
            const list = deliveriesByOrder.get(d.order_id) || [];
            const contact = d.driver_id ? driverContacts.get(d.driver_id) : null;
            list.push({
              ...d,
              provider: providerNames.get(d.provider_id) || null,
              driver: d.driver_id ? { id: d.driver_id, name: contact?.full_name || "Livreur", phone: contact?.phone || "" } : null,
            });
            deliveriesByOrder.set(d.order_id, list);
          }));
          finalOrders = finalOrders.map((o: any) => ({
            ...o,
            order_deliveries: deliveriesByOrder.get(o.id) || [],
          }));
        } catch (e) {
          console.error("Failed to fetch order deliveries", e);
        }
      }
      setOrders(finalOrders);
    }
    if (visitsData) setVisits(visitsData);
    setLoading(false);
  }, [id, fetchVisits]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Abonnement échu : demande au serveur de le constater (taux de commission rétabli, fermeture après le délai de grâce)
  // sans attendre la tâche planifiée. Une seule fois par boutique et par échéance ; la mise à jour de la boutique
  // revient par le canal temps réel ci-dessous.
  const subscriptionCheckKey = useRef<string | null>(null);
  useEffect(() => {
    if (!shop?.id) return;
    const sub = computeShopSubscription(shop);
    if (!sub.isExpired) return;
    const key = `${shop.id}:${shop.subscription_active_until}`;
    if (subscriptionCheckKey.current === key) return;
    subscriptionCheckKey.current = key;
    void enforceShopSubscriptionExpiry(shop.id).then((result) => {
      if (result && result !== "none") fetchData();
    });
  }, [shop, fetchData]);

  // « Visiteurs en ce moment » : les visites ne se rechargeaient qu'au retour sur l'onglet. Rafraîchies toutes les 30 s
  // sur la page Statistiques uniquement (et seulement onglet visible).
  useEffect(() => {
    if (activeSection !== "statistics") return;
    const timer = setInterval(async () => {
      if (document.visibilityState !== "visible") return;
      const fresh = await fetchVisits();
      if (fresh) setVisits(fresh);
    }, 30000);
    return () => clearInterval(timer);
  }, [activeSection, fetchVisits]);

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
    const channel = supabase.channel(`shop-orders-${id}_${Math.random().toString(36).substring(2, 8)}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "orders", filter: `shop_id=eq.${id}` }, (payload) => {
        const newOrder = payload.new as Order;
        let isDuplicate = false;
        setOrders(prev => {
          isDuplicate = prev.some(o => o.id === newOrder.id);
          return isDuplicate ? prev : [newOrder, ...prev];
        });
        if (!isDuplicate) {
          toast({ title: "🛒 Nouvelle commande !", description: `${newOrder.customer_name} - ${newOrder.order_number}` });
        }
        // L'événement n'embarque ni les articles ni le total final (calculés par triggers juste après l'insertion).
        (async () => {
          const { data } = await supabase.from("orders").select("*, order_items(*)").eq("id", newOrder.id).maybeSingle();
          if (data) setOrders(prev => prev.map(o => o.id === newOrder.id ? { ...o, ...(data as any) } : o));
        })();
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "orders", filter: `shop_id=eq.${id}` }, (payload) => {
        const updatedOrder = payload.new as Order;
        setOrders(prev => prev.map(o => o.id === updatedOrder.id ? { ...o, ...updatedOrder } : o));
      })
      .subscribe();
    // Realtime shop status — auto-unlock after payment confirmation
    const shopChannel = supabase.channel(`shop-status-${id}_${Math.random().toString(36).substring(2, 8)}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "shops", filter: `id=eq.${id}` }, (payload) => {
        const next: any = payload.new;
        setShop((prev: any) => {
          const wasLocked = prev && (prev.is_suspended || ["locked","final_suspension","payment_pending"].includes(prev.shop_payment_status));
          const nowActive = next && next.shop_payment_status === "active" && !next.is_suspended;
          if (wasLocked && nowActive) {
            toast({ title: "✅ Boutique déverrouillée", description: "Paiement confirmé. Accès complet aux commandes restauré." });
          }
          // Les réglages en cours de modification (non enregistrés) ne sont pas écrasés par une mise à jour venue d'ailleurs.
          const hasUnsavedEdits = !!prev
            && savedShopSnapshotRef.current !== null
            && JSON.stringify(pickEditableShopFields(prev)) !== savedShopSnapshotRef.current;
          return hasUnsavedEdits ? { ...prev, ...next, ...pickEditableShopFields(prev) } : { ...prev, ...next };
        });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); supabase.removeChannel(shopChannel); };
  }, [id]);

  // Refresh orders when the tab becomes visible or window regains focus
  const showProductEditorRef = useRef(showProductEditor);
  useEffect(() => {
    showProductEditorRef.current = showProductEditor;
  }, [showProductEditor]);

  useEffect(() => {
    if (!id) return;
    const refresh = () => {
      if (showProductEditorRef.current) return;
      const now = Date.now();
      if (now - lastPassiveRefreshRef.current < 3000) return;
      lastPassiveRefreshRef.current = now;
      fetchData();
    };
    const onVis = () => { if (document.visibilityState === "visible" && !showProductEditorRef.current) refresh(); };
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("focus", refresh);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("focus", refresh);
    };
  }, [id, fetchData]);

  const { billingInfo } = useBillingSystem(id);
  const isRestricted = billingInfo?.isRestricted || false;

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

    if (!activationProvider) {
      setActivationProvider("all");
    }
    setActivating(true);
    const paymentWindow = openPaymentWindow();
    try {
      const { data, error } = await supabase.functions.invoke("process-payment", {
        body: { 
          amount: 1300, 
          payment_method: "mobile_money", 
          user_id: sessionUserId, 
          provider: activationProvider || "all", 
          phone: activationPhone || undefined, 
          payment_type: "shop_activation", 
          shop_id: shop.id 
        },
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
      savedShopSnapshotRef.current = JSON.stringify(pickEditableShopFields({ ...shop, slug: nextSlug }));
      if (nextSlug !== shop.slug) setShop({ ...shop, slug: nextSlug });
      invalidatePublicCaches();
      toast({ title: "✓ Sauvegardé" });
      if (shop.is_published && shop.is_activated) {
        triggerSeoAutoIndex(`https://ecomfy.cloud/shop/${nextSlug}`);
      }
    }
    setSaving(false);
  };

  // Vide les copies en mémoire de la boutique / des produits publics (onglet courant : aperçu du marchand).
  const invalidatePublicCaches = () => {
    if (!id || !shop?.slug) return;
    cacheInvalidate(`shop:slug:${shop.slug}`);
    cacheInvalidate(`shop-products:${id}`);
    cacheInvalidate(`product:${id}:`);
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

  // Méta titre / description : envoyés seulement s'ils sont renseignés ou si la colonne existe déjà sur la ligne lue.
  // Ainsi une base où la migration SEO n'est pas encore passée continue d'enregistrer les produits normalement.
  const seoFields = (data: any, existing: any) => {
    const out: Record<string, string | null> = {};
    const title = String(data.seo_title ?? "").trim();
    const description = String(data.seo_description ?? "").trim();
    if (title || (existing && "seo_title" in existing)) out.seo_title = title || null;
    if (description || (existing && "seo_description" in existing)) out.seo_description = description || null;
    return out;
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
    
    if (data.is_published && !(Number(data.price) > 0)) {
      toast({ title: "Prix manquant", description: PUBLISHED_PRICE_ERROR, variant: "destructive" });
      return false;
    }

    setSaving(true);
    try {
      // L'adresse saisie dans « URL slug » est enregistrée (avant, elle était ignorée dès que le produit avait un slug).
      const wantedSlug = toSlug(data.slug || "");
      let productSlug: string;
      if (editingProduct?.slug && (!wantedSlug || wantedSlug === editingProduct.slug)) {
        productSlug = editingProduct.slug;
      } else {
        productSlug = await getUniqueProductSlug(wantedSlug || data.name, editingProduct?.id);
        if (wantedSlug && productSlug !== wantedSlug) {
          toast({ title: "Adresse déjà utilisée", description: `Un autre produit utilise « ${wantedSlug} » : l'adresse enregistrée est « ${productSlug} ».` });
        }
      }
      const rawSectionOrder = typeof data.section_order === "object" && data.section_order !== null ? data.section_order : {};
      const sectionOrderWithTitle = {
        ...rawSectionOrder,
        bundle_title: data.bundle_title ? data.bundle_title.trim() : null,
      };

      const productData = {
        name: data.name, description: data.description, short_description: data.short_description,
        price: data.price, compare_at_price: data.compare_at_price || null, category: data.category,
        stock_quantity: data.stock_quantity, is_digital: data.is_digital, is_published: data.is_published,
        is_featured: data.is_featured, sku: data.sku || null, weight: data.weight || null, shop_id: id,
        slug: productSlug,
        bundle_offers: cleanBundleOffers(data.bundle_offers),
        bundle_position: data.bundle_position || "after_countdown",
        variants: cleanVariants(data.variants),
        section_order: sectionOrderWithTitle,
        ...seoFields(data, editingProduct),
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

      // « Autoriser les commandes au-delà du stock » choisi avant la création : le produit n'existait pas encore.
      if (prodId && !editingProduct && data.allow_out_of_stock_orders === false) {
        const existing = await fetchProductThemeSettings(prodId);
        const result = await upsertProductThemeSettings({
          product_id: prodId,
          shop_id: id,
          ...existing,
          custom_css_settings: { ...(existing?.custom_css_settings || {}), allow_out_of_stock_orders: false },
        });
        if (!result.success) {
          toast({ title: "Réglage de stock non enregistré", description: "Rouvrez le produit et réactivez l'option « Autoriser les commandes au-delà du stock ».", variant: "destructive" });
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
      
      if (!editingProduct) {
        setShowProductEditor(false);
        setEditingProduct(null);
        resetProductForm();
      } else if (prodId) {
        // Keep editor open and refresh editingProduct in sync with DB
        const { data: updatedProd } = await supabase
          .from("products")
          .select("*, product_images(*)")
          .eq("id", prodId)
          .maybeSingle() as any;
        if (updatedProd) {
          setEditingProduct({
            ...updatedProd,
            product_images: sortProductImages(updatedProd.product_images || []),
            videos: data.videos || updatedProd.videos || [],
          });
        }
      }
      
      await fetchData();
      // Invalidate public-facing caches so the new product + images appear
      // immediately for visitors arriving from ads/links.
      invalidatePublicCaches();
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
    // Mêmes règles que l'enregistrement complet : sans elles, une frappe en cours (nom vidé, prix négatif ou à 0 sur un
    // produit visible) était écrite en base au bout d'une seconde et demie.
    try {
      productValidationSchema.parse({
        name: data.name,
        price: Number(data.price),
        compare_at_price: data.compare_at_price ? Number(data.compare_at_price) : null,
        stock_quantity: Number(data.stock_quantity),
        category: data.category,
        weight: data.weight ? Number(data.weight) : null,
      });
    } catch {
      return false;
    }
    if (data.is_published && !(Number(data.price) > 0)) return false;
    const rawSectionOrder = typeof data.section_order === "object" && data.section_order !== null ? data.section_order : {};
    const sectionOrderWithTitle = {
      ...rawSectionOrder,
      bundle_title: data.bundle_title ? data.bundle_title.trim() : null,
    };

    const productData = {
      name: data.name, description: data.description, short_description: data.short_description,
      price: data.price, compare_at_price: data.compare_at_price || null, category: data.category,
      stock_quantity: data.stock_quantity, is_digital: data.is_digital, is_published: data.is_published,
      is_featured: data.is_featured, sku: data.sku || null, weight: data.weight || null,
      bundle_offers: cleanBundleOffers(data.bundle_offers),
      bundle_position: data.bundle_position || "after_countdown",
      variants: cleanVariants(data.variants),
      section_order: sectionOrderWithTitle,
      ...seoFields(data, editingProduct),
    };
    const { error } = await supabase
      .from("products")
      .update(productData)
      .eq("id", editingProduct.id) as any;
    if (error) return false;
    invalidatePublicCaches();
    return true;
  };

  const deleteProductImage = async (imageId: string) => {
    const productId = editingProduct?.id;
    const imageToDelete = editingProduct?.product_images?.find(img => img.id === imageId);

    // La ligne en base part d'abord : si elle ne peut pas être supprimée, le fichier reste en place. Avant, le fichier
    // était effacé en premier et la fiche gardait une image cassée quand la suppression échouait.
    const { error } = await supabase.from("product_images").delete().eq("id", imageId) as any;
    if (error) {
      toast({ title: "Image non supprimée", description: error.message, variant: "destructive" });
      return;
    }

    if (imageToDelete?.image_url) {
      try {
        // Un même fichier peut encore servir à une autre ligne : on ne l'efface que s'il n'est plus référencé.
        const { count } = await supabase.from("product_images").select("id", { count: "exact", head: true }).eq("image_url", imageToDelete.image_url);
        const path = imageToDelete.image_url.split('/shop-images/').pop()?.split('?')[0];
        if (!count && path) await supabase.storage.from("shop-images").remove([path]);
      } catch (e) {
        console.error("Failed to delete image from storage", e);
      }
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

  // La première image de l'ordre devient l'image principale : c'est ce que l'éditeur annonce, et la boutique place
  // l'image principale en tête quel que soit l'ordre. L'éditeur lit editingProduct, qui n'était pas mis à jour ici :
  // le changement n'apparaissait qu'après réouverture du produit.
  const reorderProductImages = async (orderedIds: string[]) => {
    const productId = editingProduct?.id;
    if (!productId || orderedIds.length === 0) return;
    const results = await Promise.all(
      orderedIds.map((imgId, idx) =>
        supabase.from("product_images").update({ display_order: idx, is_primary: idx === 0 }).eq("id", imgId) as any
      )
    );
    const failed = results.find((r: any) => r.error);
    if (failed?.error) {
      toast({ title: "Ordre des images non enregistré", description: failed.error.message, variant: "destructive" });
      await fetchData();
      return;
    }
    const apply = (images?: ProductImageRow[] | null) => sortProductImages((images || []).map(img => {
      const idx = orderedIds.indexOf(img.id);
      return idx < 0 ? img : { ...img, display_order: idx, is_primary: idx === 0 };
    }));
    setEditingProduct(prev => prev?.id === productId ? { ...prev, product_images: apply(prev.product_images) } : prev);
    setProducts(prev => prev.map(product => product.id === productId ? { ...product, product_images: apply(product.product_images) } : product));
    invalidatePublicCaches();
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
    invalidatePublicCaches();
    toast({ title: "Image principale mise à jour" });
    fetchData();
  };

  const deleteProduct = async (productId: string) => {
    const productToDelete = products.find(p => p.id === productId);

    // Une commande garde la référence du produit : la base refuse de le supprimer. Avant, ce refus n'arrivait
    // qu'après la suppression de ses images, avis et réglages (la fiche restait, vidée). On vérifie donc d'abord.
    const { count: orderCount, error: countError } = await supabase
      .from("order_items")
      .select("id", { count: "exact", head: true })
      .eq("product_id", productId);
    if (countError) {
      toast({ title: "Suppression impossible", description: countError.message, variant: "destructive" });
      return;
    }
    if ((orderCount ?? 0) > 0) {
      const hide = productToDelete?.is_published
        ? confirm(`Ce produit figure dans ${orderCount} commande(s) : il ne peut pas être supprimé sans effacer votre historique.\n\nLe masquer de la boutique à la place ?`)
        : (alert(`Ce produit figure dans ${orderCount} commande(s) : il ne peut pas être supprimé. Il est déjà masqué de la boutique.`), false);
      if (hide) await toggleProductStatus(productId, true);
      return;
    }

    if (!confirm("Voulez-vous vraiment supprimer ce produit ? Cette action est irréversible.")) return;

    // Optimistic removal from UI state
    const previousProducts = [...products];
    setProducts(prev => prev.filter(p => p.id !== productId));

    try {
      // Le produit d'abord : images, avis, thème, vidéos… partent avec lui (ON DELETE CASCADE). Rien d'autre n'est
      // touché si la base refuse.
      const { error } = await supabase.from("products").delete().eq("id", productId);

      if (error) {
        console.error("Failed to delete product record:", error);
        setProducts(previousProducts); // Restore state on error
        toast({
          title: "Erreur lors de la suppression",
          description: error.code === "23503"
            ? "Ce produit est encore utilisé (commandes, paiements). Masquez-le plutôt que de le supprimer."
            : (error.message || "Impossible de supprimer ce produit."),
          variant: "destructive"
        });
        return;
      }

      // Fichiers d'images : seulement une fois le produit réellement supprimé (nettoyage sans conséquence si une étape échoue).
      const paths = (productToDelete?.product_images || [])
        .map(img => img.image_url?.split('/shop-images/').pop()?.split('?')[0])
        .filter(Boolean) as string[];
      if (paths.length > 0) {
        try { await supabase.storage.from("shop-images").remove(paths); } catch (e) { console.error("Failed to purge product images", e); }
      }

      invalidatePublicCaches();
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
    const target = products.find(p => p.id === productId);
    if (nextPublishedState && target && !(Number(target.price) > 0)) {
      toast({ title: "Prix manquant", description: PUBLISHED_PRICE_ERROR, variant: "destructive" });
      return;
    }
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

    invalidatePublicCaches();
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
    const previous = orders.find(o => o.id === orderId);
    // Mise à jour immédiate de l'écran, annulée si le serveur refuse.
    setOrders(prev => prev.map(o => o.id === orderId ? { ...o, order_status: status, is_read: true } : o));
    const { error } = await supabase.from("orders").update({ order_status: status, is_read: true }).eq("id", orderId);
    if (error) {
      if (previous) setOrders(prev => prev.map(o => o.id === orderId ? { ...o, order_status: previous.order_status, is_read: previous.is_read } : o));
      toast({ title: "Statut non modifié", description: error.message || "Vous n'avez peut-être pas les droits sur cette commande.", variant: "destructive" });
      return;
    }
    toast({ title: "Statut mis à jour" });
    // Le serveur peut réagir au changement (transfert automatique au livreur) : on recharge.
    fetchData();
  };

  const markOrderRead = async (orderId: string) => {
    setOrders(prev => prev.map(o => o.id === orderId ? { ...o, is_read: true } : o));
    const { error } = await supabase.from("orders").update({ is_read: true }).eq("id", orderId);
    if (error) {
      console.error("Failed to mark order as read", error);
      setOrders(prev => prev.map(o => o.id === orderId ? { ...o, is_read: false } : o));
    }
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  if (!shop) return <div className="min-h-screen flex items-center justify-center"><p>Boutique introuvable</p></div>;

  const primaryColor = shop.primary_color || "#2563eb";
  // Les commandes annulées ou retournées ne sont pas du chiffre d'affaires.
  const totalRevenue = orders.reduce((sum, o) => sum + (EXCLUDED_FROM_REVENUE.has(o.order_status) ? 0 : o.total), 0);

  const openPreview = () => window.open(shop?.is_activated && shop?.is_published ? `/shop/${shop.slug}` : `/shop-preview/${shop.id}`, "_blank");

  const isOwner = !!currentUserId && shop?.user_id === currentUserId;
  const allowedSections: ActiveSection[] | undefined = isOwner ? undefined : (() => {
    const r = collabRoles || [];
    if (r.includes("full_admin")) return undefined; // Full admin gets access to all sections
    const allowed: ActiveSection[] = ["overview"];
    if (r.includes("view_orders") || r.includes("manage_delivered_orders") || r.includes("edit_shop")) {
      allowed.push("orders", "abandoned", "loyal-customers", "promo-codes", "statistics");
    }
    if (r.includes("manage_catalog") || r.includes("edit_shop")) {
      allowed.push("products");
    }
    if (r.includes("edit_shop")) {
      allowed.push("appearance", "theme", "shop-themes", "ai-optimizer", "reviews", "homepage", "assistant", "settings");
    }
    if (r.includes("manage_customers")) {
      allowed.push("reviews", "loyal-customers");
    }
    if (r.includes("view_stats")) {
      allowed.push("statistics");
    }
    if (r.includes("manage_expenses")) {
      allowed.push("finances", "billing");
    }
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
          if (billingInfo?.hasInvoice || billingInfo?.isPaymentDue || billingInfo?.isRestricted) return null;
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
        {/* Système automatique de Seuil de Facturation & Délais (240 commandes / 12 000 FCFA) */}
        <SubscriptionRenewalBanner shopId={shop.id} subscription={info.subscription} />
        <BillingAlertBanner shopId={shop?.id} />

        {/* Legacy Billing Banner */}
        {(() => {
          const sub = (shop as any).subscription_active_until;
          const isSubscribed = sub && new Date(sub).getTime() > Date.now();
          // Le bandeau BillingAlertBanner (ci-dessus) couvre déjà les délais ouverts et les restrictions.
          if (isSubscribed || billingInfo?.hasInvoice || billingInfo?.isGracePeriod || billingInfo?.isRestricted) return null;
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
                <Label className="text-sm font-semibold">Mode de paiement préféré</Label>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {[
                    { id: "orange", label: "Orange Money", color: "bg-orange-500", text: "text-orange-600" },
                    { id: "mtn", label: "MTN MoMo", color: "bg-yellow-500", text: "text-amber-600" },
                    { id: "wave", label: "Wave", color: "bg-sky-500", text: "text-sky-600" },
                    { id: "moov", label: "Moov Money", color: "bg-emerald-600", text: "text-emerald-600" },
                    { id: "card", label: "Carte Visa/MC", color: "bg-purple-600", text: "text-purple-600" },
                  ].map(op => (
                    <button key={op.id} type="button" onClick={() => setActivationProvider(op.id)}
                      className={`p-2.5 rounded-xl border-2 text-xs font-bold transition-all flex items-center justify-start gap-2 ${activationProvider === op.id ? 'border-primary bg-primary/10 shadow-sm' : 'border-border hover:border-primary/40'}`}>
                      <div className={`h-2.5 w-2.5 rounded-full ${op.color} flex-shrink-0`} />
                      <span className="truncate">{op.label}</span>
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label className="text-xs">Numéro de téléphone</Label>
                  <span className="text-[11px] text-muted-foreground">(Facultatif)</span>
                </div>
                <Input value={activationPhone} onChange={(e) => setActivationPhone(e.target.value)} placeholder="Ex: 07 01 02 03 04 (ou laisser vide pour saisir au paiement)" className="text-sm" />
              </div>
              <Button onClick={handleActivateShop} disabled={activating} className="w-full gap-2 font-bold py-6 text-base" size="lg">
                {activating ? <Loader2 className="h-5 w-5 animate-spin" /> : <CreditCard className="h-5 w-5" />}
                Activer ma boutique (1 300 FCFA)
              </Button>
              <p className="text-[11px] text-center text-muted-foreground">
                🔒 Paiement sécurisé multi-réseaux (Orange Money 🟠, MTN 🟡, Wave 🔵, Moov 🟢, Carte 💳) via GeniusPay.
              </p>
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
                seo_title: (editingProduct as any).seo_title || "",
                seo_description: (editingProduct as any).seo_description || "",
                bundle_offers: (editingProduct as any).bundle_offers || [],
                bundle_position: (editingProduct as any).bundle_position || "after_countdown",
                bundle_title: (editingProduct as any).bundle_title || (editingProduct as any).section_order?.bundle_title || "",
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
              onCancel={() => { setShowProductEditor(false); setEditingProduct(null); fetchData(); }}
              onUploadImage={editingProduct ? (file) => uploadProductImage(editingProduct.id, file, false) : undefined}
              onDeleteImage={deleteProductImage}
              onSetPrimaryImage={setPrimaryProductImage}
              onReorderImages={reorderProductImages}
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
            <ShopOverview orders={orders} productCount={products.length} totalRevenue={totalRevenue} unreadOrders={unreadOrders} onViewAllOrders={() => setActiveSection("orders")} isRestricted={isRestricted} />
          )}

          {activeSection === "statistics" && (
            <ShopStatistics orders={orders} products={products} primaryColor={primaryColor} visits={visits} monthlyGoal={shop.monthly_goal || 1000000} />
          )}

          {activeSection === "theme" && (
            <StoreRestrictedLockScreen shopId={shop.id} isRestricted={isRestricted}>
              <ShopThemeSettings shop={shop} setShop={setShop} />
            </StoreRestrictedLockScreen>
          )}

          {activeSection === "shop-themes" && (
            <StoreRestrictedLockScreen shopId={shop.id} isRestricted={isRestricted}>
              <ShopThemesManager
                shop={shop}
                setShop={setShop}
                products={products}
                onCustomize={() => setActiveSection("theme")}
                onOpenVisualEditor={() => setShowVisualEditor(true)}
              />
            </StoreRestrictedLockScreen>
          )}

          {activeSection === "products" && (
            <StoreRestrictedLockScreen shopId={shop.id} isRestricted={isRestricted}>
              <ProductsTable
                products={products}
                searchQuery={searchQuery}
                onSearchChange={setSearchQuery}
                onAddProduct={() => { resetProductForm(); setEditingProduct(null); setShowProductEditor(true); }}
                onEditProduct={async (product) => {
                  const loadedVideos = await fetchProductVideos(product.id).catch(() => [] as any[]);
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
            </StoreRestrictedLockScreen>
          )}

          {activeSection === "orders" && (() => {
            const info = computeShopPaymentInfo(shop);
            const ownerLocked = !!shop?.is_suspended || info.isLocked || info.isFinal;
            return ownerLocked
              ? <LockedOrdersScreen shopId={shop.id} paymentDeadline={shop.payment_deadline} ordersCount={orders?.length || 0} isFinal={info.isFinal} />
              : <OrdersList shopId={shop.id} orders={orders} onUpdateStatus={updateOrderStatus} onMarkRead={markOrderRead} onOrderUpdated={fetchData} isRestricted={isRestricted} />;
          })()}

          {activeSection === "abandoned" && shop?.id && (() => {
            const info = computeShopPaymentInfo(shop);
            const ownerLocked = !!shop?.is_suspended || info.isLocked || info.isFinal;
            return ownerLocked || isRestricted
              ? <StoreRestrictedLockScreen shopId={shop.id} isRestricted={true}><div /></StoreRestrictedLockScreen>
              : <AbandonedCartsList shopId={shop.id} shopName={shop.business_name} />;
          })()}

          {activeSection === "loyal-customers" && shop?.id && (() => {
            const info = computeShopPaymentInfo(shop);
            const ownerLocked = !!shop?.is_suspended || info.isLocked || info.isFinal;
            return ownerLocked || isRestricted
              ? <StoreRestrictedLockScreen shopId={shop.id} isRestricted={true}><div /></StoreRestrictedLockScreen>
              : <LoyalCustomersList shopId={shop.id} shopSlug={shop.slug} shopName={shop.business_name} primaryColor={primaryColor} />;
          })()}

          {activeSection === "promo-codes" && shop?.id && (() => {
            const info = computeShopPaymentInfo(shop);
            const ownerLocked = !!shop?.is_suspended || info.isLocked || info.isFinal;
            return ownerLocked || isRestricted
              ? <StoreRestrictedLockScreen shopId={shop.id} isRestricted={true}><div /></StoreRestrictedLockScreen>
              : <PromoCodeManager mode="merchant" shopId={shop.id} shopSlug={shop.slug} shopName={shop.business_name} isEmbedded={true} />;
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
                      <div className="h-20 w-36 rounded-2xl border-2 border-dashed border-border flex items-center justify-center overflow-hidden bg-muted/30 p-1.5">
                        {shop.logo_url ? <img src={shop.logo_url} alt="" className="h-full w-full object-contain" /> : <Store className="h-8 w-8 text-muted-foreground" />}
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

                  {/* Mode d'affichage de l'en-tête (Header Display Mode) */}
                  <div className="pt-4 border-t space-y-3 col-span-full">
                    <div className="flex items-center justify-between">
                      <Label className="font-extrabold text-sm flex items-center gap-2">
                        <Store className="h-4 w-4 text-primary" /> Mode d'affichage dans l'en-tête &amp; sur les fiches produits
                      </Label>
                      <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-primary/10 text-primary border border-primary/20">✨ Toutes les pages</span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      {[
                        { id: "logo_only", label: "Logo uniquement", desc: "Masque le texte pour éviter tout doublon avec l'image du logo (Recommandé)" },
                        { id: "both", label: "Logo + Nom", desc: "Affiche l'image du logo ET le nom texte à côté" },
                        { id: "name_only", label: "Nom uniquement", desc: "Affiche uniquement le nom de la boutique en texte" },
                      ].map((item) => {
                        const currentMode = shop.theme_config?.header_display_mode || (shop.logo_url ? "logo_only" : "name_only");
                        const isSelected = currentMode === item.id;
                        return (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => {
                              const cfg = shop.theme_config || {};
                              setShop({ ...shop, theme_config: { ...cfg, header_display_mode: item.id } });
                            }}
                            className={`p-3 rounded-xl border-2 text-left transition-all cursor-pointer ${
                              isSelected 
                                ? "border-primary bg-primary/5 text-foreground ring-1 ring-primary/20 font-bold" 
                                : "border-border/60 hover:border-primary/40 text-muted-foreground hover:text-foreground"
                            }`}
                          >
                            <div className="font-bold text-xs mb-1">{item.label}</div>
                            <p className="text-[11px] opacity-80 leading-snug">{item.desc}</p>
                          </button>
                        );
                      })}
                    </div>
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

          {activeSection === "homepage" && (
            <HomepageBuilder
              shop={shop}
              setShop={setShop}
              products={products as any}
            />
          )}

          {activeSection === "settings" && (
            <StoreRestrictedLockScreen shopId={shop.id} isRestricted={isRestricted}>
              <ShopSettings shop={shop} setShop={setShop} onDeleteShop={() => navigate("/shop-manager")} />
            </StoreRestrictedLockScreen>
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
