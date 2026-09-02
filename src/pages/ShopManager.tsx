import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Plus, Store, Settings, Package, TrendingUp, ShoppingBag, ArrowUpRight, ExternalLink, Zap, Trash2, Loader2, Copy, Users, LogIn, ArrowLeft, Search } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { useAuthReady } from "@/hooks/useAuthReady";

interface Shop {
  id: string;
  business_name: string;
  business_description: string | null;
  slug: string;
  logo_url: string | null;
  banner_url: string | null;
  is_activated: boolean;
  is_published: boolean;
  total_orders: number;
  total_sales: number;
  currency: string;
  primary_color: string | null;
  created_at: string;
}

interface CollabShop {
  id: string;
  business_name: string;
  slug: string;
  logo_url: string | null;
  banner_url: string | null;
  primary_color: string | null;
  roles: string[];
}

const ShopManager = () => {
  const navigate = useNavigate();
  const [shops, setShops] = useState<Shop[]>([]);
  const [collabShops, setCollabShops] = useState<CollabShop[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState<Shop | null>(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);
  const { user, isReady } = useAuthReady();

  const fetchShops = useCallback(async (userId?: string) => {
    if (!userId) {
      setLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from("shops")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (error) {
      toast({ title: "Erreur", description: "Impossible de charger vos boutiques", variant: "destructive" });
    } else {
      setShops((data as any[]) || []);
    }

    // Fetch shops where the user is an active collaborator (invited)
    const { data: collabs } = await (supabase as any)
      .from("shop_collaborators")
      .select("roles, shop:shops(id, business_name, slug, logo_url, banner_url, primary_color)")
      .eq("user_id", userId)
      .eq("status", "active");
    if (collabs) {
      const list: CollabShop[] = (collabs as any[])
        .filter((c) => c.shop)
        .map((c) => ({ ...c.shop, roles: c.roles || [] }));
      setCollabShops(list);
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    if (isReady) fetchShops(user?.id);
  }, [fetchShops, isReady, user?.id]);

  const handleDeleteShop = async () => {
    if (!deleteTarget || deleteConfirmText !== deleteTarget.business_name) return;
    setDeleting(true);
    try {
      // Delete related data first
      const { data: products } = await supabase.from("products").select("id").eq("shop_id", deleteTarget.id);
      if (products?.length) {
        const productIds = products.map(p => p.id);
        await supabase.from("product_images").delete().in("product_id", productIds);
        await supabase.from("order_items").delete().in("product_id", productIds);
      }
      await supabase.from("products").delete().eq("shop_id", deleteTarget.id);
      await supabase.from("orders").delete().eq("shop_id", deleteTarget.id);
      const { error } = await supabase.from("shops").delete().eq("id", deleteTarget.id);
      if (error) throw error;
      toast({ title: "Boutique supprimée", description: `"${deleteTarget.business_name}" a été supprimée définitivement.` });
      setShops(prev => prev.filter(s => s.id !== deleteTarget.id));
    } catch (e: any) {
      toast({ title: "Erreur", description: e.message || "Impossible de supprimer la boutique", variant: "destructive" });
    } finally {
      setDeleting(false);
      setDeleteTarget(null);
      setDeleteConfirmText("");
    }
  };

  const formatPrice = (amount: number, currency: string) => {
    return new Intl.NumberFormat("fr-FR").format(amount) + " " + currency;
  };

  const totalRevenue = shops.reduce((sum, s) => sum + (s?.total_sales || 0), 0);
  const totalOrders = shops.reduce((sum, s) => sum + (s?.total_orders || 0), 0);
  const activeShops = shops.filter(s => s?.is_activated).length;

  return (
    <div className="min-h-screen bg-[#F5F5F0]">
      <div className="max-w-[1180px] mx-auto px-4 md:px-8 pt-8 md:pt-12 pb-16 text-[#0F1B2C]">
        
        {/* HEADER */}
        <button 
          onClick={() => navigate("/dashboard")} 
          className="flex items-center gap-2 text-[13.5px] text-[#5B6472] hover:text-[#0F1B2C] mb-8 transition-colors font-medium bg-transparent border-none cursor-pointer p-0"
        >
          <ArrowLeft className="h-4 w-4" /> Retour à l'accueil
        </button>

        <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 mb-8">
          <div>
            <div className="font-mono text-[11.5px] font-medium tracking-[0.09em] text-[#0E7C66] uppercase mb-2.5">
              Espace boutiques
            </div>
            <h1 className="font-space text-3xl md:text-[32px] font-semibold tracking-[-0.015em] mb-2 text-[#0F1B2C]">
              Mes boutiques
            </h1>
            <p className="text-[14.5px] text-[#5B6472] m-0">
              Gérez et développez votre activité e-commerce.
            </p>
          </div>
          <button 
            onClick={() => navigate("/shop-builder")}
            className="bg-[#0F1B2C] text-white border-none px-5 py-3 rounded-[10px] text-[13.5px] font-semibold font-inter flex items-center gap-2 cursor-pointer shrink-0 hover:bg-black transition-colors shadow-sm"
          >
            <Plus className="h-4 w-4" />
            Créer une boutique
          </button>
        </div>

        {/* STATS */}
        {shops.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-[14px] mb-[34px]">
            <div className="bg-white border border-[#E7E5DE] rounded-[14px] p-[18px_20px] flex items-center gap-[14px] shadow-sm">
              <div className="w-[38px] h-[38px] rounded-[10px] bg-[#E3F1EC] text-[#0E7C66] flex items-center justify-center shrink-0">
                <Store className="h-[18px] w-[18px]" />
              </div>
              <div>
                <div className="font-space text-[22px] font-semibold leading-[1.1] text-[#0F1B2C]">{shops.length}</div>
                <div className="text-[12.5px] text-[#5B6472] mt-0.5">Boutiques</div>
              </div>
            </div>
            <div className="bg-white border border-[#E7E5DE] rounded-[14px] p-[18px_20px] flex items-center gap-[14px] shadow-sm">
              <div className="w-[38px] h-[38px] rounded-[10px] bg-[#E3F1EC] text-[#0E7C66] flex items-center justify-center shrink-0">
                <Zap className="h-[18px] w-[18px]" />
              </div>
              <div>
                <div className="font-space text-[22px] font-semibold leading-[1.1] text-[#0F1B2C]">{activeShops}</div>
                <div className="text-[12.5px] text-[#5B6472] mt-0.5">Actives</div>
              </div>
            </div>
            <div className="bg-white border border-[#E7E5DE] rounded-[14px] p-[18px_20px] flex items-center gap-[14px] shadow-sm">
              <div className="w-[38px] h-[38px] rounded-[10px] bg-[#E3F1EC] text-[#0E7C66] flex items-center justify-center shrink-0">
                <Package className="h-[18px] w-[18px]" />
              </div>
              <div>
                <div className="font-space text-[22px] font-semibold leading-[1.1] text-[#0F1B2C]">{totalOrders}</div>
                <div className="text-[12.5px] text-[#5B6472] mt-0.5">Commandes</div>
              </div>
            </div>
            <div className="bg-white border border-[#E7E5DE] rounded-[14px] p-[18px_20px] flex items-center gap-[14px] shadow-sm">
              <div className="w-[38px] h-[38px] rounded-[10px] bg-[#F7ECDC] text-[#B9761F] flex items-center justify-center shrink-0">
                <TrendingUp className="h-[18px] w-[18px]" />
              </div>
              <div>
                <div className="font-space text-[22px] font-semibold leading-[1.1] text-[#0F1B2C] whitespace-nowrap">{formatPrice(totalRevenue, "FCFA")}</div>
                <div className="text-[12.5px] text-[#5B6472] mt-0.5">Revenus</div>
              </div>
            </div>
          </div>
        )}

        {/* Collab Shops */}
        {collabShops.length > 0 && (
          <div className="mb-[34px]">
            <div className="flex items-center gap-2 mb-4">
              <Users className="h-5 w-5 text-[#0E7C66]" />
              <h2 className="text-xl font-bold font-space">Boutiques où vous collaborez</h2>
              <Badge variant="secondary" className="ml-1 bg-white border-[#E7E5DE]">{collabShops.length}</Badge>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {collabShops.map((cs) => {
                if (!cs) return null;
                const initial = cs.business_name.charAt(0).toUpperCase();
                return (
                  <div key={cs.id || Math.random().toString()} className="bg-white border border-[#E7E5DE] rounded-[14px] overflow-hidden flex flex-col hover:border-[#0E7C66]/30 transition-colors shadow-sm">
                    <div className="h-[90px] bg-[#F4F3EF] flex items-center justify-between p-[14px_16px] relative">
                      <div className="w-[44px] h-[44px] rounded-[10px] bg-[#0F1B2C] text-white flex items-center justify-center font-space font-semibold text-[17px]">
                        {cs.logo_url ? <img src={cs.logo_url} alt="" className="w-full h-full rounded-[10px] object-cover" /> : initial}
                      </div>
                      <span className="text-[11.5px] font-semibold px-[11px] py-[5px] rounded-full inline-flex items-center gap-[5px] bg-[#F4F3EF] text-[#5B6472] border border-[#E7E5DE]">
                        Collaborateur
                      </span>
                    </div>
                    <div className="p-[18px_18px_16px]">
                      <h3 className="font-space text-[17px] font-semibold m-0 mb-1 text-[#0F1B2C]">{cs.business_name}</h3>
                      <p className="text-xs text-[#5B6472] mb-4">{cs.roles.length} rôle{cs.roles.length > 1 ? "s" : ""}</p>
                      <button 
                        onClick={() => navigate(`/shop-editor/${cs.id}`)}
                        className="w-full bg-[#0F1B2C] text-white border-none rounded-[9px] py-[11px] text-[13px] font-semibold flex items-center justify-center gap-[7px] cursor-pointer hover:bg-black transition-colors"
                      >
                        <LogIn className="h-4 w-4" />
                        Se connecter
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Loading State */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-white border border-[#E7E5DE] rounded-[14px] overflow-hidden animate-pulse">
                <div className="h-[110px] bg-[#F4F3EF]" />
                <div className="p-[18px_18px_16px]">
                  <div className="h-5 bg-muted rounded w-3/4 mb-3" />
                  <div className="h-3 bg-muted rounded w-1/2" />
                </div>
              </div>
            ))}
          </div>
        ) : shops.length === 0 ? (
          <div className="max-w-lg mx-auto text-center py-20">
            <div className="h-[72px] w-[72px] mx-auto rounded-[20px] bg-[#E3F1EC] flex items-center justify-center mb-6">
              <ShoppingBag className="h-8 w-8 text-[#0E7C66]" />
            </div>
            <h2 className="font-space text-2xl font-semibold mb-3">Lancez votre première boutique</h2>
            <p className="text-[#5B6472] mb-8 leading-relaxed">
              Créez votre boutique en ligne en quelques minutes grâce à l'IA. 
              Vendez vos produits physiques et digitaux sans compétences techniques.
            </p>
            <button 
              onClick={() => navigate("/shop-builder")}
              className="bg-[#0F1B2C] text-white border-none px-6 py-3 rounded-[10px] text-[13.5px] font-semibold font-inter inline-flex items-center justify-center gap-2 cursor-pointer hover:bg-black transition-colors shadow-sm mx-auto"
            >
              <Plus className="h-4 w-4" />
              Créer ma première boutique
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {shops.map((shop) => {
              if (!shop) return null;
              const initial = shop.business_name.charAt(0).toUpperCase();
              
              return (
                <div key={shop.id} className="bg-white border border-[#E7E5DE] rounded-[14px] overflow-hidden flex flex-col hover:border-[#0E7C66]/30 transition-colors shadow-sm group">
                  <div className="h-[110px] bg-[#F4F3EF] flex items-center justify-between p-[14px_16px] relative">
                    <div className="w-[44px] h-[44px] rounded-[10px] bg-[#0F1B2C] text-white flex items-center justify-center font-space font-semibold text-[17px] shrink-0">
                      {shop.logo_url ? (
                        <img src={shop.logo_url} alt="" className="w-full h-full rounded-[10px] object-cover" />
                      ) : (
                        initial
                      )}
                    </div>
                    {shop.is_activated ? (
                      shop.is_published ? (
                        <span className="text-[11.5px] font-semibold px-[11px] py-[5px] rounded-full inline-flex items-center gap-[5px] bg-[#E3F1EC] text-[#0E7C66]">
                          <span className="w-[6px] h-[6px] rounded-full bg-[#0E7C66]"></span>
                          En ligne
                        </span>
                      ) : (
                        <span className="text-[11.5px] font-semibold px-[11px] py-[5px] rounded-full inline-flex items-center gap-[5px] bg-[#F4F3EF] text-[#5B6472] border border-[#E7E5DE]">
                          <span className="w-[6px] h-[6px] rounded-full bg-[#8A93A0]"></span>
                          Hors ligne
                        </span>
                      )
                    ) : (
                      <span className="text-[11.5px] font-semibold px-[11px] py-[5px] rounded-full inline-flex items-center gap-[5px] bg-[#F4F3EF] text-[#5B6472] border border-[#E7E5DE]">
                        <span className="w-[6px] h-[6px] rounded-full bg-[#8A93A0]"></span>
                        Non activée
                      </span>
                    )}
                  </div>

                  <div className="p-[18px_18px_16px] flex-1 flex flex-col">
                    <h3 className="font-space text-[17px] font-semibold m-0 mb-[5px] text-[#0F1B2C] group-hover:text-[#0E7C66] transition-colors">{shop.business_name}</h3>
                    
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        const url = `https://ecomfy.cloud/shop/${shop.slug}`;
                        navigator.clipboard.writeText(url);
                        toast({ title: "Lien copié ✓", description: url });
                      }}
                      className="text-[12.5px] text-[#5B6472] flex items-center gap-[6px] mb-4 bg-transparent border-none p-0 cursor-pointer hover:text-[#0E7C66] transition-colors group/link text-left"
                      title="Copier le lien public"
                    >
                      <span className="w-[6px] h-[6px] rounded-full bg-[#0E7C66] shrink-0" />
                      <span className="truncate">ecomfy.cloud/shop/{shop.slug}</span>
                      <Copy className="h-3 w-3 opacity-0 group-hover/link:opacity-100 transition-opacity shrink-0 ml-1" />
                    </button>

                    <div className="grid grid-cols-2 gap-[10px] mb-4 mt-auto">
                      <div className="bg-[#F4F3EF] rounded-[9px] p-[10px_12px]">
                        <div className="font-space text-[17px] font-semibold text-[#0F1B2C]">{shop.total_orders || 0}</div>
                        <div className="text-[10.5px] tracking-[0.04em] text-[#8A93A0] uppercase mt-[2px]">Commandes</div>
                      </div>
                      <div className="bg-[#F4F3EF] rounded-[9px] p-[10px_12px]">
                        <div className="font-space text-[17px] font-semibold text-[#0F1B2C] truncate" title={formatPrice(shop.total_sales || 0, "")}>
                          {formatPrice(shop.total_sales || 0, "")}
                        </div>
                        <div className="text-[10.5px] tracking-[0.04em] text-[#8A93A0] uppercase mt-[2px]">Revenus</div>
                      </div>
                    </div>

                    <div className="flex gap-[8px]">
                      <button 
                        onClick={() => navigate(`/shop-editor/${shop.id}`)}
                        className="flex-1 bg-[#0F1B2C] text-white border-none rounded-[9px] py-[11px] text-[13px] font-semibold flex items-center justify-center gap-[7px] cursor-pointer hover:bg-black transition-colors"
                      >
                        <Settings className="h-[14px] w-[14px]" />
                        Gérer
                      </button>
                      <button 
                        onClick={() => navigate(`/seo`)}
                        className="w-[40px] border border-[#0E7C66]/30 bg-[#0E7C66]/10 text-[#0E7C66] rounded-[9px] flex items-center justify-center cursor-pointer hover:bg-[#0E7C66] hover:text-white transition-colors shrink-0"
                        title="SEO Intelligence (Référencement Google)"
                      >
                        <Search className="h-4 w-4" />
                      </button>
                      <button 
                        onClick={() => window.open(`https://ecomfy.cloud/shop/${shop.slug}`, "_blank")}
                        className="w-[40px] border border-[#E7E5DE] bg-white rounded-[9px] flex items-center justify-center cursor-pointer text-[#5B6472] hover:text-[#0F1B2C] hover:bg-slate-50 transition-colors shrink-0"
                        title="Voir la boutique"
                      >
                        <ArrowUpRight className="h-4 w-4" />
                      </button>
                      <button 
                        onClick={() => setDeleteTarget(shop)}
                        className="w-[40px] border border-[#E7E5DE] bg-white rounded-[9px] flex items-center justify-center cursor-pointer text-[#B23B3B] hover:bg-[#B23B3B] hover:text-white hover:border-[#B23B3B] transition-colors shrink-0"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) { setDeleteTarget(null); setDeleteConfirmText(""); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-destructive">Supprimer la boutique</DialogTitle>
            <DialogDescription>
              Cette action est irréversible. Tous les produits, commandes et données associées seront supprimés définitivement.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <p className="text-sm">
              Pour confirmer, tapez <strong>{deleteTarget?.business_name}</strong> ci-dessous :
            </p>
            <Input
              value={deleteConfirmText}
              onChange={(e) => setDeleteConfirmText(e.target.value)}
              placeholder={deleteTarget?.business_name}
            />
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => { setDeleteTarget(null); setDeleteConfirmText(""); }}>
                Annuler
              </Button>
              <Button
                variant="destructive"
                disabled={deleteConfirmText !== deleteTarget?.business_name || deleting}
                onClick={handleDeleteShop}
              >
                {deleting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Trash2 className="h-4 w-4 mr-2" />}
                Supprimer définitivement
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ShopManager;
