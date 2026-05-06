import { useEffect, useState, useRef } from "react";
import { SocialProofNotification } from "@/components/shop/SocialProofNotification";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
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
}

interface CartItem { product: Product; quantity: number; }
interface ChatMessage { role: "user" | "assistant"; content: string; }

const ShopView = () => {
  const { slug, id } = useParams<{ slug?: string; id?: string }>();
  const navigate = useNavigate();
  const [shop, setShop] = useState<any>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(true);
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
  const [orderSuccess, setOrderSuccess] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const [customerInfo, setCustomerInfo] = useState({
    name: "", phone: "", email: "", address: "", city: "", paymentMethod: "mobile_money",
  });

  useEffect(() => { fetchShop(); }, [slug, id]);

  const fetchShop = async () => {
    if (!slug && !id) return;
    let shopData: any = null;

    if (id) {
      // Dedicated editor preview route (owner-only via RLS)
      const { data: previewById } = await supabase.from("shops").select("*").eq("id", id).maybeSingle() as any;
      if (previewById) {
        shopData = { ...previewById, _isPreview: true };
      }
    } else if (slug) {
      // Public live shop
      const { data: liveRows } = await supabase
        .from("shops")
        .select("*")
        .eq("slug", slug)
        .eq("is_published", true)
        .eq("is_activated", true)
        .order("created_at", { ascending: false })
        .limit(1) as any;

      const liveData = liveRows?.[0];
      if (liveData) {
        shopData = liveData;
      } else {
        // Owner fallback preview by slug
        const { data: previewRows } = await supabase
          .from("shops")
          .select("*")
          .eq("slug", slug)
          .order("created_at", { ascending: false })
          .limit(1) as any;

        const previewData = previewRows?.[0];
        if (previewData) {
          shopData = { ...previewData, _isPreview: true };
        }
      }
    }

    if (!shopData) { setLoading(false); return; }
    setShop(shopData);

    let productsQuery = supabase
      .from("products")
      .select("*, product_images(*)")
      .eq("shop_id", shopData.id)
      .order("display_order");

    if (!shopData._isPreview) {
      productsQuery = productsQuery.eq("is_published", true);
    }

    const { data: productsData } = await productsQuery as any;
    setProducts(productsData || []);
    setLoading(false);

    // Set favicon dynamically (shop branding first)
    const faviconLink = document.querySelector("link[rel~='icon']") as HTMLLinkElement || document.createElement("link");
    faviconLink.rel = "icon";
    faviconLink.type = "image/png";
    faviconLink.href = shopData.favicon_url || shopData.logo_url || "/favicon.png";
    if (!faviconLink.parentNode) document.head.appendChild(faviconLink);

    // Set page title to shop name
    document.title = shopData.seo_title || shopData.business_name || "Boutique";

    if (shopData.chatbot_enabled) {
      setChatMessages([{ role: "assistant", content: shopData.chatbot_welcome_message || "Bienvenue ! Comment puis-je vous aider ?" }]);
    }
  };

  const categories = ["all", ...new Set(products.map(p => p.category))];
  const filteredProducts = products.filter(p => {
    const matchCat = selectedCategory === "all" || p.category === selectedCategory;
    const matchSearch = !searchQuery || p.name.toLowerCase().includes(searchQuery.toLowerCase());
    return matchCat && matchSearch;
  });
  const featuredProducts = products.filter(p => p.is_featured);

  const addToCart = (product: Product) => {
    if (shop?._isPreview) {
      toast({ title: "🔒 Aperçu", description: "Activez la boutique pour recevoir des commandes." });
      return;
    }
    setCart(prev => {
      const existing = prev.find(item => item.product.id === product.id);
      if (existing) return prev.map(item => item.product.id === product.id ? { ...item, quantity: item.quantity + 1 } : item);
      return [...prev, { product, quantity: 1 }];
    });
    toast({ title: "✓ Ajouté au panier", description: product.name });
  };

  const updateQuantity = (productId: string, delta: number) => {
    setCart(prev => prev.map(item => {
      if (item.product.id !== productId) return item;
      const newQty = item.quantity + delta;
      return newQty <= 0 ? item : { ...item, quantity: newQty };
    }).filter(item => item.quantity > 0));
  };

  const removeFromCart = (productId: string) => setCart(prev => prev.filter(item => item.product.id !== productId));
  const cartTotal = cart.reduce((sum, item) => sum + item.product.price * item.quantity, 0);
  const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0);

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
      setCart([]);
      setCustomerInfo({ name: "", phone: "", email: "", address: "", city: "", paymentMethod: "mobile_money" });
    } catch (error: any) {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    } finally {
      setOrderLoading(false);
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
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-4">
        <div className="animate-spin h-10 w-10 border-4 border-primary border-t-transparent rounded-full" />
        <p className="text-sm text-muted-foreground">Chargement de la boutique...</p>
      </div>
    </div>
  );
  
  if (!shop) return (
    <div className="min-h-screen flex items-center justify-center flex-col gap-4 bg-background">
      <Store className="h-20 w-20 text-muted-foreground/30" />
      <h1 className="text-2xl font-bold">Boutique introuvable</h1>
      <p className="text-muted-foreground">Cette boutique n'existe pas ou n'est pas encore disponible</p>
    </div>
  );

  const primaryColor = shop.primary_color || "#2563eb";
  const secondaryColor = shop.secondary_color || "#7c3aed";
  const formatPrice = (n: number) => new Intl.NumberFormat("fr-FR").format(n);

  return (
    <div className="min-h-screen bg-background">
      {/* Preview Mode Banner */}
      {shop._isPreview && (
        <div className="bg-amber-500 text-white text-center py-2 px-4 text-sm font-medium sticky top-0 z-50">
          ⚠️ Mode prévisualisation — Cette boutique n'est pas encore en ligne
        </div>
      )}
      {/* Sticky Header */}
      <header className="border-b sticky top-0 z-40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div className="max-w-7xl mx-auto px-3 sm:px-4 py-2.5 sm:py-3 flex items-center justify-between gap-2 sm:gap-4">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            {shop.logo_url ? (
              <img src={shop.logo_url} alt="" className="h-8 w-8 sm:h-9 sm:w-9 rounded-xl object-cover flex-shrink-0" />
            ) : (
              <div className="h-8 w-8 sm:h-9 sm:w-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: primaryColor + "15" }}>
                <Store className="h-4 w-4 sm:h-5 sm:w-5" style={{ color: primaryColor }} />
              </div>
            )}
            <span className="font-bold text-base sm:text-lg truncate">{shop.business_name}</span>
          </div>
          
          {/* Search - Desktop */}
          <div className="hidden md:flex relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Rechercher un produit..." 
              value={searchQuery} 
              onChange={e => setSearchQuery(e.target.value)} 
              className="pl-10 bg-muted/50 border-0 focus-visible:ring-1"
            />
          </div>

          <div className="flex items-center gap-1 sm:gap-2">
            {shop.whatsapp_number && (
              <a href={`https://wa.me/${shop.whatsapp_number.replace(/[^0-9]/g, "")}`} target="_blank" rel="noopener noreferrer">
                <Button variant="ghost" size="icon" className="rounded-xl h-9 w-9">
                  <Phone className="h-4 w-4 sm:h-5 sm:w-5" />
                </Button>
              </a>
            )}
            <Button 
              variant="outline" 
              className="gap-1.5 sm:gap-2 rounded-xl relative h-9 px-3 sm:px-4" 
              onClick={() => {
                if (shop._isPreview) return;
                setCheckoutOpen(true);
                setOrderSuccess(false);
              }}
              disabled={shop._isPreview}
              title={shop._isPreview ? "Disponible une fois la boutique activée" : undefined}
            >
              <ShoppingBag className="h-4 w-4 sm:h-5 sm:w-5" />
              <span className="hidden sm:inline text-sm">Panier</span>
              {cartCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 h-5 w-5 rounded-full text-[10px] font-bold flex items-center justify-center text-primary-foreground" style={{ backgroundColor: primaryColor }}>
                  {cartCount}
                </span>
              )}
            </Button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden" style={{ background: `linear-gradient(145deg, ${primaryColor}, ${secondaryColor})` }}>
        {shop.banner_url ? (
          <div className="absolute inset-0">
            <img src={shop.banner_url} alt="" className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/40 to-black/20" />
          </div>
        ) : (
          <div className="absolute inset-0 opacity-10">
            <div className="absolute top-0 right-0 w-96 h-96 rounded-full bg-white/20 -translate-y-1/2 translate-x-1/2" />
            <div className="absolute bottom-0 left-0 w-64 h-64 rounded-full bg-white/20 translate-y-1/2 -translate-x-1/2" />
          </div>
        )}
        <div className="relative max-w-7xl mx-auto px-4 py-12 sm:py-16 md:py-24 text-center text-primary-foreground">
          {shop.logo_url && (
            <img src={shop.logo_url} alt={shop.business_name} className="h-16 w-16 sm:h-20 sm:w-20 rounded-2xl object-cover mx-auto mb-4 shadow-lg border-2 border-white/20" />
          )}
          <h1 className="text-3xl sm:text-4xl md:text-6xl font-bold mb-3 sm:mb-4 tracking-tight">{shop.business_name}</h1>
          {shop.business_description && (
            <p className="text-base sm:text-lg md:text-xl opacity-90 max-w-2xl mx-auto leading-relaxed">{shop.business_description}</p>
          )}
          <div className="flex gap-3 justify-center mt-6 sm:mt-8 flex-wrap">
            <Button size="lg" variant="secondary" className="rounded-xl gap-2 font-semibold shadow-lg h-11 sm:h-12 text-sm sm:text-base" onClick={() => document.getElementById("products")?.scrollIntoView({ behavior: "smooth" })}>
              <ShoppingBag className="h-4 w-4 sm:h-5 sm:w-5" /> Voir les produits
            </Button>
            {shop.whatsapp_number && (
              <a href={`https://wa.me/${shop.whatsapp_number.replace(/[^0-9]/g, "")}`} target="_blank" rel="noopener noreferrer">
                <Button size="lg" variant="outline" className="rounded-xl gap-2 border-primary-foreground/30 text-primary-foreground hover:bg-primary-foreground/10 h-11 sm:h-12 text-sm sm:text-base">
                  <MessageCircle className="h-4 w-4 sm:h-5 sm:w-5" /> Nous contacter
                </Button>
              </a>
            )}
          </div>
        </div>
      </section>

      {/* Featured Products */}
      {featuredProducts.length > 0 && (
        <section className="max-w-7xl mx-auto px-4 py-12">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold">⭐ Produits en vedette</h2>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {featuredProducts.slice(0, 4).map(product => (
              <ProductCard key={product.id} product={product} primaryColor={primaryColor} onAddToCart={addToCart} onView={(p) => {
                const base = shop._isPreview ? `/shop-preview/${shop.id}` : `/shop/${shop.slug}`;
                navigate(`${base}/product?product=${p.id}`);
              }} formatPrice={formatPrice} />
            ))}
          </div>
        </section>
      )}

      {/* All Products */}
      <section id="products" className="max-w-7xl mx-auto px-4 py-12">
        <h2 className="text-2xl font-bold mb-6">Tous les produits</h2>
        
        {/* Mobile Search */}
        <div className="md:hidden relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Rechercher..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="pl-10" />
        </div>

        {/* Categories */}
        {categories.length > 2 && (
          <div className="flex gap-2 overflow-x-auto pb-4 mb-4 scrollbar-hide">
            {categories.map(cat => (
              <Button
                key={cat}
                variant={selectedCategory === cat ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedCategory(cat)}
                className="rounded-full whitespace-nowrap"
                style={selectedCategory === cat ? { backgroundColor: primaryColor } : {}}
              >
                {cat === "all" ? "Tout voir" : cat}
              </Button>
            ))}
          </div>
        )}

        <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4 md:gap-6">
          {filteredProducts.map(product => (
            <ProductCard key={product.id} product={product} primaryColor={primaryColor} onAddToCart={addToCart} onView={(p) => {
              const base = shop._isPreview ? `/shop-preview/${shop.id}` : `/shop/${shop.slug}`;
              navigate(`${base}/product?product=${p.id}`);
            }} formatPrice={formatPrice} />
          ))}
        </div>
        {filteredProducts.length === 0 && (
          <div className="text-center py-16">
            <ShoppingBag className="h-16 w-16 mx-auto text-muted-foreground/30 mb-4" />
            <p className="text-lg font-medium">Aucun produit trouvé</p>
            <p className="text-sm text-muted-foreground">Essayez une autre catégorie ou recherche</p>
          </div>
        )}
      </section>

      {/* Contact Section */}
      <section className="border-t bg-muted/30">
        <div className="max-w-7xl mx-auto px-4 py-16 text-center">
          <h2 className="text-2xl font-bold mb-2">Une question ?</h2>
          <p className="text-muted-foreground mb-6">N'hésitez pas à nous contacter</p>
          <div className="flex flex-wrap gap-4 justify-center">
            {shop.whatsapp_number && (
              <a href={`https://wa.me/${shop.whatsapp_number.replace(/[^0-9]/g, "")}`} target="_blank" rel="noopener noreferrer">
                <Button size="lg" className="rounded-xl gap-2" style={{ backgroundColor: "#25D366" }}>
                  <MessageCircle className="h-5 w-5" /> WhatsApp
                </Button>
              </a>
            )}
            {shop.phone_number && (
              <a href={`tel:${shop.phone_number}`}>
                <Button size="lg" variant="outline" className="rounded-xl gap-2">
                  <Phone className="h-5 w-5" /> {shop.phone_number}
                </Button>
              </a>
            )}
            {shop.email && (
              <a href={`mailto:${shop.email}`}>
                <Button size="lg" variant="outline" className="rounded-xl gap-2">
                  <Mail className="h-5 w-5" /> Email
                </Button>
              </a>
            )}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t py-8 px-4">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            {shop.logo_url ? <img src={shop.logo_url} alt="" className="h-6 w-6 rounded" /> : <Store className="h-4 w-4" style={{ color: primaryColor }} />}
            <span>© {new Date().getFullYear()} {shop.business_name}</span>
          </div>
          <div className="flex items-center gap-1">
            {shop.city && <><MapPin className="h-3 w-3" /> {shop.city}, {shop.country || "Côte d'Ivoire"} · </>}
            Propulsé par <span className="font-semibold text-foreground ml-1">VisualPro</span>
          </div>
        </div>
      </footer>

      {/* Product Detail Dialog */}
      <Dialog open={!!selectedProduct} onOpenChange={() => setSelectedProduct(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          {selectedProduct && (
            <>
              <div className="aspect-square rounded-xl overflow-hidden bg-muted mb-4">
                {selectedProduct.product_images?.[0] ? (
                  <img src={selectedProduct.product_images[0].image_url} alt={selectedProduct.name} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center"><Store className="h-16 w-16 text-muted-foreground/30" /></div>
                )}
              </div>
              {selectedProduct.product_images && selectedProduct.product_images.length > 1 && (
                <div className="flex gap-2 mb-4 overflow-x-auto">
                  {selectedProduct.product_images.map((img, i) => (
                    <img key={img.id} src={img.image_url} alt="" className="h-16 w-16 rounded-lg object-cover border-2 border-transparent hover:border-primary cursor-pointer" />
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
                <div className="flex gap-3 pt-2">
                  {shop._isPreview ? (
                    <div className="flex-1 rounded-xl border-2 border-dashed px-4 py-3 text-center text-xs text-muted-foreground" style={{ borderColor: primaryColor + "40" }}>
                      🔒 Commande disponible après activation de la boutique
                    </div>
                  ) : (
                    <Button className="flex-1 rounded-xl gap-2 h-12 text-base" style={{ backgroundColor: primaryColor }} onClick={() => { addToCart(selectedProduct); setSelectedProduct(null); }}>
                      <ShoppingCart className="h-5 w-5" /> Ajouter au panier
                    </Button>
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
                        <div key={item.product.id} className="flex items-center gap-3 p-3 bg-muted/30 rounded-xl">
                          <div className="h-16 w-16 bg-muted rounded-xl overflow-hidden flex-shrink-0">
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
                            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg ml-1" onClick={() => removeFromCart(item.product.id)}><Trash2 className="h-3 w-3 text-destructive" /></Button>
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

              {/* Step: Customer Info */}
              {checkoutStep === "info" && (
                <div className="px-6 pb-6 space-y-5">
                  <button onClick={() => setCheckoutStep("cart")} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors">
                    <ArrowLeft className="h-4 w-4" /> Retour au panier
                  </button>
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4" style={{ color: primaryColor }} />
                      <h4 className="font-bold text-sm">Contact</h4>
                    </div>
                    <div className="space-y-3">
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">Nom complet *</Label>
                        <Input value={customerInfo.name} onChange={(e) => setCustomerInfo({ ...customerInfo, name: e.target.value })} placeholder="Jean Kouassi" className="rounded-xl h-11" />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">Téléphone *</Label>
                        <Input value={customerInfo.phone} onChange={(e) => setCustomerInfo({ ...customerInfo, phone: e.target.value })} placeholder="+225 07 00 00 00" className="rounded-xl h-11" />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">Email <span className="text-muted-foreground/50">(facultatif)</span></Label>
                        <Input type="email" value={customerInfo.email} onChange={(e) => setCustomerInfo({ ...customerInfo, email: e.target.value })} placeholder="jean@email.com" className="rounded-xl h-11" />
                      </div>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <Truck className="h-4 w-4" style={{ color: primaryColor }} />
                      <h4 className="font-bold text-sm">Livraison</h4>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1 col-span-2">
                        <Label className="text-xs text-muted-foreground">Adresse / Quartier *</Label>
                        <Input value={customerInfo.address} onChange={(e) => setCustomerInfo({ ...customerInfo, address: e.target.value })} placeholder="Cocody, Riviera 3" className="rounded-xl h-11" />
                      </div>
                      <div className="space-y-1 col-span-2 sm:col-span-1">
                        <Label className="text-xs text-muted-foreground">Ville *</Label>
                        <Input value={customerInfo.city} onChange={(e) => setCustomerInfo({ ...customerInfo, city: e.target.value })} placeholder="Abidjan" className="rounded-xl h-11" />
                      </div>
                    </div>
                  </div>
                  <Button className="w-full h-12 rounded-xl text-base font-semibold gap-2" style={{ backgroundColor: primaryColor }} onClick={() => setCheckoutStep("confirm")} disabled={!customerInfo.name || !customerInfo.phone || !customerInfo.address || !customerInfo.city}>
                    Passer au paiement <ArrowRight className="h-4 w-4" />
                  </Button>
                </div>
              )}

              {/* Step: Payment & Confirm */}
              {checkoutStep === "confirm" && (
                <div className="px-6 pb-6 space-y-5">
                  <button onClick={() => setCheckoutStep("info")} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors">
                    <ArrowLeft className="h-4 w-4" /> Retour
                  </button>
                  <div className="bg-muted/30 rounded-xl p-4 space-y-2">
                    <h4 className="font-bold text-sm mb-3">Résumé de la commande</h4>
                    {cart.map(item => (
                      <div key={item.product.id} className="flex justify-between text-sm">
                        <span className="text-muted-foreground">{item.product.name} × {item.quantity}</span>
                        <span className="font-medium">{formatPrice(item.product.price * item.quantity)} FCFA</span>
                      </div>
                    ))}
                    <div className="border-t pt-2 mt-2 flex justify-between font-bold">
                      <span>Total</span>
                      <span style={{ color: primaryColor }}>{formatPrice(cartTotal)} FCFA</span>
                    </div>
                  </div>
                  <div className="bg-muted/30 rounded-xl p-4 space-y-1.5 text-sm">
                    <h4 className="font-bold text-sm mb-2">Livraison à</h4>
                    <p className="font-medium">{customerInfo.name}</p>
                    <p className="text-muted-foreground">{customerInfo.address}, {customerInfo.city}</p>
                    <p className="text-muted-foreground">{customerInfo.phone}</p>
                  </div>
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <CreditCard className="h-4 w-4" style={{ color: primaryColor }} />
                      <h4 className="font-bold text-sm">Mode de paiement</h4>
                    </div>
                    <div className="grid grid-cols-1 gap-2">
                      {[
                        { value: "mobile_money", label: "Mobile Money", icon: "📱", desc: "Wave, Orange, MTN, Moov" },
                        { value: "cash_on_delivery", label: "Paiement à la livraison", icon: "💵", desc: "Payez en espèces à la réception" },
                      ].map(method => (
                        <button
                          key={method.value}
                          onClick={() => setCustomerInfo({ ...customerInfo, paymentMethod: method.value })}
                          className={`flex items-center gap-3 p-3.5 rounded-xl border-2 text-left transition-all ${customerInfo.paymentMethod === method.value ? "shadow-sm" : "border-muted hover:border-muted-foreground/30"}`}
                          style={customerInfo.paymentMethod === method.value ? { borderColor: primaryColor } : {}}
                        >
                          <span className="text-2xl">{method.icon}</span>
                          <div>
                            <p className="font-semibold text-sm">{method.label}</p>
                            <p className="text-xs text-muted-foreground">{method.desc}</p>
                          </div>
                          {customerInfo.paymentMethod === method.value && <CheckCircle2 className="h-5 w-5 ml-auto flex-shrink-0" style={{ color: primaryColor }} />}
                        </button>
                      ))}
                    </div>
                  </div>
                  <Button className="w-full h-12 rounded-xl text-base font-semibold gap-2" style={{ backgroundColor: primaryColor }} onClick={placeOrder} disabled={orderLoading}>
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

      {/* Social Proof Notifications */}
      <SocialProofNotification shopId={shop.id} enabled={shop.social_proof_enabled || false} />
    </div>
  );
};

// Product Card Component
function ProductCard({ product, primaryColor, onAddToCart, onView, formatPrice }: {
  product: Product; primaryColor: string; onAddToCart: (p: Product) => void; onView: (p: Product) => void; formatPrice: (n: number) => string;
}) {
  return (
    <Card className="overflow-hidden group cursor-pointer border-0 shadow-sm hover:shadow-xl transition-all duration-300" onClick={() => onView(product)}>
      <div className="aspect-square bg-muted relative overflow-hidden">
        {product.product_images?.[0] ? (
          <img src={product.product_images[0].image_url} alt={product.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" loading="lazy" />
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
