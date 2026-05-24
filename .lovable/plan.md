## Objectif

Faire en sorte que le plan d'abonnement (Free / Starter / Business) modifie réellement l'expérience :

1. **Bannière "Montant dû"** masquée pour les abonnés actifs (Starter, Business).
2. **Génération de GIFs animés** plafonnée selon le plan :
   - Free : 10 GIFs / mois
   - Starter : 30 GIFs / mois
   - Business : illimité
3. **Optimiseur IA fiche produit** (Hormozi / PAS / AIDA) activé automatiquement pour Starter et Business — verrouillé pour Free avec un encart "Passez au plan Starter".

La génération d'images IA classique du produit reste gratuite pour tous (inchangée).

## Changements

### 1. Base de données (1 migration)

Ajouter sur `shops` :
- `gifs_generated_count` (int, default 0)
- `gifs_period_start` (timestamptz, default now()) — fenêtre glissante de 30 jours
- RPC `increment_shop_gif_count(_shop_id uuid)` : reset si > 30 jours, incrémente, renvoie le nouveau compteur.

### 2. `BillingBanner` masquée pour abonnés

Dans `src/pages/ShopEditor.tsx`, ne rendre `<BillingBanner />` que si `shop.subscription_active_until` est nul ou expiré.

### 3. Quota GIF

- `ProductEditor.tsx` : transmettre `shop` (plan + compteur) à `ProductGifGenerator`.
- `ProductGifGenerator.tsx` :
  - Calcule la limite à partir du plan : `Free=10`, `Starter=30`, `Business=Infinity`.
  - Affiche "X / N GIFs utilisés ce mois".
  - Bloque le bouton "Générer" si quota atteint avec CTA "Passer au plan Starter / Business".
  - Après génération réussie, appelle `increment_shop_gif_count` puis met à jour l'état local.

### 4. Optimiseur IA gating par plan

`ProductAIOptimizer.tsx` :
- Recevoir `subscription_plan` via `shop`.
- Si plan = `free` : afficher un encart bloquant "Réservé aux plans Starter et Business" + bouton vers `ShopFinances` (abonnement).
- Si plan = `starter` ou `business` : activer automatiquement (plus de toggle manuel obligatoire, l'option reste pour désactiver).

## Hors-scope

- Pas de changement aux fonctions de paiement, à la table `shop_secrets`, ni à la logique de commission.
- Le plan Business reste affiché comme « bientôt disponible » côté abonnement ; le gating IA & GIF Business est néanmoins prêt pour quand il sera activé.