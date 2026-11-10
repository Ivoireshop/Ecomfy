# ConnectUs : recette, correctifs et mise en production (08/11/2026)

Recette complète de `/connectus` sur la **dev** (compte de test johnmarkus00@gmail.com), correctifs, suppression des comptes fictifs.
Rien n'est commité ni poussé ; la migration est appliquée sur la **dev seulement**.

## 1. Ce qui était cassé

| Domaine | Défaut constaté |
|---|---|
| Comptes fictifs | « Koffi Fashion » / « Aminata Beauty » (stories), « Koffi Mensah » / « Aminata Diallo » (marchands recommandés, notifications), 2 notifications de démo, script `seed:connectus` (faux comptes, vidéos Google), 2 lignes fictives dans `community_messages` (post « Test post from script », notification vers `demo-user-1`) |
| Stories | `StoryBar` appelait `getActiveStories()` sans `await` : les vraies stories ne s'affichaient jamais, les 2 stories de démo prenaient leur place ; vues et likes jamais enregistrés (aucune politique UPDATE) ; la story ne s'enchaînait pas |
| Compteurs | j'aime / commentaires d'une publication d'un autre membre : aucun compteur en base (RLS réservait la mise à jour à l'auteur) ; compteurs de likes de commentaires et de stories dans le `localStorage` |
| Profils | fiche mise en cache dans une clé `localStorage` **commune** : le profil du dernier connecté s'affichait sur les publications d'autres membres ; onboarding jamais mémorisé (rouvert à chaque visite) ; « vérifié » donné à tout le monde |
| Données | tout doublé dans le `localStorage` + repli sur `community_messages` (publications, notifications, stories) ; photos/vidéos stockées en base64 dans les lignes |
| Abonnements | acceptation d'invitation = deux « bascules » : un abonnement déjà existant était supprimé ; état « abonné » perdu au rechargement |
| Messagerie | liste des conversations jamais affichée (prop non transmise) ; images en base64 ; « abonné mutuel • en ligne » inventé ; pas de non-lus ; un message pouvait être inséré dans la conversation de deux autres membres |
| Sécurité | tout membre pouvait créer une notification pour n'importe qui avec le texte de son choix ; profils et publications « abonnés » lisibles sans connexion |
| UX/UI | pas de message d'erreur (échecs avalés), fausses données (« Business & Ads », « EN DIRECT », « Abonnés 1 420 »), recherche renvoyant des liens factices (`invite-<ts>`), aperçu de lien avec photo et texte inventés, `prompt()` dans le profil, aucun accès aux messages sur mobile, double barre de navigation mobile, bulle Support sur le bouton « Profil », `<main>` imbriqué, formulaires sans libellés associés |
| Bug découvert pendant la recette | hook et écran Messages ouvraient le même canal temps réel : la page Messages plantait |

## 2. Ce qui a été fait

**Base** : [`20261108100000_connectus_hardening.sql`](../supabase/migrations/20261108100000_connectus_hardening.sql) (idempotente)

- compteurs (j'aime, commentaires, j'aime de commentaires et de stories) tenus par triggers ;
- notifications (j'aime, commentaire, réponse, abonnement, message, j'aime de story) **créées par le serveur**, avec anti-répétition ; le client ne peut plus insérer que des invitations (une seule en attente par couple) ;
- fonctions `connectus_view_story` et `connectus_mark_conversation_read` (vues de story, messages lus) ;
- tables `connectus_comment_likes` et `connectus_story_likes` ;
- messages réservés aux participants de la conversation ; conversations à 2 membres ;
- lecture réservée aux membres connectés ; publications « abonnés » réellement limitées aux abonnés ;
- bucket public `connectus-media` (50 Mo, images et vidéos), écriture / suppression dans le dossier de l'utilisateur ;
- temps réel sur publications, notifications, messages ;
- `is_onboarded`, `is_verified` à `false` par défaut ;
- fiches ConnectUs créées pour les auteurs déjà présents (la table `profiles` n'est lisible que par son propriétaire : sans fiche, leurs publications s'affichaient « Membre Ecomfy ») ;
- suppression des 2 lignes fictives de `community_messages`.

**Front** : service réécrit « base de données seulement » (plus de `localStorage`, plus de repli `community_messages`), requêtes groupées (plus de N+1), erreurs affichées, téléversement vers le bucket, profils consultables (clic sur un nom), recherche de vrais membres, suggestions réelles, statistiques réelles, messages non lus, fil « Abonnements » honnête, mobile (barre dédiée, Messages accessible), accessibilité (libellés, rôles, `aria-*`). « Live commerce » est annoncé « Bientôt ».

**Survol des boutons** : le thème passe `outline` / `ghost` en vert + texte blanc au survol et fait « sauter » chaque bouton ; sur les couleurs de ConnectUs, des icônes devenaient invisibles et des boutons verts viraient au noir. Tous les boutons du module passent par [`CUButton.tsx`](../src/modules/connectus/components/CUButton.tsx) (texte conservé au survol, fond de survol cohérent, ni saut ni zoom d'icône). Le `Button` global du projet n'est pas modifié.

Supprimés : `scripts/seed_connectus.js`, `scripts/verify_connectus_final.js`, `utils/fileUploader.ts`, script npm `seed:connectus`.

## 3. Recette réalisée (dev, navigateur + SQL)

Publication (texte, gras, lien, photo, produit), j'aime, commentaire, réponse, j'aime de commentaire, rechargement (tout persiste), recherche, abonnement, message texte + photo, story (création, lecture, suppression avec effacement du fichier), invitation reçue en temps réel puis acceptée, profil (modification, refus d'un @identifiant déjà pris), statistiques, suppression d'une publication (cascade + fichier), vue mobile 390 px.
Tests SQL en transaction annulée : triggers (compteurs, 3 notifications), refus des notifications falsifiées, des messages à soi-même et de la modification des publications d'autrui, accès anonyme nul.

Non testé : deux comptes réels en parallèle (un seul compte de test), vidéo téléversée (le code est le même que pour les photos), version native.

## 4. Mise en production : ordre à respecter

> Le nouveau front **ne fonctionne pas** sans la migration (colonne `is_onboarded`, fonctions, bucket).

1. Vérifier le lien du CLI (`cat supabase/.temp/project-ref`) : prod = `yfggrceynzcwklbxhgix`. **Ne jamais `db push`** (voir `DEPLOIEMENT-PROD-2026-11-07.md`).
2. Coller `20261108100000_connectus_hardening.sql` dans l'éditeur SQL de la prod (ne dépend que des tables `connectus_*` déjà créées le 07/11 et de `profiles`).
3. `supabase migration repair --status applied 20261108100000 --project-ref yfggrceynzcwklbxhgix`.
4. Déployer le front.
5. Contrôle : `select count(*) from storage.buckets where id='connectus-media'` = 1 ; 6 triggers `connectus_*` ; ouvrir `/connectus`, publier avec photo, aimer, commenter.

Retour arrière : redéployer le front précédent ; la migration ne casse pas l'ancien schéma, mais l'ancien front ne saurait plus créer de notifications (politique restreinte).

## 5. Points d'attention

- **Données de test laissées sur la dev** : 1 abonnement Jean-Marc → Ulrich, 1 conversation de 2 messages, 2 notifications, et 2 images de test dans `connectus-media` (le nettoyage en masse a été refusé par les garde-fous de la session). Sans effet sur le fonctionnement.
- Les anciens blobs ConnectUs de `community_messages` (86 lignes de membres réels : publications, réactions, stories d'août) ne sont **pas migrés** : ils ne s'affichent plus. À décider.
- Un membre n'est « trouvable » qu'après sa première visite sur ConnectUs (sa fiche est créée à ce moment) ; la table `profiles` d'Ecomfy reste privée.
- Aperçu de lien : le navigateur ne peut pas lire un autre site (CORS) ; seul le domaine est affiché. Un aperçu complet demandera une Edge Function.
- Le `GRANT ... ON ALL TABLES TO authenticated` de la migration d'origine (20260912150000) donne aussi `TRUNCATE` ; PostgREST ne l'expose pas, mais à resserrer plus tard.
- Hors périmètre : la bulle Support reste globale ; la barre mobile globale est masquée sur `/connectus`.
