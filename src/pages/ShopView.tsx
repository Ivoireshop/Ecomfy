import { useEffect, useState, useRef, lazy, Suspense, type CSSProperties } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { thumbUrl } from "@/lib/imageUrl";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { ShoppingCart, Plus, Minus, Trash2, MessageCircle, Send, X, Store, Phone, Search, Heart, Star, ChevronRight, MapPin, Mail, ShoppingBag, ArrowRight, CheckCircle2, ArrowLeft, User, Truck, CreditCard } from "lucide-react";
import { initShopPixels, trackEvent } from "@/lib/tracking";
import { ShopReviewBar } from "@/components/shop/ShopReviewBar";
import { ShopLanguageSelector } from "@/components/shop/ShopLanguageSelector";
import { useShopTranslations } from "@/hooks/useShopTranslation";
import { isRtlLang } from "@/lib/shopLanguages";
import { PhoneInput } from "@/components/shop/PhoneInput";
import { isValidFullPhone, normalizeToE164, parseFullPhone } from "@/lib/phoneCountries";
import { containsDigits, stripDigits } from "@/lib/utils";
import { Helmet } from "react-helmet";
import { cacheGet, cacheSet, cacheIsFresh, shopKey, shopProductsKey } from "@/lib/shopCache";
import { useDeferredMount } from "@/lib/useDeferredMount";
import { ShopThemeRenderer } from "@/lib/shopThemes/ShopThemeRenderer";

// Heavy, non-critical widgets — load only after the shop hero/products grid is
// visible so the LCP and "Commander" button are not blocked by extra JS.
const SocialProofNotification = lazy(() =>
  import("@/components/shop/SocialProofNotification").then(m => ({ default: m.SocialProofNotification }))
);
const ShopAIAssistant = lazy(() =>
  import("@/components/shop/ShopAIAssistant").then(m => ({ default: m.ShopAIAssistant }))
);

interface Product {
  id: string;
  name: string;
  description: string | null;
  short_description: string | null;
  price: number;
  compare_at_price: number | null;
  category: string;
  stock_quantity: number;
  is_featured: boolean;
  is_digital: boolean;
  product_images: { id: string; image_url: string; is_primary: boolean }[];
  variants?: { name: string; options: string[] }[] | null;
}

interface CartItem { product: Product; quantity: number; selectedVariants?: Record<string, string> | null; }
interface ChatMessage { role: "user" | "assistant"; content: string; }

const sortProductImages = (images?: Product["product_images"] | null) =>
  [...(images || [])].sort((a, b) => {
    if (!!a.is_primary !== !!b.is_primary) return a.is_primary ? -1 : 1;
    return ((a as any).display_order ?? 0) - ((b as any).display_order ?? 0);
  });

const ShopView = () => {
  const { slug, id } = useParams<{ slug?: string; id?: string }>();
  const navigate = useNavigate();
  // Defer mounting non-critical widgets (social proof toasts, AI chat) so the
  // shop hero + products grid + "Commander" button paint as fast as possible.
  const deferredReady = useDeferredMount(1500);
  const [shop, setShop] = useState<any>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [checkoutStep, setCheckoutStep] = useState<"cart" | "info" | "confirm">("cart");
  const [chatOpen, setChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [orderLoading, setOrderLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [variantChoice, setVariantChoice] = useState<Record<string, string>>({});
  const [orderSuccess, setOrderSuccess] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  // Progressive rendering: only render a window of products to keep first paint fast.
  const PAGE_SIZE = 12;
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const loadMoreRef = useRef<HTMLDivElement | null>(null);

  const [customerInfo, setCustomerInfo] = useState({
    name: "", phone: "", email: "", address: "", city: "", paymentMethod: "mobile_money",
  });
  const [cityError, setCityError] = useState("");

  // ----- Shop language (auto-detected from browser, override via selector) -----
  const [shopLang, setShopLang] = useState<string>(() => {
    if (typeof window === "undefined") return "fr";
    const stored = localStorage.getItem("vp_shop_lang");
    if (stored) return stored;
    const nav = (navigator.language || "fr").slice(0, 2).toLowerCase();
    return ["fr", "en", "es", "pt", "ar"].includes(nav) ? nav : "fr";
  });
  const enabledLanguages: string[] = Array.isArray(shop?.enabled_languages) && shop.enabled_languages.length > 0
    ? shop.enabled_languages
    : ["fr"];
  // Clamp current lang to enabled set
  useEffect(() => {
    if (!shop) return;
    if (!enabledLanguages.includes(shopLang)) {
      setShopLang(enabledLanguages[0] || "fr");
    }
  }, [shop, enabledLanguages.join("|")]); // eslint-disable-line
  const handleLangChange = (l: string) => {
    setShopLang(l);
    try { localStorage.setItem("vp_shop_lang", l); } catch {}
  };
  const { mergeShop, mergeProduct, translateShopOnDemand, translateProductOnDemand } =
    useShopTranslations(shop?.id, shopLang, "fr");

  // Trigger shop & visible-products translation when language changes
  useEffect(() => {
    if (!shop || shopLang === "fr") return;
    translateShopOnDemand({
      business_name: shop.business_name,
      business_description: shop.business_description,
    });
    products.forEach((p) => translateProductOnDemand(p));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shop?.id, shopLang, products.length]);

  // Abandoned cart tracking: stable session id per shop, kept in localStorage
  const sessionIdRef = useRef<string>("");
  const abandonedSavedRef = useRef<boolean>(false);
  // Prevent duplicate order submissions from double-tap / double-click.
  const submittingOrderRef = useRef(false);
  useEffect(() => {
    if (!shop?.id) return;
    const key = `vp_abandon_session_${shop.id}`;
    let sid = localStorage.getItem(key);
    if (!sid) {
      sid = (crypto as any).randomUUID ? crypto.randomUUID() : `s_${Date.now()}_${Math.random()}`;
      localStorage.setItem(key, sid);
    }
    sessionIdRef.current = sid;
  }, [shop?.id]);

  // Debounced upsert when visitor enters checkout info without finalising
  useEffect(() => {
    if (!shop?.id || shop?._isPreview) return;
    if (!sessionIdRef.current) return;
    // Only track when there is at least a phone OR a name AND items in cart
    if (cart.length === 0) return;
    if (!customerInfo.phone && !customerInfo.name) return;

    const t = setTimeout(async () => {
      try {
        const items = cart.map(i => ({
          product_id: i.product.id,
          name: i.product.name,
          quantity: i.quantity,
          price: i.product.price,
        }));
        const itemsCount = cart.reduce((s, i) => s + i.quantity, 0);
        const total = cart.reduce((s, i) => s + i.product.price * i.quantity, 0);
        const _country = (() => {
          if (!customerInfo.phone) return null;
          const n = normalizeToE164(customerInfo.phone, shop?.country) || customerInfo.phone;
          return parseFullPhone(n).country?.name || null;
        })();
        await (supabase as any).rpc("upsert_abandoned_cart", {
          _shop_id: shop.id,
          _session_id: sessionIdRef.current,
          _customer_name: customerInfo.name || null,
          _customer_phone: customerInfo.phone ? (normalizeToE164(customerInfo.phone, shop?.country) || customerInfo.phone) : null,
          _customer_email: customerInfo.email || null,
          _customer_city: customerInfo.city || null,
          _customer_address: customerInfo.address || null,
          _customer_country: _country,
          _payment_method: customerInfo.paymentMethod || null,
          _items: items,
          _items_count: itemsCount,
          _total: total,
        });
        abandonedSavedRef.current = true;
      } catch (_) { /* silent */ }
    }, 1200);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shop?.id, customerInfo.name, customerInfo.phone, customerInfo.email, customerInfo.city, customerInfo.address, customerInfo.paymentMethod, cart]);

  useEffect(() => { fetchShop(); }, [slug, id]);

  // Preload the ProductView chunk as soon as the shop renders so the first
  // tap on a product card is instant on mobile (no hover to trigger prefetch).
  useEffect(() => {
    const conn = (navigator as any).connection;
    if (conn?.saveData) return;
    if (conn?.effectiveType && /^(2g|slow-2g)$/.test(conn.effectiveType)) return;
    const ric = (window as any).requestIdleCallback as
      | ((cb: () => void, opts?: { timeout: number }) => number) | undefined;
    const run = () => { import("@/pages/ProductView").catch(() => {}); };
    if (ric) ric(run, { timeout: 2000 }); else setTimeout(run, 800);
  }, []);

  // Refetch when the tab regains focus / becomes visible so any change
  // published from the editor is reflected immediately on the live shop.
  useEffect(() => {
    // Throttle: avoid refetching if we just loaded; saves Supabase round-trips
    // every time the user tabs away and back. 30s is enough to catch editor
    // publishes without hammering on every focus event.
    let lastRefresh = Date.now();
    const refresh = () => {
      if (document.visibilityState !== "visible") return;
      if (Date.now() - lastRefresh < 30_000) return;
      lastRefresh = Date.now();
      fetchShop();
    };
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug, id]);

  // Retry helper for flaky networks (in-app browsers, mobile data, ad-blockers)
  const fetchWithRetry = async (fn: () => any, attempts = 3): Promise<any> => {
    let lastErr: any = null;
    for (let i = 0; i < attempts; i++) {
      try {
        const res = await Promise.race([
          Promise.resolve(fn()),
          new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), 9000)),
        ]) as any;
        if (!res?.error) return res;
        lastErr = res.error;
      } catch (e) {
        lastErr = e;
      }
      await new Promise((r) => setTimeout(r, 400 * Math.pow(2, i)));
    }
    return { data: null, error: lastErr };
  };

  const fetchShop = async () => {
    // Custom-domain mode: when no slug/id in the URL, try resolving the shop
    // from the current hostname (e.g. https://maboutique.com → shop with
    // custom_domain = 'maboutique.com').
    const host = typeof window !== "undefined" ? window.location.hostname.toLowerCase().replace(/^www\./, "") : "";
    const KNOWN_HOSTS = ["ecomfy.cloud", "www.ecomfy.cloud", "visuelpro.cloud", "www.visuelpro.cloud", "localhost", "visualpro-african-ai-creations.lovable.app"];
    const isCustomHost = host && !KNOWN_HOSTS.includes(host) && !host.endsWith(".lovable.app") && !host.endsWith(".lovable.dev") && !host.endsWith(".lovableproject.com");
    if (!slug && !id && !isCustomHost) return;
    setFetchError(null);
    // Stale-while-revalidate: hydrate instantly from cache when available,
    // then proceed with network fetch to refresh in background.
    const cacheK = id
      ? shopKey(id, "id")
      : slug
        ? shopKey(slug, "slug")
        : isCustomHost ? shopKey(host, "domain") : null;
    let hydratedFromCache = false;
    if (cacheK) {
      const cachedShop = cacheGet<any>(cacheK);
      if (cachedShop) {
        setShop(cachedShop);
        const cachedProducts = cacheGet<Product[]>(shopProductsKey(cachedShop.id));
        if (cachedProducts) setProducts(cachedProducts);
        setLoading(false);
        hydratedFromCache = true;
        // If cache is fresh enough, skip the network round-trip entirely.
        if (cacheIsFresh(cacheK)) return;
      }
    }
    if (!hydratedFromCache) setLoading(true);
    let shopData: any = null;
    let networkError = false;
    let inactiveShop: any = null;

    // ── ULTRA-FAST PATH: in-flight RPC started from index.html BEFORE the JS
    // bundle finished loading. Saves 400-1500 ms on ad-traffic cold loads.
    try {
      const preload: any = (window as any).__vpShopPreload;
      if (preload && preload.slug === slug && preload.promise) {
        const rows = await preload.promise;
        (window as any).__vpShopPreload = null;
        const live = Array.isArray(rows) ? rows[0] : null;
        if (live) shopData = live;
      }
    } catch {}

    if (shopData) {
      // already resolved by preload — fall through to set state below
    } else if (id) {
      const { data: previewById, error } = await fetchWithRetry(() =>
        supabase.from("shops").select("*").eq("id", id).maybeSingle()
      );
      if (error && !previewById) networkError = true;
      if (previewById) shopData = { ...previewById, _isPreview: true };
    } else if (slug || isCustomHost) {
      // If we are on a custom domain, look up the shop by its custom_domain first
      if (!slug && isCustomHost) {
        const { data: byDomain, error: domainErr } = await fetchWithRetry(() =>
          supabase.rpc("get_public_shop_by_custom_domain" as any, { p_domain: host })
        );
        if (domainErr) networkError = true;
        const matched = (byDomain as any)?.[0];
        if (matched) {
          shopData = matched;
        } else {
          setFetchError("Aucune boutique n'est connectée à ce nom de domaine.");
          setLoading(false);
          return;
        }
      } else {
      const { data: liveRows, error: liveErr } = await fetchWithRetry(() =>
        supabase.rpc("get_public_shop_by_slug" as any, { p_slug: slug })
      );

      const liveData = (liveRows as any)?.[0];
      if (liveData) {
        shopData = liveData;
      } else if (liveErr) {
        networkError = true;
      } else {
        // Slug not found in the public view. Try the base table to see if the
        // shop exists but is not yet activated / published / is suspended,
        // so we can display a clear message instead of "Boutique introuvable".
        const { data: previewRows, error: prevErr } = await fetchWithRetry(() =>
          supabase
            .from("shops")
            .select("id, business_name, slug, logo_url, is_activated, is_published, is_suspended, user_id")
            .eq("slug", slug)
            .order("created_at", { ascending: false })
            .limit(1)
        );
        const previewData = (previewRows as any)?.[0];
        if (previewData) {
          // If owner is viewing their own shop, show preview mode.
          const { data: { session } } = await supabase.auth.getSession();
          if (session && session.user.id === previewData.user_id) {
            shopData = { ...previewData, _isPreview: true };
          } else {
            inactiveShop = previewData;
          }
        } else if (prevErr) networkError = true;
      }
      }
    }

    if (!shopData) {
      if (networkError) {
        // Don't surface a network error if we already showed cached data.
        if (!hydratedFromCache) {
          setFetchError("Impossible de charger la boutique. Vérifiez votre connexion et réessayez.");
        }
      } else if (inactiveShop) {
        // Suspended shops restent visibles via la vue publique ; ce chemin ne se
        // déclenche que lorsque la boutique n'est ni publiée ni activée.
        setFetchError(
          "Cette boutique est en cours de configuration. Elle sera bientôt disponible."
        );
      }
      if (!hydratedFromCache) setLoading(false);
      return;
    }
    setShop(shopData);
    if (cacheK) cacheSet(cacheK, shopData);

    let productsQuery = supabase
      .from("products")
      .select("*, product_images(*)")
      .eq("shop_id", shopData.id)
      .order("display_order");

    if (!shopData._isPreview) {
      productsQuery = productsQuery.eq("is_published", true);
    }

    const { data: productsData } = await productsQuery as any;
    const finalProducts = (productsData || []).map((product: Product) => ({
      ...product,
      product_images: sortProductImages(product.product_images),
    }));
    setProducts(finalProducts);
    cacheSet(shopProductsKey(shopData.id), finalProducts);
    setLoading(false);

    // Track shop visit (skip preview mode)
    if (!shopData._isPreview) {
      // Fire-and-forget: do not block render on analytics insert
      try {
        let sid = sessionStorage.getItem("vp_visit_session");
        if (!sid) {
          sid = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
          sessionStorage.setItem("vp_visit_session", sid);
        }
        supabase.functions.invoke("track-shop-visit", {
          body: {
            shop_id: shopData.id,
            session_id: sid,
            referrer: document.referrer,
            page_path: window.location.pathname
          }
        }).then(() => {}, () => {});
      } catch {}
    }

    // Set favicon dynamically (shop branding first) — remove ALL existing icon links
    // so the browser doesn't keep showing the default Ecomfy favicon.
    const iconHref = shopData.favicon_url || shopData.logo_url || "/favicon.png";
    document.head
      .querySelectorAll("link[rel~='icon'], link[rel='shortcut icon'], link[rel='apple-touch-icon']")
      .forEach((el) => el.parentNode?.removeChild(el));
    const addIcon = (rel: string) => {
      const l = document.createElement("link");
      l.rel = rel;
      l.type = "image/png";
      l.href = `${iconHref}${iconHref.includes("?") ? "&" : "?"}v=${Date.now()}`;
      document.head.appendChild(l);
    };
    addIcon("icon");
    addIcon("shortcut icon");
    addIcon("apple-touch-icon");

    // Page title and social meta are handled by <Helmet> in the main render

    if (shopData.chatbot_enabled) {
      setChatMessages([{ role: "assistant", content: shopData.chatbot_welcome_message || "Bienvenue ! Comment puis-je vous aider ?" }]);
    }

    // ---- Tracking pixels (skip in preview/owner mode) ----
    if (!shopData._isPreview) {
      initShopPixels(shopData);
      trackEvent(shopData, "PageView");
    }
  };

  // Apply translation overlay on shop + products
  const tShop = shop ? mergeShop(shop) : shop;
  const tProducts = products.map((p) => mergeProduct(p as any));

  const categories = ["all", ...new Set(tProducts.map(p => p.category))];
  const filteredProducts = tProducts.filter(p => {
    const matchCat = selectedCategory === "all" || p.category === selectedCategory;
    const matchSearch = !searchQuery || p.name.toLowerCase().includes(searchQuery.toLowerCase());
    return matchCat && matchSearch;
  });
  const featuredProducts = tProducts.filter(p => p.is_featured);
  const visibleProducts = filteredProducts.slice(0, visibleCount);
  const hasMore = filteredProducts.length > visibleCount;

  // Reset window whenever the active filter / search changes.
  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [selectedCategory, searchQuery, products.length]);

  // Auto-load more on scroll using an IntersectionObserver sentinel.
  useEffect(() => {
    if (!hasMore) return;
    const el = loadMoreRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver((entries) => {
      if (entries.some(e => e.isIntersecting)) {
        setVisibleCount(c => c + PAGE_SIZE);
      }
    }, { rootMargin: "600px 0px" });
    io.observe(el);
    return () => io.disconnect();
  }, [hasMore, visibleCount, filteredProducts.length]);

  const cartKey = (productId: string, sv?: Record<string, string> | null) =>
    `${productId}::${sv && Object.keys(sv).length ? JSON.stringify(sv) : ""}`;

  const addToCart = (product: Product, selectedVariants?: Record<string, string> | null) => {
    if (shop?._isPreview) {
      toast({ title: "🔒 Aperçu", description: "Activez la boutique pour recevoir des commandes." });
      return;
    }
    const variantGroups = Array.isArray(product.variants) ? product.variants.filter((g: any) => g?.name && Array.isArray(g?.options) && g.options.length > 0) : [];
    if (variantGroups.length > 0) {
      const sv = selectedVariants || {};
      const missing = variantGroups.filter((g: any) => !sv[g.name]);
      if (missing.length > 0) {
        setVariantChoice({});
        setSelectedProduct(product);
        return;
      }
    }
    const sv = selectedVariants && Object.keys(selectedVariants).length > 0 ? selectedVariants : null;
    const key = cartKey(product.id, sv);
    setCart(prev => {
      const existing = prev.find(item => cartKey(item.product.id, item.selectedVariants) === key);
      if (existing) return prev.map(item => cartKey(item.product.id, item.selectedVariants) === key ? { ...item, quantity: item.quantity + 1 } : item);
      return [...prev, { product, quantity: 1, selectedVariants: sv }];
    });
    toast({ title: "✓ Ajouté au panier", description: product.name });
    trackEvent(shop, "AddToCart", {
      value: product.price,
      content_ids: [product.id],
      content_name: product.name,
      content_type: "product",
      contents: [{ id: product.id, quantity: 1, item_price: product.price }],
      num_items: 1,
    });
  };

  const updateQuantity = (key: string, delta: number) => {
    setCart(prev => prev.map(item => {
      if (cartKey(item.product.id, item.selectedVariants) !== key) return item;
      const newQty = item.quantity + delta;
      return newQty <= 0 ? item : { ...item, quantity: newQty };
    }).filter(item => item.quantity > 0));
  };

  const removeFromCart = (key: string) => setCart(prev => prev.filter(item => cartKey(item.product.id, item.selectedVariants) !== key));
  const cartTotal = cart.reduce((sum, item) => sum + item.product.price * item.quantity, 0);
  const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  const placeOrder = async () => {
    if (submittingOrderRef.current) return;
    if (!shop || !customerInfo.name || !customerInfo.phone || cart.length === 0) {
      toast({ title: "Erreur", description: "Remplissez tous les champs obligatoires", variant: "destructive" });
      return;
    }
    if (!isValidFullPhone(customerInfo.phone)) {
      toast({
        title: "Numéro invalide",
        description: "Veuillez saisir un numéro de téléphone valide pour votre pays.",
        variant: "destructive",
      });
      return;
    }
    if (customerInfo.city && containsDigits(customerInfo.city)) {
      toast({ title: "Ville invalide", description: "La ville ne doit pas contenir de chiffres.", variant: "destructive" });
      return;
    }
    submittingOrderRef.current = true;
    setOrderLoading(true);
    try {
      const normalizedPhone = normalizeToE164(customerInfo.phone, shop?.country) || customerInfo.phone;
      const detectedCountry = parseFullPhone(normalizedPhone).country?.name || shop?.country || null;
      const commissionAmount = cartTotal * (shop.commission_rate || 0.025);
      const { data: orderNumData } = await supabase.rpc("generate_order_number") as any;
      const orderId = (crypto as any).randomUUID();
      const orderNumber = orderNumData || `VP-${Date.now()}`;
      const productsSummary = cart
        .map(item => {
          const v = item.selectedVariants && Object.keys(item.selectedVariants).length > 0
            ? ` (${Object.entries(item.selectedVariants).map(([k, val]) => `${k}: ${val}`).join(", ")})`
            : "";
          return `${item.quantity}× ${item.product.name}${v}`;
        })
        .join(" ; ");
      const { error } = await supabase.from("orders").insert({
        id: orderId,
        shop_id: shop.id, order_number: orderNumber,
        customer_name: customerInfo.name, customer_email: customerInfo.email,
        customer_phone: normalizedPhone, customer_address: customerInfo.address,
        customer_city: customerInfo.city,
        customer_country: detectedCountry,
        subtotal: cartTotal,
        commission_amount: commissionAmount, total: cartTotal,
        payment_method: customerInfo.paymentMethod,
        products_summary: productsSummary,
      }) as any;
      if (error) throw error;
      const order = { id: orderId, order_number: orderNumber };
      const orderItems = cart.map(item => ({
        order_id: order.id, product_id: item.product.id, product_name: item.product.name,
        product_image_url: item.product.product_images?.[0]?.image_url || null,
        quantity: item.quantity, unit_price: item.product.price,
        total_price: item.product.price * item.quantity,
        selected_variants: item.selectedVariants && Object.keys(item.selectedVariants).length > 0 ? item.selectedVariants : null,
      }));
      const { error: itemsError } = await supabase.from("order_items").insert(orderItems) as any;
      if (itemsError) console.error("[ShopView] order_items insert failed", itemsError);
      // Mark abandoned cart as converted (if any was tracked)
      if (sessionIdRef.current && shop?.id) {
        try {
          await (supabase as any).rpc("mark_abandoned_cart_converted", {
            _shop_id: shop.id,
            _session_id: sessionIdRef.current,
          });
        } catch (_) {}
      }
      trackEvent(shop, "Purchase", {
        value: cartTotal,
        order_id: order.order_number,
        content_ids: cart.map((c) => c.product.id),
        contents: cart.map((c) => ({ id: c.product.id, quantity: c.quantity, item_price: c.product.price })),
        num_items: cart.reduce((s, c) => s + c.quantity, 0),
        email: customerInfo.email,
        phone: normalizedPhone,
        first_name: customerInfo.name,
        city: customerInfo.city,
      });
      setCart([]);
      setCustomerInfo({ name: "", phone: "", email: "", address: "", city: "", paymentMethod: "mobile_money" });
      setCityError("");
      setCheckoutOpen(false);
      navigate("/order-confirmed", {
        state: {
          shopName: shop.business_name,
          shopSlug: shop.slug,
          primaryColor: shop.primary_color,
          message: shop.order_confirmation_message,
          advisorPhone: shop.delivery_advisor_phone || shop.phone_number,
          whatsappNumber: shop.whatsapp_number,
          orderNumber: order.order_number,
          total: cartTotal,
        },
      });
    } catch (error: any) {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    } finally {
      setOrderLoading(false);
      submittingOrderRef.current = false;
    }
  };

  const sendChatMessage = async () => {
    if (!chatInput.trim() || !shop) return;
    const userMsg = chatInput.trim();
    setChatInput("");
    setChatMessages(prev => [...prev, { role: "user", content: userMsg }]);
    setChatLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("shop-chatbot", {
        body: { message: userMsg, shopName: shop.business_name, shopDescription: shop.business_description, products: products.map(p => ({ name: p.name, price: p.price, description: p.short_description })) },
      });
      if (error) throw error;
      setChatMessages(prev => [...prev, { role: "assistant", content: data.reply }]);
    } catch {
      setChatMessages(prev => [...prev, { role: "assistant", content: "Désolé, je ne peux pas répondre. Contactez le vendeur directement." }]);
    } finally { setChatLoading(false); }
  };

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [chatMessages]);

  if (loading) return (
    <div className="min-h-screen bg-white">
      <div className="border-b sticky top-0 z-40 bg-white">
        <div className="max-w-6xl mx-auto px-3 sm:px-4 py-2.5 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="h-8 w-8 rounded-lg bg-gray-200 animate-pulse" />
            <div className="h-4 w-32 rounded bg-gray-200 animate-pulse" />
          </div>
          <div className="h-9 w-20 rounded-lg bg-gray-200 animate-pulse" />
        </div>
      </div>
      <div className="max-w-6xl mx-auto px-3 sm:px-6 py-6">
        <div className="h-40 sm:h-56 rounded-xl bg-gray-100 animate-pulse mb-6" />
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="space-y-2">
              <div className="aspect-square rounded-xl bg-gray-100 animate-pulse" />
              <div className="h-3 w-3/4 rounded bg-gray-200 animate-pulse" />
              <div className="h-3 w-1/2 rounded bg-gray-200 animate-pulse" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
  
  if (!shop) return (
    <div className="min-h-screen flex items-center justify-center flex-col gap-4 bg-background">
      <Store className="h-20 w-20 text-muted-foreground/30" />
      <h1 className="text-2xl font-bold">
        {fetchError ? "Boutique momentanément indisponible" : "Boutique introuvable"}
      </h1>
      <p className="text-muted-foreground max-w-md text-center px-4">
        {fetchError ?? "Cette boutique n'existe pas ou n'est pas encore disponible"}
      </p>
      <Button onClick={() => fetchShop()} className="mt-2">Réessayer</Button>
      {fetchError && (
        <p className="text-xs text-muted-foreground/70 max-w-sm text-center px-6">
          Astuce : si vous ouvrez ce lien depuis Facebook, Instagram ou TikTok, appuyez sur le menu (⋯) en haut à droite et choisissez « Ouvrir dans Chrome » ou « Ouvrir dans Safari ».
        </p>
      )}
    </div>
  );

  // Note: une boutique "is_suspended" (vendeur verrouillé pour paiement) reste
  // entièrement accessible aux clients. Le verrouillage ne concerne que l'espace
  // vendeur ; la boutique publique, les fiches produits et le tunnel de commande
  // continuent de fonctionner normalement.

  const primaryColor = shop.primary_color || "#2563eb";
  const secondaryColor = shop.secondary_color || "#7c3aed";
  const themeConfig = shop.theme_config || {};

  // Optional pro theme — early return when a theme is active and user did not opt-out via ?classic=1
  const activeShopThemeSlug: string | null = themeConfig?.active_theme_slug || null;
  const classicOptOut = typeof window !== "undefined" && new URLSearchParams(window.location.search).get("classic") === "1";
  if (activeShopThemeSlug && !classicOptOut) {
    return (
      <>
        <Helmet>
          <title>{shop.seo_title || shop.business_name || "Boutique"}</title>
          <meta name="description" content={shop.business_description || `Boutique ${shop.business_name}`} />
          <link rel="canonical" href={window.location.href} />
        </Helmet>
        <ShopThemeRenderer
          themeSlug={activeShopThemeSlug}
          shop={shop}
          products={products}
          customSettings={themeConfig?.custom_settings}
        />
      </>
    );
  }

  const formatPrice = (n: number) => new Intl.NumberFormat("fr-FR").format(n);

  const shopTitle = shop.seo_title || shop.business_name || "Boutique";
  const shopDescription = shop.business_description || `Boutique ${shop.business_name} sur Ecomfy`;
  const shopImage = shop.logo_url || shop.favicon_url || "https://storage.googleapis.com/gpt-engineer-file-uploads/YasR3rLLCfTPxhyVC44DaAaelxo2/social-images/social-1766315146557-T%C3%A9moignage%20(3).jpg";

  return (
    <>
      <Helmet>
        <title>{shopTitle}</title>
        <meta name="description" content={shopDescription} />
        <link rel="canonical" href={window.location.href} />
        <meta property="og:title" content={shopTitle} />
        <meta property="og:description" content={shopDescription} />
        <meta property="og:url" content={window.location.href} />
        <meta property="og:type" content="website" />
        {shopImage && <meta property="og:image" content={shopImage} />}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={shopTitle} />
        <meta name="twitter:description" content={shopDescription} />
        {shopImage && <meta name="twitter:image" content={shopImage} />}
      </Helmet>
      <div className="min-h-screen bg-background">
      {/* Top Promo Banner */}
      <div className="text-white text-center py-2 px-4 text-[10px] sm:text-xs font-bold tracking-[0.2em] uppercase flex items-center justify-center gap-2 shadow-sm relative z-50" style={{ backgroundColor: primaryColor }}>
        <span>Livraison gratuite partout</span>
        <span className="text-base sm:text-lg">🎁</span>
      </div>

      <ShopReviewBar themeConfig={themeConfig} placement="above" />
      {/* Preview Mode Banner */}
      {shop._isPreview && (
        <div className="bg-amber-500 text-white text-center py-2 px-4 text-sm font-medium sticky top-0 z-[60] shadow-sm">
          ⚠️ Mode prévisualisation — Cette boutique n'est pas encore en ligne
        </div>
      )}

      {/* Sticky Header - Premium Glassmorphism */}
      <header
        className="border-b sticky top-0 z-40 bg-white/85 backdrop-blur-xl shadow-sm transition-all duration-300"
        style={{
          borderColor: themeConfig.header_mobile_border_color || themeConfig.header_desktop_border_color || "rgba(0,0,0,0.05)",
        } as CSSProperties}
      >
        <div className="max-w-7xl mx-auto px-4 py-3 sm:py-4 flex items-center justify-between gap-4 sm:gap-6">
          <div className="flex items-center gap-3 sm:gap-4 min-w-0 group cursor-pointer" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}>
            {shop.logo_url ? (
              <img src={thumbUrl(shop.logo_url, 128)} alt="" loading="eager" width={48} height={48} className="h-10 w-10 sm:h-12 sm:w-12 rounded-2xl object-cover flex-shrink-0 shadow-sm border border-gray-100 group-hover:scale-105 transition-transform" />
            ) : (
              <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-2xl flex items-center justify-center flex-shrink-0 shadow-sm group-hover:scale-105 transition-transform" style={{ backgroundColor: primaryColor + "15" }}>
                <Store className="h-5 w-5 sm:h-6 sm:w-6" style={{ color: primaryColor }} />
              </div>
            )}
            <span className="font-extrabold text-lg sm:text-xl md:text-2xl truncate tracking-tight text-gray-900 group-hover:opacity-80 transition-opacity">{tShop.business_name}</span>
          </div>
          
          {/* Search - Desktop */}
          <div className="hidden md:flex relative flex-1 max-w-xl mx-auto group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400 group-focus-within:text-primary transition-colors" />
            <Input 
              placeholder="Rechercher un produit..." 
              value={searchQuery} 
              onChange={e => setSearchQuery(e.target.value)} 
              className="pl-12 bg-gray-100/80 border-transparent focus-visible:ring-2 focus-visible:ring-primary/20 focus-visible:border-primary rounded-full h-12 text-base shadow-inner transition-all hover:bg-gray-100"
            />
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            {enabledLanguages.length > 1 && (
              <ShopLanguageSelector value={shopLang} onChange={handleLangChange} enabled={enabledLanguages} />
            )}
            {shop.whatsapp_number && (
              <a href={`https://wa.me/${shop.whatsapp_number.replace(/[^0-9]/g, "")}`} target="_blank" rel="noopener noreferrer" className="hidden sm:flex">
                <Button variant="ghost" size="icon" className="rounded-full h-10 w-10 sm:h-12 sm:w-12 bg-gray-50 hover:bg-green-50 hover:text-green-600 transition-colors">
                  <Phone className="h-5 w-5" />
                </Button>
              </a>
            )}
            <Button 
              className="gap-2 rounded-full relative h-10 sm:h-12 px-4 sm:px-6 font-bold shadow-md hover:shadow-lg transition-all hover:-translate-y-0.5" 
              style={{ backgroundColor: primaryColor, color: "#fff" }}
              onClick={() => {
                if (shop._isPreview) return;
                setCheckoutOpen(true);
                setOrderSuccess(false);
              }}
              disabled={shop._isPreview}
              title={shop._isPreview ? "Disponible une fois la boutique activée" : undefined}
            >
              <ShoppingBag className="h-4 w-4 sm:h-5 sm:w-5" />
              <span className="hidden sm:inline text-sm sm:text-base">Panier</span>
              {cartCount > 0 && (
                <span className="absolute -top-2 -right-2 h-6 w-6 rounded-full text-[11px] sm:text-xs font-extrabold flex items-center justify-center bg-red-500 text-white shadow-sm ring-2 ring-white animate-in zoom-in bounce">
                  {cartCount}
                </span>
              )}
            </Button>
          </div>
        </div>
      </header>
      <ShopReviewBar themeConfig={themeConfig} placement="below" />

      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gray-950 w-full min-h-[500px] sm:min-h-[600px] flex items-center justify-center">
        {shop.banner_url ? (
          <div className="absolute inset-0">
            <img src={thumbUrl(shop.banner_url, 1200)} alt="" loading="eager" decoding="async" fetchPriority="high" className="w-full h-full object-cover mix-blend-overlay opacity-80" />
            <div className="absolute inset-0 bg-gradient-to-t from-gray-950 via-gray-950/60 to-transparent" />
            <div className="absolute inset-0 bg-gradient-to-r from-gray-950/80 via-transparent to-transparent" />
          </div>
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-gray-900 via-gray-950 to-black">
            <div className="absolute top-0 right-0 w-[500px] h-[500px] rounded-full bg-white/5 -translate-y-1/2 translate-x-1/2 blur-[100px]" />
            <div className="absolute bottom-0 left-0 w-[400px] h-[400px] rounded-full bg-white/5 translate-y-1/2 -translate-x-1/2 blur-[80px]" />
          </div>
        )}
        <div className="relative z-10 w-full max-w-5xl mx-auto px-4 py-16 text-center text-white flex flex-col items-center">
          {shop.logo_url && (
            <img src={thumbUrl(shop.logo_url, 256)} alt={tShop.business_name} loading="eager" decoding="async" width={96} height={96} className="h-20 w-20 sm:h-24 sm:w-24 rounded-3xl object-cover mx-auto mb-6 shadow-2xl border-4 border-white/10" />
          )}
          <h1 dir={isRtlLang(shopLang) ? "rtl" : undefined} className="text-4xl sm:text-6xl md:text-7xl lg:text-8xl font-black mb-6 tracking-tighter drop-shadow-2xl leading-[1.1] text-transparent bg-clip-text bg-gradient-to-b from-white to-gray-300">
            {tShop.business_name}
          </h1>
          {tShop.business_description && (
            <p dir={isRtlLang(shopLang) ? "rtl" : undefined} className="text-lg sm:text-xl md:text-2xl text-gray-300 max-w-3xl mx-auto leading-relaxed font-medium mb-10 text-balance">
              {tShop.business_description}
            </p>
          )}
          <div className="flex gap-4 sm:gap-5 justify-center flex-wrap">
            <Button 
              size="lg" 
              className="rounded-full gap-2 font-bold shadow-xl shadow-black/20 h-14 sm:h-16 px-8 sm:px-10 text-base sm:text-lg hover:scale-105 transition-transform" 
              style={{ backgroundColor: primaryColor, color: "#fff" }} 
              onClick={() => document.getElementById("products")?.scrollIntoView({ behavior: "smooth" })}
            >
              <ShoppingBag className="h-5 w-5 sm:h-6 sm:w-6" /> Voir les produits
            </Button>
            {shop.whatsapp_number && (
              <a href={`https://wa.me/${shop.whatsapp_number.replace(/[^0-9]/g, "")}`} target="_blank" rel="noopener noreferrer">
                <Button size="lg" variant="outline" className="rounded-full gap-2 border-white/20 text-white bg-white/5 hover:bg-white/10 backdrop-blur-md h-14 sm:h-16 px-8 sm:px-10 text-base sm:text-lg shadow-xl transition-all">
                  <MessageCircle className="h-5 w-5 sm:h-6 sm:w-6" /> Nous contacter
                </Button>
              </a>
            )}
          </div>
        </div>
        
        {/* Scroll indicator */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 animate-bounce hidden sm:block opacity-50">
          <div className="w-8 h-12 rounded-full border-2 border-white/30 flex items-start justify-center p-2">
            <div className="w-1 h-3 bg-white rounded-full" />
          </div>
        </div>
      </section>

      {/* Featured Products */}
      {featuredProducts.length > 0 && (
        <section className="max-w-7xl mx-auto px-4 py-16 sm:py-24">
          <div className="flex flex-col items-center justify-center mb-10 sm:mb-14 text-center">
            <h2 className="text-3xl sm:text-4xl font-black tracking-tight mb-3">Produits vedettes</h2>
            <div className="w-24 h-1.5 rounded-full" style={{ backgroundColor: primaryColor }} />
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6 lg:gap-8">
            {featuredProducts.slice(0, 4).map((product, idx) => (
              <ProductCard key={product.id} product={product} primaryColor={primaryColor} onAddToCart={addToCart} eager={idx < 4} onView={(p) => {
                const base = shop._isPreview ? `/shop-preview/${shop.id}` : `/shop/${shop.slug}`;
                navigate((p as any).slug ? `${base}/p/${(p as any).slug}` : `${base}/product?product=${p.id}`);
              }} formatPrice={formatPrice} />
            ))}
          </div>
        </section>
      )}

      {/* All Products */}
      <section id="products" className="max-w-7xl mx-auto px-4 py-12 sm:py-16 pb-24 bg-gray-50/50 rounded-3xl mb-12 border border-gray-100">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-10">
          <div>
            <h2 className="text-3xl sm:text-4xl font-black tracking-tight mb-2">Tous les produits</h2>
            <p className="text-muted-foreground text-lg">Découvrez l'intégralité de notre catalogue</p>
          </div>
          
          {/* Mobile Search */}
          <div className="md:hidden relative w-full mt-2">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
            <Input placeholder="Rechercher..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="pl-12 bg-white border-gray-200 rounded-full h-14 text-base shadow-sm focus-visible:ring-primary" />
          </div>
        </div>

        {/* Categories Chips */}
        {categories.length > 1 && (
          <div className="flex gap-3 overflow-x-auto pb-6 mb-4 scrollbar-hide snap-x">
            {categories.map(cat => {
              const isActive = selectedCategory === cat;
              return (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`snap-start whitespace-nowrap px-6 py-3 rounded-full text-sm sm:text-base font-bold transition-all duration-300 shadow-sm ${isActive ? "text-white shadow-md ring-2 ring-offset-2 ring-offset-gray-50 scale-105" : "bg-white text-gray-700 hover:bg-gray-100 border border-gray-200"}`}
                  style={isActive ? { backgroundColor: primaryColor, ringColor: primaryColor } : {}}
                >
                  {cat === "all" ? "Tout voir" : cat}
                </button>
              );
            })}
          </div>
        )}

        <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6 lg:gap-8">
          {visibleProducts.map((product, idx) => (
            <ProductCard key={product.id} product={product} primaryColor={primaryColor} eager={idx < 4 && featuredProducts.length === 0} onAddToCart={addToCart} onView={(p) => {
              const base = shop._isPreview ? `/shop-preview/${shop.id}` : `/shop/${shop.slug}`;
              navigate((p as any).slug ? `${base}/p/${(p as any).slug}` : `${base}/product?product=${p.id}`);
            }} formatPrice={formatPrice} />
          ))}
        </div>
        {hasMore && (
          <div ref={loadMoreRef} className="flex justify-center py-12">
            <Button
              variant="outline"
              size="lg"
              className="rounded-full h-14 px-8 font-bold border-2 hover:bg-gray-100"
              onClick={() => setVisibleCount(c => c + PAGE_SIZE)}
            >
              Afficher plus de produits ({filteredProducts.length - visibleCount} restants)
            </Button>
          </div>
        )}
        {filteredProducts.length === 0 && (
          <div className="text-center py-24 bg-white rounded-3xl border border-gray-100 shadow-sm mt-8">
            <ShoppingBag className="h-20 w-20 mx-auto text-gray-200 mb-6" />
            <p className="text-2xl font-bold text-gray-800 mb-2">Aucun produit trouvé</p>
            <p className="text-gray-500 text-lg">Essayez de modifier vos filtres ou votre recherche.</p>
            <Button variant="outline" className="mt-6 rounded-full" onClick={() => { setSearchQuery(""); setSelectedCategory("all"); }}>
              Réinitialiser la recherche
            </Button>
          </div>
        )}
      </section>

      {/* Contact Section */}
      <section className="bg-gray-900 text-white py-16 sm:py-24">
        <div className="max-w-7xl mx-auto px-4 text-center">
          <h2 className="text-3xl sm:text-4xl font-black mb-4">Besoin d'aide ?</h2>
          <p className="text-gray-400 text-lg mb-10 max-w-2xl mx-auto">Notre équipe est à votre disposition pour répondre à toutes vos questions.</p>
          <div className="flex flex-wrap gap-4 sm:gap-6 justify-center">
            {shop.whatsapp_number && (
              <a href={`https://wa.me/${shop.whatsapp_number.replace(/[^0-9]/g, "")}`} target="_blank" rel="noopener noreferrer">
                <Button size="lg" className="rounded-full gap-2 h-14 px-8 text-base font-bold hover:scale-105 transition-transform" style={{ backgroundColor: "#25D366", color: "white" }}>
                  <MessageCircle className="h-5 w-5" /> Discuter sur WhatsApp
                </Button>
              </a>
            )}
            {shop.phone_number && (
              <a href={`tel:${shop.phone_number}`}>
                <Button size="lg" variant="outline" className="rounded-full gap-2 h-14 px-8 text-base font-bold border-gray-700 hover:bg-gray-800 hover:text-white">
                  <Phone className="h-5 w-5" /> {shop.phone_number}
                </Button>
              </a>
            )}
            {shop.email && (
              <a href={`mailto:${shop.email}`}>
                <Button size="lg" variant="outline" className="rounded-full gap-2 h-14 px-8 text-base font-bold border-gray-700 hover:bg-gray-800 hover:text-white">
                  <Mail className="h-5 w-5" /> Nous écrire
                </Button>
              </a>
            )}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer
        className="border-t border-gray-100 py-10 px-4 bg-white"
        style={themeConfig.footer_custom ? {
          backgroundColor: themeConfig.footer_bg || "#ffffff",
          color: themeConfig.footer_text || "#6b7280",
          borderColor: themeConfig.footer_border === false ? "transparent" : themeConfig.footer_border_color || "#f3f4f6",
        } : undefined}
      >
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6 text-sm">
          <div className="flex items-center gap-3">
            {shop.logo_url ? <img src={thumbUrl(shop.logo_url, 128)} alt="" className="h-8 w-8 rounded-lg grayscale opacity-70" /> : <Store className="h-5 w-5 opacity-70" style={{ color: primaryColor }} />}
            <span className="font-semibold opacity-80">© {new Date().getFullYear()} {tShop.business_name}</span>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-2 opacity-80">
            {shop.city && <><MapPin className="h-4 w-4" /> {shop.city}, {shop.country || "Côte d'Ivoire"} <span className="mx-2 opacity-30">|</span></>}
            Créé avec <a href="https://ecomfy.cloud" target="_blank" rel="noopener noreferrer" className="font-extrabold text-foreground ml-1 hover:underline decoration-2 underline-offset-2">Ecomfy</a>
          </div>
        </div>
      </footer>

      {/* Product Detail Dialog */}
      <Dialog open={!!selectedProduct} onOpenChange={(open) => { if (!open) { setSelectedProduct(null); setVariantChoice({}); } }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          {selectedProduct && (
            <>
              <div className="aspect-square rounded-xl overflow-hidden bg-muted mb-4">
                {selectedProduct.product_images?.[0] ? (
                  <img src={thumbUrl(selectedProduct.product_images[0].image_url, 1200)} alt={selectedProduct.name} loading="lazy" decoding="async" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center"><Store className="h-16 w-16 text-muted-foreground/30" /></div>
                )}
              </div>
              {selectedProduct.product_images && selectedProduct.product_images.length > 1 && (
                <div className="flex gap-2 mb-4 overflow-x-auto">
                  {selectedProduct.product_images.map((img, i) => (
                    <img key={img.id} src={thumbUrl(img.image_url, 128)} alt="" loading="lazy" decoding="async" width={64} height={64} className="h-16 w-16 rounded-lg object-cover border-2 border-transparent hover:border-primary cursor-pointer" />
                  ))}
                </div>
              )}
              <div className="space-y-3">
                <div className="flex items-start justify-between">
                  <div>
                    <h2 className="text-2xl font-bold">{selectedProduct.name}</h2>
                    <Badge variant="outline" className="mt-1">{selectedProduct.category}</Badge>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold" style={{ color: primaryColor }}>{formatPrice(selectedProduct.price)} FCFA</p>
                    {selectedProduct.compare_at_price && selectedProduct.compare_at_price > selectedProduct.price && (
                      <p className="text-sm text-muted-foreground line-through">{formatPrice(selectedProduct.compare_at_price)} FCFA</p>
                    )}
                  </div>
                </div>
                {selectedProduct.description && <p className="text-muted-foreground leading-relaxed">{selectedProduct.description}</p>}
                {selectedProduct.short_description && !selectedProduct.description && <p className="text-muted-foreground">{selectedProduct.short_description}</p>}
                {Array.isArray(selectedProduct.variants) && selectedProduct.variants.filter((g: any) => g?.name && Array.isArray(g?.options) && g.options.length > 0).length > 0 && (
                  <div className="space-y-3 pt-1">
                    {selectedProduct.variants
                      .filter((g: any) => g?.name && Array.isArray(g?.options) && g.options.length > 0)
                      .map((group: any, gi: number) => (
                        <div key={gi} className="space-y-1.5">
                          <Label className="text-xs font-semibold">
                            {group.name} <span className="text-destructive">*</span>
                          </Label>
                          <div className="flex flex-wrap gap-2">
                            {group.options.map((opt: string) => {
                              const active = variantChoice[group.name] === opt;
                              return (
                                <button
                                  key={opt}
                                  type="button"
                                  onClick={() => setVariantChoice({ ...variantChoice, [group.name]: opt })}
                                  className={`px-3 py-1.5 rounded-lg border-2 text-sm font-medium transition-all ${active ? "text-primary-foreground" : "bg-background hover:bg-muted"}`}
                                  style={active ? { backgroundColor: primaryColor, borderColor: primaryColor } : { borderColor: "hsl(var(--border))" }}
                                >
                                  {opt}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                  </div>
                )}
                <div className="flex gap-3 pt-2">
                  {shop._isPreview ? (
                    <div className="flex-1 rounded-xl border-2 border-dashed px-4 py-3 text-center text-xs text-muted-foreground" style={{ borderColor: primaryColor + "40" }}>
                      🔒 Commande disponible après activation de la boutique
                    </div>
                  ) : (
                    (() => {
                      const groups = Array.isArray(selectedProduct.variants) ? selectedProduct.variants.filter((g: any) => g?.name && Array.isArray(g?.options) && g.options.length > 0) : [];
                      const missing = groups.filter((g: any) => !variantChoice[g.name]);
                      const ready = missing.length === 0;
                      return (
                        <Button
                          className="flex-1 rounded-xl gap-2 h-12 text-base"
                          style={{ backgroundColor: primaryColor, opacity: ready ? 1 : 0.6 }}
                          disabled={!ready}
                          onClick={() => { addToCart(selectedProduct, groups.length > 0 ? variantChoice : null); setSelectedProduct(null); setVariantChoice({}); }}
                        >
                          <ShoppingCart className="h-5 w-5" />
                          {ready ? "Ajouter au panier" : `Choisir : ${missing.map((m: any) => m.name).join(", ")}`}
                        </Button>
                      );
                    })()
                  )}
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Checkout Dialog */}
      <Dialog open={checkoutOpen} onOpenChange={(open) => { setCheckoutOpen(open); if (!open) { setCheckoutStep("cart"); setOrderSuccess(false); } }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl p-0">
          {orderSuccess ? (
            <div className="text-center py-12 px-6">
              <div className="h-20 w-20 mx-auto rounded-full flex items-center justify-center mb-6" style={{ backgroundColor: primaryColor + "15" }}>
                <CheckCircle2 className="h-10 w-10" style={{ color: primaryColor }} />
              </div>
              <h2 className="text-2xl font-bold mb-2">Commande confirmée ! 🎉</h2>
              <p className="text-muted-foreground mb-6">Le vendeur vous contactera sous peu pour finaliser votre commande.</p>
              <Button onClick={() => { setCheckoutOpen(false); setOrderSuccess(false); setCheckoutStep("cart"); }} className="rounded-xl" style={{ backgroundColor: primaryColor }}>
                Continuer mes achats
              </Button>
            </div>
          ) : (
            <>
              {/* Step Indicator */}
              <div className="px-6 pt-6 pb-2">
                <div className="flex items-center justify-between mb-1">
                  {[
                    { key: "cart", label: "Panier", icon: ShoppingBag },
                    { key: "info", label: "Livraison", icon: Truck },
                    { key: "confirm", label: "Paiement", icon: CreditCard },
                  ].map((step, i) => {
                    const steps = ["cart", "info", "confirm"];
                    const currentIdx = steps.indexOf(checkoutStep);
                    const stepIdx = i;
                    const isActive = stepIdx === currentIdx;
                    const isDone = stepIdx < currentIdx;
                    return (
                      <div key={step.key} className="flex items-center flex-1">
                        <div className="flex flex-col items-center flex-1">
                          <div
                            className={`h-9 w-9 rounded-full flex items-center justify-center mb-1 transition-colors ${!isDone && !isActive ? "bg-muted text-muted-foreground" : "text-primary-foreground"}`}
                            style={isDone || isActive ? { backgroundColor: primaryColor } : {}}
                          >
                            {isDone ? <CheckCircle2 className="h-4 w-4" /> : <step.icon className="h-4 w-4" />}
                          </div>
                          <span className={`text-[11px] font-medium ${isActive ? "text-foreground" : "text-muted-foreground"}`}>{step.label}</span>
                        </div>
                        {i < 2 && <div className={`h-0.5 flex-1 mx-1 rounded-full mt-[-14px] ${isDone ? "" : "bg-muted"}`} style={isDone ? { backgroundColor: primaryColor } : {}} />}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Step: Cart */}
              {checkoutStep === "cart" && (
                <div className="px-6 pb-6">
                  {cart.length === 0 ? (
                    <div className="text-center py-12">
                      <ShoppingBag className="h-16 w-16 mx-auto text-muted-foreground/30 mb-4" />
                      <p className="font-medium">Votre panier est vide</p>
                      <p className="text-sm text-muted-foreground mt-1">Parcourez nos produits et ajoutez vos coups de cœur</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {cart.map(item => (
                        <div key={cartKey(item.product.id, item.selectedVariants)} className="flex items-center gap-3 p-3 bg-muted/30 rounded-xl">
                          <div className="h-16 w-16 bg-muted rounded-xl overflow-hidden flex-shrink-0">
                            {item.product.product_images?.[0] && <img src={thumbUrl(item.product.product_images[0].image_url, 128)} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold truncate">{item.product.name}</p>
                            {item.selectedVariants && Object.keys(item.selectedVariants).length > 0 && (
                              <p className="text-[11px] text-muted-foreground truncate">
                                {Object.entries(item.selectedVariants).map(([k, v]) => `${k}: ${v}`).join(" · ")}
                              </p>
                            )}
                            <p className="text-sm font-bold" style={{ color: primaryColor }}>{formatPrice(item.product.price)} FCFA</p>
                          </div>
                          <div className="flex items-center gap-1">
                            <Button variant="outline" size="icon" className="h-8 w-8 rounded-lg" onClick={() => updateQuantity(cartKey(item.product.id, item.selectedVariants), -1)}><Minus className="h-3 w-3" /></Button>
                            <span className="text-sm w-8 text-center font-semibold">{item.quantity}</span>
                            <Button variant="outline" size="icon" className="h-8 w-8 rounded-lg" onClick={() => updateQuantity(cartKey(item.product.id, item.selectedVariants), 1)}><Plus className="h-3 w-3" /></Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg ml-1" onClick={() => removeFromCart(cartKey(item.product.id, item.selectedVariants))}><Trash2 className="h-3 w-3 text-destructive" /></Button>
                          </div>
                        </div>
                      ))}
                      <div className="border-t pt-3 mt-3">
                        <div className="flex justify-between items-center">
                          <span className="font-semibold text-lg">Total</span>
                          <span className="font-bold text-xl" style={{ color: primaryColor }}>{formatPrice(cartTotal)} FCFA</span>
                        </div>
                      </div>
                      <Button className="w-full h-12 rounded-xl text-base font-semibold gap-2" style={{ backgroundColor: primaryColor }} onClick={() => setCheckoutStep("info")}>
                        Continuer <ArrowRight className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </div>
              )}

              {/* Step: Info + Paiement + Confirmation (vue compacte) */}
              {(checkoutStep === "info" || checkoutStep === "confirm") && (() => {
                const cf: any[] = shop.checkout_fields || [];
                const enabled = (id: string) => {
                  const f = cf.find((x: any) => x.id === id);
                  return f ? !!f.enabled : ["first_name","phone","city","address"].includes(id);
                };
                const required = (id: string) => {
                  const f = cf.find((x: any) => x.id === id);
                  return f ? !!f.required : ["first_name","phone","city"].includes(id);
                };
                const showFullName = enabled("first_name") && enabled("last_name");
                const showFirstOnly = enabled("first_name") && !enabled("last_name");
                const nameLabel = showFullName ? "Nom complet" : showFirstOnly ? "Prénom" : enabled("last_name") ? "Nom" : "Nom";
                const canSubmit =
                  (!enabled("first_name") || !required("first_name") || !!customerInfo.name) &&
                  (!enabled("phone") || (!required("phone") && !customerInfo.phone) || isValidFullPhone(customerInfo.phone)) &&
                  (!enabled("city") || !required("city") || !!customerInfo.city) &&
                  (!enabled("city") || !containsDigits(customerInfo.city)) &&
                  (!enabled("address") || !required("address") || !!customerInfo.address);
                return (
                <div className="px-4 sm:px-6 pb-4 sm:pb-6 space-y-3">
                  <button onClick={() => setCheckoutStep("cart")} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors">
                    <ArrowLeft className="h-3.5 w-3.5" /> Retour au panier
                  </button>
                  {/* Résumé compact */}
                  <div className="bg-muted/30 rounded-xl p-3 space-y-1 text-xs">
                    {cart.map(item => (
                      <div key={cartKey(item.product.id, item.selectedVariants)} className="flex justify-between gap-2">
                        <span className="text-muted-foreground truncate">
                          {item.product.name}
                          {item.selectedVariants && Object.keys(item.selectedVariants).length > 0 && (
                            <span className="opacity-70"> ({Object.entries(item.selectedVariants).map(([k, v]) => `${k}: ${v}`).join(", ")})</span>
                          )}
                          {" × "}{item.quantity}
                        </span>
                        <span className="font-medium">{formatPrice(item.product.price * item.quantity)} FCFA</span>
                      </div>
                    ))}
                    <div className="border-t pt-1.5 mt-1.5 flex justify-between font-bold text-sm">
                      <span>Total</span>
                      <span style={{ color: primaryColor }}>{formatPrice(cartTotal)} FCFA</span>
                    </div>
                  </div>
                  {/* Infos client */}
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <User className="h-3.5 w-3.5" style={{ color: primaryColor }} />
                      <h4 className="font-bold text-xs">Vos informations</h4>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      {enabled("first_name") && (
                        <div className="space-y-0.5 col-span-2">
                          <Label className="text-[11px] text-muted-foreground">{nameLabel} {required("first_name") && "*"}</Label>
                          <Input value={customerInfo.name} onChange={(e) => setCustomerInfo({ ...customerInfo, name: e.target.value })} placeholder={showFirstOnly ? "Jean" : "Jean Kouassi"} className="rounded-lg h-10 text-sm" />
                        </div>
                      )}
                      {enabled("phone") && (
                        <div className="space-y-0.5 col-span-2">
                          <Label className="text-[11px] text-muted-foreground">Téléphone {required("phone") && "*"}</Label>
                          <PhoneInput
                            value={customerInfo.phone}
                            onChange={(v) => setCustomerInfo({ ...customerInfo, phone: v })}
                            defaultCountryHint={shop?.country}
                            required={required("phone")}
                          />
                        </div>
                      )}
                      {enabled("email") && (
                        <div className="space-y-0.5 col-span-2">
                          <Label className="text-[11px] text-muted-foreground">Email {required("email") && "*"}</Label>
                          <Input type="email" value={customerInfo.email} onChange={(e) => setCustomerInfo({ ...customerInfo, email: e.target.value })} placeholder="jean@email.com" className="rounded-lg h-10 text-sm" />
                        </div>
                      )}
                      {enabled("city") && (
                        <div className="space-y-0.5 col-span-2 sm:col-span-1">
                          <Label className="text-[11px] text-muted-foreground">Ville {required("city") && "*"}</Label>
                          <Input value={customerInfo.city} onChange={(e) => {
                            const raw = e.target.value;
                            const cleaned = stripDigits(raw);
                            setCustomerInfo({ ...customerInfo, city: cleaned });
                            if (containsDigits(raw)) setCityError("La ville ne doit pas contenir de chiffres.");
                            else if (cityError) setCityError("");
                          }} placeholder="Abidjan" className={`rounded-lg h-10 text-sm ${cityError ? "border-red-500 focus-visible:ring-red-500" : ""}`} />
                          {cityError && <p className="text-[11px] text-red-500">{cityError}</p>}
                        </div>
                      )}
                      {enabled("address") && (
                        <div className={`space-y-0.5 col-span-2 ${enabled("city") ? "sm:col-span-1" : ""}`}>
                          <Label className="text-[11px] text-muted-foreground">Adresse {required("address") && "*"}</Label>
                          <Input value={customerInfo.address} onChange={(e) => setCustomerInfo({ ...customerInfo, address: e.target.value })} placeholder="Cocody, Riviera 3" className="rounded-lg h-10 text-sm" />
                        </div>
                      )}
                    </div>
                  </div>
                  {/* Paiement */}
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <CreditCard className="h-4 w-4" style={{ color: primaryColor }} />
                      <h4 className="font-bold text-xs">Mode de paiement</h4>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { value: "mobile_money", label: "Mobile Money", icon: "📱" },
                        { value: "cash_on_delivery", label: "À la livraison", icon: "💵" },
                      ].map(method => (
                        <button
                          key={method.value}
                          onClick={() => setCustomerInfo({ ...customerInfo, paymentMethod: method.value })}
                          className={`flex items-center gap-2 p-2.5 rounded-lg border-2 text-left transition-all ${customerInfo.paymentMethod === method.value ? "shadow-sm" : "border-muted"}`}
                          style={customerInfo.paymentMethod === method.value ? { borderColor: primaryColor } : {}}
                        >
                          <span className="text-lg">{method.icon}</span>
                          <p className="font-semibold text-xs">{method.label}</p>
                          {customerInfo.paymentMethod === method.value && <CheckCircle2 className="h-4 w-4 ml-auto flex-shrink-0" style={{ color: primaryColor }} />}
                        </button>
                      ))}
                    </div>
                  </div>
                  <Button className="w-full h-11 rounded-xl text-sm font-semibold gap-2" style={{ backgroundColor: primaryColor }} onClick={placeOrder} disabled={orderLoading || !canSubmit}>
                    {orderLoading ? "Traitement..." : <><ShoppingCart className="h-5 w-5" /> Confirmer · {formatPrice(cartTotal)} FCFA</>}
                  </Button>
                </div>
                );
              })()}
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Chatbot */}
      {shop.chatbot_enabled && (
        <>
          <button
            onClick={() => setChatOpen(!chatOpen)}
            className="fixed bottom-6 right-6 h-14 w-14 rounded-2xl shadow-xl flex items-center justify-center z-50 text-primary-foreground transition-transform hover:scale-110"
            style={{ backgroundColor: primaryColor }}
          >
            {chatOpen ? <X className="h-6 w-6" /> : <MessageCircle className="h-6 w-6" />}
          </button>

          {chatOpen && (
            <div className="fixed bottom-24 right-6 w-80 md:w-96 bg-background border rounded-2xl shadow-2xl z-50 flex flex-col overflow-hidden" style={{ height: "420px" }}>
              <div className="px-4 py-3 border-b text-primary-foreground font-semibold flex items-center gap-2" style={{ backgroundColor: primaryColor }}>
                <MessageCircle className="h-5 w-5" />
                Assistant {shop.business_name}
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {chatMessages.map((msg, i) => (
                  <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                    <div className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm ${msg.role === "user" ? "text-primary-foreground rounded-br-md" : "bg-muted rounded-bl-md"}`} style={msg.role === "user" ? { backgroundColor: primaryColor } : {}}>
                      {msg.content}
                    </div>
                  </div>
                ))}
                {chatLoading && (
                  <div className="flex justify-start">
                    <div className="bg-muted rounded-2xl rounded-bl-md px-4 py-2.5 text-sm">
                      <div className="flex gap-1"><div className="h-2 w-2 rounded-full bg-muted-foreground/50 animate-bounce" /><div className="h-2 w-2 rounded-full bg-muted-foreground/50 animate-bounce" style={{ animationDelay: "0.1s" }} /><div className="h-2 w-2 rounded-full bg-muted-foreground/50 animate-bounce" style={{ animationDelay: "0.2s" }} /></div>
                    </div>
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>
              <div className="p-3 border-t flex gap-2">
                <Input value={chatInput} onChange={(e) => setChatInput(e.target.value)} placeholder="Votre message..." onKeyDown={(e) => e.key === "Enter" && sendChatMessage()} className="flex-1 rounded-xl" />
                <Button size="icon" onClick={sendChatMessage} disabled={chatLoading} className="rounded-xl" style={{ backgroundColor: primaryColor }}>
                  <Send className="h-4 w-4 text-primary-foreground" />
                </Button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Floating Cart Button - Mobile */}
      {!shop._isPreview && cartCount > 0 && !checkoutOpen && (
        <div className="fixed bottom-6 left-6 right-20 md:hidden z-40">
          <Button 
            className="w-full h-14 rounded-2xl shadow-xl text-base font-semibold gap-2"
            style={{ backgroundColor: primaryColor }}
            onClick={() => { setCheckoutOpen(true); setOrderSuccess(false); }}
          >
            <ShoppingBag className="h-5 w-5" />
            Voir le panier · {formatPrice(cartTotal)} FCFA
            <Badge className="ml-auto bg-primary-foreground/20 text-primary-foreground">{cartCount}</Badge>
          </Button>
        </div>
      )}

      {/* Social Proof Notifications + AI Assistant (deferred for faster LCP) */}
      {deferredReady && (
        <Suspense fallback={null}>
          <SocialProofNotification
            shopId={shop.id}
            enabled={shop.social_proof_enabled || false}
            shopName={shop.business_name}
          />
          <ShopAIAssistant
            shopId={shop.id}
            shopName={shop.business_name}
            primaryColor={shop.primary_color}
            secondaryColor={shop.secondary_color}
          />
        </Suspense>
      )}
    </div>
    </>
  );
};

// Product Card Component
function ProductCard({ product, primaryColor, onAddToCart, onView, formatPrice, eager }: {
  product: Product; primaryColor: string; onAddToCart: (p: Product) => void; onView: (p: Product) => void; formatPrice: (n: number) => string; eager?: boolean;
}) {
  // Warm up the ProductView chunk and its images on hover/touch so navigation
  // feels instant. Idempotent — repeated calls are cheap.
  const prefetchProduct = () => {
    try {
      import("@/pages/ProductView");
      const url = product.product_images?.[0]?.image_url;
      if (url) {
        const img = new Image();
        img.decoding = "async";
        img.src = url;
      }
    } catch {}
  };
  return (
    <Card
      className="overflow-hidden group cursor-pointer border-0 shadow-sm hover:shadow-xl transition-all duration-300"
      onClick={() => onView(product)}
      onMouseEnter={prefetchProduct}
      onTouchStart={prefetchProduct}
    >
      <div className="aspect-square bg-muted relative overflow-hidden">
        {product.product_images?.[0] ? (
          <img
            src={thumbUrl(product.product_images[0].image_url, 1200)}
            alt={product.name}
            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
            loading={eager ? "eager" : "lazy"}
            decoding="async"
            width={400}
            height={400}
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
            {...(eager ? { fetchPriority: "high" as any } : {})}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center"><Store className="h-8 w-8 sm:h-10 sm:w-10 text-muted-foreground/30" /></div>
        )}
        {product.compare_at_price && product.compare_at_price > product.price && (
          <Badge className="absolute top-1.5 left-1.5 sm:top-2 sm:left-2 bg-destructive text-destructive-foreground rounded-lg font-bold text-[10px] sm:text-xs px-1.5 sm:px-2">
            -{Math.round((1 - product.price / product.compare_at_price) * 100)}%
          </Badge>
        )}
        {product.is_digital && <Badge className="absolute top-1.5 right-1.5 sm:top-2 sm:right-2 bg-purple-600 rounded-lg text-[10px] sm:text-xs">Digital</Badge>}
      </div>
      <div className="p-2.5 sm:p-3 md:p-4">
        <h3 className="font-semibold text-xs sm:text-sm line-clamp-2 mb-0.5 sm:mb-1">{product.name}</h3>
        {product.short_description && <p className="text-[10px] sm:text-xs text-muted-foreground line-clamp-1 mb-1.5 sm:mb-2 hidden sm:block">{product.short_description}</p>}
        <div className="flex items-end justify-between gap-1 sm:gap-2">
          <div className="min-w-0">
            <span className="font-bold text-sm sm:text-base block truncate" style={{ color: primaryColor }}>{formatPrice(product.price)}</span>
            <span className="text-[10px] sm:text-xs text-muted-foreground">FCFA</span>
            {product.compare_at_price && product.compare_at_price > product.price && (
              <span className="text-[10px] sm:text-xs text-muted-foreground line-through ml-1 hidden sm:inline">{formatPrice(product.compare_at_price)}</span>
            )}
          </div>
          <Button 
            size="icon" 
            className="h-8 w-8 sm:h-9 sm:w-9 rounded-xl flex-shrink-0" 
            style={{ backgroundColor: primaryColor }}
            onClick={(e) => { e.stopPropagation(); onAddToCart(product); }}
          >
            <Plus className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-primary-foreground" />
          </Button>
        </div>
      </div>
    </Card>
  );
}

export default ShopView;
