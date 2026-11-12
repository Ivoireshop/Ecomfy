# Panne du 12/11/2026 : correctifs et opérations à faire

## Ce qui s'est passé (UTC)

Rapport complet : `docs/RAPPORT-PANNE-2026-11-12.md`. Résumé :

- Dès ~08:20, la base de prod est saturée : 173 `statement timeout` (pic 08:30-08:40), `realtime.list_changes` à 10-15 s,
  tâches pg_cron en « startup timeout ».
- Dashboard → Reports → Database : swap utilisé en continu (600-700 Mo), « Memory commitment » en alerte **Severe** (1,4 Go),
  IOwait CPU jusqu'à ~70 % avant le redémarrage. CPU global 16 %, connexions 29/60 : la base manquait de mémoire, pas de CPU.
- Redémarrage 08:45:33, arrêt resté bloqué jusqu'à 08:48:32 (reprise sur crash). Les 521/522 des logs edge sont cette
  fenêtre de 3 minutes, pas la panne initiale.
- La requête qui a consommé la mémoire n'est pas établie. Les plus coûteuses depuis le redémarrage : lecture de
  `shop_visits` (30 jours, 5 pages de 1 000) et de `orders` avec `order_items` par le tableau de bord, plus Realtime.

## 1. Front (branche `fix/panne-prod-2026-11-12`, aucune migration requise)

| Changement | Fichier |
|---|---|
| Disjoncteur + fusion des lectures identiques simultanées | `src/lib/resilientFetch.ts`, `src/integrations/supabase/client.ts` |
| Plus de relance des vérifications à chaque focus d'onglet | `src/hooks/useAuthReady.ts`, `src/components/ProtectedRoute.tsx` |
| Facturation : un chargement partagé par boutique (au lieu de 5), 2e lecture `shops` seulement si la RPC a tourné | `src/hooks/useBillingSystem.ts`, `src/lib/billingSystem.ts` |
| Tableau de bord : un seul rechargement à la fois, retour d'onglet toutes les 30 s (et non 3 s) sans relire les produits, livraisons par lots de 3 | `src/pages/ShopEditor.tsx` |
| Visites lues **uniquement** sur la page Statistiques ; ensuite seulement les nouvelles visites (toutes les 30 s) | `src/pages/ShopEditor.tsx` |

Vérifié : 297 tests, lint 0 erreur, typecheck sans nouvelle erreur. **Non testé dans un navigateur** : à faire (tableau de bord,
page Statistiques avec « Visiteurs en ce moment », bandeau de facturation, retour d'onglet).

## 2. Migration `20261112100000_cron_history_purge.sql`

Planifie une purge quotidienne (03 h 17 UTC) de `cron.job_run_details` (2 jours conservés). Cette table pèse 369 Mo (50 % de
la base) parce que la tâche n° 9 (`process-email-queue`, file d'e-mails) s'exécute toutes les 5 s. La tâche n° 9 n'est PAS modifiée.

Avant d'appliquer, vérifier l'état (lecture seule) :

```sql
select count(*), min(start_time), max(start_time), pg_size_pretty(pg_total_relation_size('cron.job_run_details'))
from cron.job_run_details;
```

Pour vider l'arriéré tout de suite (sinon la première purge de 03 h 17 supprimera tout d'un coup), en heure creuse :

```sql
delete from cron.job_run_details where end_time < now() - interval '2 days';
```

Après coup, `vacuum (analyze) cron.job_run_details;` (pas `vacuum full` : il verrouille la table pendant que la tâche n° 9 écrit).

## 3. Instance (décision à prendre, hors code)

Settings → Compute : l'instance semble être une Micro (60 connexions max). Le swap permanent plaide pour passer en **Small (2 Go)**.
Le changement redémarre la base quelques minutes : à faire en heure creuse.

## 4. Après déploiement : surveiller

- Reports → Database : le swap doit retomber, « Memory commitment » sortir de l'alerte, IOwait rester bas.
- Query Performance : la lecture `shop_visits` ne doit plus figurer en tête ; `realtime.list_changes` baisser.

## Reste ouvert

- Canaux Realtime : jusqu'à ~12 par tableau de bord (2 dans `ShopEditor`, 2 par instance de `useBillingSystem`).
- Lecture de `orders` + `order_items` : 5 pages de 1 000 à chaque rechargement explicite.
- `affiliateService.ts` (lignes 108 et 592) demande `profiles.first_name`, colonne absente en prod (erreur 42703).
- Politique RLS `orders` : `is_shop_restricted` est appelée par ligne ; non modifiée, gain non mesuré
  (`EXPLAIN (ANALYZE, BUFFERS)` d'abord).
- Le fichier `supabase_logs.json` et le log Postgres de `docs/` ne sont pas à commiter (données de prod).
