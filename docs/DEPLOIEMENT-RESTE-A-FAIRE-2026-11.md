# Déploiement — tout ce qui reste à passer en production (01/11/2026)

**Projet prod :** `yfggrceynzcwklbxhgix` · **Dev :** `xfpbpxncserliskrbaim` · **Branche :** `jeanmarc` (code : `a522603`, 01/11/2026) · **Éditeur SQL :** Dashboard prod → SQL Editor. **Ne jamais utiliser `supabase db push`** (l'historique de migrations de la prod s'arrête à `20261018130000` : les migrations du 19 au 25/10 ont été appliquées à la main le 27/10, le CLI les croirait manquantes).

Ce document remplace la liste dispersée dans les guides précédents. Il a été établi le 01/11/2026 en comparant `origin/main`, `jeanmarc` et l'état réel de la prod (lecture seule). Il renvoie aux guides détaillés au lieu de les recopier, sauf quand la prod a changé depuis.

## 0. Ce qui est déjà fait (ne rien refaire)

| Élément | Contrôle du 01/11 |
|---|---|
| Migrations M1 à M17 (19 → 25/10) | Appliquées le 27/10 (journal §17 de `DEPLOIEMENT-JEANMARC-VERS-MAIN-2026-10.md`) |
| `20261027120000_top_sellers_shop_logo_fallback` | Active (`get_top_sellers` contient la limite de 100 000 caractères) |
| `20261030100000_delivery_providers_verification_guard` | Active (trigger `trg_guard_delivery_provider_verification` en `tgenabled = 'O'`) |
| Photos de profil en base64 | 0 profil restant (script `migrate-avatars-to-storage.mjs` déjà passé) |
| `test-openai-image` | Supprimée en prod (absente de la liste des 69 fonctions) |
| Tâches `pg_cron` | `ecomfy-pay-settlement` (10 min), `enforce-shop-payment-deadlines` (5 min), `enforce-subscription-expiry` (30 min), `weekly-finance-summary` (lundi 08 h UTC), `expire-stale-pending-payments`, `app-health-monitor` |
| Secrets présents | `GENIUSPAY_API_KEY`, `GENIUSPAY_API_SECRET`, `GENIUSPAY_WEBHOOK_SECRET`, `RESEND_API_KEY`, `APP_URL`, `CRON_SECRET`, `OPENAI_API_KEY`, `OPENROUTER_API_KEY`, `REPLICATE_API_KEY`, `ELEVEN_LABS_API_KEY`, `VAPID_*` |
| Secrets absents (voulu) | `EMAIL_MODE` et `EMAIL_REDIRECT_TO` : la prod est donc en mode `live` |

**Aucune migration SQL du dépôt n'est à appliquer.** Ce qui reste : 3 modifications en base à la main (§2, §3), 1 fonction à déployer (§1), 3 fonctions e-mail à redéployer (§2), du Git (§6), des tests (§7) et deux chantiers de code non écrits (§4, §5).

## Vue d'ensemble, par ordre de priorité

| # | Chantier | Urgence | Durée | Nature |
|---|---|---|---|---|
| 1 | Aiguillage du webhook Ecomfy Pay (paiements **et retraits**) + rattrapage du paiement encaissé | **Immédiate** (un client a payé, 20 paiements `PENDING`) | 1 h | 1 fonction (`a522603`), SQL, 1 paiement réel de test |
| 2 | File d'e-mails (travailleur + purge des 61 mails périmés) | **Avant lundi 02/11, 08 h UTC** | 30 min | SQL, 3 fonctions |
| 3 | Expiration automatique des paiements Ecomfy Pay | Après 1 | 10 min | SQL |
| 4 | `verify-domain-dns` (écritures non authentifiées) | Semaine | Code à écrire + 30 min | Fonction |
| 5 | Module Ecomfy Livraison (H5) | Plus tard | Chantier | Migrations bloquées |
| 6 | Synchroniser Git (`jeanmarc` → `main`) | Après 1 et 3 | 15 min | PR |
| 7 | Tests applicatifs C5 à C8 et recettes non jouées | Cette semaine | 2 h | Tests |
| 8 | Retraits (aiguillage des webhooks de retrait) | Avant d'ouvrir les retraits | 1 h | Fonction + test |
| 9 | Surveillance 48 h | En continu | | SQL |

---

## 1. Réparer le flux de paiement Ecomfy Pay

**Guide pas à pas déjà écrit : [`RUNBOOK-ECOMFY-PAY-WEBHOOK-2026-10.md`](RUNBOOK-ECOMFY-PAY-WEBHOOK-2026-10.md)** (étapes 0 à 6, 9 et 10). Cause et correctif : [`DEPLOIEMENT-AIGUILLAGE-WEBHOOK-ECOMFY-PAY-2026-10.md`](DEPLOIEMENT-AIGUILLAGE-WEBHOOK-ECOMFY-PAY-2026-10.md).

**État constaté le 01/11 (écarts avec le runbook)**

- `geniuspay-webhook` en prod : **v21 du 27/10 à 21 h 16**, donc **sans** l'aiguillage des paiements (commit `9a19c6a`, 29/10) **ni** celui des retraits (`a522603`, 01/11). Le même déploiement apporte les deux.
- `ecomfy_payments` : **20 paiements `PENDING`, 0 `SUCCEEDED`**. Le runbook en compte 15 (1 encaissé + 14) : les 5 autres sont postérieurs. Dernier paiement créé : 30/10 à 22 h 18 UTC.
- `expire_stale_ecomfy_payments` : **n'existe pas** (voir §3).

**Ordre d'exécution (reprendre les requêtes et commandes du runbook)**

1. Étape 0 : noter la version actuelle de `geniuspay-webhook` (v21) pour le retour arrière ; ouvrir GeniusPay et les logs de la fonction.
2. Étape 1 : pré-contrôle de `ECM-PAY-6L3Z341U23` (10 500 FCFA, réf. GeniusPay `MTX-QPBYZCG36W`). **S'arrêter si la transaction n'est pas `completed` chez GeniusPay.**
3. Étape 2 : déployer.

   ```powershell
   $P = "yfggrceynzcwklbxhgix"
   npx supabase@latest functions deploy geniuspay-webhook --project-ref $P --use-api
   ```

   Contrôles : appel sans signature → 200 `Missing signature headers` ; `ecomfy-pay-webhook?provider=geniuspay` sans signature → 401. Le déploiement doit partir de la branche `jeanmarc` au commit `a522603` ou plus récent (`git log -1 --format=%h`).
4. Étape 3 : non-régression (le prochain webhook d'abonnement ne doit **pas** produire `Forwarded to ecomfy-pay-webhook`).
5. Étape 4 : **paiement réel de bout en bout** sur une boutique de test à vous. Attendu : `SUCCEEDED`, commande `paid`, une écriture `PAYMENT_PENDING/PENDING`, log `Forwarded … status: 200`.
6. Étape 5 : rattraper `ECM-PAY-6L3Z341U23` (voie A : renvoi du webhook depuis GeniusPay ; voie B : `confirm_ecomfy_payment` par SQL). Le crédit sera disponible 72 h après le rattrapage.
7. Étape 6 : pour **chacun des 19 autres `PENDING`**, chercher la transaction chez GeniusPay avant d'expirer. Toute transaction `completed` se traite comme à l'étape 5. Les paiements de moins de 24 h attendent. Liste à jour :

   ```sql
   select p.internal_reference, p.provider_reference, p.amount,
          to_char(p.created_at, 'DD/MM HH24:MI') as cree,
          exists (select 1 from public.webhook_events w
                  where w.payload::text like '%' || p.internal_reference || '%'
                    and w.event_type = 'payment.success') as success_recu
   from public.ecomfy_payments p
   where p.status = 'PENDING' and p.internal_reference <> 'ECM-PAY-6L3Z341U23'
   order by p.created_at;
   ```

   L'`UPDATE ... EXPIRED` du runbook ne s'exécute qu'**après** cette vérification. Les commandes liées se règlent avec les marchands, jamais en masse.

**Critère d'annulation :** si les abonnements cessent de s'activer (webhook d'abonnement sans ligne `GeniusPay webhook:` dans les logs) → runbook étape 10.

**À ne pas oublier :** prévenir le marchand du paiement rattrapé (le courriel de succès n'est envoyé que par le webhook, et la file d'e-mails est à l'arrêt, voir §2).

---

## 2. File d'e-mails (échéance : avant le lundi 02/11 à 08 h UTC)

Guide de référence : [`DEPLOIEMENT-EMAILS-RESEND-2026-10.md`](DEPLOIEMENT-EMAILS-RESEND-2026-10.md). Le résumé finance hebdomadaire part de la tâche `weekly-finance-summary` (lundi 08 h UTC) : il sera mis en file, mais **ne partira que si un travailleur vide la file**.

**État constaté le 01/11**

| Élément | Constat |
|---|---|
| `RESEND_API_KEY`, `APP_URL` | Posés |
| `EMAIL_MODE` | Absent (donc `live`) |
| Tâche `process-email-queue` | **Absente** de `cron.job` |
| Coffre (`vault`) | `supabase_project_url` et `cron_secret` présents ; **`email_queue_service_role_key` absent** |
| Fonctions e-mail en prod | Redéployées le 27/10 (v18 pour `process-email-queue`) : à confirmer qu'elles contiennent la version Resend (commit `0e866a9`, déjà dans `main`) |
| **File `transactional_emails`** | **61 messages périmés** (du 12/08 au 27/10) : `shop-activation` et `commission-payment` |

**Piège : ne pas lancer le travailleur avant d'avoir traité ces 61 messages.** Dès que la tâche tourne, ils partent tous vers de vrais clients (activations de boutique d'août, paiements de commission de septembre…). Soit on les vide, soit on décide lesquels méritent encore d'être envoyés.

### 2.1 Décider du sort des 61 messages

```sql
-- Aperçu : un message par ligne (lecture seule)
select msg_id, enqueued_at::date as le,
       message->>'label' as modele,
       message->>'to' as destinataire
from pgmq.q_transactional_emails
order by enqueued_at;
```

Recommandation : **purger** (les événements sont vieux de plusieurs semaines à trois mois, la plupart n'ont plus de sens). Avant, garder une trace :

```sql
create table if not exists public.email_queue_purge_20261101 as
select msg_id, enqueued_at, message from pgmq.q_transactional_emails;

select pgmq.purge_queue('transactional_emails');
select count(*) from pgmq.q_transactional_emails;   -- attendu 0
```

La table de sauvegarde pourra être supprimée plus tard (`drop table public.email_queue_purge_20261101;`). Si vous voulez envoyer certains messages récents, supprimez-les un par un de la sauvegarde puis réinjectez-les avec `pgmq.send` après le démarrage du travailleur, ou refaites-les à la main.

Les lignes `pending` d'`email_send_log` plus vieilles d'un mois peuvent rester (elles ne déclenchent rien) ou être nettoyées comme sur dev.

### 2.2 Redéployer les trois fonctions e-mail (sûr, idempotent)

```powershell
$P = "yfggrceynzcwklbxhgix"
npx supabase@latest functions deploy process-email-queue send-transactional-email send-generation-reminder --use-api --project-ref $P
```

Vérifier avant : domaine `ecomfy.cloud` **vérifié dans Resend** (SPF/DKIM), `EMAIL_MODE` absent ou `live` (`npx supabase@latest secrets list --project-ref $P`).

### 2.3 Poser la clé dans le coffre, puis planifier le travailleur

1. Dans l'éditeur SQL de la prod (jamais dans un fichier ni un commit) :

   ```sql
   select vault.create_secret('<clé service_role du projet>', 'email_queue_service_role_key');
   ```

   La clé : Dashboard → Project Settings → API.
2. Exécuter `supabase/maintenance/planifier_file_emails.sql` (rejouable ; elle refuse de s'exécuter si un secret du coffre manque). Elle crée `process-email-queue` toutes les 5 secondes, qui n'appelle la fonction que si la file contient un message.
3. Contrôles :

   ```sql
   select jobname, schedule, active from cron.job where jobname = 'process-email-queue';
   select jobid, status, return_message from cron.job_run_details order by start_time desc limit 5;
   ```

Retour arrière : `select cron.unschedule('process-email-queue');`

### 2.4 Test

1. File vide (§2.1), travailleur actif.
2. Provoquer **un** e-mail réel vers une adresse à vous (par exemple `send-transactional-email` avec le modèle `shop-activation` et votre adresse, ou un événement réel peu risqué). Attendu : mail reçu, `email_send_log` avec une ligne `sent`, aucune entrée en file morte.
3. `dlq` avec `403` ou `domain` : domaine non vérifié dans Resend.
4. Lundi 02/11 après 08 h UTC : vérifier que le résumé finance est parti.

### 2.5 Mails d'authentification (facultatif, plus tard)

L'activation du *Send Email Hook* (Authentication → Hooks) est décrite au §5 du guide Resend. Elle rend `auth-email-hook` obligatoire pour **tous** les mails de connexion : à faire seulement après un test complet sur dev. Aujourd'hui les mails d'auth sortent par le chemin par défaut de Supabase, ne pas y toucher sans nécessité.

---

## 3. Expiration automatique des paiements Ecomfy Pay

À faire **après** le §1 (l'étape 6 du runbook doit avoir statué sur chaque `PENDING`, sinon la tâche pourrait expirer un paiement que vous n'avez pas encore regardé).

Exécuter dans l'éditeur SQL le bloc de l'étape 7 de [`RUNBOOK-ECOMFY-PAY-WEBHOOK-2026-10.md`](RUNBOOK-ECOMFY-PAY-WEBHOOK-2026-10.md) : fonction `expire_stale_ecomfy_payments(24)` réservée à `service_role`, puis tâche `expire-stale-ecomfy-payments` toutes les 10 minutes.

Contrôles :

```sql
select jobname, schedule, active from cron.job where jobname = 'expire-stale-ecomfy-payments';
select proname from pg_proc where proname = 'expire_stale_ecomfy_payments';
```

Retour arrière : `select cron.unschedule('expire-stale-ecomfy-payments');`

---

## 4. `verify-domain-dns` : fonction ouverte en écriture (point H4)

**Constat :** la fonction est `verify_jwt = false`, utilise la clé de service et prend `resourceId`, `domain` et `verificationCode` dans le corps de la requête, sans contrôle de propriétaire. Un inconnu peut fixer `domain_status`, `ssl_status` et `dns_propagation_percentage` de la boutique ou de la vitrine d'un autre (en fournissant un domaine à lui qui valide), ou la repasser en `pending`. Il ne peut ni changer le domaine ni lire de données. Gravité moyenne.

**Correctif écrit et commité (`a522603`, 01/11/2026), non déployé** : `supabase/functions/verify-domain-dns/index.ts`.

- Exige un JWT : sans `Authorization` ou avec un jeton invalide → **401**.
- Autorise le propriétaire de la ressource (`user_id`), un `admin` / `founder` / `co_founder` (`user_roles`), et pour une boutique un collaborateur **actif** avec le rôle `edit_shop`. Sinon → **403**.
- `domain` et `verificationCode` ne sont **plus lus dans la requête** : ils viennent de `custom_domain` et `domain_verification_code` en base. Aucun domaine configuré → 400.
- `resourceType` limité à `shop` / `showcase`, `resourceId` doit être un UUID, ressource introuvable → 404.
- Compatible avec l'unique appelant, `DnsConfigurationAssistant.tsx` : `supabase.functions.invoke` envoie déjà le jeton de session, et le domaine et le code sont ceux de la base. Aucun changement de front.
- Vérifié : `eslint` propre, `deno check` passe (l'original ne passait pas).

**Déploiement**

```powershell
npx supabase@latest functions deploy verify-domain-dns --use-api --project-ref yfggrceynzcwklbxhgix
```

**Tests (obligatoires après déploiement)**

1. Sans connexion : `Invoke-RestMethod -Method Post -Uri "https://yfggrceynzcwklbxhgix.supabase.co/functions/v1/verify-domain-dns" -Body '{"resourceType":"shop","resourceId":"<uuid>"}' -ContentType 'application/json'` → **401**.
2. Avec le jeton d'un compte qui ne possède pas la boutique → **403**.
3. Propriétaire d'une boutique avec domaine personnalisé : bouton de vérification DNS de l'assistant → les enregistrements s'affichent, `domain_last_check` mis à jour.
4. Collaborateur avec `edit_shop` : même résultat ; collaborateur sans `edit_shop` : 403.
5. Une requête qui envoie un autre `domain` dans le corps ne change rien : le résultat porte sur le domaine enregistré en base.

Retour arrière : redéployer la version précédente (`git checkout HEAD -- supabase/functions/verify-domain-dns`). Attention : l'ancienne version est celle qui était ouverte en écriture.

---

## 5. Module Ecomfy Livraison (point H5) : ne pas appliquer les migrations telles quelles

Plan complet : [`H5-LIVRAISON-MISE-EN-PROD-2026-10.md`](H5-LIVRAISON-MISE-EN-PROD-2026-10.md).

- Les tables `delivery_companies`, `delivery_hubs`, `delivery_drivers`, `delivery_dispatches`, `delivery_cash_transfers`, `delivery_company_reviews` **n'existent pas en prod** ; les migrations `20260906010000` et `20260907140000` ne s'y sont jamais appliquées.
- `20260906010000` est **bloquante telle quelle** (voir §3 du document H5) : ne pas la lancer.
- `20261016120000_h5_delivery_verification_guard.sql` échoue en prod avec `42P01` tant que `delivery_companies` n'existe pas.
- Les écrans `/delivery/register`, `/delivery/status`, `/delivery/resubmit`, `/delivery-admin`, `/delivery/partner-dashboard`, `/delivery/driver` échouent en prod en attendant. `verify-delivery-identity` est déployée et protégée (401), mais elle interroge des tables absentes.
- À traiter avec la tâche « Logistique : KYC/KYB » de la Phase 2. L'ancien module (`delivery_providers`, etc.) est en prod et protégé par le garde de `20261030100000`.

Rien à déployer maintenant ; décider seulement si les routes ci-dessus doivent être masquées en attendant.

---

## 6. Synchroniser Git : `jeanmarc` → `main`

`main` (`27e7092`) n'a **aucun commit absent de `jeanmarc`**. `jeanmarc` a 12 commits de plus (27 → 30/10). Vercel déploie le front depuis `main`, mais ces commits ne changent aucun écran : ils contiennent migrations déjà actives, fonctions, config, scripts et guides.

Pourquoi le faire :

- `main` contient encore `test-openai-image` : un redéploiement complet des fonctions depuis `main` la **remettrait en ligne** sans authentification.
- `main` n'a pas `verify_jwt = false` pour `ecomfy-pay-settlement` : un redéploiement complet depuis `main` rétablirait la vérification JWT et la tâche planifiée échouerait en 401.
- `main` n'a pas l'aiguillage du webhook.
- `main` n'a pas les deux migrations du 27 et 30/10.

À faire **après** le §1 (pour que le dépôt reflète ce qui est en prod) :

1. Ouvrir une pull request `jeanmarc` → `main` (fusion par commit de fusion, comme la PR #4). Pas de conflit attendu.
2. Vérifier la CI (lint, typecheck, tests, audit) : elle a été verte en dernier.
3. Après fusion : attendre « Ready » sur Vercel, ouvrir l'accueil avec la console ouverte (aucune violation CSP).
4. **Ne pas redéployer toutes les fonctions** « pour être sûr » : les versions en prod sont déjà à jour, sauf celles listées dans ce document.

Le plan est à confirmer avec vous avant tout `git push` ou toute PR.

---

## 7. Tests applicatifs en production, jamais joués

| Test | Comment | Attendu |
|---|---|---|
| **C5** : webhook signé | Couvert par l'étape 4 du §1 (paiement réel signé par GeniusPay) | `SUCCEEDED`, commande `paid`, ledger |
| **C6** : montants falsifiés refusés | Compte marchand **jetable**. Puis : `$env:SUPABASE_URL="https://yfggrceynzcwklbxhgix.supabase.co"; $env:SUPABASE_ANON_KEY="<clé anon prod>"; $env:EMAIL="..."; $env:PASSWORD="..."; $env:SHOP_ID="<uuid boutique du compte jetable>"; node scripts/verify-c6-prod.mjs` | Tous les cas refusés, aucun paiement `pending` créé (sinon le supprimer) |
| **C7** : nomination et révocation de fondateur | `manage-founder-roles` avec un compte de test, ensuite révocation | Nomination et révocation appliquées dans `user_roles`, refus pour un non-fondateur |
| **C8** : vitrine avec pixels | Ouvrir une vitrine avec Meta, TikTok et Google configurés, console ouverte | Seuls les identifiants `G-XXXX` acceptés, aucune erreur CSP |
| Secrets prod/dev | `npm run secrets:compare` | Aucun secret propre à la prod manquant (compare les noms et les condensés, jamais les valeurs) |
| Première revue KYC (C4) | [`KYC-REVUE-ET-DEPLOIEMENT-C4.md`](KYC-REVUE-ET-DEPLOIEMENT-C4.md) | Retraits toujours suspendus tant que la revue n'est pas faite |

**Recettes de la liste du 27/10 non jouées** (à cocher une par une, navigateur) : éditeur de produit en session marchand, abonnement par paiement réel, activation et paiement manuel fondateur, affiliation, suivi de livraison, bibliothèque, Académie, `/seo`, optimiseur IA, console sur les pages autres que l'accueil. Tests SQL du journal §16 non joués : 6, 7, 11, 12, 14, 16 à 20, 22.

**Aussi à confirmer :** l'export des journaux de l'API Supabase (rétention limitée, rien n'a été exporté ; l'avant 12/10 n'est pas vérifiable).

---

## 8. Retraits Ecomfy Pay : seulement avant d'ouvrir `withdrawals_enabled`

Aujourd'hui `withdrawals_enabled = false` : **ne pas l'ouvrir** tant que ce qui suit n'est pas fait.

1. **Aiguillage écrit et commité (`a522603`, 01/11/2026), non déployé** : `supabase/functions/geniuspay-webhook/index.ts` transmet aussi à `ecomfy-pay-webhook?provider=geniuspay` tout événement dont le nom commence par `payout.`, `withdrawal.` ou `transfer.` (même motif que `GeniusPayConnector.parseWebhook`). Aucun nouveau code n'est à faire pour cette partie : il part avec le déploiement du §1 (même fonction, donc **un seul déploiement** de `geniuspay-webhook` couvre les paiements clients et les retraits). Les noms d'événements de retrait de GeniusPay restent supposés, non vérifiés.
2. Après déploiement : un événement de retrait doit produire `Forwarded to ecomfy-pay-webhook` dans les logs de `geniuspay-webhook`.
3. Tester avec un retrait de montant minimal, retraits ouverts pour un seul compte de test : `withdrawal_requests` doit passer à son état final et le ledger recevoir l'écriture de clôture (`finalize_withdrawal`).
4. Terminer la revue KYC (§7) : les retraits ne s'ouvrent qu'à des comptes validés.
5. Les connecteurs de retrait n'ont jamais été testés (pas de clés d'opérateur) : [`ECOMFY-PAY-CONNECTEURS-2026-10.md`](ECOMFY-PAY-CONNECTEURS-2026-10.md).

---

## 9. Surveillance (48 h après le §1, le §2 et le §3)

Exécuter `supabase/maintenance/surveillance_post_deploiement.sql` (lecture seule) matin et soir, plus :

```sql
-- Paiements Ecomfy Pay par statut
select status, count(*) from public.ecomfy_payments group by 1 order by 1;

-- Événements de paiement en erreur (attendu : 0 ligne)
select processing_status, count(*) from public.payment_events
where processing_status in ('ERROR', 'AMOUNT_MISMATCH', 'CREDIT_BLOCKED') group by 1;

-- Passages des tâches cron en échec sur 24 h (attendu : 0 ligne)
select j.jobname, d.start_time, left(d.return_message, 160)
from cron.job_run_details d join cron.job j using (jobid)
where d.status <> 'succeeded' and d.start_time > now() - interval '24 hours';

-- File d'e-mails (attendu : proche de 0 en régime normal)
select (select count(*) from pgmq.q_transactional_emails) as file_tx,
       (select count(*) from pgmq.q_auth_emails) as file_auth;
```

Critères de réussite :

- [ ] Chaque nouveau paiement client est `SUCCEEDED` en moins d'une minute.
- [ ] Logs `geniuspay-webhook` : une ligne `Forwarded … status: 200` par paiement client, aucun `Forward … failed`.
- [ ] Les abonnements s'activent toujours.
- [ ] Plus aucun `PENDING` de plus de 24 h.
- [ ] La file d'e-mails se vide ; résumé finance du lundi parti.
- [ ] Aucun échec de tâche cron.

---

## Liste de contrôle générale

- [ ] **1.** `geniuspay-webhook` déployée depuis `a522603` (v22 attendue : paiements et retraits aiguillés), paiement réel de test réussi
- [ ] **1.** `ECM-PAY-6L3Z341U23` rattrapé, marchand prévenu
- [ ] **1.** Les 19 autres `PENDING` vérifiés chez GeniusPay, puis expirés ; commandes réglées avec les marchands
- [ ] **2.** File `transactional_emails` sauvegardée et purgée (61 messages)
- [ ] **2.** Trois fonctions e-mail redéployées, domaine Resend vérifié
- [ ] **2.** `email_queue_service_role_key` dans le coffre, `planifier_file_emails.sql` exécuté, mail de test reçu
- [ ] **2.** Résumé finance du lundi 02/11 parti
- [ ] **3.** `expire_stale_ecomfy_payments` + tâche planifiée
- [ ] **4.** `verify-domain-dns` : déployé, 401 sans session, 403 autre compte, assistant DNS OK pour le propriétaire
- [ ] **5.** Décision sur le module Livraison (routes masquées ou chantier planifié)
- [ ] **6.** PR `jeanmarc` → `main` fusionnée, Vercel « Ready »
- [ ] **7.** C5, C6, C7, C8 testés ; `secrets:compare` propre ; revue KYC
- [ ] **8.** Événement de retrait aiguillé et retrait de test clôturé **avant** d'ouvrir `withdrawals_enabled`
- [ ] **9.** Surveillance 48 h sans anomalie
- [ ] Mettre à jour [`SUIVI-LANCEMENT-ETAT-PROD-2026-10.md`](SUIVI-LANCEMENT-ETAT-PROD-2026-10.md) et le journal [`DEPLOIEMENT-JEANMARC-VERS-MAIN-2026-10.md`](DEPLOIEMENT-JEANMARC-VERS-MAIN-2026-10.md)

## Ordre de déploiement conseillé, résumé

1. `verify-domain-dns` (indépendant de tout le reste) : 5 min + tests du §4.
2. §2.1 à 2.3 : purge de la file, fonctions e-mail, travailleur : **avant lundi 02/11 08 h UTC**.
3. §1 : `geniuspay-webhook`, paiement de test, rattrapage, puis vérification des 19 autres `PENDING`.
4. §3 : expiration automatique.
5. §6 : PR `jeanmarc` → `main`.
6. §7 puis §8 : tests applicatifs, puis test de retrait avant d'ouvrir `withdrawals_enabled`.

Commandes de déploiement des fonctions, toutes avec `--use-api --project-ref yfggrceynzcwklbxhgix` :

```powershell
$P = "yfggrceynzcwklbxhgix"
npx supabase@latest functions deploy verify-domain-dns --use-api --project-ref $P
npx supabase@latest functions deploy process-email-queue send-transactional-email send-generation-reminder --use-api --project-ref $P
npx supabase@latest functions deploy geniuspay-webhook --use-api --project-ref $P
```

## Retour arrière, récapitulatif

| Chantier | Retour arrière |
|---|---|
| Aiguillage du webhook (paiements et retraits) | `git checkout 1d97a70 -- supabase/functions/geniuspay-webhook`, redéployer, puis `git checkout HEAD -- supabase/functions/geniuspay-webhook` |
| `verify-domain-dns` | `git checkout a522603~1 -- supabase/functions/verify-domain-dns`, redéployer (cette version est ouverte en écriture), puis `git checkout HEAD -- supabase/functions/verify-domain-dns` |
| Travailleur d'e-mails | `select cron.unschedule('process-email-queue');` |
| Purge de la file | Les messages sont dans `public.email_queue_purge_20261101` ; réinjection avec `pgmq.send` |
| Expiration des paiements | `select cron.unschedule('expire-stale-ecomfy-payments');` (les paiements déjà `EXPIRED` restent tels quels ; un succès tardif les créditerait quand même) |
| Rattrapage d'un paiement | Pas de retour arrière de code : écriture `ADJUSTMENT` au ledger, décidée au cas par cas |
