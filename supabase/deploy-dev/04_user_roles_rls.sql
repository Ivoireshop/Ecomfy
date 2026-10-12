-- Audit C7 (côté RLS) : politiques de public.user_roles.
--
-- Constat (dev, 12/10/2026) : la politique user_roles_manage_policy (migration 20260831190000) interroge
-- user_roles dans sa propre condition. Postgres la détecte comme récursive : TOUTE lecture ou écriture de
-- user_roles par un utilisateur connecté échoue (HTTP 500, SQLSTATE 42P17). Conséquences :
--   * l'interface ne peut plus lire le rôle d'un fondateur / co-fondateur / actionnaire (« Accès restreint »),
--     sauf pour le compte qui passe par un contournement sur l'e-mail codé en dur ;
--   * si la récursion était corrigée sans restreindre la politique, tout co-fondateur pourrait s'attribuer
--     le rôle founder en écrivant directement dans la table.
-- Par ailleurs user_roles_select_policy (USING true) rend la table lisible par tout utilisateur connecté.
--
-- Correctif :
--   * lecture : chacun lit ses propres rôles (politique existante « Users can view their own roles ») ;
--     les founder / co_founder lisent tout, via is_corporate_founder() (SECURITY DEFINER, sans récursion) ;
--   * écriture : plus aucune écriture directe pour authenticated / anon. Les rôles se gèrent par l'Edge
--     Function manage-founder-roles (clé service_role, fondateur principal uniquement, liste blanche de rôles).
-- Prérequis : is_corporate_founder() (hotfix 20261012120000). Idempotent.

DROP POLICY IF EXISTS "user_roles_manage_policy" ON public.user_roles;
DROP POLICY IF EXISTS "user_roles_select_policy" ON public.user_roles;
DROP POLICY IF EXISTS "user_roles_founders_read" ON public.user_roles;

CREATE POLICY "user_roles_founders_read" ON public.user_roles
  FOR SELECT TO authenticated
  USING (public.is_corporate_founder());

REVOKE INSERT, UPDATE, DELETE ON public.user_roles FROM anon, authenticated;
REVOKE SELECT ON public.user_roles FROM anon;
