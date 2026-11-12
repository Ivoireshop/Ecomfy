# Déploiement — Page 404, CORS et codes HTTP (M3) — 11/11/2026

**Branche :** `jeanmarc` · **Migration :** aucune · **État :** testé en unitaire (vitest 308/308, `deno check` de toutes les fonctions) ; **non déployé** (ni dev ni prod), **non testé dans un navigateur**, non commité.
**Règle :** contrôler `cat supabase/.temp/linked-project.json` avant tout `functions deploy` (le lien du CLI change de projet).

## 1. Ce qui change

| # | Constat (audit M3) | Correction |
|---|---|---|
| 1 | `Access-Control-Allow-Origin: *` sur 61 fonctions | Nouveau `supabase/functions/_shared/http.ts`. `serveCors(niveau, handler)` remplace `serve(...)` / `Deno.serve(...)` dans 69 fonctions (`mcp` exclue : gestionnaire propre). Trois niveaux, voir §2. Préflight, `Vary: Origin`, en-têtes `x-supabase-client-*` gérés au même endroit. |
| 2 | Exception non rattrapée = réponse brute | Le wrapper renvoie HTTP 500 `{ success:false, error:"Une erreur est survenue. Réessayez dans un instant." }` et journalise la cause. |
| 3 | `error.message` exposé (clés manquantes `LOVABLE_API_KEY is not configured`, erreurs Postgres, erreurs de passerelle IA) | 40 sites remplacés par un message fixe ; la cause reste dans `console.error`. Webhooks et tâches planifiées comprises. |
| 4 | Erreurs d'authentification en HTTP 200 | `process-payment` (401 session, 403 compte tiers, 429 débit, 400 validation/montant/code promo, 404 boutique, 502 passerelle, 503 indisponible), `verify-payment` (401/403), `finance-advisor` (401), `send-booking-notification` et `send-contact-notification` (401). |
| 5 | Les appelants lisaient `data.error` (vide en 4xx) | `src/lib/functionError.ts` : `readFunctionError(error, data, repli)` lit le corps de la réponse, sinon un message par code HTTP, jamais « Edge Function returned a non-2xx status code ». Branché sur `process-payment` (4 appelants) et `finance-advisor`. |
| 6 | Page 404 | Faux badge « Status : Opérationnel » retiré, faux numéro WhatsApp `0707070707` remplacé par le numéro support réel, `noindex, nofollow` + titre (Vercel répond 200 à toute URL : « soft 404 »), chemin long qui ne déborde plus, animation qui n'existait pas retirée, texte plus sobre. |

## 2. Niveaux CORS

| Niveau | Comportement | Fonctions |
|---|---|---|
| `app` | Origine en liste blanche : `APP_URL`, `ecomfy.cloud`, `www.ecomfy.cloud`, secret `ALLOWED_ORIGINS`, `http://localhost:*` et `127.0.0.1:*` (développement), `https://localhost` et `capacitor://localhost` (application native). Autre origine : pas d'en-tête (le navigateur bloque), préflight en 403. | tableau de bord, studio IA, fondateur, facturation, collaborateurs, GSC, livraison… (tout ce qui n'est pas listé ci-dessous) |
| `public` | `*` conservé **volontairement** : les vitrines tournent sur les domaines personnalisés des boutiques, origine inconnue. Pas de cookie, l'accès repose sur l'en-tête `Authorization` et sur les contrôles de la fonction. | `dynamic-sitemap`, `ecomfy-pay-initiate`, `generate-showcase-site`, `get-vapid-key`, `handle-email-unsubscribe`, `send-booking-notification`, `send-contact-notification`, `share-product`, `shop-ai-assistant-chat`, `shop-ai-assistant-tts`, `shop-chatbot`, `showcase-chat`, `track-conversion`, `track-shop-visit`, `translate-product`, `translate-ui`, `verify-payment` |
| `server` | Aucun en-tête CORS (aucun navigateur légitime). | webhooks (`geniuspay-webhook`, `ecomfy-pay-webhook`), `ecomfy-pay-settlement`, tâches planifiées, files d'e-mails, `auth-email-hook`, `payment-callback`, `app-health-monitor`, `app-remediation`, etc. |

Changer le niveau d'une fonction = changer le premier argument de `serveCors` dans son `index.ts`.

## 3. Avant de déployer

1. **Secret `ALLOWED_ORIGINS`** (séparé par des virgules) sur chaque projet qui reçoit des appels depuis un autre domaine que `ecomfy.cloud` :
   - dev : l'adresse de préproduction Vercel (`https://….vercel.app`), sinon **tout le tableau de bord de la préproduction est bloqué** ;
   - prod : rien si l'application n'est servie que depuis `ecomfy.cloud`.
   ```bash
   npx supabase@latest secrets set ALLOWED_ORIGINS="https://<préproduction>.vercel.app" --project-ref <ref>
   ```
   (`INVITE_ALLOWED_ORIGINS` de `invite-shop-collaborator` reste distinct.)
2. Vérifier que `APP_URL` vaut bien le domaine public (`https://ecomfy.cloud`).
3. Ordre : **déployer les fonctions d'abord, puis le front**. L'inverse est sans risque aussi : `readFunctionError` accepte les anciennes réponses 200.

## 4. Déploiement

```bash
cat supabase/.temp/linked-project.json    # contrôler le projet
# Toutes les fonctions changées (le wrapper est dans _shared : le déploiement par fonction l'embarque)
git diff --name-only HEAD -- supabase/functions | sed -n 's#supabase/functions/\([^/]*\)/.*#\1#p' | sort -u | grep -v '^_shared$' \
  | xargs -n1 -I{} npx supabase@latest functions deploy {} --project-ref <ref>
```
`geniuspay-webhook` et `ecomfy-pay-webhook` doivent garder `verify_jwt = false` (déjà dans `supabase/config.toml`).

## 5. Recette après déploiement (navigateur)

À faire sur la dev avant la prod, avec la console réseau ouverte :

- [ ] Tableau de bord ouvert depuis l'origine habituelle : aucune erreur CORS ; une fonction `app` répond avec `Access-Control-Allow-Origin` = l'origine exacte et `Vary: Origin`.
- [ ] `curl -i -X OPTIONS -H "Origin: https://evil.example" -H "Access-Control-Request-Method: POST" https://<ref>.supabase.co/functions/v1/finance-advisor` → 403 sans en-tête CORS.
- [ ] Même appel avec `Origin: https://ecomfy.cloud` → 204 avec les en-têtes.
- [ ] Vitrine sur un domaine personnalisé : commande, `track-shop-visit`, `track-conversion`, assistant IA (flux) fonctionnent.
- [ ] Paiement : session expirée → message « Votre session a expiré… » (et non « non-2xx ») ; achat de crédits, abonnement, règlement de commission démarrent toujours ; code promo invalide → message du serveur.
- [ ] Application Android/iOS : une action authentifiée (ex. notifications) passe.
- [ ] Une URL inconnue (`/n-importe-quoi`) affiche la 404 ; `document.head` contient `<meta name="robots" content="noindex, nofollow">` ; le lien WhatsApp ouvre le numéro support.
- [ ] Webhook GeniusPay en sandbox : toujours acquitté (aucun en-tête CORS ne doit gêner).

## 6. Ce qui n'est pas traité (à décider)

- **~99 réponses `status: 200` restantes** : succès légitimes, mais aussi des erreurs métier d'autres fonctions (IA, quotas, `invite-shop-collaborator`…). Elles supposent que chaque appelant lise le corps d'une 4xx ; à migrer fonction par fonction avec `readFunctionError`.
- **`invite-shop-collaborator` reste en 200 + `{ success:false, error:<code> }`** : le front s'appuie sur ces codes pour **bloquer** le repli par écriture directe (M7). Passer en 4xx sans changer ce front le réactiverait.
- **`app-remediation`** renvoie encore `error?.message` (10 sites) : réservée au fondateur / à la supervision, à reprendre avec le reste.
- **Vraie réponse 404 HTTP pour les pages inconnues** : impossible avec un rewrite `/(.*) → /index.html` sur Vercel sans lister toutes les routes ; `noindex` limite l'effet SEO.
- `Access-Control-Allow-Origin` reste écrit en dur dans les fichiers (le wrapper l'écrase) ; à nettoyer quand chaque fonction sera relue.
- `ecomfy-pay-initiate` accepte tout domaine : une limite par boutique/IP reste la vraie protection (déjà en place, limite 5 commandes/h).

## 6 bis. Retour arrière

Front : `git revert` des fichiers `src/`. Fonctions : redéployer la version précédente de chaque fonction ; sans le wrapper, les réponses redeviennent `*` + 200, le front reste compatible.

## 7. Fichiers

`supabase/functions/_shared/http.ts` (+ `supabase/tests/http-cors.test.ts`, 10 cas) · 69 `supabase/functions/*/index.ts` · `src/lib/functionError.ts` (+ test, 6 cas) · `src/pages/NotFound.tsx` · `src/components/AICreditsBadge.tsx`, `shop/BillingPaymentModal.tsx`, `shop/PayCommissionDialog.tsx`, `shop/SubscriptionCard.tsx`, `shop/ShopFinances.tsx`.
