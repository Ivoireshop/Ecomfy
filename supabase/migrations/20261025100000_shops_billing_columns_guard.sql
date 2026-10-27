-- Colonnes de facturation de `shops` : plus modifiables par le propriétaire ni par un collaborateur « edit_shop ».
--
-- Constat (test supabase/tests/rls_money_flows.sql) : la politique « Users can manage their own shops » (ALL) et
-- « Collaborators with edit_shop can update shop » laissaient un marchand réécrire sa dette de commission, son taux,
-- son seuil, son statut de verrouillage, ses échéances, son abonnement (donc 0 commission) et l'activation de sa
-- boutique. Aucun déclencheur ne les protégeait ; l'INSERT permettait aussi de créer une boutique déjà « abonnée ».
--
-- Règle : ces colonnes ne bougent que par les fonctions serveur (SECURITY DEFINER : current_user = leur propriétaire),
-- par service_role (Edge Functions) ou par un fondateur / co-fondateur. Les rôles `authenticated` et `anon` sont
-- refusés ; à l'INSERT, ils doivent laisser les valeurs par défaut.
-- La fonction du déclencheur n'est volontairement PAS SECURITY DEFINER : current_user doit rester le rôle appelant.
-- Les colonnes sont comparées via to_jsonb(NEW/OLD) : une colonne absente de la base (ex. production sans le système de
-- facturation par seuil) est simplement ignorée au lieu de faire échouer toute modification de boutique.

CREATE OR REPLACE FUNCTION public.guard_shop_billing_columns()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_new jsonb := to_jsonb(NEW);
  v_old jsonb;
  v_cols text[] := ARRAY[]::text[];
  v_col text;
  -- Colonnes protégées et leur valeur à la création (= valeur par défaut de la table)
  v_defaults constant jsonb := '{
    "commission_balance_due": 0, "commission_rate": 0.025, "commission_per_order": 50, "commission_threshold": 12000,
    "shop_payment_status": "active", "is_suspended": false, "payment_deadline": null, "first_deadline_at": null,
    "second_deadline_at": null, "threshold_reached_at": null, "locked_at": null, "final_suspension_at": null,
    "extra_deadline_active": false, "extra_deadline_started_at": null, "extra_deadline_ends_at": null,
    "extra_deadline_granted_by": null, "subscription_plan": "free", "subscription_started_at": null,
    "subscription_active_until": null, "is_subscribed": false, "is_activated": false, "activation_fee_paid": false,
    "total_sales": 0, "total_orders": 0
  }'::jsonb;
BEGIN
  -- Fonctions serveur, service_role, postgres : libres
  IF current_user NOT IN ('authenticated', 'anon') THEN
    RETURN NEW;
  END IF;
  IF public.has_role(auth.uid(), 'founder') OR public.has_role(auth.uid(), 'co_founder') THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN v_old := to_jsonb(OLD); END IF;

  FOR v_col IN SELECT jsonb_object_keys(v_defaults) LOOP
    IF NOT (v_new ? v_col) THEN CONTINUE; END IF;  -- colonne absente de cette base
    IF TG_OP = 'INSERT' THEN
      IF (v_new -> v_col) IS DISTINCT FROM (v_defaults -> v_col) THEN v_cols := array_append(v_cols, v_col); END IF;
    ELSE
      IF (v_new -> v_col) IS DISTINCT FROM (v_old -> v_col) THEN v_cols := array_append(v_cols, v_col); END IF;
    END IF;
  END LOOP;

  IF array_length(v_cols, 1) > 0 THEN
    RAISE EXCEPTION 'shop_billing_columns_protected'
      USING ERRCODE = 'insufficient_privilege', DETAIL = array_to_string(v_cols, ', ');
  END IF;
  RETURN NEW;
END $$;

REVOKE ALL ON FUNCTION public.guard_shop_billing_columns() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_guard_shop_billing_columns ON public.shops;
CREATE TRIGGER trg_guard_shop_billing_columns
  BEFORE INSERT OR UPDATE ON public.shops
  FOR EACH ROW EXECUTE FUNCTION public.guard_shop_billing_columns();
