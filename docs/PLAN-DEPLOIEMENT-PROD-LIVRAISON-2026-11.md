# Plan de déploiement en production — chantier Livraison réseau (21/11/2026)

**Statut : plan seulement. Rien n'a été fait en production.** Établi en lecture seule à partir du dépôt (branche `jeanmarc` contre `origin/main`). **L'état réel de la prod n'a pas été lu** : l'étape 0 sert à le vérifier avant tout.

Projet de production : `yfggrceynzcwklbxhgix`. Projet de dev : `xfpbpxncserliskrbaim`.

## 1. Ce qui part en production
**16 commits** de `jeanmarc` absents de `main` :
- 14 commits Livraison (étapes A à E, répertoire et profil, visites terrain, cotisation/caution, Premium, finances, tableau de bord §3.1, e-mail §12) ;
- `a7f25ad` correctif d'interface (barre latérale, en-tête du tableau de bord) : il touche des écrans hors Livraison (`Dashboard.tsx`, `OrdersList.tsx`) ;
- `a546a7e` documentation seule.

**13 migrations**, toutes Livraison, toutes **additives** (aucune table supprimée, aucune donnée existante modifiée à l'application ; les seuls `DROP` remplacent une contrainte aussitôt recréée) :

| # | Migration | Contenu | Risque |
|---|---|---|---|
| 1 | `20261118100000_delivery_dispatch_statuses` | nouveaux statuts de course (`ALTER TYPE … ADD VALUE`) | **À passer seule**, avant la suivante : une valeur d'enum ajoutée ne peut pas servir dans la même transaction |
| 2 | `20261118110000_delivery_dispatch_flow` | transmission, acceptation, refus | faible |
| 3 | `20261118120000_delivery_company_team` | équipe de la structure, rôles | faible |
| 4 | `20261119100000_delivery_company_dispatch_shops` | filtre commerçants | faible |
| 5 | `20261119110000_delivery_driver_assignment` | affectation aux livreurs | faible |
| 6 | `20261119120000_delivery_dispatches_realtime` | temps réel des courses | faible |
| 7 | `20261119130000_delivery_admin_operations` | contrôle des opérations (admin) | faible |
| 8 | `20261120100000_delivery_directory_profile` | répertoire, profil, bucket public `delivery-logos` | moyen : crée un bucket public |
| 9 | `20261120110000_delivery_field_visits` | visites terrain, bucket privé `delivery-visits` | faible ; règle **inactive** par défaut (`require_field_visit = false`) |
| 10 | `20261120120000_delivery_fees_activation` | cotisation, caution | faible ; règle **inactive** par défaut (`require_company_activation = false`, montants à 0) |
| 11 | `20261121100000_delivery_premium` | Premium (3 250 XOF / mois par défaut) | faible |
| 12 | `20261121110000_delivery_finance` | finances admin (lecture seule) | nul |
| 13 | `20261121120000_delivery_email_channel` | file d'envoi e-mail + tâche planifiée toutes les 2 min | **moyen** : la tâche s'active dès l'application |

**2 Edge Functions** : `send-delivery-notification-emails` (nouvelle) et `send-transactional-email` (son registre de modèles a changé ; `preview-transactional-email` l'importe aussi).
**Front** : tout le reste.

## 2. Étape 0 — Vérifier l'état réel de la prod (lecture seule)
À faire **avant** toute application. Le lien du CLI change de projet : `cat supabase/.temp/project-ref` doit afficher `yfggrceynzcwklbxhgix`, sinon `supabase link --project-ref yfggrceynzcwklbxhgix`.

```sql
-- a) Quelles migrations Livraison sont déjà en prod ? (attendu : aucune des 13 ci-dessus)
select version from supabase_migrations.schema_migrations
 where version >= '20261106110000' order by version;
-- b) Prérequis : notifications (07/11), verso/localisation (09/11, « à vérifier »), invoke_edge_function
select to_regclass('public.delivery_notifications') as notifs,
       to_regprocedure('public.invoke_edge_function(text,jsonb)') as invoke_fn;
select column_name from information_schema.columns   -- verso des pièces (migration 20261109110000) : attendu 3 lignes
 where table_name in ('delivery_companies','delivery_drivers')
   and column_name in ('national_id_back_photo_url','manager_id_back_photo_url','license_back_photo_url');
-- c) Secrets Vault pour la tâche planifiée
select name from vault.decrypted_secrets where name in ('supabase_project_url','cron_secret');
-- d) Courses déjà en prod (la migration 2 ajoute des statuts à une table vivante)
select status, count(*) from delivery_dispatches group by 1;
```
**Décisions selon le résultat :**
- `20261109110000` absente en prod → l'appliquer **avant** la migration 8 (le guide Répertoire le demande).
- `20261106110000` absente → bloquant : tout le chantier en dépend.
- Secrets Vault absents → ne **pas** appliquer la migration 13 tant qu'ils ne sont pas posés (sinon la tâche appelle dans le vide ; voir `20261011120000`).
- Ne jamais appliquer `20260908170000` (volontairement exclue, voir `prod-deploy-2026-11-07`).

## 3. Ordre d'exécution
Règle constante de ce dépôt : **jamais `db push`** ; chaque migration est appliquée seule, puis `supabase migration repair --status applied <version>`. Migrations **avant** le front.

1. **Sauvegarde / retour arrière** : relire `docs/PROCEDURE-ROLLBACK-2026-10.md` (capture SQL, restauration jamais répétée). Noter l'identifiant du déploiement front actuel (retour en un clic).
2. **Étape 0** ci-dessus.
3. **Migrations 1 à 12**, une par une, dans l'ordre du tableau. Après chacune : `repair`, puis le contrôle de son guide (cf. section 4). **S'arrêter à la première erreur.**
4. **Migration 13 (e-mail)** : seulement après le point 5 ci-dessous, pour que la tâche trouve sa fonction.
5. **Edge Functions** : `supabase functions deploy send-delivery-notification-emails --use-api --project-ref yfggrceynzcwklbxhgix`, puis `send-transactional-email` de la même façon (`--use-api` : le regroupement par Docker échoue sur les chemins Windows). Vérifier que `config.toml` porte `verify_jwt = false` pour la première.
6. **Avant d'appliquer 13** : lire `EMAIL_MODE` / `EMAIL_REDIRECT_TO` en prod (`supabase secrets list`). Si `off` ou `redirect`, aucun mail réel ne partira : décider si c'est voulu.
7. **Front** : pousser `jeanmarc`, ouvrir la PR vers `main` (16 commits), fusionner, laisser le déploiement automatique faire.
8. **Contrôles et recette** (sections 4 et 5).

## 4. Contrôles par migration
- 2–3 : `select count(*) from delivery_company_staff` répond ; fonctions `delivery_dispatch_transmit` / `delivery_dispatch_accept` présentes.
- 5–7 : `delivery_dispatches` publiée en temps réel ; `delivery_admin_operations*` présentes.
- 8 : `select count(*) from storage.buckets where id='delivery-logos' and public` = 1 ; trigger `trg_guard_delivery_company_verification_profile` présent ; un compte non connecté obtient `permission denied` sur `delivery_directory_search`.
- 9 : `delivery-visits` **non public** ; `require_field_visit` = `false` ; trigger `trg_guard_delivery_company_visit_gate`.
- 10 : `require_company_activation` = `false`, montants à 0 ; trigger `trg_guard_delivery_dispatch_company_operational`.
- 11 : `delivery_settings` clé `premium_plans` = formule 3 250 XOF ; contrainte `delivery_company_payments_kind_check` accepte `premium`.
- 12 : `delivery_admin_finance_summary` et `delivery_admin_company_finance` présentes.
- 13 : `select jobname, schedule from cron.job where jobname='delivery-notification-emails'` = `*/2 * * * *` ; après une action qui notifie, `delivery_notification_outbox` passe de `pending` à `sent` en 2 minutes.

## 5. Recette en production (par les menus, comptes de test fournis par vous)
Ne faire que des actions sans effet sur de vrais clients.
1. Menu Ecomfy Livraison → tableau de bord de la structure (compteurs, activité quotidienne).
2. Répertoire des structures : recherche, badge Premium absent tant que personne n'est abonné.
3. Administration : « Opérations Livraison », « Fondation Livraison », « Cotisations livraison », « Finances livraison » s'ouvrent sans erreur ; console propre.
4. Cloche : case « Recevoir aussi par e-mail » ; un envoi test vers **une adresse interne** passe en `sent`.
5. Vérifier qu'**aucune règle bloquante n'est active** (visite obligatoire, cotisation obligatoire) : les structures existantes doivent pouvoir continuer à travailler.

## 6. Retour arrière
- **Front** : redéployer la version précédente (aucune migration ne casse l'ancien front : toutes additives).
- **E-mail** : `select cron.unschedule('delivery-notification-emails');` coupe immédiatement l'envoi ; les notifications de l'application continuent.
- **Règles** : `delivery_settings` → remettre `require_field_visit` et `require_company_activation` à `false`.
- **Migrations** : pas de retour automatique ; elles sont additives, on les laisse en place. Restauration complète = procédure de rollback (jamais répétée : à ne pas improviser).

## 7. Décisions à prendre avant de lancer
1. **E-mail** : tout notifier, ou seulement certaines natures (commandes, affectations, paiements, vérifications), ou un résumé quotidien ? (Aujourd'hui : tout, désactivable par chaque utilisateur.)
2. **Premium** : 3 250 XOF par mois est une hypothèse (5 USD à 650 XOF). La direction doit confirmer le montant et la durée (modifiables sans code dans « Cotisations livraison »).
3. **Règles d'activation** : cotisation, caution et visite terrain restent **inactives** au déploiement. Les activer est une décision séparée, après avoir saisi le barème, désigné les agents et informé les structures.
4. **PR** : elle embarque deux commits hors Livraison (barre latérale, doc Laravel). À garder ou à isoler.
5. **Créneau** : heure creuse ; la migration 2 touche un type utilisé par une table vivante.

## 8. Ce qui reste non vu (à dire à la direction)
Recettes faites sur la dev uniquement. Jamais vus à l'écran : défilement tactile des tableaux sur un vrai téléphone, ouverture du CSV dans Excel, e-mail reçu dans une vraie boîte, signatures/rendus propres à chaque client de messagerie, cas « échouées / retournées » non nuls du tableau de bord.
