import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ShoppingBag, X } from "lucide-react";

interface RecentOrder {
  customer_name: string;
  product_name: string;
  created_at: string;
}

interface SocialProofNotificationProps {
  shopId: string;
  enabled: boolean;
}

const DEMO_ORDERS: RecentOrder[] = [
  { customer_name: "Kouadio", product_name: "un article", created_at: new Date(Date.now() - 3 * 60000).toISOString() },
  { customer_name: "Aminata", product_name: "un produit", created_at: new Date(Date.now() - 12 * 60000).toISOString() },
  { customer_name: "Ibrahim", product_name: "un article", created_at: new Date(Date.now() - 45 * 60000).toISOString() },
];

export function SocialProofNotification({ shopId, enabled }: SocialProofNotificationProps) {
  const [orders, setOrders] = useState<RecentOrder[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [visible, setVisible] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [showCount, setShowCount] = useState(0);

  const fetchRecentOrders = useCallback(async () => {
    // Fetch recent orders with their items for product names
    const { data: ordersData } = await supabase
      .from("orders")
      .select("id, customer_name, customer_city, created_at")
      .eq("shop_id", shopId)
      .order("created_at", { ascending: false })
      .limit(10);

    if (!ordersData?.length) {
      // No real orders: use demo data so shop owner can preview
      setOrders(DEMO_ORDERS);
      return;
    }

    const orderResults: RecentOrder[] = [];
    for (const order of ordersData.slice(0, 5)) {
      // Get first product name from order items
      const { data: items } = await supabase
        .from("order_items")
        .select("product_name")
        .eq("order_id", order.id)
        .limit(1);

      const productName = items?.[0]?.product_name || "un article";
      const firstName = order.customer_name?.split(" ")[0] || "Un client";

      orderResults.push({
        customer_name: firstName,
        product_name: productName,
        created_at: order.created_at,
      });
    }
    setOrders(orderResults);
  }, [shopId]);

  useEffect(() => {
    if (!enabled) return;
    fetchRecentOrders();
  }, [shopId, enabled, fetchRecentOrders]);

  // Show first notification after delay, then cycle
  useEffect(() => {
    if (!enabled || orders.length === 0 || dismissed) return;

    const showTimer = setTimeout(() => {
      setVisible(true);
      setShowCount(1);
    }, 4000);

    return () => clearTimeout(showTimer);
  }, [orders, enabled, dismissed]);

  // Auto-hide current, then show next
  useEffect(() => {
    if (!visible || dismissed) return;

    const hideTimer = setTimeout(() => {
      setVisible(false);

      // Show next after a pause (up to orders.length cycles)
      setTimeout(() => {
        const nextIndex = currentIndex + 1;
        if (nextIndex < orders.length) {
          setCurrentIndex(nextIndex);
          setShowCount(prev => prev + 1);
          setVisible(true);
        }
      }, 6000);
    }, 5000);

    return () => clearTimeout(hideTimer);
  }, [visible, currentIndex, orders.length, dismissed]);

  if (!enabled || orders.length === 0 || dismissed || !visible) return null;

  const order = orders[currentIndex];
  const timeAgo = getTimeAgo(order.created_at);

  return (
    <div className="fixed bottom-4 left-4 z-50 animate-in slide-in-from-bottom-4 fade-in duration-500">
      <div className="bg-white dark:bg-gray-900 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 p-4 max-w-xs flex items-start gap-3">
        <div className="h-10 w-10 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center shrink-0">
          <ShoppingBag className="h-5 w-5 text-green-600" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-900 dark:text-white">
            {order.customer_name} a commandé <span className="font-semibold">{order.product_name}</span>
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            {timeAgo}
          </p>
        </div>
        <button
          onClick={() => setDismissed(true)}
          className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 shrink-0"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

function getTimeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "À l'instant";
  if (minutes < 60) return `Il y a ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `Il y a ${hours}h`;
  const days = Math.floor(hours / 24);
  return `Il y a ${days}j`;
}
