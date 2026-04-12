import { useEffect, useState, useRef } from "react";
import { useParams, useSearchParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
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
import { Dialog, DialogContent } from "@/components/ui/dialog";
import DOMPurify from "dompurify";
import { isAbidjanZone } from "@/lib/abidjanZones";

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
      <div className="w-14 h-14 rounded-lg flex items-center justify-center text-white font-bold text-xl" style={{ backgroundColor: color }}>{String(val).padStart(2, '0')}</div>
      <span className="text-xs text-gray-500 mt-1">{label}</span>
    </div>
  );

  return (
    <div className="flex items-center gap-1 py-2">
      <Clock className="w-4 h-4 mr-1" style={{ color }} />
      <span className="text-sm font-semibold mr-2" style={{ color }}>Offre expire dans :</span>
      <div className="flex gap-2">
        <Box val={timeLeft.d} label="Jours" /><span className="text-xl font-bold self-start mt-3" style={{ color }}>:</span>
        <Box val={timeLeft.h} label="Heures" /><span className="text-xl font-bold self-start mt-3" style={{ color }}>:</span>
        <Box val={timeLeft.m} label="Min" /><span className="text-xl font-bold self-start mt-3" style={{ color }}>:</span>
        <Box val={timeLeft.s} label="Sec" />
      </div>
    </div>
  );
};

// Stock Urgency Bar Component
const StockUrgencyBarInline = ({ stock, maxStock, color, text }: { stock: number; maxStock: number; color: string; text?: string }) => {
  const pct = Math.min((stock / maxStock) * 100, 100);
  return (
    <div className="space-y-1.5 py-1">
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium" style={{ color }}>{text || `🔥 Dépêchez-vous ! Il ne reste que ${stock} en stock`}</span>
      </div>
      <div className="w-full h-2.5 rounded-full bg-gray-200 overflow-hidden">
        <div className="h-full rounded-full transition-all duration-1000 animate-pulse" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
    </div>
  );
};

interface Product {
  id: string;
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
  product_images: { id: string; image_url: string; is_primary: boolean; display_order: number | null }[];
}

interface CartItem { product: Product; quantity: number; }
interface ChatMessage { role: "user" | "assistant"; content: string; }

const ProductView = () => {
  const { slug, id } = useParams<{ slug?: string; id?: string }>();
  const [searchParams] = useSearchParams();
  const productId = searchParams.get("product");
  const navigate = useNavigate();

  const [shop, setShop] = useState<any>(null);
  const [product, setProduct] = useState<Product | null>(null);
  const [relatedProducts, setRelatedProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedImageIdx, setSelectedImageIdx] = useState(0);
  const [quantity, setQuantity] = useState(1);

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

  // Chat
  const [chatOpen, setChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => { fetchData(); }, [slug, id, productId]);

  const fetchData = async () => {
    if ((!slug && !id) || !productId) { setLoading(false); return; }
    let shopData: any = null;

    if (id) {
      const { data } = await supabase.from("shops").select("*").eq("id", id).maybeSingle() as any;
      if (data) shopData = { ...data, _isPreview: true };
    } else if (slug) {
      const { data: rows } = await supabase.from("shops").select("*").eq("slug", slug).eq("is_published", true).eq("is_activated", true).limit(1) as any;
      const live = rows?.[0];
      if (live) shopData = live;
      else {
        const { data: pRows } = await supabase.from("shops").select("*").eq("slug", slug).limit(1) as any;
        if (pRows?.[0]) shopData = { ...pRows[0], _isPreview: true };
      }
    }

    if (!shopData) { setLoading(false); return; }
    setShop(shopData);

    // Fetch product
    const { data: productData } = await supabase
      .from("products")
      .select("*, product_images(*)")
      .eq("id", productId)
      .eq("shop_id", shopData.id)
      .maybeSingle() as any;

    if (productData) {
      // Sort images by display_order
      if (productData.product_images) {
        productData.product_images.sort((a: any, b: any) => (a.display_order || 0) - (b.display_order || 0));
      }
      setProduct(productData);

      // Fetch related products
      const { data: related } = await supabase
        .from("products")
        .select("*, product_images(*)")
        .eq("shop_id", shopData.id)
        .neq("id", productId)
        .eq("is_published", true)
        .limit(4) as any;
      setRelatedProducts(related || []);
    }

    // Set page title & favicon
    document.title = productData?.name || shopData.business_name || "Produit";
    const faviconLink = document.querySelector("link[rel~='icon']") as HTMLLinkElement || document.createElement("link");
    faviconLink.rel = "icon";
    faviconLink.type = "image/png";
    faviconLink.href = shopData.favicon_url || shopData.logo_url || "/favicon.png";
    if (!faviconLink.parentNode) document.head.appendChild(faviconLink);

    if (shopData.chatbot_enabled) {
      setChatMessages([{ role: "assistant", content: shopData.chatbot_welcome_message || "Bienvenue ! Comment puis-je vous aider ?" }]);
    }

    setLoading(false);
  };

  const formatPrice = (n: number) => new Intl.NumberFormat("fr-FR").format(n);
  const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0);
  const cartTotal = cart.reduce((sum, item) => sum + item.product.price * item.quantity, 0);

  const addToCart = (prod: Product, qty: number = 1, replace: boolean = false) => {
    setCart(prev => {
      const existing = prev.find(item => item.product.id === prod.id);
      if (existing) return prev.map(item => item.product.id === prod.id ? { ...item, quantity: replace ? qty : item.quantity + qty } : item);
      return [...prev, { product: prod, quantity: qty }];
    });
    toast({ title: "✓ Ajouté au panier", description: prod.name });
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
    if (!shop || !customerInfo.name || !customerInfo.phone || cart.length === 0) {
      toast({ title: "Erreur", description: "Remplissez tous les champs obligatoires", variant: "destructive" });
      return;
    }
    setOrderLoading(true);
    try {
      const commissionAmount = cartTotal * (shop.commission_rate || 0.025);
      const { data: orderNumData } = await supabase.rpc("generate_order_number") as any;
      const { data: order, error } = await supabase.from("orders").insert({
        shop_id: shop.id, order_number: orderNumData || `VP-${Date.now()}`,
        customer_name: customerInfo.name, customer_email: customerInfo.email,
        customer_phone: customerInfo.phone, customer_address: customerInfo.address,
        customer_city: customerInfo.city, subtotal: cartTotal,
        commission_amount: commissionAmount, total: cartTotal,
        payment_method: customerInfo.paymentMethod,
      }).select().single() as any;
      if (error) throw error;
      const orderItems = cart.map(item => ({
        order_id: order.id, product_id: item.product.id, product_name: item.product.name,
        product_image_url: item.product.product_images?.[0]?.image_url || null,
        quantity: item.quantity, unit_price: item.product.price,
        total_price: item.product.price * item.quantity,
      }));
      await supabase.from("order_items").insert(orderItems) as any;
      setOrderSuccess(true);
      setShowInlineCheckout(false);
      setCart([]);
      setCustomerInfo({ name: "", phone: "", email: "", address: "", city: "", paymentMethod: "cash_on_delivery" });
    } catch (error: any) {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    } finally { setOrderLoading(false); }
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
    <div className="min-h-screen flex items-center justify-center bg-white">
      <div className="animate-spin h-10 w-10 border-4 border-primary border-t-transparent rounded-full" />
    </div>
  );

  if (!shop || !product) return (
    <div className="min-h-screen flex items-center justify-center flex-col gap-4 bg-white">
      <Store className="h-20 w-20 text-gray-300" />
      <h1 className="text-2xl font-bold text-gray-800">Produit introuvable</h1>
      <p className="text-gray-500">Ce produit n'existe pas ou n'est plus disponible</p>
    </div>
  );

  const primaryColor = shop.primary_color || "#2563eb";
  const images = product.product_images || [];
  const discount = product.compare_at_price && product.compare_at_price > product.price
    ? Math.round((1 - product.price / product.compare_at_price) * 100)
    : 0;

  const goToShop = () => {
    if (shop._isPreview) navigate(`/shop-preview/${shop.id}`);
    else navigate(`/shop/${shop.slug}`);
  };

  return (
    <div className="min-h-screen bg-white text-gray-900">
      {/* Preview Banner */}
      {shop._isPreview && (
        <div className="bg-amber-500 text-white text-center py-2 px-4 text-sm font-medium sticky top-0 z-50">
          ⚠️ Mode prévisualisation — Cette boutique n'est pas encore en ligne
        </div>
      )}

      {/* Top Promo Bar */}
      <div className="text-white text-center py-2 px-4 text-xs sm:text-sm font-medium" style={{ backgroundColor: primaryColor }}>
        🔥 Offre spéciale en cours — Profitez de nos meilleurs prix ! 📦 Livraison disponible
      </div>

      {/* Interior payment notice */}
      {shop.theme_config?.force_mobile_money_interior && (
        <div className="bg-amber-50 border-b border-amber-200 text-amber-900 text-center py-2.5 px-4 text-xs sm:text-sm">
          <span className="font-semibold">📢 Information importante :</span> Si vous êtes à l'intérieur du pays (hors Abidjan), le paiement par Mobile Money est obligatoire avant la validation de votre commande pour permettre l'expédition de votre colis.
        </div>
      )}

      {/* Header - conditionally hidden */}
      {!shop.theme_config?.hide_product_header && (
        <header className="border-b bg-white sticky top-0 z-40">
          <div className="max-w-6xl mx-auto px-3 sm:px-4 py-2.5 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0 cursor-pointer" onClick={goToShop}>
              {shop.logo_url ? (
                <img src={shop.logo_url} alt="" className="h-8 w-8 rounded-lg object-cover flex-shrink-0" />
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
                onClick={() => { setCheckoutOpen(true); setOrderSuccess(false); }}
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

      {/* ====== PRODUCT HERO SECTION ====== */}
      <section className="max-w-6xl mx-auto px-3 sm:px-6 py-6 sm:py-10">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-10">
          {/* Left: Images */}
          <div>
            {/* Main Image */}
            <div className="aspect-square rounded-xl overflow-hidden bg-gray-100 mb-3 relative group">
              {images.length > 0 ? (
                <img 
                  src={images[selectedImageIdx]?.image_url} 
                  alt={product.name} 
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <Store className="h-20 w-20 text-gray-300" />
                </div>
              )}
              {discount > 0 && (
                <Badge className="absolute top-3 left-3 bg-red-600 text-white text-sm px-3 py-1 rounded-lg font-bold">
                  -{discount}%
                </Badge>
              )}
              {/* Nav arrows */}
              {images.length > 1 && (
                <>
                  <button 
                    onClick={() => setSelectedImageIdx(i => i > 0 ? i - 1 : images.length - 1)}
                    className="absolute left-2 top-1/2 -translate-y-1/2 h-9 w-9 rounded-full bg-white/80 shadow flex items-center justify-center hover:bg-white transition opacity-0 group-hover:opacity-100"
                  >
                    <ChevronLeft className="h-5 w-5" />
                  </button>
                  <button 
                    onClick={() => setSelectedImageIdx(i => i < images.length - 1 ? i + 1 : 0)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 h-9 w-9 rounded-full bg-white/80 shadow flex items-center justify-center hover:bg-white transition opacity-0 group-hover:opacity-100"
                  >
                    <ChevronRight className="h-5 w-5" />
                  </button>
                </>
              )}
            </div>
            {/* Thumbnails */}
            {images.length > 1 && (
              <div className="flex gap-2 overflow-x-auto pb-1">
                {images.map((img, i) => (
                  <button 
                    key={img.id}
                    onClick={() => setSelectedImageIdx(i)} 
                    className={`h-16 w-16 sm:h-20 sm:w-20 rounded-lg overflow-hidden flex-shrink-0 border-2 transition ${i === selectedImageIdx ? "border-gray-900" : "border-transparent hover:border-gray-300"}`}
                  >
                    <img src={img.image_url} alt="" className="h-full w-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Right: Product Info */}
          <div className="space-y-4">
            <h1 className="text-xl sm:text-2xl md:text-3xl font-bold leading-tight">{product.name}</h1>
            
            {/* Price */}
            <div className="flex items-baseline gap-3">
              <span className="text-2xl sm:text-3xl font-bold" style={{ color: primaryColor }}>
                {formatPrice(product.price)} FCFA
              </span>
              {product.compare_at_price && product.compare_at_price > product.price && (
                <span className="text-lg text-gray-400 line-through">
                  {formatPrice(product.compare_at_price)} FCFA
                </span>
              )}
            </div>

            {/* Countdown Timer */}
            {shop.theme_config?.countdown_enabled && (
              <CountdownTimerInline
                color={shop.theme_config?.countdown_color || "#dc2626"}
                days={shop.theme_config?.countdown_days || 0}
                hours={shop.theme_config?.countdown_hours || 12}
                minutes={shop.theme_config?.countdown_minutes || 0}
              />
            )}

            {/* Stock urgency */}
            {product.stock_quantity !== null && product.stock_quantity > 0 && product.stock_quantity < 20 && (
              <StockUrgencyBarInline
                stock={product.stock_quantity}
                maxStock={20}
                color={shop.theme_config?.stock_urgency_color || "#ef4444"}
                text={shop.theme_config?.stock_urgency_text}
              />
            )}
            {product.stock_quantity !== null && product.stock_quantity <= 0 && (
              <p className="text-sm text-red-600 font-medium">Rupture de stock</p>
            )}

            {product.short_description && (
              <p className="text-gray-600 text-sm leading-relaxed">{product.short_description}</p>
            )}

            {/* Quantity + Add to Cart */}
            <div className="pt-2 space-y-3">
              <div className="flex items-center gap-3">
                <Label className="text-sm font-medium text-gray-700">Quantité</Label>
                <div className="flex items-center border rounded-lg">
                  <button onClick={() => setQuantity(q => Math.max(1, q - 1))} className="h-10 w-10 flex items-center justify-center hover:bg-gray-50 transition">
                    <Minus className="h-4 w-4" />
                  </button>
                  <span className="w-12 text-center font-semibold text-sm">{quantity}</span>
                  <button onClick={() => setQuantity(q => q + 1)} className="h-10 w-10 flex items-center justify-center hover:bg-gray-50 transition">
                    <Plus className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {shop.theme_config?.single_page_checkout ? (
                <Button 
                  className="w-full h-12 sm:h-14 rounded-xl text-base sm:text-lg font-bold gap-2 text-white shadow-lg hover:shadow-xl transition-all"
                  style={{ backgroundColor: primaryColor }}
                  onClick={() => {
                    addToCart(product, quantity);
                    setShowInlineCheckout(true);
                  }}
                  disabled={product.stock_quantity !== null && product.stock_quantity <= 0}
                >
                  <ShoppingCart className="h-5 w-5" />
                  {product.stock_quantity !== null && product.stock_quantity <= 0 ? "Rupture de stock" : `Commander maintenant · ${formatPrice(product.price * quantity)} FCFA`}
                </Button>
              ) : (
                <Button 
                  className="w-full h-12 sm:h-14 rounded-xl text-base sm:text-lg font-bold gap-2 text-white shadow-lg hover:shadow-xl transition-all"
                  style={{ backgroundColor: primaryColor }}
                  onClick={() => addToCart(product, quantity)}
                  disabled={product.stock_quantity !== null && product.stock_quantity <= 0}
                >
                  <ShoppingCart className="h-5 w-5" />
                  {product.stock_quantity !== null && product.stock_quantity <= 0 ? "Rupture de stock" : `Ajouter au panier · ${formatPrice(product.price * quantity)} FCFA`}
                </Button>
              )}

              {shop.whatsapp_number && (
                <a 
                  href={`https://wa.me/${shop.whatsapp_number.replace(/[^0-9]/g, "")}?text=${encodeURIComponent(`Bonjour, je suis intéressé(e) par "${product.name}" à ${formatPrice(product.price)} FCFA`)}`} 
                  target="_blank" rel="noopener noreferrer" 
                  className="block"
                >
                  <Button variant="outline" className="w-full h-12 rounded-xl text-base font-semibold gap-2 border-green-500 text-green-600 hover:bg-green-50">
                    <MessageCircle className="h-5 w-5" /> Commander via WhatsApp
                  </Button>
                </a>
              )}

              {/* Inline Single-Page Checkout */}
              {shop.theme_config?.single_page_checkout && showInlineCheckout && cart.length > 0 && (
                <div className="mt-4 border-2 rounded-2xl p-4 sm:p-6 space-y-5" style={{ borderColor: primaryColor + "30" }}>
                  <h3 className="font-bold text-lg flex items-center gap-2" style={{ color: primaryColor }}>
                    <CreditCard className="h-5 w-5" /> Finaliser votre commande
                  </h3>

                  {/* Cart Summary */}
                  <div className="bg-gray-50 rounded-xl p-3 space-y-2">
                    {cart.map(item => (
                      <div key={item.product.id} className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2">
                          {item.product.product_images?.[0] && (
                            <img src={item.product.product_images[0].image_url} alt="" className="h-10 w-10 rounded-lg object-cover" />
                          )}
                          <span className="font-medium">{item.product.name} × {item.quantity}</span>
                        </div>
                        <span className="font-bold">{formatPrice(item.product.price * item.quantity)} FCFA</span>
                      </div>
                    ))}
                    <div className="border-t pt-2 mt-2 flex justify-between font-bold">
                      <span>Total</span>
                      <span style={{ color: primaryColor }}>{formatPrice(cartTotal)} FCFA</span>
                    </div>
                  </div>

                  {/* Contact */}
                  <div className="space-y-3">
                    <div className="flex items-center gap-2"><User className="h-4 w-4" style={{ color: primaryColor }} /><h4 className="font-bold text-sm">Informations</h4></div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label className="text-xs text-gray-500">Nom complet *</Label>
                        <Input value={customerInfo.name} onChange={(e) => setCustomerInfo({ ...customerInfo, name: e.target.value })} placeholder="Jean Kouassi" className="rounded-xl h-11" />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs text-gray-500">Téléphone *</Label>
                        <Input value={customerInfo.phone} onChange={(e) => setCustomerInfo({ ...customerInfo, phone: e.target.value })} placeholder="+225 07 00 00 00" className="rounded-xl h-11" />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs text-gray-500">Adresse / Quartier *</Label>
                        <Input value={customerInfo.address} onChange={(e) => setCustomerInfo({ ...customerInfo, address: e.target.value })} placeholder="Cocody, Riviera 3" className="rounded-xl h-11" />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs text-gray-500">Ville *</Label>
                        <Input value={customerInfo.city} onChange={(e) => setCustomerInfo({ ...customerInfo, city: e.target.value })} placeholder="Abidjan" className="rounded-xl h-11" />
                      </div>
                    </div>
                  </div>

                  {/* Payment Method */}
                  <div className="space-y-3">
                    <div className="flex items-center gap-2"><CreditCard className="h-4 w-4" style={{ color: primaryColor }} /><h4 className="font-bold text-sm">Paiement</h4></div>
                    
                    {/* Interior city warning */}
                    {shop.theme_config?.force_mobile_money_interior && customerInfo.city && !isAbidjanZone(customerInfo.city) && (
                      <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs sm:text-sm text-amber-800">
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
                      
                      // Auto-select mobile_money for interior
                      if (isInterior && customerInfo.paymentMethod !== 'mobile_money') {
                        setTimeout(() => setCustomerInfo(prev => ({ ...prev, paymentMethod: 'mobile_money' })), 0);
                      }

                      return (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {methods.map(method => (
                            <button key={method.value} onClick={() => setCustomerInfo({ ...customerInfo, paymentMethod: method.value })}
                              className={`flex items-center gap-2 p-3 rounded-xl border-2 text-left transition-all ${customerInfo.paymentMethod === method.value ? "shadow-sm" : "border-gray-200"}`}
                              style={customerInfo.paymentMethod === method.value ? { borderColor: primaryColor } : {}}
                            >
                              <span className="text-xl">{method.icon}</span>
                              <span className="font-semibold text-sm">{method.label}</span>
                              {customerInfo.paymentMethod === method.value && <CheckCircle2 className="h-4 w-4 ml-auto" style={{ color: primaryColor }} />}
                            </button>
                          ))}
                        </div>
                      );
                    })()}
                  </div>

                  <Button 
                    className="w-full h-12 sm:h-14 rounded-xl text-base sm:text-lg font-bold gap-2 text-white shadow-lg"
                    style={{ backgroundColor: primaryColor }}
                    onClick={placeOrder} 
                    disabled={orderLoading || !customerInfo.name || !customerInfo.phone || !customerInfo.address || !customerInfo.city}
                  >
                    {orderLoading ? "Traitement..." : <><ShoppingCart className="h-5 w-5" /> Confirmer · {formatPrice(cartTotal)} FCFA</>}
                  </Button>
                </div>
              )}

              {/* Inline order success */}
              {shop.theme_config?.single_page_checkout && orderSuccess && (
                <div className="mt-4 border-2 border-green-200 rounded-2xl p-6 text-center bg-green-50">
                  <div className="h-16 w-16 mx-auto rounded-full flex items-center justify-center mb-4 bg-green-100">
                    <CheckCircle2 className="h-8 w-8 text-green-600" />
                  </div>
                  <h3 className="text-xl font-bold mb-2">Commande confirmée ! 🎉</h3>
                  <p className="text-gray-500 text-sm">Le vendeur vous contactera sous peu.</p>
                </div>
              )}
            </div>

            {/* Trust badges */}
            <div className="border-t pt-4 mt-4 grid grid-cols-2 gap-3 text-xs text-gray-600">
              <div className="flex items-center gap-2">
                <Truck className="h-4 w-4 text-gray-400" />
                <span>Livraison disponible</span>
              </div>
              <div className="flex items-center gap-2">
                <Shield className="h-4 w-4 text-gray-400" />
                <span>Paiement sécurisé</span>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-gray-400" />
                <span>Expédition rapide</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-gray-400" />
                <span>Qualité garantie</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ====== PRODUCT DESCRIPTION (Rich HTML) ====== */}
      {product.description && (
        <section className="border-t bg-white">
          <div className="max-w-4xl mx-auto px-3 sm:px-6 py-8 sm:py-12">
            <div 
              className="prose prose-sm sm:prose-base max-w-none prose-headings:text-gray-900 prose-p:text-gray-700 prose-p:leading-relaxed prose-img:rounded-xl prose-img:mx-auto prose-img:shadow-sm prose-a:text-blue-600 prose-strong:text-gray-900 prose-ul:text-gray-700 prose-ol:text-gray-700"
              dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(product.description, { ADD_TAGS: ['iframe'], ADD_ATTR: ['allow', 'allowfullscreen', 'frameborder', 'scrolling', 'src'] }) }}
              style={{ whiteSpace: "pre-wrap" }}
            />
          </div>
        </section>
      )}

      {/* ====== RELATED PRODUCTS ====== */}
      {relatedProducts.length > 0 && (
        <section className="border-t bg-gray-50">
          <div className="max-w-6xl mx-auto px-3 sm:px-6 py-8 sm:py-12">
            <h2 className="text-xl sm:text-2xl font-bold mb-6">Autres produits</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 sm:gap-4">
              {relatedProducts.map(rp => {
                const rpImg = rp.product_images?.[0]?.image_url;
                return (
                  <a 
                    key={rp.id} 
                    href={shop._isPreview ? `/shop-preview/${shop.id}/product?product=${rp.id}` : `/shop/${shop.slug}/product?product=${rp.id}`}
                    className="bg-white rounded-xl overflow-hidden shadow-sm hover:shadow-lg transition-all group border"
                  >
                    <div className="aspect-square bg-gray-100 overflow-hidden">
                      {rpImg ? (
                        <img src={rpImg} alt={rp.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" loading="lazy" />
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

      {/* ====== REVIEWS SECTION ====== */}
      <section className="border-t bg-white">
        <div className="max-w-4xl mx-auto px-3 sm:px-6 py-8 sm:py-12 text-center">
          <h2 className="text-xl sm:text-2xl font-bold mb-1">Avis</h2>
          <div className="flex items-center justify-center gap-1 mb-4">
            {[1, 2, 3, 4, 5].map(i => (
              <Star key={i} className="h-5 w-5 fill-yellow-400 text-yellow-400" />
            ))}
            <span className="text-sm text-gray-500 ml-2">Aucun avis</span>
          </div>
          <p className="text-sm text-gray-500">Ajouter un avis</p>
        </div>
      </section>

      {/* ====== FOOTER ====== */}
      <footer className="border-t bg-gray-50 py-8 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-gray-500">
            <div className="flex items-center gap-2">
              {shop.logo_url ? <img src={shop.logo_url} alt="" className="h-8 w-8 rounded-lg" /> : <Store className="h-5 w-5" style={{ color: primaryColor }} />}
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
            Propulsé par <span className="font-semibold text-gray-600">VisualPro</span>
          </div>
        </div>
      </footer>

      {/* ====== CHECKOUT DIALOG ====== */}
      <Dialog open={checkoutOpen} onOpenChange={(open) => { setCheckoutOpen(open); if (!open) { setCheckoutStep("cart"); setOrderSuccess(false); } }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl p-0">
          {orderSuccess ? (
            <div className="text-center py-12 px-6">
              <div className="h-20 w-20 mx-auto rounded-full flex items-center justify-center mb-6" style={{ backgroundColor: primaryColor + "15" }}>
                <CheckCircle2 className="h-10 w-10" style={{ color: primaryColor }} />
              </div>
              <h2 className="text-2xl font-bold mb-2">Commande confirmée ! 🎉</h2>
              <p className="text-gray-500 mb-6">Le vendeur vous contactera sous peu.</p>
              <Button onClick={() => { setCheckoutOpen(false); setOrderSuccess(false); setCheckoutStep("cart"); }} className="rounded-xl" style={{ backgroundColor: primaryColor }}>
                Continuer mes achats
              </Button>
            </div>
          ) : (
            <>
              <div className="px-6 pt-6 pb-2">
                <div className="flex items-center justify-between mb-1">
                  {[
                    { key: "cart", label: "Panier", icon: ShoppingBag },
                    { key: "info", label: "Livraison", icon: Truck },
                    { key: "confirm", label: "Paiement", icon: CreditCard },
                  ].map((step, i) => {
                    const steps = ["cart", "info", "confirm"];
                    const currentIdx = steps.indexOf(checkoutStep);
                    const isActive = i === currentIdx;
                    const isDone = i < currentIdx;
                    return (
                      <div key={step.key} className="flex items-center flex-1">
                        <div className="flex flex-col items-center flex-1">
                          <div className={`h-9 w-9 rounded-full flex items-center justify-center mb-1 transition-colors ${!isDone && !isActive ? "bg-gray-100 text-gray-400" : "text-white"}`} style={isDone || isActive ? { backgroundColor: primaryColor } : {}}>
                            {isDone ? <CheckCircle2 className="h-4 w-4" /> : <step.icon className="h-4 w-4" />}
                          </div>
                          <span className={`text-[11px] font-medium ${isActive ? "text-gray-900" : "text-gray-400"}`}>{step.label}</span>
                        </div>
                        {i < 2 && <div className={`h-0.5 flex-1 mx-1 rounded-full mt-[-14px] ${isDone ? "" : "bg-gray-200"}`} style={isDone ? { backgroundColor: primaryColor } : {}} />}
                      </div>
                    );
                  })}
                </div>
              </div>

              {checkoutStep === "cart" && (
                <div className="px-6 pb-6">
                  {cart.length === 0 ? (
                    <div className="text-center py-12">
                      <ShoppingBag className="h-16 w-16 mx-auto text-gray-200 mb-4" />
                      <p className="font-medium">Votre panier est vide</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {cart.map(item => (
                        <div key={item.product.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                          <div className="h-16 w-16 bg-gray-200 rounded-xl overflow-hidden flex-shrink-0">
                            {item.product.product_images?.[0] && <img src={item.product.product_images[0].image_url} alt="" className="h-full w-full object-cover" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold truncate">{item.product.name}</p>
                            <p className="text-sm font-bold" style={{ color: primaryColor }}>{formatPrice(item.product.price)} FCFA</p>
                          </div>
                          <div className="flex items-center gap-1">
                            <Button variant="outline" size="icon" className="h-8 w-8 rounded-lg" onClick={() => updateQuantity(item.product.id, -1)}><Minus className="h-3 w-3" /></Button>
                            <span className="text-sm w-8 text-center font-semibold">{item.quantity}</span>
                            <Button variant="outline" size="icon" className="h-8 w-8 rounded-lg" onClick={() => updateQuantity(item.product.id, 1)}><Plus className="h-3 w-3" /></Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg ml-1" onClick={() => removeFromCart(item.product.id)}><Trash2 className="h-3 w-3 text-red-500" /></Button>
                          </div>
                        </div>
                      ))}
                      <div className="border-t pt-3 mt-3 flex justify-between">
                        <span className="font-semibold text-lg">Total</span>
                        <span className="font-bold text-xl" style={{ color: primaryColor }}>{formatPrice(cartTotal)} FCFA</span>
                      </div>
                      <Button className="w-full h-12 rounded-xl text-base font-semibold gap-2 text-white" style={{ backgroundColor: primaryColor }} onClick={() => setCheckoutStep("info")}>
                        Continuer <ArrowRight className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </div>
              )}

              {checkoutStep === "info" && (
                <div className="px-6 pb-6 space-y-5">
                  <button onClick={() => setCheckoutStep("cart")} className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800">
                    <ArrowLeft className="h-4 w-4" /> Retour au panier
                  </button>
                  <div className="space-y-3">
                    <div className="flex items-center gap-2"><User className="h-4 w-4" style={{ color: primaryColor }} /><h4 className="font-bold text-sm">Contact</h4></div>
                    <div className="space-y-3">
                      <div className="space-y-1">
                        <Label className="text-xs text-gray-500">Nom complet *</Label>
                        <Input value={customerInfo.name} onChange={(e) => setCustomerInfo({ ...customerInfo, name: e.target.value })} placeholder="Jean Kouassi" className="rounded-xl h-11" />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs text-gray-500">Téléphone *</Label>
                        <Input value={customerInfo.phone} onChange={(e) => setCustomerInfo({ ...customerInfo, phone: e.target.value })} placeholder="+225 07 00 00 00" className="rounded-xl h-11" />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs text-gray-500">Email (facultatif)</Label>
                        <Input type="email" value={customerInfo.email} onChange={(e) => setCustomerInfo({ ...customerInfo, email: e.target.value })} placeholder="jean@email.com" className="rounded-xl h-11" />
                      </div>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <div className="flex items-center gap-2"><Truck className="h-4 w-4" style={{ color: primaryColor }} /><h4 className="font-bold text-sm">Livraison</h4></div>
                    <div className="space-y-3">
                      <div className="space-y-1">
                        <Label className="text-xs text-gray-500">Adresse / Quartier *</Label>
                        <Input value={customerInfo.address} onChange={(e) => setCustomerInfo({ ...customerInfo, address: e.target.value })} placeholder="Cocody, Riviera 3" className="rounded-xl h-11" />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs text-gray-500">Ville *</Label>
                        <Input value={customerInfo.city} onChange={(e) => setCustomerInfo({ ...customerInfo, city: e.target.value })} placeholder="Abidjan" className="rounded-xl h-11" />
                      </div>
                    </div>
                  </div>
                  <Button className="w-full h-12 rounded-xl text-base font-semibold gap-2 text-white" style={{ backgroundColor: primaryColor }} onClick={() => setCheckoutStep("confirm")} disabled={!customerInfo.name || !customerInfo.phone || !customerInfo.address || !customerInfo.city}>
                    Passer au paiement <ArrowRight className="h-4 w-4" />
                  </Button>
                </div>
              )}

              {checkoutStep === "confirm" && (
                <div className="px-6 pb-6 space-y-5">
                  <button onClick={() => setCheckoutStep("info")} className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800">
                    <ArrowLeft className="h-4 w-4" /> Retour
                  </button>
                  <div className="bg-gray-50 rounded-xl p-4 space-y-2">
                    <h4 className="font-bold text-sm mb-3">Résumé</h4>
                    {cart.map(item => (
                      <div key={item.product.id} className="flex justify-between text-sm">
                        <span className="text-gray-500">{item.product.name} × {item.quantity}</span>
                        <span className="font-medium">{formatPrice(item.product.price * item.quantity)} FCFA</span>
                      </div>
                    ))}
                    <div className="border-t pt-2 mt-2 flex justify-between font-bold">
                      <span>Total</span>
                      <span style={{ color: primaryColor }}>{formatPrice(cartTotal)} FCFA</span>
                    </div>
                  </div>
                  <div className="bg-gray-50 rounded-xl p-4 text-sm">
                    <h4 className="font-bold text-sm mb-2">Livraison à</h4>
                    <p className="font-medium">{customerInfo.name}</p>
                    <p className="text-gray-500">{customerInfo.address}, {customerInfo.city}</p>
                    <p className="text-gray-500">{customerInfo.phone}</p>
                  </div>
                  <div className="space-y-3">
                    <div className="flex items-center gap-2"><CreditCard className="h-4 w-4" style={{ color: primaryColor }} /><h4 className="font-bold text-sm">Mode de paiement</h4></div>
                    
                    {/* Interior city warning in modal */}
                    {shop.theme_config?.force_mobile_money_interior && customerInfo.city && !isAbidjanZone(customerInfo.city) && (
                      <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs sm:text-sm text-amber-800">
                        <span className="font-semibold">⚠️ Vous êtes hors Abidjan :</span> Le paiement par Mobile Money est obligatoire pour l'expédition de votre colis.
                      </div>
                    )}

                    {(() => {
                      const isInterior = shop.theme_config?.force_mobile_money_interior && customerInfo.city && !isAbidjanZone(customerInfo.city);
                      const methods = isInterior
                        ? [{ value: "mobile_money", label: "Mobile Money", icon: "📱", desc: "Wave, Orange, MTN, Moov" }]
                        : [
                            { value: "cash_on_delivery", label: "Paiement à la livraison", icon: "💵", desc: "Payez en espèces à la réception" },
                            { value: "mobile_money", label: "Mobile Money", icon: "📱", desc: "Wave, Orange, MTN, Moov" },
                          ];
                      
                      if (isInterior && customerInfo.paymentMethod !== 'mobile_money') {
                        setTimeout(() => setCustomerInfo(prev => ({ ...prev, paymentMethod: 'mobile_money' })), 0);
                      }

                      return methods.map(method => (
                        <button key={method.value} onClick={() => setCustomerInfo({ ...customerInfo, paymentMethod: method.value })}
                          className={`flex items-center gap-3 p-3.5 rounded-xl border-2 text-left transition-all w-full ${customerInfo.paymentMethod === method.value ? "shadow-sm" : "border-gray-200 hover:border-gray-300"}`}
                          style={customerInfo.paymentMethod === method.value ? { borderColor: primaryColor } : {}}
                        >
                          <span className="text-2xl">{method.icon}</span>
                          <div>
                            <p className="font-semibold text-sm">{method.label}</p>
                            <p className="text-xs text-gray-500">{method.desc}</p>
                          </div>
                          {customerInfo.paymentMethod === method.value && <CheckCircle2 className="h-5 w-5 ml-auto" style={{ color: primaryColor }} />}
                        </button>
                      ));
                    })()}
                  </div>
                  <Button className="w-full h-12 rounded-xl text-base font-semibold gap-2 text-white" style={{ backgroundColor: primaryColor }} onClick={placeOrder} disabled={orderLoading}>
                    {orderLoading ? "Traitement..." : <><ShoppingCart className="h-5 w-5" /> Confirmer · {formatPrice(cartTotal)} FCFA</>}
                  </Button>
                </div>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Chatbot */}
      {shop.chatbot_enabled && (
        <>
          <button onClick={() => setChatOpen(!chatOpen)} className="fixed bottom-6 right-6 h-14 w-14 rounded-2xl shadow-xl flex items-center justify-center z-50 text-white transition-transform hover:scale-110" style={{ backgroundColor: primaryColor }}>
            {chatOpen ? <X className="h-6 w-6" /> : <MessageCircle className="h-6 w-6" />}
          </button>
          {chatOpen && (
            <div className="fixed bottom-24 right-6 w-80 md:w-96 bg-white border rounded-2xl shadow-2xl z-50 flex flex-col overflow-hidden" style={{ height: "420px" }}>
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
      {cartCount > 0 && !checkoutOpen && !shop.theme_config?.sticky_order_button && (
        <div className="fixed bottom-6 left-6 right-20 md:hidden z-40">
          <Button className="w-full h-14 rounded-2xl shadow-xl text-base font-semibold gap-2 text-white" style={{ backgroundColor: primaryColor }} onClick={() => { setCheckoutOpen(true); setOrderSuccess(false); }}>
            <ShoppingBag className="h-5 w-5" /> Voir le panier · {formatPrice(cartTotal)} FCFA
            <Badge className="ml-auto bg-white/20 text-white">{cartCount}</Badge>
          </Button>
        </div>
      )}

      {/* Sticky Order Button - always visible when enabled */}
      {shop.theme_config?.sticky_order_button && product && (
        <div className="fixed bottom-4 left-4 right-4 z-[9999] bg-white rounded-2xl border shadow-[0_-4px_30px_rgba(0,0,0,0.15)] px-4 py-3">
          <div className="max-w-6xl mx-auto flex items-center gap-3">
            <div className="flex-1 min-w-0 hidden sm:block">
              <p className="font-bold text-sm truncate">{product.name}</p>
              <p className="font-bold text-lg" style={{ color: primaryColor }}>{formatPrice(product.price)} FCFA</p>
            </div>
            <Button 
              className="flex-1 sm:flex-none h-12 sm:h-14 rounded-xl text-base sm:text-lg font-bold gap-2 text-white shadow-lg hover:shadow-xl transition-all animate-pulse hover:animate-none"
              style={{ backgroundColor: primaryColor }}
              onClick={() => {
                if (shop.theme_config?.single_page_checkout) {
                  addToCart(product, quantity);
                  setShowInlineCheckout(true);
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                } else {
                  addToCart(product, quantity);
                  setCheckoutOpen(true);
                  setOrderSuccess(false);
                }
              }}
              disabled={product.stock_quantity !== null && product.stock_quantity <= 0}
            >
              <ShoppingCart className="h-5 w-5" />
              {product.stock_quantity !== null && product.stock_quantity <= 0 ? "Rupture de stock" : "Commander maintenant"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProductView;
