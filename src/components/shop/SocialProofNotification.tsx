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
    const { data: ordersData, error } = await (supabase as any).rpc("get_shop_social_proof_orders", {
      _shop_id: shopId,
      _limit: 5,
    });

    if (error || !ordersData?.length) {
      // No public orders yet: use demo data so the activation is immediately visible.
      setOrders(DEMO_ORDERS);
      return;
    }

    setOrders(ordersData.map((order: RecentOrder) => ({
      customer_name: order.customer_name || "Un client",
      product_name: order.product_name || "un article",
      created_at: order.created_at,
    })));
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

      // Show next after a pause, then loop continuously.
      setTimeout(() => {
        setCurrentIndex((currentIndex + 1) % orders.length);
        setShowCount(prev => prev + 1);
        setVisible(true);
      }, 6000);
    }, 5000);

    return () => clearTimeout(hideTimer);
  }, [visible, currentIndex, orders.length, dismissed]);

  if (!enabled || orders.length === 0 || dismissed || !visible) return null;

  const order = orders[currentIndex];
  const timeAgo = getTimeAgo(order.created_at);

  return (
    <div className="fixed bottom-24 left-4 right-4 sm:right-auto sm:bottom-4 z-50 animate-in slide-in-from-bottom-4 fade-in duration-500">
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
