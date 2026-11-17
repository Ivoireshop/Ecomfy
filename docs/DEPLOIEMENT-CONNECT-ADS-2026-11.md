# Connect Ads : Business Manager et OAuth sécurisé (17/11/2026)

## Ce qui change

| Avant | Après |
|---|---|
| Le marchand colle un jeton Meta et un ID de compte dans un formulaire | « Se connecter avec Facebook » (OAuth 2.0), puis choix du **Business Manager** et des comptes publicitaires |
| Jeton stocké dans `ad_accounts.access_token`, **lisible et modifiable** depuis le navigateur (XSS = vol du jeton ; jeton arbitraire insérable) | Jeton long (~60 j) dans `meta_ads_connections`, **aucun droit** pour `anon` / `authenticated` ; `ad_accounts` écrite par le service role seul |
| Jeton en paramètre d'URL vers Graph | Jeton en en-tête `Authorization`, plus `appsecret_proof` sur chaque appel |
| ID de compte saisi à la main, non vérifié | Chaque compte est relu chez Meta avec le jeton avant enregistrement (le navigateur n'est pas cru) |
| — | `state` OAuth signé (HMAC), lié à l'utilisateur et à la boutique, expire en 10 min |
| — | Bouton « Révoquer l'accès » : révocation chez Meta + suppression du jeton |

Les comptes déjà connectés avec un jeton manuel **continuent de se synchroniser** (badge « Jeton manuel ») ; les reconnecter par Facebook remplace leur jeton.

## Ajout : conversions Meta à côté des dépenses (17/11/2026)

- `sync-ad-spend` demande aussi à l'API Insights les **achats attribués** (`actions`), leur **valeur** (`action_values`), les impressions et les clics. « purchase » est prioritaire, l'achat pixel sert de repli, jamais les deux cumulés (même règle que `reconcile-tracking`).
- Migration `20261117110000_ad_spend_conversions.sql` : colonnes `purchases`, `purchase_value`, `impressions`, `clicks` sur `ad_spend_daily`, **NULL tant que le jour n'est pas resynchronisé** (inconnu ≠ zéro). Elle retire aussi les politiques INSERT/UPDATE et les droits d'écriture de `authenticated` : jusqu'ici un propriétaire pouvait écrire ses propres dépenses par l'API REST. Seul le service role (la fonction) écrit désormais.
- Finances (`ShopFinances.tsx`) : carte « Achats attribués par Meta » avec **ROAS Meta** (valeur attribuée / dépenses des jours synchronisés), distinct du ROAS « encaissé ». « — » tant qu'aucun jour n'est synchronisé.
- Le nombre d'achats est celui que **Meta attribue aux publicités**, pas le nombre d'événements CAPI reçus.
- Après déploiement : **relancer la synchronisation de chaque compte** pour remplir l'historique (les anciennes lignes restent NULL sinon). `purchase_value` est dans la devise du compte (colonne `currency`) ; une devise sans parité fixe n'est pas convertie en FCFA.
- Les migrations `20261117100000` puis `20261117110000` s'appliquent dans cet ordre ; fonctions `sync-ad-spend`, `meta-ads-oauth`, `reconcile-tracking` ; puis front.
- Sur Windows, `supabase functions deploy` échoue au bundling Docker (chemin de volume) : ajouter `--use-api`.

## Fichiers

- `supabase/migrations/20261117100000_meta_ads_oauth.sql`, `supabase/migrations/20261117110000_ad_spend_conversions.sql`
- `supabase/functions/meta-ads-oauth/index.ts` (nouvelle) et `supabase/functions/_shared/metaAds.ts`
- `supabase/functions/sync-ad-spend/index.ts`, `supabase/functions/reconcile-tracking/index.ts` (lisent le jeton de la connexion)
- `src/pages/MetaAdsCallback.tsx` (route `/meta-ads/callback`), `src/services/metaAdsService.ts`, `src/components/shop/AdAccountsManager.tsx`, `src/App.tsx`

## Prérequis chez Meta (à faire une fois)

1. developers.facebook.com → application de type **Entreprise** → ajouter **Facebook Login**.
2. **URI de redirection OAuth valides** : `https://ecomfy.cloud/meta-ads/callback` (et l'URL de la dev si besoin).
3. Permissions : `ads_read` et `business_management`. En mode **Développement**, seuls les rôles de l'application peuvent se connecter ; pour tous les marchands, passer l'application en mode **Live** avec **accès avancé** à `ads_read` et `business_management` (revue d'application Meta, avec vidéo de démonstration). Délai à prévoir : c'est le vrai chemin critique.
4. Ajouter une politique de confidentialité et l'URL de suppression des données dans l'application Meta.

## Secrets Supabase (dev puis prod)

```
supabase secrets set META_APP_ID=... META_APP_SECRET=...
supabase secrets set META_OAUTH_REDIRECT_URI=https://ecomfy.cloud/meta-ads/callback   # facultatif, c'est la valeur par défaut
supabase secrets set META_STATE_SECRET=<aléatoire 32+ octets>                         # facultatif, sinon META_APP_SECRET
```

`META_GRAPH_VERSION` (déjà utilisé ailleurs, `v23.0` par défaut) s'applique aussi.

## Ordre de déploiement (important)

1. **Migration** `20261117100000` (ajoute les colonnes, la table, puis retire la lecture du jeton et l'écriture directe).
2. **Fonctions** : `meta-ads-oauth` (nouvelle, `verify_jwt` par défaut = activé), `sync-ad-spend`, `reconcile-tracking`.
3. **Front** (page de retour + nouveau gestionnaire).

⚠️ La migration AVANT le front : l'ancien front insère dans `ad_accounts` et sélectionne `access_token`, ce qui est refusé après la migration. Inversement, déployer le front avant la migration donnerait un écran sans effet. Fenêtre à garder courte. Jamais de `db push` (voir déploiement du 07/11).

## Recette

1. Boutique → Finances → Connexions publicitaires → « Se connecter avec Facebook ».
2. Autoriser sur Meta → retour sur `/meta-ads/callback` → choisir un Business Manager → cocher des comptes → « Connecter ».
3. Retour boutique : les comptes apparaissent avec leur Business Manager, dépenses synchronisées.
4. Vérifier qu'un utilisateur connecté ne peut plus lire le jeton :
   `GET /rest/v1/ad_accounts?select=access_token` avec son JWT → `permission denied`.
5. « Révoquer l'accès » : l'accès disparaît dans Meta (Paramètres → Intégrations professionnelles), les comptes passent en erreur « reconnectez ».
6. Refuser `business_management` dans la fenêtre Meta : seuls les comptes personnels sont proposés, avec un message.

## Limites connues

- Jeton long Meta : ~60 jours, **sans renouvellement automatique** (Meta ne le permet pas sans nouvelle autorisation). L'alerte d'expiration à 7 jours existante (`check-ad-token-expiry`) s'applique ; son e-mail parle encore de « token ».
- TikTok et Google Ads restent « bientôt ».
- Conversions : jamais lues sur un vrai compte Meta (pas d'application Meta) ; le format `actions` / `action_values` suit la documentation Insights.
- Jamais testé de bout en bout contre Meta : aucune application Meta configurée au moment de l'écriture.
