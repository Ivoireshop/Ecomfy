CREATE INDEX IF NOT EXISTS idx_shops_user_created_at
ON public.shops (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_shops_public_slug
ON public.shops (slug)
WHERE is_published = true
  AND is_activated = true
  AND COALESCE(is_suspended, false) = false;

CREATE INDEX IF NOT EXISTS idx_products_shop_display_order
ON public.products (shop_id, display_order);

CREATE INDEX IF NOT EXISTS idx_products_shop_slug
ON public.products (shop_id, slug);

CREATE INDEX IF NOT EXISTS idx_product_images_product_display_order
ON public.product_images (product_id, is_primary DESC, display_order);

CREATE INDEX IF NOT EXISTS idx_orders_shop_created_at
ON public.orders (shop_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_order_items_order_id
ON public.order_items (order_id);

CREATE INDEX IF NOT EXISTS idx_shop_visits_shop_visited_at
ON public.shop_visits (shop_id, visited_at DESC);

CREATE INDEX IF NOT EXISTS idx_user_roles_user_role
ON public.user_roles (user_id, role);

CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id
ON public.subscriptions (user_id);

CREATE INDEX IF NOT EXISTS idx_device_tokens_user_id
ON public.device_tokens (user_id);

CREATE INDEX IF NOT EXISTS idx_feedback_status_created_at
ON public.feedback (status, created_at DESC);