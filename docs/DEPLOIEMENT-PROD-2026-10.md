# Déploiement en production : vague 1 (12 et 13 octobre 2026)

**Projet de production :** `yfggrceynzcwklbxhgix` · **Dev :** `xfpbpxncserliskrbaim`
**Périmètre :** C2, C3, C7, C8, H2, H11 (voir `AUDIT-PROJET-2026-10.md`). Ecomfy Pay (C1, C4, C5) est la **vague 2**, non déployée, bloquée (section 7).
**Documents liés :** [`SECURITY-HOTFIX-2026-10.md`](SECURITY-HOTFIX-2026-10.md), [`DEPLOIEMENT-DEV-2026-10.md`](DEPLOIEMENT-DEV-2026-10.md), [`VERIFICATION-CORRECTIFS-2026-10.md`](VERIFICATION-CORRECTIFS-2026-10.md), [`KYC-REVUE-ET-DEPLOIEMENT-C4.md`](KYC-REVUE-ET-DEPLOIEMENT-C4.md).

---

## 0. Suivi des points (mis à jour le 13 octobre 2026)

« Terminé » : corrigé dans le code ou les migrations et testé en local ou sur dev. « En prod » : déployé sur `yfggrceynzcwklbxhgix`.

| Point | Terminé | En prod | Reste à faire |
|---|---|---|---|
| Annexe B sur la base réelle | Dev : oui | **Oui** (14/10/2026, section 3 bis) : toutes les requêtes applicables lancées, aucun écart | Relire les fonctions du groupe E (section 3 bis) |
| Export des journaux Supabase | Non | Non | Exporter (rétention limitée), chercher les appels `anon` suspects |
| H11, projets Supabase | Oui | **Partiel** : migration, secret Vault, push de commande, variables Vercel Production | **Clos le 14/10/2026** : le health-monitor répond 200 avec ses sondes (section 5). Reste les variables Vercel Preview ; variables Vercel Preview |
| C1, portefeuille | Oui (13 tests sur base jetable) | Non | Vague 2 (section 7) |
| C2, facturation et activation | Oui | **Oui** : SQL, Edge Functions `founder-*`, front | Tests des écrans fondateur : confirmés fonctionnels le 13/10/2026 (détail des cas non consigné) |
| C3, `get_shop_orders_secure` | Oui | **Oui** | Rien |
| C7, `manage-founder-roles` et RLS `user_roles` | Oui (14 tests Node) | **Oui** : fonction, RLS, front | Tester nomination et révocation ; décider de `Admins can manage all roles` |
| C8, `tracking.ts` | Oui (6 tests Node) | **Oui** : `track-conversion` et front | Requête de détection des `google_analytics_code` piégés ; test d'une vitrine avec pixels |
| H2, `corporate_*` | Oui | **Oui** | Rien |
| C4, KYC | Oui (18 tests) | Non | Vague 2. L'écran `/founder/kyc-review`, présent dans le front, affiche « Could not find the table 'public.merchant_kyc' » : attendu, la table n'existe pas encore. |
| C5, webhook HMAC | Oui (7 tests Node) | Non | Vague 2 ; jamais testé avec un vrai envoi GeniusPay |
| C6, montants côté serveur | Version minimale (14 tests Node) ; commandes encore créées par le navigateur | Non | À déployer avec la vague 2 dans cet ordre : migration `20261015120000` (testée sur base jetable), puis `process-payment`, `ecomfy-pay-initiate`, `ecomfy-pay-webhook`, puis le front ; voir l'audit, C6 |
| Front | Oui | **Oui** (déploiement signalé le 13/10/2026) | Tests de la section 8 ; confirmer que « Deploy to production » de l'intégration Supabase est désactivé |

## 1. État au 13 octobre 2026

| Élément | État en production |
|---|---|
| Edge Functions `founder-record-commission-payment`, `founder-activate-shop`, `manage-founder-roles`, `track-conversion` | **Déployées.** Sans JWT : 401 sur les trois fonctions `founder-*` / `manage-founder-roles`. |
| Hotfix `20261012120000` (C2 partiel, H2) | **Appliqué à la main** (éditeur SQL) |
| `deploy-dev/01_c2_c3_security.sql` (= `130000`, `140000`, `150000` et `get_shop_orders_secure`) | **Appliqué à la main** |
| `20261012160000` (RLS `user_roles`) | **Appliqué à la main** |
| `20261011120000` (H11, URL Vault) | **Appliquée à la main**, secret Vault `supabase_project_url` créé. Le health-monitor a répondu 401 jusqu'au 14/10/2026, puis 200 (section 5). |
| Front (branche `jeanmarc`) | **Déployé** (signalé le 13/10/2026). Le build contient l'écran de revue KYC, qui affiche une erreur de chargement tant que la vague 2 n'est pas déployée (attendu). Tests applicatifs des écrans fondateur : confirmés fonctionnels par le responsable le 13/10/2026. |
| Annexe B sur la production | Requêtes de la section 3 puis annexe B complète exécutées après correctif (section 3 bis). Les résultats d'avant correctif ne sont pas consignés ici. |

**Fenêtre de dysfonctionnement (12 octobre, base migrée avant le front) :** entre l'application du SQL et le déploiement du nouveau front, les écrans fondateur de paiement manuel, d'activation manuelle et de gestion des fondateurs échouaient (l'ancien front appelait directement des RPC désormais réservées à `service_role`). Le front étant déployé, elle est refermée. Aucune dérogation (`GRANT … TO authenticated` sur `apply_commission_payment`) n'a été utilisée : confirmé par le responsable le 13/10/2026.

## 2. Ce qui a été fait, dans l'ordre

1. Edge Functions (CLI, `--use-api` obligatoire sous Windows) :
   ```powershell
   $P = "yfggrceynzcwklbxhgix"
   npx supabase@latest functions deploy founder-record-commission-payment --project-ref $P --use-api
   npx supabase@latest functions deploy founder-activate-shop             --project-ref $P --use-api
   npx supabase@latest functions deploy manage-founder-roles              --project-ref $P --use-api
   npx supabase@latest functions deploy track-conversion                  --project-ref $P --use-api
   ```
2. SQL, éditeur du tableau de bord, un fichier à la fois, en entier : `20261012120000`, puis `supabase/deploy-dev/01_c2_c3_security.sql`, puis `20261012160000`. Tous idempotents.
3. H11 : `select vault.create_secret('https://yfggrceynzcwklbxhgix.supabase.co', 'supabase_project_url');` puis `20261011120000`.

L'ordre prévu était Edge Functions, **front**, puis base. Le front a été retenu par un contrôle de build (section 4) ; la base est passée avant lui.

## 3. Vérifications faites (production)

| Contrôle | Résultat |
|---|---|
| Droits `EXECUTE` sur `apply_commission_payment`, `apply_shop_subscription`, `apply_shop_activation`, `prepare_shop_activation_payment` | `service_role` seul |
| `get_shop_orders_secure` | `authenticated` + `service_role` (contrôle du propriétaire dans la fonction) |
| Lot de 16 fonctions serveur (e-mails, maintenance…) exposées à `anon` ou `authenticated` | 0 |
| Politiques `corporate_*` ouvertes | 2, voulues : insertion seule sur `corporate_audit_logs` et `corporate_document_acceptances` |
| `user_roles` | politiques : `Admins can manage all roles` (ALL, `has_role(…,'admin')`), `Users can view their own roles`, `user_roles_founders_read`. `INSERT`/`UPDATE`/`DELETE` pour `authenticated` et `anon` : `false`. |
| Rôles fondateur | `founder` et `co_founder` présents dans `user_roles` |
| Edge Functions sans JWT | 401 |
| Push de nouvelle commande (H11) | Fonctionne : réponse `200 {"success":true,"sent":2,"failed":[]}` après une commande de test |
| Cron `app-health-monitor` | Replanifié toutes les 5 minutes sur `invoke_edge_function` ; **réponses HTTP : 401** (section 5) |

Réserve connue : la politique `Admins can manage all roles` subsiste (elle date de novembre 2025 et n'est pas supprimée par `160000`). Les écritures sont bloquées par le `REVOKE`, mais un `admin` peut **lire** toute la table. Mineur ; à supprimer ou à restreindre.

**Non testé en production (à la date de ce document) :** les parcours applicatifs avec un vrai JWT fondateur ou marchand (`/corporate-governance`, paiement manuel, activation manuelle, nomination et révocation de fondateur, saisie GA4), la vitrine publique avec pixels, un paiement GeniusPay de bout en bout. Ils sont à jouer maintenant que le front est en ligne (section 8).

## 3 bis. Annexe B sur la production (14 octobre 2026)

| Requête | Résultat |
|---|---|
| 1. Fonctions exposées à `anon` / `PUBLIC` / `authenticated` (liste de l'annexe B) | Seule ligne : `get_shop_orders_secure` / `authenticated` (contrôle du propriétaire interne). Les fonctions de portefeuille, KYC et affiliation n'existent pas encore en base. |
| 2. Politiques permissives `corporate_*` | 2 lignes, voulues : insertion seule sur `corporate_audit_logs` et `corporate_document_acceptances` |
| 3. `is_founder_or_cofounder` | Absente |
| 4. Rôles privilégiés | `founder` : djateulrich@gmail.com seul. Le co-fondateur (djateulrich11@gmail.com) a été révoqué volontairement. |
| 5. Portefeuilles créditées sans paiement | Non lancée : `wallets` et `ecomfy_payments` n'existent pas (vague 2) |
| 6. Version de migration | `20260901020000` (les migrations passées à la main ne sont pas enregistrées) |
| 7. Fonctions exposées, sans filtre | Voir ci-dessous |
| 8. `google_analytics_code` piégés (C8) | Aucune ligne |
| 9. `commission_payments` | Les 44 commissions non manuelles ont toutes un paiement `completed` du même montant ; les 3 règlements manuels sont de `e024db6b…` (le fondateur). Aucune trace d'exploitation de C2 dans les données. |

**Requête 7.** Les triggers (renvoyant `trigger`) ne sont pas appelables par l'API. Les fonctions publiques par conception et les aides RLS sont attendues. Constats :
- `assign_founder_role` (trigger sur `auth.users`) donne `founder` à `djateulrich@gmail.com` et `co_founder` à `regnis13@gmail.com`, e-mails codés en dur (M7). **Non exploitable aujourd'hui** : les deux comptes existent et leur e-mail est confirmé. Le deviendrait si l'un des comptes était supprimé (l'adresse redevient inscriptible). À supprimer ou à limiter.
- `consume_ai_credit(_user_id, _feature, _amount)` est exécutable par `anon` et `authenticated` et prend `_user_id` du client sans le comparer à `auth.uid()` : un utilisateur peut débiter les crédits IA d'un autre. À corriger (contrôle `auth.uid()` ou réservation à `service_role`).
- **Non relues** : `founder_grant_extra_deadline`, `founder_reset_shop_payment` (`authenticated` seul), `enforce_shop_payment_state_for`, `process_referral_signup`, `push_order_to_delivery_provider`, `accept_shop_invitation`, `get_locked_orders_summary`, `get_my_subscription_status`, `increment_shop_gif_count`, `create_user_referral_code`, `recompute_order_totals`. Groupes B et E de l'annexe F.3.

Limites : l'existence d'un paiement (`payments.transaction_id`) a été complétée par un contrôle du statut et du montant (aucun écart). La requête portait sur les 50 dernières lignes ; les journaux de l'API restent à exporter pour les appels anonymes sans effet en base.

## 4. Front : déploiement

- Historique : le build de la PR (déploiement Preview Vercel) échouait sur le contrôle ajouté dans `vite.config.ts` (H11) : `VITE_SUPABASE_URL` et `VITE_SUPABASE_PUBLISHABLE_KEY` n'étaient définies que pour **Production**. Il faut aussi les définir pour **Preview**, avec les valeurs de dev :

  | Variable | Production | Preview |
  |---|---|---|
  | `VITE_SUPABASE_PROJECT_ID` | `yfggrceynzcwklbxhgix` | `xfpbpxncserliskrbaim` |
  | `VITE_SUPABASE_URL` | `https://yfggrceynzcwklbxhgix.supabase.co` | `https://xfpbpxncserliskrbaim.supabase.co` |
  | `VITE_SUPABASE_PUBLISHABLE_KEY` | clé `anon` de la production | clé `anon` de dev |
  | `VITE_VAPID_PUBLIC_KEY` | clé VAPID publique de la production | clé VAPID publique de dev |

  Type **Config** (le type « Secret » est refusé avec le préfixe `VITE_`, qui est public). Une variable n'est lue qu'au prochain build : relancer le déploiement après l'avoir enregistrée.
- Le bot Supabase signale aussi un échec de migrations sur la branche de preview (SQLSTATE 23502, `ad_templates.created_by`, migration `20251107132948`) : voir section 6.
- Front déployé le 13/10/2026. L'entrée « Revue KYC » du menu fondateur ouvre un écran en erreur (« Could not find the table 'public.merchant_kyc' in the schema cache ») : attendu, la table appartient à la vague 2. Option : masquer l'entrée de menu jusqu'à la vague 2.
- Jouer les tests de la section 8.

## 5. Incident clos le 14 octobre 2026 : `app-health-monitor` répondait 401

**Cause :** `app-health-monitor` est en `verify_jwt = false` mais appelle `isAuthorizedCron()` (clé de service ou en-tête `x-cron-secret`). La première version de `invoke_edge_function` n'envoyait aucun en-tête. Aucune fonction n'est exposée : elle refuse. Le monitoring de production ne tourne simplement pas (il ne tournait probablement pas avant non plus : l'ancien job visait `dqlb…`).

**Correctif dans le dépôt (non commité à la date de ce document) :** `20261011120000_edge_function_url_from_vault.sql` lit le secret Vault `cron_secret` et le transmet dans `x-cron-secret` s'il existe.

**À faire en production :**
1. Vérifier si le secret d'Edge Function `CRON_SECRET` existe déjà (`npx supabase@latest secrets list --project-ref yfggrceynzcwklbxhgix`, ou le tableau de bord). S'il existe, **réutiliser sa valeur** (ne pas l'écraser : un planificateur externe peut l'utiliser).
2. Sinon, générer une valeur aléatoire (PowerShell) :
   ```powershell
   $b = New-Object byte[] 32; [Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($b)
   $S = ($b | ForEach-Object { $_.ToString('x2') }) -join ''
   ```
3. `npx supabase@latest secrets set CRON_SECRET=$S --project-ref yfggrceynzcwklbxhgix`. **Bloqué le 12/10/2026 :** « Your account does not have the necessary privileges » : le compte n'a pas le rôle Owner ou Administrator sur le projet (les secrets d'Edge Function exigent l'un des deux). Faire exécuter la commande, ou définir le secret dans le tableau de bord (Project Settings > Edge Functions), par un Owner ou un Administrator, ou demander la promotion.
4. Éditeur SQL : `select vault.create_secret('<même valeur>', 'cron_secret');`
5. Éditeur SQL : rejouer `CREATE OR REPLACE FUNCTION public.invoke_edge_function` de la migration modifiée, puis `REVOKE ALL ON FUNCTION public.invoke_edge_function(text, jsonb) FROM PUBLIC, anon, authenticated;`
6. Après le prochain passage du cron : `select id, status_code, left(content::text,150), created from net._http_response order by created desc limit 3;` doit montrer `200`.

**Résolution (14/10/2026) :** `CRON_SECRET` défini par un administrateur, secret Vault `cron_secret` créé avec la même valeur, `invoke_edge_function` remplacée. Le cron de 00:10 UTC reçoit `200 {"success":true,"probes":[…]}` (sondes `db.shops.read`, `auth.health`, `frontend.public`, `payments.flow.24h`, `orders.flow.48h`). La première exécution (00:05) a une réponse vide sans code HTTP (probablement un délai dépassé ou un démarrage à froid) ; à surveiller. Le monitoring peut désormais créer des lignes dans `app_incidents`.

Si les 401 reviennent (valeur Vault différente de `CRON_SECRET`) : `select vault.update_secret((select id from vault.secrets where name='cron_secret'), '<VALEUR EXACTE>');`.

Pour faire cesser des 401 en attendant : `select cron.unschedule('app-health-monitor');` (le bloc `cron.schedule` de la migration le remet).

Les valeurs Vault sont lisibles par les membres du projet qui ont accès à Vault, et donnent le droit de déclencher les fonctions cron (et resteront le seul moyen de les déclencher une fois H3 déployé) : ne pas les partager.

## 6. Intégration GitHub de Supabase et migrations

- **Les migrations passées dans l'éditeur SQL ne sont pas enregistrées dans `schema_migrations`.** Pour l'intégration GitHub, `20261011120000` à `20261012160000` restent donc « en attente ».
- Si l'option **« Deploy to production »** de l'intégration GitHub est active, la fusion de la PR dans `main` appliquera automatiquement **toutes** les migrations postérieures à `20260901020000`, dont Ecomfy Pay (sans C6) et les migrations d'affiliation et de facturation par seuil qui contiennent encore des fonctions ouvertes. **À vérifier et à désactiver avant de fusionner** (Project Settings > Integrations > GitHub).
- **Preview qui échoue :** la branche de preview rejoue toutes les migrations sur une base vierge et bute sur `INSERT INTO ad_templates` (colonne `created_by` NOT NULL, compte seed absent). C'est le constat M11 (migrations non reproductibles), indépendant des correctifs. Un correctif existe dans la branche **locale** `fix/migrations-fresh-database` (commit `7eb936e`, jamais poussé) : `created_by` nullable plus 16 autres migrations, dont le renommage `payment_links` en `ecomfy_payment_links`. Il fusionne sans conflit avec `jeanmarc`, mais :
  - le renommage `payment_links` en `ecomfy_payment_links` est désormais reporté dans `jeanmarc` sans fusion (15/10/2026) : migrations `20260914190000` et `20260914200000`, `deploy-dev/02` et `99`, Edge Function `ecomfy-pay-initiate`, `src/lib/ecomfyPay.ts` et `src/pages/EcomfyPayCheckout.tsx`. `PaymentLinksManager`, `EnrollmentCheckout` et `ShowcaseCourseDetail` (liens de cours) gardent `payment_links`. Les types générés `src/integrations/supabase/types.ts` ne contiennent pas les tables Ecomfy Pay et restent à régénérer ;
  - il ajoute `20261009120000_fix_user_roles_policy_recursion.sql`, redondante avec `20261012160000` (celle-ci passe après et la remplace) ;
  - le passage complet sur base vierge n'a pas été vérifié depuis `jeanmarc`.

## 7. Vague 2 : Ecomfy Pay (C1, C4, C5), non déployable

| Bloquant | Détail |
|---|---|
| C6 non corrigé | `ecomfy-pay-initiate` accepte les montants du navigateur. À corriger avant d'ouvrir le portefeuille (C5 et C6 sont des prérequis de C4). |
| Conflit `payment_links` | Une table de liens de cours porte déjà ce nom. Résolu dans `jeanmarc` (15/10/2026) : la table Ecomfy Pay devient `ecomfy_payment_links` (voir section 6). Non déployé. |
| H1 | Corrigé dans le code (15/10/2026) : bucket privé `kyc-documents`. À déployer : migration `20261015140000`, puis `scripts/migrate-kyc-to-private-bucket.mjs` pour les fichiers existants (`docs/KYC-REVUE-ET-DEPLOIEMENT-C4.md`, sections 6 et 7 bis). |
| C5 non testé | Vérifier `GENIUSPAY_WEBHOOK_SECRET`, l'URL appelée par GeniusPay, un paiement de test confirmé par `GET /payments/{ref}`. |
| `getWallet()` | Appelle `get_or_create_merchant_wallet`, refusée au navigateur : un marchand sans portefeuille reçoit `null`. |

Ordre de la vague 2 quand tout est levé : Edge Functions (`ecomfy-pay-webhook`, `ecomfy-pay-initiate`, `ecomfy-pay-withdraw`), front, puis `20260914190000` et `20260914200000` chacune entre `begin;` et `commit;`. Retraits suspendus (`withdrawals_enabled = false`) jusqu'à la première revue KYC réelle. Détail : `KYC-REVUE-ET-DEPLOIEMENT-C4.md` section 5.

## 8. Tests à jouer une fois le front en ligne

Avec un compte fondateur (jeton dans `localStorage`, clé `ecomfy-auth-token`) et un compte marchand. `$TM` marchand, `$TF` fondateur ; UUID inexistant `eeeeeeee-0000-4000-8000-00000000000e`.

| Test | Attendu |
|---|---|
| `founder-record-commission-payment` avec `$TM` | 403 |
| idem avec `$TF`, boutique inexistante | `{"success":false,"error":"shop_not_found"}` |
| `founder-activate-shop` avec `$TM` / `$TF` | 403 / « Boutique introuvable. » |
| RPC `apply_commission_payment` directe avec `$TF` | `permission denied` (42501) |
| Lecture `corporate_shareholders`, `corporate_companies`, `corporate_audit_logs` avec `$TM` / `$TF` | `[]` / des lignes |
| `GET /rest/v1/user_roles?select=role` avec `$TF` | 200, plus de 500 |
| `/corporate-governance` en fondateur | cap table, actionnaires, documents visibles |
| `/founder/shop-payment-control` > paiement manuel | enregistré, boutique réactivée |
| `FounderDashboard` > activation de boutique | active réellement (ligne `payments` avec `metadata.manual = true`) |
| Compte marchand sur la gouvernance | vide ou « Accès restreint » |
| Saisie GA4 invalide (`<script>`…) / `G-XXXXXXXX` | refusée / acceptée |
| Paiement GeniusPay de test | webhook sans erreur `forbidden`, solde mis à jour |

## 9. Points restants à traiter

### Immédiat (vague 1 à terminer)
1. **Front** : déployé. Reste : confirmer que « Deploy to production » de l'intégration Supabase est désactivé (sinon la fusion applique les migrations en attente), variables Vercel Preview si les previews doivent builder, puis les tests de la section 8.
2. **Health-monitor** : fait (14/10/2026, section 5). À surveiller : réponses vides sans code HTTP, lignes dans `app_incidents`.
3. **C8** : requête de détection des `google_analytics_code` piégés (`AUDIT-PROJET-2026-10.md`, statut de C8). Si une ligne ressort, réinitialiser les sessions concernées.
4. **Audit des abus passés** : exporter les journaux de l'API Supabase (rétention limitée) pour les appels `anon` à `rpc/apply_commission_payment`, `rpc/apply_shop_subscription`, `rpc/apply_shop_activation`, `rpc/prepare_shop_activation_payment`, `rpc/check_rate_limit`, `rpc/enqueue_email`, `rpc/read_email_batch` ; lire `commission_payments` (lignes sans paiement GeniusPay associé) et `user_roles` (lignes inattendues).
5. **Surveillance 24 à 48 h** : erreurs `42501`, `forbidden`, `permission denied` dans les journaux Postgres et Edge Functions (tâche planifiée appelant les 16 fonctions serveur avec la clé `anon`).
6. Politique `Admins can manage all roles` : décider de la supprimer ou de la restreindre.
7. Nettoyer les données de test éventuelles (comptes jetables, boutique, paiements créés sur dev).

### Critiques non traités
8. **C6** : recalcul serveur des montants et des crédits (`process-payment`, `ecomfy-pay-initiate`). Prérequis de la vague 2.
9. **H1** : bucket privé pour la KYC, liens signés, migration des fichiers existants. *Corrigé dans le code (15/10/2026), à déployer : migration `20261015140000`, front, puis script de migration des fichiers.*
10. **H3** : `isAuthorizedCron` acceptait un JWT dont la signature n'est pas vérifiée. *Corrigé dans le code (15/10/2026), à déployer : redéployer les 7 fonctions cron et `seo-auto-index`, vérifier le secret Vault `email_queue_service_role_key`, puis faire tourner les secrets Vault.*
11. **H7** : `ReferenceError` de `geniuspay-webhook` (`isConfirmedPayment` hors de portée, ligne 257), et attributions sans contrôle de l'événement.
12. **H8** : en-têtes de sécurité dans `vercel.json` (HSTS, X-Frame-Options, CSP) ; `public/_headers` est ignoré par Vercel.

### Élevés et autres
13. **H4** relais d'e-mails ouverts ; **H5** `verify-delivery-identity` ; **H6** affiliation (politiques RLS et RPC) ; **H9** quotas IA et `correct-text` sans authentification ; **H10** création libre de commandes.
14. **Groupe B de l'annexe F.3** (6 RPC appelées par le navigateur, dont `record_affiliate_referral` et `process_affiliate_commission_for_payment`) et groupe E à relire (`mark_affiliate_payout_paid`, `consume_ai_credit`, `record_stock_movement`). À corriger avant de déployer l'affiliation et la facturation par seuil.
14 bis. **`consume_ai_credit`** (débit des crédits d'un autre utilisateur) et relecture des fonctions du groupe E listées en section 3 bis.
15. **`corporate_invitations`** reste ouverte à `public` ; `strict_multitenant_privacy` (`20260902140000`) à corriger avant déploiement.
16. **E-mails en dur côté interface** (`FounderRoute.tsx`, `AppSidebar.tsx`, `AssociateSpace.tsx`, `CorporateGovernance.tsx`, `FounderDashboard.tsx`, `FounderTroubleshooting.tsx`, `app-health-monitor/index.ts`) : contrôle d'accès contournable par un e-mail contenant « djateulrich ».
17. **Régression `getWallet()`** et types TypeScript périmés (`types.ts` à régénérer après réconciliation avec la base réelle).
18. **M11** : migrations non reproductibles ; décider du sort de `fix/migrations-fresh-database` (section 6).
19. M1 à M10, M12 et la dette (typage, tests, CI, dépendances, hygiène du dépôt) : voir `AUDIT-PROJET-2026-10.md`.

## 10. Retour arrière

- **Préféré :** restaurer le snapshot pris avant le déploiement (à confirmer : il doit avoir été pris avant la section 2).
- **Ciblé** (remet les failles en place, uniquement pour débloquer un flux) : les `GRANT` de `SECURITY-HOTFIX-2026-10.md` section 7 et `supabase/deploy-dev/99_rollback.sql`.
