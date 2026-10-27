import { useEffect, useState, useCallback, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ShoppingBag, X } from "lucide-react";
import { thumbUrl } from "@/lib/imageUrl";

interface RecentOrder {
  customer_name: string;
  product_name: string;
  product_image_url?: string;
  created_at: string;
}

interface SocialProofNotificationProps {
  shopId: string;
  enabled: boolean;
  productName?: string;
  shopName?: string;
  productImage?: string;
}

// Chaque notification correspond à une vraie commande récente (7 jours, hors annulées/retournées : voir
// get_shop_social_proof_orders). Sans commande, rien n'est affiché : aucun acheteur n'est inventé.
export function SocialProofNotification({ shopId, enabled }: SocialProofNotificationProps) {
  const [orders, setOrders] = useState<RecentOrder[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [visible, setVisible] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  const fetchRecentOrders = useCallback(async () => {
    const { data: ordersData, error: ordersError } = await (supabase as any).rpc("get_shop_social_proof_orders", {
      _shop_id: shopId,
      _limit: 10,
    });

    if (ordersError || !ordersData?.length) {
      setOrders([]);
      return;
    }

    setOrders(
      ordersData
        .map((o: any) => ({
          customer_name: (o.customer_name || "").trim().split(" ")[0],
          product_name: o.product_name || "un article",
          product_image_url: o.product_image_url || undefined,
          created_at: o.created_at,
        }))
        .filter((o: RecentOrder) => o.customer_name.length > 0),
    );
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
        setCurrentIndex((prev) => (prev + 1) % orders.length);
        setVisible(true);
      }, 6000);
    }, 5000);

    return () => clearTimeout(hideTimer);
  }, [visible, orders.length, dismissed]);

  if (!enabled || orders.length === 0 || dismissed || !visible) return null;

  const order = orders[currentIndex];
  
  const minutes = Math.max(0, Math.floor((Date.now() - new Date(order.created_at).getTime()) / 60000));
  const timeAgoText =
    minutes < 1 ? "à l'instant"
    : minutes < 60 ? `il y a ${minutes} minute${minutes > 1 ? "s" : ""}`
    : minutes < 1440 ? `il y a ${Math.floor(minutes / 60)} heure${Math.floor(minutes / 60) > 1 ? "s" : ""}`
    : `il y a ${Math.floor(minutes / 1440)} jour${Math.floor(minutes / 1440) > 1 ? "s" : ""}`;

  const message: ReactNode = <><span className="capitalize">{order.customer_name}</span> a commandé <span className="font-semibold">{order.product_name}</span></>;

  return (
    <div className="fixed bottom-24 left-4 right-4 sm:right-auto sm:bottom-4 z-[10000] animate-in slide-in-from-bottom-4 fade-in duration-500">
      <div className="bg-white dark:bg-gray-900 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 p-3 sm:p-4 max-w-xs flex items-center gap-3">
        {order.product_image_url ? (
          <div className="h-12 w-12 rounded-lg overflow-hidden shrink-0 border border-gray-100 dark:border-gray-800 shadow-sm">
            <img 
              src={thumbUrl(order.product_image_url, 150)} 
              alt={order.product_name} 
              className="h-full w-full object-cover"
            />
          </div>
        ) : (
          <div className="h-10 w-10 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center shrink-0">
            <ShoppingBag className="h-5 w-5 text-green-600" />
          </div>
        )}
        <div className="flex-1 min-w-0 flex flex-col justify-center">
          <p className="text-sm text-gray-900 dark:text-white leading-snug">
            {message}
          </p>
          <p className="text-xs text-green-600 dark:text-green-400 font-medium mt-1">
            {timeAgoText}
          </p>
        </div>
        <button
          onClick={() => setDismissed(true)}
          className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 shrink-0 self-start -mt-1"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
