# Déploiement en production du 7 novembre 2026

**Projet prod :** `yfggrceynzcwklbxhgix` · **Dev :** `xfpbpxncserliskrbaim` · **Branche :** `jeanmarc` → `main` (PR #9, fusion `f138525`) · **Fait par :** l'utilisateur, guidé pas à pas ; les requêtes SQL de contrôle ont été exécutées par lui et leurs résultats relus un à un.

Ce document est le **journal** de ce déploiement. Les guides détaillés par sujet restent la référence technique : [`DEPLOIEMENT-LIVRAISON-KYC-2026-11.md`](DEPLOIEMENT-LIVRAISON-KYC-2026-11.md), [`ECOMFY-PAY-CONNECTEURS-2026-10.md`](ECOMFY-PAY-CONNECTEURS-2026-10.md), [`H5-LIVRAISON-MISE-EN-PROD-2026-10.md`](H5-LIVRAISON-MISE-EN-PROD-2026-10.md).

## 1. Ce qui est parti

Six commits de `jeanmarc` (puis un septième, lint) :

| Commit | Contenu |
|---|---|
| `f30e663` | **Collaborateurs boutique** : l'accès total s'enregistre, « Tout cocher / Tout décocher », cartes lisibles |
| `08df5e3` | **Ecomfy Livraison** : KYC/KYB réels, permis A/B en base, journal d'audit en ajout seul, notifications, pièces dans un bucket privé, front réécrit ; durcissement du bucket `shop-assets` |
| `4a16391` | **Bucket `avatars`** : écriture limitée au dossier de l'utilisateur |
| `049cf3e` | **Boutique** : sélecteur de quantité à côté de « Confirmer ma commande » |
| `5a9e823` | **Ecomfy Pay / GeniusPay** : en-tête `Accept: application/json`, motif réel des refus, liens de paiement acceptés sous plusieurs clés |
| `5e8a149` | Guide de démonstration (docs) |
| `61ad889` | Lint : un `any` ajouté dans `ProductView.tsx` et quatre dans `verify-delivery-identity` (la CI compare à `eslint-suppressions.json`) |

## 2. Décision préalable

Le module Livraison n'existait dans aucune base de production. Le mettre en prod était une décision du fondateur ([`H5-LIVRAISON-MISE-EN-PROD-2026-10.md`](H5-LIVRAISON-MISE-EN-PROD-2026-10.md), §4) : **elle a été prise le 07/11, le module part.** Restent ouverts (voir §6) : deux circuits d'encaissement qui coexistent, politiques `UPDATE` de `delivery_dispatches` encore permissives, aucune vérification automatique (la comparaison des pièces est humaine).

## 3. Pré-contrôle en prod (lecture seule)

| Contrôle | Résultat |
|---|---|
| Migrations du lot dans l'historique | aucune |
| `delivery_companies`, `delivery_drivers` | absentes (`NULL`) |
| Types `delivery_verification_status`, `delivery_dispatch_status`, `delivery_cash_status` | absents |
| `pg_cron` | actif |
| `shop_collaborators.roles` | `ARRAY/_shop_collab_role` (enum, donc à convertir) |
| Buckets `shop-assets`, `avatars`, `delivery-kyc` | **aucun des trois n'existe** ; les 4 bonnes politiques d'`avatars` (dossier = id) existent quand même |
| Secret `RESEND_API_KEY` | présent |

## 4. Migrations appliquées (éditeur SQL, une à une, jamais `db push`)

Ordre réel, **différent de celui du guide Livraison** pour raccourcir le temps pendant lequel `shop-assets` accepte les dépôts sans compte :

| # | Migration | Contrôle fait | Résultat |
|---|---|---|---|
| 1 | `20261106100000_shop_collaborators_roles_text` | colonne, défaut, contrainte, effectifs | `ARRAY/_text`, défaut `'{}'::text[]`, contrainte `shop_collaborators_roles_valid`, **6 collaborateurs / 10 rôles avant et après** |
| 2 | `20260906010000_ecomfy_delivery_module` (corrigée) | tables et RLS | les 6 tables du module avec RLS actif |
| 3 | `20260907140000_fix_delivery_rls_and_submission` | — (enchaînée avec la suivante) | crée `shop-assets` avec dépôt ouvert, **fermé aussitôt** |
| 4 | `20261106120000_shop_assets_restrict_uploads` | bucket et politiques | `public=true`, 10 Mo, images ; 3 politiques (`insert_own_avatar`, `insert_parcel_photo`, `update_own_avatar`), plus aucune « Public upload… » |
| 5 | `20261016120000_h5_delivery_verification_guard` | déclencheur | `trg_guard_delivery_company_verification` actif (`tgenabled = O`) |
| 6 | `20261106110000_delivery_kyc_audit_notifications` | tables, déclencheurs, bucket, cron, fonctions | 4 tables ; 2 déclencheurs d'audit ; `delivery-kyc` privé ; `delivery-document-expiry 30 3 * * *` ; 5 fonctions |
| 7 | `20261106130000_avatars_restrict_uploads` | politiques `avatars` | sans effet visible (bucket absent) ; les 4 politiques d'origine intactes |

Contrôle de sécurité final : **0** politique `auth.role() = 'authenticated'` ouverte sur `delivery_drivers`, `delivery_hubs`, `delivery_companies` ; il ne reste que « Delivery drivers owner or admin ». L'éditeur SQL affiche un avertissement « destructive operations » (des `DROP POLICY`/`DROP TRIGGER IF EXISTS` suivis de leur recréation) et « tables without RLS » (faux positif : la migration active RLS elle-même, lignes 300, 367 et boucle de 913) : choisir **Run without RLS**.

Historique enregistré ensuite : `supabase migration repair --status applied 20260906010000 20260907140000 20261016120000 20261106100000 20261106110000 20261106120000 20261106130000 --project-ref yfggrceynzcwklbxhgix`.

## 5. Edge Functions et front

| Élément | Résultat |
|---|---|
| `verify-delivery-identity` | déployée, **v2**, 07/11 16:24 UTC |
| `ecomfy-pay-initiate` | déployée, **v4**, 07/11 16:24 UTC |
| `ecomfy-pay-webhook` | **non redéployée** (v3, 05/11) |
| `ecomfy-pay-withdraw` | **non redéployée** (v2, 27/10) |
| Front | PR #9 fusionnée (`f138525`) ; déploiement Vercel annoncé terminé par l'utilisateur (statut « Ready » non relu) |

`ecomfy-pay-webhook` et `ecomfy-pay-withdraw` importent le connecteur GeniusPay, mais seul l'en-tête `Accept` (lecture d'un paiement, retrait) les concerne : pas urgent.

## 6. Ce qui n'est PAS fait

- **Recette navigateur en prod du module Livraison** : non jouée (inscription livreur et société, notification administrateur, décision avec e-mail reçu). À faire avec de vrais comptes ; le parcours est dans [`DEMO-LIVRAISON-2026-11.md`](DEMO-LIVRAISON-2026-11.md) et §5 de [`DEPLOIEMENT-LIVRAISON-KYC-2026-11.md`](DEPLOIEMENT-LIVRAISON-KYC-2026-11.md).
- **`20260908170000_ensure_avatars_and_shop_assets_buckets` volontairement NON appliquée** : elle crée `shop-assets` et `avatars` avec dépôt ouvert à tous. **Ne jamais lancer `db push` en prod** : il la rejouerait, avec `20261103100000` (Studio IA) et `20261107100000` (plans d'abonnement, non commitée).
- **Bucket `avatars` absent en prod** : les photos de profil retombent sur une image `data:`. Décision à prendre (créer le bucket avec les politiques de `20261106130000`, sans passer par `20260908170000`).
- **Toujours hors prod** : plans d'abonnement et commission paramétrables (`20261107100000`, non commité, voir [`DEPLOIEMENT-PLANS-ABONNEMENT-2026-11.md`](DEPLOIEMENT-PLANS-ABONNEMENT-2026-11.md)) ; lot Studio IA (`20261103100000` + 8 fonctions, voir [`DEPLOIEMENT-STUDIO-IA-2026-11.md`](DEPLOIEMENT-STUDIO-IA-2026-11.md)) ; aiguillage de `geniuspay-webhook` ; `expire-stale-ecomfy-payments`.
- **Deux modules de livraison coexistent** (`delivery_providers` / `order_deliveries` et `delivery_companies` / `delivery_dispatches`), chacun avec son circuit d'encaissement. `DispatchOrderModal`, qui enverrait une commande à une société du nouveau module, n'est branché sur aucune page.

## 7. Retour arrière

- **Collaborateurs** : reconvertir la colonne en enum n'est pas souhaitable (les rôles `manage_catalog`, `view_stats`, `manage_customers`, `full_admin` seraient perdus) ; ne revenir en arrière que sur le front.
- **Livraison** : [`DEPLOIEMENT-LIVRAISON-KYC-2026-11.md`](DEPLOIEMENT-LIVRAISON-KYC-2026-11.md), §7. Rétablir les anciennes politiques de `delivery_drivers` rouvre un trou de sécurité : seulement avec le front précédent et sur une base où le module n'est pas utilisé.
- **Buckets** : les migrations `20261106120000` et `20261106130000` ne créent que des politiques et des plafonds ; les retirer rouvrirait le dépôt sans compte. À éviter.
- **Fonctions** : redéployer depuis le commit précédent (`git checkout 5187528 -- supabase/functions/<nom>`), puis revenir à `HEAD`.

## 8. Précaution CLI

Le lien du CLI Supabase (`supabase/.temp/project-ref`) a changé pendant l'opération : il était sur la **prod** pendant le déploiement, puis revenu sur la **dev** après. Relire le fichier avant d'agir et passer **toujours** `--project-ref` explicitement pour la prod.
