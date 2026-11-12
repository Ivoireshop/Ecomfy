-- Produits digitaux : fichier vendu, stockage privé, accès par commande payée.
--
-- Constat (12/11/2026) : « Produit numérique » n'était qu'un drapeau (products.is_digital → badge « Digital »). Aucun
-- fichier n'était déposé ni livré. La colonne products.digital_file_url existait mais la politique publique de lecture
-- des produits publiés l'aurait exposée à tout visiteur : y mettre un lien de fichier = le publier.
--
-- Après cette migration :
--   * bucket PRIVÉ digital-products, chemin imposé <shop_id>/<product_id>/<fichier> ; le marchand (et ses
--     collaborateurs « edit_shop » / « manage_catalog ») dépose, relit et supprime ; personne d'autre n'y accède
--     (le client passe par l'Edge Function digital-download, qui signe un lien de 60 secondes) ;
--   * product_digital_files : les fichiers d'un produit (10 maximum), lisibles par le seul marchand ;
--   * digital_order_access : un jeton secret par commande contenant un produit digital (créé par trigger, jamais lisible
--     par les rôles API) ; digital_download_log : un téléchargement = une ligne (limite par fichier) ;
--   * products.digital_download_limit : téléchargements par fichier et par commande (5 par défaut, NULL = illimité) ;
--   * garde : une commande contenant un produit digital ne peut pas être en paiement à la livraison (pas de livraison, donc
--     rien à encaisser « à la remise ») et doit porter une adresse e-mail (le lien de téléchargement y est envoyé) ;
--     refusé côté serveur, pas seulement dans le formulaire ;
--   * garde : products.digital_file_url est forcé à NULL pour anon / authenticated (colonne héritée, publique par RLS).
--
-- Le droit de téléchargement n'est PAS poussé par les fonctions de paiement : l'Edge Function le recalcule à chaque
-- demande (orders.payment_status = 'paid', insensible à la casse). Un remboursement le coupe donc sans autre code.
--
-- Prérequis : has_shop_permission (20261111100000), check_rate_limit (20261015...), tables products / orders / order_items.
-- Aucun effet sur les commandes existantes (pas de rétro-remplissage : aucun fichier n'existait). Idempotent.
-- À déployer AVEC l'Edge Function digital-download et le front. Test : supabase/tests/digital_products.sql.

-- ---------- Produit ----------
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS digital_download_limit integer DEFAULT 5;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'products_digital_download_limit_range') THEN
    ALTER TABLE public.products
      ADD CONSTRAINT products_digital_download_limit_range
      CHECK (digital_download_limit IS NULL OR digital_download_limit BETWEEN 1 AND 100) NOT VALID;
  END IF;
END $$;

-- Colonne héritée : jamais de lien de fichier dans une table lisible publiquement.
CREATE OR REPLACE FUNCTION public.products_guard_digital_file_url()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  -- Non SECURITY DEFINER : current_user reste le rôle de la session (service_role et scripts ne sont pas concernés).
  IF current_user IN ('anon', 'authenticated') THEN
    NEW.digital_file_url := NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS products_guard_digital_file_url ON public.products;
CREATE TRIGGER products_guard_digital_file_url
  BEFORE INSERT OR UPDATE OF digital_file_url ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.products_guard_digital_file_url();

-- ---------- Bucket privé ----------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'digital-products', 'digital-products', false, 52428800,
  ARRAY[
    'application/pdf', 'application/zip', 'application/x-zip-compressed', 'application/epub+zip',
    'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint', 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'text/plain', 'text/csv',
    'audio/mpeg', 'audio/mp4', 'audio/wav', 'video/mp4', 'video/quicktime', 'video/webm',
    'image/jpeg', 'image/png', 'image/webp'
  ]
)
ON CONFLICT (id) DO UPDATE
   SET public = false,
       file_size_limit = EXCLUDED.file_size_limit,
       allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "digital_products_manage_insert" ON storage.objects;
DROP POLICY IF EXISTS "digital_products_manage_select" ON storage.objects;
DROP POLICY IF EXISTS "digital_products_manage_delete" ON storage.objects;

-- Pas d'UPDATE : un fichier se remplace par un nouvel objet (nouveau chemin), l'ancien est supprimé.
CREATE POLICY "digital_products_manage_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'digital-products'
    AND EXISTS (
      SELECT 1 FROM public.shops s
      WHERE s.id::text = (storage.foldername(name))[1]
        AND public.has_shop_permission(s.id, ARRAY['edit_shop', 'manage_catalog'])
    )
  );

CREATE POLICY "digital_products_manage_select" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'digital-products'
    AND EXISTS (
      SELECT 1 FROM public.shops s
      WHERE s.id::text = (storage.foldername(name))[1]
        AND public.has_shop_permission(s.id, ARRAY['edit_shop', 'manage_catalog'])
    )
  );

CREATE POLICY "digital_products_manage_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'digital-products'
    AND EXISTS (
      SELECT 1 FROM public.shops s
      WHERE s.id::text = (storage.foldername(name))[1]
        AND public.has_shop_permission(s.id, ARRAY['edit_shop', 'manage_catalog'])
    )
  );

-- ---------- Fichiers d'un produit ----------
CREATE TABLE IF NOT EXISTS public.product_digital_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  shop_id uuid NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  storage_path text NOT NULL UNIQUE,
  file_name text NOT NULL CHECK (char_length(file_name) BETWEEN 1 AND 255),
  file_size bigint CHECK (file_size IS NULL OR file_size >= 0),
  mime_type text CHECK (mime_type IS NULL OR char_length(mime_type) <= 150),
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_product_digital_files_product ON public.product_digital_files (product_id, display_order);

-- Cohérence : la boutique est celle du produit, le chemin est <shop_id>/<product_id>/<fichier> (pas de « .. »), 10 fichiers max.
CREATE OR REPLACE FUNCTION public.product_digital_files_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_shop uuid;
BEGIN
  SELECT shop_id INTO v_shop FROM public.products WHERE id = NEW.product_id;
  IF v_shop IS NULL OR v_shop IS DISTINCT FROM NEW.shop_id THEN
    RAISE EXCEPTION 'Produit introuvable pour cette boutique.' USING ERRCODE = '22023';
  END IF;
  IF left(NEW.storage_path, length(NEW.shop_id::text || '/' || NEW.product_id::text) + 1)
       <> NEW.shop_id::text || '/' || NEW.product_id::text || '/'
     OR position('..' IN NEW.storage_path) > 0
     OR char_length(NEW.storage_path) > 400 THEN
    RAISE EXCEPTION 'Chemin de fichier invalide.' USING ERRCODE = '22023';
  END IF;
  IF TG_OP = 'INSERT'
     AND (SELECT count(*) FROM public.product_digital_files WHERE product_id = NEW.product_id) >= 10 THEN
    RAISE EXCEPTION 'Dix fichiers au maximum par produit.' USING ERRCODE = '22023';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS product_digital_files_guard ON public.product_digital_files;
CREATE TRIGGER product_digital_files_guard
  BEFORE INSERT OR UPDATE ON public.product_digital_files
  FOR EACH ROW EXECUTE FUNCTION public.product_digital_files_guard();

ALTER TABLE public.product_digital_files ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Catalog managers manage digital files" ON public.product_digital_files;
CREATE POLICY "Catalog managers manage digital files" ON public.product_digital_files
  FOR ALL TO authenticated
  USING (public.has_shop_permission(shop_id, ARRAY['edit_shop', 'manage_catalog']))
  WITH CHECK (public.has_shop_permission(shop_id, ARRAY['edit_shop', 'manage_catalog']));

REVOKE ALL ON public.product_digital_files FROM anon;

-- ---------- Accès par commande ----------
CREATE TABLE IF NOT EXISTS public.digital_order_access (
  order_id uuid PRIMARY KEY REFERENCES public.orders(id) ON DELETE CASCADE,
  shop_id uuid NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  -- 2 UUID v4 aléatoires concaténés : 244 bits, non devinable. Ne quitte jamais le serveur sauf vers l'acheteur.
  token text NOT NULL UNIQUE DEFAULT replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.digital_order_access ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.digital_order_access FROM anon, authenticated;

CREATE TABLE IF NOT EXISTS public.digital_download_log (
  id bigserial PRIMARY KEY,
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  file_id uuid NOT NULL REFERENCES public.product_digital_files(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_digital_download_log_order_file ON public.digital_download_log (order_id, file_id);

ALTER TABLE public.digital_download_log ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.digital_download_log FROM anon, authenticated;

-- Le marchand voit combien de fois ses fichiers ont été téléchargés (sans jamais voir les jetons).
DROP POLICY IF EXISTS "Catalog managers read download log" ON public.digital_download_log;
CREATE POLICY "Catalog managers read download log" ON public.digital_download_log
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.product_digital_files f
    WHERE f.id = digital_download_log.file_id
      AND public.has_shop_permission(f.shop_id, ARRAY['edit_shop', 'manage_catalog'])
  ));
GRANT SELECT ON public.digital_download_log TO authenticated;

-- ---------- Lignes de commande : garde + création de l'accès ----------
-- BEFORE : refuse le paiement à la livraison pour un produit digital (annule toute la transaction de create_public_order).
CREATE OR REPLACE FUNCTION public.order_items_guard_digital_payment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_digital boolean;
  v_pay text;
  v_email text;
BEGIN
  SELECT COALESCE(is_digital, false) INTO v_digital FROM public.products WHERE id = NEW.product_id;
  IF v_digital IS NOT TRUE THEN
    RETURN NEW;
  END IF;
  SELECT payment_method, customer_email INTO v_pay, v_email FROM public.orders WHERE id = NEW.order_id;
  IF lower(COALESCE(v_pay, '')) IN ('cash_on_delivery', 'cod') THEN
    RAISE EXCEPTION 'Les produits numériques se règlent en ligne (Mobile Money).' USING ERRCODE = 'P0001';
  END IF;
  -- Le lien de téléchargement est envoyé par e-mail : sans adresse, l'acheteur perdrait son achat en fermant la page.
  IF NULLIF(btrim(COALESCE(v_email, '')), '') IS NULL THEN
    RAISE EXCEPTION 'Une adresse e-mail est requise pour recevoir un produit numérique.' USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS order_items_guard_digital_payment ON public.order_items;
CREATE TRIGGER order_items_guard_digital_payment
  BEFORE INSERT ON public.order_items
  FOR EACH ROW EXECUTE FUNCTION public.order_items_guard_digital_payment();

-- AFTER : une commande contenant un produit digital reçoit son jeton d'accès (une seule ligne par commande).
CREATE OR REPLACE FUNCTION public.order_items_create_digital_access()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.products p WHERE p.id = NEW.product_id AND p.is_digital IS TRUE) THEN
    INSERT INTO public.digital_order_access (order_id, shop_id)
    SELECT o.id, o.shop_id FROM public.orders o WHERE o.id = NEW.order_id
    ON CONFLICT (order_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS order_items_create_digital_access ON public.order_items;
CREATE TRIGGER order_items_create_digital_access
  AFTER INSERT ON public.order_items
  FOR EACH ROW EXECUTE FUNCTION public.order_items_create_digital_access();
