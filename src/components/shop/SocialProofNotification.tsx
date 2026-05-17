import { useEffect, useState, useCallback, type ReactNode } from "react";
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
  /** When set, all notifications display this product name (product page context). */
  productName?: string;
  /** When set, notifications display "a commandé chez {shopName}" (shop home context). */
  shopName?: string;
}

const DEMO_NAMES = ["Kouadio", "Aminata", "Ibrahim", "Fatou", "Yao", "Mariam"];
const buildDemoOrders = (): RecentOrder[] => DEMO_NAMES.slice(0, 3).map((n, i) => ({
  customer_name: n,
  product_name: "",
  created_at: new Date(Date.now() - (3 + i * 12) * 60000).toISOString(),
}));

export function SocialProofNotification({ shopId, enabled, productName, shopName }: SocialProofNotificationProps) {
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
      setOrders(buildDemoOrders());
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

  // Contextual message:
  // - product page → always show the current product name
  // - shop home → "a commandé chez {shopName}"
  // - fallback → use order.product_name
  let message: ReactNode;
  if (productName) {
    message = <>{order.customer_name} a commandé <span className="font-semibold">{productName}</span></>;
  } else if (shopName) {
    message = <>{order.customer_name} a commandé chez <span className="font-semibold">{shopName}</span></>;
  } else {
    message = <>{order.customer_name} a commandé <span className="font-semibold">{order.product_name || "un article"}</span></>;
  }

  return (
    <div className="fixed bottom-24 left-4 right-4 sm:right-auto sm:bottom-4 z-[10000] animate-in slide-in-from-bottom-4 fade-in duration-500">
      <div className="bg-white dark:bg-gray-900 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 p-4 max-w-xs flex items-start gap-3">
        <div className="h-10 w-10 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center shrink-0">
          <ShoppingBag className="h-5 w-5 text-green-600" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-900 dark:text-white">
            {message}
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
