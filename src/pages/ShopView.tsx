import { useEffect, useState, useRef, lazy, Suspense, type CSSProperties } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { SmartVariantSelector } from "@/components/shop/SmartVariantSelector";
import { cleanSelectedVariants, missingVariantGroups, usableVariantGroups } from "@/lib/productVariants";
import { htmlToPlainText } from "@/lib/sanitizeProductHtml";
import { createPublicOrder } from "@/services/publicOrderService";
import { PromoCodeField, type AppliedPromo } from "@/components/shop/PromoCodeField";
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
import { ShoppingCart, Plus, Minus, Trash2, MessageCircle, X, Store, Phone, Search, Star, MapPin, Mail, ShoppingBag, ArrowRight, CheckCircle2, ArrowLeft, User, Truck, CreditCard, ShieldCheck, Flame } from "lucide-react";
import {
  buildCatalogView, categoryCounts, discountPercent, lowStockCount, matchesQuery, pickFeatured,
  restoreCart, serializeCart, SORT_OPTIONS, type SortKey,
} from "@/lib/shopCatalog";
import { initShopPixels, trackEvent } from "@/lib/tracking";
import { ecomfyPayApi } from "@/lib/ecomfyPay";
import { ShopReviewBar } from "@/components/shop/ShopReviewBar";
import { ShopLanguageSelector } from "@/components/shop/ShopLanguageSelector";
import { useShopTranslations } from "@/hooks/useShopTranslation";
import { isRtlLang } from "@/lib/shopLanguages";
import { PhoneInput } from "@/components/shop/PhoneInput";
import { isValidFullPhone, normalizeToE164, parseFullPhone } from "@/lib/phoneCountries";
import { containsDigits, stripDigits } from "@/lib/utils";
import { Helmet } from "react-helmet";
import { cacheGet, cacheSet, cacheInvalidate, cacheIsFresh, shopKey, shopProductsKey } from "@/lib/shopCache";
import { useDeferredMount } from "@/lib/useDeferredMount";
import { readableTextOn } from "@/lib/productAppearance";
import { ShopThemeRenderer } from "@/lib/shopThemes/ShopThemeRenderer";
import { HomepageRenderer } from "@/components/shop/HomepageBuilder/HomepageRenderer";

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
  const [searchParams] = useSearchParams();
  const classicOptOut = searchParams.get("classic") === "1" || searchParams.get("classic") === "true";
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
  const [promo, setPromo] = useState<AppliedPromo | null>(null);
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [orderLoading, setOrderLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("relevance");
  const [suggestOpen, setSuggestOpen] = useState(false);
  const [galleryIndex, setGalleryIndex] = useState(0);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [variantChoice, setVariantChoice] = useState<Record<string, string>>({});
  // Produits à stock 0 dont le marchand a désactivé « Autoriser les commandes au-delà du stock » (réglage lu dans
  // product_theme_settings). Sans cela, l'ajout rapide depuis la grille contournait le blocage de la fiche produit.
  const [soldOutIds, setSoldOutIds] = useState<Set<string>>(new Set());
  const [orderSuccess, setOrderSuccess] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  // Progressive rendering: only render a window of products to keep first paint fast.
  const PAGE_SIZE = 12;
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const loadMoreRef = useRef<HTMLDivElement | null>(null);

  const [customerInfo, setCustomerInfo] = useState({
    name: "", phone: "", email: "", address: "", city: "", paymentMethod: "cash_on_delivery",
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
  const newAbandonSessionId = () =>
    (crypto as any).randomUUID ? crypto.randomUUID() : `s_${Date.now()}_${Math.random()}`;
  useEffect(() => {
    if (!shop?.id) return;
    const key = `vp_abandon_session_${shop.id}`;
    let sid: string | null = null;
    try { sid = localStorage.getItem(key); } catch {}
    if (!sid) {
      sid = newAbandonSessionId();
      try { localStorage.setItem(key, sid); } catch {}
    }
    sessionIdRef.current = sid;
  }, [shop?.id]);

  // Debounced upsert when visitor enters checkout info without finalising
  useEffect(() => {
    if (!shop?.id || shop?._isPreview) return;
    if (!sessionIdRef.current) return;
    if (cart.length === 0) {
      // Panier vidé : on retire le panier abandonné déjà enregistré pour cette session.
      if (abandonedSavedRef.current) {
        abandonedSavedRef.current = false;
        (supabase as any)
          .rpc("discard_abandoned_cart", { _shop_id: shop.id, _session_id: sessionIdRef.current })
          .then(() => {}, () => {});
      }
      return;
    }
    // Ne suivre que des coordonnées exploitables : téléphone valide ou e-mail plausible
    // (évite d'enregistrer "0" ou "+22" saisis à moitié).
    const phoneOk = !!customerInfo.phone && isValidFullPhone(customerInfo.phone);
    const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(customerInfo.email || "");
    if (!phoneOk && !emailOk) return;

    const t = setTimeout(async () => {
      try {
        // Prix, noms et totaux sont recalculés par le serveur ; on n'envoie que l'identité des lignes.
        const items = cart.map(i => ({
          product_id: i.product.id,
          quantity: i.quantity,
          selected_variants: i.selectedVariants && Object.keys(i.selectedVariants).length > 0 ? i.selectedVariants : null,
        }));
        const itemsCount = cart.reduce((s, i) => s + i.quantity, 0);
        const total = cart.reduce((s, i) => s + i.product.price * i.quantity, 0);
        const _country = (() => {
          if (!customerInfo.phone) return null;
          const n = normalizeToE164(customerInfo.phone, shop?.country) || customerInfo.phone;
          return parseFullPhone(n).country?.name || null;
        })();
        const { error: rpcError } = await (supabase as any).rpc("upsert_abandoned_cart", {
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
        if (!rpcError) abandonedSavedRef.current = true;
      } catch (_) { /* silent */ }
    }, 1200);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shop?.id, customerInfo.name, customerInfo.phone, customerInfo.email, customerInfo.city, customerInfo.address, customerInfo.paymentMethod, cart]);

  useEffect(() => { fetchShop(); }, [slug, id]);

  useEffect(() => { setGalleryIndex(0); }, [selectedProduct?.id]);

  // Panier conservé d'une visite à l'autre (et au retour d'une fiche produit) : seules les lignes sont stockées,
  // les prix viennent toujours des produits chargés puis du serveur.
  const [cartHydrated, setCartHydrated] = useState(false);
  useEffect(() => {
    if (cartHydrated || !shop?.id || products.length === 0) return;
    if (!shop._isPreview) {
      try {
        const raw = localStorage.getItem(`vp_cart_${shop.id}`);
        const restored = raw ? restoreCart(JSON.parse(raw), products) : [];
        if (restored.length > 0) setCart(prev => (prev.length > 0 ? prev : restored));
      } catch { /* stockage indisponible ou contenu corrompu : on repart d'un panier vide */ }
    }
    setCartHydrated(true);
  }, [shop?.id, shop?._isPreview, products, cartHydrated]);
  useEffect(() => {
    if (!cartHydrated || !shop?.id || shop._isPreview) return;
    try {
      const key = `vp_cart_${shop.id}`;
      if (cart.length > 0) localStorage.setItem(key, JSON.stringify(serializeCart(cart)));
      else localStorage.removeItem(key);
    } catch { /* navigation privée : le panier reste en mémoire */ }
  }, [cart, cartHydrated, shop?.id, shop?._isPreview]);
  // Quand le catalogue est rafraîchi, les lignes du panier reprennent les données à jour (nom, prix, image).
  useEffect(() => {
    if (!cartHydrated) return;
    const byId = new Map(products.map(p => [p.id, p]));
    setCart(prev => (prev.some(i => byId.has(i.product.id) && byId.get(i.product.id) !== i.product)
      ? prev.map(i => ({ ...i, product: byId.get(i.product.id) ?? i.product }))
      : prev));
  }, [products, cartHydrated]);

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
      productsQuery = productsQuery.or("is_published.eq.true,is_published.is.null");
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
            page_path: window.location.pathname,
            url_search: window.location.search
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

    // ---- Tracking pixels (skip in preview/owner mode) ----
    if (!shopData._isPreview) {
      initShopPixels(shopData);
      trackEvent(shopData, "PageView");
    }
  };

  // Apply translation overlay on shop + products
  const tShop = shop ? mergeShop(shop) : shop;
  const tProducts = products.map((p) => mergeProduct(p as any));

  const categoryList = categoryCounts(tProducts);
  const { items: effectiveFeaturedProducts, isCurated: hasCuratedFeatured } = pickFeatured(tProducts);
  const catalog = buildCatalogView({
    products: tProducts,
    featured: effectiveFeaturedProducts,
    category: selectedCategory,
    query: searchQuery,
    sort: sortKey,
    featuredEnabled: shop?.theme_config?.featured_enabled !== false,
    showAllOnHome: shop?.theme_config?.show_all_products_on_home === true,
  });
  const filteredProducts = catalog.items;
  const visibleProducts = filteredProducts.slice(0, visibleCount);
  const hasMore = filteredProducts.length > visibleCount;
  // Suggestions de la barre de recherche : les 5 premiers résultats, sans attendre l'appui sur Entrée.
  const suggestions = searchQuery.trim().length >= 2
    ? tProducts.filter(p => matchesQuery(p, searchQuery)).slice(0, 5)
    : [];

  useEffect(() => {
    const candidates = products
      .filter(p => p.stock_quantity !== null && p.stock_quantity !== undefined && Number(p.stock_quantity) <= 0)
      .map(p => p.id);
    if (candidates.length === 0) {
      setSoldOutIds(prev => (prev.size === 0 ? prev : new Set()));
      return;
    }
    let cancelled = false;
    (async () => {
      const blocked = new Set<string>();
      for (let i = 0; i < candidates.length; i += 80) {
        const { data } = await (supabase as any)
          .from("product_theme_settings")
          .select("product_id, custom_css_settings")
          .in("product_id", candidates.slice(i, i + 80));
        (data || []).forEach((row: any) => {
          if (row?.custom_css_settings?.allow_out_of_stock_orders === false) blocked.add(row.product_id);
        });
      }
      if (!cancelled) setSoldOutIds(blocked);
    })();
    return () => { cancelled = true; };
  }, [products]);

  // Reset window whenever the active filter / search changes.
  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [selectedCategory, searchQuery, sortKey, products.length]);

  // Une recherche ou un filtre doit montrer ses résultats : on amène le catalogue à l'écran à la première saisie.
  const wasFilteringRef = useRef(false);
  useEffect(() => {
    if (catalog.isFiltering && !wasFilteringRef.current) {
      const t = setTimeout(() => {
        const el = document.getElementById("products");
        if (!el) return;
        const top = el.getBoundingClientRect().top;
        if (top < 0 || top > window.innerHeight * 0.6) window.scrollTo({ top: window.scrollY + top - 120, behavior: "smooth" });
      }, 250);
      wasFilteringRef.current = true;
      return () => clearTimeout(t);
    }
    if (!catalog.isFiltering) wasFilteringRef.current = false;
  }, [catalog.isFiltering]);

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
    if (soldOutIds.has(product.id)) {
      toast({ title: "Rupture de stock", description: "Ce produit n'est plus disponible à la commande.", variant: "destructive" });
      return;
    }
    if (missingVariantGroups(product.variants, selectedVariants).length > 0) {
      setVariantChoice({});
      setSelectedProduct(product);
      return;
    }
    // Les clés techniques du sélecteur (« Couleur_main », « Couleur_sub ») ne vont ni dans le panier ni dans la commande.
    const sv = cleanSelectedVariants(selectedVariants);
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
  // Aperçu : le serveur recalcule la remise et le total à la création de la commande.
  const promoDiscount = promo ? Math.min(promo.discount, cartTotal) : 0;
  const payableTotal = cartTotal - promoDiscount;
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
      // H10 : prix, total, commission, numéro et statuts sont décidés par le serveur (une seule transaction).
      const created = await createPublicOrder({
        shopId: shop.id,
        customerName: customerInfo.name,
        customerPhone: normalizedPhone,
        customerEmail: customerInfo.email,
        customerAddress: customerInfo.address,
        customerCity: customerInfo.city,
        customerCountry: detectedCountry,
        paymentMethod: customerInfo.paymentMethod,
        promoCode: promo?.code,
        items: cart.map(item => ({
          product_id: item.product.id,
          quantity: item.quantity,
          selected_variants: cleanSelectedVariants(item.selectedVariants),
        })),
      });
      const order = { id: created.orderId, order_number: created.orderNumber };
      const orderTotal = created.total;
      if (promo && !created.promoApplied) {
        toast({ title: "Code promo non appliqué", description: created.promoMessage || "Le code n'a pas pu être appliqué à cette commande.", variant: "destructive" });
      }
      setPromo(null);
      // Mark abandoned cart as converted (if any was tracked)
      if (sessionIdRef.current && shop?.id) {
        try {
          await (supabase as any).rpc("mark_abandoned_cart_converted", {
            _shop_id: shop.id,
            _session_id: sessionIdRef.current,
          });
        } catch (_) {}
        // Nouvelle session pour le prochain panier : l'ancienne est close côté serveur.
        abandonedSavedRef.current = false;
        const nextSid = newAbandonSessionId();
        sessionIdRef.current = nextSid;
        try { localStorage.setItem(`vp_abandon_session_${shop.id}`, nextSid); } catch {}
      }
      const trackingPayload = {
        value: orderTotal,
        order_id: order.order_number,
        content_ids: cart.map((c) => c.product.id),
        contents: cart.map((c) => ({ id: c.product.id, quantity: c.quantity, item_price: c.product.price })),
        num_items: cart.reduce((s, c) => s + c.quantity, 0),
        email: customerInfo.email,
        phone: normalizedPhone,
        first_name: customerInfo.name,
        city: customerInfo.city,
      };

      if (customerInfo.paymentMethod === "mobile_money") {
        trackEvent(shop, "InitiateCheckout", trackingPayload);
        // Même flux que la fiche produit : sans cet appel, la commande restait « en attente » et le client voyait
        // « commande confirmée » sans avoir payé. Le Purchase Meta part du webhook, à l'encaissement.
        const payRes = await ecomfyPayApi.initiateCustomerPayment({
          shop_id: shop.id,
          order_id: order.id,
          amount: orderTotal,
          payment_method: "mobile_money",
          customer_name: customerInfo.name,
          customer_phone: normalizedPhone,
          customer_email: customerInfo.email,
          customer_address: customerInfo.address,
          customer_city: customerInfo.city,
        });
        if (payRes.success && payRes.checkout_url) {
          window.location.href = payRes.checkout_url;
          return;
        }
        if (!payRes.success) {
          // Le panier est conservé : le client peut réessayer ou choisir le paiement à la livraison.
          toast({ title: "Paiement non démarré", description: payRes.error || "Réessayez ou choisissez le paiement à la livraison.", variant: "destructive" });
          return;
        }
      } else {
        if (typeof window !== "undefined" && order.order_number) {
          sessionStorage.setItem(`vp_tracked_purchase_${order.order_number}`, "1");
        }
        trackEvent(shop, "Purchase", trackingPayload);
      }
      setCart([]);
      setCustomerInfo({ name: "", phone: "", email: "", address: "", city: "", paymentMethod: "cash_on_delivery" });
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
          total: orderTotal,
        },
      });
    } catch (error: any) {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    } finally {
      setOrderLoading(false);
      submittingOrderRef.current = false;
    }
  };

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

  const isPreviewDraft = shop._isPreview || (typeof window !== "undefined" && window.location.search.includes("preview=draft"));
  const homepageConfig = isPreviewDraft
    ? (themeConfig?.homepage_draft || themeConfig?.homepage)
    : themeConfig?.homepage;

  const handleDirectOrderFromHomepage = async (orderData: {
    product: any;
    quantity: number;
    customer_name: string;
    customer_phone: string;
    customer_address?: string;
  }) => {
    const { product, quantity, customer_name, customer_phone, customer_address } = orderData;
    // H10 : le prix vient de la base ; seuls le produit et la quantité sont envoyés.
    await createPublicOrder({
      shopId: shop.id,
      customerName: customer_name,
      customerPhone: customer_phone,
      customerAddress: customer_address || "Livraison à domicile",
      paymentMethod: "cod",
      orderStatus: "pending",
      items: [{ product_id: product.id, quantity }],
    });

    cacheInvalidate(`orders:${shop.id}`);
  };

  const useBuilderHomepage = !!(homepageConfig?.enabled && Array.isArray(homepageConfig?.sections) && homepageConfig.sections.length > 0 && !classicOptOut);
  const formatPrice = (n: number) => new Intl.NumberFormat("fr-FR").format(n);
  const goToProduct = (p: Product) => {
    const base = shop._isPreview ? `/shop-preview/${shop.id}` : `/shop/${shop.slug}`;
    navigate((p as any).slug ? `${base}/p/${(p as any).slug}` : `${base}/product?product=${p.id}`);
  };

  const submitSearch = () => {
    setSuggestOpen(false);
    document.getElementById("products")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };
  const renderSearchBox = (heightClass: string, padClass: string) => (
    <>
      <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400 pointer-events-none" aria-hidden="true" />
      <Input
        type="search"
        role="combobox"
        aria-expanded={suggestOpen && suggestions.length > 0}
        aria-controls="shop-search-suggestions"
        aria-label="Rechercher un produit"
        placeholder="Rechercher un produit..."
        value={searchQuery}
        onChange={e => { setSearchQuery(e.target.value); setSuggestOpen(true); }}
        onFocus={() => setSuggestOpen(true)}
        onBlur={() => setTimeout(() => setSuggestOpen(false), 150)}
        onKeyDown={e => {
          if (e.key === "Enter") { e.preventDefault(); submitSearch(); (e.target as HTMLInputElement).blur(); }
          if (e.key === "Escape") setSuggestOpen(false);
        }}
        className={`${padClass} ${searchQuery ? "pr-10" : ""} ${heightClass} bg-gray-100/80 border-transparent focus-visible:ring-2 focus-visible:ring-primary/20 focus-visible:border-primary rounded-full shadow-inner transition-all hover:bg-gray-100 [&::-webkit-search-cancel-button]:hidden`}
      />
      {searchQuery && (
        <button
          type="button"
          aria-label="Effacer la recherche"
          onMouseDown={e => e.preventDefault()}
          onClick={() => { setSearchQuery(""); setSuggestOpen(false); }}
          className="absolute right-3 top-1/2 -translate-y-1/2 h-7 w-7 rounded-full flex items-center justify-center text-gray-500 transition-colors hover:bg-gray-200 hover:text-gray-900"
        >
          <X className="h-4 w-4" />
        </button>
      )}
      {suggestOpen && searchQuery.trim().length >= 2 && (
        <div id="shop-search-suggestions" role="listbox" className="absolute left-0 right-0 top-full mt-2 z-50 overflow-hidden rounded-2xl border border-gray-100 bg-white text-gray-900 shadow-2xl">
          {suggestions.length === 0 ? (
            <p className="px-4 py-3 text-sm text-gray-500">Aucun produit pour « {searchQuery.trim()} »</p>
          ) : (
            <>
              {suggestions.map(p => (
                <button
                  key={p.id}
                  type="button"
                  role="option"
                  aria-selected={false}
                  onMouseDown={e => e.preventDefault()}
                  onClick={() => { setSuggestOpen(false); goToProduct(p as Product); }}
                  className="flex w-full items-center gap-3 px-3 py-2 text-left transition-colors hover:bg-gray-50 focus-visible:bg-gray-50 focus-visible:outline-none"
                >
                  <span className="h-11 w-11 shrink-0 overflow-hidden rounded-lg bg-gray-100">
                    {p.product_images?.[0] && <img src={thumbUrl(p.product_images[0].image_url, 128)} alt="" loading="lazy" className="h-full w-full object-cover" />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold">{p.name}</span>
                    {p.category && <span className="block truncate text-[11px] text-gray-500">{p.category}</span>}
                  </span>
                  <span className="shrink-0 text-sm font-bold" style={{ color: primaryColor }}>{formatPrice(p.price)} FCFA</span>
                </button>
              ))}
              <button
                type="button"
                onMouseDown={e => e.preventDefault()}
                onClick={submitSearch}
                className="flex w-full items-center justify-between border-t border-gray-100 px-4 py-2.5 text-xs font-semibold text-gray-600 transition-colors hover:bg-gray-50 hover:text-gray-900"
              >
                Voir les {filteredProducts.length} résultat{filteredProducts.length > 1 ? "s" : ""} <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </>
          )}
        </div>
      )}
    </>
  );

  // Fenêtres produit / panier / commande, bouton de panier flottant et widgets différés : communs à l'accueil
  // classique et à l'accueil personnalisé (sinon « Ajouter au panier » n'avait aucun panier à ouvrir).
  const overlays = (
    <>
    {/* Product Detail Dialog */}
    <Dialog open={!!selectedProduct} onOpenChange={(open) => { if (!open) { setSelectedProduct(null); setVariantChoice({}); } }}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" aria-describedby={undefined}>
        {selectedProduct && (
          <>
            <div className="aspect-square max-h-[45vh] w-full rounded-xl overflow-hidden bg-muted mb-4">
              {selectedProduct.product_images?.[galleryIndex] || selectedProduct.product_images?.[0] ? (
                <img src={thumbUrl((selectedProduct.product_images[galleryIndex] || selectedProduct.product_images[0]).image_url, 1200)} alt={selectedProduct.name} loading="lazy" decoding="async" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center"><Store className="h-16 w-16 text-muted-foreground/30" /></div>
              )}
            </div>
            {selectedProduct.product_images && selectedProduct.product_images.length > 1 && (
              <div className="flex gap-2 mb-4 overflow-x-auto pb-1">
                {selectedProduct.product_images.map((img, i) => (
                  <button
                    key={img.id}
                    type="button"
                    onClick={() => setGalleryIndex(i)}
                    aria-label={`Voir l'image ${i + 1}`}
                    aria-current={i === galleryIndex}
                    className={`shrink-0 rounded-lg border-2 transition-all hover:-translate-y-0.5 hover:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${i === galleryIndex ? "border-primary shadow-sm" : "border-transparent opacity-70 hover:opacity-100"}`}
                  >
                    <img src={thumbUrl(img.image_url, 128)} alt="" loading="lazy" decoding="async" width={64} height={64} className="h-16 w-16 rounded-md object-cover" />
                  </button>
                ))}
              </div>
            )}
            <div className="space-y-3">
              <div className="flex items-start justify-between">
                <div>
                  <DialogTitle className="text-2xl font-bold">{selectedProduct.name}</DialogTitle>
                  <Badge variant="outline" className="mt-1">{selectedProduct.category}</Badge>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold" style={{ color: primaryColor }}>{formatPrice(selectedProduct.price)} FCFA</p>
                  {selectedProduct.compare_at_price && selectedProduct.compare_at_price > selectedProduct.price && (
                    <p className="text-sm text-muted-foreground line-through">{formatPrice(selectedProduct.compare_at_price)} FCFA</p>
                  )}
                </div>
              </div>
              {/* La description complète est du HTML riche : l'afficher telle quelle montrait les balises <p>, <strong>… */}
              {(selectedProduct.short_description || selectedProduct.description) && (
                <p className="text-muted-foreground leading-relaxed">
                  {selectedProduct.short_description || htmlToPlainText(selectedProduct.description, 280)}
                </p>
              )}
              {usableVariantGroups(selectedProduct.variants).length > 0 && (
                <div className="pt-1">
                  {/* Même sélecteur que la fiche produit : les options « Blanc (S, M, L) » y sont séparées en couleur + taille.
                      Avant, le client voyait un seul bouton « Blanc (S, M, L) » sans pouvoir choisir la taille. */}
                  <SmartVariantSelector
                    variants={selectedProduct.variants as any}
                    selectedVariants={variantChoice}
                    onChange={(key, value) => setVariantChoice(prev => ({ ...prev, [key]: value }))}
                    primaryColor={primaryColor}
                    preselect={false}
                  />
                </div>
              )}
              <div className="flex gap-3 pt-2">
                {shop._isPreview ? (
                  <div className="flex-1 rounded-xl border-2 border-dashed px-4 py-3 text-center text-xs text-muted-foreground" style={{ borderColor: primaryColor + "40" }}>
                    🔒 Commande disponible après activation de la boutique
                  </div>
                ) : (
                  (() => {
                    const groups = usableVariantGroups(selectedProduct.variants);
                    const missing = missingVariantGroups(selectedProduct.variants, variantChoice);
                    const ready = missing.length === 0;
                    return (
                      <Button
                        className="flex-1 rounded-xl gap-2 h-12 text-base"
                        style={{ backgroundColor: primaryColor, opacity: ready ? 1 : 0.6 }}
                        disabled={!ready}
                        onClick={() => { addToCart(selectedProduct, groups.length > 0 ? variantChoice : null); setSelectedProduct(null); setVariantChoice({}); }}
                      >
                        <ShoppingCart className="h-5 w-5" />
                        {ready ? "Ajouter au panier" : `Choisir : ${missing.join(", ")}`}
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
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto overflow-x-hidden rounded-2xl p-0">
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
                      <div key={cartKey(item.product.id, item.selectedVariants)} className="flex items-start gap-3 p-3 bg-muted/30 rounded-xl">
                      <div className="h-16 w-16 bg-muted rounded-xl overflow-hidden flex-shrink-0">
                        {item.product.product_images?.[0] && <img src={thumbUrl(item.product.product_images[0].image_url, 128)} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold line-clamp-2">{item.product.name}</p>
                        {item.selectedVariants && Object.keys(item.selectedVariants).length > 0 && (
                          <p className="text-[11px] text-muted-foreground truncate">
                            {Object.entries(cleanSelectedVariants(item.selectedVariants) || {}).map(([k, v]) => `${k}: ${v}`).join(" · ")}
                          </p>
                        )}
                        <div className="flex items-center justify-between gap-2 flex-wrap mt-1.5">
                          <p className="text-sm font-bold whitespace-nowrap" style={{ color: primaryColor }}>{formatPrice(item.product.price * item.quantity)} FCFA</p>
                          <div className="flex items-center gap-1">
                            <Button variant="outline" size="icon" className="h-8 w-8 rounded-lg" aria-label="Retirer une unité" onClick={() => updateQuantity(cartKey(item.product.id, item.selectedVariants), -1)} disabled={item.quantity <= 1}><Minus className="h-3 w-3" /></Button>
                            <span className="text-sm w-7 text-center font-semibold" aria-live="polite">{item.quantity}</span>
                            <Button variant="outline" size="icon" className="h-8 w-8 rounded-lg" aria-label="Ajouter une unité" onClick={() => updateQuantity(cartKey(item.product.id, item.selectedVariants), 1)}><Plus className="h-3 w-3" /></Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg ml-1 hover:bg-destructive/10" aria-label="Supprimer du panier" onClick={() => removeFromCart(cartKey(item.product.id, item.selectedVariants))}><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                    <div className="border-t pt-3 mt-3">
                      <div className="flex justify-between items-center">
                        <span className="font-semibold text-lg">Total</span>
                        <span className="font-bold text-xl" style={{ color: primaryColor }}>{formatPrice(cartTotal)} FCFA</span>
                      </div>
                    </div>
                    {themeConfig?.cart_banner_enabled === true && (
                      <div
                        className="rounded-xl px-4 py-3 text-center text-sm font-medium"
                        style={{ backgroundColor: themeConfig.cart_banner_bg || "#FEF3C7", color: themeConfig.cart_banner_text_color || "#92400E" }}
                      >
                        {themeConfig.cart_banner_text || "🚚 Livraison gratuite pour les commandes de plus de 10 000 FCFA"}
                      </div>
                    )}
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
                          <span className="opacity-70"> ({Object.entries(cleanSelectedVariants(item.selectedVariants) || {}).map(([k, v]) => `${k}: ${v}`).join(", ")})</span>
                        )}
                        {" × "}{item.quantity}
                      </span>
                      <span className="font-medium">{formatPrice(item.product.price * item.quantity)} FCFA</span>
                    </div>
                  ))}
                  {promoDiscount > 0 && (
                    <div className="flex justify-between text-emerald-700 font-medium">
                      <span>Code {promo?.code}</span>
                      <span>- {formatPrice(promoDiscount)} FCFA</span>
                    </div>
                  )}
                  <div className="border-t pt-1.5 mt-1.5 flex justify-between font-bold text-sm">
                    <span>Total</span>
                    <span style={{ color: primaryColor }}>{formatPrice(payableTotal)} FCFA</span>
                  </div>
                </div>
                <PromoCodeField
                  shopId={shop.id}
                  subtotal={cartTotal}
                  customerPhone={customerInfo.phone}
                  customerEmail={customerInfo.email}
                  primaryColor={primaryColor}
                  applied={promo}
                  onChange={setPromo}
                />
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
                          hideHint={shop?.theme_config?.hide_phone_format_hint === true}
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
                        <div>
                          <p className="font-semibold text-xs">{method.label}</p>
                          {method.value === "mobile_money" && (
                            <p className="text-[9px] text-muted-foreground">Orange, MTN, Wave, Moov</p>
                          )}
                        </div>
                        {customerInfo.paymentMethod === method.value && <CheckCircle2 className="h-4 w-4 ml-auto flex-shrink-0" style={{ color: primaryColor }} />}
                      </button>
                    ))}
                  </div>
                </div>
                <Button className="w-full h-11 rounded-xl text-sm font-semibold gap-2" style={{ backgroundColor: primaryColor }} onClick={placeOrder} disabled={orderLoading || !canSubmit}>
                  {orderLoading ? "Traitement..." : <><ShoppingCart className="h-5 w-5" /> Confirmer · {formatPrice(payableTotal)} FCFA</>}
                </Button>
              </div>
              );
            })()}
          </>
        )}
      </DialogContent>
    </Dialog>



    {/* Floating Cart Button - Mobile */}
    {!shop._isPreview && cartCount > 0 && !checkoutOpen && (
      <div className={`fixed bottom-6 left-6 right-20 z-40 ${useBuilderHomepage ? "md:right-auto md:w-80" : "md:hidden"}`}>
        <Button
          className="w-full h-14 rounded-2xl shadow-xl text-base font-semibold gap-2 hover:brightness-110"
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
          hideEcomfyBranding={shop.theme_config?.hide_ecomfy_branding === true}
        />
      </Suspense>
    )}
    </>
  );

  if (useBuilderHomepage) {
    return (
      <>
        <Helmet>
          <title>{shop.seo_title || shop.business_name || "Boutique"}</title>
          <meta name="description" content={shop.seo_description || shop.business_description || `Boutique ${shop.business_name}`} />
          <link rel="canonical" href={window.location.href} />
        </Helmet>
        {shop._isPreview && (
          <div className="bg-amber-500 text-white text-center py-2 px-4 text-sm font-medium">
            ⚠️ Mode prévisualisation — Cette boutique n'est pas encore en ligne
          </div>
        )}
        {selectedCategory !== "all" && (
          <div className="sticky top-0 z-40 flex items-center justify-center gap-3 border-b bg-white/95 px-4 py-2.5 text-sm backdrop-blur">
            <span className="text-gray-600">Catégorie : <b className="text-gray-900">{selectedCategory}</b></span>
            <button
              type="button"
              onClick={() => setSelectedCategory("all")}
              className="inline-flex items-center gap-1 rounded-full border border-gray-200 px-3 py-1 text-xs font-semibold text-gray-700 transition-colors hover:bg-gray-100 hover:text-gray-900"
            >
              <X className="h-3 w-3" /> Tout voir
            </button>
          </div>
        )}
        <HomepageRenderer
          config={homepageConfig}
          shop={shop}
          products={selectedCategory === "all" ? products : products.filter(p => p.category === selectedCategory)}
          primaryColor={primaryColor}
          onAddToCart={(p) => addToCart(p)}
          onViewProduct={(p) => goToProduct(p)}
          onSelectCategory={(cat) => {
            setSelectedCategory(cat);
            // Les produits de la catégorie s'affichent plus bas : on y amène le visiteur.
            setTimeout(() => document.querySelector("[data-products-section]")?.scrollIntoView({ behavior: "smooth", block: "start" }), 150);
          }}
          onActionClick={(action, url) => {
            if (action === "checkout") {
              if (cart.length > 0) { setCheckoutOpen(true); setOrderSuccess(false); }
              else toast({ title: "Votre panier est vide", description: "Ajoutez un produit pour commander." });
            } else if (url && url.startsWith("/")) {
              navigate(url);
            }
          }}
          onDirectOrder={handleDirectOrderFromHomepage}
        />
        {overlays}
      </>
    );
  }

  // Optional pro theme — early return when a theme is active and user did not opt-out via ?classic=1
  const activeShopThemeSlug: string | null = themeConfig?.active_theme_slug || null;
  if (activeShopThemeSlug && !classicOptOut) {
    return (
      <>
        <Helmet>
          <title>{shop.seo_title || shop.business_name || "Boutique"}</title>
          <meta name="description" content={shop.seo_description || shop.business_description || `Boutique ${shop.business_name}`} />
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

  // « Nombre de colonnes de produits (Desktop) » du menu Thème : 3, 4 (défaut) ou 5 ; 2 colonnes sur mobile.
  const productsGridCols = themeConfig?.products_per_row === 3
    ? "md:grid-cols-3"
    : themeConfig?.products_per_row === 5
      ? "md:grid-cols-3 lg:grid-cols-5"
      : "md:grid-cols-4";

  const shopTitle = shop.seo_title || shop.business_name || "Boutique";
  const shopDescription = shop.seo_description || shop.business_description || `Boutique ${shop.business_name} sur Ecomfy`;
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
      {/* Bandeau d'annonce : le texte est celui du marchand (Thème > Bandeau d'annonce). Plus de promesse
          « Livraison gratuite partout » écrite en dur, fausse pour la plupart des boutiques. */}
      {themeConfig?.top_banner_enabled === true && (themeConfig?.top_banner_text || "").trim() && (
        <div
          className="text-center py-2 px-4 text-[11px] sm:text-xs font-bold tracking-wide shadow-sm relative z-50"
          style={{ backgroundColor: themeConfig.top_banner_bg || primaryColor, color: themeConfig.top_banner_text_color || readableTextOn(themeConfig.top_banner_bg || primaryColor) }}
        >
          {themeConfig.top_banner_text}
        </div>
      )}

      <ShopReviewBar themeConfig={themeConfig} placement="above" />
      {/* Preview Mode Banner */}
      {shop._isPreview && (
        <div className="bg-amber-500 text-white text-center py-2 px-4 text-sm font-medium shadow-sm">
          ⚠️ Mode prévisualisation — Cette boutique n'est pas encore en ligne
        </div>
      )}

      {/* Sticky Header - Premium Glassmorphism */}
      <header
        className="border-b sticky top-0 z-40 bg-[var(--shop-header-mobile-bg,rgba(255,255,255,0.85))] md:bg-[var(--shop-header-desktop-bg,rgba(255,255,255,0.85))] border-[color:var(--shop-header-mobile-border)] md:border-[color:var(--shop-header-desktop-border)] backdrop-blur-xl shadow-sm transition-all duration-300"
        style={{
          ...(themeConfig.header_mobile_bg || themeConfig.header_desktop_bg ? {
            "--shop-header-mobile-bg": themeConfig.header_mobile_bg || themeConfig.header_desktop_bg,
            "--shop-header-desktop-bg": themeConfig.header_desktop_bg || themeConfig.header_mobile_bg,
          } : {}),
          "--shop-header-mobile-border": themeConfig.header_mobile_border === false ? "transparent" : (themeConfig.header_mobile_border_color || "rgba(0,0,0,0.05)"),
          "--shop-header-desktop-border": themeConfig.header_desktop_border === false ? "transparent" : (themeConfig.header_desktop_border_color || themeConfig.header_mobile_border_color || "rgba(0,0,0,0.05)"),
          // Le nom de la boutique reste lisible quel que soit le fond d'en-tête choisi dans « Thème ».
          "--shop-header-mobile-text": readableTextOn(themeConfig.header_mobile_bg || themeConfig.header_desktop_bg),
          "--shop-header-desktop-text": readableTextOn(themeConfig.header_desktop_bg || themeConfig.header_mobile_bg),
          "--shop-header-mobile-btn": themeConfig.header_mobile_btn || "#9ca3af",
          "--shop-header-desktop-btn": themeConfig.header_desktop_btn || themeConfig.header_mobile_btn || "#9ca3af",
        } as CSSProperties}
      >
        <div className="max-w-7xl mx-auto px-4 py-3 sm:py-4 flex items-center justify-between gap-4 sm:gap-6">
          <div className="flex items-center gap-3 sm:gap-4 min-w-0 group cursor-pointer" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}>
            {(() => {
              const headerMode = themeConfig?.header_display_mode || (shop.logo_url ? "logo_only" : "name_only");
              const showLogo = (headerMode === "logo_only" || headerMode === "both") && !!shop.logo_url;
              const showName = headerMode === "name_only" || headerMode === "both" || !shop.logo_url;

              return (
                <>
                  {showLogo && (
                    <div className="flex items-center shrink-0">
                      <img 
                        src={/\.gif($|\?)|\.svg($|\?)|data:image\/gif/i.test(shop.logo_url!) ? shop.logo_url! : thumbUrl(shop.logo_url!, 512)} 
                        alt={tShop.business_name || "Logo"} 
                        loading="eager" 
                        decoding="async" 
                        className={`max-h-10 sm:max-h-12 w-auto max-w-[180px] sm:max-w-[240px] object-contain flex-shrink-0 transition-all group-hover:scale-105 ${
                          themeConfig?.logo_effect === "shimmer" ? "animate-pulse brightness-110" : ""
                        } ${
                          themeConfig?.logo_effect === "glow" ? "drop-shadow-[0_0_10px_rgba(255,255,255,0.7)]" : ""
                        } ${
                          themeConfig?.logo_effect === "bounce" ? "hover:animate-bounce" : ""
                        }`} 
                      />
                    </div>
                  )}
                  {!showLogo && (
                    <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-2xl flex items-center justify-center flex-shrink-0 shadow-sm group-hover:scale-105 transition-transform" style={{ backgroundColor: primaryColor + "15" }}>
                      <Store className="h-5 w-5 sm:h-6 sm:w-6" style={{ color: primaryColor }} />
                    </div>
                  )}
                  {showName && (
                    <span className="font-extrabold text-lg sm:text-xl md:text-2xl truncate tracking-tight text-[color:var(--shop-header-mobile-text)] md:text-[color:var(--shop-header-desktop-text)] group-hover:opacity-80 transition-opacity">{tShop.business_name}</span>
                  )}
                </>
              );
            })()}
          </div>
          
          {/* Recherche : suggestions en direct, accents ignorés, Entrée = voir tous les résultats */}
          <div className="hidden md:block relative flex-1 max-w-xl mx-auto">
            {renderSearchBox("h-12 text-base", "pl-12")}
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            {enabledLanguages.length > 1 && (
              <ShopLanguageSelector value={shopLang} onChange={handleLangChange} enabled={enabledLanguages} />
            )}
            {shop.whatsapp_number && (
              <a href={`https://wa.me/${shop.whatsapp_number.replace(/[^0-9]/g, "")}`} target="_blank" rel="noopener noreferrer" className="hidden sm:flex">
                <Button variant="ghost" size="icon" className="rounded-full h-10 w-10 sm:h-12 sm:w-12 bg-gray-50 hover:bg-green-50 hover:text-green-600 transition-colors">
                  <Phone className="h-5 w-5" style={{ color: themeConfig.header_desktop_btn || themeConfig.header_mobile_btn || undefined }} />
                </Button>
              </a>
            )}
            <Button 
              className="gap-2 rounded-full relative h-10 sm:h-12 px-4 sm:px-6 font-bold shadow-md hover:shadow-lg hover:brightness-110 transition-all hover:-translate-y-0.5" aria-label={`Ouvrir le panier${cartCount > 0 ? ` (${cartCount} article${cartCount > 1 ? "s" : ""})` : ""}`}
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
        {/* Recherche mobile : accessible dès l'en-tête, plus seulement dans la section « Tous les produits » */}
        <div className="md:hidden px-4 pb-3">
          <div className="relative">
            {renderSearchBox("h-11 text-base", "pl-11")}
          </div>
        </div>
      </header>
      <ShopReviewBar themeConfig={themeConfig} placement="below" />

      {/* Hero Section */}
      {themeConfig?.hero_enabled !== false && (() => {
        const heroBannerUrl =
          shop.banner_url ||
          shop.hero_image_url ||
          themeConfig?.hero_banner_url ||
          themeConfig?.banner_url ||
          themeConfig?.hero_image ||
          (Array.isArray(themeConfig?.hero_banners) ? themeConfig.hero_banners[0] : null) ||
          null;
        
        const heroTitle = themeConfig?.hero_title || tShop.business_name;
        const heroSubtitle = themeConfig?.hero_subtitle || tShop.business_description;
        const heroCtaText = themeConfig?.hero_cta_text || "Voir les produits";
        const overlayOpacity = (themeConfig?.hero_overlay_opacity ?? 65) / 100;

        return (
          <section className="relative overflow-hidden bg-gray-950 w-full min-h-[440px] sm:min-h-[560px] flex items-center justify-center">
            {heroBannerUrl ? (
              <div className="absolute inset-0">
                <img 
                  src={thumbUrl(heroBannerUrl, 1600)} 
                  alt={heroTitle || "Bannière d'accueil"} 
                  loading="eager" 
                  decoding="async" 
                  {...{ fetchpriority: "high" }}
                  className="w-full h-full object-cover transition-transform duration-700 hover:scale-105" 
                />
                <div 
                  className="absolute inset-0 bg-gradient-to-t from-gray-950 via-gray-950/60 to-gray-950/30" 
                  style={{ opacity: overlayOpacity }}
                />
                <div className="absolute inset-0 bg-gradient-to-r from-gray-950/80 via-transparent to-transparent opacity-60" />
              </div>
            ) : (
              <div className="absolute inset-0 bg-gradient-to-br from-gray-900 via-gray-950 to-black">
                <div className="absolute top-0 right-0 w-[500px] h-[500px] rounded-full bg-white/5 -translate-y-1/2 translate-x-1/2 blur-[100px]" />
                <div className="absolute bottom-0 left-0 w-[400px] h-[400px] rounded-full bg-white/5 translate-y-1/2 -translate-x-1/2 blur-[80px]" />
              </div>
            )}

            <div className="relative z-10 w-full max-w-5xl mx-auto px-4 py-16 text-center text-white flex flex-col items-center">
              {(() => {
                const heroMode = themeConfig?.hero_display_mode || (shop.logo_url ? "logo_only" : "name_only");
                const hasLogo = !!shop.logo_url;
                const showLogo = (heroMode === "logo_only" || heroMode === "both") && hasLogo;
                // Si le logo est affiché et qu'on est en mode logo_only, on masque le titre texte s'il est identique au nom de la boutique
                const isTitleIdenticalToName = heroTitle?.trim().toLowerCase() === tShop.business_name?.trim().toLowerCase();
                const showTitle = heroMode === "name_only" || heroMode === "both" || !hasLogo || (!isTitleIdenticalToName && heroMode === "logo_only");

                return (
                  <>
                    {showLogo && (
                      <div className="p-2 rounded-3xl bg-white/10 backdrop-blur-xl mb-6 shadow-2xl ring-1 ring-white/20 inline-flex items-center justify-center max-w-[280px]">
                        <img 
                          src={/\.gif($|\?)|\.svg($|\?)|data:image\/gif/i.test(shop.logo_url!) ? shop.logo_url! : thumbUrl(shop.logo_url!, 512)} 
                          alt={tShop.business_name} 
                          loading="eager" 
                          decoding="async" 
                          className={`max-h-20 sm:max-h-24 w-auto max-w-[240px] object-contain ${
                            themeConfig?.logo_effect === "shimmer" ? "animate-pulse brightness-110" : ""
                          } ${
                            themeConfig?.logo_effect === "glow" ? "drop-shadow-[0_0_15px_rgba(255,255,255,0.9)]" : ""
                          }`} 
                        />
                      </div>
                    )}

                    {(themeConfig?.hero_badge_text || "").trim() && (
                      <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-extrabold uppercase tracking-widest bg-white/10 backdrop-blur-md text-white border border-white/20 mb-4 shadow-sm">
                        <span>{themeConfig.hero_badge_text}</span>
                      </div>
                    )}

                    {showTitle && (
                      <h1 dir={isRtlLang(shopLang) ? "rtl" : undefined} className="text-4xl sm:text-6xl md:text-7xl lg:text-8xl font-black mb-6 tracking-tighter drop-shadow-2xl leading-[1.1] text-transparent bg-clip-text bg-gradient-to-b from-white via-white to-gray-200">
                        {heroTitle}
                      </h1>
                    )}
                  </>
                );
              })()}

              {heroSubtitle && (
                <p dir={isRtlLang(shopLang) ? "rtl" : undefined} className="text-lg sm:text-xl md:text-2xl text-gray-200 max-w-3xl mx-auto leading-relaxed font-medium mb-10 text-balance drop-shadow-md">
                  {heroSubtitle}
                </p>
              )}

              <div className="flex gap-4 sm:gap-5 justify-center flex-wrap">
                <Button 
                  size="lg" 
                  className="rounded-full gap-2 font-black shadow-2xl h-14 sm:h-16 px-8 sm:px-10 text-base sm:text-lg hover:scale-105 hover:brightness-110 transition-all active:scale-95" 
                  style={{ backgroundColor: primaryColor, color: "#fff" }} 
                  onClick={() => (document.getElementById("featured") ?? document.getElementById("products"))?.scrollIntoView({ behavior: "smooth" })}
                >
                  <ShoppingBag className="h-5 w-5 sm:h-6 sm:w-6" /> {heroCtaText}
                </Button>
                {shop.whatsapp_number && (
                  <a href={`https://wa.me/${shop.whatsapp_number.replace(/[^0-9]/g, "")}`} target="_blank" rel="noopener noreferrer">
                    <Button size="lg" variant="outline" className="rounded-full gap-2 border-white/30 text-white bg-white/10 hover:bg-white/25 hover:text-white hover:border-white/60 backdrop-blur-md h-14 sm:h-16 px-8 sm:px-10 text-base sm:text-lg shadow-xl transition-all hover:scale-105 active:scale-95">
                      <MessageCircle className="h-5 w-5 sm:h-6 sm:w-6" /> Nous contacter
                    </Button>
                  </a>
                )}
              </div>
            </div>

            {/* Scroll indicator */}
            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 animate-bounce hidden sm:block opacity-70">
              <div className="w-8 h-12 rounded-full border-2 border-white/40 flex items-start justify-center p-2 backdrop-blur-sm">
                <div className="w-1.5 h-3 bg-white rounded-full" />
              </div>
            </div>
          </section>
        );
      })()}

      {/* Réassurance : uniquement des engagements réels (modes de paiement proposés au checkout, WhatsApp si renseigné).
          Avant : « Support 7j/7 », « Produits 100% authentiques », « Expédition sécurisée partout » écrits en dur. */}
      {themeConfig?.trust_bar_enabled !== false && (
        <section className="bg-white border-b border-gray-100 py-5 px-4 shadow-sm" aria-label="Nos engagements">
          <div className="max-w-7xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 text-center">
            {[
              { icon: Truck, tone: "bg-blue-50 text-blue-600", title: "Livraison à domicile", sub: shop.city ? `Depuis ${shop.city}` : "Directement chez vous", show: true },
              { icon: ShieldCheck, tone: "bg-emerald-50 text-emerald-600", title: "Paiement sécurisé", sub: "À la livraison ou Mobile Money", show: true },
              { icon: MessageCircle, tone: "bg-purple-50 text-purple-600", title: "Support WhatsApp", sub: "Réponse directe du vendeur", show: !!shop.whatsapp_number },
              { icon: CheckCircle2, tone: "bg-amber-50 text-amber-600", title: "Commande simple", sub: "Sans compte, en 2 minutes", show: true },
            ].filter(i => i.show).map(item => (
              <div key={item.title} className="flex flex-col md:flex-row items-center justify-center gap-3 p-3.5 rounded-2xl bg-gray-50/80 border border-gray-100/80">
                <div className={`p-3 rounded-xl shrink-0 shadow-sm ${item.tone}`}>
                  <item.icon className="h-5 w-5 sm:h-6 sm:w-6" aria-hidden="true" />
                </div>
                <div className="text-center md:text-left">
                  <h4 className="font-extrabold text-xs sm:text-sm text-gray-900">{item.title}</h4>
                  <p className="text-[11px] text-gray-500 hidden sm:block">{item.sub}</p>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Produits vedettes (masqués pendant une recherche ou un filtre : les résultats prennent la place) */}
      {catalog.showFeatured && (
        <section id="featured" className="max-w-7xl mx-auto px-4 py-10 sm:py-16 scroll-mt-24">
          <div className="flex flex-col items-center justify-center mb-8 sm:mb-10 text-center">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-extrabold uppercase tracking-wider mb-3 bg-amber-50 text-amber-700 border border-amber-200">
              <Star className="h-3.5 w-3.5 fill-amber-500 text-amber-500" />
              {hasCuratedFeatured ? "En vedette" : "Sélection spéciale"}
            </div>
            <h2 className="text-2xl sm:text-4xl font-black tracking-tight text-gray-900 mb-2">
              {themeConfig?.featured_title || "Produits vedettes"}
            </h2>
            <div className="w-20 h-1.5 rounded-full mt-3" style={{ backgroundColor: primaryColor }} />
          </div>
          <div className={`grid grid-cols-2 ${productsGridCols} gap-3 sm:gap-6 lg:gap-8`}>
            {effectiveFeaturedProducts.map((product, idx) => (
              <ProductCard key={product.id} product={product} primaryColor={primaryColor} soldOut={soldOutIds.has(product.id)} onAddToCart={addToCart} eager={idx < 4} onView={goToProduct} formatPrice={formatPrice} />
            ))}
          </div>
          {catalog.showCatalog && catalog.items.length > 0 && (
            <div className="flex justify-center mt-8">
              <Button
                variant="outline"
                className="rounded-full h-12 px-6 font-bold border-2 gap-2 hover:bg-gray-900 hover:text-white hover:border-gray-900"
                onClick={() => document.getElementById("products")?.scrollIntoView({ behavior: "smooth", block: "start" })}
              >
                Voir {catalog.excludesFeatured ? `les ${catalog.items.length} autres produits` : "tous les produits"} <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          )}
        </section>
      )}

      {/* Catalogue : toujours atteignable (avant, avec les réglages par défaut seuls 4 produits étaient visibles) */}
      {catalog.showCatalog && (
        <div id="products" className="max-w-7xl mx-auto px-3 sm:px-4 mb-12 scroll-mt-24">
          <section className="rounded-3xl border border-gray-100 bg-gray-50/50 px-4 sm:px-8 py-8 sm:py-12">
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-6">
              <div>
                <h2 className="text-2xl sm:text-4xl font-black tracking-tight mb-1">
                  {catalog.isFiltering ? "Résultats" : catalog.excludesFeatured ? "Plus de produits" : "Tous les produits"}
                </h2>
                <p className="text-muted-foreground" aria-live="polite">
                  {filteredProducts.length} produit{filteredProducts.length > 1 ? "s" : ""}
                  {searchQuery.trim() && <> pour « {searchQuery.trim()} »</>}
                  {selectedCategory !== "all" && <> dans « {selectedCategory} »</>}
                  {catalog.isFiltering && (
                    <button
                      type="button"
                      onClick={() => { setSearchQuery(""); setSelectedCategory("all"); }}
                      className="ml-2 font-semibold underline underline-offset-2 transition-colors hover:text-foreground"
                    >
                      Réinitialiser
                    </button>
                  )}
                </p>
              </div>
              {filteredProducts.length > 1 && (
                <label className="flex items-center gap-2 text-sm text-gray-600">
                  <span className="shrink-0">Trier par</span>
                  <select
                    value={sortKey}
                    onChange={e => setSortKey(e.target.value as SortKey)}
                    className="h-10 rounded-full border border-gray-200 bg-white px-4 text-sm font-semibold text-gray-900 shadow-sm transition-colors hover:border-gray-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
                  >
                    {SORT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </label>
              )}
            </div>

            {/* Catégories (avec effectifs) */}
            {categoryList.length > 2 && (
              <div className="flex gap-2.5 overflow-x-auto pb-4 mb-2 scrollbar-hide snap-x -mx-1 px-1" role="tablist" aria-label="Catégories">
                {categoryList.map(cat => {
                  const isActive = selectedCategory === cat.name;
                  return (
                    <button
                      key={cat.name}
                      type="button"
                      role="tab"
                      aria-selected={isActive}
                      onClick={() => setSelectedCategory(cat.name)}
                      className={`snap-start whitespace-nowrap px-5 py-2.5 rounded-full text-sm font-bold transition-all duration-200 shadow-sm hover:-translate-y-0.5 ${isActive ? "text-white shadow-md hover:brightness-110" : "bg-white text-gray-700 hover:bg-gray-100 hover:text-gray-900 border border-gray-200"}`}
                      style={isActive ? { backgroundColor: primaryColor } : {}}
                    >
                      {cat.name === "all" ? "Tout voir" : cat.name}
                      <span className={`ml-1.5 text-xs font-semibold ${isActive ? "opacity-80" : "text-gray-400"}`}>{cat.count}</span>
                    </button>
                  );
                })}
              </div>
            )}

            <div className={`grid grid-cols-2 ${productsGridCols} gap-3 sm:gap-6 lg:gap-8`}>
              {visibleProducts.map((product, idx) => (
                <ProductCard key={product.id} product={product} primaryColor={primaryColor} soldOut={soldOutIds.has(product.id)} eager={idx < 4 && !catalog.showFeatured} onAddToCart={addToCart} onView={goToProduct} formatPrice={formatPrice} />
              ))}
            </div>
            {hasMore && (
              <div ref={loadMoreRef} className="flex justify-center py-10">
                <Button
                  variant="outline"
                  size="lg"
                  className="rounded-full h-14 px-8 font-bold border-2 hover:bg-gray-900 hover:text-white hover:border-gray-900"
                  onClick={() => setVisibleCount(c => c + PAGE_SIZE)}
                >
                  Afficher plus de produits ({filteredProducts.length - visibleCount} restants)
                </Button>
              </div>
            )}
            {filteredProducts.length === 0 && (
              <div className="text-center py-16 sm:py-24 bg-white rounded-3xl border border-gray-100 shadow-sm mt-4">
                <ShoppingBag className="h-16 w-16 sm:h-20 sm:w-20 mx-auto text-gray-200 mb-5" />
                {products.length === 0 ? (
                  <>
                    <p className="text-xl sm:text-2xl font-bold text-gray-800 mb-2">Les produits arrivent bientôt</p>
                    <p className="text-gray-500">Cette boutique prépare son catalogue. Revenez très vite.</p>
                  </>
                ) : (
                  <>
                    <p className="text-xl sm:text-2xl font-bold text-gray-800 mb-2">Aucun produit trouvé</p>
                    <p className="text-gray-500">Essayez un autre mot ou une autre catégorie.</p>
                    <Button variant="outline" className="mt-6 rounded-full hover:bg-gray-900 hover:text-white" onClick={() => { setSearchQuery(""); setSelectedCategory("all"); }}>
                      Réinitialiser la recherche
                    </Button>
                  </>
                )}
              </div>
            )}
          </section>
        </div>
      )}

      {/* Contact Section */}
      {themeConfig?.contact_section_enabled !== false && (shop.whatsapp_number || shop.phone_number || shop.email) && (
      <section className="bg-gray-900 text-white py-14 sm:py-20">
        <div className="max-w-7xl mx-auto px-4 text-center">
          <h2 className="text-3xl sm:text-4xl font-black mb-3">Besoin d'aide ?</h2>
          <p className="text-gray-400 text-base sm:text-lg mb-8 max-w-2xl mx-auto">Posez-nous vos questions avant de commander, nous vous répondons directement.</p>
          <div className="flex flex-wrap gap-3 sm:gap-5 justify-center">
            {shop.whatsapp_number && (
              <Button asChild size="lg" className="rounded-full gap-2 h-14 px-8 text-base font-bold text-white hover:scale-105 hover:brightness-110 transition-all" style={{ backgroundColor: "#25D366" }}>
                <a href={`https://wa.me/${shop.whatsapp_number.replace(/[^0-9]/g, "")}`} target="_blank" rel="noopener noreferrer">
                  <MessageCircle className="h-5 w-5" /> Discuter sur WhatsApp
                </a>
              </Button>
            )}
            {shop.phone_number && (
              <Button asChild size="lg" variant="outline" className="rounded-full gap-2 h-14 px-8 text-base font-bold bg-transparent text-white border-white/30 hover:bg-white/15 hover:text-white hover:border-white/60">
                <a href={`tel:${shop.phone_number}`}>
                  <Phone className="h-5 w-5" /> {shop.phone_number}
                </a>
              </Button>
            )}
            {shop.email && (
              <Button asChild size="lg" variant="outline" className="rounded-full gap-2 h-14 px-8 text-base font-bold bg-transparent text-white border-white/30 hover:bg-white/15 hover:text-white hover:border-white/60">
                <a href={`mailto:${shop.email}`}>
                  <Mail className="h-5 w-5" /> Nous écrire
                </a>
              </Button>
            )}
          </div>
        </div>
      </section>
      )}

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
            {(() => {
              const headerMode = themeConfig?.header_display_mode || (shop.logo_url ? "logo_only" : "name_only");
              const showLogo = (headerMode === "logo_only" || headerMode === "both") && !!shop.logo_url;
              const showName = headerMode === "name_only" || headerMode === "both" || !shop.logo_url;

              return (
                <>
                  {showLogo && (
                    <img src={thumbUrl(shop.logo_url!, 128)} alt={tShop.business_name || ""} className="h-8 w-auto max-w-[140px] object-contain opacity-85" />
                  )}
                  {!showLogo && (
                    <Store className="h-5 w-5 opacity-70" style={{ color: primaryColor }} />
                  )}
                  {showName && (
                    <span className="font-semibold opacity-80">© {new Date().getFullYear()} {tShop.business_name}</span>
                  )}
                  {!showName && (
                    <span className="font-semibold opacity-80">© {new Date().getFullYear()}</span>
                  )}
                </>
              );
            })()}
          </div>
          <div className="flex flex-wrap items-center justify-center gap-2 opacity-80">
            {shop.city && <><MapPin className="h-4 w-4" /> {shop.city}, {shop.country || "Côte d'Ivoire"} <span className="mx-2 opacity-30">|</span></>}
            {themeConfig?.hide_ecomfy_branding !== true && (
              <>Créé avec <a href="https://ecomfy.cloud" target="_blank" rel="noopener noreferrer" className="font-extrabold text-foreground ml-1 hover:underline decoration-2 underline-offset-2">Ecomfy</a></>
            )}
          </div>
        </div>
      </footer>

      {overlays}
    </div>
    </>
  );
};

// Product Card Component
function ProductCard({ product, primaryColor, onAddToCart, onView, formatPrice, eager, soldOut }: {
  product: Product; primaryColor: string; onAddToCart: (p: Product) => void; onView: (p: Product) => void; formatPrice: (n: number) => string; eager?: boolean; soldOut?: boolean;
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
      className="overflow-hidden group cursor-pointer border-0 shadow-sm hover:shadow-xl hover:-translate-y-0.5 transition-all duration-300 h-full flex flex-col"
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
            {...(eager ? { fetchpriority: "high" } : {})}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center"><Store className="h-8 w-8 sm:h-10 sm:w-10 text-muted-foreground/30" /></div>
        )}
        {discountPercent(product) > 0 && (
          <Badge className="absolute top-1.5 left-1.5 sm:top-2 sm:left-2 bg-destructive text-destructive-foreground hover:bg-destructive rounded-lg font-bold text-[10px] sm:text-xs px-1.5 sm:px-2">
            -{discountPercent(product)}%
          </Badge>
        )}
        {product.is_digital && <Badge className="absolute top-1.5 right-1.5 sm:top-2 sm:right-2 bg-purple-600 hover:bg-purple-600 rounded-lg text-[10px] sm:text-xs">Digital</Badge>}
        {!soldOut && !product.is_digital && lowStockCount(product) !== null && (
          <Badge className="absolute bottom-1.5 left-1.5 sm:bottom-2 sm:left-2 gap-1 bg-white/95 text-red-600 hover:bg-white/95 rounded-lg font-bold text-[10px] sm:text-xs px-1.5 sm:px-2 shadow-sm">
            <Flame className="h-3 w-3" aria-hidden="true" /> Plus que {lowStockCount(product)}
          </Badge>
        )}
        {soldOut && (
          <div className="absolute inset-0 bg-white/60 flex items-center justify-center">
            <Badge className="bg-gray-900 text-white rounded-lg text-[10px] sm:text-xs">Rupture de stock</Badge>
          </div>
        )}
      </div>
      <div className="p-2.5 sm:p-3 md:p-4 flex flex-1 flex-col">
        <h3 className="font-semibold text-xs sm:text-sm line-clamp-2 mb-0.5 sm:mb-1">{product.name}</h3>
        {product.short_description && <p className="text-[10px] sm:text-xs text-muted-foreground line-clamp-1 mb-1.5 sm:mb-2 hidden sm:block">{product.short_description}</p>}
        <div className="flex items-end justify-between gap-1 sm:gap-2 mt-auto pt-1">
          <div className="min-w-0">
            <span className="font-bold text-sm sm:text-base block truncate" style={{ color: primaryColor }}>{formatPrice(product.price)}</span>
            <span className="text-[10px] sm:text-xs text-muted-foreground">FCFA</span>
            {discountPercent(product) > 0 && (
              <span className="text-[10px] sm:text-xs text-muted-foreground line-through ml-1 hidden sm:inline">{formatPrice(product.compare_at_price)}</span>
            )}
          </div>
          <Button
            size="icon"
            className="h-8 w-8 sm:h-9 sm:w-9 rounded-xl flex-shrink-0 hover:brightness-110 hover:shadow-md"
            style={{ backgroundColor: primaryColor }}
            disabled={soldOut}
            aria-label={soldOut ? "Rupture de stock" : "Ajouter au panier"}
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
