
# Système de contrôle de paiement progressif des boutiques

Ajout non destructif au module e-commerce actuel. Le système existant utilise déjà `commission_balance_due`, `commission_threshold` (12 000 FCFA), `payment_deadline`, `is_suspended` et `received_during_lock`. On étend cette base au lieu de créer une table parallèle.

## 1. Base de données (migration unique)

Étendre `public.shops` avec :
- `shop_payment_status` text : `active | payment_pending | locked | final_suspension`
- `threshold_reached_at` timestamptz
- `first_deadline_at` timestamptz (= threshold_reached_at + 3 jours)
- `locked_at` timestamptz
- `second_deadline_at` timestamptz (= locked_at + 3 jours)
- `final_suspension_at` timestamptz

Créer table `public.shop_payment_events` (audit léger) :
- shop_id, event_type (`threshold_reached | payment_partial_50 | payment_partial_75 | paid_full | locked | final_suspension | reactivated | manual_override`), amount, note, created_by, created_at
- RLS : owner SELECT, founder ALL, service_role ALL. GRANT explicites.

Mise à jour des fonctions existantes :
- `sync_shop_order_stats` : quand le seuil est franchi, écrit `threshold_reached_at`, `first_deadline_at`, `shop_payment_status='payment_pending'`, insert event.
- `apply_commission_payment` : après application, recalcule le statut :
  - `>= 100%` (balance = 0) → `active`, reset tous les timestamps, `is_suspended=false`, révèle `received_during_lock`.
  - `>= 75%` ou `>= 50%` du montant dû initial → prolonge `first_deadline_at` de 3 jours, statut `payment_pending`.
  - Log event `payment_partial_50/75` ou `paid_full`.
- Nouvelle fonction `public.enforce_shop_payment_state()` (SECURITY DEFINER) : parcourt tous les shops et
  - passe `payment_pending → locked` si `first_deadline_at < now()` et balance > 0 (set `locked_at`, `second_deadline_at = locked_at + 3j`, `is_suspended=true`).
  - passe `locked → final_suspension` si `second_deadline_at < now()` (set `final_suspension_at`).
- Cron pg_cron toutes les 15 min (insert tool, pas migration).

Nouvelle fonction `public.can_manage_shop(_shop_id uuid)` STABLE SECURITY DEFINER :
- Retourne `true` si l'utilisateur est owner ET `shop_payment_status IN (active, payment_pending)`.
- Utilisée dans RLS des `products`, `orders`, `shop_secrets`, `shop_ai_assistants`, `ad_accounts`, etc. pour bloquer les mutations quand `locked`/`final_suspension`. Les policies SELECT restent inchangées (lecture des produits/commandes toujours possible → conforme au comportement demandé).

## 2. Backend front-side helper

`src/lib/shopPaymentStatus.ts` :
- `getShopPaymentInfo(shopId)` → `{ status, amountDue, amountPaid50, amountPaid75, amountPaidFull, thresholdReachedAt, firstDeadline, lockedAt, secondDeadline, finalSuspensionAt, remainingMs, canOperate, canReactivate }`
- Hook `useShopPaymentStatus(shopId)` avec realtime subscribe sur `shops`.

## 3. Composants UI (nouveaux, aucun composant existant supprimé)

- `src/components/shop/ShopPaymentCountdown.tsx` : bandeau avec compte à rebours "J HH MM" en direct. Remplace/complète `BillingBanner` uniquement quand `payment_pending` ou `locked`.
- `src/components/shop/ShopPaymentGate.tsx` : overlay plein écran (fond flouté `backdrop-blur` + `bg-red-600/40`), carte centrale blanche, message contextualisé selon statut :
  - `locked` → "Boutique verrouillée. Fermeture définitive dans J HH MM." + bouton "Payer maintenant" + "Contacter le support".
  - `final_suspension` → "Boutique fermée définitivement." + bouton principal "Contacter le support WhatsApp" (pre-rempli), "Payer maintenant" désactivé.
- `src/components/shop/PayCommissionDialog.tsx` (existant) : ajouter 3 boutons rapides 50% / 75% / 100% pré-remplissant le montant. Continue d'utiliser GeniusPay via `process-payment`.

## 4. Intégration ShopEditor / pages

- `src/pages/ShopEditor.tsx` : afficher `ShopPaymentCountdown` en haut si `payment_pending`. Wrapper `ShopPaymentGate` autour du contenu si `locked` ou `final_suspension` → l'overlay bloque toute interaction sauf paiement/support. Onglet "Produits (lecture seule)" reste accessible visuellement.
- `src/pages/ShopManager.tsx` : badge de statut sur la carte boutique.
- Désactiver visuellement (disabled + tooltip) les boutons de mutation dans `ProductsTable`, `ProductEditor`, `ShopSettings`, `OrdersList` quand `!canOperate`. Les mutations serveur sont déjà bloquées par RLS (défense en profondeur).

## 5. Interface admin fondateur

Nouvelle page `src/pages/founder/ShopPaymentControl.tsx` (route `/founder/shop-payments`, protégée par `FounderRoute`) :
- Filtres : `payment_pending`, `locked`, `final_suspension`, `active with balance`.
- Table : boutique, propriétaire, balance, statut, deadlines.
- Actions : "Confirmer paiement manuel" (appelle `apply_commission_payment`), "Réactiver manuellement" (RPC dédiée `founder_reset_shop_payment`), "Voir historique" (events).
- Lien depuis `FounderDashboard`.

## 6. Sécurité (défense en profondeur)

- RLS UPDATE/INSERT/DELETE sur `products`, `product_images`, `orders` (côté vendeur), `shop_secrets`, `shop_ai_assistants`, `shop_installed_themes`, `shop_delivery_connections`, `ad_accounts` : ajouter `AND can_manage_shop(shop_id)`.
- Edge functions sensibles (`create-video-from-image` shop, `shop-ai-assistant-*`) : vérifier statut avant traitement.

## 7. Textes (FR) fidèles au brief utilisateur

Reprend les messages exacts fournis : "Paiement requis : 12 000 FCFA…", "Votre boutique est temporairement verrouillée…", "Fermeture définitive dans…", "Votre boutique a été fermée définitivement…", message WhatsApp automatique.

## Détails techniques

- Boutique existante avec balance déjà due sera migrée : si `payment_deadline IS NOT NULL AND is_suspended=false` → statut `payment_pending`, `first_deadline_at = payment_deadline`, `threshold_reached_at = payment_deadline - interval '3 days'`. Si `is_suspended=true` → `locked`, `locked_at = updated_at`, `second_deadline_at = locked_at + interval '3 days'`.
- Cron via `net.http_post` non nécessaire : la fonction s'exécute en SQL pur, on peut la scheduler directement avec `cron.schedule` + `SELECT public.enforce_shop_payment_state();`.
- Le compte à rebours front est purement affichage ; l'autorité reste le trigger SQL + cron. Le front recharge le statut à `remainingMs = 0`.
- `PayCommissionDialog` continue d'utiliser le flux GeniusPay existant, aucun changement de paiement.

Livrables :
1. Migration SQL (shops + shop_payment_events + fonctions + RLS `can_manage_shop`).
2. Cron via `supabase--insert` après migration.
3. Fichiers front : `shopPaymentStatus.ts`, `ShopPaymentCountdown.tsx`, `ShopPaymentGate.tsx`, `PayCommissionDialog.tsx` (édition), `ShopEditor.tsx` (édition), `ShopManager.tsx` (édition), `ShopPaymentControl.tsx` (nouveau), route dans `App.tsx`, entrée dans `FounderDashboard.tsx`.
