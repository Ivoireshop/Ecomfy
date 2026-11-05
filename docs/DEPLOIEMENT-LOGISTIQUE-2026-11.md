# Logistique : flux commande → affectation → livraison, statuts

**Date :** 5 novembre 2026 · **Périmètre :** ancien module `order_deliveries` / `delivery_providers` (celui qui est en prod). Le nouveau module « Ecomfy Livraison » (`delivery_dispatches`…) n'est pas concerné : voir [`H5-LIVRAISON-MISE-EN-PROD-2026-10.md`](H5-LIVRAISON-MISE-EN-PROD-2026-10.md).
**État :** corrigé dans le code, testé sur base jetable (142 cas sur 142, deux migrations) **et dans le navigateur sur la dev** (5 nov., section 7bis). Migrations appliquées sur la dev, **pas sur la prod**. Non commité.

## 1. Flux, tel qu'il fonctionne maintenant

1. **Commande** : confirmée par la boutique (`confirmed`).
2. **Envoi au prestataire** : soit automatiquement à la confirmation (boutique connectée avec `auto_transfer`), soit par « Expédier » (`push_order_to_delivery_provider`). Dans les deux cas : livraison `pending` + livreur choisi par `pick_delivery_driver` (zone de la ville du client, livreur actif le moins chargé).
3. **Affectation** : le propriétaire ou un dispatcher peut changer de livreur tant que la course n'a pas commencé (`pending`, `assigned`, `failed`).
4. **Course** (app livreur) : `pending` → `in_transit` (commande `shipped`) → `delivered` (signature obligatoire, commande `delivered`) ou `failed` (motif obligatoire).
5. **Échec** : le prestataire réassigne (retour à `pending`, motif effacé) ou déclare le colis retourné (`returned`, commande `returned`).

Transitions autorisées (appliquées côté base, pas seulement dans l'écran) :

| De | Vers | Qui |
|---|---|---|
| pending / assigned | in_transit, picked_up, failed | livreur, gestionnaire |
| assigned | pending | gestionnaire |
| picked_up | in_transit, delivered, failed | livreur, gestionnaire |
| in_transit | delivered, failed | livreur, gestionnaire |
| failed | pending, returned | gestionnaire uniquement |
| delivered | returned | gestionnaire uniquement |
| returned | rien (terminal) | – |

Le statut `assigned` existe dans la base mais n'est jamais utilisé : l'affectation se lit par `driver_id`. Je ne l'ai pas introduit pour ne pas casser les écrans.

## 2. Ce qui était cassé

| # | Constat | Correctif |
|---|---|---|
| 1 | Un livreur ne pouvait pas lire `orders` : liste vide, page mission sans client | `get_my_delivery_missions` (SECURITY DEFINER) ne renvoie que ses courses et les champs utiles |
| 2 | Un livreur voyait toutes les courses du prestataire | Politique SELECT : livreur = ses courses ; propriétaire et gestionnaires = tout |
| 3 | Aucune garde : `pending → delivered`, `order_id`/`provider_id` modifiables, `delivered_at` forgeable, livreur d'un autre prestataire assignable | Déclencheur `guard_order_delivery_update` |
| 4 | Le prestataire pouvait INSÉRER une livraison sur n'importe quelle commande puis la passer `delivered` | Plus d'INSERT/DELETE direct ; mise à jour réservée à propriétaire, admin/dispatcher, livreur actif assigné |
| 5 | Une commande annulée repassait `delivered` ; une commande annulée gardait une course active | Synchro corrigée ; l'annulation clôt la course en `failed` |
| 6 | `in_transit` ne passait jamais la commande en « Expédié » | `in_transit/picked_up` → `shipped` |
| 7 | `failed`/`returned` inatteignables et mal libellés | Boutons « Échec de livraison » (livreur) et « Colis retourné » (prestataire) ; badges |
| 8 | Auto-transfert sans livreur ; choix aléatoire ; un nouvel envoi écrasait le livreur | Choix commun, au moins chargé ; livreur valide conservé |
| 9 | « À encaisser » = total même si payé en ligne | `amount_to_collect` = 0 si `payment_status = 'paid'` |
| 10 | Mise à jour refusée par la sécurité = 0 ligne, toast de succès | `.select()` + erreur explicite |

## 3. Fichiers

- Migrations : `supabase/migrations/20261105100000_delivery_flow_guards.sql` puis `20261105110000_delivery_cash_events_proofs.sql` (rejouables).
- Tests : `supabase/tests/delivery_flow_guards*.sql` (72 cas) et `delivery_cash_events_proofs*.sql` (70 cas), base jetable uniquement.
- Front : `src/lib/driverMissions.ts`, `src/lib/deliveryRpc.ts`, `src/hooks/useDeliveryEvents.ts`, `src/components/delivery/DeliveryCashTab.tsx` (nouveaux) ; `src/pages/driver/DriverHome.tsx`, `DriverMission.tsx`, `src/components/delivery/DispatchTable.tsx`, `src/pages/DeliveryDashboard.tsx`, `src/pages/ShopEditor.tsx`, `src/components/shop/OrdersList.tsx`.

## 4. Déploiement

1. Capturer l'état avant (voir [`PROCEDURE-ROLLBACK-2026-10.md`](PROCEDURE-ROLLBACK-2026-10.md)).
2. Pré-contrôle prod en lecture seule : livraisons en cours qui seraient bloquées par les nouvelles règles.
   ```sql
   select status, count(*) from public.order_deliveries group by status;
   -- livreurs référencés mais inactifs ou d'un autre prestataire (informatif)
   select od.id from public.order_deliveries od
   left join public.delivery_company_members m on m.id = od.driver_id
   where od.driver_id is not null and (m.id is null or m.provider_id <> od.provider_id or not m.is_active);
   ```
3. Appliquer la migration dans l'éditeur SQL (jamais `db push`), avec `--remote`/`--project-ref` explicite : le lien du CLI change de projet.
4. Déployer le front **après** la migration (l'app livreur appelle la nouvelle fonction ; sans elle, la liste est en erreur).
5. Vérifier :
   ```sql
   select tgname, tgenabled from pg_trigger where tgrelid = 'public.order_deliveries'::regclass and tgname = 'order_deliveries_guard'; -- 1 ligne, 'O'
   select has_function_privilege('anon','public.get_my_delivery_missions(uuid,text[])','EXECUTE'); -- false
   select has_table_privilege('authenticated','public.order_deliveries','INSERT'); -- false
   ```

## 5. Recette (comptes de test, montants minimaux)

| Cas | Attendu |
|---|---|
| Livreur ouvre l'app | Voit seulement ses courses, avec nom, adresse, téléphone du client |
| Commande payée en ligne | « Déjà payé · rien à encaisser » |
| Démarrer la course | Course `in_transit`, commande « Expédié » |
| Livrer avec signature | Course `delivered`, commande « Livré » |
| Échec de livraison avec motif | Course `failed`, motif visible côté boutique et prestataire |
| Prestataire réassigne une course en échec | Retour `pending`, motif effacé |
| La boutique annule une commande en route | Course `failed` « Commande annulée par la boutique » |
| Dispatcher assigne un livreur d'un autre prestataire | Refusé |
| Auto-transfert à la confirmation | Livraison créée avec livreur |

## 6. Suite : migration `20261105110000_delivery_cash_events_proofs.sql`

Quatre points d'abord laissés hors périmètre sont traités par une seconde migration (appliquer après la première).

| Point | Avant | Maintenant |
|---|---|---|
| **Argent encaissé** | `delivery_payments` jamais alimentée | Une livraison `delivered` sur commande non payée crée un encaissement (montant = total, espèces). Le propriétaire, l'admin et le caissier le font avancer : chez le livreur → reçu par le prestataire → reversé à la boutique (dans l'ordre, dates posées par le serveur, montant immuable). Onglet « Caisse » du tableau de bord prestataire ; la boutique voit « X FCFA encaissés · reversés » dans le suivi de livraison. `orders.payment_status` n'est pas modifié. |
| **Dispatchers non propriétaires** | Écran réservé au propriétaire ; pas de nom de livreur ni de client | `get_my_delivery_provider`, `get_provider_deliveries`, `get_provider_drivers`, `get_provider_payments` : admin, dispatcher et caissier ouvrent le tableau de bord (dispatcher/admin assignent ; caissier et admin gèrent la caisse ; l'équipe et les paramètres restent au propriétaire). Les noms de livreurs s'affichent enfin. |
| **Preuve de livraison** | Image encodée écrite dans une colonne texte | Bucket privé `delivery-proofs` (2 Mo, images), chemin `<id livraison>/<fichier>`. Dépôt par le livreur assigné tant que la course n'est pas terminée ; lecture par lui, la boutique et le prestataire. La base refuse tout autre contenu. Lien « Voir la preuve de livraison » côté boutique (lien signé de 2 minutes). |
| **Notifications** | Aucune | Journal `delivery_events` (un événement par changement de statut, d'affectation ou d'argent) publié en temps réel : alerte au livreur (nouvelle course, annulation), à la boutique (en route, livrée, échec, retour, argent encaissé/reversé), au prestataire (échec, annulation, livraison). Sert aussi d'historique. Ce ne sont **pas** des notifications push du téléphone : l'app doit être ouverte. |

Pré-contrôle prod avant la seconde migration : `select count(*) from storage.buckets where id = 'delivery-proofs'` (0 attendu) ; la publication `supabase_realtime` doit exister.

Vérifications après application :
```sql
select tgname from pg_trigger where tgrelid = 'public.delivery_payments'::regclass and tgname = 'delivery_payments_guard';        -- 1 ligne
select has_table_privilege('authenticated','public.delivery_payments','INSERT');                                                  -- false
select public from storage.buckets where id = 'delivery-proofs';                                                                  -- false
select count(*) from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'delivery_events';                 -- 1
```

Tests (base jetable, 142 cas au total sur les deux migrations) :
```
docker run -d --rm --name ecomfy-delivery-test -e POSTGRES_PASSWORD=test postgres:16-alpine
(cat supabase/tests/delivery_flow_guards.sql supabase/tests/delivery_cash_events_proofs.sql \
     supabase/migrations/20261105100000_delivery_flow_guards.sql supabase/migrations/20261105110000_delivery_cash_events_proofs.sql \
     supabase/tests/delivery_flow_guards_cases.sql supabase/tests/delivery_cash_events_proofs_cases.sql) \
  | docker exec -i ecomfy-delivery-test psql -U postgres -v ON_ERROR_STOP=1
```
Le stockage est simulé par un schéma `storage` simplifié : les règles d'accès sont testées, pas Supabase Storage lui-même (à vérifier à la recette).

## 7. Reste hors périmètre

- **Reversement** : la boutique ne « confirme » pas la réception de l'argent ; c'est le prestataire qui marque « reversé ». Un statut de confirmation par la boutique demanderait une valeur de plus dans `delivery_payments.status`.
- **Notifications push** (téléphone fermé) : non branchées pour les livraisons. (Correction du 05/11 : la fonction `send-push-notification` n'est plus câblée sur la prod. Depuis `20261011120000_edge_function_url_from_vault`, le déclencheur des nouvelles commandes passe par `invoke_edge_function`, qui lit l'adresse du projet dans le secret Vault `supabase_project_url` ; vérifié sur la dev, où il vaut l'hôte de la dev. Il n'a pas été vérifié que des déclencheurs de livraison appellent cette fonction.)
- **Tests de l'ancienne migration** (`delivery_rls_recursion*.sql`) : le cas 03 (livreur voit les 2 livraisons du prestataire) n'est plus vrai après cette migration. Ils s'exécutent jusqu'à `20261022110000`, donc ne sont pas affectés tant qu'on n'y ajoute pas la nouvelle.

## 7bis. Test navigateur sur la dev (5 nov. 2026)

Comptes et données `LOGITEST` créés sur la dev puis supprimés ; app locale (port 8080) sur la dev.

| Parcours | Résultat |
|---|---|
| Boutique : « Expédier » 3 commandes | OK. Livreur de la zone affecté, « Assigné au livreur » avec nom et téléphone |
| Livreur : liste des courses | OK. Client, adresse, « 15 000 FCFA à encaisser », « Déjà payé » pour la commande payée |
| Alerte en direct : commande annulée pendant que l'app livreur est ouverte | OK. « Course annulée », liste mise à jour sans recharger |
| Livreur : démarrer, signer, livrer | OK, après correction du bug ci-dessous. Commande « livrée », encaissement 15 000 FCFA, signature = fichier dans `delivery-proofs` |
| Livreur : échec « Client absent » | OK. Motif visible côté prestataire |
| Dispatcher (non propriétaire) | OK. Tableau de bord ouvert, badge « Dispatcher », ni Caisse ni Équipe ; réassignation d'un échec → « Assigné », motif effacé |
| Caissier : Caisse | OK. « Chez le livreur » → « Reçu » → « Reversé » ; totaux 15 000 / 0 / 0 puis 0 / 0 / 15 000 FCFA |
| Boutique : argent et preuve | OK. « 15 000 FCFA encaissés · reversés » ; « Voir la preuve de livraison » ouvre le PNG par lien signé |

Deux défauts trouvés **uniquement** grâce à ce test (les tests SQL ne pouvaient pas les voir) :

1. `orders.total_amount` n'existe pas : la colonne s'appelle `total`. Mon jeu de test simplifié l'avait masqué ; la première application sur la dev a échoué (sans rien appliquer). Corrigé dans les deux migrations. L'ancienne app livreur sélectionnait aussi `total_amount` : sa requête échouait.
2. **Signature impossible à valider** (bug antérieur) : `getTrimmedCanvas()` de `react-signature-canvas` plante avec Vite (`trim_canvas.default is not a function`). Le bouton « Valider » ne faisait rien, donc aucun livreur ne pouvait terminer une livraison. Corrigé dans `src/components/driver/SignaturePad.tsx` (`getCanvas()`).

Non testé dans le navigateur : alerte temps réel côté boutique et côté prestataire (seule celle du livreur l'a été ; le mécanisme est le même), le compte admin de livraison, et le comportement sur mobile.

Reste à nettoyer à la main : un fichier de test dans le bucket `delivery-proofs` de la dev (dossier `ce5b964d-87d8-467e-8564-2c0c8c857a2d/`), à supprimer depuis le tableau de bord Storage (le supprimer en SQL laisserait le fichier physique orphelin).

## 8. Retour arrière

Pour la seconde migration : supprimer les déclencheurs `order_deliveries_record_cash`, `order_deliveries_log_*`, `delivery_payments_guard`, `delivery_payments_log`, le bucket `delivery-proofs` (vide) et ses deux politiques, rétablir les anciennes politiques de `delivery_payments` (`20260811064646`) et `GRANT INSERT, DELETE`. Les encaissements déjà créés et le journal peuvent rester.

Pour la première migration, en sens inverse : supprimer le déclencheur `order_deliveries_guard` et `orders_close_delivery_on_cancel`, recréer les anciennes politiques (`20260811064645`), `GRANT INSERT, DELETE ... TO authenticated`, restaurer les anciennes versions de `sync_delivery_status_to_order`, `auto_transfer_order_to_delivery` et `push_order_to_delivery_provider` (`20261022100000`). Les nouvelles fonctions peuvent rester sans effet. Le front précédent ne fonctionne pas avec les nouvelles règles de lecture seulement si la migration est annulée *et* le front rétabli ensemble.
