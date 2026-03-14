
-- Create shops table
CREATE TABLE public.shops (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  business_name text NOT NULL,
  business_description text,
  slug text NOT NULL UNIQUE,
  logo_url text,
  banner_url text,
  primary_color text DEFAULT '#2563eb',
  secondary_color text DEFAULT '#7c3aed',
  theme text DEFAULT 'modern',
  whatsapp_number text,
  phone_number text,
  email text,
  address text,
  city text,
  country text DEFAULT 'Côte d''Ivoire',
  currency text DEFAULT 'XOF',
  is_activated boolean DEFAULT false,
  is_published boolean DEFAULT false,
  activation_fee_paid boolean DEFAULT false,
  commission_rate numeric DEFAULT 0.025,
  total_sales numeric DEFAULT 0,
  total_orders integer DEFAULT 0,
  seo_title text,
  seo_description text,
  chatbot_enabled boolean DEFAULT true,
  chatbot_welcome_message text DEFAULT 'Bienvenue ! Comment puis-je vous aider ?',
  payment_methods text[] DEFAULT ARRAY['mobile_money', 'cash_on_delivery'],
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Create products table
CREATE TABLE public.products (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  shop_id uuid NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  short_description text,
  price numeric NOT NULL DEFAULT 0,
  compare_at_price numeric,
  currency text DEFAULT 'XOF',
  category text DEFAULT 'général',
  sku text,
  stock_quantity integer DEFAULT 0,
  is_digital boolean DEFAULT false,
  digital_file_url text,
  is_published boolean DEFAULT false,
  is_featured boolean DEFAULT false,
  weight numeric,
  display_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create product_images table
CREATE TABLE public.product_images (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  image_url text NOT NULL,
  alt_text text,
  display_order integer DEFAULT 0,
  is_primary boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- Create orders table
CREATE TABLE public.orders (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  shop_id uuid NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  order_number text NOT NULL UNIQUE,
  customer_name text NOT NULL,
  customer_email text,
  customer_phone text NOT NULL,
  customer_address text,
  customer_city text,
  customer_country text DEFAULT 'Côte d''Ivoire',
  subtotal numeric NOT NULL DEFAULT 0,
  commission_amount numeric NOT NULL DEFAULT 0,
  total numeric NOT NULL DEFAULT 0,
  payment_method text NOT NULL DEFAULT 'mobile_money',
  payment_status text NOT NULL DEFAULT 'pending',
  order_status text NOT NULL DEFAULT 'new',
  notes text,
  is_read boolean DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Create order_items table
CREATE TABLE public.order_items (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id),
  product_name text NOT NULL,
  product_image_url text,
  quantity integer NOT NULL DEFAULT 1,
  unit_price numeric NOT NULL,
  total_price numeric NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.shops ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;

-- Shops policies
CREATE POLICY "Users can manage their own shops" ON public.shops FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Anyone can view published activated shops" ON public.shops FOR SELECT USING (is_published = true AND is_activated = true);

-- Products policies
CREATE POLICY "Shop owners can manage products" ON public.products FOR ALL USING (EXISTS (SELECT 1 FROM public.shops WHERE shops.id = products.shop_id AND shops.user_id = auth.uid())) WITH CHECK (EXISTS (SELECT 1 FROM public.shops WHERE shops.id = products.shop_id AND shops.user_id = auth.uid()));
CREATE POLICY "Anyone can view published products" ON public.products FOR SELECT USING (is_published = true AND EXISTS (SELECT 1 FROM public.shops WHERE shops.id = products.shop_id AND shops.is_published = true AND shops.is_activated = true));

-- Product images policies
CREATE POLICY "Shop owners can manage product images" ON public.product_images FOR ALL USING (EXISTS (SELECT 1 FROM public.products p JOIN public.shops s ON s.id = p.shop_id WHERE p.id = product_images.product_id AND s.user_id = auth.uid())) WITH CHECK (EXISTS (SELECT 1 FROM public.products p JOIN public.shops s ON s.id = p.shop_id WHERE p.id = product_images.product_id AND s.user_id = auth.uid()));
CREATE POLICY "Anyone can view product images" ON public.product_images FOR SELECT USING (EXISTS (SELECT 1 FROM public.products p JOIN public.shops s ON s.id = p.shop_id WHERE p.id = product_images.product_id AND p.is_published = true AND s.is_published = true AND s.is_activated = true));

-- Orders policies
CREATE POLICY "Shop owners can manage orders" ON public.orders FOR ALL USING (EXISTS (SELECT 1 FROM public.shops WHERE shops.id = orders.shop_id AND shops.user_id = auth.uid()));
CREATE POLICY "Anyone can create orders" ON public.orders FOR INSERT WITH CHECK (true);

-- Order items policies
CREATE POLICY "Shop owners can view order items" ON public.order_items FOR SELECT USING (EXISTS (SELECT 1 FROM public.orders o JOIN public.shops s ON s.id = o.shop_id WHERE o.id = order_items.order_id AND s.user_id = auth.uid()));
CREATE POLICY "Anyone can insert order items" ON public.order_items FOR INSERT WITH CHECK (true);

-- Generate order number function
CREATE OR REPLACE FUNCTION public.generate_order_number()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  order_num text;
  num_exists boolean;
BEGIN
  LOOP
    order_num := 'VP-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' || UPPER(SUBSTRING(MD5(RANDOM()::TEXT) FROM 1 FOR 5));
    SELECT EXISTS(SELECT 1 FROM orders WHERE order_number = order_num) INTO num_exists;
    EXIT WHEN NOT num_exists;
  END LOOP;
  RETURN order_num;
END;
$$;

-- Enable realtime for orders
ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;

-- Create storage bucket for shop images
INSERT INTO storage.buckets (id, name, public) VALUES ('shop-images', 'shop-images', true);

-- Storage policies for shop-images
CREATE POLICY "Anyone can view shop images" ON storage.objects FOR SELECT USING (bucket_id = 'shop-images');
CREATE POLICY "Authenticated users can upload shop images" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'shop-images' AND auth.uid() IS NOT NULL);
CREATE POLICY "Users can update their own shop images" ON storage.objects FOR UPDATE USING (bucket_id = 'shop-images' AND auth.uid() IS NOT NULL);
CREATE POLICY "Users can delete their own shop images" ON storage.objects FOR DELETE USING (bucket_id = 'shop-images' AND auth.uid() IS NOT NULL);
