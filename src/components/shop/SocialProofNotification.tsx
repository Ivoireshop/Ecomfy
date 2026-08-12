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

const DEMO_NAMES = ["Kouadio", "Aminata", "Ibrahim", "Fatou", "Yao", "Mariam"];
const buildDemoOrders = (): RecentOrder[] => DEMO_NAMES.slice(0, 3).map((n, i) => ({
  customer_name: n,
  product_name: "un article",
  created_at: new Date(Date.now() - (3 + i * 12) * 60000).toISOString(),
}));

export function SocialProofNotification({ shopId, enabled, productName, shopName, productImage }: SocialProofNotificationProps) {
  const [orders, setOrders] = useState<RecentOrder[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [visible, setVisible] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [showCount, setShowCount] = useState(0);

  const fetchRecentOrders = useCallback(async () => {
    // 1. Fetch orders via RPC (which has SECURITY DEFINER and bypasses RLS)
    const { data: ordersData, error: ordersError } = await (supabase as any).rpc("get_shop_social_proof_orders", {
      _shop_id: shopId,
      _limit: 10,
    });

    if (ordersError || !ordersData?.length) {
      // Use fallback productName and productImage for demo orders if available
      const demos = buildDemoOrders().map(o => ({
        ...o,
        product_name: productName || o.product_name,
        product_image_url: productImage || undefined
      }));
      setOrders(demos);
      return;
    }

    // 2. Fetch products for this shop to get their images (RLS allows this for public shops)
    const { data: productsData } = await supabase
      .from("products")
      .select("name, image_url")
      .eq("shop_id", shopId)
      .eq("is_active", true);

    const productImagesMap = new Map<string, string>();
    if (productsData) {
      productsData.forEach(p => {
        if (p.name && p.image_url) {
          productImagesMap.set(p.name.toLowerCase(), p.image_url);
        }
      });
    }

    const processedOrders = ordersData.map((o: any) => {
      const customerName = (o.customer_name || "Un client").trim().split(" ")[0] || "Un client";
      
      // If we don't have a product name in the order, fallback to productName prop
      const actualProductName = (o.product_name && o.product_name !== "un article") ? o.product_name : (productName || "un article");
      
      // Try to find the image for this product
      let imageUrl = null;
      if (actualProductName && actualProductName !== "un article") {
         imageUrl = productImagesMap.get(actualProductName.toLowerCase()) || null;
      }
      // If still no image found, fallback to productImage prop
      if (!imageUrl && productImage) {
         imageUrl = productImage;
      }
      
      return {
        customer_name: customerName,
        product_name: actualProductName,
        product_image_url: imageUrl,
        created_at: o.created_at,
      };
    }).filter((o: any) => o.customer_name.length > 0);
    
    if (processedOrders.length > 0) {
      setOrders(processedOrders);
    } else {
      const demos = buildDemoOrders().map(o => ({
        ...o,
        product_name: productName || o.product_name,
        product_image_url: productImage || undefined
      }));
      setOrders(demos);
    }
  }, [shopId, productName, productImage]);

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
  
  const diff = Date.now() - new Date(order.created_at).getTime();
  const minutes = Math.floor(diff / 60000);
  
  let isRecent = false;
  let timeAgoText = "";
  
  if (minutes < 1) {
    const seconds = Math.floor(diff / 1000);
    timeAgoText = `il y a ${Math.max(1, seconds)} seconde${seconds > 1 ? 's' : ''}`;
  } else if (minutes <= 30) {
    timeAgoText = `il y a ${minutes} minute${minutes > 1 ? 's' : ''}`;
  } else {
    isRecent = true;
  }

  let message: ReactNode;
  if (isRecent) {
    message = <><span className="capitalize">{order.customer_name}</span> a récemment commandé <span className="font-semibold">{order.product_name}</span></>;
  } else {
    message = <><span className="capitalize">{order.customer_name}</span> a commandé <span className="font-semibold">{order.product_name}</span></>;
  }

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
          {!isRecent && (
            <p className="text-xs text-green-600 dark:text-green-400 font-medium mt-1">
              {timeAgoText}
            </p>
          )}
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
