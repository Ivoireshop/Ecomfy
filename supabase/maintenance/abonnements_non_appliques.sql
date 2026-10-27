-- Abonnements payés mais jamais appliqués à la boutique (bug de production du 22/10/2026).
-- À lancer dans l'éditeur SQL de la production, APRÈS avoir appliqué la migration 20261019120000.
-- Chaque bloc est indépendant ; les blocs 1 et 2 sont en lecture seule.

-- ============================================================================================================
-- 1. VÉRIFICATION COMPLÈTE (lecture seule) : tous les paiements d'abonnement « completed », sans limite de date,
--    pour lesquels apply_shop_subscription n'a laissé aucune trace (une ligne commission_payments portant la
--    référence du paiement). Un abonnement appliqué en laisse toujours une.
-- ============================================================================================================
WITH paid AS (
  SELECT p.id AS payment_id, p.created_at, p.user_id, p.amount, p.status,
         p.metadata->>'payment_type' AS payment_type,
         p.metadata->>'plan' AS plan,
         p.transaction_id,
         p.metadata->>'gateway_reference' AS gateway_reference,
         COALESCE(NULLIF(p.metadata->>'shop_id', '')::uuid,
                  (SELECT s.id FROM public.shops s WHERE s.user_id = p.user_id ORDER BY s.created_at DESC LIMIT 1)) AS shop_id
    FROM public.payments p
   WHERE p.status = 'completed'
     AND p.metadata->>'payment_type' IN ('shop_subscription', 'subscription')
)
SELECT paid.created_at, paid.payment_id, paid.user_id, paid.shop_id, s.business_name,
       paid.payment_type, paid.plan, paid.amount, paid.transaction_id,
       s.subscription_plan, s.subscription_active_until, s.commission_balance_due,
       s.shop_payment_status, s.is_suspended,
       CASE WHEN paid.shop_id IS NULL THEN 'compte sans boutique (rien à appliquer à une boutique)'
            ELSE 'NON APPLIQUÉ' END AS diagnostic
  FROM paid
  LEFT JOIN public.shops s ON s.id = paid.shop_id
 WHERE NOT EXISTS (
         SELECT 1 FROM public.commission_payments c
          WHERE c.transaction_reference IN (paid.transaction_id, paid.gateway_reference)
       )
 ORDER BY paid.created_at;

-- Paiements d'abonnement restés « pending » alors que la passerelle les a peut-être encaissés (à rapprocher du
-- tableau de bord GeniusPay) :
SELECT p.created_at, p.id AS payment_id, p.user_id, p.amount, p.status, p.metadata->>'plan' AS plan, p.transaction_id
  FROM public.payments p
 WHERE p.status IN ('pending', 'processing')
   AND p.metadata->>'payment_type' IN ('shop_subscription', 'subscription')
   AND p.created_at < now() - interval '1 hour'
 ORDER BY p.created_at;

-- ============================================================================================================
-- 2. APERÇU DU RATTRAPAGE (lecture seule) : ce que le bloc 3 appliquerait pour les deux boutiques constatées.
--    Retirer le filtre sur user_id pour traiter tous les abonnements non appliqués listés au bloc 1.
-- ============================================================================================================
WITH a_rattraper AS (
  SELECT p.id AS payment_id, p.created_at, p.user_id, p.amount,
         COALESCE(NULLIF(p.metadata->>'shop_id', '')::uuid,
                  (SELECT s.id FROM public.shops s WHERE s.user_id = p.user_id ORDER BY s.created_at DESC LIMIT 1)) AS shop_id,
         COALESCE(NULLIF(p.metadata->>'plan', ''), 'pro_monthly') AS plan,
         COALESCE(p.transaction_id, p.metadata->>'gateway_reference') AS reference
    FROM public.payments p
   WHERE p.status = 'completed'
     AND p.metadata->>'payment_type' IN ('shop_subscription', 'subscription')
     AND p.user_id IN ('a4822b15-6559-4a84-bbd3-bcc8876064d5',   -- boutique d382eab4… (paiement du 22/10)
                       'ae93f995-1f46-497b-b75a-29c858e62b57')   -- boutique cd3c5d2b… (paiement du 11/09)
     AND NOT EXISTS (
           SELECT 1 FROM public.commission_payments c
            WHERE c.transaction_reference IN (p.transaction_id, p.metadata->>'gateway_reference')
         )
)
SELECT a.*, s.business_name, s.commission_balance_due AS solde_efface_si_applique, s.shop_payment_status
  FROM a_rattraper a
  LEFT JOIN public.shops s ON s.id = a.shop_id
 ORDER BY a.created_at;

-- ============================================================================================================
-- 3. RATTRAPAGE : rejoue apply_shop_subscription pour chaque paiement du bloc 2 (idempotent par référence :
--    relancer ce bloc ne prolonge rien une seconde fois). Décision actuelle : un mois complet À PARTIR
--    D'AUJOURD'HUI et solde de commission effacé. Pour changer, voir le guide (section « Modifier une décision »).
--    Le solde effacé est conservé dans shop_payment_events (event_type = 'subscription_activated').
--    Même filtre que le bloc 2 (copier-coller si vous le modifiez).
-- ============================================================================================================
WITH a_rattraper AS (
  SELECT p.id AS payment_id, p.created_at, p.user_id, p.amount,
         COALESCE(NULLIF(p.metadata->>'shop_id', '')::uuid,
                  (SELECT s.id FROM public.shops s WHERE s.user_id = p.user_id ORDER BY s.created_at DESC LIMIT 1)) AS shop_id,
         COALESCE(NULLIF(p.metadata->>'plan', ''), 'pro_monthly') AS plan,
         COALESCE(p.transaction_id, p.metadata->>'gateway_reference') AS reference
    FROM public.payments p
   WHERE p.status = 'completed'
     AND p.metadata->>'payment_type' IN ('shop_subscription', 'subscription')
     AND p.user_id IN ('a4822b15-6559-4a84-bbd3-bcc8876064d5',
                       'ae93f995-1f46-497b-b75a-29c858e62b57')
     AND NOT EXISTS (
           SELECT 1 FROM public.commission_payments c
            WHERE c.transaction_reference IN (p.transaction_id, p.metadata->>'gateway_reference')
         )
)
SELECT a.shop_id, a.reference,
       public.apply_shop_subscription(a.shop_id, a.user_id, a.plan, a.amount, a.reference, 'rattrapage') AS resultat
  FROM a_rattraper a
 ORDER BY a.created_at;
