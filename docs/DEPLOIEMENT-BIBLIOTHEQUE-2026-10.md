# Bibliothèque (`/library`) et Studio IA : correctifs et déploiement (octobre 2026)

**État :** migration et politiques de stockage appliquées et testées sur **dev** (`xfpbpxncserliskrbaim`) le 21/10/2026, front testé dans le navigateur contre dev. **Production : à faire** (section 3, dans l'ordre : base, Edge Functions, puis front).
**Périmètre :** page Bibliothèque (`/library`), éditeur de texte sur image, page Studio IA (`/studio`) pour ce qu'elle écrit dans la Bibliothèque, et les deux Edge Functions qui alimentent les tables `generated_images` et `generated_videos`.

## 1. Anomalies constatées

| # | Où | Anomalie | Effet | Correction |
|---|---|---|---|---|
| B1 | Base | `generated_images` n'avait **aucune politique UPDATE** | « Éditer le Texte » envoyait le fichier, affichait « Image modifiée enregistrée », mais la base ignorait la mise à jour sans erreur : la Bibliothèque montrait toujours l'ancienne image | Migration (politique UPDATE du propriétaire) ; le front vérifie maintenant qu'une ligne a été modifiée |
| B2 | Front | La suppression avait le même défaut (refus de la base non détecté) | Message « Supprimé » sans suppression réelle | Vérification qu'une ligne a bien disparu |
| B3 | Éditeur | Le canevas Fabric n'était **jamais initialisé** : la fenêtre s'ouvre dans un portail Radix, le `<canvas>` n'existe pas encore au premier passage de l'effet, qui ne se relance pas | Canevas 300×150 inerte : aucun bouton ne réagissait | Référence du canevas conservée en état, l'effet se relance quand il existe |
| B4 | Éditeur | Fabric 7 centre les objets par défaut ; l'image était posée avec son centre en (0,0) | Seul le quart bas-droit de l'image apparaissait, export quasi blanc | Origine explicite en haut à gauche |
| B5 | Éditeur | L'éditeur affichait « enregistrée » et se fermait **avant** la fin de l'envoi ; la moindre erreur perdait le travail | Faux succès | L'éditeur attend le résultat, reste ouvert en cas d'échec, bouton désactivé pendant l'envoi |
| B6 | Éditeur | Export à la largeur d'affichage (1024 px au plus) | Image enregistrée dégradée | Export à la résolution d'origine (constaté : 1376×767 pour une source de 1376×768) |
| B7 | Éditeur | Fenêtre réduite à son contenu (`sm:w-auto`) | Boutons rognés, colonne de contrôles écrasée | Largeur 95 % de l'écran |
| B8 | Bibliothèque | Titres « Sans titre » pour tout ce qui vient du Studio (pas de `productName`), et « Génération Studio » sur toutes les vidéos | Entrées indiscernables, noms de fichier génériques | Titre tiré du prompt saisi ; noms de fichier nettoyés |
| B9 | Bibliothèque | Une vidéo restée `processing` affichait un chargement infini **sans bouton Supprimer** | Entrée impossible à retirer | Au-delà de 20 minutes, affichée « Échec » ; suppression toujours possible |
| B10 | Bibliothèque | Pas de rafraîchissement d'une vidéo en cours | Il fallait recharger la page | Rafraîchissement des vidéos toutes les 10 s tant qu'une est en cours |
| B11 | Bibliothèque | Bouton de téléchargement sur une vidéo échouée ; URL brute affichée sous chaque vidéo (reste de débogage) ; hack `<video><img>` pour les anciennes entrées | Interface brouillonne | Téléchargement réservé aux vidéos terminées ; URL retirée ; ancienne entrée image affichée comme image |
| B12 | Bibliothèque | Images rognées en carré (`object-cover`) ; titres tronqués sur une ligne | Formats 9:16 et 16:9 coupés | `object-contain`, titre sur deux lignes |
| S1 | Studio | Le Studio attendait le statut `error`, le serveur écrit `failed` | Chargement infini après un échec de vidéo | Les deux statuts gérés ; relecture de l'état à l'abonnement ; limite de 10 minutes ; canal temps réel fermé en quittant la page |
| S2 | Studio | Téléchargement par `<a download>` vers une URL d'un autre domaine | Le navigateur ouvrait le fichier au lieu de le télécharger | Téléchargement via un blob |
| S3 | Studio | Message d'erreur serveur lu seulement pour les images | « Edge Function returned a non-2xx » pour les vidéos | Même lecture du message pour les vidéos |
| S4 | Studio | Pied de page complet dans une page déjà dans la barre latérale ; titres de cartes en `nowrap` qui écrasaient l'étiquette (`/UGCnaturel` s'affichait lettre par lettre) | Interface mal faite | Pied de page retiré, titres à la ligne |
| E1 | `generate-ai-image` | Si l'envoi vers le stockage échouait, la ligne était quand même insérée avec une data-URL de plusieurs Mo, ou une URL OpenAI qui expire en environ une heure | Bibliothèque lourde puis images cassées | Pas d'insertion sans copie dans le stockage ; la réponse porte `savedToLibrary` et le Studio prévient l'utilisateur |
| E2 | `generate-video` | Si le téléchargement final de la vidéo échouait (`!videoResp.ok`), le statut restait `processing` | Vidéo bloquée à jamais | Statut `failed` |

## 2. Ce qui change

### 2.1 Migration

[supabase/migrations/20261021140000_library_generated_images_update_policy.sql](../supabase/migrations/20261021140000_library_generated_images_update_policy.sql) (idempotente) : politique `Users can update their own images` sur `generated_images` (`UPDATE`, rôle `authenticated`, `auth.uid() = user_id` en lecture et en écriture, donc impossible de réattribuer une ligne à un autre compte). Aucune donnée modifiée.

### 2.2 Politiques de stockage `generated-content` (à vérifier en production)

L'éditeur envoie l'image modifiée dans le bucket `generated-content` avec `upsert: true`. Cela exige quatre politiques sur `storage.objects`, **déclarées dans le dépôt** (migrations `20251106092939` et `20260506212124`) mais **absentes de dev**, où l'envoi échouait. Il faut vérifier la production (3.1) : si elles manquent, l'éditeur y échouera de la même façon.

### 2.3 Edge Functions

| Fonction | Modification | Compatibilité |
|---|---|---|
| `generate-ai-image` | Insertion en base seulement si l'image est dans le stockage ; renvoie `savedToLibrary` | Un ancien front ignore le champ ; un nouveau front avec l'ancienne fonction considère l'image enregistrée (champ absent) |
| `generate-video` | Statut `failed` si le téléchargement final échoue | Sans effet de bord |

Aucune variable d'environnement ni aucun secret à ajouter.

### 2.4 Front

`src/pages/Library.tsx`, `src/pages/Studio.tsx`, `src/components/ImageTextEditor.tsx`, `src/components/studio/EmptyState.tsx`.

## 3. Déploiement en production

**Cible :** projet Supabase de production `yfggrceynzcwklbxhgix`. **Ne jamais** lancer ces commandes tant que `supabase/.temp/project-ref` vaut `xfpbpxncserliskrbaim` (c'est dev) : vérifier le projet lié avant chaque commande.
**Durée :** environ 15 minutes. **Interruption de service :** aucune.
**Ne pas utiliser `supabase db push`** : il pousserait aussi toutes les autres migrations en attente. Appliquer uniquement le fichier concerné.

### 3.1 Avant de commencer (lecture seule)

À exécuter dans l'éditeur SQL de la production :

```sql
-- a. Politiques actuelles de la table et du stockage
select policyname, cmd from pg_policies where tablename = 'generated_images' order by 1;
select policyname, cmd from pg_policies
 where schemaname = 'storage' and tablename = 'objects' and policyname ilike '%generated%' order by 1;
select id, public from storage.buckets where id in ('generated-images', 'generated-content');

-- b. Vidéos bloquées (seront affichées « Échec » par le nouveau front, sans modification en base)
select count(*) from public.generated_videos where status = 'processing' and created_at < now() - interval '20 minutes';

-- c. Images dont l'URL n'est pas une URL de stockage (data-URL ou URL OpenAI expirée, anomalie E1)
select count(*) filter (where image_url like 'data:%') as data_urls,
       count(*) filter (where image_url not like '%/storage/v1/object/%' and image_url not like 'data:%') as urls_externes
from public.generated_images;

-- d. Le nettoyage à 30 jours (bandeau « conservés 30 jours ») est-il planifié ?
select jobname, schedule, command from cron.job where command ilike '%cleanup_old_generated_media%';
```

Interpréter :
- **a.** `Users can update their own images` ne doit pas exister encore. Sous `storage.objects`, repérer lesquelles des quatre politiques de 3.3 manquent. Les deux buckets doivent exister et être publics (`public = true`).
- **b.** Information seulement. Ces lignes restent `processing` en base ; le nouveau front les présente comme échouées et permet de les supprimer.
- **c.** Si `data_urls` est élevé, ces lignes alourdissent le chargement de la Bibliothèque de chaque utilisateur concerné. Elles ne sont pas corrigées par ce déploiement (voir 5).
- **d.** Aucune ligne : le nettoyage n'est pas planifié en production, donc la promesse de 30 jours du bandeau n'est pas tenue (voir 5).

Sauvegarde : vérifier dans le tableau de bord Supabase qu'une sauvegarde automatique récente existe. Aucune étape ne supprime de donnée.

### 3.2 Appliquer la migration (en premier)

Fichier : [supabase/migrations/20261021140000_library_generated_images_update_policy.sql](../supabase/migrations/20261021140000_library_generated_images_update_policy.sql).

Au choix :
1. **Éditeur SQL de la production** : coller le contenu du fichier et exécuter.
2. **CLI**, après avoir vérifié le projet lié :
   ```bash
   cat supabase/.temp/project-ref        # doit afficher yfggrceynzcwklbxhgix
   npx supabase db query --linked -f supabase/migrations/20261021140000_library_generated_images_update_policy.sql
   ```

### 3.3 Politiques de stockage manquantes (seulement si 3.1.a en signale)

Idempotent : peut être exécuté même si certaines existent déjà.

```sql
DROP POLICY IF EXISTS "Public can view generated content" ON storage.objects;
CREATE POLICY "Public can view generated content" ON storage.objects
  FOR SELECT TO public USING (bucket_id = 'generated-content');

DROP POLICY IF EXISTS "Users upload their own generated content" ON storage.objects;
CREATE POLICY "Users upload their own generated content" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'generated-content' AND auth.uid()::text = (storage.foldername(name))[1]);

DROP POLICY IF EXISTS "Users update their own generated content" ON storage.objects;
CREATE POLICY "Users update their own generated content" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'generated-content' AND auth.uid()::text = (storage.foldername(name))[1]);

DROP POLICY IF EXISTS "Users delete their own generated content" ON storage.objects;
CREATE POLICY "Users delete their own generated content" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'generated-content' AND auth.uid()::text = (storage.foldername(name))[1]);
```

La lecture publique est voulue : les vidéos et les images modifiées sont servies par leur URL publique (`getPublicUrl`), et les politiques d'écriture restent limitées au dossier de l'utilisateur.

### 3.4 Vérifier la base (lecture seule)

```sql
select policyname, cmd, roles from pg_policies where tablename = 'generated_images' order by 1;
  -- attendu : DELETE, INSERT, SELECT (x2 : propriétaire et fondateurs) et UPDATE « Users can update their own images »
select policyname, cmd from pg_policies
 where schemaname = 'storage' and tablename = 'objects' and policyname ilike '%generated content%' order by 1;
  -- attendu : lecture publique, insertion, mise à jour, suppression
```

### 3.5 Déployer les Edge Functions (ensuite)

```bash
P=yfggrceynzcwklbxhgix
npx supabase@latest functions deploy generate-ai-image --project-ref $P --use-api
npx supabase@latest functions deploy generate-video    --project-ref $P --use-api
```

Les deux sont indépendantes l'une de l'autre et du reste. Vérifier la version déployée dans Dashboard > Edge Functions.

### 3.6 Déployer le front (en dernier)

Branche `jeanmarc` fusionnée sur la branche de production (voir [DEPLOIEMENT-PROD-2026-10.md](DEPLOIEMENT-PROD-2026-10.md)). **Base d'abord** : le nouveau front vérifie qu'une ligne a bien été mise à jour ; sur une base non migrée, « Éditer le Texte » affiche une erreur claire et laisse l'éditeur ouvert (pas de perte de travail, pas de faux succès). L'inverse est sans risque : l'ancien front reste compatible avec la nouvelle base.

### 3.7 Vérification fonctionnelle en production (10 minutes)

Avec un compte de test :

1. `/library` s'ouvre ; les images créées dans le Studio portent le **texte du prompt** comme titre, pas « Sans titre ».
2. Cliquer **Éditer le Texte** : l'image s'affiche en entier dans une fenêtre large, **Ajouter du Texte** place un texte au centre.
3. **Enregistrer** : bouton « Enregistrement… », fenêtre fermée, message « Image modifiée enregistrée », la carte montre le texte incrusté. Recharger la page : l'image modifiée est toujours là (preuve de la politique UPDATE).
4. **Original** télécharge un fichier nommé d'après le titre.
5. Studio, onglet vidéo : lancer une vidéo, elle apparaît dans l'onglet Vidéos de la Bibliothèque avec le texte du prompt comme titre, et passe d'« En cours » à terminée sans recharger la page.
6. Une vidéo en échec affiche « Échec de la génération » avec un bouton **Supprimer** qui fonctionne.
7. Studio : l'écran de départ n'a plus de pied de page, les étiquettes des cartes (`/UGCmodel`, etc.) sont lisibles.
8. Supprimer les éléments de test (le message de suppression doit correspondre à une suppression réelle : l'élément ne revient pas au rechargement).

En cas d'échec à l'étape 3 : console du navigateur (« Error saving edited image »), puis relancer 3.1.a pour voir quelle politique manque.

### 3.8 Retour arrière

Dans cet ordre : **front d'abord** (version précédente), **puis fonctions**, **puis base**.

```bash
# Fonctions : redéployer la version précédente du dépôt (git checkout <commit précédent> -- supabase/functions/...) puis
npx supabase@latest functions deploy generate-ai-image --project-ref yfggrceynzcwklbxhgix --use-api
npx supabase@latest functions deploy generate-video    --project-ref yfggrceynzcwklbxhgix --use-api
```
```sql
-- Base : retire la politique UPDATE (l'éditeur redevient inopérant, comme avant)
drop policy if exists "Users can update their own images" on public.generated_images;
```
Les politiques de stockage de 3.3 peuvent rester : elles sont déclarées dans le dépôt et limitées au dossier de l'utilisateur.

## 4. Tests effectués

**Base (dev)** :
- Absence de politique UPDATE sur `generated_images` constatée dans `pg_policies` avant correction.
- Avec la politique, `update … select` du propriétaire renvoie bien la ligne modifiée.

**Navigateur (Chrome, application locale contre la base dev, 21/10/2026)** :
- Titres issus du prompt (image et vidéos) ; vidéo « en cours » depuis 30 minutes affichée « Échec » ; vidéo échouée avec bouton Supprimer ; aucune URL brute.
- Rafraîchissement automatique : une vidéo passée à `failed` côté base apparaît à jour sans recharger la page (moins de 10 s).
- Suppression d'une vidéo par l'interface : confirmation, carte retirée, compteur mis à jour, message « supprimée avec succès ».
- Éditeur : canevas initialisé, image complète et bien placée, ajout de texte, fenêtre large et lisible.
- Enregistrement refusé par le stockage (avant ajout des politiques sur dev) : fenêtre reste ouverte, bouton réactivé.
- **Enregistrement de bout en bout** (après ajout des politiques sur dev) : message de succès, carte mise à jour avec le texte incrusté, URL en base remplacée, fichier de **1376×767** (résolution d'origine conservée).
- Studio : écran de départ sans pied de page, étiquettes des cartes lisibles.

Données de test créées sur dev : supprimées (lignes `generated_images` et `generated_videos`, fichier du stockage).

**Non testé** :
- Les deux Edge Functions modifiées : relues, non exécutées (elles appellent OpenAI et Replicate/Runway, payants). À vérifier en production avec une génération d'image (étape 3.7.1, 3.7.5) ; le chemin d'échec d'envoi vers le stockage (E1) n'est pas reproductible à volonté.
- Génération réelle d'une vidéo par le Studio (pas de clé de génération vidéo utilisée en test).
- Affichage sur téléphone (éditeur plein écran, grille à deux colonnes de la Bibliothèque).
- Le message d'avertissement `savedToLibrary: false` du Studio (dépend de E1).

## 5. Points à connaître (non corrigés ici)

- **Supprimer une entrée de la Bibliothèque ne supprime pas le fichier du stockage** (ni la version modifiée précédente après une édition). Voulu : une boutique ou un produit peut réutiliser la même URL. À traiter avec un inventaire des références avant tout nettoyage.
- **Le nettoyage à 30 jours** : la fonction `cleanup_old_generated_media` existe (réservée au `service_role`) mais **aucune migration du dépôt ne la planifie**. Si 3.1.d ne renvoie rien en production, le bandeau « conservés 30 jours » est inexact et ni les lignes ni les fichiers ne sont supprimés. De plus, la fonction supprime les lignes mais pas les fichiers.
- **Crédit débité malgré E1** : si l'envoi vers le stockage échoue, l'image est générée et le crédit est décompté, mais rien n'est enregistré ; le Studio demande alors de la télécharger tout de suite.
- **Lignes existantes avec `data:` ou URL OpenAI expirée** (3.1.c) : non réparées ; l'image d'origine n'est plus récupérable pour les URL expirées.
- **Une vidéo restée `processing` n'est pas corrigée en base** : seul l'affichage la traite comme échouée après 20 minutes. Sur une génération réellement longue (au-delà de 20 minutes), la carte affichera « Échec » alors que la vidéo peut encore aboutir ; les fonctions sont bornées à 5 minutes d'attente par fournisseur, ce cas est donc improbable.
- **Dev et prod divergent sur le stockage** : dev n'avait aucune des politiques `generated-content` du dépôt (corrigé sur dev le 21/10/2026). L'historique de migrations de dev est lui aussi incomplet (une quarantaine de migrations non enregistrées) : ne pas y utiliser `db push`.
- Le **Studio IA** reste affiché « Bientôt disponible » dans la barre latérale alors que `/studio` est fonctionnel : décision produit, non modifiée.
