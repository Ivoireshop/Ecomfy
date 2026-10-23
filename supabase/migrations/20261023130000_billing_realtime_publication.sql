-- Facturation boutique (23/10/2026) : temps réel du statut de paiement.
--
-- ShopEditor (« Boutique déverrouillée ») et useBillingSystem s'abonnent aux changements de public.shops et
-- public.shop_invoices, mais aucune migration ne les ajoutait à la publication supabase_realtime : sur dev, seule
-- `orders` y figure. Après un paiement, le marchand devait recharger la page pour voir sa boutique déverrouillée
-- ou son solde mis à jour. Le temps réel respecte la RLS : un abonné ne reçoit que les lignes qu'il peut lire.
-- Idempotent ; shop_invoices n'est ajoutée que si la table existe.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'shops') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.shops;
  END IF;
  IF to_regclass('public.shop_invoices') IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'shop_invoices') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.shop_invoices;
  END IF;
END $$;
