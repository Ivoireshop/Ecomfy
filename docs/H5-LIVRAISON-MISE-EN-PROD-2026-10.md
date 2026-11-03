# H5 : mise en production définitive (module Ecomfy Livraison)

**Date :** 30 octobre 2026 · **Projet prod :** `yfggrceynzcwklbxhgix` · **Statut :** ⚠️ H5 est corrigé dans le code, mais **non applicable en prod** tant que le module « Ecomfy Livraison » n'y est pas déployé.
**Documents liés :** [`SUIVI-LANCEMENT-ETAT-PROD-2026-10.md`](SUIVI-LANCEMENT-ETAT-PROD-2026-10.md), [`SECURITY-HOTFIX-2026-10.md`](SECURITY-HOTFIX-2026-10.md), [`PROCEDURE-ROLLBACK-2026-10.md`](PROCEDURE-ROLLBACK-2026-10.md).

---

## 1. Ce qu'est H5

| Pièce | Fichier | État en prod |
|---|---|---|
| Fonction réservée aux administrateurs | `supabase/functions/verify-delivery-identity/index.ts` | Déployée (v1, 19/10). Sans session : 401. Un appel réel échoue : elle interroge `delivery_companies` et `delivery_drivers`, absentes en prod |
| Garde contre l'auto-validation | `supabase/migrations/20261016120000_h5_delivery_verification_guard.sql` | **Non applicable** : la table `public.delivery_companies` n'existe pas (erreur `42P01`, constatée le 30/10) |
| Front (inscription, resoumission, back-office) | `DeliveryOnboardingWizard.tsx`, `DeliveryResubmissionPage.tsx`, `DeliveryAdminPage.tsx`, `src/lib/deliveryService.ts` | Déployé avec `main` (27/10), mais ses écrans appellent des tables absentes |

## 2. Cause

Deux modules de livraison coexistent dans le dépôt.

- **Ancien module (en prod) :** `delivery_providers`, `delivery_providers_public`, `delivery_company_members`, `delivery_vehicles`, `delivery_zones`, `delivery_fees`, `delivery_payments`, `delivery_driver_sessions`, `delivery_driver_zones`. Protégé : un garde sur `delivery_providers` (`20261030100000`) est actif depuis le 30/10.
- **Nouveau module « Ecomfy Livraison » (absent de la prod) :** `delivery_companies`, `delivery_hubs`, `delivery_drivers`, `delivery_dispatches`, `delivery_cash_transfers`, `delivery_company_reviews`, créés par `20260906010000_ecomfy_delivery_module.sql` puis corrigés par `20260907140000_fix_delivery_rls_and_submission.sql`. **Ces deux migrations n'ont jamais été appliquées en prod.**

Routes du front qui dépendent du nouveau module : `/delivery/register`, `/delivery/status`, `/delivery/resubmit`, `/delivery-admin`, `/delivery/partner-dashboard`, `/delivery/driver`. Tant que les tables manquent, ces écrans échouent en prod.

## 3. Bloquant : ne pas appliquer `20260906010000` telle quelle

Ses politiques d'administration reposent sur la table `profiles` (lignes 229, 264, 308, 318, 326) :

```
profiles.role IN ('admin', 'foundation', 'superadmin') OR profiles.email LIKE '%foundation%'
```

- Elles donnent un accès complet (`FOR ALL`) aux sociétés, hubs, livreurs, livraisons et transferts d'argent, y compris à tout compte dont l'e-mail contient « foundation ».
- C'est le même défaut que C7 (identité d'administrateur lue ailleurs que dans `user_roles`). Il faut réécrire ces politiques avec `has_role(auth.uid(), 'admin' | 'founder' | 'co_founder')`.
- **À vérifier :** la colonne `profiles.role` existe-t-elle en prod ? Si elle n'existe pas, la création de ces politiques échoue.
- La politique « Owners can update own delivery company » n'a aucune restriction de colonnes : un propriétaire peut modifier son propre `verification_status`. C'est ce que ferme le garde H5.

## 4. Décision préalable

Décider si le module part en prod maintenant. Les tâches de la Phase 2 « Logistique : flux commande → affectation → livraison, statuts » (5 nov.) et « Logistique : KYC/KYB, permis A/B, audit log, notifications » (6 nov.) vont dans ce sens.

- **Si oui :** suivre la section 5.
- **Si non :** masquer les routes listées en section 2 côté front, et laisser H5 en attente. La fonction déployée ne sert alors à rien et ne présente pas de risque.

## 5. Plan, dans l'ordre

| # | Étape | Où | Fait |
|---|---|---|---|
| 1 | Prendre la décision de la section 4 | fondateur | ⬜ |
| 2 | **Écrire une migration corrective** qui remplace les politiques d'administration (`profiles.role`, `LIKE '%foundation%'`) par `has_role()`, à appliquer **avant** `20260906010000` ou intégrée à une copie corrigée | dépôt | ⬜ |
| 3 | **Relire toutes les politiques du module**, notamment `delivery_dispatches` (livraisons) et `delivery_cash_transfers` (argent à la livraison) : accès croisé entre deux sociétés, entre deux boutiques, lecture publique des hubs et des avis | dépôt | ⬜ |
| 4 | **Écrire un test SQL sur base jetable** (il n'en existe aucun pour ce module ; seuls `delivery_rls_recursion*.sql` existent). Cas à couvrir : auto-validation d'un propriétaire (doit échouer avec `42501`), accès croisé entre deux sociétés, compte dont l'e-mail contient « foundation » (accès refusé), insertion avec statut `approved` forcée à `pending_verification` | `supabase/tests/` | ⬜ |
| 5 | **Pré-contrôle en prod (lecture seule)** : `profiles.role` existe-t-elle ? les types `delivery_verification_status`, `delivery_dispatch_status`, `delivery_cash_status` existent-ils déjà ? des objets en conflit existent-ils ? | éditeur SQL prod | ⬜ |
| 6 | **Appliquer en prod, une migration à la fois, dans l'éditeur SQL** (jamais `db push`) : migration corrective, `20260906010000`, `20260907140000`, puis `20261016120000` (garde) | éditeur SQL prod | ⬜ |
| 7 | Vérifier que le trigger est actif (voir section 6) | éditeur SQL prod | ⬜ |
| 8 | Vérifier les prérequis de la fonction : secret `RESEND_API_KEY` (e-mails de décision) ; rôles `admin`, `founder`, `co_founder` dans `user_roles` (présents en prod) | CLI / éditeur SQL | ⬜ |
| 9 | **Vérifier où l'assistant d'inscription enregistre les pièces d'identité** (`DeliveryOnboardingWizard.tsx`) : elles ne doivent pas être dans un bucket public (même nature que H1) | dépôt, Supabase Storage | ⬜ |
| 10 | Redéployer `verify-delivery-identity` si son code a changé (`--use-api --project-ref yfggrceynzcwklbxhgix`) | CLI | ⬜ |
| 11 | **Recette avec de vrais comptes** : voir section 7 | navigateur | ⬜ |
| 12 | Surveiller 24 à 48 h : `42501`, `forbidden`, appels à `verify-delivery-identity` | journaux | ⬜ |

## 6. Vérifications après application

```sql
-- le garde est actif (attendu : 1 ligne, tgenabled = 'O')
select tgname, tgenabled from pg_trigger
where tgrelid = 'public.delivery_companies'::regclass
  and tgname = 'trg_guard_delivery_company_verification';

-- RLS actif sur les tables du module (attendu : true partout)
select relname, relrowsecurity from pg_class
where relnamespace = 'public'::regnamespace and relkind = 'r'
  and relname in ('delivery_companies','delivery_hubs','delivery_drivers',
                  'delivery_dispatches','delivery_cash_transfers','delivery_company_reviews');

-- plus aucune politique d'administration fondée sur profiles (attendu : 0 ligne)
select tablename, policyname from pg_policies
where schemaname = 'public' and tablename like 'delivery\_%'
  and (qual ilike '%profiles.role%' or qual ilike '%foundation%' or with_check ilike '%profiles.role%');

-- aucun droit anon sur ces tables, hors lecture publique voulue (à relire ligne par ligne)
select table_name, privilege_type from information_schema.role_table_grants
where table_schema = 'public' and grantee = 'anon' and table_name like 'delivery\_%';
```

## 7. Recette (comptes de test, montants minimaux)

| Cas | Attendu |
|---|---|
| Un utilisateur crée une société (`/delivery/register`) | Ligne créée en `pending_verification`, sans badge |
| Le propriétaire tente de passer sa société en `approved` (API directe) | Refus `42501` |
| Le propriétaire tente de modifier `trust_badge_active`, `verified_at`, `verified_by`, `admin_notes` | Refus `42501` |
| Le propriétaire resoumet un dossier rejeté (`pending_verification`) | Accepté, jamais depuis `approved` |
| Appel de `verify-delivery-identity` sans session | 401 |
| Appel par un utilisateur sans rôle admin / founder / co_founder | 403 |
| Décision d'un administrateur (approuver, rejeter) | Statut mis à jour, e-mail envoyé |
| Une société lit les livraisons ou les transferts d'argent d'une autre société | 0 ligne |
| Un compte dont l'e-mail contient « foundation » | Aucun accès administrateur |

## 8. Retour arrière

- Les migrations créent de nouvelles tables : un retour arrière consiste à supprimer le trigger et la fonction du garde, puis les politiques corrigées. Les tables elles-mêmes peuvent rester vides sans effet sur l'ancien module.
- Capturer l'état de la base avant (voir [`PROCEDURE-ROLLBACK-2026-10.md`](PROCEDURE-ROLLBACK-2026-10.md)).
- Le front est déjà déployé : le retour arrière ne le concerne pas.

## 9. Constats de cette session (30/10/2026)

- `delivery_providers` : un propriétaire pouvait modifier `is_verified` et `is_recommended` (insertion et mise à jour sans restriction de colonnes). Une seule fiche vérifiée existait (DLK Services, `user_id` nul, fiche de la plateforme) : aucun abus. Garde `20261030100000` appliqué en prod, trigger `trg_guard_delivery_provider_verification` actif.
- Les politiques du nouveau module n'ont pas été relues dans le détail (étape 3).
