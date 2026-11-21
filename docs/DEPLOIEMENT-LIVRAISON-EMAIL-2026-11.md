# Livraison réseau — notifications par e-mail (§12)

**Date :** 21/11/2026 · **État :** code et migration écrits, **testés sur base jetable (588/588, dont 43 nouveaux cas)**, migration rejouable. **Migration appliquée sur la dev (xfpbpxncserliskrbaim, historique enregistré), `send-delivery-notification-emails` et `send-transactional-email` déployées sur la dev, recette faite sur la dev.** Prod : à faire.

## Ce que fait le §12
Les notifications existaient déjà dans l'application (cloche, temps réel) pour le commerçant, la structure, le livreur et l'administration. Le cahier demande en plus « une architecture permettant l'ajout de notifications par e-mail ou d'autres canaux » : c'est ce qui est livré.

| Élément | Rôle |
|---|---|
| `delivery_notifications` | **Inchangée** : source de vérité, une ligne par notification, consultable dans l'application. |
| `delivery_notification_outbox` (nouvelle) | File d'envoi **par canal** (`channel`, aujourd'hui `email`). Un déclencheur y crée une ligne à chaque nouvelle notification. |
| `delivery_notification_prefs` (nouvelle) | Préférence de chaque utilisateur : e-mail activé par défaut, désactivable. |
| `send-delivery-notification-emails` (Edge Function) | Planifiée toutes les 2 minutes : réserve les envois, les transmet à `send-transactional-email`, note le résultat. |
| `delivery-notification` (modèle d'e-mail) | Titre, texte, bouton « Ouvrir dans Ecomfy » (lien interne uniquement). |
| Cloche des notifications | Case « Recevoir aussi par e-mail » (tous les rôles). |

**Ajouter un autre canal (SMS, WhatsApp…)** : autoriser sa valeur dans `channel`, faire créer sa ligne par le déclencheur et écrire son envoyeur sur le modèle de `send-delivery-notification-emails`. Aucune règle métier à modifier.

## Règles posées par la base
- **Une notification ne peut jamais échouer à cause de la file** : le déclencheur avale ses erreurs (cas E61).
- **Couper l'e-mail** n'enlève rien dans l'application et annule les envois pas encore partis.
- **Reprises** : 3 essais ; une réservation sans réponse depuis 10 minutes est reprise ; au-delà de 48 h l'envoi est abandonné (un e-mail de plusieurs jours n'a plus d'intérêt) ; les lignes terminées sont purgées après 90 jours.
- **Sécurité** : aucune des deux tables n'est lisible ni modifiable par l'API ; réserver et marquer les envois est réservé au service ; chacun ne peut changer que sa propre préférence.
- **Désinscription et suppression** : on passe par le circuit existant (`send-transactional-email`) : liste de suppression, lien de désinscription, garde `EMAIL_MODE` des environnements de test. Une adresse désinscrite est marquée « ignoré ».
- **Liens** : seul un chemin interne (`/delivery/...`) devient un bouton ; jamais une adresse externe.

## À décider par la direction
- **Tout est envoyé par e-mail** (toutes les natures de notification) tant que l'utilisateur ne l'a pas coupé. Si c'est trop, on peut limiter à une liste de natures (par exemple nouvelles commandes, affectations, paiements, vérifications) ou regrouper en résumé quotidien.
- **Alertes d'échéance** (cotisation, Premium, §11.3) : les rappels existants (`expiry_reminder`, `premium_ended`…) partent désormais aussi par e-mail ; il n'y a pas de relance supplémentaire avant échéance.

## Tests (base jetable)
Même chaîne que [DEPLOIEMENT-LIVRAISON-FINANCES-2026-11.md](DEPLOIEMENT-LIVRAISON-FINANCES-2026-11.md), en ajoutant `20261121120000_delivery_email_channel.sql` puis `supabase/tests/delivery_email_cases.sql` à la fin.
Résultat : **588 réussis, 0 échec** (545 précédents + 43). Migration rejouée une seconde fois : 0 erreur. Les cas couvrent : création de l'envoi par le déclencheur, préférence (défaut, coupure, réactivation, isolation entre utilisateurs, anonyme, valeur nulle), notifications aux administrateurs, droits (utilisateur, anonyme, tables illisibles et non modifiables), réservation (contenu, pas de double réservation), résultats (envoyé, ignoré, reprise, échec après 3 essais, envoi terminé non modifiable), reprise d'une réservation restée sans réponse, expiration à 48 h, purge à 90 jours, annulation par la coupure, suppression en cascade, file indisponible, droits d'exécution.
**Non testé :** le rendu réel du modèle d'e-mail et l'envoi par le prestataire (la base jetable ne les contient pas) ; la fonction Edge n'a pas été exécutée (pas de Deno sur le poste).

## Ordre en production
1. Prérequis : `20261106110000` (notifications) et `20261011120000` (`invoke_edge_function`) appliquées ; secrets Vault `supabase_project_url` et `cron_secret` présents (ce sont ceux déjà utilisés par les autres tâches planifiées).
2. `cat supabase/.temp/project-ref` doit afficher `yfggrceynzcwklbxhgix`.
3. Appliquer `20261121120000_delivery_email_channel.sql` seule (pas de `db push`), puis `supabase migration repair --status applied 20261121120000`.
4. Déployer **`send-delivery-notification-emails`** (nouvelle) et **`send-transactional-email`** (le registre des modèles a changé).
5. Déployer le front.
6. Contrôle : `select jobname, schedule from cron.job where jobname = 'delivery-notification-emails'` renvoie une ligne ; après une action qui notifie, `select status, count(*) from delivery_notification_outbox group by 1` passe de `pending` à `sent` en 2 minutes.
7. **Avant d'activer en prod**, vérifier `EMAIL_MODE` (ne pas être en `off` ou `redirect`) et envoyer un premier cas de test à une adresse interne.

## Recette sur la dev (21/11/2026)
Compte : le propriétaire de « Ulrich Djate Express ». Déploiement avec `supabase functions deploy --use-api` (le regroupement local par Docker échoue sur les chemins Windows).

| Parcours | Résultat |
|---|---|
| Cloche des notifications | case « Recevoir aussi par e-mail » présente, **activée par défaut** |
| Désactiver la case | préférence enregistrée en base (`email_enabled = false`) |
| Notification créée e-mail coupé | notification présente dans l'application, **aucune ligne d'envoi** |
| Réactiver la case, nouvelle notification | ligne d'envoi `pending` créée |
| Tâche planifiée (2 min) | envoi passé `sending` puis **`sent`** au 1er essai ; journal d'envoi : `sent` (modèle `delivery-notification`) |
| Console du navigateur | aucune erreur |

**Non vu :** l'e-mail dans une boîte de réception (la dev a une garde `EMAIL_MODE`, valeur non lisible : l'envoi est confirmé par la file et le journal, pas par la réception) ; le rendu du modèle dans un client de messagerie ; le cas « adresse désinscrite » en réel (couvert par les tests de base).
**Données de dev remises en état :** notifications de test, ligne d'envoi et préférence supprimées. Reste une ligne dans le journal d'envoi.

## Limites connues
- Une seule langue (français) et un seul modèle pour toutes les natures de notification.
- Pas de regroupement : une notification = un e-mail.
- Pas d'écran d'administration de la file d'envoi (consultation par SQL).
