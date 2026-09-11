-- Migration to extend shop_collab_role enum with all 8 roles supported by Ecomfy UI
ALTER TYPE public.shop_collab_role ADD VALUE IF NOT EXISTS 'manage_catalog';
ALTER TYPE public.shop_collab_role ADD VALUE IF NOT EXISTS 'view_stats';
ALTER TYPE public.shop_collab_role ADD VALUE IF NOT EXISTS 'manage_customers';
ALTER TYPE public.shop_collab_role ADD VALUE IF NOT EXISTS 'full_admin';
