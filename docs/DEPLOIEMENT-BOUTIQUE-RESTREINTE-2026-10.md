# Commandes, boutique restreinte, statistiques et livraisons : correctifs et déploiement (octobre 2026)

**État (22/10/2026) :** code **commité** sur `jeanmarc`. Les trois migrations sont **appliquées et vérifiées sur dev** (`xfpbpxncserliskrbaim`, navigateur compris) ; tests sur base jetable : 22 sur 22 (boutique restreinte) et 28 sur 28 (livraisons). **Production : à faire**, procédure complète en **section 8**.
**Contenu :** sections 1 et 2 (boutique restreinte, statistiques), 6 (livraisons), 7 (commandes, front seul) ; 3 à 5 : déploiement et vérification sur dev ; 8 : production ; 9 : points à retenir.
**Ordre :** migrations `20261021150000`, `20261022100000`, `20261022110000`, puis le front. Ne jamais utiliser `supabase db push`.

## 1. Boutique restreinte

### 1.1 Anomalies

| # | Anomalie | Effet |
|---|---|---|
| R1 | Deux définitions de « restreinte » : la RLS de `orders` ne bloquait que si `is_suspended = true`, `get_shop_orders_secure` masquait selon le statut (`STORE_RESTRICTED`, `locked`, `PAYMENT_OVERDUE`, `final_suspension`) | Un statut restreint sans suspension (ex. `PAYMENT_OVERDUE`) laissait le propriétaire et ses collaborateurs lire noms, téléphones, e-mails et adresses par l'API ; seul l'écran les cachait |
| R2 | Boutique suspendue : la RLS filtrait tout, aucun écran n'appelait `get_shop_orders_secure` | Tableau de bord vide (0 commande, 0 FCFA) au lieu de commandes masquées |
| R3 | `get_shop_orders_secure` renvoyait `notes` en clair | La note interne de livraison peut citer un client |

### 1.2 Corrections

- Migration `20261021150000_restricted_shop_orders_server_masking.sql` :
  - `is_shop_restricted(shop)` : définition unique (suspendue **ou** statut restreint) ;
  - les politiques SELECT « propriétaire » et « collaborateurs » de `orders` l'utilisent : lecture directe refusée si la boutique est restreinte ;
  - `get_shop_orders_secure` s'appuie sur elle et masque aussi `notes` ; signature inchangée.
- `ShopEditor.tsx` : si la ligne de la boutique est restreinte (`isShopRowRestricted`, dans `billingSystem.ts`), les commandes viennent de `get_shop_orders_secure` (masquées, sans articles ni livraisons). L'accueil affiche alors le nombre de commandes, le chiffre d'affaires et les non lus, avec noms masqués.

Non modifiés : fournisseurs de livraison (leur politique propre), fondateurs (passent par la fonction, masqué), UPDATE sur `orders`, `order_items` (pas de donnée personnelle), `get_locked_orders_summary`.

## 2. Statistiques (`ShopStatistics.tsx`)

| # | Anomalie | Correction |
|---|---|---|
| T1 | Tendances « +12,5 % », « +2,1 % », « +5,4 % » écrites en dur | Variation réelle contre la période précédente de même durée (hier, 7 jours précédents, 30 jours précédents). Pastille cachée sans comparaison possible (« Tout », ou rien avant) ; « Nouveau » si la période précédente était à 0 ; rouge et flèche descendante en cas de baisse |
| T2 | Tendance du taux de conversion inventée | Écart en points, seulement si la période précédente a des visites mesurées (visites chargées sur 30 jours : disponible pour « Aujourd'hui » et « 7 jours ») |
| T3 | Visiteurs, pages vues et paniers simulés quand le suivi était faible (8 visiteurs par commande, 120 et 340 par défaut) | Mesures réelles uniquement ; 0 s'il n'y a rien |
| T4 | « Ajouts au panier » simulé (aucune donnée stockée : l'événement part vers les pixels publicitaires) | Remplacé par « Ont consulté un produit » (sessions avec une visite de fiche produit) |
| T5 | Barres de l'entonnoir : `NaN %` sans visiteurs, dépassement possible de 100 % | Plafonnées, 0 sans visiteurs |
| T6 | Heures d'affluence : courbe factice sans commande, créneaux 8h/12h/18h/20h ajoutés de force, seuil arbitraire à 5 commandes | Heures réelles seulement, message sans données, heure la plus forte mise en avant |
| T7 | Objectif mensuel calculé sur la période affichée (« Aujourd'hui » donnait 2 % de l'objectif du mois) | Chiffre d'affaires du mois en cours |
| T8 | Courbe par jour calée sur le jour UTC | Jour local ; « Tout » couvre l'historique (7 à 90 jours) au lieu de 30 |
| T9 | Annulées et retournées comptées comme ventes (correctif précédent, conservé) | Exclues |

Limite connue : les visites ne sont lues que sur 30 jours et plafonnées à 5000 lignes (inchangé).

## 3. Déploiement

1. Appliquer `supabase/migrations/20261021150000_restricted_shop_orders_server_masking.sql` (idempotent). Prérequis : `has_shop_role`, `is_shop_owner`, `is_shop_collaborator`, `has_role`, type `shop_collab_role`, colonnes `shops.is_suspended` et `shops.shop_payment_status` (tous déjà présents).
2. Déployer le front.
3. Vérifier : boutique restreinte (compte propriétaire) → `select count(*) from orders` via l'API renvoie 0 ; `rpc/get_shop_orders_secure` renvoie des lignes masquées ; l'accueil du tableau de bord affiche les commandes masquées.

**Ne pas inverser l'ordre :** front avant migration, une boutique restreinte lirait directement `orders` et serait refusée par la nouvelle RLS seulement après la migration ; migration avant front, un ancien front verrait 0 commande sur une boutique restreinte (comportement des boutiques suspendues aujourd'hui).

**Retour arrière :** rétablir les deux politiques de `20260627023426` (`is_suspended = false`) et la fonction de `20260909100000`.

## 4. Tests

Base jetable (jamais dev ni prod), dans cet ordre sur la même base :

1. `supabase/tests/restricted_shop_orders.sql` (socle, politiques d'avant, état initial documenté) ;
2. `supabase/migrations/20261021150000_restricted_shop_orders_server_masking.sql` ;
3. `supabase/tests/restricted_shop_orders_cases.sql` : 21 cas (lecture directe et RPC pour boutique active, `payment_pending`, suspendue, `PAYMENT_OVERDUE` sans suspension, `STORE_RESTRICTED`; propriétaire, collaborateur, fondateur, tiers, anonyme; droits EXECUTE).

Résultat du 22/10/2026 sur `postgres:16` : 22 réussis, 0 échec (le cas 00 confirme que le trou R1 existait avant la migration). Migration rejouée : 0 erreur.

Exemple :
`cat supabase/tests/restricted_shop_orders.sql supabase/migrations/20261021150000_restricted_shop_orders_server_masking.sql supabase/tests/restricted_shop_orders_cases.sql | docker exec -i <conteneur> psql -U postgres -v ON_ERROR_STOP=1`

## 5. Vérification sur dev (navigateur, 22/10/2026)

Compte et trois boutiques jetables créés puis supprimés (dev revenu à 53 boutiques) : active, `locked` sans suspension (le trou R1), `final_suspension` suspendue.

| Contrôle | Résultat |
|---|---|
| Lecture directe de `orders`, boutique active / `locked` sans suspension / suspendue | 6 / **0** / 0 lignes (avant : 6 / 6 / 0) |
| `get_shop_orders_secure` sur les deux boutiques restreintes | 6 lignes, noms et téléphones `••••••••`, `notes` nul ; boutique active : en clair |
| Écran d'une boutique restreinte | Un seul appel réseau, la RPC ; aucune lecture directe ; pastille de non lus exacte ; aucun nom en clair |
| Commandes : `pending` et `returned` | « En attente » et « Retourné » affichés ; « Expédier » caché sur livrée, annulée, retournée |
| Numérotation avec recherche | `#5` conservé (changeait avant) |
| Planifier puis effacer une date, rechargement | Date enregistrée ; après effacement `notes` et date nulles en base |
| Changement de statut | Appliqué, commande marquée lue, pastille 3 → 2 |
| Accueil : chiffre d'affaires | Annulées et retournées exclues (57 000 FCFA au lieu de 92 000) |
| Statistiques, 7 jours, avec une période précédente | +90,0 % (chiffre d'affaires), −5,0 % en rouge (panier moyen) ; plus de conversion inventée |
| Tableau « Ventes par Pays » | Tronqué avant (colonne « COMMAN… » coupée) ; corrigé : carte pleine largeur sous 1536 px |

**Limites de ce test.** Dev n'a pas la migration de facturation (`shop_invoices` absente, `PAYMENT_OVERDUE` refusé par la contrainte) : seul le modèle `locked` / `final_suspension` y a été éprouvé, et l'écran de blocage historique recouvre alors tout le tableau de bord, donc l'accueil masqué n'a pas pu être vu à l'écran (la réponse serveur a été vérifiée). Le globe de trafic ne s'affiche pas dans le navigateur automatisé (WebGL), le cadre reste vide.

## 6. Livraisons : anomalies trouvées pendant ce test, corrigées (22/10/2026)

| # | Anomalie | Correction |
|---|---|---|
| L1 | `order_deliveries` répondait 500 pour tout le monde (`42P17`, récursion entre les politiques de `order_deliveries` et de `delivery_company_members`) : le « Suivi Livraison » ne s'affichait pour aucune boutique | `20261022100000` : la politique du propriétaire de boutique passe par `shop_owner_can_see_delivery_member()` (SECURITY DEFINER) |
| L2 | `delivery_providers` n'est lisible que par son propriétaire (durcissement `20260628182712`) : la fenêtre « Expédier » annonçait « Aucune structure de livraison partenaire trouvée » et le « via X » du suivi disparaissait | Front : `PushToDeliveryModal` et `ShopEditor` lisent le nom dans la vue `delivery_providers_public` |
| L3 | `delivery_company_members` n'a ni `name` ni `phone` : le livreur s'affichait sans nom ni numéro | `20261022110000` : `get_delivery_driver_contacts(uuid[])` (nom et téléphone du profil, uniquement pour les livreurs affectés aux commandes de l'appelant ou à son prestataire) ; front : lecture par lots de 500 ; lien « Appeler » caché sans numéro |
| L4 | `push_order_to_delivery_provider` : acceptait une commande livrée, annulée ou retournée ; n'importe quel prestataire (même inactif ou non connecté) ; et `ON CONFLICT … status = 'pending'` remettait à zéro une livraison déjà récupérée, en route ou livrée | `20261022100000` : trois refus avec message en français ; relance possible tant que la livraison est en attente, assignée, en échec ou retournée |
| L5 | « Expédier » proposé sur des commandes dont la livraison est déjà en cours | Front : bouton caché pour `picked_up`, `in_transit`, `delivered` |

Migrations appliquées sur dev le 22/10/2026 (ciblées, jamais `db push`). Tests sur base jetable : `supabase/tests/delivery_rls_recursion.sql` (socle et cas 00 : la récursion se reproduit avant la migration), puis la fonction `push` d'avant (extraite de `20260811083400`), les deux migrations, et `delivery_rls_recursion_cases.sql` : **28 sur 28**, migrations rejouées sans erreur.

**Navigateur (Claude dans Chrome, application locale contre dev)** : « Suivi Livraison » affiche « Assigné au livreur via … », le nom et le téléphone du livreur, « En route » et « Livré » ; la fenêtre « Expédier » liste le prestataire et l'envoi répond « Commande poussée avec succès » ; `order_deliveries`, `delivery_providers_public` et `get_delivery_driver_contacts` répondent 200, console sans erreur ; en direct sur la base : commande en route et commande livrée refusées, prestataire inconnu refusé, contacts renvoyés pour le seul livreur affecté. Contrôle de la boutique restreinte rejoué : 0 ligne en lecture directe (boutique `locked` sans suspension et boutique suspendue), lignes masquées par la fonction.

**Non corrigé (hors boutique) :** les écrans prestataire `DriversList` et `DispatchTable` demandent `profiles:user_id (first_name, last_name, phone_number)` : `profiles` n'a pas ces colonnes (`full_name`, `phone`) et `delivery_company_members.user_id` ne référence pas `profiles`, donc la requête échoue. `get_delivery_driver_contacts` est utilisable par un prestataire pour son équipe ; le branchement de ces deux écrans reste à faire.

**Prérequis production :** `20261022100000` suppose `shop_delivery_connections`, `delivery_providers`, `delivery_company_members`, `order_deliveries`, `delivery_zones`, `delivery_driver_zones` et la vue `delivery_providers_public` ; `20261022110000` suppose `profiles(full_name, phone)`. Ordre : `20261021150000`, `20261022100000`, `20261022110000`, puis le front.

## 7. Correctifs Commandes (front seul, aucune migration)

| # | Anomalie | Correction |
|---|---|---|
| C1 | Statuts `pending` (commande directe) et `returned` (posé par le livreur) absents de la liste : sélecteur vide | `OrdersList`, `ShopOverview` : « En attente », « Retourné », et repli sur la valeur brute pour tout statut inconnu |
| C2 | Effacer une date de livraison la faisait revenir (la balise `[LIVRAISON PRÉVUE: …]` survivait dans `notes`) | `ScheduleDeliveryModal` : `notes` toujours réécrite (nulle si date et note sont vides) |
| C3 | Hooks React appelés après un `return` (crash quand la boutique passe en mode restreint) | `OrdersList` : le retour anticipé passe après les hooks |
| C4 | Numéros `#1`, `#2`… recalculés selon la recherche et les filtres | Calculés sur toutes les commandes |
| C5 | Filtres « Aujourd'hui » / « Demain » figés après minuit | Date réévaluée chaque minute |
| C6 | Statut non modifié mais toast « Statut mis à jour » ; compteur de non lus désynchronisé (double clic, autre appareil) | `ShopEditor` : mise à jour immédiate annulée si le serveur refuse, erreur affichée ; non lus dérivé de la liste |
| C7 | Nouvelle commande en temps réel : sans articles, total à 0, doublon possible ; notification sonore et système avec « 0 FCFA » et sans produit | Commande relue en entier, dédoublonnée ; la notification relit la commande 0,8 s après l'événement |
| C8 | Suivi de livraison perdu sur les grosses boutiques : un seul `.in()` de 5000 identifiants dépasse la taille d'URL | Requête par lots de 100 |
| C9 | Annulées et retournées comptées dans le chiffre d'affaires (accueil et statistiques) | Exclues |
| C10 | « Expédier » proposé sur une commande livrée, annulée ou retournée ; erreur « Unauthorized » en anglais pour un collaborateur | Bouton caché ; message en français |
| C11 | Impression : guillemets non échappés | Échappés |

## 8. Déploiement en production

**Projet :** `yfggrceynzcwklbxhgix`. **Branche :** `jeanmarc`. **Ne jamais utiliser `supabase db push`** (il pousserait aussi toutes les migrations en attente) ; appliquer uniquement les trois fichiers ci-dessous, **dans cet ordre**, puis le front.

### 8.1 Avant (lecture seule)

```bash
cat supabase/.temp/project-ref        # doit afficher yfggrceynzcwklbxhgix
```

Dans l'éditeur SQL de la production :

```sql
-- Prérequis (tout doit être présent)
select proname from pg_proc where pronamespace = 'public'::regnamespace
  and proname in ('has_role','has_shop_role','is_shop_owner','is_shop_collaborator','get_shop_orders_secure','push_order_to_delivery_provider');   -- 6 lignes
select viewname from pg_views where schemaname = 'public' and viewname = 'delivery_providers_public';                                                -- 1 ligne
select tablename from pg_tables where schemaname = 'public'
  and tablename in ('order_deliveries','delivery_company_members','delivery_providers','shop_delivery_connections','delivery_zones','delivery_driver_zones','profiles'); -- 7 lignes
select policyname from pg_policies where schemaname = 'public' and tablename = 'orders' and cmd = 'SELECT';
  -- attendu : « Shop owners can view orders unlocked » et « Collaborators can view shop orders unlocked » (+ « Delivery providers view their assigned orders »)

-- Boutiques qui changent de comportement : restreintes MAIS non suspendues (elles lisaient encore leurs clients en direct)
select shop_payment_status, coalesce(is_suspended, false) as suspendue, count(*)
  from public.shops
 where coalesce(is_suspended, false) or shop_payment_status in ('STORE_RESTRICTED','locked','PAYMENT_OVERDUE','final_suspension')
 group by 1, 2 order by 3 desc;
```

Règles de lecture : une ligne de prérequis manquante = **ne pas appliquer** (la migration échouerait). Les boutiques « restreintes mais non suspendues » sont celles pour lesquelles la lecture directe de leurs clients devient impossible : c'est voulu, mais les prévenir si l'une d'elles est active commercialement. Vérifier qu'une sauvegarde automatique récente existe dans le tableau de bord Supabase (aucune des trois migrations ne supprime de donnée). La récursion de politique est présente en production si la console du tableau de bord d'une boutique affiche « infinite recursion detected in policy » (compte marchand).

### 8.2 Appliquer les migrations (dans cet ordre)

Deux méthodes, au choix : coller chaque fichier dans l'éditeur SQL de la production, ou

```bash
npx supabase db query --linked -f supabase/migrations/20261021150000_restricted_shop_orders_server_masking.sql
npx supabase db query --linked -f supabase/migrations/20261022100000_delivery_rls_recursion_and_push_guard.sql
npx supabase db query --linked -f supabase/migrations/20261022110000_delivery_driver_contacts.sql
```

Les trois sont **idempotentes** : en cas d'échec ou d'interruption, relancer le même fichier. Elles ne créent que des fonctions et remplacent des politiques (pas de réécriture de table, pas de verrou long). Une courte fenêtre sans politique de lecture est possible pendant le remplacement : appliquer hors des heures de pointe.

### 8.3 Vérifier la base (lecture seule)

```sql
select policyname, qual like '%is_shop_restricted%' as utilise_fonction from pg_policies
 where schemaname = 'public' and tablename = 'orders' and cmd = 'SELECT' order by 1;          -- propriétaire et collaborateurs : true
select policyname, qual from pg_policies where tablename = 'delivery_company_members'
   and policyname = 'Shop owners can view assigned delivery members';                          -- shop_owner_can_see_delivery_member(...)
select proname, proacl::text from pg_proc where proname in
  ('is_shop_restricted','shop_owner_can_see_delivery_member','get_delivery_driver_contacts','push_order_to_delivery_provider','get_shop_orders_secure');
  -- attendu : aucun « anon » ni « =X/ » (PUBLIC) dans proacl
```

Contrôle externe sans compte (doit renvoyer 401 / `42501`, clé anonyme de production) :

```bash
curl -s -X POST "https://yfggrceynzcwklbxhgix.supabase.co/rest/v1/rpc/get_delivery_driver_contacts" \
  -H "apikey: <clé anon>" -H "Authorization: Bearer <clé anon>" -H "Content-Type: application/json" -d '{"_member_ids":[]}'
```

### 8.4 Déployer le front (ensuite)

Fusionner `jeanmarc` sur la branche de production (voir [DEPLOIEMENT-PROD-2026-10.md](DEPLOIEMENT-PROD-2026-10.md)). **Base d'abord** : le nouveau front appelle `get_delivery_driver_contacts` et la vue `delivery_providers_public` ; sur une base non migrée, le suivi s'affiche sans nom de livreur (aucun plantage, l'erreur n'est que journalisée). L'inverse est sans risque pour la partie commandes : l'ancien front reste compatible avec la nouvelle base, sauf qu'une boutique restreinte y voit 0 commande (comme une boutique suspendue aujourd'hui) jusqu'au rechargement avec le nouveau front.

### 8.5 Vérification fonctionnelle en production (10 minutes)

Avec un compte marchand dont la boutique a des livraisons, puis (si possible) une boutique restreinte :

1. `/shop-editor/<id>` s'ouvre, **console sans « infinite recursion »** ; onglet Commandes : le bloc « Suivi Livraison » affiche le statut, « via <prestataire> », le nom et le téléphone du livreur.
2. Une commande « Nouveau » : **Expédier** liste les partenaires connectés, confirmer répond « Commande poussée avec succès ». Sur une commande déjà « En route » ou « Livré », le bouton n'apparaît pas.
3. Une commande « En attente » (commande directe) et une « Retourné » affichent leur statut (pas de sélecteur vide).
4. Planifier une livraison, l'effacer, recharger : la date ne revient pas.
5. Rechercher un client : le numéro `#N` de la commande ne change pas.
6. Statistiques : les pastilles de tendance sont réelles (absentes sur « Tout »), le tableau « Ventes par Pays » est visible en entier, l'objectif mensuel reflète le mois en cours.
7. **Boutique restreinte** (compte propriétaire) : l'accueil affiche le nombre de commandes et le chiffre d'affaires avec noms masqués ; depuis la console, `supabase.from('orders').select('id')` renvoie 0 ligne et `supabase.rpc('get_shop_orders_secure', { _shop_id })` renvoie des lignes masquées sans `notes`.

### 8.6 Retour arrière

Dans cet ordre : **front d'abord** (version précédente), **puis base**.

```sql
-- Livraisons (annule 20261022110000 puis 20261022100000)
drop function if exists public.get_delivery_driver_contacts(uuid[]);
drop policy if exists "Shop owners can view assigned delivery members" on public.delivery_company_members;
create policy "Shop owners can view assigned delivery members" on public.delivery_company_members for select
  using (exists (select 1 from public.order_deliveries od join public.orders o on o.id = od.order_id
                 join public.shops s on s.id = o.shop_id where od.driver_id = delivery_company_members.id and s.user_id = auth.uid()));
drop function if exists public.shop_owner_can_see_delivery_member(uuid, uuid);   -- ATTENTION : rétablit la récursion (livraisons à nouveau illisibles)
-- puis rejouer la fonction push d'avant : bloc push_order_to_delivery_provider de supabase/migrations/20260811083400_delivery_driver_zones_and_push_order.sql

-- Boutique restreinte (annule 20261021150000) : rétablir d'abord les deux politiques de lecture, puis la fonction
drop policy if exists "Shop owners can view orders unlocked" on public.orders;
create policy "Shop owners can view orders unlocked" on public.orders for select
  using (exists (select 1 from public.shops s where s.id = orders.shop_id and s.user_id = auth.uid() and coalesce(s.is_suspended, false) = false));
drop policy if exists "Collaborators can view shop orders unlocked" on public.orders;
create policy "Collaborators can view shop orders unlocked" on public.orders for select
  using ((public.has_shop_role(shop_id, auth.uid(), 'view_orders'::shop_collab_role) or public.has_shop_role(shop_id, auth.uid(), 'manage_delivered_orders'::shop_collab_role))
         and exists (select 1 from public.shops s where s.id = orders.shop_id and coalesce(s.is_suspended, false) = false));
-- get_shop_orders_secure : rejouer la définition de 20260909100000 (bloc « 6. Server-Side Customer Data Masking RPC »), puis :
drop function if exists public.is_shop_restricted(uuid);
```

## 9. Points à retenir

- **Dev n'est pas représentatif pour la facturation** : pas de `shop_invoices`, `PAYMENT_OVERDUE` refusé par la contrainte, `enforce_shop_billing_deadlines` absente. Le cas `STORE_RESTRICTED` n'est donc couvert que par les tests sur base jetable ; le vérifier en production (8.5, point 7) sur une boutique réellement restreinte.
- **Changement de comportement voulu** : une boutique restreinte mais non suspendue ne lit plus ses clients en direct ; ses commandes arrivent masquées via `get_shop_orders_secure`.
- **Fournisseurs de livraison et fondateurs inchangés** : leur politique propre n'est pas touchée ; un fondateur obtient des lignes masquées pour une boutique restreinte.
- **Écrans prestataire non corrigés** : `DriversList` et `DispatchTable` demandent des colonnes inexistantes de `profiles` (voir section 6).
- **Règle commerciale non traitée** : les 50 FCFA de commission facturés à l'insertion ne sont pas rendus si la commande est annulée.
- **Limites connues des statistiques** : visites lues sur 30 jours et plafonnées à 5000 lignes ; la tendance de conversion n'existe que pour « Aujourd'hui » et « 7 jours ».
- **Tests de non-régression à conserver** : `supabase/tests/restricted_shop_orders*.sql` (22 cas) et `delivery_rls_recursion*.sql` (28 cas), sur base jetable uniquement.
