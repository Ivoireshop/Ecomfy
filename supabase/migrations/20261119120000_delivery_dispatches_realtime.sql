-- Livraison : visibilité en temps réel (cahier des charges §10).
-- Les écrans marchand et structure s'abonnent aux changements de delivery_dispatches ; la table n'était pas publiée,
-- donc aucun changement n'arrivait sans rechargement. Les règles RLS s'appliquent aux événements : chacun ne reçoit
-- que les courses qu'il a le droit de lire.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime')
     AND NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'delivery_dispatches') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.delivery_dispatches;
  END IF;
END $$;
