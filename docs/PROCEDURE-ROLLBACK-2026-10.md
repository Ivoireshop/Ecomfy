# Procédure de retour arrière (25 octobre 2026)

**Projets Supabase :** production `yfggrceynzcwklbxhgix` · dev `xfpbpxncserliskrbaim`
**Périmètre :** tout ce que la branche `jeanmarc` ajoute à la production : front (Vercel), Edge Functions, migrations SQL, tâches `pg_cron`, secrets.
**À qui :** la personne qui déploie, et celle qui décide d'annuler. Ce document est fait pour être suivi sous pression : lire les sections 1 et 3, puis aller à la couche concernée.
**Complète, ne remplace pas** les sections « Retour arrière » de chaque guide (index en section 6) : elles disent *quoi défaire* pour leur sujet ; celui-ci dit *dans quel ordre*, *avec quoi se couvrir avant*, *quand ne pas le faire* et *ce qui ne revient pas*.

---

## 1. Les quatre règles

1. **Le front et les Edge Functions reviennent en une commande. La base, non.** Presque toutes nos migrations sont des `CREATE OR REPLACE FUNCTION` ou des `DROP POLICY` + `CREATE POLICY` : elles n'ont pas de « down ». Le seul état d'avant fiable est celui **capturé avant le déploiement** (section 2), pas celui que les fichiers du dépôt laissent supposer : la base réelle diverge des migrations.
2. **Un retour arrière de correctif de sécurité rouvre la faille.** C'est le cas de H1 à H11, C1 à C8, de la garde de facturation, des avis, de la communauté. Un retour arrière SQL ciblé ne sert qu'à **débloquer un flux, temporairement**, avec une date de réparation. Si le problème est un faux positif (le correctif refuse un cas légitime), corriger en avant est presque toujours plus sûr.
3. **Ce qui a été écrit depuis le déploiement ne revient pas avec un « down »,** et disparaît avec une restauration de sauvegarde. Les écritures d'argent (paiements, registre, retraits, factures) sont le vrai risque : section 7.
4. **Défaire dans l'ordre inverse du déploiement :** front, puis Edge Functions, puis tâches planifiées, puis SQL. Et défaire **toutes** les couches qui se parlent : un ancien front sur une base migrée, ou une base restaurée sous des fonctions neuves, casse (section 4).

## 2. Avant chaque déploiement en production (5 minutes, obligatoire)

| # | Action | Pourquoi |
|---|---|---|
| 2.1 | **Sauvegarde** : Database > Backups (point de restauration ; vérifier si PITR est actif, sinon la granularité est la sauvegarde quotidienne). En plus, pour ne pas dépendre de la date : `npx supabase@latest db dump --db-url "$env:PROD_DB_URL" -f <dossier-hors-dépôt>\schema-AAAAMMJJ.sql` (et `--data-only --use-copy` si une copie des données est voulue). L'URL de connexion se passe dans une variable d'environnement de la session, **jamais écrite dans un fichier** ; la copie des données contient des données personnelles : à chiffrer et à ranger hors du dépôt. | Seul retour possible pour ce qui est irréversible (section 6, colonne « Irréversible »). |
| 2.2 | **Capture de la logique de la base** : coller [`supabase/maintenance/capture_logic_before_deploy.sql`](../supabase/maintenance/capture_logic_before_deploy.sql) dans l'éditeur SQL de la **production**, exporter en CSV hors du dépôt (`capture-prod-AAAAMMJJ-HHMM.csv`). Lecture seule. Contient, pour tout le schéma `public` : corps et droits de chaque fonction, politiques RLS, déclencheurs, contraintes CHECK, tâches `pg_cron`, tables du temps réel. | C'est le « down » de toutes les `CREATE OR REPLACE`. Rejouer une ligne de la colonne `ddl` remet l'objet dans son état d'avant. Testé sur dev (25/10/2026) : les 758 instructions rejouées dans une transaction annulée, aucune erreur. |
| 2.3 | **Noter les points de retour** : commit du front en ligne (Vercel > Deployments > le déploiement « Production » actuel), `git rev-parse HEAD` des Edge Functions déployées, version affichée de chaque fonction qu'on va toucher (Edge Functions > version). Un tag local aide : `git tag pre-deploy-AAAAMMJJ`. | Sans ce commit, « la version précédente » est une devinette ; `main` ne convient pas (`founder-activate-shop` et `founder-record-commission-payment` sont absents de `main` mais déjà en production). |
| 2.4 | **Désigner qui décide** d'annuler et fixer un seuil (ex. « paiements en échec > 2 sur 10 minutes, ou boutique verrouillée à tort »). | Sinon on bricole une demi-annulation. |

## 3. Quoi faire selon le symptôme

| Symptôme | Action | Section | Délai |
|---|---|---|---|
| Une page ne s'affiche plus, erreur JavaScript, mais la base répond | Vercel : **Instant Rollback** vers le déploiement noté en 2.3 | 5.1 | 1 minute |
| Une Edge Function répond 500 ou fait n'importe quoi | Redéployer **cette** fonction depuis le commit noté en 2.3 | 5.2 | 2 minutes |
| Des boutiques passent en « verrouillée » alors qu'elles ne devraient pas | **Arrêter la tâche** `enforce-shop-payment-deadlines` immédiatement, puis rouvrir les boutiques | 6.2, bloc A | 1 minute |
| Un marchand ou un visiteur est refusé à tort par une règle (code `42501`) | Désactiver **le déclencheur seul** (réversible), corriger en avant | 6.2, blocs B et C | 2 minutes |
| Une fonction SQL se comporte mal | Rejouer **cette** fonction depuis la capture 2.2 | 6.1 | 5 minutes |
| Paiements ou registre incohérents | **Ne rien défaire à chaud.** Geler les retraits, lire la section 7 | 7 | : |
| Données corrompues en masse, plus aucune correction possible | Restauration de la sauvegarde, **après** export des écritures valides survenues depuis | 7 | 1 à 2 heures |

## 4. Compatibilité entre couches (à lire avant d'annuler une seule couche)

| Si on revient en arrière sur… | …alors que… | Conséquence |
|---|---|---|
| le **front** (ancien) | la base a `20261018120000` (H10) | L'ancien front crée les commandes par insertion directe, désormais révoquée : **plus aucune commande publique**. Il faut aussi le retour SQL de H10, qui rouvre la faille (`DEPLOIEMENT-COMPLET-2026-10.md` section 14). |
| le **front** (ancien) | la base a `20261018130000`, `20261020120000` (H6) | L'ancien front ne crée plus de profil d'affilié et n'appelle plus `get_or_create_my_wallet`. |
| le **front** (ancien) | la base a `20261022130000` (codes promo) | Compatible : l'ancien front reste utilisable, sans remise (`DEPLOIEMENT-CODES-PROMO-2026-10.md`, section 3). |
| le **front** (ancien) | la base a `20261022120000`, `20261022140000`, `20261023100000` | Compatible, les ajouts sont ignorés par l'ancien code. |
| une **Edge Function** (ancienne) | la base a la fonction neuve correspondante | En général compatible (l'ancienne ne l'appelle pas). Contre-exemple : `ecomfy-pay-webhook` ancien = webhook **non signé** (C5 rouvert). |
| une **Edge Function** (nouvelle) | la base restaurée / ancienne | Casse : la fonction appelle des RPC absentes (`confirm_ecomfy_payment`, `evaluate_shop_promo`…). Une restauration de base impose de ramener aussi les fonctions. |
| la **base restaurée** | des paiements ont eu lieu depuis | Le fournisseur (GeniusPay) a encaissé, pas nous : section 7. |

## 5. Front et Edge Functions

### 5.1 Front (Vercel)

Vercel > projet > Deployments > déploiement noté en 2.3 > menu > **Instant Rollback** (ou *Promote to Production*). Aucune reconstruction, effet immédiat. `vercel.json` (CSP, en-têtes) revient avec le build. Le service worker est servi en `no-cache` : les navigateurs récupèrent l'ancien build au prochain chargement, sans action du marchand. Vérifier ensuite : accueil, vitrine d'une boutique, `/dashboard`.

Une branche Git n'a pas à être touchée : ne **pas** faire `git revert` / `git reset` sur `jeanmarc` pour un retour d'urgence, cela crée des commits que personne n'a revus. Le retour d'urgence est Vercel ; le correctif durable se fait ensuite par commit normal.

### 5.2 Edge Functions

Les fonctions s'empaquettent avec `supabase/functions/_shared` (54 fonctions l'importent) : une ancienne fonction avec un `_shared` neuf, ou l'inverse, peut échouer à l'exécution. Revenir **avec le dossier complet du commit noté**, dans un répertoire de travail séparé pour ne pas toucher à la branche en cours :

```powershell
$P    = "yfggrceynzcwklbxhgix"                  # PRODUCTION, toujours explicite
$BASE = "<commit noté en 2.3>"
git worktree add ..\ecomfy-rollback $BASE        # copie propre de l'ancien état
Set-Location ..\ecomfy-rollback
npx supabase@latest functions deploy <nom-de-la-fonction> --project-ref $P --use-api
# autant de fois que de fonctions à ramener
Set-Location ..\Ecomfy
git worktree remove ..\ecomfy-rollback
```

- Ne jamais `supabase link` vers la production dans ce dépôt (règle 3 de `DEPLOIEMENT-COMPLET-2026-10.md`) : `--project-ref` explicite.
- Les **secrets** (`CRON_SECRET`, `GENIUSPAY_WEBHOOK_SECRET`, clés IA…) ne changent pas avec un redéploiement et ne sont pas à supprimer : une ancienne fonction les ignore.
- Une fonction **créée par ce déploiement** (absente de l'état d'avant) ne se « ramène » pas : `npx supabase@latest functions delete <nom> --project-ref $P`. À noter en 2.3 en comparant la liste des fonctions avant et après.
- Ramener ces fonctions **rouvre** : H3 (appels cron sans secret vérifié : les 8 fonctions cron), H4 (e-mails non authentifiés), H9 (IA sans quota : 14 fonctions), C5 (`ecomfy-pay-webhook` non signé), C7 (`manage-founder-roles`). Ne ramener que la fonction fautive, pas le lot.

## 6. Base de données

### 6.1 Méthode générale : rejouer depuis la capture

1. Ouvrir le CSV de 2.2. Filtrer `kind` = `function` et `object` = la fonction fautive : la colonne `ddl` est un `CREATE OR REPLACE FUNCTION …;` prêt à coller. Même chose pour `policy` (déjà précédé d'un `DROP POLICY IF EXISTS`), `trigger` (précédé d'un `DROP TRIGGER IF EXISTS`) et `check`.
2. **Rejouer aussi la ligne `function_acl`** de la même fonction : un `CREATE OR REPLACE` conserve les droits existants, mais si la fonction a été supprimée puis recréée, les droits d'origine sont perdus et la valeur par défaut est `EXECUTE` pour `PUBLIC`, ce qui est précisément la faille corrigée en C2.
3. Faire l'opération dans `begin; … commit;` ; une erreur annule tout.
4. Si une fonction a changé de **signature** (paramètre ajouté), `CREATE OR REPLACE` ne remplace pas l'ancienne : il crée une surcharge. Supprimer la version neuve (`drop function … (liste de types)`) avant de rejouer l'ancienne. Cas connus : `create_public_order` (10 → 11 paramètres), `request_wallet_withdrawal_atomic` (6 → 7).
5. Sans capture, l'état d'avant se retrouve dans le dépôt : `git log -S"nom_de_la_fonction" -- supabase/migrations` donne les migrations qui la définissent ; la **dernière avant celle qu'on annule** est la version à rejouer. Moins fiable (la base diverge du dépôt) : à valider à la lecture.

### 6.2 Blocs pour les migrations qui n'avaient pas de retour arrière documenté

Chaque bloc a été exécuté sur dev dans une transaction annulée (25/10/2026) : la syntaxe est valide ; leur effet métier n'a pas été rejoué.

**A. Échéances de facturation, `20261023140000`** : à lancer en premier si des boutiques se verrouillent à tort. Au premier passage, la tâche verrouille en 5 minutes toute boutique déjà en retard ; l'arrêter ne rouvre rien.

```sql
select cron.unschedule('enforce-shop-payment-deadlines');
drop function if exists public.enforce_all_shop_payment_states();
-- Boutiques verrouillées dans la dernière journée (à relire, boutique par boutique, avant de rouvrir) :
select id, shop_payment_status, commission_balance_due, locked_at
from public.shops where locked_at > now() - interval '1 day' order by locked_at desc;
-- Réouverture d'une boutique (voir DEPLOIEMENT-ABONNEMENT-2026-10.md, section 6) :
-- update public.shops set shop_payment_status = 'active', is_suspended = false, locked_at = null where id = '<id>';
```
Le verrouillage revient alors à l'ancien déclenchement : par le navigateur du marchand (`useShopPaymentStatus`). Une boutique rouverte à la main avec une dette échue peut donc être reverrouillée à sa prochaine visite.

**B. Garde des colonnes de facturation de `shops`, `20261025100000`** : le déclencheur lève `42501 shop_billing_columns_protected`. Pour débloquer un flux **sans** rouvrir la faille de façon permanente :

```sql
alter table public.shops disable trigger trg_guard_shop_billing_columns;   -- temporaire
-- corriger (liste v_defaults de guard_shop_billing_columns, ou faire passer l'écriture par une fonction serveur), puis :
alter table public.shops enable trigger trg_guard_shop_billing_columns;
```
Tant que le déclencheur est désactivé, **tout marchand connecté peut réécrire sa dette, son taux et son abonnement** (c'est le constat qui a motivé la migration). Ne pas le laisser désactivé plus d'une journée, ne pas faire de `drop`. Le `drop` définitif (`drop trigger trg_guard_shop_billing_columns on public.shops; drop function public.guard_shop_billing_columns();`) n'est justifié que si on le remplace par une garde équivalente.

**C. Avis produits, `20261023160000`** : même principe.

```sql
alter table public.product_reviews disable trigger trg_product_reviews_guard;   -- temporaire ; ré-activer ensuite
drop function if exists public.get_product_review_stats(uuid, uuid);             -- optionnel, sans donnée
```
Ne pas supprimer les clés étrangères `product_reviews_product_id_fkey` / `product_reviews_shop_id_fkey` : elles ont pu exister avant. Les avis orphelins que la migration a **supprimés** ne reviennent que par la sauvegarde.

**D. Confirmation de paiement Ecomfy Pay, `20261023100000`** : redéployer d'abord l'ancien `ecomfy-pay-webhook` (5.2), puis :

```sql
drop function if exists public.replay_incomplete_ecomfy_payments(int);
drop function if exists public.confirm_ecomfy_payment(text, text, text, numeric, text, text, text, jsonb, text);
drop function if exists public.ecomfy_log_payment_event(text, text, uuid, jsonb, text, text);
```
La mise à jour `orders.payment_status = 'PAID'` → `'paid'` faite par la migration n'est pas inversée : c'est la valeur que lit le reste de l'application.

**E. Fonctions remplacées sans guide de retour**, à rejouer depuis la capture ou, à défaut, depuis le dépôt :

| Fonction | Migration annulée | Version d'avant (dépôt) | Effet du retour |
|---|---|---|---|
| `get_shop_social_proof_orders` | `20261024100000` | `20260812124000` | La vitrine rémontre aussi les commandes annulées et anciennes (cosmétique) |
| `get_top_sellers` | `20261020130000` | `20260916132500` | L'accueil retélécharge les avatars en base64 (jusqu'à ~3 Mo) |
| `is_founder_or_cofounder` | `20261018130000` | `20261005160000` | Rouvre l'oracle de rôles par UUID pour `anon` |
| `get_or_create_my_wallet` | `20261018130000` | (nouvelle) `drop function if exists public.get_or_create_my_wallet();` | Le front neuf n'ouvre plus le portefeuille : ramener le front d'abord |

**F. `20261021120000` (jetons Google de l'Intelligence SEO)** : d'après le suivi, **non appliquée** en production. Si elle l'a été puis doit être annulée, les droits d'avant sont dans la capture 2.2 (lignes `policy` et `function_acl` de `shop_seo_*`) : les rejouer rouvre la lecture des jetons Google par le client.

### 6.3 Index : où est le retour arrière de chaque migration

« Irréversible » = ne se défait pas par SQL, uniquement par la sauvegarde.

| Migration | Retour arrière | Irréversible |
|---|---|---|
| `20261018120000` H10, `create_public_order` | `DEPLOIEMENT-COMPLET-2026-10.md` §14 (rouvre la faille) | – |
| `20261018130000` wallet, garde de rôle | 6.2 bloc E | – |
| `20261019120000` abonnement | `DEPLOIEMENT-ABONNEMENT-2026-10.md` §6 | Lignes `commission_payments` / événements créés par le rattrapage |
| `20261020120000` affiliation | `DEPLOIEMENT-AFFILIATION-2026-10.md` §5 | – |
| `20261020130000` top sellers | 6.2 bloc E | – |
| `20261021120000` SEO | 6.2 bloc F (non appliquée) | – |
| `20261021130000` communauté | `DEPLOIEMENT-COMMUNAUTE-2026-10.md` §3.6 | – |
| `20261021140000` bibliothèque | `DEPLOIEMENT-BIBLIOTHEQUE-2026-10.md` §3.8 | – |
| `20261021150000`, `20261022100000`, `20261022110000` boutique restreinte, livraisons | `DEPLOIEMENT-BOUTIQUE-RESTREINTE-2026-10.md` §8.6 | – |
| `20261022120000` paniers abandonnés | `DEPLOIEMENT-PANIERS-ABANDONNES-2026-10.md` §3 | – |
| `20261022130000` codes promo | `DEPLOIEMENT-CODES-PROMO-2026-10.md` §3 | Remises déjà appliquées aux commandes (colonnes à conserver) |
| `20261022140000` registre Ecomfy Pay | `DEPLOIEMENT-LEDGER-PAY-2026-10.md` §7 et §9.3 | **Oui dès la première écriture réelle** : le registre devient immuable |
| `20261022150000` références | `DEPLOIEMENT-LEDGER-PAY-2026-10.md` §9.3 | – |
| `20261023100000` confirmation de paiement | 6.2 bloc D | `PAID` → `paid` |
| `20261023100000` champs SEO produit | Aucun nécessaire (colonnes ajoutées, inoffensives) | – |
| `20261023110000` résumé financier hebdomadaire | `DEPLOIEMENT-FINANCE-2026-10.md` §« Retour arrière » | – |
| `20261023120000`, `20261023130000`, `20261023150000` facturation | `DEPLOIEMENT-FACTURATION-2026-10.md` §3.6 | – |
| `20261023140000` échéances | 6.2 bloc A | Boutiques déjà verrouillées (à rouvrir à la main) |
| `20261023160000` avis | 6.2 bloc C ; `DEPLOIEMENT-AVIS-2026-10.md` | **Avis orphelins supprimés** |
| `20261024100000` preuve sociale | 6.2 bloc E | – |
| `20261025100000` garde de facturation | 6.2 bloc B ; `DEPLOIEMENT-GARDE-FACTURATION-2026-10.md` | – |
| Vague 1 (`20261011…` à `20261017…`) | `DEPLOIEMENT-PROD-2026-10.md` §10, `SECURITY-HOTFIX-2026-10.md` §7, `supabase/deploy-dev/99_rollback.sql` (dev) | – |

## 7. Argent : registre, retraits, paiements

C'est la seule zone où un mauvais retour arrière fait perdre de l'argent réel plutôt que de la disponibilité.

1. **Avant de défaire quoi que ce soit, geler les sorties** : suspendre les retraits (désactiver l'appel à `ecomfy-pay-withdraw` côté front par Instant Rollback, ou rendre la fonction inopérante), pour que le registre ne bouge plus pendant l'analyse.
2. **Ne pas restaurer la sauvegarde pour « effacer » un paiement.** Le fournisseur a déjà encaissé ou versé de l'argent : une base restaurée l'ignore et le portefeuille du marchand ne correspond plus à la réalité. Une écriture erronée du registre se corrige par une **écriture inverse** (contre-passation), pas par `UPDATE`/`DELETE` (le registre est immuable depuis `20261022140000`, voir `ECOMFY-PAY-LEDGER-SCHEMA-2026-10.md`).
3. **Si une restauration est inévitable** :
   - Avant : exporter en CSV, depuis la base *actuelle*, tout ce qui a été écrit depuis l'heure de la sauvegarde dans `orders`, `order_items`, `ecomfy_payments`, `payments`, `payment_events`, `wallet_ledger`, `wallets`, `withdrawal_requests`, `settlements`, `commission_payments`, `shop_invoices`, `subscriptions`, `shop_payment_events` (filtre `created_at >= '<heure de la sauvegarde>'`).
   - Restaurer, puis **ramener aussi front et Edge Functions** à l'état d'avant (section 4, avant-dernière ligne).
   - Après : rapprocher chaque paiement exporté avec le tableau de bord GeniusPay, rejouer ceux qui sont réussis chez le fournisseur et absents chez nous (`reconcile-pending-payments`, `replay_incomplete_ecomfy_payments` si la migration `20261023100000` est encore là), puis rapprocher les retraits un à un.
   - Les Edge Functions, les secrets et les fichiers du stockage ne sont **pas** dans la sauvegarde de la base.
4. **Prévenir** les marchands concernés (soldes, retraits en attente) avant de rouvrir.

## 8. Après un retour arrière

1. **Vérifier la couche défaite** : `select jobname, schedule, active from cron.job order by 1;` (les tâches attendues sont-elles là, et seulement celles-là ?) ; comparer le nombre de fonctions et de politiques avec le CSV de 2.2 ; refaire les tests de la section 8 de `DEPLOIEMENT-PROD-2026-10.md` (connexion marchand et fondateur, commande publique, paiement de test, page fondateur).
2. **Consigner** (trois lignes suffisent) : heure de la décision, couche(s) défaite(s) avec commit ou objet, ce qui reste rouvert (section 5.2 et 6.2) et **la date à laquelle on le referme**.
3. **Ne pas redéployer en l'état.** La migration fautive est dans le dépôt et dans les guides : la corriger (nouveau fichier de migration plutôt que l'édition d'un fichier déjà appliqué), la rejouer sur dev puis sur une base jetable, puis suivre à nouveau les guides.
4. **Les migrations appliquées à la main** n'apparaissent pas dans `schema_migrations` (règle 1 de `DEPLOIEMENT-COMPLET-2026-10.md`) : un retour arrière SQL ne demande donc aucun `migration repair`.

## 9. Ce qui n'est pas éprouvé

- **Vérifié** : le script de capture (2.2) s'exécute en lecture seule sur dev et son contenu complet (758 instructions : 142 fonctions, 142 droits, 320 politiques, 85 déclencheurs, 60 contraintes) se rejoue sans erreur dans une transaction annulée ; les blocs 6.2 A à D sont syntaxiquement valides sur dev.
- **Non éprouvé** : une restauration de sauvegarde Supabase de bout en bout (durée réelle, ce qui est restauré exactement selon l'offre du projet), un *Instant Rollback* Vercel, un redéploiement de fonctions via `git worktree` sous Windows. **À répéter une fois sur dev** (restauration d'une sauvegarde de dev, puis rapprochement) avant le premier déploiement de production qui contient de l'argent.
- **Les blocs SQL des autres guides** (communauté, boutique restreinte, promo, paniers, ledger, facturation) ont été écrits et relus à leur date ; ils n'ont pas été rejoués ici.
- **L'état réel de la production** : cette procédure suppose, d'après les guides, que la production n'a que la vague 1 et que tout le reste de la branche est encore en attente. La capture 2.2 le confirme ou l'infirme : la lire avant de se fier au tableau 6.3.
