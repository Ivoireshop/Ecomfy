-- Livraisons : nom et téléphone du livreur affichés dans « Suivi Livraison ».
--
-- Constat : le tableau de bord de la boutique affiche le livreur assigné (nom, téléphone cliquable) en lisant
-- `driver.name` et `driver.phone` de `delivery_company_members`. Cette table n'a pas ces colonnes (seulement
-- provider_id, user_id, role, is_active, dates) : l'identité est dans `profiles` (full_name, phone), et la RLS de
-- `profiles` ne laisse lire que sa propre ligne. Le livreur s'affichait donc sans nom ni numéro.
--
-- Correction : `get_delivery_driver_contacts(uuid[])`, SECURITY DEFINER, renvoie le nom et le téléphone uniquement pour
-- les membres que l'appelant a le droit de connaître :
--   * le propriétaire d'une boutique, pour un livreur affecté à une livraison de l'une de ses commandes ;
--   * le propriétaire du prestataire, pour les membres de son équipe.
-- Tout autre identifiant est ignoré (aucune erreur, aucune ligne). Entrée bornée à 500 identifiants.
--
-- Idempotent. Tests : supabase/tests/delivery_rls_recursion*.sql (base jetable).

CREATE OR REPLACE FUNCTION public.get_delivery_driver_contacts(_member_ids uuid[])
RETURNS TABLE (member_id uuid, full_name text, phone text)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT m.id, p.full_name, p.phone
    FROM public.delivery_company_members m
    LEFT JOIN public.profiles p ON p.id = m.user_id
   WHERE m.id = ANY (_member_ids[1:500])
     AND auth.uid() IS NOT NULL
     AND (
       public.shop_owner_can_see_delivery_member(m.id, auth.uid())
       OR EXISTS (
         SELECT 1 FROM public.delivery_providers dp
          WHERE dp.id = m.provider_id AND dp.user_id = auth.uid()
       )
     );
$$;

REVOKE ALL ON FUNCTION public.get_delivery_driver_contacts(uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_delivery_driver_contacts(uuid[]) TO authenticated, service_role;
