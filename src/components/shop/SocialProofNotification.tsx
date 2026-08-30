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

const DEMO_NAMES = ["Kouadio", "Aminata", "Ibrahim", "Fatou", "Yao", "Mariam", "Sékou", "Awa", "Koffi", "Bintou"];

const buildDemoOrders = (fallbackProduct?: string, fallbackImage?: string): RecentOrder[] => 
  DEMO_NAMES.slice(0, 5).map((n, i) => ({
    customer_name: n,
    product_name: fallbackProduct || "un article",
    product_image_url: fallbackImage || undefined,
    created_at: new Date(Date.now() - (3 + i * 12) * 60000).toISOString(),
  }));

export function SocialProofNotification({ shopId, enabled, productName, shopName, productImage }: SocialProofNotificationProps) {
  const [orders, setOrders] = useState<RecentOrder[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [visible, setVisible] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [showCount, setShowCount] = useState(0);

  const fetchRecentOrders = useCallback(async () => {
    // 1. Fetch active products for this shop to map current live product names and images
    const { data: productsData } = await (supabase
      .from("products")
      .select("id, name, is_published, product_images(image_url)")
      .eq("shop_id", shopId)
      .eq("is_published", true) as any);

    const activeProductsMap = new Map<string, { name: string; image_url?: string }>();
    let firstActiveProduct: { name: string; image_url?: string } | undefined = undefined;

    if (productsData && Array.isArray(productsData) && productsData.length > 0) {
      productsData.forEach((p: any) => {
        if (p.name) {
          const img = p.product_images?.[0]?.image_url || undefined;
          if (!firstActiveProduct) {
            firstActiveProduct = { name: p.name, image_url: img };
          }
          activeProductsMap.set(p.name.toLowerCase(), { name: p.name, image_url: img });
        }
      });
    }

    const fallbackName = productName || firstActiveProduct?.name || shopName || "un article";
    const fallbackImage = productImage || firstActiveProduct?.image_url || undefined;

    // 2. Fetch orders via RPC
    const { data: ordersData, error: ordersError } = await (supabase as any).rpc("get_shop_social_proof_orders", {
      _shop_id: shopId,
      _limit: 10,
    });

    if (ordersError || !ordersData?.length) {
      setOrders(buildDemoOrders(fallbackName, fallbackImage));
      return;
    }

    const processedOrders = ordersData.map((o: any) => {
      const customerName = (o.customer_name || "Un client").trim().split(" ")[0] || "Un client";
      
      // CRITICAL: On a product page (productName prop present), ALWAYS display current live productName!
      // This prevents outdated product names (e.g. "Terminus Coco") from appearing when viewing "Secret d'homme".
      let displayProductName = fallbackName;
      let displayImageUrl = fallbackImage;

      if (!productName) {
        // We are on general shop view: resolve old order product names against currently active products
        const rawName = (o.product_name || "").toLowerCase();
        if (rawName && activeProductsMap.has(rawName)) {
          const matched = activeProductsMap.get(rawName)!;
          displayProductName = matched.name;
          displayImageUrl = matched.image_url || fallbackImage;
        } else if (firstActiveProduct) {
          // Historical product was renamed or deleted: fall back to current active product name
          displayProductName = firstActiveProduct.name;
          displayImageUrl = firstActiveProduct.image_url || fallbackImage;
        } else if (o.product_name && o.product_name !== "un article") {
          displayProductName = o.product_name;
        }
      }
      
      return {
        customer_name: customerName,
        product_name: displayProductName,
        product_image_url: displayImageUrl,
        created_at: o.created_at,
      };
    }).filter((o: any) => o.customer_name.length > 0);
    
    if (processedOrders.length > 0) {
      setOrders(processedOrders);
    } else {
      setOrders(buildDemoOrders(fallbackName, fallbackImage));
    }
  }, [shopId, productName, productImage, shopName]);

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
        setCurrentIndex((prev) => (prev + 1) % orders.length);
        setShowCount(prev => prev + 1);
        setVisible(true);
      }, 6000);
    }, 5000);

    return () => clearTimeout(hideTimer);
  }, [visible, orders.length, dismissed]);

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
