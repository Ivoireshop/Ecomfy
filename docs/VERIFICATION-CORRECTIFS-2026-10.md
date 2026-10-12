# Vérification des correctifs de sécurité d'octobre 2026

**Date :** 12 octobre 2026. **Branche :** `jeanmarc` (HEAD `1c809d0` au début ; les fichiers de déploiement et de test ajoutés pendant la vérification ne sont pas encore committés).
**Périmètre :** vérifier que C1, C2, C3, C7, C8 et H11 sont corrigés dans le code et dans les migrations, puis sur la base **dev** (copie de la production) après déploiement.

**Déroulé :** (1) vérification du code et rejeu des migrations sur une base locale jetable (sections 3 et 4) ; (2) constat de l'état réel de dev avant déploiement (section 5) ; (3) déploiement sur dev par l'utilisateur selon `docs/DEPLOIEMENT-DEV-2026-10.md` : Edge Functions, front, `supabase/deploy-dev/01_c2_c3_security.sql`, puis `04_user_roles_rls.sql` (nouveau correctif trouvé pendant les tests) ; (4) tests après déploiement : SQL en lecture seule, script HTTP avec de vrais JWT, navigateur, écritures (sections 10 à 10.2). **Les sections 5, 6, 7 et 9 décrivent l'état au moment de chaque test ; l'état final est dans la section 1 ci-dessous.**

Documents liés : `AUDIT-PROJET-2026-10.md` (constats et annexes), `docs/SECURITY-HOTFIX-2026-10.md` (hotfix), `docs/DEPLOIEMENT-DEV-2026-10.md` (déploiement sur dev), `supabase/deploy-dev/` (scripts), `supabase/tests/` et `scripts/verify-dev-security.mjs` (tests rejouables).

---

## 1. Synthèse : état final sur dev

| Point | Verdict | Preuve |
|---|---|---|
| C1 : portefeuille (droits des fonctions, retrait par `auth.uid()`) | Corrigé dans le code et les migrations. **Non déployé sur dev** (fichier 02 optionnel non appliqué : tables et fonctions de portefeuille absentes, 404). Validé **en local seulement**. | Section 4.2, tests 11 à 21 et 39 à 45 |
| C2 : RPC de facturation, d'activation et serveur réservées à `service_role` | **Corrigé et appliqué sur dev.** Les 5 RPC en `service_role` seul, lot de 16 fonctions serveur : 0 exposition. Edge Functions `founder-*` déployées. Écritures testées dans l'interface (activation et paiement manuels). | Sections 10, 10.2 ; script HTTP |
| C3 : contrôle de propriété sur `get_shop_orders_secure` | **Corrigé et appliqué sur dev.** Marchand tiers : `forbidden` ; anonyme : refusé ; fondateur : autorisé. Aucun écran ne l'appelle : elle protège l'API directe. | Script HTTP, section 10.2 ; 19 tests locaux |
| C7 : `manage-founder-roles` + RLS de `user_roles` | **Corrigé et appliqué sur dev** : fonction (403 marchand, 200 fondateur, formulaire de nomination absent pour un co-fondateur) et correctif RLS `04` (la récursion HTTP 500 est résolue ; plus d'écriture directe pour `authenticated`). Nomination et révocation par le fondateur principal : non testées. | Sections 10, 10.1, 10.2 |
| C8 : `tracking.ts` n'accepte que `G-XXXX` | **Corrigé.** Identifiant piégé refusé dans l'interface, valide accepté et sauvegardé ; 6 tests Node ; test du vrai `tracking.ts` avec un DOM simulé. Vitrine publique avec pixels : non testée dans un navigateur. | Sections 4.4 et 10.2 |
| H2 : gouvernance `corporate_*` | **Corrigé et appliqué sur dev** (30 politiques, 2 permissives voulues). Fondateur et co-fondateur lisent ; marchand et anonyme : rien. | Sections 5.2, 10.1 ; script HTTP |
| H11 : deux projets Supabase mélangés | Corrigé côté dépôt, confirmé dans le navigateur (aucune requête vers la production). Reste une URL de production dans la migration `20260813104500`. | Sections 7 et 9 |
| Annexe B sur la base réelle | **Faite sur dev, pas sur la production.** | Section 5.2 |
| Journaux Supabase | **Non fait.** | Section 2 |

Script HTTP final (comptes jetables) : **42 réussis, 6 échecs** ; les 6 échecs sont les fonctions de portefeuille de C1 (absentes de dev). Reste ouvert, non couvert par ces correctifs : groupe B de l'annexe F.3, `corporate_invitations`, e-mails en dur côté interface (section 6).

---

## 2. Ce qui n'a pas été fait, et ce qu'il faut pour le faire

**Accès utilisés :** clé `anon` du `.env` (projet dev) ; session Supabase ouverte dans le Chrome de l'utilisateur (projet « ecomfy dev », éditeur SQL, accès dev uniquement) ; comptes jetables créés et connectés par l'utilisateur (les mots de passe ne sont pas saisis par l'outil). Absents : `supabase` CLI, `psql`, `deno`, clé `service_role`.

| Demande | État | Ce qu'il faut |
|---|---|---|
| Requêtes de l'annexe B sur la **production** | Non faites. Faites sur dev (section 5.2) et sur une base locale (section 4.1). | Les lancer dans l'éditeur SQL de production (`AUDIT-PROJET-2026-10.md`, annexe B) après avoir lu `docs/DEPLOIEMENT-DEV-2026-10.md` section 9. |
| Export des journaux Supabase | Non fait. | Ouvrir les journaux du projet. Filtres : appels `rpc/apply_commission_payment`, `rpc/apply_shop_subscription`, `rpc/apply_shop_activation`, `rpc/prepare_shop_activation_payment`, `rpc/check_rate_limit`, `rpc/enqueue_email`, `rpc/read_email_batch` avec un rôle `anon` ; écritures sur `user_roles` et `corporate_*` ; lignes de `commission_payments` sans paiement GeniusPay associé. |
| C1 sur dev | Non fait : fichier 02 non appliqué. | Décision de l'appliquer (lire `docs/DEPLOIEMENT-DEV-2026-10.md` section 6 : conflit `payment_links`, C4 ouvert). |
| Nomination et révocation par le fondateur principal | Non testées (compte réel, non jetable). | Un compte `founder` jetable, ou test par le propriétaire. |
| Paiement GeniusPay de bout en bout, vitrine publique avec pixels | Non testés. | Environnement sandbox GeniusPay ; boutique active avec un identifiant GA4 réel. |
| Typage complet (`tsc` sans `head`) | Partiel : seules les 20 premières lignes de la sortie filtrée ont été lues. | Relancer `npx tsc --noEmit -p tsconfig.app.json` et lire toute la sortie. |

---

## 3. Méthode

### 3.1 Base locale jetable

- Image : `public.ecr.aws/supabase/postgres:17.6.1.155` (rôles `anon`, `authenticated`, `service_role`, `authenticator` réels, schémas `auth`, `storage`, `vault`, `realtime`).
- Les 234 fichiers de `supabase/migrations` sont rejoués dans l'ordre sur la base `postgres` du conteneur, avec `ON_ERROR_STOP=0`. 141 tables sont créées dans `public`.
- 28 fichiers produisent au moins une erreur. Aucun n'est une migration de sécurité d'octobre (`20261012*`). Un premier rejeu sur une base `replay` créée à part avait échoué partout (schéma `auth` absent) : il a été abandonné et refait sur la base `postgres` du conteneur. Erreurs observées dans le rejeu final (lues par sondage, seules les premières erreurs de chaque fichier sont conservées) :
  - tables `storage.buckets` et `storage.objects` absentes de l'image (plusieurs migrations de buckets) ;
  - `auth.jwt()` absente de l'image (`20260522181112`, `20260604085402`, `20260608095704`, `20260902140000`) ;
  - `realtime.messages` absente (`20260609124605`) ;
  - colonnes ou tables qui n'existent pas encore au moment de la migration : `profiles.role` (`20260902120000`, `20260906010000`), `s.plan` (`20260912000000`), `product_variants` (`20260929120000`), `payment_links.shop_id` (partie de `20260914190000`), `is_founder_or_cofounder` (`20261005160000`), `ad_templates.created_by` (`20251107132948`) ;
  - changement de nom de paramètre `_role` (`20260916201500`, `20260918000000`, `20260919173000`), erreur de syntaxe dans `20260918000000`.
  Ces erreurs existaient avant les correctifs. Elles montrent que la chaîne de migrations du dépôt ne se rejoue pas proprement sur une base vierge (constat déjà noté dans l'audit : migrations à réconcilier avec la base réelle).
- Chaque appel est fait avec `SET LOCAL ROLE <rôle>` et l'identité posée par `request.jwt.claims` et `request.jwt.claim.sub` (ce que lit `auth.uid()`).
- Le script complet est rejouable : `supabase/tests/verification_c1_c2_c3_h2.sql`. La suite C3 d'origine reste `supabase/tests/c3_get_shop_orders_secure.sql`.

### 3.2 Sonde du projet dev

Appels HTTP avec la clé `anon` du `.env` et l'UUID de boutique inexistant `eeeeeeee-0000-4000-8000-00000000000e`. Aucune écriture. Les fonctions de file d'e-mails, de limitation de débit et de portefeuille qui pourraient écrire n'ont volontairement pas été appelées.

### 3.2 bis Tests sur la base dev réelle (éditeur SQL du tableau de bord)

- **Accès :** session Supabase ouverte dans le Chrome de l'utilisateur, projet « ecomfy dev » (`xfpbpxncserliskrbaim`). Le tableau de bord affiche l'étiquette « PRODUCTION » à côté de la branche `main` : c'est l'étiquette de branche de Supabase, le projet lui-même est bien le projet dev (nom et référence).
- **Requêtes en lecture seule :** droits `EXECUTE`, existence des fonctions et tables, politiques `corporate_*` et `user_roles`, comptes de rôles (comptes seulement, pas d'e-mails), secret Vault.
- **Tests de comportement : un seul bloc `DO` qui se termine par `RAISE EXCEPTION`.** Un bloc `DO` est une seule instruction, donc une seule transaction : l'exception finale l'annule entièrement, quoi qu'il arrive au milieu. Les résultats sont lus dans le message d'erreur. Le bloc :
  1. crée une fonction d'aide dans `pg_temp`, qui exécute une requête avec `SET LOCAL ROLE <rôle>` et l'identité posée par `request.jwt.claims` ;
  2. choisit des utilisateurs réels de dev : le `founder`, le `co_founder` et deux propriétaires de boutique sans rôle (marchands) ;
  3. lance 18 appels « AVANT » (état actuel de dev) ;
  4. applique, dans la même transaction, les instructions des migrations `20261012130000` (partie existante : `apply_commission_payment`, `apply_shop_subscription`), `20261012140000` et `20261012150000` (retapées à l'identique) ;
  5. relance les appels sur les fonctions concernées (« APRÈS »).
- **Limite des résultats « AVANT » pour `authenticated` :** la garde interne de `apply_commission_payment` laisse passer la connexion directe `postgres` (déjà noté dans `docs/SECURITY-HOTFIX-2026-10.md` section 8). Les appels « marchand » et « fondateur » AVANT sur cette fonction ne prouvent donc rien. Ceux d'APRÈS (refus par les droits, avant l'exécution de la fonction) sont fiables.
- **Incidents :** la saisie de grands blocs dans l'éditeur a dépassé deux fois le délai de l'outil (le texte est quand même arrivé en entier). Une première requête a échoué sur `supabase_migrations.schema_migrations` (« relation does not exist » avec le rôle de l'éditeur), alors que `to_regclass` renvoie bien le nom de la table : la version de migration maximale n'a donc pas été relevée.

### 3.3 Tests Node

```bash
node --experimental-strip-types --test supabase/tests/manage-founder-roles.test.ts supabase/tests/tracking-ids.test.ts
```

---

## 4. Résultats détaillés

### 4.1 Requêtes de l'annexe B sur la base locale (toutes migrations appliquées)

**Requête 1 : droits `EXECUTE` de `anon`, `PUBLIC`, `authenticated` sur la liste de l'annexe B.**

| Fonction | Rôles qui l'exécutent | Verdict |
|---|---|---|
| `apply_commission_payment`, `apply_shop_subscription`, `confirm_invoice_payment`, `apply_shop_activation`, `prepare_shop_activation_payment` | `service_role` seul | conforme (C2) |
| `credit_merchant_wallet_pending`, `process_wallet_settlements`, `get_or_create_merchant_wallet` | `service_role` seul | conforme (C1) |
| `request_wallet_withdrawal_atomic` | `authenticated`, `service_role` | conforme (C1) |
| `get_shop_orders_secure` | `authenticated`, `service_role` | conforme (C3) |
| `get_or_create_affiliate` | `service_role` seul | conforme |
| `evaluate_merchant_kyc_security` | `PUBLIC`, `anon`, `authenticated` | **supprimée** par le correctif C4 (remplacée par `review_merchant_kyc`, fondateur / `service_role`) ; le constat ci-dessus date d'avant le correctif |
| `record_affiliate_referral` | `PUBLIC`, `anon`, `authenticated` | **ouvert** (groupe B de l'annexe F.3) |
| `process_affiliate_commission_for_payment` | `PUBLIC`, `anon`, `authenticated` | **ouvert** (groupe B) |

**Requête 2 : politiques permissives (`qual = 'true'` ou `with_check = 'true'`) sur `corporate_%`.** 4 lignes :

| Table | Politique | Commande | Rôles | Verdict |
|---|---|---|---|---|
| `corporate_audit_logs` | Corporate append | INSERT | authenticated | voulu (onboarding) |
| `corporate_document_acceptances` | Corporate append | INSERT | authenticated | voulu (onboarding) |
| `corporate_invitations` | Allow public select … by token or auth | SELECT | public | **ouvert** |
| `corporate_invitations` | Allow write corporate_invitations | ALL | public | **ouvert** (écriture comprise, pour `anon`) |

32 politiques au total sur les tables `corporate_%`. Les fonctions `is_corporate_founder()` et `is_corporate_reader()` existent.

**Requête 3 : `is_founder_or_cofounder`.** Absente (la migration `20261005160000` qui l'utilise échoue dans le rejeu, voir 3.1).

**Vérification du lot de 16 fonctions serveur (`20261012150000`).** 0 fonction encore exécutable par `anon` ou `authenticated`.

**Fonctions `SECURITY DEFINER` non trigger encore exécutables par `anon` (45 lignes).** Hors fonctions publiques par conception, aides de RLS et générateurs (groupes C, D, F de l'annexe F.3), celles qui écrivent ou décident et n'ont pas été traitées :

| Fonction | Remarque |
|---|---|
| `evaluate_merchant_kyc_security` | C4 |
| `record_affiliate_referral`, `process_affiliate_commission_for_payment`, `process_referral_signup` | groupe B |
| `check_and_trigger_billing_threshold`, `enforce_shop_billing_deadlines`, `enforce_shop_payment_state_for` | groupe B |
| `mark_affiliate_payout_paid` | groupe E : garde à relire en priorité |
| `consume_ai_credit(_user_id, …)` | groupe E : identifiant utilisateur en paramètre |
| `record_stock_movement`, `push_order_to_delivery_provider`, `founder_grant_extra_deadline`, `increment_shop_gif_count`, `accept_shop_invitation`, `get_ai_quota`, `get_locked_orders_summary`, `get_my_subscription_status` | groupe E : garde à relire |
| `ensure_product_primary_image`, `upsert_abandoned_cart`, `mark_abandoned_cart_converted` | à relire (écriture sans garde apparente) |

Le fichier `AUDIT-PROJET-2026-10.md` annexe F.3 contient déjà ce classement. Cette liste est issue de l'état réel des droits après rejeu complet.

### 4.2 Comportement avec les vrais rôles (46 tests, script `verification_c1_c2_c3_h2.sql`)

Tous les résultats observés sont conformes aux attendus.

**C2 : fonctions de facturation**

| # | Test | Observé |
|---|---|---|
| 1 | `anon` : `apply_commission_payment` | 42501 permission denied |
| 2 | marchand : `apply_commission_payment` | 42501 |
| 3 | **fondateur** connecté, appel direct : `apply_commission_payment` | 42501 (le fondateur doit passer par l'Edge Function) |
| 4 | `service_role` : `apply_commission_payment` | `{"error":"shop_not_found","success":false}` (la fonction s'exécute) |
| 5 | `anon` : `apply_shop_subscription` | 42501 |
| 6 | marchand : `apply_shop_subscription` | 42501 |
| 7 | marchand : `confirm_invoice_payment` | 42501 |
| 8 | `anon` : `confirm_invoice_payment` | 42501 |
| 9 | marchand : `apply_shop_activation` | 42501 |
| 10 | `anon` : `prepare_shop_activation_payment` | 42501 |

**C1 : portefeuille**

| # | Test | Observé |
|---|---|---|
| 11 | marchand : `get_or_create_merchant_wallet` | 42501 |
| 12 | marchand : `credit_merchant_wallet_pending` sur lui-même | 42501 |
| 13 | `anon` : `credit_merchant_wallet_pending` | 42501 |
| 14 | marchand : `process_wallet_settlements` | 42501 |
| 15 | `anon` : retrait | 42501 |
| 16 | M1 (KYC vérifié, 10 000) retire 4 000 | succès, solde restant 6 000 |
| 17 | M1 retire -500 | « Montant de retrait invalide. » |
| 18 | M1 retire 999 999 | « Solde disponible insuffisant… » |
| 19 | M2 (sans KYC) retire 100 | « Votre compte d'identité (KYC) doit être vérifié… » |
| 20 | M2 appelle l'ancienne signature avec `p_merchant_id` = M1 | 42883 la fonction n'existe pas |
| 21 | `service_role` : retrait (pas de `auth.uid()`) | 42501 forbidden |

**C3 : commandes** (en plus des 19 tests de la suite d'origine, rejouée séparément)

| # | Test | Observé |
|---|---|---|
| 22 | `anon` | 42501 |
| 23 | M2 lit la boutique de M1 | 42501 forbidden |
| 24 | M1 lit sa boutique | autorisé |
| 25 | fondateur lit la boutique de M1 | autorisé |

**H2 : gouvernance (`corporate_*`)**

| # | Test | Observé |
|---|---|---|
| 26 à 27 | lecture `corporate_companies` par `anon`, marchand | 0 ligne |
| 28 | lecture par le fondateur | lignes visibles |
| 29 | lecture `corporate_shareholders` par un actionnaire | lignes visibles |
| 30 | lecture `corporate_shareholders` par un marchand | 0 ligne |
| 31 à 32 | `UPDATE corporate_companies` par marchand, par actionnaire | 0 ligne modifiée |
| 33 | `UPDATE corporate_companies` par le fondateur | lignes modifiées |
| 34 | `DELETE corporate_shareholders` par un marchand | 0 ligne |

**C7 : écriture directe de `user_roles` (RLS)**

| # | Test | Observé |
|---|---|---|
| 35 | marchand s'insère le rôle `founder` | erreur 42P17 « infinite recursion detected in policy for relation "user_roles" » |
| 36 | marchand s'insère le rôle `admin` | idem |
| 37 | co-fondateur s'insère le rôle `founder` | idem |
| 38 | `anon` lit `user_roles` | 0 ligne |

Les écritures sont bloquées, mais par une erreur de récursion de la politique, pas par une règle de droits (voir section 6, point 3).

**Portefeuille : politiques RLS et configuration de retrait** (script `verification_c1_c2_c3_h2.sql`, partie finale)

| # | Test | Observé |
|---|---|---|
| 39 | M1 lit son portefeuille (repli de `getWallet()`) | 1 ligne |
| 40 | M1 lit le portefeuille de M2 | 0 ligne |
| 41 | M1 `UPDATE wallets` (solde) en direct | 0 ligne modifiée |
| 42 | M1 `INSERT` dans `wallets` | refusé par RLS |
| 43 | M1 `INSERT` dans `withdrawal_requests` | refusé par RLS |
| 44 | M1 : `save_merchant_payout_config` | succès, numéro enregistré |
| 45 | `anon` : `save_merchant_payout_config` | 42501 |
| 46 | `anon` : `evaluate_merchant_kyc_security` | **s'exécute** (C4 non corrigé) |

État final des portefeuilles : M1 à 6 000 disponibles (un seul retrait de 4 000), M2 à 0.

### 4.3 Tests Node (C7 et C8)

`manage-founder-roles.test.ts` : 14 réussis. `tracking-ids.test.ts` : 6 réussis. Total 20 réussis, 0 échec.

### 4.4 C8 : le vrai `tracking.ts` avec un DOM simulé

Test écrit pour cette vérification, non conservé dans le dépôt : `src/lib/tracking.ts` et `trackingIds.ts` sont copiés, l'import Supabase est remplacé par une fausse fonction, `window` et `document` sont simulés, `eval` est piégé. `initShopPixels` est appelé avec :

- `google_analytics_ids` : `G-ABCD1234`, `G-ABCD1234"></script><script>alert(1)</script>`, `G-ABCD1234&l=x`, `G-<img src=x onerror=alert(1)>`, `UA-12345-1`, `javascript:alert(1)`, `G-AB`, `../../x`, `G-ABCD1234;fetch('//evil')` ;
- `ga4_measurement_id` piégé ;
- pixels Meta, TikTok, Snapchat valides et piégés ;
- `google_analytics_code` contenant un `<script src="https://evil.example/x.js">` et un `fetch(...)`.

| Mesure | Résultat |
|---|---|
| Scripts chargés | Meta `fbevents.js`, TikTok `events.js?sdkid=CABCDEFGH12`, Snapchat `scevent.min.js`, Google `gtag/js?id=G-ABCD1234` (un seul identifiant GA4, le valide) |
| Scripts inline | 0 |
| Appels à `eval` | 0 |
| Chargements suspects | 0 |
| Snippet gtag collé complet (avec `fetch('//evil')` dedans) | seul `gtag/js?id=G-REAL12345` est chargé, 0 script inline |

Tous les identifiants piégés ont été ignorés.

---

## 5. Projet dev (`xfpbpxncserliskrbaim`)

### 5.1 Sonde avec la clé `anon`

| Appel | Réponse | Lecture |
|---|---|---|
| `GET /rest/v1/` (OpenAPI) | 401 « Only the service_role API key can be used for this endpoint » | impossible de lister les fonctions exposées |
| `rpc/apply_commission_payment` | 401, 42501 permission denied | `anon` refusé |
| `rpc/apply_shop_subscription` | 401, 42501 permission denied | `anon` refusé |
| `rpc/confirm_invoice_payment` | 404 PGRST202 | fonction absente de dev |
| `rpc/get_shop_orders_secure` | 404 PGRST202 | fonction absente de dev : C3 non déployé |
| `rpc/request_wallet_withdrawal_atomic` | 404 PGRST202 | absente : C1 non déployé |
| `rpc/is_founder_or_cofounder` | 404 PGRST202 | absente |
| `GET wallets`, `GET ecomfy_payments` | 404 PGRST205 | tables absentes (confirme l'audit) |
| `GET corporate_companies`, `corporate_shareholders`, `user_roles` | 200 `[]` | `anon` ne lit rien |
| `POST functions/v1/manage-founder-roles` sans JWT | 401 | refusé |
| idem avec la clé `anon` comme jeton | 401 `{"error":"Non autorisé"}` | refusé |
| `POST functions/v1/founder-record-commission-payment` | 404 NOT_FOUND | **non déployée sur dev** |
| `POST functions/v1/founder-activate-shop` | 404 NOT_FOUND | **non déployée sur dev** |

Limite : cette sonde ne dit rien de `authenticated`, ni de la version déployée de `manage-founder-roles` (le 401 existe dans l'ancienne et la nouvelle version). La section 5.2 lève la première limite ; la seconde reste ouverte.

### 5.2 Requêtes et tests avec la session du tableau de bord

**Requête 1 de l'annexe B : droits `EXECUTE` de `anon`, `PUBLIC`, `authenticated` sur la liste de l'annexe B (5 lignes) :**

| Fonction | Rôles qui l'exécutent sur dev | Verdict |
|---|---|---|
| `apply_commission_payment` | `authenticated` | **Migration `130000` non appliquée** (le hotfix a retiré `anon` et `PUBLIC`) |
| `apply_shop_subscription` | aucun des trois (`service_role` seul) | conforme |
| `apply_shop_activation` | `anon`, `authenticated` | **ouvert** (migration `140000` non appliquée) |
| `prepare_shop_activation_payment` | `anon`, `authenticated` | **ouvert** (migration `140000` non appliquée) |
| les 10 autres fonctions de la liste (`confirm_invoice_payment`, `get_shop_orders_secure`, `request_wallet_withdrawal_atomic`, `credit_merchant_wallet_pending`, `process_wallet_settlements`, `get_or_create_merchant_wallet`, `evaluate_merchant_kyc_security`, `record_affiliate_referral`, `get_or_create_affiliate`, `process_affiliate_commission_for_payment`) | aucune ligne pour `anon`, `PUBLIC`, `authenticated` | absentes de dev ou fermées. Je n'ai pas relevé leur existence une par une. Seules `confirm_invoice_payment`, `get_shop_orders_secure`, `request_wallet_withdrawal_atomic` (et `is_founder_or_cofounder`) sont confirmées absentes (404 par l'API, section 5.1) |

**Requêtes 2 et 3, état du schéma :**

| Contrôle | Résultat sur dev |
|---|---|
| Politiques sur `corporate_%` | 30 politiques, **2 permissives** : `corporate_audit_logs` INSERT et `corporate_document_acceptances` INSERT (voulues) |
| `corporate_invitations` | absente de la liste des permissives sur dev ; l'existence de la table n'a pas été vérifiée (la migration `20260906000000` serait donc non déployée, à confirmer) |
| Fonctions `is_corporate_founder`, `is_corporate_reader` | 2 présentes : le hotfix `20261012120000` est appliqué sur dev |
| `is_founder_or_cofounder` | absente |
| Rôles privilégiés | 1 `founder`, 1 `co_founder`, 0 `admin`, 0 `shareholder` |
| `wallets`, `ecomfy_payments`, `shop_invoices`, `merchant_kyc`, `withdrawal_requests` | absentes |
| `shop_collaborators`, `payment_links` | présentes |
| `shops.shop_payment_status`, `orders.received_during_lock` | présentes |
| Secret Vault `supabase_project_url` | présent (1) |
| Table `supabase_migrations.schema_migrations` | existe ; version maximale non relevée |
| Lot de 16 fonctions serveur de `20261012150000` | 15 des 16 noms existent sur dev, **les 15 sont exécutables par `anon` et `authenticated`** |

**Politiques RLS de `user_roles` sur dev (4) :**

| Politique | Commande | Condition |
|---|---|---|
| Admins can manage all roles | ALL | `has_role(auth.uid(), 'admin')` |
| Users can view their own roles | SELECT | `auth.uid() = user_id` |
| `user_roles_manage_policy` | ALL | `EXISTS (SELECT 1 FROM user_roles ur WHERE ur.user_id = auth.uid() AND ur.role IN ('founder','co_founder'))`, en lecture et en écriture : **auto-référente** |
| `user_roles_select_policy` | SELECT | `true` |

**Tests de comportement dans le bloc annulé** (`founder`, `co_founder` et deux marchands réels de dev, UUID de boutique inexistant, rien d'écrit) :

| # | Test | AVANT (état de dev) | APRÈS les migrations `130000`, `140000`, `150000` |
|---|---|---|---|
| 1 | `anon` : `apply_commission_payment` | 42501 refusé | 42501 refusé |
| 2 | marchand : `apply_commission_payment` | s'exécute (`shop_not_found`), non probant (garde `postgres`) | 42501 refusé |
| 3 | fondateur, appel direct : `apply_commission_payment` | s'exécute (`shop_not_found`), non probant | 42501 refusé |
| 4 | `service_role` : `apply_commission_payment` | `shop_not_found` | `shop_not_found` (la fonction s'exécute) |
| 5 | `anon` : `apply_shop_subscription` | 42501 refusé | 42501 refusé |
| 6 | marchand : `apply_shop_subscription` | 42501 refusé | 42501 refusé |
| 7 | `anon` : `apply_shop_activation` | **s'exécute** (« Boutique introuvable pour ce compte ») | 42501 refusé |
| 8 | marchand : `apply_shop_activation` | **s'exécute** | 42501 refusé |
| 9 | `anon` : `prepare_shop_activation_payment` | **s'exécute** | 42501 refusé |
| 10 | `anon` : `check_rate_limit` | **s'exécute** (compteur incrémenté, annulé) | 42501 refusé |
| 11 | `anon` : lecture de `corporate_companies` | 0 ligne | non rejoué |
| 12 | marchand : lecture de `corporate_companies` | 0 ligne | non rejoué |
| 13 | fondateur : lecture de `corporate_companies` | 1 ligne | non rejoué |
| 14 | marchand : `UPDATE corporate_companies` | 0 ligne modifiée | non rejoué |
| 15 | `anon` : lecture de `user_roles` | 0 ligne | non rejoué |
| 16 | marchand : lecture de `user_roles` | **erreur 42P17 « infinite recursion detected in policy for relation user_roles »** | non rejoué |
| 17 | marchand : s'octroyer `admin` (INSERT dans `user_roles`) | erreur 42P17 (bloqué par la récursion) | non rejoué |
| 18 | co-fondateur : s'octroyer `founder` (INSERT dans `user_roles`) | erreur 42P17 (bloqué par la récursion) | non rejoué |

Après les migrations dans la transaction : **0 fonction du lot de 16 encore exécutable par `anon` ou `authenticated`.**

**Lecture :**
1. Le hotfix `20261012120000` (H2 et `apply_shop_subscription`) est bien appliqué sur dev ; la gouvernance est fermée aux marchands et à `anon`.
2. Les migrations `130000`, `140000`, `150000` ne le sont pas. Sur dev, et très probablement sur la production (copie), **`anon` peut exécuter `apply_shop_activation`, `prepare_shop_activation_payment`, `check_rate_limit` et les fonctions de files d'e-mails** : c'est le défaut décrit dans l'annexe F.2 de l'audit, confirmé sur la base réelle. Ces migrations fonctionnent sur le schéma réel de dev (test 1 à 10 APRÈS).
3. `user_roles` : une lecture par un utilisateur connecté échoue en récursion infinie (test 16), pas seulement une écriture. Toute requête cliente directe sur `user_roles` échoue donc pour les marchands sur dev. Les fonctions `SECURITY DEFINER` comme `has_role` ne devraient pas être concernées (non vérifié). L'impact réel dans l'application (écrans qui lisent `user_roles` directement) n'a pas été mesuré. L'élévation de privilèges d'un co-fondateur est bloquée par ce bug, pas par une règle de droits : voir section 6, point 3.

**Non couvert sur dev :** C3 (test refusé par les permissions de l'outil), C1 (système non déployé), les collaborateurs de boutique, les Edge Functions, les JWT réels.

---

## 6. Points à traiter

*(État au fil des tests ; les points 0, 1 et 3 sont résolus sur dev, voir leur texte.)*

0. **Exposition constatée sur dev avant déploiement (résolue sur dev, à traiter sur la production).** Avant le déploiement, `anon` exécutait `apply_shop_activation`, `prepare_shop_activation_payment`, `check_rate_limit` et les 15 fonctions serveur du lot de `20261012150000` (files d'e-mails comprises). Résolu sur dev par `deploy-dev/01_c2_c3_security.sql` (section 10). La production, copie de dev, est très probablement dans l'état d'origine : vérifier avec la requête du lot (`docs/SECURITY-HOTFIX-2026-10.md` section 5.4) puis appliquer `140000` et `150000` (`150000` fait échouer en 42501 toute tâche planifiée qui appellerait ces fonctions par l'API REST avec la clé `anon` ; `140000` demande `founder-activate-shop`).
1. **Ordre de déploiement (respecté sur dev).** Edge Functions, front, puis migrations. Sur la production, appliquer `20261012130000` ou `20261012140000` avant les Edge Functions `founder-*` casserait le paiement manuel et l'activation manuelle des fondateurs (`docs/SECURITY-HOTFIX-2026-10.md` section 5.4).
2. **Régression de `getWallet()`** (`src/lib/ecomfyPay.ts:76`). Elle appelle `get_or_create_merchant_wallet` depuis le navigateur. Cette fonction est désormais réservée à `service_role` : l'appel échoue en 42501. Le repli par `SELECT` direct sur `wallets` fonctionne si la ligne existe (test 39), mais un marchand qui n'a pas encore de portefeuille reçoit `null` au lieu de voir le portefeuille créé. À corriger : créer le portefeuille côté serveur (Edge Function ou premier crédit) ou ajouter une RPC `authenticated` limitée à `auth.uid()`.
3. **RLS de `user_roles` (C7) : corrigée sur dev par `04_user_roles_rls.sql`, à reporter sur la production.** Constat d'origine : `user_roles_manage_policy` (migration `20260831190000`), auto-référente, provoquait une récursion (42P17, HTTP 500) pour toute lecture ou écriture d'un utilisateur connecté, donc « Accès restreint » sur les pages fondateur pour tout compte sans contournement par e-mail ; elle autorisait aussi tout `co_founder` à écrire n'importe quel rôle, et `user_roles_select_policy` (`true`) rendait la table lisible par tous. Correctif : migration `20261012160000_fix_user_roles_rls_recursion.sql` (chacun lit ses rôles, `founder` et `co_founder` lisent tout via `is_corporate_founder()`, plus d'écriture directe pour `authenticated` et `anon`). Vérifié sur dev (section 10.1). La production a très probablement le même défaut.
4. **C4 corrigé dans les migrations (12/10/2026), pas encore sur dev.** `evaluate_merchant_kyc_security` était exécutable par `anon` (test 46). Elle est supprimée ; statut KYC écrit uniquement par `review_merchant_kyc` ; retraits suspendus par défaut. Vérifié par `supabase/tests/c4_kyc_review.sql` (18 cas, base jetable) et par l'écran de revue dans Chrome (faux serveur Supabase) ; guide : `docs/KYC-REVUE-ET-DEPLOIEMENT-C4.md`. Pour dev : ré-exécuter `deploy-dev/02_c1_wallet_dev.sql` (voir `99_rollback.sql` pour repartir de zéro, car le script n'est pas idempotent).
5. **Groupe B de l'annexe F.3** : `record_affiliate_referral`, `process_affiliate_commission_for_payment`, `check_and_trigger_billing_threshold`, `enforce_shop_billing_deadlines`, `enforce_shop_payment_state_for`, `process_referral_signup` restent ouvertes. Groupe E à relire, en priorité `mark_affiliate_payout_paid`, `consume_ai_credit`, `record_stock_movement`.
6. **`corporate_invitations`** reste ouverte en lecture et écriture à `public` (à corriger avant de déployer `20260906000000`).
7. **E-mails en dur côté interface** (contrôle d'accès contournable par un e-mail contenant « djateulrich ») : `src/components/AppSidebar.tsx:200`, `src/components/FounderRoute.tsx:21`, `src/pages/AssociateSpace.tsx:49`, `src/pages/CorporateGovernance.tsx:384,387,536`, `src/pages/FounderDashboard.tsx:344,371`, `src/pages/FounderTroubleshooting.tsx:90,118`, `supabase/functions/app-health-monitor/index.ts:11` (liste d'e-mails). Aussi les migrations qui comparent `auth.jwt() ->> 'email'` (`20260902140000`, pas encore déployée).
8. **Données déjà piégées par C8.** Le correctif empêche l'exécution, mais ne nettoie pas les `google_analytics_code` déjà stockés. La requête de détection est dans `AUDIT-PROJET-2026-10.md` (statut de C8). À lancer sur dev et production.
9. **Typage.** `tsc` signale des erreurs dans `src/lib/ecomfyPay.ts` : `types.ts` est périmé (tables `wallets`, `merchant_kyc`, RPC absentes). Ces erreurs viennent du `types.ts` périmé. Je n'ai lu que les 20 premières lignes de la sortie filtrée sur les fichiers modifiés par les correctifs, et toutes sont dans `ecomfyPay.ts` : les autres fichiers (`tracking.ts`, `founderBilling.ts`, `ShopSettings.tsx`, `FounderManager.tsx`, etc.) ne sont donc pas confirmés sans erreur. À relancer sans `head`. Il faut régénérer `types.ts` après réconciliation avec la base réelle.

---

## 7. H11 : projets Supabase prod et dev

| Contrôle | Résultat |
|---|---|
| `.env` suivi par Git | Non (`.gitignore` ligne 14) ; seul `.env.example` est suivi |
| `supabase/.temp/` suivi par Git | Non (`.gitignore` ligne 31). Le dossier existe encore en local et lie le poste au projet dev (`ecomfy dev`) |
| `.env` local | Pointe sur dev (`xfpbpxncserliskrbaim`) |
| Navigateur (section 9) | La page d'accueil n'émet des requêtes que vers `xfpbpxncserliskrbaim.supabase.co` ; aucune vers la production |
| `.env.example` | Documente `prod = yfggrceynzcwklbxhgix`, `dev = xfpbpxncserliskrbaim` |
| Identifiants de projet en dur dans le code | Aucun dans `src/` et `supabase/functions/` (recherche des deux références) |
| Identifiants dans les migrations | `20260813104500_fix_push_notification_webhook.sql` ligne 8 : URL de la **production** en dur. `20261011120000` (lecture de l'URL dans Vault) la remplace, mais seulement une fois appliquée. Sans le secret Vault `supabase_project_url`, les appels sont ignorés (comportement documenté dans cette migration) |

---

## 8. Reproduire

```bash
# Tests Node (C7, C8)
node --experimental-strip-types --test supabase/tests/manage-founder-roles.test.ts supabase/tests/tracking-ids.test.ts

# Base jetable + rejeu des migrations + tests de comportement
docker run -d --name pgtest -e POSTGRES_PASSWORD=test public.ecr.aws/supabase/postgres:17.6.1.155
docker cp supabase/migrations pgtest:/mig
docker exec pgtest bash -c 'cd /mig; for f in $(ls *.sql | sort); do psql -U supabase_admin -h localhost -d postgres -v ON_ERROR_STOP=0 -q -f "$f" >/dev/null 2>&1; done'
docker exec -i pgtest psql -U supabase_admin -h localhost -d postgres < supabase/tests/verification_c1_c2_c3_h2.sql
docker rm -f pgtest
```

Sous Git Bash sur Windows, utiliser des redirections `<` plutôt que des chemins passés à `psql -f` dans le conteneur (la conversion de chemins de MSYS les déforme).

Pour rejouer la vérification sur dev sans rien écrire : coller dans l'éditeur SQL du projet dev un bloc `DO $do$ ... $do$` qui crée ses fonctions d'aide dans `pg_temp`, exécute les appels sous `SET LOCAL ROLE`, et se termine par `RAISE EXCEPTION E'RESULTATS%', out;` (la transaction implicite du bloc est annulée, les résultats sont dans le message d'erreur). Les requêtes de lecture de la section 5.2 se lancent telles quelles. Les blocs utilisés ne sont pas conservés dans le dépôt : leur contenu est décrit en 3.2 bis.

---

## 9. Test dans le navigateur

**Environnement :** serveur Vite local (`npx vite --host 127.0.0.1 --port 8082 --strictPort`), `.env` pointant sur dev, Chrome de l'utilisateur. Un premier lancement par `npm run dev` écoutait sur toutes les interfaces (`host: "::"` dans `vite.config.ts`) : il a été interrompu à la demande de l'utilisateur puis relancé lié à `127.0.0.1` uniquement. Serveur arrêté et onglet fermé en fin de test.

| Contrôle | Résultat |
|---|---|
| Page d'accueil (`/`) | S'affiche (hero, boutiques, logos « Ils nous font confiance ») |
| Requêtes vers Supabase | 2 : `POST /rest/v1/rpc/get_top_sellers` (200) et `GET /rest/v1/shops?select=id,logo_url,business_name&id=in.(…)` (200), toutes sur `xfpbpxncserliskrbaim.supabase.co` (dev) |
| Requêtes vers la production (`yfggrceynzcwklbxhgix`) | 0 |
| Erreurs console | 0 (un avertissement `[SW] Registration error` à l'enregistrement du service worker : le serveur de développement renvoie du HTML pour `sw.js`, sans lien avec les correctifs) |

**Non testé dans le navigateur :** tout ce qui demande un compte connecté (écrans fondateur, `ShopPaymentControl`, `BillingPaymentModal`, `PayCommissionDialog`, onglet « activation de boutique », gouvernance, portefeuille Ecomfy Pay, saisie des identifiants de pixels dans `ShopSettings`), la page publique d'une boutique avec pixels (C8 dans un vrai navigateur) et l'inscription. Les mots de passe ne peuvent pas être saisis par l'outil. C8 n'est donc vérifié que par les tests Node et le DOM simulé (section 4.4).

---

## 10. Suite du 12 octobre : après déploiement des correctifs sur dev

L'utilisateur a appliqué les Edge Functions et les scripts `deploy-dev/01` (voir `docs/DEPLOIEMENT-DEV-2026-10.md`). Le fichier 02 (C1) n'est pas appliqué.

**Base dev, lecture seule :** `apply_commission_payment`, `apply_shop_subscription`, `apply_shop_activation`, `prepare_shop_activation_payment` exécutables par `service_role` seul ; `get_shop_orders_secure` par `authenticated` et `service_role` ; lot de 16 fonctions serveur exposées : 0 ; politiques permissives `corporate_*` : 2 (voulues) ; tables du portefeuille absentes.

**Tests HTTP anonymes sur dev (`scripts/verify-dev-security.mjs`) :** 13 réussis, 3 échecs. Les 3 échecs sont les fonctions de portefeuille de C1, absentes (404). Les Edge Functions `founder-record-commission-payment`, `founder-activate-shop`, `manage-founder-roles` répondent 401 sans JWT.

**Navigateur, compte fondateur jetable connecté (rôle `co_founder`) :**
- `/corporate-governance` et `/founder/shop-payment-control` affichent « Accès restreint ».
- Cause : `GET /rest/v1/user_roles?select=role&user_id=eq.<id>&role=in.(founder,co_founder,shareholder,admin)` renvoie **HTTP 500** (récursion infinie de la politique `user_roles_manage_policy`, 42P17), alors que `profiles` répond 200.
- Ce n'est pas causé par les correctifs de ce lot (la politique date de `20260831190000`), mais cela empêche tout contrôle de rôle côté interface et donc le test de l'espace fondateur avec un compte sans e-mail codé en dur.
- Correctif préparé et validé en local : migration `20261012160000_fix_user_roles_rls_recursion.sql` (copie : `supabase/deploy-dev/04_user_roles_rls.sql`), 15 tests de comportement. **Appliqué sur dev par l'utilisateur ensuite** (résultats ci-dessous).
- Côté données : les images de logos de boutiques de dev pointent vers le stockage de la **production** (`yfggrceynzcwklbxhgix.supabase.co/storage/...`) : URLs copiées avec les données, pas du code.

### 10.1 Navigateur après le fichier 04 (`user_roles`), compte fondateur jetable (`co_founder`)

Même session, même serveur local (`127.0.0.1:8082`, base dev). Aucune action d'écriture exécutée.

| Parcours | Résultat |
|---|---|
| Lecture des rôles (`GET /rest/v1/user_roles?select=role&user_id=eq.<id>&role=in.(...)`) | **200** (était 500) |
| `/corporate-governance` | S'affiche : capital, fondateur principal, associés, vesting, onglets Cap Table, Moteur de vesting, Centre documentaire, Audit Logs (14 entrées). Menu « Administration » visible. |
| Requêtes de la page (co-fondateur) | `corporate_companies`, `corporate_shareholders`, `corporate_share_allocations`, `corporate_vesting_plans`, `corporate_documents`, `corporate_proposals`, `corporate_intellectual_property`, `corporate_audit_logs` : toutes 200. `corporate_invitations` : **404** (table absente de dev : migration `20260906000000` non déployée ; la page s'affiche quand même). |
| `/founder-dashboard` | S'affiche (revenus, boutiques activées, clients, courbes). |
| Onglet « Gouvernance & Fondateurs » (C7) | `POST /functions/v1/manage-founder-roles` : **200**. Liste de l'équipe dirigeante (3 membres) affichée ; **aucun formulaire de nomination ni bouton de révocation** pour un co-fondateur ; texte « Seul le Fondateur Principal peut ajouter ou révoquer… Les co-fondateurs peuvent consulter la liste. » |
| `/founder/shop-payment-control` | S'affiche ; requête `shops` en 200 ; aucune erreur 42501, 500 ou « forbidden » dans la console. |

**Non testé dans le navigateur :** les actions qui écrivent (paiement manuel via `founder-record-commission-payment`, activation manuelle via `founder-activate-shop`, nomination et révocation par le fondateur principal) : elles modifieraient des données de dev ; les parcours côté marchand (accès refusé, réglages de pixels C8) : demandent une connexion du compte marchand jetable par l'utilisateur ; C1 : non déployé.

### 10.2 Script HTTP avec de vrais JWT et tests qui écrivent (comptes jetables, dev)

**Script `scripts/verify-dev-security.mjs`** lancé par l'utilisateur avec un marchand jetable et un fondateur jetable (`co_founder`) : **42 réussis, 6 échecs.** Les 6 échecs sont les fonctions de portefeuille de C1 (`get_or_create_merchant_wallet`, `credit_merchant_wallet_pending`, `process_wallet_settlements`, pour `anon` puis pour le marchand) : absentes de dev (404 PGRST202), pas ouvertes. Passent, entre autres :
- marchand : les 4 RPC de facturation et d'activation refusées (42501) ; `get_shop_orders_secure` refusée (`forbidden`) ; `corporate_*` vides, écriture sans effet ; `founder-record-commission-payment`, `founder-activate-shop` et `manage-founder-roles` (list et add) refusés en 403 ; `INSERT` dans `user_roles` refusé ;
- fondateur : les 4 RPC refusées en direct (42501) ; `get_shop_orders_secure` autorisée ; `corporate_*` lisibles ; `founder-record-commission-payment` → `shop_not_found` ; `founder-activate-shop` → « Boutique introuvable » ; `manage-founder-roles` list autorisé.

**Marchand jetable, interface web :**
- Création d'une boutique par l'assistant manuel (« Test Securite Dev », id `c1083a4b-046f-4cd5-b4ed-9a369ab055b5`) : OK ; tableau de bord et page Commandes (vide) s'affichent.
- C8, réglages Pixels & Suivi : identifiant GA4 `G-ABCD1234"></script>` **refusé** (toast « Identifiant invalide… doit avoir la forme G-XXXXXXXXXX ») ; `G-TEST12345` accepté puis sauvegardé.
- `get_shop_orders_secure` n'est appelée par aucun fichier de `src/` : la page Commandes lit la table `orders` (RLS). C3 protège l'API directe, pas un écran.
- 404 sur `shop_invoices` et `enforce_shop_billing_deadlines` : facturation par seuil non déployée sur dev (sans lien avec les correctifs).

**Fondateur jetable, interface web (écritures C2 via les Edge Functions) :**

| Action | Résultat |
|---|---|
| `/founder-dashboard`, « Activer par ID Boutique », type « Frais d'Activation Boutique », 1300 FCFA, `wave_direct`, boutique de test | Toast « Paiement Validé & Boutique Réactivée ». En base : `shops.is_activated = true`, `activation_fee_paid = true` ; 1 ligne `payments` : `completed`, 1300, `manual = true`, `recorded_by` renseigné, `wave_direct`. |
| Même fenêtre, type « Règlement Facture / Commission », 500 FCFA | Toast de succès. En base : 2 lignes `commission_payments` pour la boutique : 1300 `paid` (« Activation de la boutique », écrite par `apply_shop_activation`) et 500 `paid` (« test commission securite dev »), `created_by` renseigné dans les deux cas ; `commission_balance_due` = 0. |

Remarques : le solde de commission de la boutique de test valait 0 avant le paiement de 500 et vaut 0 après (pas de solde négatif). L'appel réseau aux Edge Functions n'a pas été capturé par l'outil ; le succès est établi par le toast (le front lève une erreur si la fonction échoue) et par l'état de la base.

**Données de test créées sur dev :** deux comptes jetables, la boutique `c1083a4b-046f-4cd5-b4ed-9a369ab055b5` (activée, avec l'identifiant GA4 `G-TEST12345`), 1 ligne `payments` et 2 lignes `commission_payments`. Nettoyage : `docs/DEPLOIEMENT-DEV-2026-10.md`, section 8.3.

**Non testé :** C1 (non déployé), nomination et révocation par le fondateur principal (compte réel, non jetable), paiement GeniusPay, vitrine publique d'une boutique avec pixels dans un navigateur.

## 11. C4 : correctif KYC et écran de revue (12 octobre 2026)

Vérification **locale uniquement** ; rien n'est déployé sur dev ni sur la production. Détail et procédure : `docs/KYC-REVUE-ET-DEPLOIEMENT-C4.md`.

| Vérification | Méthode | Résultat |
|---|---|---|
| Migrations d'origine `20260914190000` puis `20260914200000` | Base Postgres 16 jetable (image `pgvector/pgvector:pg16`), `auth` et rôles simulés, **sans** `is_corporate_founder()` préexistante | Appliquées sans erreur |
| `deploy-dev/02_c1_wallet_dev.sql` | Même base, avec une table `payment_links` de cours préexistante | Appliqué sans erreur |
| `supabase/tests/c4_kyc_review.sql` | Les deux bases ci-dessus | 18 cas sur 18 |
| Écran `/founder/kyc-review` | Chrome, application locale (`127.0.0.1:8080`) contre un faux serveur Supabase (3 dossiers fictifs, un compte fondateur fictif) | Liste et compteur, fiche, rejet sans motif (aucun appel), rejet avec motif (appel `REJECTED` + motif), validation (appel `VERIFIED`), onglet Tous |
| Types TypeScript | `tsc --noEmit -p tsconfig.app.json` | Aucune erreur sur `KycReview.tsx` et `App.tsx` ; erreurs préexistantes sur `ecomfyPay.ts` et `KycVerificationTab.tsx` (types Supabase périmés) |

Limites : l'environnement SQL simule `auth` et les rôles, il n'est pas un Supabase réel (droits par défaut, extensions, Edge Functions). Le faux serveur ne contrôle aucun droit : les droits sont couverts par les tests SQL, pas par le test navigateur. Non testés : « Pièces redemandées » dans l'interface, affichage mobile, console du navigateur, `ecomfy-pay-withdraw` de bout en bout.

Un défaut a été trouvé et corrigé pendant ces tests : le script `deploy-dev/02` avait perdu le trigger lors de sa régénération (les cas 2, 3, 11, 13 et 14 échouaient) ; le test l'a détecté avant tout déploiement.
