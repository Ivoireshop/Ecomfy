# C4 : KYC marchand, écran de revue et déploiement (octobre 2026)

**Public :** la personne qui déploie et qui ouvre les retraits d'Ecomfy Pay.
**Constat corrigé :** C4 de `AUDIT-PROJET-2026-10.md` (KYC factice : tout le monde « VERIFIED »).
**État au 12 octobre 2026 :** corrigé dans le code et les migrations, testé en local, **non déployé** (ni dev, ni production). Les retraits sont suspendus par défaut.

## 1. Ce qui a changé

| Élément | Avant | Maintenant |
|---|---|---|
| `evaluate_merchant_kyc_security` | Passait tout dossier en `VERIFIED`, score de visage fixé à 95, ouverte à `anon` | **Supprimée** (toutes signatures) |
| Écriture du statut KYC | Le marchand pouvait écrire `verification_status` (politique RLS sans restriction de colonnes) | Trigger `merchant_kyc_guard_review_columns` : pour `anon` / `authenticated`, les colonnes de décision sont ignorées. Un nouveau dossier est toujours `PENDING`. Changer une pièce d'un dossier déjà décidé le repasse en `PENDING`. |
| Décision | Aucune | `review_merchant_kyc(p_user_id, p_decision, p_reason)` : `service_role` ou fondateur / co-fondateur, jamais sur son propre dossier, motif obligatoire pour un rejet |
| Retraits | Dépendaient du statut KYC seul | Interrupteur `ecomfy_pay_settings.withdrawals_enabled`, **`false` à la création**, puis statut `VERIFIED` requis |
| Lecture des dossiers | Chacun voit le sien | Politique « Founders view all KYC » : fondateurs et co-fondateurs voient tout |
| Interface | Appelait l'ancienne RPC, annonçait une « analyse automatique » | Dépose le dossier en `PENDING`, annonce un examen manuel ; écran de revue pour les fondateurs |

Fichiers : `supabase/migrations/20260914190000_ecomfy_pay_system.sql` (politiques, interrupteur, retrait), `supabase/migrations/20260914200000_ecomfy_pay_enhanced.sql` (trigger, suppression de l'ancienne RPC, `review_merchant_kyc`), `supabase/deploy-dev/02_c1_wallet_dev.sql` (copie pour dev, avec l'adaptation `payment_links`), `src/pages/founder/KycReview.tsx`, `src/components/AppSidebar.tsx`, `src/App.tsx`.

`is_corporate_founder()` est redéfinie dans `20260914190000` (même corps que dans le hotfix `20261012120000`, `CREATE OR REPLACE`) : sans cela, un rejeu des migrations dans l'ordre des horodatages échouerait à la création de la politique.

## 2. L'écran de revue

- **Adresse :** `/founder/kyc-review`. Menu : Administration > « Revue KYC ».
- **Contenu :** onglets À examiner (avec compteur), Validés, Rejetés, Pièces redemandées, Tous ; recherche par nom, téléphone, numéro de pièce ou identifiant ; fiche avec informations déclarées, recto, verso, selfie (clic pour agrandir) ; boutons Valider, Rejeter, Redemander des pièces. Le motif est obligatoire pour les deux derniers et il est montré au marchand.
- **Accès :** la route est protégée par `FounderRoute`, qui laisse aussi entrer `shareholder` et `admin`. Le serveur, lui, n'accepte que `founder` et `co_founder` : un actionnaire voit l'écran, ses décisions sont refusées.
- **Limites :** pas d'e-mail du marchand (absent de la table) ; les images sont affichées par leur URL publique actuelle (voir H1, section 6).

## 3. Ce qui a été testé

| Test | Résultat |
|---|---|
| `supabase/tests/c4_kyc_review.sql` sur base Postgres jetable, migrations d'origine | 18 cas sur 18 |
| Même test après `deploy-dev/02_c1_wallet_dev.sql` | 18 cas sur 18 |
| Navigateur (Chrome), application locale contre un **faux** serveur Supabase : liste, fiche, rejet sans motif (aucun appel), rejet avec motif, validation, onglet Tous | Conforme |

Les 18 cas couvrent : fonction supprimée ; dossier déposé avec `VERIFIED` ramené à `PENDING` ; `UPDATE` du statut ignoré ; retrait refusé interrupteur coupé ; interrupteur illisible et non modifiable par un marchand ; retrait refusé avec KYC `PENDING` ; `review_merchant_kyc` refusée à un marchand et à `anon` ; rejet sans motif refusé ; validation par un fondateur ; fondateur qui valide son propre dossier refusé ; retrait accepté après validation ; changement de pièce qui annule la validation ; dossier d'un autre intouchable ; fondateur qui lit tous les dossiers, marchand qui n'en lit aucun.

**Non testé :** le déploiement sur une vraie base Supabase (rôles et droits par défaut réels) ; l'écran contre une vraie base ; « Pièces redemandées » dans le navigateur ; l'affichage sur téléphone.

## 4. Déploiement sur dev

Un seul fichier, `supabase/deploy-dev/02_c1_wallet_dev.sql`, déjà décrit à la section 6 de `docs/DEPLOIEMENT-DEV-2026-10.md`. Il contient désormais le correctif C4. Rappels :

1. Non idempotent (`CREATE POLICY`) : une seule exécution ; en cas d'échec tout est annulé. Si le système Ecomfy Pay est déjà en place sur dev avec l'ancienne version, partir de `99_rollback.sql` (section 4 : destructif pour ces tables) ou restaurer le snapshot.
2. Front : déployer la branche (écran + menu).
3. Edge Function `ecomfy-pay-withdraw` : inchangée, mais à déployer si elle ne l'est pas (`--use-api` sous Windows).
4. Vérifier (section 7). Les retraits restent suspendus : pour tester un retrait sur dev, passer l'interrupteur à `true` (section 8), faire valider un compte jetable par un compte fondateur jetable, puis le retirer.

## 5. Déploiement en production

**Ne pas appliquer `deploy-dev/02` en production** : il retire la gestion de `payment_links` pour dev. En production, ce sont les migrations d'origine qui s'appliquent, et seulement quand les prérequis ci-dessous sont remplis.

### 5.1 Prérequis (bloquants)

| # | Prérequis | Pourquoi | Où |
|---|---|---|---|
| 1 | Snapshot de la base (ou point de restauration) | Retour arrière | Tableau de bord Supabase |
| 2 | Vérifier que le système n'est pas déjà en base : `select to_regclass('public.merchant_kyc'), to_regclass('public.wallets'), to_regclass('public.withdrawal_requests');` | Les migrations créent ces tables. Si l'une existe, ne rien lancer : il y a des données et un autre chemin (migration de correction à écrire) | Éditeur SQL |
| 3 | Hotfix et compléments appliqués : `20261012120000`, `130000`, `140000`, `150000`, `160000` | `review_merchant_kyc` s'appuie sur `user_roles` et `is_corporate_founder()` ; sans `160000`, la lecture de `user_roles` échoue par récursion RLS | `docs/SECURITY-HOTFIX-2026-10.md` |
| 4 | Conflit `payment_links` résolu | La production a probablement la table de liens de **cours** (`course_id`, `provider`, `payment_url`). Vérifier : `select column_name from information_schema.columns where table_name='payment_links';`. Les index et politiques Ecomfy Pay sur `shop_id` / `link_key` feraient échouer toute la migration | Audit C1 ; `DEPLOIEMENT-DEV` section 6 |
| 5 | C5 (signature du webhook `ecomfy-pay-webhook`) et C6 (montants recalculés côté serveur) corrigés et déployés | Sans eux, un paiement peut être falsifié et crédité sur le portefeuille, indépendamment du KYC | Audit C5, C6 |
| 6 | Tâches planifiées et appels de RPC par clé `anon` vérifiés | Ils échouent en 42501 après le durcissement | `DEPLOIEMENT-DEV` section 9 |

Tant que 4 et 5 ne sont pas faits, **C4 n'est pas déployable seul** : il vit dans les mêmes migrations que le reste d'Ecomfy Pay.

### 5.2 Ordre

1. **Edge Functions** : `ecomfy-pay-webhook` et `ecomfy-pay-initiate` (corrigées en C5 / C6), `ecomfy-pay-withdraw`.
2. **Front** : branche contenant l'écran de revue, le menu et le formulaire KYC modifié. Tant que la base n'est pas migrée, l'écran de revue affiche une erreur de chargement (table absente) et le formulaire KYC échoue à l'envoi : sans conséquence, la fonctionnalité n'est pas encore ouverte.
3. **Base** : dans l'éditeur SQL, **dans cet ordre, une fois chacun**, sans `supabase db push` :
   1. `supabase/migrations/20260914190000_ecomfy_pay_system.sql`
   2. `supabase/migrations/20260914200000_ecomfy_pay_enhanced.sql`
   Entourer chaque fichier de `begin;` … `commit;` : en cas d'erreur, `rollback;` et rien n'est appliqué (les migrations ne sont pas idempotentes, un rejeu partiel échouerait sur `CREATE POLICY`). Ne pas se fier à un comportement implicite de l'éditeur.
4. **Vérifier** (section 7). **Laisser les retraits suspendus.**
5. **Mettre en place la revue** : au moins un fondateur ou co-fondateur doit avoir le rôle dans `user_roles` et ouvrir `/founder/kyc-review`.
6. **Ouvrir les retraits** : section 8.

### 5.3 Après le déploiement

- Les marchands existants n'ont aucun dossier : ils voient « Non transmis ». Aucun n'est validé d'office.
- Premier dossier réel : le faire examiner sur l'écran, vérifier que l'état passe à « Validé » côté marchand, **avant** d'ouvrir les retraits.
- Surveiller les journaux de la fonction `ecomfy-pay-withdraw` et les lignes `withdrawal_requests` à `REQUESTED` (aucun envoi de paiement n'est déclenché par la RPC seule).

## 6. Ce qui reste hors périmètre

- **H1 : pièces d'identité dans un bucket public.** Les dossiers pointent sur `shop-images/kyc/...`, lisible par quiconque a l'URL. Le correctif propre : bucket privé dédié, politiques de stockage (marchand : dépôt de ses propres fichiers ; fondateur : lecture), liens signés temporaires dans l'écran de revue, migration des fichiers existants. **À faire avant d'accepter de vrais dossiers.**
- **Prestataire KYC externe** : non choisi. Un prestataire appellerait `review_merchant_kyc` avec `service_role` (webhook), sans changement de schéma. Dans ce cas, `verified_by` reste vide pour ces décisions.
- **Journal des décisions** : seuls `verified_by`, `verified_at` et `rejection_reason` sont conservés ; il n'y a pas d'historique. À ajouter si la conformité l'exige.
- **Types TypeScript** : `src/integrations/supabase/types.ts` ne connaît pas `merchant_kyc`, `wallets` ni leurs RPC (erreurs `tsc` préexistantes sur `ecomfyPay.ts`) ; régénérer les types après déploiement.

## 7. Vérifications après déploiement (lecture seule, éditeur SQL)

```sql
-- 1. L'ancienne fonction n'existe plus : attendu 0
select count(*) from pg_proc where proname = 'evaluate_merchant_kyc_security';

-- 2. Trigger de protection présent : attendu 1
select count(*) from pg_trigger where tgname = 'merchant_kyc_guard_review_columns' and not tgisinternal;

-- 3. Interrupteur : attendu false à ce stade
select value from public.ecomfy_pay_settings where key = 'withdrawals_enabled';

-- 4. Droits d'exécution : review_merchant_kyc ne doit pas être ouverte à anon / PUBLIC
select grantee, privilege_type from information_schema.routine_privileges
where routine_name = 'review_merchant_kyc' order by grantee;   -- attendu : authenticated, postgres, service_role (ni anon, ni PUBLIC)

-- 5. Politiques de merchant_kyc : attendu 4 (Users view own, Founders view all, Users insert own, Users update own)
select policyname, cmd from pg_policies where tablename = 'merchant_kyc' order by policyname;

-- 6. Aucun dossier déjà « VERIFIED » : attendu 0 (système neuf)
select count(*) from public.merchant_kyc where verification_status = 'VERIFIED';
```

Tests applicatifs (comptes jetables, jamais de vrais marchands) : déposer un dossier depuis `/ecomfy-pay?tab=kyc` (doit rester « Examen en cours ») ; depuis un compte fondateur, `/founder/kyc-review` doit le lister ; valider ; côté marchand le statut passe à « Compte vérifié ». Un compte non fondateur qui ouvre `/founder/kyc-review` voit « Accès restreint ».

Le script `supabase/tests/c4_kyc_review.sql` s'exécute **uniquement sur une base jetable** (il crée des utilisateurs et écrit dans les tables). Mode d'emploi dans son en-tête.

## 8. Ouvrir (et refermer) les retraits

À faire seulement quand : la revue fonctionne (section 5.3), H1 est traité ou le risque est accepté par écrit, C5 et C6 sont en production.

```sql
-- Ouvrir
update public.ecomfy_pay_settings set value = 'true'::jsonb, updated_at = now() where key = 'withdrawals_enabled';

-- Suspendre à nouveau (incident, fraude suspectée)
update public.ecomfy_pay_settings set value = 'false'::jsonb, updated_at = now() where key = 'withdrawals_enabled';
```

L'effet est immédiat, sans redéploiement. Les demandes déjà enregistrées (`REQUESTED`) ne sont pas annulées. Seuls le propriétaire de la base, `service_role` et l'éditeur SQL peuvent modifier cette ligne ; les marchands n'y ont ni lecture ni écriture.

## 9. Retour arrière

- **Préféré :** restaurer le snapshot de l'étape 5.1.
- **Refermer seulement les retraits :** section 8, deuxième requête.
- **Retirer le correctif :** il n'y a pas de bonne raison de restaurer `evaluate_merchant_kyc_security` (c'est la faille). Pour retirer tout Ecomfy Pay d'un environnement neuf, voir `supabase/deploy-dev/99_rollback.sql` section 4 (destructif).
