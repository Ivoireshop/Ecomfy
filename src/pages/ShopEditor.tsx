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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { Loader2, Plus, Trash2, Eye, Save, Package, ShoppingCart, Image as ImageIcon, Bell, Upload, Settings, ArrowLeft, BarChart3, Palette, MessageSquare, Globe, Search, MoreVertical, Edit, Zap, TrendingUp } from "lucide-react";

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
  order_items?: { id: string; product_name: string; quantity: number; unit_price: number; total_price: number; product_image_url: string | null }[];
}

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  new: { label: "Nouveau", color: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300" },
  confirmed: { label: "Confirmé", color: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300" },
  processing: { label: "En traitement", color: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300" },
  shipped: { label: "Expédié", color: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300" },
  delivered: { label: "Livré", color: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300" },
  cancelled: { label: "Annulé", color: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300" },
};

type ActiveSection = "overview" | "products" | "orders" | "appearance" | "settings";

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
  const [newProduct, setNewProduct] = useState({
    name: "", description: "", short_description: "", price: 0, compare_at_price: 0,
    category: "général", stock_quantity: 10, is_digital: false, is_published: true,
  });
  const [uploadingImage, setUploadingImage] = useState(false);
  const [unreadOrders, setUnreadOrders] = useState(0);

  const fetchData = useCallback(async () => {
    if (!id) return;
    const [shopRes, productsRes, ordersRes] = await Promise.all([
      supabase.from("shops").select("*").eq("id", id).single() as any,
      supabase.from("products").select("*, product_images(*)").eq("shop_id", id).order("display_order") as any,
      supabase.from("orders").select("*, order_items(*)").eq("shop_id", id).order("created_at", { ascending: false }) as any,
    ]);
    if (shopRes.data) setShop(shopRes.data);
    if (productsRes.data) setProducts(productsRes.data);
    if (ordersRes.data) {
      setOrders(ordersRes.data);
      setUnreadOrders(ordersRes.data.filter((o: Order) => !o.is_read).length);
    }
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

  const saveShop = async () => {
    if (!shop) return;
    setSaving(true);
    const { error } = await supabase.from("shops").update({
      business_name: shop.business_name, business_description: shop.business_description,
      whatsapp_number: shop.whatsapp_number, phone_number: shop.phone_number, email: shop.email,
      city: shop.city, primary_color: shop.primary_color, secondary_color: shop.secondary_color,
      chatbot_enabled: shop.chatbot_enabled, chatbot_welcome_message: shop.chatbot_welcome_message,
      is_published: shop.is_published, seo_title: shop.seo_title, seo_description: shop.seo_description,
    }).eq("id", shop.id) as any;
    if (error) toast({ title: "Erreur", description: error.message, variant: "destructive" });
    else toast({ title: "✓ Sauvegardé" });
    setSaving(false);
  };

  const saveProduct = async () => {
    if (!id) return;
    const productData = { ...newProduct, shop_id: id };
    let result;
    if (editingProduct) {
      result = await supabase.from("products").update(productData).eq("id", editingProduct.id) as any;
    } else {
      result = await supabase.from("products").insert(productData) as any;
    }
    if (result.error) {
      toast({ title: "Erreur", description: result.error.message, variant: "destructive" });
    } else {
      toast({ title: editingProduct ? "Produit modifié" : "Produit ajouté !" });
      setProductDialogOpen(false);
      setEditingProduct(null);
      setNewProduct({ name: "", description: "", short_description: "", price: 0, compare_at_price: 0, category: "général", stock_quantity: 10, is_digital: false, is_published: true });
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
    toast({ title: "Image ajoutée !" });
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
  const filteredProducts = products.filter(p => p.name.toLowerCase().includes(searchQuery.toLowerCase()));
  const totalRevenue = orders.reduce((sum, o) => sum + o.total, 0);
  const newOrders = orders.filter(o => o.order_status === "new").length;

  const NAV_ITEMS = [
    { id: "overview" as const, label: "Vue d'ensemble", icon: BarChart3 },
    { id: "products" as const, label: "Produits", icon: Package, count: products.length },
    { id: "orders" as const, label: "Commandes", icon: ShoppingCart, count: unreadOrders || undefined },
    { id: "appearance" as const, label: "Apparence", icon: Palette },
    { id: "settings" as const, label: "Paramètres", icon: Settings },
  ];

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Top Bar */}
      <header className="border-b bg-card sticky top-0 z-20">
        <div className="flex items-center justify-between px-4 md:px-6 py-3">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate("/shop-manager")}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: primaryColor + "20" }}>
                <div className="h-4 w-4 rounded" style={{ backgroundColor: primaryColor }} />
              </div>
              <div>
                <h1 className="font-bold text-sm md:text-base leading-none">{shop.business_name}</h1>
                <p className="text-[10px] text-muted-foreground">/{shop.slug}</p>
              </div>
            </div>
            {!shop.is_activated && (
              <Badge variant="outline" className="text-orange-600 border-orange-300 bg-orange-50 dark:bg-orange-950/20">
                <Zap className="h-3 w-3 mr-1" /> Non activée
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => window.open(`/shop/${shop.slug}`, "_blank")} className="gap-1.5 hidden md:flex">
              <Eye className="h-4 w-4" /> Voir la boutique
            </Button>
            <Button size="sm" onClick={saveShop} disabled={saving} className="gap-1.5">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              <span className="hidden md:inline">Sauvegarder</span>
            </Button>
          </div>
        </div>
        {/* Navigation Tabs */}
        <div className="flex gap-0 px-4 md:px-6 overflow-x-auto">
          {NAV_ITEMS.map(item => (
            <button
              key={item.id}
              onClick={() => setActiveSection(item.id)}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                activeSection === item.id 
                  ? 'border-primary text-primary' 
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
              {item.count !== undefined && item.count > 0 && (
                <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                  item.id === 'orders' && unreadOrders > 0 
                    ? 'bg-destructive text-destructive-foreground' 
                    : 'bg-muted text-muted-foreground'
                }`}>
                  {item.count}
                </span>
              )}
            </button>
          ))}
        </div>
      </header>

      {/* Activation Banner */}
      {!shop.is_activated && (
        <div className="bg-gradient-to-r from-orange-500 to-amber-500 text-primary-foreground px-4 md:px-6 py-3">
          <div className="max-w-5xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Zap className="h-5 w-5" />
              <div>
                <p className="font-semibold text-sm">Activez votre boutique pour la rendre visible</p>
                <p className="text-xs opacity-90">Frais unique de 2$ • Accès complet à toutes les fonctionnalités</p>
              </div>
            </div>
            <Button size="sm" variant="secondary" className="font-semibold shadow-lg">Activer · 2$</Button>
          </div>
        </div>
      )}

      <div className="flex-1 px-4 md:px-6 py-6 max-w-6xl mx-auto w-full">
        {/* Overview */}
        {activeSection === "overview" && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card className="p-5">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
                    <TrendingUp className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{new Intl.NumberFormat("fr-FR").format(totalRevenue)}</p>
                    <p className="text-xs text-muted-foreground">FCFA de ventes</p>
                  </div>
                </div>
              </Card>
              <Card className="p-5">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-blue-500/10 flex items-center justify-center">
                    <ShoppingCart className="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{orders.length}</p>
                    <p className="text-xs text-muted-foreground">Commandes</p>
                  </div>
                </div>
              </Card>
              <Card className="p-5">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-green-500/10 flex items-center justify-center">
                    <Package className="h-5 w-5 text-green-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{products.length}</p>
                    <p className="text-xs text-muted-foreground">Produits</p>
                  </div>
                </div>
              </Card>
              <Card className="p-5">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-orange-500/10 flex items-center justify-center">
                    <Bell className="h-5 w-5 text-orange-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{newOrders}</p>
                    <p className="text-xs text-muted-foreground">Nouvelles</p>
                  </div>
                </div>
              </Card>
            </div>

            {/* Recent Orders */}
            <Card className="p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold">Commandes récentes</h3>
                <Button variant="ghost" size="sm" onClick={() => setActiveSection("orders")}>Tout voir</Button>
              </div>
              {orders.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">Aucune commande pour le moment</p>
              ) : (
                <div className="space-y-3">
                  {orders.slice(0, 5).map(order => (
                    <div key={order.id} className={`flex items-center justify-between p-3 rounded-xl ${!order.is_read ? 'bg-primary/5' : 'bg-muted/30'}`}>
                      <div className="flex items-center gap-3">
                        {!order.is_read && <div className="h-2 w-2 rounded-full bg-primary" />}
                        <div>
                          <p className="text-sm font-medium">{order.customer_name}</p>
                          <p className="text-xs text-muted-foreground">{order.order_number}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-bold">{new Intl.NumberFormat("fr-FR").format(order.total)} FCFA</p>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full ${STATUS_MAP[order.order_status]?.color || ''}`}>
                          {STATUS_MAP[order.order_status]?.label || order.order_status}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>
        )}

        {/* Products */}
        {activeSection === "products" && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row gap-3 justify-between">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Rechercher un produit..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="pl-10" />
              </div>
              <Dialog open={productDialogOpen} onOpenChange={(open) => {
                setProductDialogOpen(open);
                if (!open) { setEditingProduct(null); setNewProduct({ name: "", description: "", short_description: "", price: 0, compare_at_price: 0, category: "général", stock_quantity: 10, is_digital: false, is_published: true }); }
              }}>
                <DialogTrigger asChild>
                  <Button className="gap-2"><Plus className="h-4 w-4" /> Ajouter un produit</Button>
                </DialogTrigger>
                <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>{editingProduct ? "Modifier le produit" : "Nouveau produit"}</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 pt-2">
                    <div className="space-y-1.5"><Label>Nom du produit *</Label><Input value={newProduct.name} onChange={(e) => setNewProduct({ ...newProduct, name: e.target.value })} placeholder="Ex: T-shirt Premium" /></div>
                    <div className="space-y-1.5"><Label>Description courte</Label><Input value={newProduct.short_description} onChange={(e) => setNewProduct({ ...newProduct, short_description: e.target.value })} placeholder="Résumé en une ligne" /></div>
                    <div className="space-y-1.5"><Label>Description complète</Label><Textarea value={newProduct.description} onChange={(e) => setNewProduct({ ...newProduct, description: e.target.value })} rows={3} /></div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5"><Label>Prix (FCFA) *</Label><Input type="number" value={newProduct.price} onChange={(e) => setNewProduct({ ...newProduct, price: Number(e.target.value) })} /></div>
                      <div className="space-y-1.5"><Label>Ancien prix</Label><Input type="number" value={newProduct.compare_at_price} onChange={(e) => setNewProduct({ ...newProduct, compare_at_price: Number(e.target.value) })} /></div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5"><Label>Catégorie</Label><Input value={newProduct.category} onChange={(e) => setNewProduct({ ...newProduct, category: e.target.value })} /></div>
                      <div className="space-y-1.5"><Label>Stock</Label><Input type="number" value={newProduct.stock_quantity} onChange={(e) => setNewProduct({ ...newProduct, stock_quantity: Number(e.target.value) })} /></div>
                    </div>
                    <div className="flex items-center gap-6">
                      <div className="flex items-center gap-2"><Switch checked={newProduct.is_digital} onCheckedChange={(v) => setNewProduct({ ...newProduct, is_digital: v })} /><Label>Digital</Label></div>
                      <div className="flex items-center gap-2"><Switch checked={newProduct.is_published} onCheckedChange={(v) => setNewProduct({ ...newProduct, is_published: v })} /><Label>Publié</Label></div>
                    </div>
                    <Button onClick={saveProduct} disabled={!newProduct.name || newProduct.price <= 0} className="w-full" size="lg">
                      {editingProduct ? "Enregistrer les modifications" : "Ajouter le produit"}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>

            {filteredProducts.length === 0 ? (
              <Card className="p-12 text-center">
                <Package className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="font-semibold mb-1">{searchQuery ? "Aucun résultat" : "Aucun produit"}</h3>
                <p className="text-sm text-muted-foreground mb-4">{searchQuery ? "Essayez un autre terme" : "Ajoutez votre premier produit pour démarrer"}</p>
                {!searchQuery && <Button onClick={() => setProductDialogOpen(true)} className="gap-2"><Plus className="h-4 w-4" /> Ajouter un produit</Button>}
              </Card>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredProducts.map((product) => (
                  <Card key={product.id} className="overflow-hidden group">
                    <div className="aspect-square bg-muted relative overflow-hidden">
                      {product.product_images && product.product_images.length > 0 ? (
                        <img src={product.product_images[0].image_url} alt={product.name} className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-300" />
                      ) : (
                        <div className="h-full w-full flex items-center justify-center">
                          <ImageIcon className="h-10 w-10 text-muted-foreground/50" />
                        </div>
                      )}
                      {!product.is_published && (
                        <Badge variant="secondary" className="absolute top-2 left-2">Brouillon</Badge>
                      )}
                      {product.is_digital && (
                        <Badge className="absolute top-2 right-2 bg-purple-500">Digital</Badge>
                      )}
                      {/* Hover Actions */}
                      <div className="absolute inset-0 bg-foreground/0 group-hover:bg-foreground/40 transition-colors flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100">
                        <label className="cursor-pointer">
                          <input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && uploadProductImage(product.id, e.target.files[0])} />
                          <Button size="sm" variant="secondary" className="gap-1" asChild><span><Upload className="h-3 w-3" /> Photo</span></Button>
                        </label>
                        <Button size="sm" variant="secondary" className="gap-1" onClick={() => {
                          setEditingProduct(product);
                          setNewProduct({ name: product.name, description: product.description || "", short_description: product.short_description || "", price: product.price, compare_at_price: product.compare_at_price || 0, category: product.category, stock_quantity: product.stock_quantity, is_digital: product.is_digital, is_published: product.is_published });
                          setProductDialogOpen(true);
                        }}>
                          <Edit className="h-3 w-3" /> Modifier
                        </Button>
                      </div>
                    </div>
                    <div className="p-4">
                      <h3 className="font-semibold text-sm mb-1 line-clamp-1">{product.name}</h3>
                      <p className="text-xs text-muted-foreground mb-2">{product.category} · Stock: {product.stock_quantity}</p>
                      <div className="flex items-center justify-between">
                        <span className="font-bold" style={{ color: primaryColor }}>{new Intl.NumberFormat("fr-FR").format(product.price)} FCFA</span>
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => deleteProduct(product.id)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Orders */}
        {activeSection === "orders" && (
          <div className="space-y-4">
            <h2 className="text-xl font-bold">Commandes ({orders.length})</h2>
            {orders.length === 0 ? (
              <Card className="p-12 text-center">
                <ShoppingCart className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="font-semibold mb-1">Aucune commande</h3>
                <p className="text-sm text-muted-foreground">Les commandes apparaîtront ici en temps réel</p>
              </Card>
            ) : (
              <div className="space-y-3">
                {orders.map((order) => (
                  <Card key={order.id} className={`overflow-hidden ${!order.is_read ? 'ring-1 ring-primary' : ''}`} onClick={() => !order.is_read && markOrderRead(order.id)}>
                    <div className="p-5">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-3">
                          {!order.is_read && <div className="h-2.5 w-2.5 rounded-full bg-primary animate-pulse" />}
                          <div>
                            <span className="font-mono text-sm font-bold">{order.order_number}</span>
                            <p className="text-sm text-muted-foreground">{order.customer_name} · {order.customer_phone}</p>
                            {order.customer_address && <p className="text-xs text-muted-foreground">{order.customer_address}, {order.customer_city}</p>}
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-bold">{new Intl.NumberFormat("fr-FR").format(order.total)} FCFA</p>
                          <p className="text-xs text-muted-foreground">{new Date(order.created_at).toLocaleDateString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</p>
                        </div>
                      </div>
                      {order.order_items && order.order_items.length > 0 && (
                        <div className="flex gap-2 mb-3 overflow-x-auto pb-1">
                          {order.order_items.map((item) => (
                            <div key={item.id} className="flex items-center gap-2 bg-muted/50 rounded-lg px-3 py-1.5 text-xs whitespace-nowrap">
                              {item.product_image_url && <img src={item.product_image_url} alt="" className="h-6 w-6 rounded object-cover" />}
                              <span>{item.quantity}x {item.product_name}</span>
                              <span className="text-muted-foreground">{new Intl.NumberFormat("fr-FR").format(item.total_price)}</span>
                            </div>
                          ))}
                        </div>
                      )}
                      <div className="flex items-center gap-3">
                        <Select value={order.order_status} onValueChange={(v) => updateOrderStatus(order.id, v)}>
                          <SelectTrigger className="w-44 h-9"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {Object.entries(STATUS_MAP).map(([key, val]) => (
                              <SelectItem key={key} value={key}>{val.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Badge variant={order.payment_method === "mobile_money" ? "default" : "outline"} className="text-xs">
                          {order.payment_method === "mobile_money" ? "Mobile Money" : "À la livraison"}
                        </Badge>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Appearance */}
        {activeSection === "appearance" && (
          <div className="space-y-6 max-w-2xl">
            <Card className="p-6 space-y-5">
              <h3 className="font-bold text-lg flex items-center gap-2"><Palette className="h-5 w-5" /> Couleurs</h3>
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label>Couleur principale</Label>
                  <div className="flex items-center gap-3">
                    <input type="color" value={shop.primary_color || "#2563eb"} onChange={(e) => setShop({ ...shop, primary_color: e.target.value })} className="h-12 w-12 rounded-xl cursor-pointer border-2 border-border" />
                    <Input value={shop.primary_color || "#2563eb"} onChange={(e) => setShop({ ...shop, primary_color: e.target.value })} className="font-mono" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Couleur secondaire</Label>
                  <div className="flex items-center gap-3">
                    <input type="color" value={shop.secondary_color || "#7c3aed"} onChange={(e) => setShop({ ...shop, secondary_color: e.target.value })} className="h-12 w-12 rounded-xl cursor-pointer border-2 border-border" />
                    <Input value={shop.secondary_color || "#7c3aed"} onChange={(e) => setShop({ ...shop, secondary_color: e.target.value })} className="font-mono" />
                  </div>
                </div>
              </div>
              {/* Preview */}
              <div className="rounded-xl overflow-hidden border">
                <div className="h-16 flex items-center px-4" style={{ background: `linear-gradient(135deg, ${shop.primary_color || "#2563eb"}, ${shop.secondary_color || "#7c3aed"})` }}>
                  <span className="text-primary-foreground font-bold">{shop.business_name}</span>
                </div>
                <div className="p-4 bg-muted/30 text-sm text-muted-foreground">Aperçu des couleurs de votre boutique</div>
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
                <div>
                  <p className="font-medium">Assistant intelligent</p>
                  <p className="text-sm text-muted-foreground">Un chatbot IA aide vos visiteurs en temps réel</p>
                </div>
                <Switch checked={shop.chatbot_enabled} onCheckedChange={(v) => setShop({ ...shop, chatbot_enabled: v })} />
              </div>
              {shop.chatbot_enabled && (
                <div className="space-y-1.5">
                  <Label>Message d'accueil</Label>
                  <Input value={shop.chatbot_welcome_message || ""} onChange={(e) => setShop({ ...shop, chatbot_welcome_message: e.target.value })} placeholder="Bienvenue ! Comment puis-je vous aider ?" />
                </div>
              )}
            </Card>
          </div>
        )}

        {/* Settings */}
        {activeSection === "settings" && (
          <div className="space-y-6 max-w-2xl">
            <Card className="p-6 space-y-4">
              <h3 className="font-bold text-lg">Informations générales</h3>
              <div className="space-y-1.5"><Label>Nom de la boutique</Label><Input value={shop.business_name} onChange={(e) => setShop({ ...shop, business_name: e.target.value })} /></div>
              <div className="space-y-1.5"><Label>Description</Label><Textarea value={shop.business_description || ""} onChange={(e) => setShop({ ...shop, business_description: e.target.value })} rows={3} /></div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5"><Label>WhatsApp</Label><Input value={shop.whatsapp_number || ""} onChange={(e) => setShop({ ...shop, whatsapp_number: e.target.value })} /></div>
                <div className="space-y-1.5"><Label>Téléphone</Label><Input value={shop.phone_number || ""} onChange={(e) => setShop({ ...shop, phone_number: e.target.value })} /></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5"><Label>Email</Label><Input value={shop.email || ""} onChange={(e) => setShop({ ...shop, email: e.target.value })} /></div>
                <div className="space-y-1.5"><Label>Ville</Label><Input value={shop.city || ""} onChange={(e) => setShop({ ...shop, city: e.target.value })} /></div>
              </div>
            </Card>

            <Card className="p-6 space-y-4">
              <h3 className="font-bold text-lg">Publication</h3>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Boutique en ligne</p>
                  <p className="text-sm text-muted-foreground">Rendre la boutique visible aux visiteurs</p>
                </div>
                <Switch checked={shop.is_published} onCheckedChange={(v) => setShop({ ...shop, is_published: v })} />
              </div>
            </Card>

            <Card className="p-6 border-destructive/20">
              <h3 className="font-bold text-lg text-destructive mb-2">Zone de danger</h3>
              <p className="text-sm text-muted-foreground mb-4">Cette action est irréversible</p>
              <Button variant="destructive" size="sm">Supprimer la boutique</Button>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
};

export default ShopEditor;
