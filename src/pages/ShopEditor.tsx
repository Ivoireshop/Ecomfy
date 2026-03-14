import { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { Loader2, Plus, Trash2, Eye, Save, Package, ShoppingCart, Image as ImageIcon, DollarSign, Bell, Upload, Settings } from "lucide-react";

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

  // Realtime orders
  useEffect(() => {
    if (!id) return;
    const channel = supabase.channel(`shop-orders-${id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "orders", filter: `shop_id=eq.${id}` }, (payload) => {
        const newOrder = payload.new as Order;
        setOrders(prev => [newOrder, ...prev]);
        setUnreadOrders(prev => prev + 1);
        toast({ title: "🛒 Nouvelle commande !", description: `Commande de ${newOrder.customer_name} - ${newOrder.order_number}` });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [id]);

  const saveShop = async () => {
    if (!shop) return;
    setSaving(true);
    const { error } = await supabase.from("shops").update({
      business_name: shop.business_name,
      business_description: shop.business_description,
      whatsapp_number: shop.whatsapp_number,
      phone_number: shop.phone_number,
      email: shop.email,
      city: shop.city,
      primary_color: shop.primary_color,
      secondary_color: shop.secondary_color,
      chatbot_enabled: shop.chatbot_enabled,
      chatbot_welcome_message: shop.chatbot_welcome_message,
      is_published: shop.is_published,
    }).eq("id", shop.id) as any;

    if (error) toast({ title: "Erreur", description: error.message, variant: "destructive" });
    else toast({ title: "Sauvegardé !" });
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
    if (uploadError) {
      toast({ title: "Erreur upload", description: uploadError.message, variant: "destructive" });
      setUploadingImage(false);
      return;
    }
    const { data: urlData } = supabase.storage.from("shop-images").getPublicUrl(path);
    await supabase.from("product_images").insert({
      product_id: productId, image_url: urlData.publicUrl, is_primary: false,
    }) as any;
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

  if (loading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  if (!shop) return <div className="min-h-screen flex items-center justify-center"><p>Boutique introuvable</p></div>;

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold">{shop.business_name}</h1>
            <p className="text-muted-foreground text-sm">/{shop.slug}</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => window.open(`/shop/${shop.slug}`, "_blank")} className="gap-1">
              <Eye className="h-4 w-4" /> Aperçu
            </Button>
            <Button onClick={saveShop} disabled={saving} className="gap-1">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Sauvegarder
            </Button>
          </div>
        </div>

        {!shop.is_activated && (
          <Card className="p-4 mb-6 border-orange-300 bg-orange-50 dark:bg-orange-950/20">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-orange-800 dark:text-orange-200">⚡ Boutique non activée</p>
                <p className="text-sm text-orange-600 dark:text-orange-300">Activez votre boutique pour 2$ et commencez à vendre</p>
              </div>
              <Button size="sm" className="bg-orange-600 hover:bg-orange-700">Activer pour 2$</Button>
            </div>
          </Card>
        )}

        <Tabs defaultValue="products">
          <TabsList className="mb-6">
            <TabsTrigger value="products" className="gap-1"><Package className="h-4 w-4" /> Produits ({products.length})</TabsTrigger>
            <TabsTrigger value="orders" className="gap-1 relative">
              <ShoppingCart className="h-4 w-4" /> Commandes ({orders.length})
              {unreadOrders > 0 && <Badge className="absolute -top-2 -right-2 h-5 w-5 p-0 flex items-center justify-center text-xs">{unreadOrders}</Badge>}
            </TabsTrigger>
            <TabsTrigger value="settings">Paramètres</TabsTrigger>
          </TabsList>

          <TabsContent value="products">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold">Catalogue produits</h2>
              <Dialog open={productDialogOpen} onOpenChange={(open) => { setProductDialogOpen(open); if (!open) { setEditingProduct(null); setNewProduct({ name: "", description: "", short_description: "", price: 0, compare_at_price: 0, category: "général", stock_quantity: 10, is_digital: false, is_published: true }); } }}>
                <DialogTrigger asChild>
                  <Button size="sm" className="gap-1"><Plus className="h-4 w-4" /> Ajouter</Button>
                </DialogTrigger>
                <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
                  <DialogHeader><DialogTitle>{editingProduct ? "Modifier le produit" : "Ajouter un produit"}</DialogTitle></DialogHeader>
                  <div className="space-y-4">
                    <div><Label>Nom du produit *</Label><Input value={newProduct.name} onChange={(e) => setNewProduct({ ...newProduct, name: e.target.value })} placeholder="Ex: T-shirt Premium" /></div>
                    <div><Label>Description courte</Label><Input value={newProduct.short_description} onChange={(e) => setNewProduct({ ...newProduct, short_description: e.target.value })} placeholder="Résumé en une ligne" /></div>
                    <div><Label>Description complète</Label><Textarea value={newProduct.description} onChange={(e) => setNewProduct({ ...newProduct, description: e.target.value })} rows={3} /></div>
                    <div className="grid grid-cols-2 gap-4">
                      <div><Label>Prix (FCFA) *</Label><Input type="number" value={newProduct.price} onChange={(e) => setNewProduct({ ...newProduct, price: Number(e.target.value) })} /></div>
                      <div><Label>Ancien prix</Label><Input type="number" value={newProduct.compare_at_price} onChange={(e) => setNewProduct({ ...newProduct, compare_at_price: Number(e.target.value) })} /></div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div><Label>Catégorie</Label><Input value={newProduct.category} onChange={(e) => setNewProduct({ ...newProduct, category: e.target.value })} /></div>
                      <div><Label>Stock</Label><Input type="number" value={newProduct.stock_quantity} onChange={(e) => setNewProduct({ ...newProduct, stock_quantity: Number(e.target.value) })} /></div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-2"><Switch checked={newProduct.is_digital} onCheckedChange={(v) => setNewProduct({ ...newProduct, is_digital: v })} /><Label>Produit digital</Label></div>
                      <div className="flex items-center gap-2"><Switch checked={newProduct.is_published} onCheckedChange={(v) => setNewProduct({ ...newProduct, is_published: v })} /><Label>Publié</Label></div>
                    </div>
                    <Button onClick={saveProduct} disabled={!newProduct.name || newProduct.price <= 0} className="w-full">{editingProduct ? "Modifier" : "Ajouter le produit"}</Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>

            {products.length === 0 ? (
              <Card className="p-8 text-center">
                <Package className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
                <p className="text-muted-foreground">Aucun produit. Ajoutez votre premier produit !</p>
              </Card>
            ) : (
              <div className="space-y-3">
                {products.map((product) => (
                  <Card key={product.id} className="p-4">
                    <div className="flex items-center gap-4">
                      <div className="h-16 w-16 bg-muted rounded-lg flex items-center justify-center overflow-hidden flex-shrink-0">
                        {product.product_images && product.product_images.length > 0 ? (
                          <img src={product.product_images[0].image_url} alt={product.name} className="h-full w-full object-cover" />
                        ) : (
                          <ImageIcon className="h-6 w-6 text-muted-foreground" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="font-medium truncate">{product.name}</h3>
                          {!product.is_published && <Badge variant="secondary">Brouillon</Badge>}
                          {product.is_digital && <Badge variant="outline">Digital</Badge>}
                        </div>
                        <p className="text-sm text-muted-foreground">{product.category} · Stock: {product.stock_quantity}</p>
                        <p className="text-sm font-semibold">{new Intl.NumberFormat("fr-FR").format(product.price)} FCFA</p>
                      </div>
                      <div className="flex gap-1">
                        <label className="cursor-pointer">
                          <input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && uploadProductImage(product.id, e.target.files[0])} />
                          <Button variant="ghost" size="icon" asChild disabled={uploadingImage}><span><Upload className="h-4 w-4" /></span></Button>
                        </label>
                        <Button variant="ghost" size="icon" onClick={() => { setEditingProduct(product); setNewProduct({ name: product.name, description: product.description || "", short_description: product.short_description || "", price: product.price, compare_at_price: product.compare_at_price || 0, category: product.category, stock_quantity: product.stock_quantity, is_digital: product.is_digital, is_published: product.is_published }); setProductDialogOpen(true); }}>
                          <Settings className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => deleteProduct(product.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="orders">
            <h2 className="text-lg font-semibold mb-4">Commandes</h2>
            {orders.length === 0 ? (
              <Card className="p-8 text-center">
                <ShoppingCart className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
                <p className="text-muted-foreground">Aucune commande pour le moment</p>
              </Card>
            ) : (
              <div className="space-y-3">
                {orders.map((order) => (
                  <Card key={order.id} className={`p-4 ${!order.is_read ? 'border-primary bg-primary/5' : ''}`} onClick={() => !order.is_read && markOrderRead(order.id)}>
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-sm font-semibold">{order.order_number}</span>
                          {!order.is_read && <Badge className="bg-red-500">Nouveau</Badge>}
                        </div>
                        <p className="text-sm">{order.customer_name} · {order.customer_phone}</p>
                        {order.customer_address && <p className="text-xs text-muted-foreground">{order.customer_address}, {order.customer_city}</p>}
                      </div>
                      <div className="text-right">
                        <p className="font-semibold">{new Intl.NumberFormat("fr-FR").format(order.total)} FCFA</p>
                        <p className="text-xs text-muted-foreground">{new Date(order.created_at).toLocaleDateString("fr-FR")}</p>
                      </div>
                    </div>
                    {order.order_items && (
                      <div className="mb-3 text-sm">
                        {order.order_items.map((item) => (
                          <p key={item.id} className="text-muted-foreground">{item.quantity}x {item.product_name} - {new Intl.NumberFormat("fr-FR").format(item.total_price)} FCFA</p>
                        ))}
                      </div>
                    )}
                    <div className="flex items-center gap-2">
                      <Select value={order.order_status} onValueChange={(v) => updateOrderStatus(order.id, v)}>
                        <SelectTrigger className="w-40 h-8"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="new">Nouveau</SelectItem>
                          <SelectItem value="confirmed">Confirmé</SelectItem>
                          <SelectItem value="processing">En traitement</SelectItem>
                          <SelectItem value="shipped">Expédié</SelectItem>
                          <SelectItem value="delivered">Livré</SelectItem>
                          <SelectItem value="cancelled">Annulé</SelectItem>
                        </SelectContent>
                      </Select>
                      <Badge variant={order.payment_method === "mobile_money" ? "default" : "outline"}>
                        {order.payment_method === "mobile_money" ? "Mobile Money" : "À la livraison"}
                      </Badge>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="settings">
            <div className="space-y-6">
              <Card className="p-6 space-y-4">
                <h3 className="font-semibold">Informations générales</h3>
                <div><Label>Nom de la boutique</Label><Input value={shop.business_name} onChange={(e) => setShop({ ...shop, business_name: e.target.value })} /></div>
                <div><Label>Description</Label><Textarea value={shop.business_description || ""} onChange={(e) => setShop({ ...shop, business_description: e.target.value })} rows={3} /></div>
                <div className="grid grid-cols-2 gap-4">
                  <div><Label>WhatsApp</Label><Input value={shop.whatsapp_number || ""} onChange={(e) => setShop({ ...shop, whatsapp_number: e.target.value })} /></div>
                  <div><Label>Téléphone</Label><Input value={shop.phone_number || ""} onChange={(e) => setShop({ ...shop, phone_number: e.target.value })} /></div>
                </div>
                <div><Label>Email</Label><Input value={shop.email || ""} onChange={(e) => setShop({ ...shop, email: e.target.value })} /></div>
              </Card>

              <Card className="p-6 space-y-4">
                <h3 className="font-semibold">Chatbot IA</h3>
                <div className="flex items-center gap-2">
                  <Switch checked={shop.chatbot_enabled} onCheckedChange={(v) => setShop({ ...shop, chatbot_enabled: v })} />
                  <Label>Activer le chatbot sur la boutique</Label>
                </div>
                <div><Label>Message d'accueil</Label><Input value={shop.chatbot_welcome_message || ""} onChange={(e) => setShop({ ...shop, chatbot_welcome_message: e.target.value })} /></div>
              </Card>

              <Card className="p-6 space-y-4">
                <h3 className="font-semibold">Apparence</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div><Label>Couleur principale</Label><Input type="color" value={shop.primary_color || "#2563eb"} onChange={(e) => setShop({ ...shop, primary_color: e.target.value })} /></div>
                  <div><Label>Couleur secondaire</Label><Input type="color" value={shop.secondary_color || "#7c3aed"} onChange={(e) => setShop({ ...shop, secondary_color: e.target.value })} /></div>
                </div>
              </Card>

              <Card className="p-6 space-y-4">
                <h3 className="font-semibold">Publication</h3>
                <div className="flex items-center gap-2">
                  <Switch checked={shop.is_published} onCheckedChange={(v) => setShop({ ...shop, is_published: v })} />
                  <Label>Boutique publiée et visible</Label>
                </div>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default ShopEditor;
