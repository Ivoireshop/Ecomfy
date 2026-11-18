# API Ecomfy Pay documentée + sandbox — déploiement (14/11/2026)

**État (16/11/2026) : migration appliquée et fonction `ecomfy-pay-api` déployée sur la DEV, recette navigateur et API faite (voir « Recette du 16/11 »). Prod : rien n'est appliqué ni déployé.**

## Ce qui est livré

| Élément | Fichier |
|---|---|
| Migration (tables, RPC, déclencheur, cron) | `supabase/migrations/20261114110000_ecomfy_pay_api.sql` |
| Edge Function | `supabase/functions/ecomfy-pay-api/index.ts` (+ `verify_jwt = false` dans `supabase/config.toml`) |
| Routeur, validation, webhooks sortants | `supabase/functions/_shared/pay-api/` (`handler.ts`, `validate.ts`, `webhook-out.ts`) |
| Console marchand (clés, webhooks, envois, paiements test) | onglet « Développeurs » d'Ecomfy Pay (`DevelopersTab.tsx`, `src/lib/ecomfyPayDevApi.ts`) |
| Page de paiement sandbox | `/pay/sandbox/:paymentId` (`EcomfyPaySandboxCheckout.tsx`) |
| Documentation publique | `/developers/ecomfy-pay` (`EcomfyPayApiDocs.tsx`) + `public/openapi/ecomfy-pay.v1.yaml` |
| Tests | `supabase/tests/pay-api.test.ts` (vitest, 77), `supabase/tests/pay_api.sql` (98 contrôles) |

## Fonctionnement

- Routes `/v1` : `POST /payments`, `GET /payments`, `GET /payments/{id}`, `POST /sandbox/payments/{id}/simulate`, plus la page sandbox (`GET /sandbox/checkout/{id}`, `POST …/complete`, sans clé). URL : `<projet>.supabase.co/functions/v1/ecomfy-pay-api/v1/…`.
- Clés `ecm_sk_test_…` / `ecm_sk_live_…` (empreinte SHA-256 seule en base, secret montré une fois). Une clé = une boutique = un mode. Clé live : KYC `VERIFIED` exigé (création de la clé **et** chaque création de paiement).
- **Sandbox = tables séparées** (`ecomfy_api_payments`, `livemode = false`) : aucune écriture dans `ecomfy_payments`, `wallet_ledger`, portefeuille, commandes, statistiques (vérifié dans `pay_api.sql`).
- **Production = chemin existant** : une ligne `ecomfy_payments` (PENDING, frais 2,5 %) + connecteur GeniusPay (`getDefaultConnector`), puis `confirm_ecomfy_payment` inchangée. Un déclencheur `AFTER UPDATE OF status` sur `ecomfy_payments` crée l'événement `payment.*` ; ses exceptions sont avalées (un incident de notification ne peut pas bloquer un encaissement — testé).
- Webhooks sortants signés `Ecomfy-Signature: t=…,v1=HMAC-SHA256(secret, t.corps)`, tolérance 5 min, reprises 1 min / 5 min / 30 min / 2 h / 6 h / 12 h / 24 h, garde SSRF (https, pas d'IP littérale, pas d'hôte interne, DNS public, redirections non suivies), bail de 2 min.
- Idempotence 24 h (`Idempotency-Key`), limite 120 req/min/clé (`check_rate_limit`, échec = refus).

## Vérifié (14/11/2026)

- Base jetable Docker (`scripts/replay-migrations.sh --keep`, 286/286 migrations) : migration appliquée deux fois sans erreur ; `pay_api.sql` **98/98**.
- E2E local (routeur TypeScript réel + fonctions SQL réelles + faux opérateur + faux récepteur de webhooks) : **37/37** — création sandbox/live, idempotence, simulation, webhook signé vérifié, reprise après 500, `confirm_ecomfy_payment` → événement → livraison, refus de l'opérateur (502), clé révoquée. Script jetable, non conservé dans le dépôt.
- `npx vitest run` : 397 / 397. `npm run typecheck` : aucune nouvelle erreur. ESLint : propre sur les fichiers touchés. OpenAPI : YAML valide, `$ref` résolus (pas de validateur OpenAPI complet exécuté).
- Navigateur : la page `/developers/ecomfy-pay` s'affiche ; la page sandbox affiche l'état « introuvable » (fonction non déployée).

## Recette du 16/11/2026 (dev `xfpbpxncserliskrbaim`, front local)

- Fonction sous Deno réel et PostgREST : OK (401 sans clé / clé invalide, 404 checkout inconnu, 201 création, 200 lecture).
- Onglet « Développeurs » : clé de test créée (secret montré une fois), clé live grisée sans KYC, destination de webhook ajoutée/supprimée, « Derniers envois » et « Paiements de test récents » corrects.
- Paiement sandbox : idempotence (rejeu 200, corps différent 409), montant < 200 refusé, page `/pay/sandbox/:id`, redirection `success_url`, rejeu de complétion 409, aucune écriture dans `ecomfy_payments`.
- Garde SSRF : `https://127.0.0.1/…` acceptée à la création, refusée à l'envoi (`url_refused:ip_literal`) ; `Deno.resolveDns` non éprouvé (seule la branche IP littérale l'a été).
- Webhook réel (webhook.site, récepteur supprimé) : signature `Ecomfy-Signature` recalculée et valide, en-têtes `Ecomfy-Event-*`, corps conforme ; reprises par `pg_cron` (500 → tentative 2 à +1 min, suivante à +5 min).
- Secrets : `cron_secret` (Vault) et `CRON_SECRET` posés sur la dev le 16/11.

## Jamais testé

- Un paiement **live** avec une vraie clé GeniusPay (sandbox ou prod) : le connecteur est la doublure dans les tests ; la boutique de recette n'a pas de KYC validé.
- `Deno.resolveDns` dans le runtime Supabase pour un nom de domaine (le cas webhook.site est passé, mais seule une IP littérale a été refusée).
- Prod : migration, fonction, secrets `cron_secret` / `CRON_SECRET` (à vérifier), `APP_URL`.
- `APP_URL` de la dev vaut `http://localhost:8080` : les `checkout_url` pointent là (à régler avant une recette avec un vrai front).

## Ordre de déploiement (dev d'abord ; jamais `supabase db push`)

1. Migration `20261114110000_ecomfy_pay_api.sql` (SQL Editor ou `db query -f`). Rejouable.
2. `npx supabase@latest functions deploy ecomfy-pay-api --project-ref <ref> --use-api` (PowerShell, `verify_jwt = false` vient du `config.toml`).
3. Secret `APP_URL` (déjà utilisé par CORS) : base de l'URL de la page sandbox (`<APP_URL>/pay/sandbox/<id>`). Par défaut `https://ecomfy.cloud`.
4. Front (Vercel) : onglet Développeurs, pages sandbox et documentation, `/openapi/ecomfy-pay.v1.yaml`.
5. Recette sur la dev :
   ```powershell
   $B = "https://xfpbpxncserliskrbaim.supabase.co/functions/v1/ecomfy-pay-api"
   # clé de test créée dans Ecomfy Pay > Développeurs
   curl.exe -s "$B/v1/payments" -H "Authorization: Bearer $KEY" -H "Content-Type: application/json" `
     -d '{\"amount\":5000,\"payment_method\":\"wave\",\"success_url\":\"https://example.com/merci\"}'
   ```
   puis ouvrir `checkout_url`, choisir « Paiement réussi », vérifier le webhook reçu (destination de test sur webhook.site par exemple) et la ligne dans « Derniers envois ».

## Points d'attention

- `ecomfy-pay-webhook`, `ecomfy-pay-initiate`, `confirm_ecomfy_payment` : **non modifiés**. Seule nouveauté sur le chemin de l'argent : le déclencheur sur `ecomfy_payments` (lecture/écriture limitées aux tables API, exceptions avalées).
- Délai des webhooks : jusqu'à ~1 min (cron), immédiat en sandbox.
- Pas de remboursement ni de retrait par API, pas d'expiration automatique des paiements live, XOF seulement (écrit dans la documentation).
- Le bouton « Sandbox / Production » de l'en-tête d'Ecomfy Pay (`isSandbox` dans `EcomfyPay.tsx`) est un état local sans effet : il n'est pas relié à ce sandbox.
- L'ancienne page « Console API » (`/api-documentation`, table `api_keys`) reste fausse (voir `RAPPORT-FONCTIONNALITES-2026-10.md`, F23) : non touchée. Lui faire pointer vers `/developers/ecomfy-pay` ou la retirer reste à décider.
- Pour une URL stable côté marchands (`api.ecomfy.cloud/v1`), prévoir une réécriture Vercel vers la fonction : non faite.
- `wallet_ledger.is_sandbox` (jamais renseigné) n'est pas utilisé : le sandbox ne passe pas par le ledger.

## Retour arrière

Retirer l'Edge Function ; `DROP TRIGGER ecomfy_api_sync_live_payment ON public.ecomfy_payments;` suffit à neutraliser tout effet sur les paiements ; `cron.unschedule('ecomfy-pay-api-deliveries')`. Les tables `ecomfy_api_*` peuvent rester (inertes).
