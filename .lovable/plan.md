# Plan : noms de produits dans les notifications + abonnement Starter

## 1. Précision du produit commandé dans les notifications (rapide)

Aujourd'hui la liste des commandes affiche déjà bien chaque produit. Ce qui manque, c'est :
- la **notification push** (FCM) qui dit juste « Nouvelle commande » sans préciser quel produit,
- l'**annonce vocale** qui dit « Tu as une nouvelle commande de [ville] » sans le produit.

### Changements
- `supabase/functions/send-push-notification/index.ts` : récupérer les `order_items(product_name, quantity)` de la commande et ajouter une ligne `📦 {qte}x {produit}` (ou « 2 produits » si plusieurs lignes, en listant les 2 premiers max) dans le corps de la notif (web + Android + iOS + payload `data`).
- `src/hooks/useOrderNotifications.ts` : adapter `getOrderAnnouncement` pour inclure le nom du premier produit dans la phrase vocale (« Nouvelle commande de [produit] à [ville] »).
- `src/components/shop/OrdersList.tsx` : déjà OK, on ne touche pas.

## 2. Abonnement boutique « Starter » 12 000 FCFA/mois (sans commission)

### Logique métier
- Les boutiques restent par défaut en plan **Free** : commission de 50 FCFA/commande, paiement obligatoire quand le solde atteint 12 000 FCFA (comportement actuel inchangé).
- Nouvelle option **Starter** à 12 000 FCFA/mois : tant que l'abonnement est actif, **aucune commission** n'est ajoutée sur les nouvelles commandes, peu importe le volume.
- À l'expiration (30 jours après paiement), retour automatique en Free, et les nouvelles commandes recommencent à générer la commission de 50 FCFA.
- Les futurs paliers **Business (24 000)** et **Premium (60 000)** sont préparés dans la structure mais désactivés dans l'UI (« Bientôt disponible »).

### Base de données (migration)
Sur `shops` :
- `subscription_plan text not null default 'free'` (`'free' | 'starter' | 'business' | 'premium'`)
- `subscription_active_until timestamptz null`
- `subscription_started_at timestamptz null`

Mise à jour du trigger `sync_shop_order_stats` : ne **plus incrémenter** `commission_balance_due` ni armer `payment_deadline` si la boutique a `subscription_active_until > now()`.

Nouvelle RPC `apply_shop_subscription(p_shop_id, p_user_id, p_plan, p_amount, p_transaction_reference, p_payment_method)` :
- vérifie le paiement, prolonge `subscription_active_until` de 30 jours (en cumulant si déjà actif),
- pose `subscription_plan = p_plan`, `subscription_started_at = coalesce(existing, now())`,
- trace dans `commission_payments` avec note « Abonnement Starter mensuel ».

### Paiement (edge functions)
- `process-payment/index.ts` : accepter un nouveau `payment_type = 'shop_subscription'` avec `plan` et `shop_id` dans la metadata. Montant 12 000 FCFA pour `starter`.
- `geniuspay-webhook/index.ts` et `verify-payment/index.ts` : brancher `apply_shop_subscription` quand `payment_type === 'shop_subscription'`.

### UI
Dans `src/components/shop/ShopFinances.tsx`, section « Frais plateforme VisualPro », ajouter une carte **Abonnement** :
- affiche le plan actuel + date d'expiration si actif,
- bouton « Activer Starter — 12 000 FCFA/mois » qui appelle `process-payment` puis ouvre la page de paiement GeniusPay,
- mention « Business 24 000 / Premium 60 000 — bientôt disponibles » en désactivé,
- petit encart explicatif : « Avec Starter, aucune commission par commande ».

### Affichage condition
- Dans le bloc commission, si abonnement actif : remplacer « Commission due » par « ✓ Abonnement Starter actif — aucune commission » et masquer le seuil.
- `BillingBanner` : ne pas alerter pour suspension/seuil quand l'abonnement est actif.

## Hors scope (à confirmer plus tard)
- Renouvellement automatique (carte sauvegardée) — pour l'instant l'utilisateur repaye manuellement chaque mois.
- Annulation/remboursement prorata.
- Plans Business et Premium fonctionnels.
