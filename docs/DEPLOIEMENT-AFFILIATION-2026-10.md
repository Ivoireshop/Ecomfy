# Affiliation : correctifs du flux et déploiement (21 octobre 2026)

**Projet de production :** `yfggrceynzcwklbxhgix` · **Dev :** `xfpbpxncserliskrbaim`
**Contexte :** vérification du flux d'affiliation (inscription, rattachement du filleul, commission, versement). Prolonge H6 (`20261017120000`). Guides liés : [`DEPLOIEMENT-COMPLET-2026-10.md`](DEPLOIEMENT-COMPLET-2026-10.md) (phase 4, ligne B2 ; phase 5, section 8), [`DEPLOIEMENT-PROD-2026-10.md`](DEPLOIEMENT-PROD-2026-10.md).

---

## 1. Ce qui a été corrigé

| # | Défaut constaté | Correctif | Fichiers |
|---|---|---|---|
| 1 | **Les commissions n'étaient presque jamais créées.** Seul `verify-payment` appelait `process_affiliate_commission_for_payment`, et il sortait avant l'appel dès que le webhook avait déjà validé le paiement ; `geniuspay-webhook` et `reconcile-pending-payments` ne l'appelaient pas | L'appel (idempotent) est fait dans le webhook (fin de traitement, paiement déjà complété, abonnement déjà appliqué), dans `reconcile-pending-payments` et avant chaque sortie anticipée de `verify-payment` | `supabase/functions/geniuspay-webhook`, `verify-payment`, `reconcile-pending-payments` |
| 2 | Les inscriptions **Google** n'étaient jamais rattachées (le retour OAuth va sur `/dashboard`, le rattachement n'était joué que sur `/auth`) | Hook global joué après toute connexion | `src/hooks/useAffiliateReferralSync.ts`, `src/App.tsx` |
| 3 | Le parrain était **perdu** si l'email de confirmation s'ouvrait sur un autre appareil | Le code est aussi envoyé dans les métadonnées du `signUp` (`referral_code`), lu en dernier recours puis effacé | `src/pages/Auth.tsx`, `src/services/affiliateService.ts` |
| 4 | Un code saisi à la main pouvait être ignoré au profit de celui d'un ancien lien | Priorité : code saisi pour cet email, puis dernier lien ouvert, puis métadonnées du compte | `src/pages/Auth.tsx`, `src/services/affiliateService.ts` |
| 5 | Un code refusé définitivement restait en `localStorage` et était renvoyé à chaque connexion | `recordReferralDetailed` distingue refus définitif (code soldé) et panne transitoire (code gardé) | `src/services/affiliateService.ts` |
| 6 | Faux profil d'affilié renvoyé si la RPC échouait (lien sans effet, enregistrement du moyen de paiement en erreur) | Renvoie `null`, message d'erreur dans `/affiliate`, faux lien `ECOMFY-…` supprimé | `src/services/affiliateService.ts`, `src/pages/AffiliateSpace.tsx` |
| 7 | `mark_affiliate_payout_paid` acceptait n'importe quel montant, soldait aussi les commissions `PENDING`, sans verrou | Montant = somme exacte des commissions `PAYABLE`/`APPROVED` visées ; verrou de lignes ; `PENDING` jamais soldées | `supabase/migrations/20261020120000_…sql` |
| 8 | `process_referral_signup` (ancien parrainage par crédits) acceptait un `referred_user_id` choisi par l'appelant | Le filleul doit être `auth.uid()`, une seule fois, jamais son propre code, réservation atomique | `supabase/migrations/20261020120000_…sql` |

Le seuil de 10 000 FCFA reste **indicatif** (badge dans l'écran fondateur) : il n'est pas imposé en base, pour ne pas empêcher un versement volontaire plus bas.

## 2. Ce qui a été testé

**Sur dev, le 21/10/2026** (migration `20261020120000` appliquée dans l'éditeur SQL) :

- Navigateur : lien `/auth?ref=…` mémorisé et prérempli ; profil de parrain créé (code `PARRAIN-TEST-AFFIL-003A`, 20 %) ; filleul connecté **avec le stockage du navigateur vidé** : une seule ligne de parrainage créée, métadonnée effacée ; le parrain voit « Mes Filleuls (1) ».
- SQL, transaction annulée à la fin (aucune donnée laissée) : auto-parrainage et code inconnu refusés ; rejeu = `already_referred` ; commission 12 000 FCFA = 2 400 FCFA, rejeu sans doublon, paiement de type crédits non éligible ; versement refusé avec un montant faux, accepté avec le montant exact (`PENDING` laissée), second versement refusé, non-fondateur refusé ; remboursement après versement journalisé ; ancien parrainage : usurpation, propre code et rejeu refusés, cas légitime +3 crédits au parrain et +2 au filleul.

**Non testé (à faire, voir section 3) :** les trois Edge Functions modifiées (non déployées sur dev) ; la connexion Google ; un webhook GeniusPay signé.

## 3. Reste à faire pour clore

| # | Action | Bloquant pour la prod ? |
|---|---|---|
| 1 | Déployer `geniuspay-webhook`, `verify-payment`, `reconcile-pending-payments` sur **dev**, envoyer un webhook GeniusPay signé de test pour un abonnement du filleul, vérifier qu'une commission de 20 % apparaît dans `/affiliate` **sans** passer par `verify-payment` | **Oui** : c'est le correctif n° 1, jamais exécuté de bout en bout |
| 2 | Tester la connexion Google avec un vrai compte Google (même hook que le mot de passe, mais chemin non vérifié) | Non, mais à faire |
| 3 | **Production : vérifier que le trigger `handle_new_user` existe sur `auth.users`.** Sur dev il n'y a aucun trigger sur `auth.users` : une inscription ne crée ni profil, ni rôle, ni abonnement, ni ligne de parrainage (3 comptes dev sans profil) | **Oui** (voir la requête en 4.1) |
| 4 | Nettoyer les comptes de test sur dev (requête en 6) | Non |
| 5 | Imposer le seuil de 10 000 FCFA en base si on le souhaite | Non (décision) |
| 6 | Écrire de vrais tests automatisés : `src/test/affiliateSystemTest.test.ts` ne contient aucune suite exécutable | Non |
| 7 | Le formulaire d'inscription de dev est limité par le SMTP intégré de Supabase (`email rate limit exceeded`) : pour tester, créer l'utilisateur dans Authentication > Users > Add user (auto-confirmé) | Non |

## 4. Déploiement en production

> **À jouer par vous, jamais automatiquement.** « Deploy to production » de l'intégration GitHub de Supabase doit rester **désactivé** (Project Settings > Integrations > GitHub) : un push n'applique rien.
> Ne pas utiliser `supabase db push` (il pousserait d'autres migrations en attente). Utiliser l'éditeur SQL de la production, ou `npx supabase db query --linked -f <fichier>` après avoir vérifié que le projet lié est bien `yfggrceynzcwklbxhgix`.

### 4.1 Pré-contrôles (éditeur SQL de la production, lecture seule)

```sql
-- État de l'affiliation en prod
select to_regclass('public.affiliates') as affiliates,                  -- NULL = les deux migrations H6 sont à appliquer aussi
       to_regprocedure('public.get_or_create_my_affiliate(text)') as rpc_profil,   -- NULL = 20261017120000 non appliquée
       (select pg_get_functiondef('public.mark_affiliate_payout_paid(uuid,numeric,text,text,text,text)'::regprocedure) like '%ne correspond pas%') as migration_20261020_appliquee;

-- Triggers de création de compte (attendu : au moins un trigger qui appelle handle_new_user)
select tgname, tgenabled from pg_trigger where tgrelid = 'auth.users'::regclass and not tgisinternal;
select count(*) as comptes_sans_profil from auth.users u where not exists (select 1 from public.profiles p where p.id = u.id);
```

- Si `affiliates` est `NULL` (cas attendu : en prod, les tables d'affiliation n'existaient pas au 19/10/2026), appliquer **les trois migrations** dans l'ordre, dans une seule transaction (4.2).
- Si H6 est déjà appliqué, n'appliquer que `20261020120000`.
- Si la requête des triggers ne renvoie rien ou si `comptes_sans_profil` n'est pas 0, **s'arrêter et traiter ce point d'abord** : les nouveaux inscrits n'auraient pas de profil.

### 4.2 Base : migrations

Une seule transaction, sinon `20261005160000` seule crée des politiques d'insertion ouvertes (voir B2 de `DEPLOIEMENT-COMPLET-2026-10.md`). PowerShell, depuis `C:\dev\Ecomfy` :

```powershell
Get-Content supabase\migrations\20261005160000_ecomfy_affiliate_system.sql,
            supabase\migrations\20261017120000_h6_affiliate_rls_rpc_hardening.sql,
            supabase\migrations\20261020120000_affiliate_payout_and_legacy_referral_hardening.sql |
  Set-Content -Encoding utf8 $env:TEMP\affiliate_prod.sql
# coller le contenu de $env:TEMP\affiliate_prod.sql dans l'éditeur SQL, entouré de begin; ... commit;
```

Si H6 est déjà en place, coller seulement `20261020120000_affiliate_payout_and_legacy_referral_hardening.sql` (idempotente : `CREATE OR REPLACE`).

Les anciens fronts appellent encore l'insertion directe du profil d'affilié et `record_affiliate_referral(uuid, text)` : **enchaîner avec le front** (4.4) dans la foulée.

Vérification après la base :

```sql
select p.proname, has_function_privilege('anon',p.oid,'execute') anon, has_function_privilege('authenticated',p.oid,'execute') auth, has_function_privilege('service_role',p.oid,'execute') svc
from pg_proc p where pronamespace='public'::regnamespace
  and proname in ('record_affiliate_referral','process_affiliate_commission_for_payment','reverse_affiliate_commission_for_payment','get_or_create_affiliate','get_or_create_my_affiliate','mark_affiliate_payout_paid','process_referral_signup')
order by 1;
-- attendu : process_affiliate_commission_for_payment, reverse_affiliate_commission_for_payment, get_or_create_affiliate = service_role seul ;
-- record_affiliate_referral, get_or_create_my_affiliate, mark_affiliate_payout_paid, process_referral_signup = authenticated + service_role, jamais anon

select tablename, policyname, cmd from pg_policies where tablename in ('affiliates','affiliate_referrals') order by 1,2;
-- attendu : aucune politique INSERT
```

### 4.3 Edge Functions (après la base)

```powershell
npx supabase@latest login
$P = "yfggrceynzcwklbxhgix"
foreach ($f in "geniuspay-webhook","verify-payment","reconcile-pending-payments") {
  Write-Host "### $f"
  npx supabase@latest functions deploy $f --project-ref $P --use-api
}
```

`--use-api` est nécessaire sous Windows (le bundling Docker échoue). Vérifier que `GENIUSPAY_WEBHOOK_SECRET`, `GENIUSPAY_API_KEY` et `GENIUSPAY_API_SECRET` sont définis en production (`npx supabase@latest secrets list --project-ref $P`).

### 4.4 Front

Suivre la section 8.2 de `DEPLOIEMENT-COMPLET-2026-10.md` : déployer le build Vercel **sans le promouvoir**, appliquer la base (4.2), puis promouvoir. Le front contient le hook `useAffiliateReferralSync`, le `signUp` avec `referral_code` et le nouveau `AffiliateSpace`.

### 4.5 Tests à jouer en production (comptes jetables, une vraie adresse email)

1. Compte parrain : ouvrir `/affiliate`, noter le lien `/auth?ref=…`.
2. Compte filleul créé via ce lien (navigation privée), email confirmé **sur un autre navigateur** : le parrain voit « Mes Filleuls (1) ».
3. Même test avec « Continuer avec Google » (non testé avant la production).
4. Premier abonnement payé par le filleul (petit montant réel) : une commission de 20 % apparaît chez le parrain, que le filleul revienne ou non sur le site après paiement. Vérifier les journaux de `geniuspay-webhook` (pas d'avertissement `Affiliate commission`).
5. Écran fondateur, onglet Affiliés : versement avec un montant faux (refus attendu), puis montant exact (accepté), puis rejeu (refus attendu).
6. Marchand non fondateur : `rpc/process_affiliate_commission_for_payment` et `rpc/mark_affiliate_payout_paid` refusés (42501 / « Accès refusé »).

## 5. Retour arrière

- **Front :** Vercel > Deployments > « Instant Rollback ». Attention : après H6, l'ancien front ne peut plus créer de profil d'affilié.
- **Edge Functions :** redéployer la version précédente depuis le commit parent (`git stash` ou `git checkout <commit> -- supabase/functions/<fonction>`, puis `functions deploy`). Les appels ajoutés étant idempotents et non bloquants, les laisser en place est sans danger.
- **`mark_affiliate_payout_paid` :** rejouer sa définition de `20261005160000` (fonction « Founder Manual Payout »), puis les lignes `ALTER FUNCTION … SET search_path`, `REVOKE` et `GRANT` de la section 8 de `20261017120000`.
- **`process_referral_signup` :** rejouer sa définition de `20251106194751` (fonction « process referral signup ») ; ses droits d'origine étaient ouverts à `PUBLIC`, ce qui est la faille corrigée : ne le faire que si le front l'exige.

## 6. Données de test à nettoyer sur dev

Comptes créés le 21/10/2026 : `johnmarkus00+aff-parrain@gmail.com` et `johnmarkus00+aff-filleul@gmail.com`. La suppression d'un compte dans Authentication > Users supprime en cascade son profil d'affilié et sa ligne de parrainage. Relire avant de lancer :

```sql
select id, email from auth.users where email in ('johnmarkus00+aff-parrain@gmail.com', 'johnmarkus00+aff-filleul@gmail.com');
-- puis, dans Authentication > Users, supprimer ces deux comptes
select count(*) from public.affiliate_referrals where referral_code_used = 'PARRAIN-TEST-AFFIL-003A';  -- attendu : 0 après suppression
```
