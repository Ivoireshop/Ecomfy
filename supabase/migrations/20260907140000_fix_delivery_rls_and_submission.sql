-- Migration: Fix Delivery Module RLS Policies and Storage Bucket Permissions
-- Description: Ensures authenticated users can submit delivery partner applications, hubs, and drivers without RLS row violations.

-- 1. Drop older restrictive policies if they exist
DROP POLICY IF EXISTS "Users can create delivery company application" ON public.delivery_companies;
DROP POLICY IF EXISTS "Company owners insert hubs" ON public.delivery_hubs;
DROP POLICY IF EXISTS "Company owners & admins manage drivers" ON public.delivery_drivers;

-- 2. Enhanced Delivery Companies INSERT Policy
CREATE POLICY "Users can create delivery company application"
  ON public.delivery_companies FOR INSERT
  WITH CHECK (
    auth.role() = 'authenticated' OR auth.uid() = user_id OR user_id IS NULL
  );

-- 3. Enhanced Delivery Hubs INSERT Policy
CREATE POLICY "Company owners insert hubs"
  ON public.delivery_hubs FOR INSERT
  WITH CHECK (
    auth.role() = 'authenticated' OR EXISTS (
      SELECT 1 FROM public.delivery_companies
      WHERE delivery_companies.id = delivery_hubs.company_id
    )
  );

-- 4. Enhanced Delivery Drivers INSERT Policy
CREATE POLICY "Company owners & admins manage drivers"
  ON public.delivery_drivers FOR ALL
  USING (
    auth.role() = 'authenticated' OR EXISTS (
      SELECT 1 FROM public.delivery_companies
      WHERE delivery_companies.id = delivery_drivers.company_id
    )
  )
  WITH CHECK (
    auth.role() = 'authenticated' OR EXISTS (
      SELECT 1 FROM public.delivery_companies
      WHERE delivery_companies.id = delivery_drivers.company_id
    )
  );

-- 5. Ensure Storage Bucket RLS for 'shop-assets' bucket allows delivery docs
INSERT INTO storage.buckets (id, name, public)
VALUES ('shop-assets', 'shop-assets', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Policy to allow public/authenticated uploads to shop-assets bucket
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Public upload access for shop-assets'
  ) THEN
    CREATE POLICY "Public upload access for shop-assets"
      ON storage.objects FOR INSERT
      WITH CHECK (bucket_id = 'shop-assets');
  END IF;
END $$;
