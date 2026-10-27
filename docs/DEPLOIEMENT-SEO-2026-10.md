# Déploiement des correctifs SEO Intelligence (octobre 2026)

Dev est déployé et testé (section 0). **La production reste à faire.**

## 0. État du déploiement (21 octobre 2026)

| Environnement | Migrations | Fonctions | Secrets Google |
|---|---|---|---|
| **Dev** `xfpbpxncserliskrbaim` | Appliquées (2 scripts ci-dessous) | `gsc-oauth-flow`, `gsc-analytics`, `dynamic-sitemap`, `seo-auto-index` déployées avec `--use-api` | **Absents** (aucun identifiant Google fourni) |
| **Production** `yfggrceynzcwklbxhgix` | Non | Non | Non |

Testé sur dev dans le navigateur : audit enregistré et relu après rechargement, historique, correctifs automatiques, éditeur de balises, données Search Console (cache) avec période, pagination, opportunités, export CSV, bouton Synchroniser (erreur propre), Déconnecter, et droits SQL (jetons illisibles, écriture directe refusée). **Non testé : le vrai aller-retour OAuth avec Google** (il faut des identifiants Google).

## 1. Base de données

Ne pas utiliser `supabase db push` sur dev (≈ 25 migrations en attente, voir `DEPLOIEMENT-DEV-2026-10.md`). Appliquer ces deux fichiers, dans l'ordre :

```powershell
npx supabase@latest db query --linked -f supabase/migrations/20260902120000_ecomfy_seo_intelligence.sql
npx supabase@latest db query --linked -f supabase/migrations/20261021120000_seo_intelligence_protect_tokens.sql
```

1. `20260902120000_ecomfy_seo_intelligence.sql` : crée les tables `shop_seo_*`. **Corrigée le 21/10** : l'administrateur se détecte avec `has_role(auth.uid(), 'admin')` (table `user_roles`). L'ancienne version lisait `profiles.role` / `profiles.is_admin`, des colonnes qui n'existent pas sur dev : la migration échouait.
2. `20261021120000_seo_intelligence_protect_tokens.sql` : fonction `is_shop_owner_or_collaborator` (avec `search_path` figé), politiques d'isolation par boutique, jetons Google illisibles depuis le navigateur, index uniques des caches. **Autonome** : elle remplace `20260902140000` pour la partie SEO.

> **Ne pas appliquer `20260902140000_strict_multitenant_privacy.sql` en l'état.** Ses politiques lisent aussi `profiles.role` / `is_admin` (échec garanti sur dev) et contiennent une adresse e-mail codée en dur. Hors périmètre SEO, à reprendre séparément.

Vérification (doit renvoyer `false` pour les jetons et `true` pour le statut) :

```sql
select has_column_privilege('authenticated','public.shop_seo_connections','google_refresh_token','SELECT') as jeton_lisible,
       has_column_privilege('authenticated','public.shop_seo_connections','gsc_connected','SELECT') as statut_lisible;
```

## 2. Secrets des fonctions Edge

| Secret | Valeur |
|---|---|
| `GOOGLE_OAUTH_CLIENT_ID` | identifiant client OAuth (type « Application Web ») |
| `GOOGLE_OAUTH_CLIENT_SECRET` | secret client, sert aussi à signer le paramètre `state` |
| `GOOGLE_OAUTH_REDIRECT_URI` | `https://ecomfy.cloud/seo` (valeur par défaut si absent) |
| `GSC_STATE_SECRET` | optionnel : secret dédié à la signature du `state` |

Dans la console Google Cloud : activer l'API **Google Search Console API**, ajouter `https://ecomfy.cloud/seo` aux URI de redirection autorisées, et déclarer le scope `https://www.googleapis.com/auth/webmasters.readonly` sur l'écran de consentement.

## 3. Fonctions à déployer

```
supabase functions deploy gsc-oauth-flow --project-ref <ref> --use-api
supabase functions deploy gsc-analytics --project-ref <ref> --use-api
supabase functions deploy dynamic-sitemap --project-ref <ref> --use-api
supabase functions deploy seo-auto-index --project-ref <ref> --use-api
```

- `gsc-oauth-flow` : désormais authentifiée, `state` signé, jetons stockés côté serveur (corrige M2). Actions `get_auth_url`, `exchange_code`, `set_property`, `disconnect`.
- `gsc-analytics` : importe requêtes et pages dans le cache pour une boutique (30 synchronisations par heure et par utilisateur).
- `dynamic-sitemap`, `seo-auto-index` : domaine `ecomfy.cloud` (au lieu de `visuelpro.cloud`) et URL produit `/shop/<slug>/p/<produit>`.

## 4. Parcours de test

1. `/seo` : la boutique de l'utilisateur s'affiche (plus de « Boutique Démo »).
2. Onglet Google Search Console → **Connecter** → autorisation Google → retour sur `/seo` → choisir la propriété → première synchronisation automatique.
3. Les mots-clés, clics et impressions apparaissent ; **Synchroniser Google** rafraîchit la période choisie.
4. Un marchand ne peut pas lier le compte Google d'une autre boutique : le `state` est lié à l'utilisateur, expire en 10 minutes et n'est valable que pour la boutique qu'il possède.

## 5. Limites connues

- L'inspection d'URL Google reste « Indisponible » : l'API URL Inspection n'est pas branchée.
- Une propriété Search Console doit appartenir au compte Google du marchand ; sans domaine personnalisé, une boutique `ecomfy.cloud/shop/<slug>` n'a pas de propriété propre.
- Le total des clics est la somme des 1 000 premières requêtes, donc légèrement inférieur au total réel de Search Console.
