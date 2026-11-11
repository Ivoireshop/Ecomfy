# Déploiement — RBAC/RLS, collaborateurs, invitations, e-mails en dur (M7) — 11/11/2026

**Branche :** `jeanmarc` · **Migration :** `20261111100000_rbac_no_hardcoded_emails_collaborators.sql` · **État :** testée sur base jetable (PostgreSQL 15) puis **appliquée sur la dev le 11/11/2026** (`supabase db query --linked -f`, jamais `db push`) avec `invite-shop-collaborator` et `app-health-monitor` déployées et testées de bout en bout ; **pas encore en prod** ; non commitée.
**Règle :** jamais `supabase db push` en prod. Contrôler `cat supabase/.temp/linked-project.json` avant toute commande (le lien du CLI change de projet).

## 1. Ce qui change

| # | Problème constaté (reproduit par les cas « avant » du test) | Correction |
|---|---|---|
| 1 | Déclencheur `assign_founder_role` : `djateulrich@gmail.com` → `founder`, `regnis13@gmail.com` → `co_founder` à l'inscription. Si l'un des comptes est supprimé, l'adresse redevient inscriptible. | Déclencheurs et fonction supprimés. Le rôle en base est la seule source de vérité. |
| 2 | `is_founder_or_master()` acceptait l'e-mail `djateulrich@gmail.com` sans rôle (utilisée par « Founders read all shops/payments/profiles… »). | Réécrite : mêmes rôles qu'avant (`founder`, `co_founder`, `shareholder`, `admin`), plus de raccourci par e-mail. |
| 3 | `app-health-monitor` : liste d'e-mails en dur pour les alertes. | Destinataires lus dans `user_roles` (`founder`, `co_founder`) via `_shared/founder-recipients.ts`. Aucun destinataire → erreur journalisée, pas de plantage. |
| 4 | Tout collaborateur actif, même `view_orders`, écrivait les thèmes (`shop_installed_themes`, `product_theme_settings`), l'assistant IA, les audios produit et le SEO (`is_shop_collaborator` = « n'importe quel rôle »). | Nouvelle fonction `has_shop_permission(shop, rôles[])` : propriétaire, ou collaborateur actif avec l'un des rôles (ou `full_admin`). Thèmes, assistant, SEO : `edit_shop`. Audios, produits, images, traductions : `edit_shop` ou `manage_catalog`. |
| 5 | Le rôle `manage_catalog` (« Ajouter, modifier ou supprimer des produits ») n'ouvrait aucun droit : aucune politique ne le lisait. | Il ouvre produits, images, traductions et audios. |
| 6 | Un collaborateur `edit_shop` pouvait faire `UPDATE shops SET user_id = <lui-même>` et prendre la boutique (la garde de facturation ne protège pas `user_id`). | Déclencheur `trg_guard_shop_owner` : `user_id` immuable pour tout le monde sauf `founder`/`co_founder` et les fonctions serveur. |
| 7 | La politique « Admins can manage all roles » (FOR ALL) laissait un `admin` s'insérer `founder` dans `user_roles`. | Supprimée. Les rôles se gèrent par `manage-founder-roles` (service_role, fondateur principal). Aucun code navigateur n'écrit dans `user_roles` (vérifié par recherche dans `src/` et `supabase/functions/`). |
| 8 | `accept_shop_invitation` : pas de contrôle d'e-mail confirmé, pas d'expiration, jeton réutilisable par un autre compte, adresse invitée renvoyée en clair. | E-mail confirmé exigé (lu dans `auth.users`), expiration à 14 jours (pour une invitation en attente ; renvoyer l'invitation la renouvelle), `already_used` si un autre compte a le jeton, rejouer son propre lien reste un succès, adresse masquée (`co***@example.com`). |
| 9 | Politique « Collaborator can read own invite » : testait `auth.jwt() ->> 'email_verified'`, champ absent du niveau supérieur du JWT Supabase (branche morte). | Remplacée par `current_user_email_confirmed()` (lu dans `auth.users`). |
| 10 | `invite-shop-collaborator` : recherche `ilike` avec jokers (`a_b@x.com` retrouvait `aXb@x.com` et lui écrasait les rôles), lien construit depuis l'en-tête `Origin` fourni par le client (lien de phishing envoyé depuis `noreply@ecomfy.cloud`), HTML du mail non échappé (nom de boutique, adresse), nom de boutique pris dans le corps de la requête, aucune limite d'envoi, invitation d'un collaborateur actif repassée en `pending` (accès coupé). | `%`/`_` neutralisés ; origine en liste blanche (`APP_URL` + secret facultatif `INVITE_ALLOWED_ORIGINS`) ; tout le HTML échappé ; nom lu en base seulement ; 20 invitations/heure et 50 collaborateurs par boutique ; un collaborateur actif le reste ; on ne s'invite pas soi-même. Front : le repli par écriture directe n'est plus utilisé quand le serveur refuse, messages dédiés, même échappement du `ilike`. |

## 2. Avant de commencer (prod, lecture seule)

```sql
-- Le déclencheur ne doit être supprimé que si le rôle existe en base (la migration refuse sinon).
select r.role, u.email from public.user_roles r join auth.users u on u.id = r.user_id where r.role in ('founder','co_founder');
-- Qui a le rôle admin ? (il perd la gestion de user_roles)
select u.email from public.user_roles r join auth.users u on u.id = r.user_id where r.role = 'admin';
-- Politiques qui s'appuient encore sur « n'importe quel collaborateur »
select tablename, policyname, cmd from pg_policies where schemaname='public' and (coalesce(qual,'')||coalesce(with_check,'')) ~* 'is_shop_collaborator|is_shop_owner_or_collaborator' order by 1,2;
-- Anciens e-mails en dur encore présents dans des politiques ou fonctions ?
select p.proname from pg_proc p where p.pronamespace='public'::regnamespace and pg_get_functiondef(p.oid) ~* 'djateulrich|regnis13';
select tablename, policyname from pg_policies where (coalesce(qual,'')||coalesce(with_check,'')) ~* '@(gmail|ecomfy)\.';
```
Sur la dev (11/11) : 1 `founder`, 2 `co_founder`, aucun `admin`, `roles` de `shop_collaborators` en `text[]`, toutes les tables visées existent, les 6 politiques à remplacer portent bien les noms attendus, aucune politique ne contient d'e-mail.

## 3. Ordre d'exécution

1. **Migration** (fait sur la dev le 11/11 ; en prod : Éditeur SQL du tableau de bord, une seule exécution ; idempotente, rejouée deux fois sans erreur en test).
2. **Edge Functions** : `invite-shop-collaborator` (nouveau `helpers.ts` embarqué) et `app-health-monitor` (nouveau `_shared/founder-recipients.ts`). Ordre indifférent avec la migration, mais **ne pas déployer le front avant `invite-shop-collaborator`** si l'on veut que les nouveaux refus s'affichent proprement.
3. **Front** via `main` (`ShopCollaboratorsManager`, `AcceptShopInvite`).
4. Secret facultatif en dev / préproduction : `INVITE_ALLOWED_ORIGINS=http://localhost:8080,https://<préproduction>` (sinon les liens d'invitation pointent sur `APP_URL`, ce qui est voulu en prod).

## 4. Contrôles après déploiement

```sql
select to_regproc('public.assign_founder_role') is null as fonction_supprimee,
       (select count(*) from pg_trigger where tgrelid='auth.users'::regclass and not tgisinternal and tgfoid::regproc::text like '%founder%') as declencheurs_restants;
select pg_get_functiondef('public.is_founder_or_master'::regproc) !~* 'gmail' as sans_email;
select tablename, policyname from pg_policies where schemaname='public' and (coalesce(qual,'')||coalesce(with_check,'')) ~* 'is_shop_collaborator';
-- attendu : seules les lectures « Collaborators can view assigned shop », « … edit_shop can view products », « … can view product images »
```
Recette navigateur (non faite) : se connecter en fondateur (tableau de bord et menu fondateur visibles) ; inviter un collaborateur `view_orders` puis vérifier qu'il ne voit/modifie ni thèmes ni assistant ni SEO ; un collaborateur `manage_catalog` crée un produit ; ouvrir un lien d'invitation avec un compte non confirmé, avec un mauvais compte, puis le bon.

## 4 bis. Recette navigateur (dev, 11/11/2026) et correctifs d'interface

Faite avec Claude in Chrome sur la dev (comptes fictifs `…@resend.dev`, supprimés ensuite) : s'inviter soi-même → « Invitation refusée » ; invitation d'un tiers → « En attente » avec « Copier lien » / « Renvoyer » ; acceptation avec le mauvais compte → « Invitation non disponible », adresse masquée ; avec le bon compte → « Accès activé » ; collaborateur `view_orders` et `manage_catalog` → seules les sections prévues. Non testés en navigateur : le rôle `edit_shop` et l'écran « jeton expiré » (couvert par le test API).

Défauts d'interface corrigés au passage (front seul, rien à faire côté base) :

| Fichier | Défaut | Correction |
|---|---|---|
| `src/pages/ShopEditor.tsx` | `view_orders` ouvrait aussi Codes Promo, Clients Fidèles et Statistiques | `view_orders` / `manage_delivered_orders` : Commandes et Paniers abandonnés ; `edit_shop` : en plus Clients Fidèles, Codes Promo, Statistiques ; `view_stats` et `manage_customers` gardent leurs écrans |
| `src/pages/ShopEditor.tsx` | bannière « Activer · 2$ » visible des collaborateurs | réservée au propriétaire |
| `src/components/shop/ShopSidebar.tsx` | bouton « Sauvegarder » visible sans droit de modification | prop `canSave` : propriétaire, `edit_shop`, `full_admin` |
| `src/pages/CompleteProfile.tsx` | « Compte Google : » pour un compte e-mail/mot de passe | « Adresse e-mail : » sauf fournisseur Google |

## 5. Tests

| Test | Où | Résultat (11/11/2026) |
|---|---|---|
| Base jetable PostgreSQL 15 : socle d'avant (copie des politiques de la dev) + constat des 8 failles, migration **deux fois**, 69 cas après correction | `supabase/tests/rbac_collaborators.sql`, migration, `supabase/tests/rbac_collaborators_cases.sql` | **77 sur 77** (les cas `00a`–`00h` prouvent que les failles existaient avant) |
| Vitest : échappement HTML/LIKE, liste blanche d'origine, destinataires d'alerte, absence d'e-mail dans les fichiers | `supabase/tests/invite-shop-collaborator.test.ts` | **7 sur 7** |
| Dev réelle (11/11/2026) : 8 comptes fictifs `delivered+zzrbac…@resend.dev` + 1 boutique, appels REST avec de vrais JWT, fonction d'invitation déployée, RPC d'acceptation ; tout supprimé ensuite (69 comptes / 58 boutiques comme avant) | script du scratchpad de session (non versionné) | **50 sur 50** + 1 (e-mail non confirmé) |
| Suite complète du dépôt | `npx vitest run` | 292 tests sur 292, 18 cas SQL de la suite existante |

Commande base jetable : `psql -v ON_ERROR_STOP=1 -f supabase/tests/rbac_collaborators.sql -f <migration> -f <migration> -f supabase/tests/rbac_collaborators_cases.sql` (base vide, jamais dev ni prod).

**Constats du test sur la dev :** (1) le déploiement a révélé une erreur de syntaxe dans `invite-shop-collaborator/index.ts` (un saut de ligne dans la regex du sujet du mail), invisible des tests unitaires qui n'importent que `helpers.ts` : corrigée, la fonction se déploie ; (2) l'INSERT/DELETE sur `shop_ai_assistants` reste réservé au propriétaire (inchangé) : un collaborateur `edit_shop` modifie l'assistant mais ne le crée pas ; (3) `shop_collaborators.updated_at` est maintenu par le déclencheur `trg_shop_collab_updated`, ce qui convient à l'expiration à 14 jours et à la limite horaire.

**Non testé :** le garde-fou « aucun founder → refus » ; le déclenchement réel de `app-health-monitor` (la clé service de la dev, au nouveau format, ne passe pas la passerelle depuis l'extérieur : seule la lecture des destinataires a été vérifiée sur la vraie base, 3 adresses) ; la réception d'un e-mail d'invitation (l'envoi répond `email_sent: true`, adresses puits `resend.dev`, `EMAIL_MODE` défini sur la dev) ; le parcours navigateur (`ShopCollaboratorsManager`, `AcceptShopInvite`).

## 6. Retour arrière

Avant la migration, capturer les définitions actuelles (voir `docs/PROCEDURE-ROLLBACK-2026-10.md`). Les définitions d'avant sont aussi dans le socle `supabase/tests/rbac_collaborators.sql` (copie de la dev du 11/11). Pour revenir en arrière : recréer les politiques et fonctions de ce socle (`is_founder_or_master`, `accept_shop_invitation`, « Admins can manage all roles », « Collaborator can read own invite », les politiques par table), `DROP TRIGGER trg_guard_shop_owner ON public.shops`. Ne pas recréer `assign_founder_role` sans en retirer les adresses.

## 7. Décisions ouvertes (à trancher, rien n'a été modifié sur ces points)

1. **`shareholder` lit toutes les boutiques, paiements, profils** : `is_founder_or_master()` garde les quatre rôles pour ne pas changer le comportement, mais un associé n'a pas de raison métier de lire tous les paiements et profils de la plateforme (données personnelles). Proposition : le retirer de cette fonction et lui laisser seulement `is_corporate_reader()` (gouvernance). À valider avec l'effet sur `AssociateSpace` et `FounderRoute` (qui l'admet aussi).
2. **`public/.well-known/security.txt`** contient `Contact: mailto:djateulrich@gmail.com`. C'est un contact public voulu, mais c'est une adresse personnelle : à remplacer par une boîte de l'entreprise (par exemple `security@ecomfy.cloud`) si elle existe ; je ne l'ai pas changé.
3. **Migrations historiques** : les anciennes migrations qui contiennent encore ces adresses (`20251106104634`, `20251107132948`, `20260831*`, `20260901000000`, `20260901020000`, `20260902140000`) ne sont pas modifiées (historique appliqué). **Ne jamais rejouer `20260902140000`** : elle référence `profiles.role` / `profiles.is_admin` (colonnes absentes) et réintroduirait l'e-mail dans des politiques ; `is_authorized_corporate_member` n'existe pas sur la dev. Sur un nouvel environnement, la migration `20261111100000` doit passer après elles ; le premier `founder` s'insère alors à la main : `insert into public.user_roles (user_id, role) select id, 'founder' from auth.users where email = '<adresse>';`
4. **Confirmation d'e-mail** : si la confirmation est désactivée dans Supabase Auth (`autoconfirm`), `email_confirmed_at` est posé dès l'inscription et le contrôle n'apporte rien de plus ; le jeton (24 octets aléatoires, envoyé à l'invité seul) reste alors la protection.
5. **Pas de jeton à usage unique côté lien copié** : le propriétaire peut toujours copier le lien ; il vaut l'invitation. Un collaborateur révoqué puis réinvité reprend le même jeton.
