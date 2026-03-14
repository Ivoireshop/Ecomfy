import { useEffect, useState, useRef } from "react";
import { useParams } from "react-router-dom";
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
import { ShoppingCart, Plus, Minus, Trash2, MessageCircle, Send, X, Store, Phone } from "lucide-react";

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

interface CartItem {
  product: Product;
  quantity: number;
}

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

const ShopView = () => {
  const { slug } = useParams<{ slug: string }>();
  const [shop, setShop] = useState<any>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [orderLoading, setOrderLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const [customerInfo, setCustomerInfo] = useState({
    name: "", phone: "", email: "", address: "", city: "", paymentMethod: "mobile_money",
  });

  useEffect(() => {
    fetchShop();
  }, [slug]);

  const fetchShop = async () => {
    if (!slug) return;
    const { data: shopData } = await supabase.from("shops").select("*").eq("slug", slug).eq("is_published", true).eq("is_activated", true).single() as any;
    if (!shopData) { setLoading(false); return; }
    setShop(shopData);

    const { data: productsData } = await supabase.from("products").select("*, product_images(*)").eq("shop_id", shopData.id).eq("is_published", true).order("display_order") as any;
    setProducts(productsData || []);
    setLoading(false);

    if (shopData.chatbot_enabled) {
      setChatMessages([{ role: "assistant", content: shopData.chatbot_welcome_message || "Bienvenue ! Comment puis-je vous aider ?" }]);
    }
  };

  const categories = ["all", ...new Set(products.map(p => p.category))];

  const filteredProducts = selectedCategory === "all" ? products : products.filter(p => p.category === selectedCategory);

  const addToCart = (product: Product) => {
    setCart(prev => {
      const existing = prev.find(item => item.product.id === product.id);
      if (existing) return prev.map(item => item.product.id === product.id ? { ...item, quantity: item.quantity + 1 } : item);
      return [...prev, { product, quantity: 1 }];
    });
    toast({ title: "Ajouté au panier", description: product.name });
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
      
      const { data: order, error: orderError } = await supabase.from("orders").insert({
        shop_id: shop.id,
        order_number: orderNumData || `VP-${Date.now()}`,
        customer_name: customerInfo.name,
        customer_email: customerInfo.email,
        customer_phone: customerInfo.phone,
        customer_address: customerInfo.address,
        customer_city: customerInfo.city,
        subtotal: cartTotal,
        commission_amount: commissionAmount,
        total: cartTotal,
        payment_method: customerInfo.paymentMethod,
      }).select().single() as any;

      if (orderError) throw orderError;

      const orderItems = cart.map(item => ({
        order_id: order.id,
        product_id: item.product.id,
        product_name: item.product.name,
        product_image_url: item.product.product_images?.[0]?.image_url || null,
        quantity: item.quantity,
        unit_price: item.product.price,
        total_price: item.product.price * item.quantity,
      }));

      await supabase.from("order_items").insert(orderItems) as any;

      toast({ title: "🎉 Commande passée !", description: `N° ${order.order_number}. Le vendeur vous contactera bientôt.` });
      setCart([]);
      setCheckoutOpen(false);
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
      setChatMessages(prev => [...prev, { role: "assistant", content: "Désolé, je ne peux pas répondre pour le moment. Contactez le vendeur directement." }]);
    } finally {
      setChatLoading(false);
    }
  };

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [chatMessages]);

  if (loading) return <div className="min-h-screen flex items-center justify-center"><div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" /></div>;
  if (!shop) return <div className="min-h-screen flex items-center justify-center flex-col gap-4"><Store className="h-16 w-16 text-muted-foreground" /><h1 className="text-2xl font-bold">Boutique introuvable</h1></div>;

  const primaryColor = shop.primary_color || "#2563eb";

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b sticky top-0 z-40 bg-background/95 backdrop-blur">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {shop.logo_url ? <img src={shop.logo_url} alt="" className="h-8 w-8 rounded" /> : <Store className="h-6 w-6" style={{ color: primaryColor }} />}
            <h1 className="font-bold text-lg">{shop.business_name}</h1>
          </div>
          <div className="flex items-center gap-3">
            {shop.whatsapp_number && (
              <a href={`https://wa.me/${shop.whatsapp_number.replace(/[^0-9]/g, "")}`} target="_blank" rel="noopener noreferrer">
                <Button variant="outline" size="sm" className="gap-1"><Phone className="h-4 w-4" /> Contact</Button>
              </a>
            )}
            <Button variant="outline" size="sm" className="gap-1 relative" onClick={() => setCheckoutOpen(true)}>
              <ShoppingCart className="h-4 w-4" />
              Panier
              {cartCount > 0 && <Badge className="absolute -top-2 -right-2 h-5 w-5 p-0 flex items-center justify-center text-xs" style={{ backgroundColor: primaryColor }}>{cartCount}</Badge>}
            </Button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="py-12 px-4 text-center" style={{ background: `linear-gradient(135deg, ${primaryColor}10, ${shop.secondary_color || "#7c3aed"}10)` }}>
        <h2 className="text-3xl md:text-4xl font-bold mb-3">{shop.business_name}</h2>
        {shop.business_description && <p className="text-muted-foreground max-w-2xl mx-auto">{shop.business_description}</p>}
      </section>

      {/* Categories */}
      {categories.length > 2 && (
        <div className="max-w-7xl mx-auto px-4 py-4 flex gap-2 overflow-x-auto">
          {categories.map(cat => (
            <Button key={cat} variant={selectedCategory === cat ? "default" : "outline"} size="sm" onClick={() => setSelectedCategory(cat)} style={selectedCategory === cat ? { backgroundColor: primaryColor } : {}}>
              {cat === "all" ? "Tout" : cat}
            </Button>
          ))}
        </div>
      )}

      {/* Products Grid */}
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {filteredProducts.map(product => (
            <Card key={product.id} className="overflow-hidden hover:shadow-lg transition-shadow">
              <div className="aspect-square bg-muted relative">
                {product.product_images?.[0] ? (
                  <img src={product.product_images[0].image_url} alt={product.name} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center"><Store className="h-8 w-8 text-muted-foreground" /></div>
                )}
                {product.compare_at_price && product.compare_at_price > product.price && (
                  <Badge className="absolute top-2 left-2 bg-red-500">-{Math.round((1 - product.price / product.compare_at_price) * 100)}%</Badge>
                )}
                {product.is_digital && <Badge className="absolute top-2 right-2" variant="secondary">Digital</Badge>}
              </div>
              <div className="p-3">
                <h3 className="font-medium text-sm line-clamp-2">{product.name}</h3>
                {product.short_description && <p className="text-xs text-muted-foreground line-clamp-1 mt-1">{product.short_description}</p>}
                <div className="flex items-center gap-2 mt-2">
                  <span className="font-bold text-sm" style={{ color: primaryColor }}>{new Intl.NumberFormat("fr-FR").format(product.price)} FCFA</span>
                  {product.compare_at_price && product.compare_at_price > product.price && (
                    <span className="text-xs text-muted-foreground line-through">{new Intl.NumberFormat("fr-FR").format(product.compare_at_price)}</span>
                  )}
                </div>
                <Button size="sm" className="w-full mt-3 gap-1" style={{ backgroundColor: primaryColor }} onClick={() => addToCart(product)}>
                  <ShoppingCart className="h-3 w-3" /> Ajouter
                </Button>
              </div>
            </Card>
          ))}
        </div>
        {filteredProducts.length === 0 && <p className="text-center text-muted-foreground py-12">Aucun produit dans cette catégorie</p>}
      </div>

      {/* Footer */}
      <footer className="border-t py-8 px-4 text-center text-sm text-muted-foreground">
        <p>© {new Date().getFullYear()} {shop.business_name}. Propulsé par <span className="font-semibold">VisualPro</span></p>
        {shop.whatsapp_number && <p className="mt-1">Contact: {shop.whatsapp_number}</p>}
      </footer>

      {/* Checkout Dialog */}
      <Dialog open={checkoutOpen} onOpenChange={setCheckoutOpen}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>🛒 Panier ({cartCount} articles)</DialogTitle></DialogHeader>
          {cart.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">Votre panier est vide</p>
          ) : (
            <div className="space-y-4">
              {cart.map(item => (
                <div key={item.product.id} className="flex items-center gap-3">
                  <div className="h-12 w-12 bg-muted rounded overflow-hidden flex-shrink-0">
                    {item.product.product_images?.[0] && <img src={item.product.product_images[0].image_url} alt="" className="h-full w-full object-cover" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{item.product.name}</p>
                    <p className="text-xs text-muted-foreground">{new Intl.NumberFormat("fr-FR").format(item.product.price)} FCFA</p>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => updateQuantity(item.product.id, -1)}><Minus className="h-3 w-3" /></Button>
                    <span className="text-sm w-6 text-center">{item.quantity}</span>
                    <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => updateQuantity(item.product.id, 1)}><Plus className="h-3 w-3" /></Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => removeFromCart(item.product.id)}><Trash2 className="h-3 w-3 text-destructive" /></Button>
                  </div>
                </div>
              ))}
              <div className="border-t pt-3">
                <div className="flex justify-between font-semibold"><span>Total</span><span>{new Intl.NumberFormat("fr-FR").format(cartTotal)} FCFA</span></div>
              </div>
              <div className="space-y-3 border-t pt-3">
                <h4 className="font-medium">Informations de livraison</h4>
                <div><Label>Nom complet *</Label><Input value={customerInfo.name} onChange={(e) => setCustomerInfo({ ...customerInfo, name: e.target.value })} /></div>
                <div><Label>Téléphone *</Label><Input value={customerInfo.phone} onChange={(e) => setCustomerInfo({ ...customerInfo, phone: e.target.value })} placeholder="+225 07..." /></div>
                <div><Label>Email</Label><Input type="email" value={customerInfo.email} onChange={(e) => setCustomerInfo({ ...customerInfo, email: e.target.value })} /></div>
                <div><Label>Adresse de livraison</Label><Textarea value={customerInfo.address} onChange={(e) => setCustomerInfo({ ...customerInfo, address: e.target.value })} rows={2} /></div>
                <div><Label>Ville</Label><Input value={customerInfo.city} onChange={(e) => setCustomerInfo({ ...customerInfo, city: e.target.value })} /></div>
                <div>
                  <Label>Mode de paiement</Label>
                  <Select value={customerInfo.paymentMethod} onValueChange={(v) => setCustomerInfo({ ...customerInfo, paymentMethod: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="mobile_money">Mobile Money</SelectItem>
                      <SelectItem value="cash_on_delivery">Paiement à la livraison</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button className="w-full" style={{ backgroundColor: primaryColor }} onClick={placeOrder} disabled={orderLoading || !customerInfo.name || !customerInfo.phone}>
                  {orderLoading ? "Traitement..." : "Commander"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Chatbot */}
      {shop.chatbot_enabled && (
        <>
          <button
            onClick={() => setChatOpen(!chatOpen)}
            className="fixed bottom-6 right-6 h-14 w-14 rounded-full shadow-lg flex items-center justify-center z-50 text-white"
            style={{ backgroundColor: primaryColor }}
          >
            {chatOpen ? <X className="h-6 w-6" /> : <MessageCircle className="h-6 w-6" />}
          </button>

          {chatOpen && (
            <div className="fixed bottom-24 right-6 w-80 md:w-96 bg-background border rounded-2xl shadow-2xl z-50 flex flex-col" style={{ height: "400px" }}>
              <div className="p-3 border-b rounded-t-2xl text-white font-semibold" style={{ backgroundColor: primaryColor }}>
                💬 Assistant {shop.business_name}
              </div>
              <div className="flex-1 overflow-y-auto p-3 space-y-3">
                {chatMessages.map((msg, i) => (
                  <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                    <div className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${msg.role === "user" ? "text-white" : "bg-muted"}`} style={msg.role === "user" ? { backgroundColor: primaryColor } : {}}>
                      {msg.content}
                    </div>
                  </div>
                ))}
                {chatLoading && <div className="flex justify-start"><div className="bg-muted rounded-lg px-3 py-2 text-sm animate-pulse">Réflexion...</div></div>}
                <div ref={chatEndRef} />
              </div>
              <div className="p-3 border-t flex gap-2">
                <Input value={chatInput} onChange={(e) => setChatInput(e.target.value)} placeholder="Votre message..." onKeyDown={(e) => e.key === "Enter" && sendChatMessage()} className="flex-1" />
                <Button size="icon" onClick={sendChatMessage} disabled={chatLoading} style={{ backgroundColor: primaryColor }}><Send className="h-4 w-4 text-white" /></Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default ShopView;
