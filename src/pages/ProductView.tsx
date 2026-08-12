import { useEffect, useState, useRef, lazy, Suspense, type CSSProperties } from "react";
import { useParams, useSearchParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
const LazyThemeRenderer = lazy(() => import("@/lib/productThemes/ThemeRenderer"));
import { thumbUrl } from "@/lib/imageUrl";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { 
  ShoppingCart, Plus, Minus, Store, Phone, MessageCircle, 
  Star, MapPin, Mail, ShoppingBag, ArrowLeft, ChevronLeft, 
  ChevronRight, Share2, Heart, Truck, Shield, Clock, CheckCircle2,
  CreditCard, User, ArrowRight, Trash2, Send, X
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import DOMPurify from "dompurify";
import { PreviewLockedNotice } from "@/components/shop/PreviewLockedNotice";
import { ShopReviewBar } from "@/components/shop/ShopReviewBar";
import { isAbidjanZone } from "@/lib/abidjanZones";
import { initShopPixels, trackEvent } from "@/lib/tracking";
import { PhoneInput } from "@/components/shop/PhoneInput";
import { isValidFullPhone, normalizeToE164, parseFullPhone } from "@/lib/phoneCountries";
import { normalizeSectionOrder, type ProductSectionKey } from "@/lib/productSections";
import { containsDigits, stripDigits } from "@/lib/utils";
import { Helmet } from "react-helmet";
import { cacheGet, cacheSet, cacheIsFresh, shopKey, productKey } from "@/lib/shopCache";
import { useDeferredMount } from "@/lib/useDeferredMount";
import {
  buildProductPageStyle,
  fetchProductAudios,
  fetchProductThemeSettings,
  type ProductAudio,
  type ProductThemeSettings,
} from "@/lib/productAppearance";

// Non-critical, below-the-fold widgets. Loaded only after the LCP image and
// the "Commander maintenant" button are interactive — keeps the initial JS
// payload small for ad-traffic landings.
const SocialProofNotification = lazy(() =>
  import("@/components/shop/SocialProofNotification").then(m => ({ default: m.SocialProofNotification }))
);
const ProductReviews = lazy(() =>
  import("@/components/shop/ProductReviews").then(m => ({ default: m.ProductReviews }))
);
const ShopAIAssistant = lazy(() =>
  import("@/components/shop/ShopAIAssistant").then(m => ({ default: m.ShopAIAssistant }))
);

// Countdown Timer Component
const CountdownTimerInline = ({ color, days, hours, minutes }: { color: string; days: number; hours: number; minutes: number }) => {
  const [timeLeft, setTimeLeft] = useState({ d: days, h: hours, m: minutes, s: 0 });

  useEffect(() => {
    const totalSeconds = timeLeft.d * 86400 + timeLeft.h * 3600 + timeLeft.m * 60 + timeLeft.s;
    if (totalSeconds <= 0) return;
    const timer = setInterval(() => {
      setTimeLeft(prev => {
        const total = prev.d * 86400 + prev.h * 3600 + prev.m * 60 + prev.s - 1;
        if (total <= 0) return { d: 0, h: 0, m: 0, s: 0 };
        return { d: Math.floor(total / 86400), h: Math.floor((total % 86400) / 3600), m: Math.floor((total % 3600) / 60), s: total % 60 };
      });
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const Box = ({ val, label }: { val: number; label: string }) => (
    <div className="flex flex-col items-center">
      <div
        className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg sm:rounded-xl flex items-center justify-center text-white font-black text-base sm:text-xl tabular-nums shadow-sm border-b-[3px]"
        style={{ backgroundColor: color, borderColor: "rgba(0,0,0,0.2)" }}
      >
        {String(val).padStart(2, '0')}
      </div>
      <span className="text-[10px] sm:text-xs text-gray-500 mt-1 font-semibold uppercase tracking-wider">{label}</span>
    </div>
  );

  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 w-full bg-gray-50 border border-gray-100 rounded-2xl shadow-sm">
      <div className="flex items-center gap-2">
        <Clock className="w-5 h-5 shrink-0 animate-pulse" style={{ color }} />
        <span className="text-sm sm:text-base font-bold" style={{ color }}>L'offre expire bientôt !</span>
      </div>
      <div className="flex items-start gap-1 sm:gap-1.5">
        <Box val={timeLeft.d} label="Jours" />
        <span className="text-xl font-bold mt-1.5 sm:mt-2 text-gray-300">:</span>
        <Box val={timeLeft.h} label="Heures" />
        <span className="text-xl font-bold mt-1.5 sm:mt-2 text-gray-300">:</span>
        <Box val={timeLeft.m} label="Min" />
        <span className="text-xl font-bold mt-1.5 sm:mt-2 text-gray-300">:</span>
        <Box val={timeLeft.s} label="Sec" />
      </div>
    </div>
  );
};

// Stock Urgency Bar Component
const StockUrgencyBarInline = ({ stock, maxStock, color, text }: { stock: number; maxStock: number; color: string; text?: string }) => {
  const pct = Math.min((stock / maxStock) * 100, 100);
  return (
    <div className="space-y-2 py-1">
      <div className="flex items-center gap-2 text-sm font-bold" style={{ color }}>
        <span className="animate-pulse">🔥</span> 
        <span>{text || `Dépêchez-vous ! Il ne reste que ${stock} article${stock > 1 ? "s" : ""} en stock.`}</span>
      </div>
      <div className="w-full h-2.5 rounded-full bg-gray-100 overflow-hidden shadow-inner border border-gray-200/50">
        <div className="h-full rounded-full transition-all duration-1000 shadow-sm" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
    </div>
  );
};

interface Product {
  id: string;
  slug?: string | null;
  name: string;
  description: string | null;
  short_description: string | null;
  price: number;
  compare_at_price: number | null;
  category: string | null;
  stock_quantity: number | null;
  is_featured: boolean | null;
  is_digital: boolean | null;
  is_published: boolean | null;
  currency: string | null;
  bundle_offers?: { quantity: number; price: number; label?: string }[] | null;
  bundle_position?: string | null;
  variants?: { name: string; options: string[] }[] | null;
  section_order?: any;
  product_images: { id: string; image_url: string; is_primary: boolean; display_order: number | null }[];
}

interface CartItem { product: Product; quantity: number; selectedVariants?: Record<string, string>; }
interface ChatMessage { role: "user" | "assistant"; content: string; }

const sortProductImages = (images?: Product["product_images"] | null) =>
  [...(images || [])].sort((a, b) => {
    if (!!a.is_primary !== !!b.is_primary) return a.is_primary ? -1 : 1;
    return (a.display_order ?? 0) - (b.display_order ?? 0);
  });

const ProductView = () => {
  const { slug, id, productSlug } = useParams<{ slug?: string; id?: string; productSlug?: string }>();
  const [searchParams] = useSearchParams();
  const productId = searchParams.get("product");
  const navigate = useNavigate();

  // Defer non-critical widgets (social proof, AI chat, reviews) until the LCP
  // image + order button are paint-stable. Massive boost for ad-traffic LCP.
  const deferredReady = useDeferredMount(1500);

  const [shop, setShop] = useState<any>(null);
  const [product, setProduct] = useState<Product | null>(null);
  const [relatedProducts, setRelatedProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [selectedImageIdx, setSelectedImageIdx] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const [selectedBundleIdx, setSelectedBundleIdx] = useState<number | null>(null);
  const [selectedVariants, setSelectedVariants] = useState<Record<string, string>>({});

  // Cart state
  const [cart, setCart] = useState<CartItem[]>([]);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [checkoutStep, setCheckoutStep] = useState<"cart" | "info" | "confirm">("cart");
  const [showInlineCheckout, setShowInlineCheckout] = useState(false);
  const [orderLoading, setOrderLoading] = useState(false);
  const [orderSuccess, setOrderSuccess] = useState(false);
  const [customerInfo, setCustomerInfo] = useState({
    name: "", phone: "", email: "", address: "", city: "", paymentMethod: "cash_on_delivery",
  });
  const [cityError, setCityError] = useState("");

  // Chat
  const [chatOpen, setChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [themeSettings, setThemeSettings] = useState<ProductThemeSettings | null>(null);
  const [productAudios, setProductAudios] = useState<ProductAudio[]>([]);
  const chatEndRef = useRef<HTMLDivElement>(null);
  // Guard against duplicate order submissions (double-tap on mobile, double-click,
  // Enter key spam). Uses a ref so state updates cannot race the second click.
  const submittingOrderRef = useRef(false);

  // Sync cart with current quantity when user changes quantity while inline checkout is open
  useEffect(() => {
    if (showInlineCheckout && product) {
      setCart(prev => {
        const existing = prev.find(item => item.product.id === product.id);
        if (existing && existing.quantity !== quantity) {
          return prev.map(item => item.product.id === product.id ? { ...item, quantity } : item);
        }
        return prev;
      });
    }
  }, [quantity, showInlineCheckout, product]);

  useEffect(() => { fetchData(); }, [slug, id, productId, productSlug]);

  // Charge thème + témoignages audio (lecture publique via RLS)
  useEffect(() => {
    if (!product?.id) {
      setThemeSettings(null);
      setProductAudios([]);
      return;
    }
    let cancel = false;
    (async () => {
      const [ts, audios] = await Promise.all([
        fetchProductThemeSettings(product.id),
        fetchProductAudios(product.id, true),
      ]);
      if (cancel) return;
      setThemeSettings(ts);
      setProductAudios(audios);
    })();
    return () => {
      cancel = true;
    };
  }, [product?.id]);

  // NOTE: re-fetch on tab focus/visibility was removed (2026-06) — it caused
  // unnecessary full reloads when the user simply switched tabs and made the
  // page feel slow. The in-memory cache + mount fetch are sufficient.

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
      await new Promise((r) => setTimeout(r, 350 * Math.pow(2, i)));
    }
    return { data: null, error: lastErr };
  };

  const fetchData = async () => {
    if ((!slug && !id) || (!productId && !productSlug)) { setLoading(false); return; }
    setFetchError(null);
    // Stale-while-revalidate from in-memory cache so jumping back from the
    // shop to a product (or product → product) feels instant.
    const shopCacheK = id ? shopKey(id, "id") : slug ? shopKey(slug, "slug") : null;
    let hydrated = false;
    if (shopCacheK) {
      const cachedShop = cacheGet<any>(shopCacheK);
      if (cachedShop) {
        setShop(cachedShop);
        const pKey = productKey(cachedShop.id, (productSlug || productId) as string);
        const cachedProduct = cacheGet<any>(pKey);
        if (cachedProduct) {
          setProduct(cachedProduct);
          hydrated = true;
          setLoading(false);
          if (cacheIsFresh(shopCacheK) && cacheIsFresh(pKey)) return;
        }
      }
    }
    if (!hydrated) setLoading(true);
    try {
      // ── ULTRA-FAST PATH: in-flight RPC started from index.html BEFORE the
      // JS bundle finished loading. Saves 400-1500 ms on ad-traffic cold loads.
      try {
        const preload: any = (window as any).__vpProductPreload;
        if (preload && preload.slug === slug && preload.productSlug === productSlug && preload.promise) {
          const rpc = await preload.promise;
          (window as any).__vpProductPreload = null;
          if (rpc && rpc.shop && rpc.product) {
            const shopData = rpc.shop;
            const productData = rpc.product;
            productData.product_images = sortProductImages(productData.product_images);
            setShop(shopData);
            setProduct(productData);
            setRelatedProducts(Array.isArray(rpc.related) ? rpc.related : []);
            if (shopCacheK) cacheSet(shopCacheK, shopData);
            if (productData.slug) cacheSet(productKey(shopData.id, productData.slug), productData);
            cacheSet(productKey(shopData.id, productData.id), productData);
            setLoading(false);
            // Fire pixels / analytics asynchronously without blocking.
            queueMicrotask(() => {
              try {
                let sid = sessionStorage.getItem("vp_visit_session");
                if (!sid) {
                  sid = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
                  sessionStorage.setItem("vp_visit_session", sid);
                }
                supabase.functions.invoke("track-shop-visit", { body: { shop_id: shopData.id, product_id: productData.id, session_id: sid, referrer: document.referrer, page_path: window.location.pathname, url_search: window.location.search } }).then(() => {}, () => {});
              } catch {}
              if (shopData.chatbot_enabled) {
                setChatMessages([{ role: "assistant", content: shopData.chatbot_welcome_message || "Bienvenue ! Comment puis-je vous aider ?" }]);
              }
              try {
                initShopPixels(shopData);
                trackEvent(shopData, "PageView");
                trackEvent(shopData, "ViewContent", {
                  value: productData.price,
                  content_ids: [productData.id],
                  content_name: productData.name,
                  content_type: "product",
                  contents: [{ id: productData.id, quantity: 1, item_price: productData.price }],
                });
              } catch {}
            });
            return;
          }
        }
      } catch (e) {
        console.warn("[ProductView] preload path failed", e);
      }

      // ── FAST PATH: single RPC that returns shop + product + images + related.
      // Falls through to the legacy multi-query path on any failure (zero risk).
      if (slug && productSlug) {
        try {
          const { data: rpc, error: rpcErr } = await fetchWithRetry(() =>
            supabase.rpc("get_public_product_page" as any, {
              p_shop_slug: slug,
              p_product_slug: productSlug,
            })
          ) as any;
          if (!rpcErr && rpc && rpc.shop && rpc.product) {
            const shopData = rpc.shop;
            const productData = rpc.product;
            productData.product_images = sortProductImages(productData.product_images);
            setShop(shopData);
            setProduct(productData);
            setRelatedProducts(Array.isArray(rpc.related) ? rpc.related : []);
            if (shopCacheK) cacheSet(shopCacheK, shopData);
            if (productData.slug) cacheSet(productKey(shopData.id, productData.slug), productData);
            cacheSet(productKey(shopData.id, productData.id), productData);

            // Fire-and-forget analytics + pixels (do not block render).
            try {
              let sid = sessionStorage.getItem("vp_visit_session");
              if (!sid) {
                sid = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
                sessionStorage.setItem("vp_visit_session", sid);
              }
              supabase.functions.invoke("track-shop-visit", { body: { shop_id: shopData.id, product_id: productData.id, session_id: sid, referrer: document.referrer, page_path: window.location.pathname, url_search: window.location.search } }).then(() => {}, () => {});
            } catch {}
            try {
              const iconHref = String(shopData.favicon_url || shopData.logo_url || "/favicon.png");
              document.head
                .querySelectorAll("link[rel~='icon'], link[rel='shortcut icon'], link[rel='apple-touch-icon']")
                .forEach((el) => el.parentNode?.removeChild(el));
              (["icon", "shortcut icon", "apple-touch-icon"] as const).forEach((rel) => {
                const l = document.createElement("link");
                l.rel = rel;
                l.type = "image/png";
                l.href = `${iconHref}${iconHref.includes("?") ? "&" : "?"}v=${Date.now()}`;
                document.head.appendChild(l);
              });
            } catch {}
            if (shopData.chatbot_enabled) {
              setChatMessages([{ role: "assistant", content: shopData.chatbot_welcome_message || "Bienvenue ! Comment puis-je vous aider ?" }]);
            }
            try {
              initShopPixels(shopData);
              trackEvent(shopData, "PageView");
              trackEvent(shopData, "ViewContent", {
                value: productData.price,
                content_ids: [productData.id],
                content_name: productData.name,
                content_type: "product",
                contents: [{ id: productData.id, quantity: 1, item_price: productData.price }],
              });
            } catch {}
            setLoading(false);
            return;
          }
        } catch (e) {
          console.warn("[ProductView] RPC fast-path failed, falling back", e);
        }
      }

      let shopData: any = null;

      if (id) {
        const { data } = await fetchWithRetry(() => supabase.from("shops").select("*").eq("id", id).maybeSingle()) as any;
        if (data) shopData = { ...data, _isPreview: true };
      } else if (slug) {
        const { data: rows, error: shopErr } = await fetchWithRetry(() => supabase.rpc("get_public_shop_by_slug" as any, { p_slug: slug })) as any;
        const live = rows?.[0];
        if (live) shopData = live;
        else {
          const { data: pRows } = await fetchWithRetry(() => supabase.from("shops").select("*").eq("slug", slug).limit(1)) as any;
          if (pRows?.[0]) {
            // Only expose the "preview / not activated" mode to the shop
            // owner. For regular public visitors, treat the shop as a normal
            // live storefront so ordering keeps working even when the owner
            // account is locked / awaiting the 12 000 FCFA commission payment.
            const { data: { session } } = await supabase.auth.getSession();
            const isOwner = !!session && session.user.id === pRows[0].user_id;
            shopData = isOwner ? { ...pRows[0], _isPreview: true } : pRows[0];
          } else if (shopErr) setFetchError("Connexion lente : impossible de charger cette boutique pour le moment.");
        }
      }

      if (!shopData) return;
      setShop(shopData);
      if (shopCacheK) cacheSet(shopCacheK, shopData);

      const loadProduct = (field: "slug" | "id", value: string) => {
        let query = supabase
          .from("products")
          .select("*, product_images(*)")
          .eq("shop_id", shopData.id)
          .eq(field, value);
        if (!shopData._isPreview) query = query.eq("is_published", true);
        return query.maybeSingle();
      };

      let productData: any = null;
      if (productSlug) {
        const bySlug = await fetchWithRetry(() => loadProduct("slug", productSlug));
        productData = bySlug.data;
      }
      if (!productData && productId) {
        const byId = await fetchWithRetry(() => loadProduct("id", productId));
        productData = byId.data;
      }

      if (productData) {
        productData.product_images = sortProductImages(productData.product_images);
        setProduct(productData);
        // Cache by both slug and id so either URL form hits the cache.
        if (productData.slug) cacheSet(productKey(shopData.id, productData.slug), productData);
        cacheSet(productKey(shopData.id, productData.id), productData);

        // Load related products in background — do not block product render.
        // The "you might also like" section can appear a moment later.
        fetchWithRetry(() => supabase
          .from("products")
          .select("*, product_images(*)")
          .eq("shop_id", shopData.id)
          .neq("id", productData.id)
          .eq("is_published", true)
          .limit(4)).then((res: any) => {
            setRelatedProducts(res?.data || []);
          }, () => {});
      } else if (!hydrated) {
        // Distinguish a real "not found" from a slow-network timeout so the
        // user sees the retry button instead of a misleading "Ce produit
        // n'existe pas" — the #1 source of bogus "ma boutique ne marche pas"
        // reports.
        setFetchError(
          "Connexion lente détectée. Réessayez — votre produit existe bien."
        );
      }

      if (productData && !shopData._isPreview) {
        // Fire-and-forget analytics insert; never block product page render.
        try {
          let sid = sessionStorage.getItem("vp_visit_session");
          if (!sid) {
            sid = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
            sessionStorage.setItem("vp_visit_session", sid);
          }
          supabase.functions.invoke("track-shop-visit", { body: { shop_id: shopData.id, product_id: productData.id, session_id: sid, referrer: document.referrer, page_path: window.location.pathname, url_search: window.location.search } }).then(() => {}, () => {});
        } catch {}
      }

      try {
        // Page title and social meta are handled by <Helmet> in the main render
        const iconHref = String(shopData.favicon_url || shopData.logo_url || "/favicon.png");
        document.head
          .querySelectorAll("link[rel~='icon'], link[rel='shortcut icon'], link[rel='apple-touch-icon']")
          .forEach((el) => el.parentNode?.removeChild(el));
        (["icon", "shortcut icon", "apple-touch-icon"] as const).forEach((rel) => {
          const l = document.createElement("link");
          l.rel = rel;
          l.type = "image/png";
          l.href = `${iconHref}${iconHref.includes("?") ? "&" : "?"}v=${Date.now()}`;
          document.head.appendChild(l);
        });
      } catch {}

      if (shopData.chatbot_enabled) {
        setChatMessages([{ role: "assistant", content: shopData.chatbot_welcome_message || "Bienvenue ! Comment puis-je vous aider ?" }]);
      }

      if (!shopData._isPreview && productData) {
        try {
          initShopPixels(shopData);
          trackEvent(shopData, "PageView");
          trackEvent(shopData, "ViewContent", {
            value: productData.price,
            content_ids: [productData.id],
            content_name: productData.name,
            content_type: "product",
            contents: [{ id: productData.id, quantity: 1, item_price: productData.price }],
          });
        } catch (e) {
          console.warn("[tracking] product page init failed", e);
        }
      }
    } catch (error) {
      console.warn("[ProductView] load failed", error);
      setFetchError("Connexion lente : impossible de charger cette fiche produit pour le moment.");
    } finally {
      setLoading(false);
    }
  };

  const formatPrice = (n: number) => new Intl.NumberFormat("fr-FR").format(n);
  const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0);
  const cartTotal = cart.reduce((sum, item) => sum + item.product.price * item.quantity, 0);

  const addToCart = (prod: Product, qty: number = 1, replace: boolean = false, silent: boolean = false) => {
    // Validate variants
    const variantGroups = Array.isArray(prod.variants) ? prod.variants : [];
    const isCurrent = product && prod.id === product.id;
    const chosen = isCurrent ? selectedVariants : {};
    const missing = variantGroups.filter(g => g?.name && Array.isArray(g?.options) && g.options.length > 0 && !chosen[g.name]);
    if (missing.length > 0) {
      toast({ title: "Sélection requise", description: `Choisissez : ${missing.map(m => m.name).join(", ")}`, variant: "destructive" });
      return;
    }
    setCart(prev => {
      const existing = prev.find(item => item.product.id === prod.id);
      if (existing) return prev.map(item => item.product.id === prod.id ? { ...item, quantity: replace ? qty : item.quantity + qty, selectedVariants: isCurrent ? chosen : item.selectedVariants } : item);
      return [...prev, { product: prod, quantity: qty, selectedVariants: isCurrent ? chosen : undefined }];
    });
    if (!silent) toast({ title: "✓ Ajouté au panier", description: prod.name });
    trackEvent(shop, "AddToCart", {
      value: prod.price * qty,
      content_ids: [prod.id],
      content_name: prod.name,
      content_type: "product",
      contents: [{ id: prod.id, quantity: qty, item_price: prod.price }],
      num_items: qty,
    });
  };

  const updateQuantity = (productId: string, delta: number) => {
    setCart(prev => prev.map(item => {
      if (item.product.id !== productId) return item;
      const newQty = item.quantity + delta;
      return newQty <= 0 ? item : { ...item, quantity: newQty };
    }).filter(item => item.quantity > 0));
  };

  const removeFromCart = (productId: string) => setCart(prev => prev.filter(item => item.product.id !== productId));

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
      if (itemsError) console.error("[ProductView] order_items insert failed", itemsError);
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
      setShowInlineCheckout(false);
      setCheckoutOpen(false);
      setCustomerInfo({ name: "", phone: "", email: "", address: "", city: "", paymentMethod: "cash_on_delivery" });
      setCityError("");
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
        body: { message: userMsg, shopName: shop.business_name, shopDescription: shop.business_description, products: [] },
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
      {/* Header skeleton */}
      <div className="border-b sticky top-0 z-40 bg-white">
        <div className="max-w-6xl mx-auto px-3 sm:px-4 py-2.5 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="h-8 w-8 rounded-lg bg-gray-200 animate-pulse" />
            <div className="h-4 w-32 rounded bg-gray-200 animate-pulse" />
          </div>
          <div className="h-9 w-20 rounded-lg bg-gray-200 animate-pulse" />
        </div>
      </div>
      {/* Product hero skeleton */}
      <section className="max-w-6xl mx-auto px-3 sm:px-6 py-6 sm:py-10">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-10">
          <div className="aspect-square rounded-xl bg-gray-100 animate-pulse" />
          <div className="space-y-4">
            <div className="h-7 w-3/4 rounded bg-gray-200 animate-pulse" />
            <div className="h-5 w-1/2 rounded bg-gray-200 animate-pulse" />
            <div className="h-10 w-40 rounded bg-gray-200 animate-pulse" />
            <div className="space-y-2 pt-2">
              <div className="h-3 w-full rounded bg-gray-100 animate-pulse" />
              <div className="h-3 w-11/12 rounded bg-gray-100 animate-pulse" />
              <div className="h-3 w-10/12 rounded bg-gray-100 animate-pulse" />
            </div>
            <div className="h-12 w-full rounded-xl bg-gray-200 animate-pulse mt-4" />
          </div>
        </div>
      </section>
    </div>
  );

  if (!shop || !product) return (
    <div className="min-h-screen flex items-center justify-center flex-col gap-4 bg-white">
      <Store className="h-20 w-20 text-gray-300" />
      <h1 className="text-2xl font-bold text-gray-800">{fetchError ? "Chargement impossible" : "Produit introuvable"}</h1>
      <p className="text-gray-500 text-center px-4">
        {fetchError || "Ce produit n'existe pas ou n'est plus disponible"}
      </p>
      {fetchError && (
        <Button onClick={fetchData} className="mt-2">
          Réessayer
        </Button>
      )}
    </div>
  );

  const primaryColor = shop.primary_color || "#2563eb";
  const themeConfig = shop.theme_config || {};
  const hasReviewBar = Boolean(themeConfig.review_bar_desktop_content || themeConfig.review_bar_mobile_content);
  const images = product.product_images || [];
  const discount = product.compare_at_price && product.compare_at_price > product.price
    ? Math.round((1 - product.price / product.compare_at_price) * 100)
    : 0;

  const goToShop = () => {
    if (shop._isPreview) navigate(`/shop-preview/${shop.id}`);
    else navigate(`/shop/${shop.slug}`);
  };

  const productTitle = `${product.name} — ${shop.business_name}`;
  const productDescription = product.short_description || product.description || shop.business_description || "";
  const primaryImage = images.find((img) => img.is_primary)?.image_url || images[0]?.image_url || shop.logo_url || "";
  const customPageStyle = buildProductPageStyle(themeSettings);

  const isCustomTheme = !!themeSettings?.theme_slug && !new URLSearchParams(window.location.search).get("classic");

  const checkoutContent = (
    <>
      {/* Inline Checkout */}
      {(showInlineCheckout || cart.length > 0) && !orderSuccess && (
        <div id="inline-checkout" className={isCustomTheme ? "space-y-4 relative" : "mt-6 sm:mt-8 bg-white border shadow-xl rounded-3xl p-5 sm:p-8 space-y-5 sm:space-y-6 scroll-mt-24 relative z-50"} style={isCustomTheme ? {} : { borderColor: primaryColor + "30" }}>
          <h3 className="font-bold text-lg sm:text-xl flex items-center gap-2 mb-1" style={{ color: primaryColor }}>
            <CreditCard className="h-5 w-5" /> Finaliser votre commande
          </h3>

          {/* Variants for Custom Themes where they can't be selected outside */}
          {isCustomTheme && Array.isArray(product?.variants) && product.variants.length > 0 && cart.length === 0 && (
            <div className="p-4 bg-orange-50 border border-orange-200 rounded-xl space-y-4 mb-4">
              <h4 className="font-bold text-sm text-orange-800">Veuillez choisir vos options avant de commander :</h4>
              {product.variants.map((group: any, idx: number) => (
                group?.name && Array.isArray(group?.options) && group.options.length > 0 ? (
                  <div key={idx} className="space-y-1.5">
                    <Label className="font-bold text-xs">{group.name}</Label>
                    <div className="flex flex-wrap gap-2">
                      {group.options.map((opt: string) => (
                        <button
                          key={opt}
                          type="button"
                          onClick={() => setSelectedVariants(prev => ({ ...prev, [group.name]: opt }))}
                          className={`px-3 py-1.5 text-xs rounded-lg font-medium transition-all ${
                            selectedVariants[group.name] === opt
                              ? "bg-gray-900 text-white shadow-sm"
                              : "bg-white border text-gray-700 hover:bg-gray-50"
                          }`}
                          style={selectedVariants[group.name] === opt ? { backgroundColor: primaryColor } : {}}
                        >
                          {opt}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : null
              ))}
              <Button 
                type="button"
                className="w-full h-11 text-white font-bold rounded-xl" 
                style={{ backgroundColor: primaryColor }}
                onClick={() => addToCart(product, quantity, true, false)}
              >
                Valider mes choix
              </Button>
            </div>
          )}

          {/* Main Checkout Fields - Hide if Custom Theme and Cart is empty (requires variant selection) */}
          {(!isCustomTheme || cart.length > 0) && (
            <>
              {/* Order Summary (Rich) */}
              <div className="bg-gray-50 rounded-2xl p-4 flex flex-col gap-3 border border-gray-100 mb-6">
                <div className="flex items-center gap-1.5 mb-1"><ShoppingCart className="h-4 w-4" style={{ color: primaryColor }} /><h4 className="font-bold text-[15px]">Récapitulatif</h4></div>
                
                {cart.map(item => (
                  <div key={item.product.id} className="flex gap-3 bg-white p-3 rounded-xl border border-gray-100 shadow-sm">
                    {/* Image */}
                    {item.product.images?.[0] ? (
                      <div className="w-16 h-16 shrink-0 rounded-lg overflow-hidden bg-gray-100">
                        <img src={item.product.images[0]} alt={item.product.name} className="w-full h-full object-cover" />
                      </div>
                    ) : primaryImage ? (
                      <div className="w-16 h-16 shrink-0 rounded-lg overflow-hidden bg-gray-100">
                        <img src={primaryImage} alt={item.product.name} className="w-full h-full object-cover" />
                      </div>
                    ) : (
                      <div className="w-16 h-16 shrink-0 rounded-lg overflow-hidden bg-gray-100 flex items-center justify-center">
                        <ShoppingBag className="h-6 w-6 text-gray-300" />
                      </div>
                    )}
                    
                    <div className="flex flex-col flex-1 justify-center min-w-0">
                      <p className="font-bold text-[14px] text-gray-900 truncate leading-tight">{item.product.name}</p>
                      
                      {/* Variants & Bundles */}
                      {(Object.keys(item.variants || {}).length > 0 || item.bundle) && (
                        <div className="text-[12px] text-gray-500 mt-0.5 line-clamp-1">
                          {item.bundle && <span className="font-medium text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded mr-1">Offre : {item.bundle.name}</span>}
                          {Object.entries(item.variants || {}).map(([k, v]) => `${v}`).join(", ")}
                        </div>
                      )}
                      
                      <div className="flex items-center justify-between mt-2">
                        <span className="font-black text-[15px]" style={{ color: primaryColor }}>{formatPrice(item.product.price * item.quantity)} FCFA</span>
                        
                        {/* Quantity Selector */}
                        <div className="flex items-center bg-gray-50 border border-gray-200 rounded-lg h-7">
                          <button type="button" onClick={() => updateQuantity(item.product.id, -1)} className="w-7 h-full flex items-center justify-center text-gray-500 hover:text-gray-900 transition-colors">
                            <Minus className="h-3 w-3" />
                          </button>
                          <span className="w-7 text-center text-[13px] font-bold text-gray-900">{item.quantity}</span>
                          <button type="button" onClick={() => updateQuantity(item.product.id, 1)} className="w-7 h-full flex items-center justify-center text-gray-500 hover:text-gray-900 transition-colors">
                            <Plus className="h-3 w-3" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
                
                <div className="border-t border-gray-200 pt-3 mt-1 flex justify-between items-end">
                  <span className="text-xs text-gray-500 font-bold uppercase tracking-wider">Total à payer</span>
                  <span className="font-black text-xl leading-none" style={{ color: primaryColor }}>{formatPrice(cartTotal)} FCFA</span>
                </div>
              </div>

              {/* Contact - respects checkout_fields */}
              {(() => {
                const cf: any[] = shop.checkout_fields || [];
                const isEnabled = (id: string) => {
                  const f = cf.find((x: any) => x.id === id);
                  return f ? !!f.enabled : ["first_name","phone","city","address"].includes(id);
                };
                const isRequired = (id: string) => {
                  const f = cf.find((x: any) => x.id === id);
                  return f ? !!f.required : ["first_name","phone","city"].includes(id);
                };
                const showFullName = isEnabled("first_name") && isEnabled("last_name");
                const showFirstOnly = isEnabled("first_name") && !isEnabled("last_name");
                const nameLabel = showFullName ? "Nom complet" : showFirstOnly ? "Prénom" : isEnabled("last_name") ? "Nom" : "Nom";
                return (
                  <div className="space-y-3">
                    <div className="flex items-center gap-1.5"><User className="h-4 w-4" style={{ color: primaryColor }} /><h4 className="font-bold text-[15px]">Informations de livraison</h4></div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {isEnabled("first_name") && (
                        <div className="space-y-1 sm:col-span-2">
                          <Label className="text-[13px] font-semibold text-gray-700">{nameLabel} {isRequired("first_name") && "*"}</Label>
                          <Input value={customerInfo.name} onChange={(e) => setCustomerInfo({ ...customerInfo, name: e.target.value })} placeholder={showFirstOnly ? "Jean" : "Jean Kouassi"} className="rounded-xl h-11 text-[15px] bg-gray-50 border-gray-200 focus:bg-white transition-colors" />
                        </div>
                      )}
                      {isEnabled("phone") && (
                        <div className="space-y-1">
                          <Label className="text-[13px] font-semibold text-gray-700">Téléphone {isRequired("phone") && "*"}</Label>
                          <PhoneInput
                            value={customerInfo.phone}
                            onChange={(v) => setCustomerInfo({ ...customerInfo, phone: v })}
                            defaultCountryHint={shop?.country}
                            required={isRequired("phone")}
                            inputClassName="h-11 text-[15px] bg-gray-50 border-gray-200 focus:bg-white transition-colors"
                          />
                        </div>
                      )}
                      {isEnabled("email") && (
                        <div className="space-y-1">
                          <Label className="text-[13px] font-semibold text-gray-700">Email {isRequired("email") && "*"}</Label>
                          <Input type="email" value={customerInfo.email} onChange={(e) => setCustomerInfo({ ...customerInfo, email: e.target.value })} placeholder="jean@email.com" className="rounded-xl h-11 text-[15px] bg-gray-50 border-gray-200 focus:bg-white transition-colors" />
                        </div>
                      )}
                      {isEnabled("city") && (
                        <div className="space-y-1">
                          <Label className="text-[13px] font-semibold text-gray-700">Ville {isRequired("city") && "*"}</Label>
                          <Input value={customerInfo.city} onChange={(e) => {
                            const raw = e.target.value;
                            const cleaned = stripDigits(raw);
                            setCustomerInfo({ ...customerInfo, city: cleaned });
                            if (containsDigits(raw)) setCityError("La ville ne doit pas contenir de chiffres.");
                            else if (cityError) setCityError("");
                          }} placeholder="Abidjan" className={`rounded-xl h-11 text-[15px] bg-gray-50 border-gray-200 focus:bg-white transition-colors ${cityError ? "border-red-500 focus-visible:ring-red-500" : ""}`} />
                          {cityError && <p className="text-xs text-red-500">{cityError}</p>}
                        </div>
                      )}
                      {isEnabled("address") && (
                        <div className="space-y-1 sm:col-span-2">
                          <Label className="text-[13px] font-semibold text-gray-700">Adresse détaillée {isRequired("address") && "*"}</Label>
                          <Input value={customerInfo.address} onChange={(e) => setCustomerInfo({ ...customerInfo, address: e.target.value })} placeholder="Ex: Cocody, Riviera 3, Rue L25" className="rounded-xl h-11 text-[15px] bg-gray-50 border-gray-200 focus:bg-white transition-colors" />
                        </div>
                      )}
                    </div>
                  </div>
                );
              })()}

              {/* Payment Method */}
              <div className="space-y-3">
                <div className="flex items-center gap-1.5"><CreditCard className="h-4 w-4" style={{ color: primaryColor }} /><h4 className="font-bold text-[15px]">Méthode de paiement</h4></div>
                
                {shop.theme_config?.force_mobile_money_interior && customerInfo.city && !isAbidjanZone(customerInfo.city) && (
                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs sm:text-[13px] text-amber-800">
                    <span className="font-semibold">⚠️ Vous êtes hors Abidjan :</span> Le paiement par Mobile Money est obligatoire pour l'expédition de votre colis.
                  </div>
                )}

                {(() => {
                  const isInterior = shop.theme_config?.force_mobile_money_interior && customerInfo.city && !isAbidjanZone(customerInfo.city);
                  const methods = isInterior
                    ? [{ value: "mobile_money", label: "Mobile Money", icon: "📱" }]
                    : [
                        { value: "cash_on_delivery", label: "Paiement à la livraison", icon: "💵" },
                        { value: "mobile_money", label: "Mobile Money", icon: "📱" },
                      ];
                  
                  if (isInterior && customerInfo.paymentMethod !== 'mobile_money') {
                    setTimeout(() => setCustomerInfo(prev => ({ ...prev, paymentMethod: 'mobile_money' })), 0);
                  }

                  return (
                    <div className="grid grid-cols-2 gap-2">
                      {methods.map(method => (
                        <button key={method.value} onClick={() => setCustomerInfo({ ...customerInfo, paymentMethod: method.value })}
                          className={`relative flex flex-col items-center justify-center gap-1.5 p-3 rounded-xl border-2 transition-all text-center ${customerInfo.paymentMethod === method.value ? "shadow-sm bg-gray-50/50" : "border-gray-100 hover:border-gray-200 bg-transparent"}`}
                          style={customerInfo.paymentMethod === method.value ? { borderColor: primaryColor, backgroundColor: primaryColor + "08" } : {}}
                        >
                          {customerInfo.paymentMethod === method.value && <div className="absolute top-1.5 right-1.5"><CheckCircle2 className="h-4 w-4" style={{ color: primaryColor }} /></div>}
                          <span className="text-2xl mb-0.5">{method.icon}</span>
                          <span className="font-bold text-[13px] text-gray-800 leading-tight">{method.label}</span>
                        </button>
                      ))}
                    </div>
                  );
                })()}
              </div>

              {(() => {
                const cf: any[] = shop.checkout_fields || [];
                const isEnabled = (id: string) => {
                  const f = cf.find((x: any) => x.id === id);
                  return f ? !!f.enabled : ["first_name","phone","city","address"].includes(id);
                };
                const isRequired = (id: string) => {
                  const f = cf.find((x: any) => x.id === id);
                  return f ? !!f.required : ["first_name","phone","city"].includes(id);
                };
                const canSubmit =
                  (!isEnabled("first_name") || !isRequired("first_name") || !!customerInfo.name) &&
                  (!isEnabled("phone") || (!isRequired("phone") && !customerInfo.phone) || isValidFullPhone(customerInfo.phone)) &&
                  (!isEnabled("email") || !isRequired("email") || !!customerInfo.email) &&
                  (!isEnabled("city") || !isRequired("city") || !!customerInfo.city) &&
                  (!isEnabled("city") || !containsDigits(customerInfo.city)) &&
                  (!isEnabled("address") || !isRequired("address") || !!customerInfo.address);
                return (
                  <div className="pt-2">
                    <Button 
                      className="w-full h-12 sm:h-14 rounded-xl text-[15px] sm:text-lg font-bold gap-2 text-white shadow-md hover:shadow-lg transition-all"
                      style={{ backgroundColor: primaryColor }}
                      onClick={placeOrder} 
                      disabled={orderLoading || !canSubmit}
                    >
                      {orderLoading ? "Traitement en cours..." : <><ShoppingCart className="h-5 w-5" /> Confirmer ma commande</>}
                    </Button>
                  </div>
                );
              })()}
            </>
          )}
        </div>
      )}

      {/* Inline order success */}
      {orderSuccess && (
        <div id="inline-checkout" className="mt-8 border-2 border-green-200 rounded-2xl p-8 text-center bg-green-50 shadow-lg relative z-50 scroll-mt-24">
          <div className="h-20 w-20 mx-auto rounded-full flex items-center justify-center mb-6 bg-green-100">
            <CheckCircle2 className="h-10 w-10 text-green-600" />
          </div>
          <h3 className="text-2xl font-bold mb-3 text-green-800">Commande confirmée ! 🎉</h3>
          <p className="text-green-700 text-lg">Le vendeur vous contactera sous peu pour la livraison.</p>
        </div>
      )}
    </>
  );

  const checkoutContainer = isCustomTheme ? (
    <Dialog open={showInlineCheckout} onOpenChange={setShowInlineCheckout}>
      <DialogContent className="w-[95vw] max-w-lg mx-auto rounded-3xl max-h-[90vh] overflow-y-auto p-4 sm:p-6 bg-white z-[99999]" style={{ zIndex: 99999 }}>
        <DialogHeader className="sr-only">
          <DialogTitle>Finaliser votre commande</DialogTitle>
        </DialogHeader>
        {checkoutContent}
      </DialogContent>
    </Dialog>
  ) : (
    <div className="max-w-3xl mx-auto w-full px-4 pb-12">
      {checkoutContent}
    </div>
  );

  // Optional professional themes — only activates when a known theme_slug is set
  // on themeSettings and the URL does not force classic mode. Falls back to the
  // legacy view on error via internal reload.
  const globalOverlays = (
    <>
      {checkoutContainer}
      {/* Chatbot */}
      {shop.chatbot_enabled && (
        <>
          <button 
            onClick={() => setChatOpen(!chatOpen)} 
            className={`fixed right-4 sm:right-6 h-14 w-14 rounded-2xl shadow-xl flex items-center justify-center z-50 text-white transition-transform hover:scale-110 ${
              isCustomTheme 
                ? "bottom-24" 
                : (shop.theme_config?.sticky_order_button ? "bottom-24" : "bottom-6")
            }`} 
            style={{ backgroundColor: primaryColor }}
          >
            {chatOpen ? <X className="h-6 w-6" /> : <MessageCircle className="h-6 w-6" />}
          </button>
          {chatOpen && (
            <div className="fixed bottom-24 right-4 sm:right-6 w-80 md:w-96 bg-white border rounded-2xl shadow-2xl z-50 flex flex-col overflow-hidden" style={{ height: "420px" }}>
              <div className="px-4 py-3 border-b text-white font-semibold flex items-center gap-2" style={{ backgroundColor: primaryColor }}>
                <MessageCircle className="h-5 w-5" /> Assistant {shop.business_name}
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {chatMessages.map((msg, i) => (
                  <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                    <div className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm ${msg.role === "user" ? "text-white rounded-br-md" : "bg-gray-100 rounded-bl-md"}`} style={msg.role === "user" ? { backgroundColor: primaryColor } : {}}>
                      {msg.content}
                    </div>
                  </div>
                ))}
                {chatLoading && (
                  <div className="flex justify-start">
                    <div className="bg-gray-100 rounded-2xl rounded-bl-md px-4 py-2.5 text-sm">
                      <div className="flex gap-1"><div className="h-2 w-2 rounded-full bg-gray-400 animate-bounce" /><div className="h-2 w-2 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: "0.1s" }} /><div className="h-2 w-2 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: "0.2s" }} /></div>
                    </div>
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>
              <div className="p-3 border-t flex gap-2">
                <Input value={chatInput} onChange={(e) => setChatInput(e.target.value)} placeholder="Votre message..." onKeyDown={(e) => e.key === "Enter" && sendChatMessage()} className="flex-1 rounded-xl" />
                <Button size="icon" onClick={sendChatMessage} disabled={chatLoading} className="rounded-xl text-white" style={{ backgroundColor: primaryColor }}>
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Floating Cart - Mobile */}
      {!isCustomTheme && !shop._isPreview && cartCount > 0 && !showInlineCheckout && !shop.theme_config?.sticky_order_button && (
        <div className="fixed bottom-6 left-6 right-20 md:hidden z-40">
          <Button className="w-full h-14 rounded-2xl shadow-xl text-base font-semibold gap-2 text-white" style={{ backgroundColor: primaryColor }} onClick={() => { setShowInlineCheckout(true); setOrderSuccess(false); setTimeout(() => document.getElementById("inline-checkout")?.scrollIntoView({ behavior: "smooth", block: "start" }), 150); }}>
            <ShoppingBag className="h-5 w-5" /> Voir le panier · {formatPrice(cartTotal)} FCFA
            <Badge className="ml-auto bg-white/20 text-white">{cartCount}</Badge>
          </Button>
        </div>
      )}

      {/* Sticky Order Button - always visible when enabled */}
      {!isCustomTheme && !shop._isPreview && shop.theme_config?.sticky_order_button && product && !showInlineCheckout && (
        <div className="fixed bottom-4 left-4 right-4 z-[9999] bg-white rounded-2xl border shadow-[0_-4px_30px_rgba(0,0,0,0.15)] px-4 py-3">
          <div className="max-w-6xl mx-auto flex items-center gap-3">
            <div className="flex-1 min-w-0 hidden sm:block">
              <p className="font-bold text-sm truncate">{product.name}</p>
              <p className="font-bold text-lg" style={{ color: primaryColor }}>{formatPrice(product.price)} FCFA</p>
            </div>
            <Button 
              className="flex-1 sm:flex-none h-12 sm:h-14 rounded-xl font-bold flex items-center justify-between px-3 sm:px-6 text-white shadow-lg hover:shadow-xl transition-all animate-pulse hover:animate-none group"
              style={{ backgroundColor: primaryColor }}
              onClick={() => {
                addToCart(product, quantity, true, true);
                setShowInlineCheckout(true);
                setOrderSuccess(false);
                setTimeout(() => {
                  document.getElementById("inline-checkout")?.scrollIntoView({ behavior: "smooth", block: "start" });
                }, 150);
              }}
              disabled={product.stock_quantity !== null && product.stock_quantity <= 0}
            >
              <div className="flex items-center gap-2">
                <ShoppingCart className="h-5 w-5 sm:h-6 sm:w-6 shrink-0 group-hover:scale-110 transition-transform" />
                <span className="text-[15px] sm:text-lg whitespace-nowrap">
                  {product.stock_quantity !== null && product.stock_quantity <= 0 ? "Rupture de stock" : "Commander"}
                </span>
              </div>
              <div className="sm:hidden bg-white/20 backdrop-blur-sm px-2.5 py-1 rounded-lg text-[14px] font-extrabold whitespace-nowrap flex items-center">
                {formatPrice(product.price)} FCFA
              </div>
            </Button>
          </div>
        </div>
      )}

      {deferredReady && (
        <Suspense fallback={null}>
          <SocialProofNotification
            shopId={shop.id}
            enabled={shop.social_proof_enabled || false}
            productName={product?.name}
            productImage={images?.[0]?.image_url}
          />
          <ShopAIAssistant
            shopId={shop.id}
            shopName={shop.business_name}
            primaryColor={shop.primary_color}
            secondaryColor={shop.secondary_color}
          />
        </Suspense>
      )}
    </>
  );

  if (
    themeSettings?.theme_slug &&
    !new URLSearchParams(window.location.search).get("classic")
  ) {
    return (
      <>
        <Helmet>
          <title>{productTitle}</title>
          <meta name="description" content={productDescription} />
          <link rel="canonical" href={window.location.href} />
          <meta property="og:title" content={productTitle} />
          <meta property="og:description" content={productDescription} />
          <meta property="og:url" content={window.location.href} />
          <meta property="og:type" content="product" />
          {primaryImage && <meta property="og:image" content={primaryImage} />}
        </Helmet>
        <Suspense fallback={<div className="min-h-screen bg-white" />}>
          <LazyThemeRenderer
            product={product}
            shop={shop}
            audios={productAudios}
            settings={themeSettings}
            fallback={null}
            onCheckout={() => {
              addToCart(product, quantity, true, true);
              setShowInlineCheckout(true);
              setOrderSuccess(false);
              setTimeout(() => {
                document.getElementById("inline-checkout")?.scrollIntoView({ behavior: "smooth", block: "start" });
              }, 150);
            }}
          />
        </Suspense>
        {globalOverlays}
      </>
    );
  }

  return (
    <div
      className={`min-h-screen text-gray-900 ${customPageStyle ? "" : "bg-white"}`}
      style={customPageStyle}
    >
      <Helmet>
        <title>{productTitle}</title>
        <meta name="description" content={productDescription} />
        <link rel="canonical" href={window.location.href} />
        <meta property="og:title" content={productTitle} />
        <meta property="og:description" content={productDescription} />
        <meta property="og:url" content={window.location.href} />
        <meta property="og:type" content="product" />
        {primaryImage && <meta property="og:image" content={primaryImage} />}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={productTitle} />
        <meta name="twitter:description" content={productDescription} />
        {primaryImage && <meta name="twitter:image" content={primaryImage} />}
        <script type="application/ld+json">{JSON.stringify({
          "@context": "https://schema.org",
          "@type": "Product",
          "name": product.name,
          "description": productDescription,
          "image": images.map((img) => img.image_url),
          "sku": product.id,
          "brand": {
            "@type": "Brand",
            "name": shop.business_name
          },
          "offers": {
            "@type": "Offer",
            "url": window.location.href,
            "price": String(product.price),
            "priceCurrency": product.currency || "XOF",
            "availability": (product.stock_quantity === null || product.stock_quantity > 0)
              ? "https://schema.org/InStock"
              : "https://schema.org/OutOfStock",
            "priceValidUntil": new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split("T")[0]
          },
          "category": product.category || undefined
        })}</script>
      </Helmet>
      {/* Preview Banner */}
      {shop._isPreview && (
        <div className="bg-amber-500 text-white text-center py-2 px-4 text-sm font-medium sticky top-0 z-50">
          ⚠️ Mode prévisualisation — Cette boutique n'est pas encore en ligne
        </div>
      )}

      <ShopReviewBar themeConfig={themeConfig} placement="above" />

      {!hasReviewBar && (
        <div className="text-white text-center py-2.5 px-4 text-xs sm:text-sm font-semibold bg-gradient-to-r from-gray-900 via-gray-800 to-gray-900 shadow-md">
          🎁 Livraison gratuite &amp; Offre spéciale en cours — Profitez de nos meilleurs prix !
        </div>
      )}

      {/* Interior payment notice */}
      {shop.theme_config?.force_mobile_money_interior && (
        <div className="bg-amber-50 border-b border-amber-200 text-amber-900 text-center py-2.5 px-4 text-xs sm:text-sm">
          <span className="font-semibold">📢 Information importante :</span> Si vous êtes à l'intérieur du pays (hors Abidjan), le paiement par Mobile Money est obligatoire avant la validation de votre commande pour permettre l'expédition de votre colis.
        </div>
      )}

      {/* Header - conditionally hidden */}
      {!shop.theme_config?.hide_product_header && (
        <header
          className="border-b sticky top-0 z-40 bg-[var(--shop-header-mobile-bg)] md:bg-[var(--shop-header-desktop-bg)]"
          style={{
            "--shop-header-mobile-bg": themeConfig.header_mobile_bg || "#FFFFFF",
            "--shop-header-desktop-bg": themeConfig.header_desktop_bg || themeConfig.header_mobile_bg || "#FFFFFF",
            borderColor: themeConfig.header_mobile_border_color || themeConfig.header_desktop_border_color || "#e5e7eb",
          } as CSSProperties}
        >
          <div className="max-w-6xl mx-auto px-3 sm:px-4 py-2.5 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0 cursor-pointer" onClick={goToShop}>
              {shop.logo_url ? (
                <img src={thumbUrl(shop.logo_url, 128)} alt="" loading="eager" decoding="async" width={32} height={32} className="h-8 w-8 rounded-lg object-cover flex-shrink-0" />
              ) : (
                <div className="h-8 w-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: primaryColor + "15" }}>
                  <Store className="h-4 w-4" style={{ color: primaryColor }} />
                </div>
              )}
              <span className="font-bold text-sm sm:text-base truncate">{shop.business_name}</span>
            </div>

            <div className="flex items-center gap-2">
              {shop.whatsapp_number && (
                <a href={`https://wa.me/${shop.whatsapp_number.replace(/[^0-9]/g, "")}`} target="_blank" rel="noopener noreferrer">
                  <Button variant="ghost" size="icon" className="h-9 w-9 rounded-lg">
                    <Phone className="h-4 w-4" />
                  </Button>
                </a>
              )}
              <Button 
                variant="outline" 
                className="gap-1.5 rounded-lg relative h-9 px-3" 
                onClick={() => { setShowInlineCheckout(true); setOrderSuccess(false); setTimeout(() => document.getElementById("inline-checkout")?.scrollIntoView({ behavior: "smooth", block: "start" }), 150); }}
              >
                <ShoppingBag className="h-4 w-4" />
                <span className="hidden sm:inline text-sm">Panier</span>
                {cartCount > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 h-5 w-5 rounded-full text-[10px] font-bold flex items-center justify-center text-white" style={{ backgroundColor: primaryColor }}>
                    {cartCount}
                  </span>
                )}
              </Button>
            </div>
          </div>

          {/* Secondary nav */}
          <div className="border-t bg-gray-50">
            <div className="max-w-6xl mx-auto px-3 sm:px-4 py-1.5 flex items-center gap-2 text-xs text-gray-500">
              <button onClick={goToShop} className="hover:text-gray-800 flex items-center gap-1">
                <ArrowLeft className="h-3 w-3" /> Accueil
              </button>
              <span>/</span>
              <span className="text-gray-400">{product.category || "Produits"}</span>
              <span>/</span>
              <span className="text-gray-800 font-medium truncate">{product.name}</span>
            </div>
          </div>
        </header>
      )}
      <ShopReviewBar themeConfig={themeConfig} placement="below" />

      {/* ====== PRODUCT HERO SECTION ====== */}
      <section className="max-w-6xl mx-auto px-3 sm:px-6 py-6 sm:py-10">
        {(() => {
          const sectionOrder = normalizeSectionOrder((product as any).section_order);
          const imageRight = sectionOrder.layout === "image_right";
          return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-10">
          {/* Left/Right: Images */}
          <div className={`md:sticky md:top-24 md:self-start h-max ${imageRight ? "md:order-2" : ""}`}>
            {/* Main Image */}
            <div className="aspect-square rounded-2xl overflow-hidden bg-gray-50 mb-3 relative group shadow-sm border border-gray-100">
              {images.length > 0 ? (
                <img 
                  src={thumbUrl(images[selectedImageIdx]?.image_url, 1200)} 
                  alt={product.name} 
                  loading="eager"
                  decoding="async"
                  fetchPriority="high"
                  width={800}
                  height={800}
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <Store className="h-20 w-20 text-gray-300" />
                </div>
              )}
              {discount > 0 && (
                <Badge className="absolute top-4 left-4 bg-red-600 text-white text-sm md:text-base px-3.5 py-1.5 rounded-xl font-black shadow-lg border-2 border-white/20">
                  -{discount}%
                </Badge>
              )}
              {/* Nav arrows */}
              {images.length > 1 && (
                <>
                  <button 
                    onClick={() => setSelectedImageIdx(i => i > 0 ? i - 1 : images.length - 1)}
                    className="absolute left-3 top-1/2 -translate-y-1/2 h-10 w-10 rounded-full bg-white/90 shadow-md flex items-center justify-center hover:bg-white transition opacity-0 group-hover:opacity-100"
                  >
                    <ChevronLeft className="h-6 w-6" />
                  </button>
                  <button 
                    onClick={() => setSelectedImageIdx(i => i < images.length - 1 ? i + 1 : 0)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 h-10 w-10 rounded-full bg-white/90 shadow-md flex items-center justify-center hover:bg-white transition opacity-0 group-hover:opacity-100"
                  >
                    <ChevronRight className="h-6 w-6" />
                  </button>
                </>
              )}
            </div>
            {/* Thumbnails */}
            {images.length > 1 && (
              <div className="flex gap-2.5 overflow-x-auto pb-2 scrollbar-hide">
                {images.map((img, i) => (
                  <button 
                    key={img.id}
                    onClick={() => setSelectedImageIdx(i)} 
                    className={`h-16 w-16 sm:h-20 sm:w-20 rounded-xl overflow-hidden flex-shrink-0 transition-all ${i === selectedImageIdx ? "border-[3px] shadow-md scale-95" : "border border-gray-200 hover:border-gray-400 hover:opacity-80"}`}
                    style={i === selectedImageIdx ? { borderColor: primaryColor } : undefined}
                  >
                    <img src={thumbUrl(img.image_url, 160)} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Right: Product Info */}
          <div className="space-y-5 lg:pl-4">
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-extrabold leading-tight text-gray-900 tracking-tight">{product.name}</h1>

            {/* Reviews (rating + count) */}
            {shop.theme_config?.reviews_enabled !== false && (() => {
              const base = Number(shop.theme_config?.reviews_base_count ?? 128);
              const incr = shop.theme_config?.reviews_increment_with_orders !== false;
              const orders = Number((shop as any).total_orders || 0);
              let count = base + (incr ? orders : 0);
              // Realistic mode: deterministic daily variation within [min, max]
              if (shop.theme_config?.reviews_realistic_mode) {
                const min = Math.max(0, Number(shop.theme_config?.reviews_min ?? base));
                const max = Math.max(min, Number(shop.theme_config?.reviews_max ?? base + 50));
                const today = new Date();
                const dayKey = `${today.getUTCFullYear()}-${today.getUTCMonth()}-${today.getUTCDate()}`;
                const seedStr = `${product.id}-${dayKey}`;
                let h = 2166136261;
                for (let i = 0; i < seedStr.length; i++) { h ^= seedStr.charCodeAt(i); h = Math.imul(h, 16777619); }
                const r = ((h >>> 0) % 1000) / 1000;
                const variation = Math.floor(r * (max - min + 1));
                count = min + variation + (incr ? orders : 0);
              }
              const rating = Math.min(5, Math.max(1, Number(shop.theme_config?.reviews_rating ?? 5)));
              return (
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-0.5">
                    {[1,2,3,4,5].map(i => (
                      <Star key={i} className={`h-4 w-4 sm:h-5 sm:w-5 ${i <= rating ? "fill-yellow-400 text-yellow-400" : "fill-gray-200 text-gray-200"}`} />
                    ))}
                  </div>
                  <span className="text-sm font-medium text-gray-500 hover:underline cursor-pointer">({count.toLocaleString("fr-FR")} avis)</span>
                </div>
              );
            })()}

            {/* Price */}
            <div className="flex items-end gap-3 pb-2 border-b border-gray-100">
              <span className="text-3xl sm:text-4xl md:text-5xl font-black tracking-tight" style={{ color: primaryColor }}>
                {formatPrice(product.price)} FCFA
              </span>
              {product.compare_at_price && product.compare_at_price > product.price && (
                <span className="text-lg sm:text-xl text-gray-400 line-through font-medium mb-1">
                  {formatPrice(product.compare_at_price)} FCFA
                </span>
              )}
            </div>

            {/* Ordered movable blocks */}
            {sectionOrder.blocks.map((key: ProductSectionKey) => {
              if (key === "bundle_offers") {
                return Array.isArray(product.bundle_offers) && product.bundle_offers.length > 0 ? (
                  <div key="bundle_offers" className="space-y-3 rounded-2xl border p-4 shadow-sm bg-white" style={{ borderColor: primaryColor + "20" }}>
                    <div className="flex items-center gap-2 mb-1">
                      <div className="h-6 w-6 rounded-full flex items-center justify-center text-white text-xs" style={{ backgroundColor: primaryColor }}>🎁</div>
                      <p className="text-base font-bold" style={{ color: primaryColor }}>Offres en lot</p>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {product.bundle_offers.map((b, i) => {
                        const active = selectedBundleIdx === i;
                        return (
                          <button
                            key={i}
                            type="button"
                            onClick={() => {
                              setSelectedBundleIdx(active ? null : i);
                              setQuantity(active ? 1 : Math.max(1, Number(b.quantity) || 1));
                            }}
                            className={`text-left p-3.5 rounded-xl border-2 transition-all duration-200 relative overflow-hidden ${active ? "shadow-md scale-[1.02]" : "border-gray-200 hover:border-gray-300 hover:bg-gray-50"}`}
                            style={active ? { borderColor: primaryColor, backgroundColor: primaryColor + "08" } : undefined}
                          >
                            {active && <div className="absolute top-0 right-0 w-8 h-8 flex items-center justify-center text-white font-bold" style={{ backgroundColor: primaryColor, borderBottomLeftRadius: "0.75rem" }}>✓</div>}
                            <div className="font-bold text-base text-gray-900 mb-1">
                              {b.label || `${b.quantity} unité${b.quantity > 1 ? "s" : ""}`}
                            </div>
                            <div className="text-xs text-gray-500 mb-1">
                              {b.quantity} × produit
                            </div>
                            <div className="font-black text-lg" style={{ color: active ? primaryColor : "#374151" }}>
                              {formatPrice(b.price)} FCFA
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ) : null;
              }
              if (key === "countdown") {
                return shop.theme_config?.countdown_enabled ? (
                  <CountdownTimerInline
                    key="countdown"
                    color={shop.theme_config?.countdown_color || "#dc2626"}
                    days={shop.theme_config?.countdown_days || 0}
                    hours={shop.theme_config?.countdown_hours || 12}
                    minutes={shop.theme_config?.countdown_minutes || 0}
                  />
                ) : null;
              }
              if (key === "stock") {
                return (
                  <div key="stock" className="space-y-2">
                    {product.stock_quantity !== null && product.stock_quantity > 0 && shop.theme_config?.stock_urgency_enabled !== false && (
                      shop.theme_config?.stock_display_style === "text" ? (
                        <div className="inline-flex items-center gap-2 text-sm font-medium px-3 py-1.5 rounded-full" style={{ backgroundColor: (shop.theme_config?.stock_text_color || "#16a34a") + "15", color: shop.theme_config?.stock_text_color || "#16a34a" }}>
                          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: shop.theme_config?.stock_text_color || "#16a34a" }} />
                          En stock ({product.stock_quantity} produit{product.stock_quantity > 1 ? "s" : ""} disponible{product.stock_quantity > 1 ? "s" : ""})
                        </div>
                      ) : product.stock_quantity < 20 ? (
                        <StockUrgencyBarInline
                          stock={product.stock_quantity}
                          maxStock={20}
                          color={shop.theme_config?.stock_urgency_color || "#ef4444"}
                          text={shop.theme_config?.stock_urgency_text}
                        />
                      ) : null
                    )}
                    {product.stock_quantity !== null && product.stock_quantity <= 0 && (
                      <p className="text-sm text-red-600 font-medium">Rupture de stock</p>
                    )}
                  </div>
                );
              }
              if (key === "short_description") {
                return product.short_description ? (
                  <p key="short_description" className="text-gray-600 text-sm leading-relaxed">{product.short_description}</p>
                ) : null;
              }
              if (key === "variants") {
                return Array.isArray(product.variants) && product.variants.length > 0 ? (
                  <div key="variants" className="space-y-3">
                    {product.variants.map((group, gi) => (
                      group?.name && Array.isArray(group?.options) && group.options.length > 0 ? (
                        <div key={gi} className="space-y-1.5">
                          <Label className="text-sm font-medium text-gray-700">
                            {group.name}
                            {selectedVariants[group.name] && (
                              <span className="ml-2 text-gray-500 font-normal">: {selectedVariants[group.name]}</span>
                            )}
                          </Label>
                          <div className="flex flex-wrap gap-2">
                            {group.options.map((opt, oi) => {
                              const active = selectedVariants[group.name] === opt;
                              return (
                                <button
                                  key={oi}
                                  type="button"
                                  onClick={() => setSelectedVariants(prev => ({ ...prev, [group.name]: opt }))}
                                  className={`px-3 h-9 rounded-lg border-2 text-sm font-medium transition ${active ? "shadow-sm" : "border-gray-200 hover:border-gray-400"}`}
                                  style={active ? { borderColor: primaryColor, background: primaryColor + "15", color: primaryColor } : undefined}
                                >
                                  {opt}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      ) : null
                    ))}
                  </div>
                ) : null;
              }
              if (key === "long_description") {
                return product.description ? (
                  <div
                    key="long_description"
                    className="prose prose-sm max-w-none prose-headings:text-gray-900 prose-p:text-gray-700 prose-p:leading-relaxed prose-img:rounded-xl prose-img:mx-auto prose-img:shadow-sm prose-a:text-blue-600 prose-strong:text-gray-900 prose-ul:text-gray-700 prose-ol:text-gray-700"
                    dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(product.description, {
                      ALLOWED_TAGS: ['p','br','strong','b','em','i','u','s','ul','ol','li','h1','h2','h3','h4','h5','h6','blockquote','code','pre','img','a','span','div','hr','table','thead','tbody','tr','th','td'],
                      ALLOWED_ATTR: ['href','src','alt','title','class','style','target','rel','width','height']
                    }) }}
                    style={{ whiteSpace: "pre-wrap" }}
                  />
                ) : null;
              }
              return null;
            })}

            {/* Quantity + Add to Cart */}
            <div className="pt-4 space-y-4">
              <div className="flex items-center gap-4">
                <Label className="text-base font-bold text-gray-700">Quantité</Label>
                <div className="flex items-center border-2 border-gray-200 rounded-xl overflow-hidden bg-white">
                  <button onClick={() => setQuantity(q => Math.max(1, q - 1))} className="h-11 w-11 flex items-center justify-center hover:bg-gray-100 transition-colors text-gray-600">
                    <Minus className="h-5 w-5" />
                  </button>
                  <span className="w-14 text-center font-bold text-lg">{quantity}</span>
                  <button onClick={() => setQuantity(q => q + 1)} className="h-11 w-11 flex items-center justify-center hover:bg-gray-100 transition-colors text-gray-600">
                    <Plus className="h-5 w-5" />
                  </button>
                </div>
              </div>

              <div className="flex flex-col gap-3">
                {shop._isPreview ? (
                  <PreviewLockedNotice primaryColor={primaryColor} />
                ) : (
                  <Button 
                    className="w-full h-[60px] sm:h-16 rounded-2xl font-bold flex items-center justify-between px-4 sm:px-6 text-white shadow-xl hover:shadow-2xl hover:-translate-y-0.5 transition-all group"
                    style={{ backgroundColor: primaryColor }}
                    onClick={() => {
                      addToCart(product, quantity, true, true);
                      setShowInlineCheckout(true);
                      setTimeout(() => {
                        document.getElementById("inline-checkout")?.scrollIntoView({ behavior: "smooth", block: "start" });
                      }, 150);
                    }}
                    disabled={product.stock_quantity !== null && product.stock_quantity <= 0}
                  >
                    <div className="flex items-center gap-2">
                      <ShoppingCart className="h-5 w-5 sm:h-6 sm:w-6 shrink-0 group-hover:scale-110 transition-transform" />
                      <span className="text-[15px] sm:text-lg whitespace-nowrap">
                        {product.stock_quantity !== null && product.stock_quantity <= 0 ? "Rupture de stock" : "Commander"}
                      </span>
                    </div>
                    {(product.stock_quantity === null || product.stock_quantity > 0) && (
                      <div className="bg-white/20 backdrop-blur-sm px-3 py-1.5 rounded-xl text-[14px] sm:text-base font-extrabold whitespace-nowrap flex items-center">
                        {formatPrice(product.price * quantity)} FCFA
                      </div>
                    )}
                  </Button>
                )}

                {!shop._isPreview && shop.whatsapp_number && (
                  <a 
                    href={`https://wa.me/${shop.whatsapp_number.replace(/[^0-9]/g, "")}?text=${encodeURIComponent(`Bonjour, je suis intéressé(e) par "${product.name}" à ${formatPrice(product.price)} FCFA`)}`} 
                    target="_blank" rel="noopener noreferrer" 
                    className="block"
                  >
                    <Button variant="outline" className="w-full h-[60px] sm:h-16 rounded-2xl font-bold flex items-center justify-center gap-2 border-[3px] border-[#25D366] text-[#25D366] hover:bg-[#25D366]/10 transition-colors text-[15px] sm:text-lg shadow-sm">
                      <MessageCircle className="h-5 w-5 sm:h-6 sm:w-6 shrink-0" /> 
                      <span>Commander via WhatsApp</span>
                    </Button>
                  </a>
                )}
              </div>

              {/* Inline Single-Page Checkout */}
              {/* (Inline checkout removed from here since it's now in globalOverlays) */}
            </div>

            {/* Trust badges */}
            <div className="border-t pt-5 mt-5 grid grid-cols-2 gap-4 text-sm font-medium text-gray-700">
              <div className="flex items-center gap-2.5 bg-gray-50 p-2.5 rounded-xl">
                <Truck className="h-5 w-5 text-gray-500" />
                <span>Livraison disponible</span>
              </div>
              <div className="flex items-center gap-2.5 bg-gray-50 p-2.5 rounded-xl">
                <Shield className="h-5 w-5 text-gray-500" />
                <span>Paiement sécurisé</span>
              </div>
              <div className="flex items-center gap-2.5 bg-gray-50 p-2.5 rounded-xl">
                <Clock className="h-5 w-5 text-gray-500" />
                <span>Expédition rapide</span>
              </div>
              <div className="flex items-center gap-2.5 bg-gray-50 p-2.5 rounded-xl">
                <CheckCircle2 className="h-5 w-5 text-gray-500" />
                <span>Qualité garantie</span>
              </div>
            </div>
          </div>
        </div>
        );
        })()}
      </section>

      {/* ====== TÉMOIGNAGES AUDIO (additif, masqué si vide) ====== */}
      {productAudios.length > 0 && (
        <section className="border-t" style={{ background: themeSettings?.section_bg_color || "#FAFAFA" }}>
          <div className="max-w-3xl mx-auto px-3 sm:px-6 py-8 sm:py-10">
            <h2 className="text-xl sm:text-2xl font-bold mb-1" style={{ color: themeSettings?.title_color || undefined }}>
              Témoignages audio de nos clients
            </h2>
            <p className="text-sm opacity-70 mb-5">Écoutez ce que disent les clients qui ont déjà acheté.</p>
            <div className="space-y-3">
              {productAudios.map((a) => (
                <div
                  key={a.id}
                  className="rounded-lg p-3 sm:p-4 shadow-sm"
                  style={{
                    background: themeSettings?.card_bg_color || "#FFFFFF",
                    border: `1px solid ${themeSettings?.border_color || "#E5E7EB"}`,
                  }}
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="min-w-0">
                      <div className="font-semibold text-sm sm:text-base truncate">
                        {a.title || "Témoignage client"}
                      </div>
                      <div className="text-xs opacity-70 truncate">{a.customer_name || "Client vérifié"}</div>
                      {a.description && (
                        <div className="text-xs opacity-80 mt-1">{a.description}</div>
                      )}
                    </div>
                    <span
                      className="shrink-0 text-[10px] font-bold px-2 py-1 rounded-full"
                      style={{
                        background: themeSettings?.badge_color || "#10B981",
                        color: "#FFFFFF",
                      }}
                    >
                      ✓ Authentique
                    </span>
                  </div>
                  <audio src={a.audio_url} controls preload="none" className="w-full" />
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ====== RELATED PRODUCTS (opt-in) ====== */}
      {!!shop?.theme_config?.show_related_products && relatedProducts.length > 0 && (
        <section className="border-t bg-gray-50">
          <div className="max-w-6xl mx-auto px-3 sm:px-6 py-8 sm:py-12">
            <h2 className="text-xl sm:text-2xl font-bold mb-6">Autres produits</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 sm:gap-4">
              {relatedProducts.map(rp => {
                const rpImg = rp.product_images?.[0]?.image_url;
                return (
                  <a 
                    key={rp.id} 
                    href={shop._isPreview
                      ? (rp.slug ? `/shop-preview/${shop.id}/p/${rp.slug}` : `/shop-preview/${shop.id}/product?product=${rp.id}`)
                      : (rp.slug ? `/shop/${shop.slug}/p/${rp.slug}` : `/shop/${shop.slug}/product?product=${rp.id}`)}
                    className="bg-white rounded-xl overflow-hidden shadow-sm hover:shadow-lg transition-all group border"
                  >
                    <div className="aspect-square bg-gray-100 overflow-hidden">
                      {rpImg ? (
                        <img src={thumbUrl(rpImg, 800)} alt={rp.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" loading="lazy" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center"><Store className="h-8 w-8 text-gray-300" /></div>
                      )}
                    </div>
                    <div className="p-3">
                      <h3 className="text-sm font-semibold line-clamp-2 mb-1">{rp.name}</h3>
                      <span className="font-bold text-sm" style={{ color: primaryColor }}>{formatPrice(rp.price)} FCFA</span>
                    </div>
                  </a>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* ====== REVIEWS SECTION (deferred) ====== */}
      {deferredReady && (
        <Suspense fallback={null}>
          <ProductReviews shopId={shop.id} productId={product.id} primaryColor={primaryColor} isPreview={!!shop._isPreview} />
        </Suspense>
      )}

      {/* ====== FOOTER ====== */}
      <footer
        className="border-t py-8 px-4"
        style={themeConfig.footer_custom ? {
          backgroundColor: themeConfig.footer_bg || "#F9FAFB",
          color: themeConfig.footer_text || "#6B7280",
          borderColor: themeConfig.footer_border === false ? "transparent" : themeConfig.footer_border_color || "#e5e7eb",
        } : { backgroundColor: "#F9FAFB" }}
      >
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-gray-500">
            <div className="flex items-center gap-2">
              {shop.logo_url ? <img src={thumbUrl(shop.logo_url, 128)} alt="" loading="lazy" decoding="async" width={32} height={32} className="h-8 w-8 rounded-lg" /> : <Store className="h-5 w-5" style={{ color: primaryColor }} />}
              <span className="font-semibold text-gray-700">{shop.business_name}</span>
            </div>
            <div className="flex items-center gap-4 flex-wrap justify-center">
              {shop.whatsapp_number && (
                <a href={`https://wa.me/${shop.whatsapp_number.replace(/[^0-9]/g, "")}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 hover:text-gray-700">
                  <MessageCircle className="h-4 w-4" /> WhatsApp
                </a>
              )}
              {shop.phone_number && (
                <a href={`tel:${shop.phone_number}`} className="flex items-center gap-1 hover:text-gray-700">
                  <Phone className="h-4 w-4" /> {shop.phone_number}
                </a>
              )}
            </div>
          </div>
          <div className="text-center text-xs text-gray-400 mt-6 flex items-center justify-center gap-1">
            {shop.city && <><MapPin className="h-3 w-3" /> {shop.city}, {shop.country || "Côte d'Ivoire"} · </>}
            Propulsé par <span className="font-semibold text-gray-600">Ecomfy</span>
          </div>
        </div>
      </footer>

      {globalOverlays}
    </div>
  );
};

export default ProductView;
