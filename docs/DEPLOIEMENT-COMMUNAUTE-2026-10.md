# Communauté (`/community`) : correctifs et déploiement (octobre 2026)

**État :** migration appliquée et testée sur **dev** (`xfpbpxncserliskrbaim`) le 21/10/2026, front testé dans le navigateur contre dev. **Production : à faire** (section 3, dans l'ordre : migration puis front).
**Périmètre :** salon `/community` (page, notifications, pastille de non lus) et ses tables `community_*`. Le module ConnectUs n'est pas modifié, mais il partage la table `community_messages` (voir 1.1).

## 1. Anomalies constatées

### 1.1 Données : le salon affichait du JSON ConnectUs

Sur dev, **86 messages sur 86** étaient des blobs JSON écrits par ConnectUs (`{"connectus_type":"reaction"…}`, notifications, publications), dont certains de plusieurs Mo (un de 14 Mo). Le salon les affichait en clair, le compteur de non lus les comptait, et `select *` les téléchargeait.

### 1.2 Sécurité (base)

| # | Anomalie | Effet |
|---|---|---|
| S1 | La migration `20260827000000` avait ouvert `community_messages` aux anonymes (lecture et écriture) | Lecture publique du salon ; écriture sans compte |
| S2 | Politique d'insertion avec `OR auth.role() = 'authenticated'` | Tout membre pouvait écrire **au nom d'un autre** (`user_id` libre) |
| S3 | Politique de mise à jour « sa propre ligne » sans limite de colonnes, et lignes de l'utilisateur nul `0000…` modifiables par tous | Un membre pouvait **épingler** ses messages ; les lignes « invités » étaient modifiables par n'importe qui |
| S4 | `anon` et `authenticated` avaient tous les privilèges (dont `TRUNCATE`, qui contourne la RLS) sur les 5 tables `community_*` | Exposition inutile |
| S5 | `get_community_profiles` et `search_community_profiles` exécutables par `anon` | Énumération des noms et avatars des membres sans compte |
| S6 | Aucune limite de longueur des messages ni des émojis | Messages de plusieurs Mo, abus de stockage |

### 1.3 Front (`Community.tsx` et hooks)

| # | Anomalie | Correction |
|---|---|---|
| F1 | Le salon se rechargeait (écran « Chargement… ») à chaque rafraîchissement du jeton : dépendance à l'objet `session.user` | Dépendance à `user.id` (page, notifications, non lus) |
| F2 | Pas de pagination : au-delà de 50 messages, l'historique était inaccessible | Bouton « Messages précédents », position de lecture conservée |
| F3 | Messages épinglés limités aux 50 derniers chargés | Requête dédiée des messages épinglés |
| F4 | Réponse à un message ancien : l'aperçu de la citation était vide | Chargement des messages cités manquants |
| F5 | Une réaction ajoutée pouvait s'afficher **en double** (le temps réel arrivait avant la réponse de l'insertion) ; annuler une réaction en cours d'enregistrement échouait ; erreur de suppression silencieuse | Fusion de la version optimiste avec l'événement temps réel, rattrapage en cas d'échec |
| F6 | Réactions de messages non affichés accumulées en mémoire | Ignorées |
| F7 | Défilement forcé en bas à chaque message reçu, même en lisant l'historique | Seulement si l'utilisateur est près du bas, ou si c'est son message |
| F8 | Le message envoyé n'apparaissait que si le temps réel fonctionnait | Affichage immédiat, dédoublonné, avec chargement du profil de l'auteur |
| F9 | Mention en fin de phrase (« Merci @Jean. ») jamais détectée : le point faisait partie du nom | Ponctuation finale exclue (affichage et notifications) |
| F10 | Mention insérée à la fin du texte même si le curseur était ailleurs ; le bouton « @ » n'ouvrait pas les suggestions ; résultats de recherche périmés pouvant s'afficher | Insertion au curseur, suggestions ouvertes, requêtes obsolètes ignorées |
| F11 | Entrée envoyait le message pendant une composition (clavier mobile/IME) | Ignorée pendant la composition |
| F12 | Pastille « Fondateur » visible seulement sur **ses propres** messages | Indicateur serveur `is_founder` dans `get_community_profiles` |
| F13 | Notification (toast) pour une mention reçue alors que l'utilisateur regarde déjà le salon ; adresse e-mail utilisée comme « prénom » si le nom manquait | Pas de doublon ; pas de jeton sans nom complet |
| F14 | Compteur de non lus : tout l'historique comptait au premier passage ; messages ConnectUs comptés ; **jamais affiché** (hook appelé seulement dans `Header`, absent des pages du tableau de bord) | Départ à « maintenant » pour un nouveau membre ; filtrage ; pastille ajoutée à la barre latérale et à la barre mobile |
| F15 | Hauteur `100vh` : zone de saisie en partie masquée sur mobile (barre d'adresse), bande vide en bas sur ordinateur | `100dvh` |
| F16 | Pas de gestion d'erreur au chargement ; pas de limite côté saisie | Bouton « Réessayer » ; `maxLength` 2000 |

## 2. Ce que fait la migration

[supabase/migrations/20261021130000_community_chat_hardening.sql](../supabase/migrations/20261021130000_community_chat_hardening.sql) (idempotente) :

1. Colonne **calculée** `community_messages.kind` (`chat` ou `connectus`, d'après le début du corps). Non falsifiable, aucun `UPDATE` des 86 lignes. Index partiel sur `kind = 'chat'`.
2. Contraintes `NOT VALID` (ne contrôlent que les **nouvelles** lignes) : message de salon de 1 à 2000 caractères ; émoji de 1 à 16 caractères.
3. `REVOKE` de tout pour `anon` et de `TRUNCATE/REFERENCES/TRIGGER` pour `authenticated` sur les 5 tables.
4. Politiques de `community_messages` : lecture pour les membres connectés ; insertion seulement en son propre nom et non épinglé ; mise à jour réservée aux fondateurs (épinglage) ; suppression de ses messages ou fondateur.
5. `get_community_profiles` recréée avec `is_founder` (limitée à 200 identifiants) ; `search_community_profiles` avec caractères génériques échappés ; les deux réservées aux membres connectés.

Après application sur dev, les 86 lignes ConnectUs ont `kind = 'connectus'` : le salon est vide de JSON.

## 3. Déploiement en production

**Cible :** projet Supabase de production `yfggrceynzcwklbxhgix`. **Ne jamais** lancer ces commandes tant que `supabase/.temp/project-ref` vaut `xfpbpxncserliskrbaim` (c'est dev) : vérifier le projet lié avant chaque commande.
**Durée :** environ 10 minutes. **Interruption de service :** quelques secondes (voir 3.2, verrou de la migration).
**Rien d'autre à déployer :** aucune Edge Function, aucune variable d'environnement, aucun secret, aucune autre migration. La migration ne dépend d'aucune autre migration en attente.

### 3.1 Avant de commencer (lecture seule)

À exécuter dans l'éditeur SQL de la production, et à noter dans le compte rendu de déploiement :

```sql
-- a. Les prérequis existent (doivent renvoyer 1 ligne chacun)
select 1 from pg_proc where proname = 'has_role';
select 1 from pg_enum e join pg_type t on t.oid = e.enumtypid where t.typname = 'app_role' and e.enumlabel = 'co_founder';
select 1 from information_schema.tables where table_name = 'community_message_reactions';

-- b. État actuel : nombre de lignes par type, et poids de la table
select count(*) as total,
       count(*) filter (where left(body, 64) ~ '^\s*\{\s*"connectus_type"') as blobs_connectus,
       count(*) filter (where left(body, 64) !~ '^\s*\{\s*"connectus_type"' and char_length(btrim(body)) > 2000) as chat_trop_longs,
       pg_size_pretty(pg_total_relation_size('public.community_messages')) as taille
from public.community_messages;

-- c. Politiques actuelles (les anciennes migrations ont pu être appliquées ou non)
select policyname, cmd, roles from pg_policies where tablename = 'community_messages' order by 1;
```

Interpréter :
- **a.** Une ligne manquante : s'arrêter, ne pas appliquer (la migration échouerait).
- **b.** `chat_trop_longs` > 0 : sans conséquence (contrainte `NOT VALID`, ces lignes restent). `taille` de plus de 500 Mo : exécuter hors des heures de pointe (3.2).
- **c.** La présence de `msg_select_public` ou `msg_insert_authenticated` confirme que les failles S1 et S2 sont bien en production : c'est la preuve que la migration est nécessaire. Leur absence est possible ; la migration est idempotente et fonctionne dans les deux cas.

Sauvegarde : dans le tableau de bord Supabase de la production, vérifier qu'une sauvegarde automatique récente existe (ou en déclencher une). La migration ne supprime aucune donnée.

### 3.2 Appliquer la migration (en premier)

Fichier : [supabase/migrations/20261021130000_community_chat_hardening.sql](../supabase/migrations/20261021130000_community_chat_hardening.sql).

Deux méthodes, au choix (ne pas utiliser `supabase db push` : il pousserait aussi les autres migrations en attente) :

1. **Éditeur SQL de la production** : coller le fichier entier entre `BEGIN;` et `COMMIT;` puis exécuter.
2. **CLI**, après avoir vérifié le projet lié :
   ```bash
   cat supabase/.temp/project-ref        # doit afficher yfggrceynzcwklbxhgix
   npx supabase db query --linked -f supabase/migrations/20261021130000_community_chat_hardening.sql
   ```

À savoir :
- L'ajout de la colonne calculée `kind` **réécrit la table** `community_messages` et la verrouille en écriture pendant l'opération (sur dev : instantané pour 86 lignes dont un blob de 14 Mo). Les messages envoyés pendant ce laps de temps attendent, ils ne sont pas perdus.
- Elle est **idempotente** : en cas d'échec ou d'interruption, la relancer telle quelle (dans une transaction, un échec n'applique rien).
- Aucune ligne n'est modifiée ni supprimée.

### 3.3 Vérifier la base (lecture seule)

```sql
select kind, count(*) from public.community_messages group by 1;                    -- chat / connectus
select policyname, cmd, roles from pg_policies where tablename = 'community_messages' order by 1;
  -- attendu : msg_delete_own_or_founder, msg_insert_own, msg_select_all_auth, msg_update_founder
select grantee, privilege_type from information_schema.role_table_grants
  where table_name like 'community_%' and grantee = 'anon';                          -- attendu : aucune ligne
select proname, proacl::text from pg_proc where proname in ('get_community_profiles','search_community_profiles');
  -- attendu : aucun « anon » ni « =X/ » (PUBLIC) dans proacl
select conname, convalidated from pg_constraint where conname like 'community_%len'; -- 2 lignes, convalidated = false
```

Contrôle depuis l'extérieur, sans compte (doit renvoyer 401 avec le code `42501` ; remplacer par la clé anonyme de production) :
```bash
curl -s "https://yfggrceynzcwklbxhgix.supabase.co/rest/v1/community_messages?select=id&limit=1" \
  -H "apikey: <clé anon>" -H "Authorization: Bearer <clé anon>"
```

### 3.4 Déployer le front (ensuite)

Branche `jeanmarc` fusionnée sur la branche de production (voir le guide de déploiement habituel, [DEPLOIEMENT-PROD-2026-10.md](DEPLOIEMENT-PROD-2026-10.md)). **Dans cet ordre uniquement** : le nouveau front lit la colonne `kind` et `is_founder`, il échouerait sur une base non migrée (écran « Impossible de charger les messages » avec bouton « Réessayer »). L'inverse est sans risque : l'ancien front reste compatible avec la nouvelle base.

Entre la migration et le déploiement du front, ou pour un utilisateur qui garde l'ancien front en cache, l'ancien salon continue de fonctionner mais lit encore tous les messages (`select *`) : il peut donc afficher les blobs ConnectUs, et affiche « Membre » à la place des noms de fondateur, jusqu'au rechargement.

### 3.5 Vérification fonctionnelle en production (5 minutes)

Avec un compte membre, puis un compte fondateur :

1. `/community` s'ouvre, sans JSON affiché ; la présence « N en ligne » s'affiche.
2. Envoyer un message : il apparaît tout de suite **avec votre nom** (pas « Membre »).
3. Depuis un second compte, mentionner le premier (`@Prénom.` avec un point final) : toast « vous a mentionné » si on est sur une autre page ; surlignage de la mention dans le salon.
4. Réagir avec un émoji, recliquer 2 fois vite : un seul compteur, cohérent après rechargement.
5. Quitter le salon, faire écrire un autre compte : la pastille de non lus apparaît sur « Communauté » (barre latérale, ou menu « Plus » sur mobile) et disparaît en entrant dans le salon.
6. Compte fondateur : épingler un message (bandeau « épinglé » mis à jour chez les autres), la pastille « Fondateur » apparaît sur ses messages ; supprimer le message d'un autre membre.
7. Un compte non fondateur ne voit pas « Épingler » dans le menu d'un message.
8. Supprimer les messages de test.

### 3.6 Retour arrière

Dans cet ordre : **front d'abord** (revenir à la version précédente), **puis base**.

```sql
-- Retour aux politiques d'origine (lecture membres seulement, écriture en son nom, épinglage = auteur ou fondateur)
begin;
drop policy if exists "msg_select_all_auth" on public.community_messages;
drop policy if exists "msg_insert_own" on public.community_messages;
drop policy if exists "msg_update_founder" on public.community_messages;
drop policy if exists "msg_delete_own_or_founder" on public.community_messages;
create policy "msg_select_all_auth" on public.community_messages for select to authenticated using (true);
create policy "msg_insert_own" on public.community_messages for insert to authenticated with check (auth.uid() = user_id);
create policy "msg_update_own_or_founder" on public.community_messages for update to authenticated
  using (auth.uid() = user_id or has_role(auth.uid(), 'founder'::app_role) or has_role(auth.uid(), 'co_founder'::app_role))
  with check (auth.uid() = user_id or has_role(auth.uid(), 'founder'::app_role) or has_role(auth.uid(), 'co_founder'::app_role));
create policy "msg_delete_own_or_founder" on public.community_messages for delete to authenticated
  using (auth.uid() = user_id or has_role(auth.uid(), 'founder'::app_role) or has_role(auth.uid(), 'co_founder'::app_role));
commit;
```
La colonne `kind`, l'index, les contraintes et la version de `get_community_profiles` avec `is_founder` peuvent rester : l'ancien front les ignore. **Ne pas** rétablir l'ouverture aux anonymes de `20260827000000` (failles S1 à S3).

Si le retour arrière est motivé par ConnectUs : il écrit en tant que membre connecté, ce qui reste autorisé ; seuls les invités sans compte (identifiant nul) sont refusés, et `/connectus` exige déjà une connexion.

## 4. Tests effectués

**Base (dev, transaction annulée) : 18 contrôles de comportement, tous réussis** : accès anonyme refusé (lecture, écriture, RPC) ; insertion au nom d'un autre refusée ; message de 2001 caractères, vide ou déjà épinglé refusés ; blob ConnectUs classé `connectus` ; auto-épinglage refusé ; émoji trop long refusé ; suppression par un autre membre sans effet ; épinglage par un fondateur accepté ; `is_founder` correct ; `%` échappé dans la recherche.

**Navigateur (Chrome, application locale contre la base dev, 21/10/2026)** :
- Salon sans JSON ; envoi et affichage immédiat avec le nom (un bug a été trouvé et corrigé pendant ce test : le nom de l'auteur restait « Membre » après l'envoi).
- Temps réel : message reçu, message épinglé, message de fondateur avec pastille « Fondateur ».
- Mentions avec point ou virgule final, surlignage, bouton « @ » avec insertion au curseur.
- Réponse avec citation d'un message hors de la page chargée ; blob ConnectUs masqué.
- Pagination « Messages précédents » (50 puis le reste) ; réactions sans doublon, 4 clics rapides cohérents avec la base.
- Suppression de son message ; menu sans « Épingler » pour un non-fondateur.
- Pastille de non lus (2, puis 3 en direct, remise à zéro à l'entrée) ; toast de mention hors du salon.
- Avec le JWT réel : lecture, écriture et RPC anonymes refusées, usurpation refusée, auto-épinglage sans effet, message trop long refusé.

**Non testé dans l'interface** : menu « Épingler » côté fondateur (épinglage vérifié en direct via la base et par les 18 contrôles), rendu sur téléphone, touche Entrée pendant une saisie assistée. À regarder lors de la vérification 3.5 (points 6 et 7) et sur un téléphone.

## 5. Points à connaître (non corrigés ici)

- **ConnectUs reste couplé à `community_messages`** : il y stocke ses blobs JSON comme solution de repli (ses 9 tables `connectus_*` sont absentes sur dev) et son flux de repli relit **tous** les messages, salon compris, comme des publications. Le vrai correctif est de déployer les tables ConnectUs, puis de retirer ce repli (module « Bientôt disponible »).
- Les invités ConnectUs (identifiant nul `0000…`) ne peuvent plus écrire dans `community_messages` ; `/connectus` exige déjà une connexion.
- Les tables `community_topics`, `community_replies`, `community_likes` ne sont utilisées par aucun écran ; seuls leurs privilèges ont été resserrés.
- Si la production contient des messages de salon de plus de 2000 caractères, ils sont conservés (contrainte `NOT VALID`).
