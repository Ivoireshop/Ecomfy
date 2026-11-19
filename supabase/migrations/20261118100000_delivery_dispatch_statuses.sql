-- Livraison, étape A (1/2) : nouveaux statuts de course.
-- Fichier séparé : une valeur d'enum ajoutée ne peut pas être utilisée dans la transaction qui l'ajoute.
-- Parcours cible (cahier des charges §10) : transmise -> acceptée (ou refusée) -> en préparation -> affectée ->
-- récupérée -> en cours -> livrée (ou échouée -> retournée). Les statuts historiques restent valides.
ALTER TYPE public.delivery_dispatch_status ADD VALUE IF NOT EXISTS 'transmitted';
ALTER TYPE public.delivery_dispatch_status ADD VALUE IF NOT EXISTS 'accepted';
ALTER TYPE public.delivery_dispatch_status ADD VALUE IF NOT EXISTS 'refused';
ALTER TYPE public.delivery_dispatch_status ADD VALUE IF NOT EXISTS 'preparing';
ALTER TYPE public.delivery_dispatch_status ADD VALUE IF NOT EXISTS 'failed';
ALTER TYPE public.delivery_dispatch_status ADD VALUE IF NOT EXISTS 'returned';
