# Rapport d'incident : site indisponible le 12/11/2026

Statut : cause racine **probable**, non prouvée. Correctifs et opérations : `docs/DEPLOIEMENT-PANNE-2026-11-12.md`.

## Résumé

Le site de prod ne répondait plus ; le serveur a dû être redémarré. La base Postgres manquait de mémoire (swap permanent,
IOwait élevé) et ralentissait de plus en plus à partir de ~08:20 UTC ; le redémarrage de 08:45 a lui-même duré 3 minutes.
La requête qui a consommé la mémoire n'est pas identifiée : les logs ne contiennent pas le texte des requêtes en timeout.

## Sources analysées

| Source | Contenu | Limite |
|---|---|---|
| Logs edge/API Supabase (export de 1 000 lignes) | 08:46:51 → 09:17 UTC | Commence **après** le début de la dégradation (le pic d'erreurs a rempli l'export) |
| Logs Postgres 08 h → 09 h | 1 496 lignes | Pas de texte pour les `statement timeout` |
| Dashboard Reports → Database, Query Performance | 3 h (07:46 → 10:46) | Statistiques de requêtes remises à zéro par la reprise sur crash : valables depuis 08:48 seulement |

## Chronologie (UTC)

| Heure | Événement |
|---|---|
| 08:04 → 08:20 | Premiers `statement timeout` isolés (08:04, 08:10, 08:13). |
| 08:20 → 08:45 | Dégradation nette : 21 timeouts (08:20-08:25), 54 (08:30-08:35), 34 (08:40-08:45) ; 173 sur l'heure. |
| 08:22 → 08:35 | `realtime.list_changes` met 10 à 15 s par appel (normalement ~10 ms). |
| 08:23 → 08:44 | pg_cron : 9 × `cron job 9 job startup timeout`. |
| 08:44 | Chargement du schéma PostgREST : 10,6 s. |
| 08:45:33 | `terminating connection due to administrator command` : redémarrage demandé. |
| 08:45:35 → 08:48:32 | `the database system is shutting down` pendant 3 minutes ; reprise sur crash (`not properly shut down; automatic recovery`). |
| 08:46:51 → 08:50 | Côté edge/API : 521 (641), 522 (173), 503 (148) = la fenêtre de redémarrage, pas la panne initiale. |
| 08:49 | L'API répond de nouveau ; premiers timeouts sur `orders` + `order_items` et `delivery_payments` (cache froid). |

## Éléments établis

- **Mémoire saturée** : swap de 600-700 Mo avant le redémarrage (~430 Mo après), « Memory commitment » 1,4 Go en alerte
  Severe, IOwait CPU jusqu'à ~70 % juste avant le redémarrage.
- **Pas de saturation CPU ni connexions** : CPU global 16 %, pic de connexions 29/60.
- **Instance petite** : `shared_buffers` ≈ 224 Mo (checkpoints de ~400 buffers = 1,4 %), 60 connexions max → probablement Micro
  (à confirmer dans Settings → Compute).
- **Redémarrage à froid** : le checkpoint de 08:58 écrit 7 086 buffers (24,7 %).
- **Base alourdie par l'historique pg_cron** : `cron.job_run_details` = 369 Mo (50 % de la base). Tâche n° 9 =
  `process-email-queue` (file d'e-mails), toutes les 5 s, ~17 000 lignes d'historique par jour. `shop_visits` = 184 Mo.
- **Requêtes les plus coûteuses depuis 08:48** : `realtime.list_changes` (22 % du temps total) ; lecture de `shop_visits`
  (30 jours, 5 pages de 1 000) et de `orders` + `order_items` par le tableau de bord (~25 % cumulés ; moyenne ~175 ms, max ~5 s).
  Realtime : 37 % d'erreurs sur 24 h.

## Ce qui est une hypothèse

- Que ces lectures du tableau de bord (visites, commandes) et le nombre de canaux Realtime aient consommé la mémoire. Elles sont
  parmi les plus coûteuses, mais rien ne le prouve pour la fenêtre 08:20-08:45.
- Que la lenteur de Realtime soit un symptôme (mémoire/IO) plutôt qu'une cause.

## Facteurs aggravants côté application (corrigés dans le front)

- Un seul navigateur = 537 des 1 000 lignes du log edge (≈ 13 requêtes/s), sans repli quand l'API échoue.
- `useBillingSystem` monté 5 fois : 5 chargements complets par changement de boutique (101 lectures de `shops` en 3 min).
- Les vérifications de `ProtectedRoute` (5 requêtes) relancées à chaque focus d'onglet.
- Chaque rechargement du tableau de bord : visites (5 pages) + commandes (5 pages avec articles) + livraisons (10 requêtes
  parallèles par 1 000 commandes).
- Erreur initiale de diagnostic : `useShopPaymentStatus`, d'abord soupçonné, n'est appelé nulle part.

## Anomalies sans lien avec la panne

- 404 sur `shop_invoices` et `check_and_trigger_billing_threshold` : la migration `20261023120000` n'est pas en prod.
- 42501 `permission denied for function is_shop_restricted` : appel avec session expirée (policy RLS de `orders`).
- 42703 `profiles.first_name` : demandée par `affiliateService.ts` (lignes 108 et 592), colonne absente en prod.
- 400 sur le stockage : `avatars/landing/sellers/*.jpg` et images produit de `shop-images` (lien possible avec le durcissement
  des buckets du 07/11, non vérifié).

## Pour confirmer ou infirmer la cause

1. Instance : Settings → Compute ; passer en Small (2 Go) et comparer swap / IOwait.
2. À la prochaine dégradation : exporter les logs Postgres **avant** le redémarrage et relever `pg_stat_activity` (requêtes
   actives, mémoire) avant de redémarrer.
3. Après déploiement : Query Performance (la lecture `shop_visits` doit sortir du haut du classement) et Reports → Database.
