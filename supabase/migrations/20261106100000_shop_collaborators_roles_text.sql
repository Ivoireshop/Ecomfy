-- Collaborateurs : permettre d'enregistrer les 8 rôles (dont « Accès total »).
--
-- Constat (06/11/2026) : la colonne shop_collaborators.roles est restée de type
-- shop_collab_role[] (enum à 4 valeurs). Enregistrer manage_catalog, view_stats,
-- manage_customers ou full_admin échoue avec
--   invalid input value for enum shop_collab_role: "manage_catalog"
-- et l'interface retombait en silence sur 4 rôles seulement.
--
-- Les migrations 20260916201500, 20260918000000 et 20260919173000 devaient convertir
-- la colonne en text[] mais n'ont pas abouti :
--   - 20260916201500 teste data_type = 'USER-DEFINED', or une colonne tableau vaut 'ARRAY' ;
--   - les deux autres font ALTER ... TYPE sans retirer le DEFAULT '{}' (de type enum),
--     ce que PostgreSQL refuse (« default for column cannot be cast automatically »).
--
-- Cette migration est idempotente : sans effet si la colonne est déjà en text[].

-- 1. Conversion enum[] -> text[] (le défaut est retiré puis recréé).
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'shop_collaborators'
      AND column_name = 'roles'
      AND udt_name = '_shop_collab_role'
  ) THEN
    ALTER TABLE public.shop_collaborators ALTER COLUMN roles DROP DEFAULT;
    ALTER TABLE public.shop_collaborators ALTER COLUMN roles TYPE text[] USING roles::text[];
    ALTER TABLE public.shop_collaborators ALTER COLUMN roles SET DEFAULT '{}'::text[];
  END IF;
END $$;

-- 2. Garde-fou : seuls les 8 rôles connus sont acceptés.
ALTER TABLE public.shop_collaborators DROP CONSTRAINT IF EXISTS shop_collaborators_roles_valid;
ALTER TABLE public.shop_collaborators
  ADD CONSTRAINT shop_collaborators_roles_valid
  CHECK (roles <@ ARRAY[
    'view_orders', 'edit_shop', 'manage_expenses', 'manage_delivered_orders',
    'manage_catalog', 'view_stats', 'manage_customers', 'full_admin'
  ]::text[]);

-- 3. has_shop_role : « full_admin » vaut tous les rôles. Version texte...
CREATE OR REPLACE FUNCTION public.has_shop_role(_shop_id uuid, _user_id uuid, _required_role text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.shops WHERE id = _shop_id AND user_id = _user_id
  ) OR EXISTS (
    SELECT 1 FROM public.shop_collaborators
    WHERE shop_id = _shop_id
      AND user_id = _user_id
      AND status = 'active'
      AND (
        _required_role = ANY(roles)
        OR 'full_admin' = ANY(roles)
      )
  );
$$;

-- ... et la surcharge enum, encore appelée par d'anciennes politiques ('x'::shop_collab_role).
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'shop_collab_role') THEN
    CREATE OR REPLACE FUNCTION public.has_shop_role(_shop_id uuid, _user_id uuid, _role public.shop_collab_role)
    RETURNS boolean
    LANGUAGE sql
    STABLE
    SECURITY DEFINER
    SET search_path = public
    AS $f$
      SELECT public.has_shop_role(_shop_id, _user_id, _role::text);
    $f$;
  END IF;
END $$;
