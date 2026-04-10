import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TrendingUp, ShoppingCart, Package, Bell } from "lucide-react";

interface Order {
  id: string;
  order_number: string;
  customer_name: string;
  total: number;
  order_status: string;
  is_read: boolean;
  created_at: string;
}

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  new: { label: "Nouveau", color: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300" },
  confirmed: { label: "Confirmé", color: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300" },
  processing: { label: "En traitement", color: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300" },
  shipped: { label: "Expédié", color: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300" },
  delivered: { label: "Livré", color: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300" },
  cancelled: { label: "Annulé", color: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300" },
};

interface ShopOverviewProps {
  orders: Order[];
  productCount: number;
  totalRevenue: number;
  newOrders: number;
  onViewAllOrders: () => void;
}

export function ShopOverview({ orders, productCount, totalRevenue, newOrders, onViewAllOrders }: ShopOverviewProps) {
  const fmt = (n: number) => new Intl.NumberFormat("fr-FR").format(n);

  const stats = [
    { icon: TrendingUp, label: "FCFA de ventes", value: fmt(totalRevenue), bg: "bg-primary/10", iconColor: "text-primary" },
    { icon: ShoppingCart, label: "Commandes", value: orders.length, bg: "bg-blue-500/10", iconColor: "text-blue-600" },
    { icon: Package, label: "Produits", value: productCount, bg: "bg-green-500/10", iconColor: "text-green-600" },
    { icon: Bell, label: "Nouvelles", value: newOrders, bg: "bg-orange-500/10", iconColor: "text-orange-600" },
  ];

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold">Tableau de bord</h2>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {stats.map((stat, i) => (
          <Card key={i} className="p-5">
            <div className="flex items-center gap-3">
              <div className={`h-10 w-10 rounded-xl ${stat.bg} flex items-center justify-center`}>
                <stat.icon className={`h-5 w-5 ${stat.iconColor}`} />
              </div>
              <div>
                <p className="text-2xl font-bold">{stat.value}</p>
                <p className="text-xs text-muted-foreground">{stat.label}</p>
              </div>
            </div>
          </Card>
        ))}
      </div>
      <Card className="p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold">Commandes récentes</h3>
          <Button variant="ghost" size="sm" onClick={onViewAllOrders}>Tout voir</Button>
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
                  <p className="text-sm font-bold">{fmt(order.total)} FCFA</p>
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
  );
}
