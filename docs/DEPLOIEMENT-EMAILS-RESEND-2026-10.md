# Déploiement — envoi des e-mails par Resend (28/10/2026)

**Projet prod :** `yfggrceynzcwklbxhgix` · **Dev :** `xfpbpxncserliskrbaim` · **Branche :** `jeanmarc` (commit `0e866a9`). **Ne jamais utiliser `supabase db push`.** Aucune migration : trois Edge Functions, un secret, une tâche planifiée.

## 1. Ce qui change

| Avant | Après |
|---|---|
| La file transactionnelle (`process-email-queue`) envoyait par l'API Lovable (`LOVABLE_API_KEY`, domaine `notify.visuelpro.cloud`). Lovable n'est plus utilisé : plus rien ne partait. | Envoi par l'API Resend (`RESEND_API_KEY`), expéditeur `Ecomfy <noreply@ecomfy.cloud>`, comme tous les autres mails. |
| Pas de désinscription en un clic. | En-têtes `List-Unsubscribe` + `List-Unsubscribe-Post` vers `handle-email-unsubscribe`. |
| Relance après incident réseau : risque de double envoi. | `Idempotency-Key` = identifiant du message. |
| Boutons des rappels de génération vers `.lovableproject.com`. | Liens vers `APP_URL` (`https://ecomfy.cloud` par défaut). |

Fonctions touchées : `process-email-queue`, `send-transactional-email`, `send-generation-reminder`. Le chemin d'authentification (`auth-email-hook`) utilisait déjà Resend.

Gestion des erreurs Resend : 429 → file en pause (`Retry-After`) ; 401/403 (clé invalide, domaine non vérifié) → message en file morte et arrêt du lot ; autres erreurs → réessais, 5 maximum, puis file morte.

## 2. Garde-fou `EMAIL_MODE` (dev / recette)

| `EMAIL_MODE` | Effet |
|---|---|
| `live` (ou absent) | Envoi normal aux vrais destinataires. **Valeur de la production.** |
| `redirect` | Tout part vers `EMAIL_REDIRECT_TO`, sujet préfixé `[→ destinataire d'origine]`. |
| `off` (ou toute autre valeur) | Rien n'est livré (adresse puits `delivered@resend.dev`). |

Dev : `EMAIL_MODE=redirect`, `EMAIL_REDIRECT_TO=ecomfy@yopmail.com` (Yopmail est public : rien de sensible).
**Prod : ne jamais copier ces deux secrets**, et vérifier `npx supabase@latest secrets list --project-ref yfggrceynzcwklbxhgix` : `EMAIL_MODE` doit être absent ou égal à `live`.

## 3. État de dev (vérifié le 28/10)

- `RESEND_API_KEY` posé, trois fonctions déployées, test de bout en bout réussi : mail reçu sur Yopmail **et** visible dans Resend, destinataire d'origine bien intercepté.
- 46 lignes `pending` obsolètes de `email_send_log` (août–octobre, jamais traitées) supprimées ; files `auth_emails` / `transactional_emails` et files mortes vides.
- **Aucune tâche planifiée** : `cron.job` vide, coffre sans `email_queue_service_role_key`. Sans elle la file ne se vide pas (voir 4).

## 4. Tâche planifiée (obligatoire, dev puis prod)

Sans elle, les mails restent `pending` indéfiniment. La migration `20260410182641_email_infra.sql` ne la crée pas (commentaire seulement).

1. Coffre : vérifier `select name from vault.decrypted_secrets;` → doit contenir `supabase_project_url` (`https://<ref>.supabase.co`) et `email_queue_service_role_key`.
2. Si `email_queue_service_role_key` manque, dans l'éditeur SQL du projet (jamais dans un fichier ni un commit) :
   `select vault.create_secret('<clé service_role du projet>', 'email_queue_service_role_key');`
   La clé : Dashboard → Project Settings → API (ou `npx supabase@latest projects api-keys --project-ref <ref> -o json`).
3. Exécuter `supabase/maintenance/planifier_file_emails.sql` dans l'éditeur SQL (rejouable). Elle crée `process-email-queue` toutes les 5 secondes, qui n'appelle la fonction que si la file contient un message et qu'aucune pause 429 n'est en cours.
4. Contrôle : `select jobname, schedule, active from cron.job;` puis, après un envoi, `select jobid, status, return_message from cron.job_run_details order by start_time desc limit 5;`.

Retour arrière : `select cron.unschedule('process-email-queue');`

## 5. Mails d'authentification (inscription, mot de passe oublié…)

`auth-email-hook` n'est appelé que si le **Send Email Hook** est activé. Sur dev, `SEND_EMAIL_HOOK_SECRET` n'existe pas : ces mails ne partent donc pas par ce chemin.

1. Dashboard → **Authentication → Hooks → Send Email** → activer, type **HTTPS**.
2. URL : `https://<ref>.supabase.co/functions/v1/auth-email-hook`.
3. **Generate secret** → copier la valeur (`v1,whsec_…`).
4. `npx supabase@latest secrets set SEND_EMAIL_HOOK_SECRET="v1,whsec_…" --project-ref <ref>`
5. Enregistrer le hook. `auth-email-hook` est déjà déployée (`verify_jwt = false`, la signature est vérifiée dans le code).
6. Test sur dev : « Mot de passe oublié » avec un compte de test → le mail arrive sur `EMAIL_REDIRECT_TO`.

Attention : une fois le hook actif, **tous** les mails d'auth passent par la fonction ; si elle échoue, aucun lien de confirmation ni de réinitialisation n'arrive. Activer d'abord sur dev, tester, et ne l'activer en prod qu'avec `RESEND_API_KEY` et `SEND_EMAIL_HOOK_SECRET` déjà posés. Retour arrière : désactiver le hook (Supabase reprend son envoi par défaut).

## 6. Déploiement en production

Préalables : domaine `ecomfy.cloud` **vérifié dans Resend** (SPF/DKIM) ; `APP_URL=https://ecomfy.cloud` ; `EMAIL_MODE` absent ou `live`.

```bash
P=yfggrceynzcwklbxhgix
cat supabase/.temp/project-ref        # ne sert qu'à information : toujours passer --project-ref
npx supabase@latest secrets set RESEND_API_KEY=re_xxx --project-ref $P
npx supabase@latest functions deploy process-email-queue send-transactional-email send-generation-reminder --use-api --project-ref $P
```

Puis la tâche planifiée (4) et, si voulu, le hook d'authentification (5). Vérifier d'abord en prod ce qui existe déjà : `select jobname, active from cron.job;` (si la tâche existe, elle appelle déjà `process-email-queue` : il n'y a rien à changer, le redéploiement de la fonction suffit).

## 7. Tests

1. Envoi par la file (dev) : `send-transactional-email` avec un destinataire fictif, modèle `shop-activation`, puis le traitement part tout seul (4). Attendu : mail dans la boîte de redirection, sujet `[→ …]`, destinataire Resend = adresse de redirection.
2. `email_send_log` : une ligne `pending` (écrite à l'enfilage, jamais mise à jour) puis une ligne `sent` avec l'adresse **réelle** d'envoi. Un `pending` seul n'est pas une erreur si un `sent` existe pour le même `message_id`.
3. Contre-épreuve : `EMAIL_MODE=off` → Resend affiche `delivered@resend.dev`. Remettre `redirect`.
4. `dlq` avec `403` / `domain` : domaine non vérifié dans Resend.

## 8. Limites connues

- `handle-email-suppression` attend des webhooks de rebond signés par Lovable : inutilisable. Les rebonds et plaintes Resend ne sont pas encore collectés (à brancher sur un webhook Resend).
- `preview-transactional-email` et l'aperçu de `auth-email-hook` sont protégés par `LOVABLE_API_KEY` : inutilisables.
- Les modèles ne contiennent pas de lien de désinscription visible, seulement l'en-tête `List-Unsubscribe`.
