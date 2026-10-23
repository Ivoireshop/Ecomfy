-- Avis produits : modération contournable, données non contrôlées, avis orphelins, statistiques tronquées.
--
-- 1) La politique d'insertion publique ne contrôlait pas le statut : n'importe quel visiteur pouvait envoyer
--    { "status": "approved" } et publier son avis sans modération (testé sur dev avec la clé publique).
--    Elle exige désormais « pending ».
-- 2) Aucune limite de taille (un commentaire de 20 000 caractères passait) et le produit pouvait appartenir à une autre
--    boutique. Un déclencheur normalise et valide à l'insertion ; en mise à jour, seul le statut peut changer.
-- 3) product_id / shop_id sans clé étrangère : un produit ou une boutique supprimé laissait ses avis (le code de
--    suppression d'un produit suppose pourtant un ON DELETE CASCADE).
-- 4) get_product_review_stats : note moyenne et nombre sur TOUS les avis approuvés (la page n'en chargeait que 50).
-- Idempotente.

-- ---------------------------------------------------------------------------------------------------------------
-- 1) Politique d'insertion publique : uniquement « pending »
-- ---------------------------------------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Anyone can submit a review" ON public.product_reviews;
CREATE POLICY "Anyone can submit a review"
  ON public.product_reviews
  FOR INSERT
  WITH CHECK (status = 'pending' AND public.is_shop_publicly_visible(shop_id));

-- Statuts connus (NOT VALID : les lignes existantes ne sont pas revérifiées, les nouvelles le sont).
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'product_reviews_status_check'
                  AND conrelid = 'public.product_reviews'::regclass) THEN
    ALTER TABLE public.product_reviews
      ADD CONSTRAINT product_reviews_status_check CHECK (status IN ('pending', 'approved', 'rejected')) NOT VALID;
  END IF;
END $$;

-- ---------------------------------------------------------------------------------------------------------------
-- 2) Validation à l'insertion, contenu figé ensuite
-- ---------------------------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.product_reviews_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_owner boolean;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_is_owner := auth.uid() IS NOT NULL
      AND EXISTS (SELECT 1 FROM public.shops s WHERE s.id = NEW.shop_id AND s.user_id = auth.uid());

    NEW.reviewer_name  := btrim(coalesce(NEW.reviewer_name, ''));
    NEW.comment        := btrim(coalesce(NEW.comment, ''));
    NEW.reviewer_email := nullif(btrim(coalesce(NEW.reviewer_email, '')), '');

    IF char_length(NEW.reviewer_name) NOT BETWEEN 1 AND 80 THEN
      RAISE EXCEPTION 'Le nom doit contenir entre 1 et 80 caractères.' USING ERRCODE = '22023';
    END IF;
    IF char_length(NEW.comment) NOT BETWEEN 1 AND 2000 THEN
      RAISE EXCEPTION 'Le commentaire doit contenir entre 1 et 2000 caractères.' USING ERRCODE = '22023';
    END IF;
    IF NEW.reviewer_email IS NOT NULL
       AND (char_length(NEW.reviewer_email) > 254 OR NEW.reviewer_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$') THEN
      RAISE EXCEPTION 'Adresse email invalide.' USING ERRCODE = '22023';
    END IF;
    IF NEW.product_id IS NOT NULL
       AND NOT EXISTS (SELECT 1 FROM public.products p WHERE p.id = NEW.product_id AND p.shop_id = NEW.shop_id) THEN
      RAISE EXCEPTION 'Produit introuvable dans cette boutique.' USING ERRCODE = '22023';
    END IF;

    -- Un visiteur ne publie jamais directement (la politique le vérifie déjà ; ceinture et bretelles).
    IF NOT v_is_owner AND coalesce(auth.role(), '') IN ('anon', 'authenticated') THEN
      NEW.status := 'pending';

      -- Anti-spam sans identité de visiteur : doublon exact (même produit, même nom, même texte) sur 7 jours, et
      -- plafond de 10 avis par produit sur 10 minutes. Le plafond se libère de lui-même (pas de blocage durable
      -- des vrais clients, contrairement à un plafond d'avis en attente).
      IF NEW.product_id IS NOT NULL THEN
        IF EXISTS (SELECT 1 FROM public.product_reviews r
                    WHERE r.product_id = NEW.product_id
                      AND lower(r.reviewer_name) = lower(NEW.reviewer_name)
                      AND r.comment = NEW.comment
                      AND r.created_at > now() - interval '7 days') THEN
          RAISE EXCEPTION 'Vous avez déjà envoyé cet avis.' USING ERRCODE = '22023';
        END IF;
        IF (SELECT count(*) FROM public.product_reviews r
             WHERE r.product_id = NEW.product_id
               AND r.created_at > now() - interval '10 minutes') >= 10 THEN
          RAISE EXCEPTION 'Trop d''avis envoyés pour ce produit en peu de temps. Réessayez dans quelques minutes.' USING ERRCODE = '22023';
        END IF;
      END IF;
    END IF;
    RETURN NEW;
  END IF;

  -- Mise à jour : seul le statut change (la modération ne réécrit pas ce que le client a écrit).
  -- Les accès sans utilisateur (SQL direct, service_role) restent libres.
  IF auth.uid() IS NOT NULL AND (
       NEW.shop_id        IS DISTINCT FROM OLD.shop_id
    OR NEW.product_id     IS DISTINCT FROM OLD.product_id
    OR NEW.reviewer_name  IS DISTINCT FROM OLD.reviewer_name
    OR NEW.reviewer_email IS DISTINCT FROM OLD.reviewer_email
    OR NEW.rating         IS DISTINCT FROM OLD.rating
    OR NEW.comment        IS DISTINCT FROM OLD.comment
  ) THEN
    RAISE EXCEPTION 'Le contenu d''un avis ne peut pas être modifié.' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.product_reviews_guard() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_product_reviews_guard ON public.product_reviews;
CREATE TRIGGER trg_product_reviews_guard
  BEFORE INSERT OR UPDATE ON public.product_reviews
  FOR EACH ROW EXECUTE FUNCTION public.product_reviews_guard();

-- ---------------------------------------------------------------------------------------------------------------
-- 3) Clés étrangères (les avis suivent leur produit / leur boutique)
-- ---------------------------------------------------------------------------------------------------------------
DELETE FROM public.product_reviews r
 WHERE (r.product_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.products p WHERE p.id = r.product_id))
    OR NOT EXISTS (SELECT 1 FROM public.shops s WHERE s.id = r.shop_id);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'product_reviews_product_id_fkey'
                  AND conrelid = 'public.product_reviews'::regclass) THEN
    ALTER TABLE public.product_reviews
      ADD CONSTRAINT product_reviews_product_id_fkey FOREIGN KEY (product_id)
      REFERENCES public.products(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'product_reviews_shop_id_fkey'
                  AND conrelid = 'public.product_reviews'::regclass) THEN
    ALTER TABLE public.product_reviews
      ADD CONSTRAINT product_reviews_shop_id_fkey FOREIGN KEY (shop_id)
      REFERENCES public.shops(id) ON DELETE CASCADE;
  END IF;
END $$;

-- ---------------------------------------------------------------------------------------------------------------
-- 3 bis) La suppression d'un produit était silencieusement annulée
-- trg_enforce_lock_products (20260701091528) est un déclencheur BEFORE DELETE qui faisait « RETURN NEW » : NEW vaut
-- NULL en suppression, la ligne n'était donc jamais supprimée (0 ligne, aucune erreur). L'application affichait
-- « Produit supprimé » et le produit revenait au rechargement. Même règle de verrouillage qu'avant.
-- ---------------------------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.enforce_shop_not_locked_products()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE v_status text;
BEGIN
  IF public.has_role(auth.uid(),'founder') OR public.has_role(auth.uid(),'co_founder') THEN
    RETURN COALESCE(NEW, OLD);
  END IF;
  SELECT shop_payment_status INTO v_status FROM public.shops WHERE id = COALESCE(NEW.shop_id, OLD.shop_id);
  IF v_status IN ('locked','final_suspension') THEN
    RAISE EXCEPTION 'shop_locked_payment_required' USING ERRCODE = 'check_violation';
  END IF;
  RETURN COALESCE(NEW, OLD);
END $$;

-- ---------------------------------------------------------------------------------------------------------------
-- 4) Statistiques publiques sur tous les avis approuvés
-- ---------------------------------------------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_product_reviews_public_list
  ON public.product_reviews (shop_id, product_id, created_at DESC)
  WHERE status = 'approved';

CREATE OR REPLACE FUNCTION public.get_product_review_stats(p_shop_id uuid, p_product_id uuid)
RETURNS TABLE (review_count bigint, average_rating numeric)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT count(*), coalesce(round(avg(r.rating)::numeric, 2), 0)
    FROM public.product_reviews r
   WHERE r.shop_id = p_shop_id
     AND r.product_id = p_product_id
     AND r.status = 'approved'
     AND public.is_shop_publicly_visible(p_shop_id);
$$;

REVOKE ALL ON FUNCTION public.get_product_review_stats(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_product_review_stats(uuid, uuid) TO anon, authenticated;
