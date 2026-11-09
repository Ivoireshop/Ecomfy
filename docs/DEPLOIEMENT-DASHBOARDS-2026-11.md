# Tableaux de bord marchand et fondateur : KPI réels (09/11/2026)

Plus aucune valeur fictive ou estimée sur le tableau de bord marchand (`/dashboard`) ni sur la console fondateur (`/founder-dashboard`, audit des transactions, dépannage). **Front seul : pas de migration, pas d'Edge Function.**

## Règles de calcul

**Marchand** (`src/lib/dashboardKpis.ts`, `src/pages/Dashboard.tsx`)
- Une vente = commande hors `cancelled` et `returned` (même définition que Statistiques et Aperçu de la boutique).
- Tendance : « Nouveau » si la veille valait 0 et aujourd'hui > 0 ; rien si les deux valent 0. Comparaison avec hier **jusqu'à la même heure**.
- « — » pendant le chargement ou en cas d'erreur de lecture (jamais « 0 » par défaut), bandeau d'erreur, avertissement si la lecture est tronquée (pagination 1000 lignes, 20 pages max).
- Le rôle affiché est le vrai rôle du compte (plus « Admin » en dur).

**Fondateur** (`src/lib/founderMetrics.ts`, `src/services/financialMetricsService.ts`)
- **Revenus encaissés** = paiements `payments` au statut payé + règlements de commission saisis à la main (`commission_payments`).
  - Une commission n'est ajoutée que si sa référence est **absente** de `payments` (`transaction_id`, `metadata.gateway_reference`, `metadata.order_id`) : les règlements en ligne partagent la référence de leur ligne `payments`, ils ne sont pas comptés deux fois.
  - Ligne sans référence, sans date ou au montant invalide : ignorée et signalée (« paiements exclus »).
- **Devises** : EUR converti à 655,957, XOF/XAF à parité 1:1 ; toute autre devise est exclue et comptée dans le bandeau.
- **MRR** : tarif lu dans `subscription_plans` (repli sur `FALLBACK_PLANS` si la table est absente), par propriétaire, abonnement valide (`subscription_active_until` > maintenant). Annuel = prix annuel / 12 s'il reste plus de 120 jours (heuristique). Plan inconnu : compté mais « Tarif inconnu ». C'est le **tarif actuel** du plan, pas celui payé à l'époque.
- **Boutiques activées** : montant, date et référence viennent du paiement `payments` de **cette** boutique ; sans paiement, « — ».
- Périodes alignées entre cartes, courbes et audit ; jours calculés en heure locale ; pagination 1000 lignes ; erreurs de lecture remontées ; écouteurs temps réel (`subscriptions`, `payments`, `commission_payments`).
- **Modal « Activer par ID Boutique »** : plus de 12 000 par défaut. Activation = **1 300 FCFA** (`SHOP_ACTIVATION_FEE_FCFA` dans `src/lib/founderBilling.ts`, miroir de `supabase/functions/_shared/pricing.ts`, à garder identiques). Commission = solde `commission_balance_due` de la boutique désignée par ID ou slug exact, sinon champ vide. Montant obligatoire.
- `billing_history` retirée : la table n'a jamais été créée ni alimentée dans le dépôt. La sonde de dépannage lit `payments`.

## Accès fondateur : plus de raccourci par e-mail

`FounderDashboard`, `FounderTroubleshooting`, `FounderRoute` et `AppSidebar` n'ouvrent l'accès que si `user_roles` contient `founder` (ou `co_founder`, `shareholder`, `admin` pour `FounderRoute` et `AppSidebar`). Une erreur de lecture **ferme** l'accès (ou masque le menu).

**À vérifier avant la mise en prod** : le compte fondateur a bien sa ligne `founder` dans `user_roles` en prod (insérée par la migration `20260831200000`) :

```sql
select r.role from user_roles r join auth.users u on u.id = r.user_id
where u.email = 'djateulrich@gmail.com';
```

Sans cette ligne, le fondateur serait refusé à l'entrée.

## Vérifications faites (09/11, base de dev = réplique de la prod)

- 222 tests unitaires verts (dont 15 pour `dashboardKpis`, 21 pour `founderMetrics`), typecheck sans nouvelle erreur, ESLint sans erreur.
- Dédoublonnage des commissions : 65 lignes `commission_payments` ; 62 ont un paiement `payments` à la même référence, même montant, statut `completed` (exclues du double comptage) ; 3 sont manuelles (`MANUAL-WAVE_DIRECT-…`, 7 600 + 7 600 + 10 387 FCFA) et sont ajoutées.
- Recoupement navigateur (compte fondateur) : revenus 299 550 FCFA = 273 963 + 25 587 ; 67 paiements ; MRR 24 000 FCFA (2 abonnements pro mensuels) ; 39 boutiques activées ; 32 clients payants ; 69 inscrits ; 21 générations IA ; marchand : 735 commandes / 6 351 500 FCFA sur 30 jours (739 − 4 annulées).
- Modal : montant vide par défaut, 1 300 pour une activation ; audit : 67 transactions, même total que la carte.
- Compte non fondateur : `/founder-dashboard` et `/founder-troubleshooting` refusés, aucun menu Administration.

## Points restants (non traités)

1. **`subscription_plans` absente de la dev** : la migration `20261107100000` n'y est plus (probablement effacée par le miroir prod→dev du 04/11). Le MRR utilise donc les tarifs de repli du code, qui donnent le même résultat aujourd'hui. **En prod, appliquer cette migration avant le front** (voir `DEPLOIEMENT-PLANS-ABONNEMENT-2026-11.md`), sinon les tarifs modifiés par le fondateur ne sont pas pris en compte.
2. **`includes("djateulrich")` restants** : `src/pages/AssociateSpace.tsx` (`isMainFounder`) et `src/pages/CorporateGovernance.tsx` (3 occurrences). Effet d'affichage seulement (un e-mail comme `x.djateulrich@…` y serait traité en fondateur principal à l'écran, sans droit côté serveur). À remplacer par le rôle réel.
3. **`FOUNDER_EMAILS`** dans `supabase/functions/app-health-monitor/index.ts` : liste d'e-mails destinataires des alertes, pas un contrôle d'accès. À laisser ou à lire depuis `user_roles`.
4. **Modal « Activer par ID »** : la résolution par **nom** (`ilike`) prend la boutique la plus récente en cas d'homonymes. Préférer l'ID ou le slug.
5. **MRR** : heuristique annuel/mensuel (> 120 jours restants) et tarif actuel du plan ; un plan supprimé ou renommé apparaît « Tarif inconnu ».
6. **Lignes « Compte inconnu » dans l'audit** : paiements dont le profil n'a pas d'e-mail (compte supprimé ou profil incomplet). Données, pas un défaut d'affichage.
7. **`billing_history`** : si la prod contenait des lignes écrites hors du dépôt, elles ne sont plus comptées. Rien ne l'indique dans le code ; à contrôler en prod.
8. **Non testé** : bouton « Exporter CSV », sélecteur de période (7 j / 30 j / mois dernier), temps réel, cas d'erreur de lecture, recette en prod.
9. **Ancien code mort** : `eslint-suppressions.json` a été ajusté (entrées de `Dashboard.tsx` et `financialMetricsService.ts` retirées ; `any` 10→8 dans `FounderDashboard`, 7→6 dans `FounderTroubleshooting`). Un `npm run lint:prune` global toucherait d'autres fichiers : ne pas le lancer sans relire le diff.

## Fichiers

| Élément | Fichier |
|---|---|
| KPI marchand (pur, testé) | `src/lib/dashboardKpis.ts`, `src/lib/dashboardKpis.test.ts` |
| KPI fondateur (pur, testé) | `src/lib/founderMetrics.ts`, `src/lib/founderMetrics.test.ts` |
| Service financier | `src/services/financialMetricsService.ts` |
| Pages et composants | `src/pages/Dashboard.tsx`, `src/pages/FounderDashboard.tsx`, `src/pages/FounderTroubleshooting.tsx`, `src/components/founder/RevenueAuditModal.tsx` |
| Accès fondateur | `src/components/FounderRoute.tsx`, `src/components/AppSidebar.tsx` |
| Frais d'activation | `src/lib/founderBilling.ts` |

## Ordre de déploiement

Front seul, après le point 1 ci-dessus si les plans paramétrables sont déjà en prod. Rollback : revenir au commit précédent du front.
