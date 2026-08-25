import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { 
  Heart, Phone, Mail, MapPin, MessageCircle, Loader2, 
  Crown, Award, Sparkles, Search, Download, Send, Zap, 
  TrendingUp, Users, RefreshCw, MessageSquare
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { formatDistanceToNow, format } from "date-fns";
import { fr } from "date-fns/locale";

export interface CustomerLoyaltyProfile {
  id: string;
  customer_name: string;
  customer_phone: string;
  customer_email: string | null;
  delivery_city: string | null;
  order_count: number;
  total_spent: number;
  last_order_date: string;
  first_order_date: string;
  tier: "platine" | "or" | "argent" | "bronze";
}

interface LoyalCustomersListProps {
  shopId: string;
  shopSlug?: string;
  shopName?: string;
  primaryColor?: string;
}

export function LoyalCustomersList({ shopId, shopSlug, shopName, primaryColor = "#0E7C66" }: LoyalCustomersListProps) {
  const [customers, setCustomers] = useState<CustomerLoyaltyProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [tierFilter, setTierFilter] = useState<"all" | "repeating" | "platine" | "or" | "argent" | "bronze">("all");
  const { toast } = useToast();

  // Promo Broadcast Modal state
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerLoyaltyProfile | null>(null);
  const [showPromoModal, setShowPromoModal] = useState(false);
  const [promoCode, setPromoCode] = useState("FIDELITE20");
  const [discountValue, setDiscountValue] = useState("20%");
  const [customMessage, setCustomMessage] = useState("");

  const loadCustomers = async () => {
    setLoading(true);
    try {
      // Query all orders for this shop
      const { data: orders, error } = await supabase
        .from("orders")
        .select("id, customer_name, customer_phone, customer_email, customer_city, total, created_at, order_status, payment_status")
        .eq("shop_id", shopId)
        .order("created_at", { ascending: false });

      if (error) throw error;

      if (!orders || orders.length === 0) {
        setCustomers([]);
        setLoading(false);
        return;
      }

      // Group orders by clean phone number or email or name
      const customerMap = new Map<string, {
        name: string;
        phone: string;
        email: string | null;
        city: string | null;
        count: number;
        totalSpent: number;
        lastDate: string;
        firstDate: string;
      }>();

      orders.forEach((o: any) => {
        const rawPhone = (o.customer_phone || "").trim();
        const cleanPhone = rawPhone.replace(/[^\d+]/g, "");
        const key = cleanPhone || (o.customer_email || "").trim().toLowerCase() || (o.customer_name || "").trim().toLowerCase() || "anonyme";

        if (!key || key === "anonyme") return;

        const amount = Number(o.total) || 0;
        const date = o.created_at;

        if (customerMap.has(key)) {
          const existing = customerMap.get(key)!;
          existing.count += 1;
          existing.totalSpent += amount;
          if (new Date(date).getTime() > new Date(existing.lastDate).getTime()) {
            existing.lastDate = date;
          }
          if (new Date(date).getTime() < new Date(existing.firstDate).getTime()) {
            existing.firstDate = date;
          }
          if (!existing.city && o.customer_city) {
            existing.city = o.customer_city;
          }
          if (!existing.email && o.customer_email) {
            existing.email = o.customer_email;
          }
        } else {
          customerMap.set(key, {
            name: o.customer_name || "Client",
            phone: rawPhone,
            email: o.customer_email || null,
            city: o.customer_city || null,
            count: 1,
            totalSpent: amount,
            lastDate: date,
            firstDate: date,
          });
        }
      });

      // Convert map to loyalty profiles array with Tiers
      const profiles: CustomerLoyaltyProfile[] = Array.from(customerMap.entries()).map(([key, c]) => {
        let tier: "platine" | "or" | "argent" | "bronze" = "bronze";
        if (c.count >= 5) tier = "platine";
        else if (c.count >= 3) tier = "or";
        else if (c.count === 2) tier = "argent";

        return {
          id: key,
          customer_name: c.name,
          customer_phone: c.phone,
          customer_email: c.email,
          delivery_city: c.city,
          order_count: c.count,
          total_spent: c.totalSpent,
          last_order_date: c.lastDate,
          first_order_date: c.firstDate,
          tier,
        };
      });

      // Sort by order count descending, then total spent
      profiles.sort((a, b) => b.order_count - a.order_count || b.total_spent - a.total_spent);

      setCustomers(profiles);
    } catch (err: any) {
      console.error("Error loading customer loyalty data:", err);
      toast({ title: "Erreur de chargement", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCustomers();

    const channel = supabase
      .channel(`orders-loyalty-${shopId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "orders", filter: `shop_id=eq.${shopId}` }, () => loadCustomers())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [shopId]);

  // Compute Loyalty Statistics
  const totalCustomersCount = customers.length;
  const repeatCustomersCount = customers.filter(c => c.order_count >= 2).length;
  const platineCount = customers.filter(c => c.tier === "platine").length;
  const orCount = customers.filter(c => c.tier === "or").length;
  const argentCount = customers.filter(c => c.tier === "argent").length;

  const totalRepeatRevenue = customers
    .filter(c => c.order_count >= 2)
    .reduce((sum, c) => sum + c.total_spent, 0);

  const repeatRatio = totalCustomersCount > 0 ? Math.round((repeatCustomersCount / totalCustomersCount) * 100) : 0;

  // Filtered Customers List
  const filteredCustomers = useMemo(() => {
    return customers.filter(c => {
      // Tier Filter
      if (tierFilter === "repeating" && c.order_count < 2) return false;
      if (tierFilter === "platine" && c.tier !== "platine") return false;
      if (tierFilter === "or" && c.tier !== "or") return false;
      if (tierFilter === "argent" && c.tier !== "argent") return false;
      if (tierFilter === "bronze" && c.tier !== "bronze") return false;

      // Search Query
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      return (
        c.customer_name.toLowerCase().includes(q) ||
        c.customer_phone.toLowerCase().includes(q) ||
        (c.customer_email || "").toLowerCase().includes(q) ||
        (c.delivery_city || "").toLowerCase().includes(q)
      );
    });
  }, [customers, search, tierFilter]);

  // Prepare default WhatsApp Promo Message
  const getWhatsAppPromoMessage = (c: CustomerLoyaltyProfile) => {
    const storeLink = shopSlug ? `https://${shopSlug}.ecomfy.cloud` : "notre boutique";
    const brand = shopName || "Notre Boutique";
    return `Bonjour ${c.customer_name || "cher client"} 👋 !\n\nToute l'équipe de ${brand} vous remercie chaleureusement pour votre fidélité (${c.order_count} commande${c.order_count > 1 ? "s" : ""} effectuée${c.order_count > 1 ? "s" : ""}) !\n\n🎁 Pour vous récompenser, profitez d'une réduction exclusive de ${discountValue} sur votre prochaine commande avec le code promotionnel : *${promoCode}* !\n\nCommandez vite directement ici : ${storeLink}\n\nÀ très vite !`;
  };

  const handleOpenPromoModal = (customer: CustomerLoyaltyProfile) => {
    setSelectedCustomer(customer);
    setCustomMessage(getWhatsAppPromoMessage(customer));
    setShowPromoModal(true);
  };

  const handleSendWhatsApp = (c: CustomerLoyaltyProfile, customText?: string) => {
    if (!c.customer_phone) {
      toast({ title: "Numéro manquant", description: "Ce client n'a pas de numéro renseigné", variant: "destructive" });
      return;
    }
    const cleanPhone = c.customer_phone.replace(/[^\d]/g, "");
    const msgText = customText || getWhatsAppPromoMessage(c);
    const encoded = encodeURIComponent(msgText);
    window.open(`https://wa.me/${cleanPhone}?text=${encoded}`, "_blank");
  };

  const handleSendSMS = (c: CustomerLoyaltyProfile, customText?: string) => {
    if (!c.customer_phone) return;
    const cleanPhone = c.customer_phone.replace(/[^\d+]/g, "");
    const msgText = customText || getWhatsAppPromoMessage(c);
    const encoded = encodeURIComponent(msgText);
    window.open(`sms:${cleanPhone}?body=${encoded}`, "_blank");
  };

  const handleExportCSV = () => {
    if (filteredCustomers.length === 0) return;
    const headers = ["Nom", "Telephone", "Email", "Ville", "Commandes", "Total Dépensé (FCFA)", "Niveau Fidélité", "Dernière Commande"];
    const rows = filteredCustomers.map(c => [
      `"${c.customer_name.replace(/"/g, '""')}"`,
      `"${c.customer_phone}"`,
      `"${c.customer_email || ""}"`,
      `"${c.delivery_city || ""}"`,
      c.order_count,
      c.total_spent,
      c.tier.toUpperCase(),
      `"${new Date(c.last_order_date).toLocaleDateString("fr-FR")}"`
    ]);

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `clients_fideles_${shopSlug || "ecomfy"}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast({ title: "Export réussi", description: `${filteredCustomers.length} clients exportés en CSV.` });
  };

  const getTierBadge = (tier: CustomerLoyaltyProfile["tier"], count: number) => {
    switch (tier) {
      case "platine":
        return (
          <Badge className="bg-purple-600 text-white border-0 font-bold text-[11px] gap-1 shadow-sm">
            <Sparkles className="h-3 w-3" /> Platine VIP ({count} cmd)
          </Badge>
        );
      case "or":
        return (
          <Badge className="bg-amber-500 text-white border-0 font-bold text-[11px] gap-1 shadow-sm">
            <Crown className="h-3 w-3" /> Client Or ({count} cmd)
          </Badge>
        );
      case "argent":
        return (
          <Badge className="bg-slate-700 text-white border-0 font-bold text-[11px] gap-1 shadow-sm">
            <Award className="h-3 w-3" /> Client Argent ({count} cmd)
          </Badge>
        );
      default:
        return (
          <Badge variant="outline" className="border-slate-300 text-slate-600 text-[10px]">
            1ère Commande
          </Badge>
        );
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-slate-500 font-inter">
        <Loader2 className="h-6 w-6 animate-spin text-[#0E7C66] mr-2" />
        <span>Identification des clients fidèles en cours...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6 font-inter">

      {/* Header Title Section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-2xl font-space font-bold text-slate-900 flex items-center gap-2">
              <Heart className="h-6 w-6 text-rose-500 fill-rose-500" />
              <span>Identification des Clients Fidèles</span>
            </h2>
            <Badge className="bg-emerald-500 text-white text-xs font-bold rounded-full">Automatique</Badge>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Détectez vos acheteurs récurrents et relancez-les en 1 clic par WhatsApp & SMS lors de vos promotions.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={loadCustomers}
            className="rounded-full text-xs font-bold gap-1.5"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            <span>Actualiser</span>
          </Button>

          <Button
            size="sm"
            onClick={handleExportCSV}
            disabled={filteredCustomers.length === 0}
            className="rounded-full bg-[#0E7C66] hover:bg-[#0A6352] text-white text-xs font-bold gap-1.5 shadow-md"
          >
            <Download className="h-3.5 w-3.5" />
            <span>Exporter CSV ({filteredCustomers.length})</span>
          </Button>
        </div>
      </div>

      {/* Loyalty KPIs Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="rounded-2xl border-slate-200 shadow-sm bg-white">
          <CardHeader className="pb-2">
            <CardDescription className="text-xs font-bold uppercase tracking-wider text-slate-400">Total Clients Distincts</CardDescription>
            <CardTitle className="text-2xl font-space font-extrabold text-slate-900 flex items-center justify-between">
              <span>{totalCustomersCount}</span>
              <Users className="h-5 w-5 text-slate-400" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-slate-500">Acheteurs enregistrés en base</p>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-emerald-200 shadow-sm bg-emerald-50/50">
          <CardHeader className="pb-2">
            <CardDescription className="text-xs font-bold uppercase tracking-wider text-emerald-700">Clients Fidèles (2+ Cmds)</CardDescription>
            <CardTitle className="text-2xl font-space font-extrabold text-emerald-800 flex items-center justify-between">
              <span>{repeatCustomersCount}</span>
              <Badge className="bg-emerald-600 text-white text-xs font-bold">{repeatRatio}% Taux de Fidélité</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-emerald-700 font-semibold">{totalRepeatRevenue.toLocaleString()} FCFA générés</p>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-amber-200 shadow-sm bg-amber-50/50">
          <CardHeader className="pb-2">
            <CardDescription className="text-xs font-bold uppercase tracking-wider text-amber-700">Membres VIP (Or & Platine)</CardDescription>
            <CardTitle className="text-2xl font-space font-extrabold text-amber-800 flex items-center justify-between">
              <span>{platineCount + orCount}</span>
              <Crown className="h-5 w-5 text-amber-500" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-amber-700 font-semibold">{platineCount} VIP Platine (5+ commandes)</p>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-slate-200 shadow-sm bg-white">
          <CardHeader className="pb-2">
            <CardDescription className="text-xs font-bold uppercase tracking-wider text-slate-400">Clients Argent (2 Cmds)</CardDescription>
            <CardTitle className="text-2xl font-space font-extrabold text-slate-900 flex items-center justify-between">
              <span>{argentCount}</span>
              <Award className="h-5 w-5 text-slate-400" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-slate-500">Prêts à passer au niveau Or</p>
          </CardContent>
        </Card>
      </div>

      {/* Controls & Filter Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <Input
            placeholder="Chercher par nom, téléphone, ville..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 text-xs rounded-xl bg-slate-50 border-slate-200"
          />
        </div>

        <div className="flex items-center gap-1.5 flex-wrap w-full sm:w-auto">
          <Button
            size="sm"
            variant={tierFilter === "all" ? "default" : "outline"}
            onClick={() => setTierFilter("all")}
            className={`rounded-full text-xs font-bold ${tierFilter === "all" ? "bg-slate-900 text-white" : ""}`}
          >
            Tous ({customers.length})
          </Button>

          <Button
            size="sm"
            variant={tierFilter === "repeating" ? "default" : "outline"}
            onClick={() => setTierFilter("repeating")}
            className={`rounded-full text-xs font-bold ${tierFilter === "repeating" ? "bg-[#0E7C66] text-white" : ""}`}
          >
            ⭐ Clients Fidèles 2+ ({repeatCustomersCount})
          </Button>

          <Button
            size="sm"
            variant={tierFilter === "platine" ? "default" : "outline"}
            onClick={() => setTierFilter("platine")}
            className={`rounded-full text-xs font-bold ${tierFilter === "platine" ? "bg-purple-600 text-white" : ""}`}
          >
            💎 Platine (5+)
          </Button>

          <Button
            size="sm"
            variant={tierFilter === "or" ? "default" : "outline"}
            onClick={() => setTierFilter("or")}
            className={`rounded-full text-xs font-bold ${tierFilter === "or" ? "bg-amber-500 text-white" : ""}`}
          >
            🥇 Or (3-4)
          </Button>
        </div>
      </div>

      {/* Loyal Customers Cards List */}
      <div className="space-y-3">
        {filteredCustomers.length === 0 ? (
          <Card className="rounded-2xl border-slate-200 p-12 text-center text-slate-500">
            <Heart className="h-10 w-10 mx-auto text-slate-300 mb-2" />
            <p className="font-bold text-sm text-slate-700">Aucun client correspondant trouvé</p>
            <p className="text-xs text-slate-400 mt-1">Dès que vos clients passeront commande, ils apparaîtront ici automatiquement.</p>
          </Card>
        ) : (
          filteredCustomers.map((c) => (
            <Card key={c.id} className="rounded-2xl border-slate-200 hover:border-slate-300 transition-all p-4 bg-white shadow-sm hover:shadow">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                
                {/* Customer Info */}
                <div className="flex items-start gap-3 min-w-0">
                  <div className={`h-12 w-12 rounded-2xl flex items-center justify-center font-bold text-lg shrink-0 ${
                    c.tier === "platine" ? "bg-purple-100 text-purple-700 border border-purple-200" :
                    c.tier === "or" ? "bg-amber-100 text-amber-700 border border-amber-200" :
                    c.tier === "argent" ? "bg-slate-100 text-slate-700 border border-slate-200" : "bg-emerald-50 text-[#0E7C66]"
                  }`}>
                    {c.customer_name[0]?.toUpperCase() || "C"}
                  </div>

                  <div className="min-w-0 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-bold text-sm text-slate-900 truncate">{c.customer_name}</h3>
                      {getTierBadge(c.tier, c.order_count)}
                    </div>

                    <div className="flex items-center gap-3 text-xs text-slate-500 flex-wrap">
                      <span className="flex items-center gap-1 font-mono text-slate-700 font-semibold">
                        <Phone className="h-3 w-3 text-slate-400" />
                        {c.customer_phone}
                      </span>

                      {c.delivery_city && (
                        <span className="flex items-center gap-1">
                          <MapPin className="h-3 w-3 text-slate-400" />
                          {c.delivery_city}
                        </span>
                      )}

                      {c.customer_email && (
                        <span className="flex items-center gap-1">
                          <Mail className="h-3 w-3 text-slate-400" />
                          {c.customer_email}
                        </span>
                      )}
                    </div>

                    <p className="text-[11px] text-slate-400">
                      Dernière commande le {new Date(c.last_order_date).toLocaleDateString("fr-FR")}
                    </p>
                  </div>
                </div>

                {/* Spent & Actions */}
                <div className="flex items-center justify-between sm:justify-end gap-4 shrink-0">
                  <div className="text-left sm:text-right">
                    <p className="text-xs text-slate-500">Chiffre d'Affaires</p>
                    <p className="text-base font-space font-extrabold text-[#0E7C66]">
                      {c.total_spent.toLocaleString()} FCFA
                    </p>
                    <p className="text-[10px] text-slate-400">{c.order_count} commande{c.order_count > 1 ? "s" : ""}</p>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      onClick={() => handleOpenPromoModal(c)}
                      className="rounded-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs gap-1.5 px-4 shadow-sm"
                    >
                      <MessageCircle className="h-3.5 w-3.5" />
                      <span>Relancer Promo WhatsApp</span>
                    </Button>

                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleSendSMS(c)}
                      className="rounded-full border-slate-200 text-slate-700 text-xs font-bold gap-1"
                    >
                      <MessageSquare className="h-3.5 w-3.5" />
                      <span className="hidden sm:inline">SMS</span>
                    </Button>
                  </div>
                </div>

              </div>
            </Card>
          ))
        )}
      </div>

      {/* WhatsApp Promo Broadcast Customizer Modal */}
      <Dialog open={showPromoModal} onOpenChange={setShowPromoModal}>
        <DialogContent className="max-w-lg font-inter">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 font-space text-lg font-bold">
              <MessageCircle className="h-5 w-5 text-emerald-600" />
              <span>Relance Promotionnelle WhatsApp pour Client Fidèle</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Personnalisez l'offre avant d'ouvrir la discussion WhatsApp avec {selectedCustomer?.customer_name}.
            </DialogDescription>
          </DialogHeader>

          {selectedCustomer && (
            <div className="space-y-4 py-2">
              <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-between">
                <div>
                  <p className="font-bold text-xs text-emerald-900">{selectedCustomer.customer_name}</p>
                  <p className="text-[11px] font-mono text-emerald-700">{selectedCustomer.customer_phone}</p>
                </div>
                {getTierBadge(selectedCustomer.tier, selectedCustomer.order_count)}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs font-bold">Code Promo Offert</Label>
                  <Input
                    value={promoCode}
                    onChange={(e) => {
                      setPromoCode(e.target.value);
                      if (selectedCustomer) setCustomMessage(getWhatsAppPromoMessage(selectedCustomer));
                    }}
                    className="text-xs font-mono uppercase font-bold"
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-bold">Valeur Réduction</Label>
                  <Input
                    value={discountValue}
                    onChange={(e) => {
                      setDiscountValue(e.target.value);
                      if (selectedCustomer) setCustomMessage(getWhatsAppPromoMessage(selectedCustomer));
                    }}
                    className="text-xs font-bold"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-bold">Message WhatsApp Préréglé</Label>
                <Textarea
                  value={customMessage}
                  onChange={(e) => setCustomMessage(e.target.value)}
                  className="text-xs font-inter leading-relaxed h-40"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => setShowPromoModal(false)} className="rounded-full text-xs font-bold">
                  Annuler
                </Button>
                <Button
                  onClick={() => {
                    handleSendWhatsApp(selectedCustomer, customMessage);
                    setShowPromoModal(false);
                  }}
                  className="rounded-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs gap-2 px-5 shadow-lg"
                >
                  <Send className="h-4 w-4" />
                  <span>Ouvrir dans WhatsApp</span>
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

    </div>
  );
}
