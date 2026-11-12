# Contrôles après le déploiement du 12/11/2026

**Déployé en production :** 3 migrations, 70 Edge Functions, front (PR #12, `main` = `c2e4fa1`).
**À faire par :** la personne qui a déployé, dans l'ordre. Cocher au fur et à mesure et noter l'heure et le résultat dans le journal (section 9).

## 0. Points de repère (retour arrière)

| Couche | Point de retour | Comment |
|---|---|---|
| Front | déploiement Vercel de production **précédent** la PR #12 | Vercel > Deployments > Instant Rollback |
| Edge Functions | tag Git `pre-deploy-20261112` (= `origin/main` avant la PR) | redéployer la fonction avec **tout** le dossier `_shared` de ce tag (`docs/PROCEDURE-ROLLBACK-2026-10.md`, §5.2) |
| Base | fichier `capture-prod-20261112-HHMM.csv` (hors dépôt) | rejouer la colonne `ddl` des objets concernés ; **ne pas** recréer `assign_founder_role` (e-mails en dur) |

**Seuil d'annulation à décider avant de commencer :** par exemple « deux paiements en échec sur dix minutes », « le tableau de bord ne s'ouvre plus pour les marchands », « le fondateur perd l'accès ». Un correctif de sécurité (RBAC, CORS) qu'on annule rouvre la faille : corriger en avant est presque toujours préférable, sauf blocage d'un flux d'argent.

---

## 1. Tout de suite (10 minutes)

Dans un navigateur **fenêtre privée**, console ouverte (F12).

- [ ] **Vercel** : le déploiement de production est « Ready » et porte le commit `c2e4fa1`.
- [ ] **Accueil** `https://ecomfy.cloud` : se charge, aucune erreur rouge en console (surtout aucune « CORS policy »).
- [ ] **Page 404** `https://ecomfy.cloud/n-importe-quoi` : titre « Page introuvable | Ecomfy », pas de faux badge « Opérationnel », le lien WhatsApp ouvre le numéro support. Dans la console :
  ```js
  [...document.querySelectorAll('meta[name="robots"]')].map(m => m.content)
  ```
  Attendu : `["noindex, nofollow"]` (une seule balise).
- [ ] **Connexion marchand** → `/shop-manager` → **Gérer** une boutique : le tableau de bord se charge (KPI, graphique, commandes récentes), aucune erreur en console.
- [ ] **Statistiques** : les visiteurs s'affichent (« Visiteurs en ce moment »). Les visites ne sont lues qu'à l'ouverture de cette page.
- [ ] **Facturation** : bandeau et chiffres cohérents avec les commandes ; « Régler maintenant » ouvre la fenêtre (ne pas valider de paiement).
- [ ] **Retour d'onglet** : quitter l'onglet une minute, revenir : pas de rafale de requêtes, la page ne se recharge pas en boucle (onglet Réseau).
- [ ] **Compte fondateur** : le tableau de bord fondateur et ses menus s'ouvrent (réécriture de `is_founder_or_master`).
- [ ] **Vitrine publique** d'une boutique (`/shop/<slug>`), sur un domaine personnalisé si possible : produits visibles, ajout au panier, visite comptée.

**Si une page est blanche ou boucle :** Instant Rollback Vercel d'abord (1 minute), diagnostic ensuite.

---

## 2. Santé de la base (c'était la cause de la panne : surveiller 24 h)

Supabase > Reports > Database, comparer à la panne du 12/11 (swap 600-700 Mo, « Memory commitment » Severe, IOwait jusqu'à 70 %).

- [ ] **Swap** : retombe progressivement (ne reste pas collé à 600 Mo).
- [ ] **Memory commitment** : sort de l'alerte « Severe ».
- [ ] **IOwait CPU** : reste bas.
- [ ] **Connexions** : bien en dessous de 60.
- [ ] **Query Performance** : la lecture de `shop_visits` n'est plus en tête ; `realtime.list_changes` baisse.
- [ ] **Instance** : décision restante (hors code) : passer de Micro à **Small (2 Go)** si le swap persiste (redémarrage de quelques minutes, en heure creuse).

**J+1, après 03:17 UTC (première purge pg_cron) :**
```sql
select status, start_time, return_message
from cron.job_run_details
where jobid = (select jobid from cron.job where jobname = 'purge-cron-run-details')
order by start_time desc limit 3;

select (select count(*) from cron.job_run_details) as lignes,
       pg_size_pretty(pg_total_relation_size('cron.job_run_details')) as taille;
```
- [ ] Dernier statut `succeeded`, `lignes` de l'ordre de quelques dizaines de milliers (2 jours), pas de lenteur au moment de la purge.
- Note : la taille disque (≈ 387 Mo) ne diminue pas sans `VACUUM FULL` ; il verrouille la table pendant que la tâche n° 9 y écrit, à ne faire qu'en heure creuse et si l'espace compte.

---

## 3. Edge Functions : journaux (M3, CORS et codes HTTP)

Supabase > Logs > Edge Functions (ou Logs Explorer), sur la première heure puis à J+1.

- [ ] **Erreurs 5xx** : aucune fonction qui retourne 500 en boucle (le wrapper répond « Une erreur est survenue » et journalise la cause).
- [ ] **403 « Origine non autorisée. »** : ne doivent venir que d'origines inconnues. **Une origine légitime refusée** (sous-domaine de l'application, URL Vercel utilisée par des clients, application native) est le signe d'un CORS trop strict : ajouter l'origine au secret `ALLOWED_ORIGINS` (séparé par des virgules), sans redéployer :
  ```powershell
  npx supabase@latest secrets set ALLOWED_ORIGINS="https://<origine>" --project-ref yfggrceynzcwklbxhgix
  ```
  Vérifier d'abord `supabase\.temp\linked-project.json` : le lien CLI change de projet.
- [ ] **401 attendus** sur les appels sans session ; **pas de 401 sur les webhooks** `ecomfy-pay-webhook` et `geniuspay-webhook` pour les vrais appels signés (voir section 4).
- [ ] **Application native Android/iOS** (si diffusée) : une action authentifiée passe (origines `capacitor://localhost` et `https://localhost`).

---

## 4. Flux d'argent (le plus important)

Ne rien « défaire à chaud » : voir `docs/PROCEDURE-ROLLBACK-2026-10.md`, §7.

- [ ] **Premier paiement réel après le déploiement** : suivre les journaux de `ecomfy-pay-webhook` (ou `geniuspay-webhook` selon le fournisseur) : réponse 200, paiement passé de `PENDING` à `SUCCEEDED`, commande passée en payée.
- [ ] **Page fondateur de contrôle des paiements** (`/founder/shop-payment-control`) : pas de nouveau paiement bloqué en `PENDING` après quelques minutes.
- [ ] **Message d'erreur lisible** : sur une session expirée, un achat de crédits, un abonnement ou un règlement de commission affiche « Votre session a expiré… » et non « Edge Function returned a non-2xx status code ».
- [ ] **Commande publique** sur une boutique, produit **physique**, paiement à la livraison : la commande passe (le nouveau déclencheur ne doit toucher que les produits numériques).
- [ ] **Activation de boutique / commission** : un marchand peut toujours démarrer un paiement (abonnement, commission) ; aucune boutique ne passe en « verrouillée » sans raison.

---

## 5. Produits numériques

Sans paiement :
- [ ] `https://ecomfy.cloud/telechargement` : le formulaire « Retrouver mes téléchargements » s'affiche.
- [ ] `https://ecomfy.cloud/telechargement/00000000000000000000000000000000` : message « Lien de téléchargement invalide ».
- [ ] **Bucket privé** (un visiteur ne lit aucun fichier) :
  ```powershell
  curl.exe -s -i https://yfggrceynzcwklbxhgix.supabase.co/storage/v1/object/public/digital-products/x.pdf
  ```
  Attendu : erreur « Bucket not found » (400/404), jamais un fichier.
- [ ] Éditeur d'un produit → option avancée « Produit numérique » → section **« Fichiers à vendre »** : dépôt d'un PDF, téléchargement de vérification, limite réglable.

Avec un paiement réel minimal (200 XOF) sur une boutique à vous :
- [ ] Panier numérique : Mobile Money seul proposé, e-mail obligatoire, ville et adresse non exigées.
- [ ] Après paiement : bouton de téléchargement sur `/order-confirmed` ; page `/telechargement/<jeton>` ; N+1ᵉ téléchargement refusé à la limite.
- [ ] **E-mail `digital-order-ready` reçu** avec le lien. Vérifier avant que `EMAIL_MODE` de la prod est bien en envoi réel (pas `redirect`).
- [ ] Paiement à la livraison sur un produit numérique : refusé par le serveur.

**Produits numériques existants (0 vente) :**
- [ ] **« Savon mille maladie »** (boutique Kkmservice) : produit physique marqué « numérique » par erreur. Le marchand doit **décocher** « Produit numérique », sinon aucune adresse de livraison n'est demandée.
- [ ] **« Publicité tiktok »** (boutique Formation kkmservice) : le marchand doit déposer ses fichiers.

---

## 6. Collaborateurs et rôles (M7)

- [ ] **Invitations expirées** : 3 invitations en attente de plus de 14 jours ont expiré. Le propriétaire doit les renvoyer. Liste :
  ```sql
  select s.business_name, sc.invited_email, coalesce(sc.updated_at, sc.created_at) as depuis
  from public.shop_collaborators sc join public.shops s on s.id = sc.shop_id
  where sc.status = 'pending' order by depuis;
  ```
- [ ] **Collaborateur `view_orders`** (compte de test à vous) : ne voit que Commandes et Paniers abandonnés, ne modifie ni thèmes, ni assistant IA, ni SEO.
- [ ] **Collaborateur `manage_catalog`** : peut créer un produit.
- [ ] **Lien d'invitation** : avec un compte non confirmé → refus ; avec un mauvais compte → adresse masquée (`co***@…`) ; avec le bon compte → « Accès activé ».
- [ ] **Nouveau compte** : une inscription ne reçoit plus de rôle fondateur automatique. Après l'inscription d'un compte de test :
  ```sql
  select count(*) from public.user_roles ur join auth.users u on u.id = ur.user_id where u.email = '<adresse de test>';
  ```
  Attendu : 0.
- [ ] **Alertes `app-health-monitor`** : les destinataires viennent de `user_roles` (3 comptes). Aucun e-mail d'alerte attendu tant qu'il n'y a pas d'incident.

---

## 7. Suites à traiter (non bloquantes)

- [ ] `promo_codes` : 2 politiques laissent encore **tout collaborateur** lire les codes promo (« Shop collaborators read shop promo codes », « Restrict promo_codes reads to founders and shop team »). À migrer vers `has_shop_permission`.
- [ ] Rôle `shareholder` : lit toutes les boutiques, paiements et profils via `is_founder_or_master()`. À décider (`docs/DEPLOIEMENT-RBAC-COLLABORATEURS-2026-11.md`, §7).
- [ ] `public/.well-known/security.txt` : contact personnel (`mailto:`) à remplacer par une boîte de l'entreprise.
- [ ] `affiliateService.ts` (lignes 108 et 592) demande `profiles.first_name`, colonne absente en prod (erreur 42703).
- [ ] `npm run typecheck:update` pour verrouiller les 12 erreurs de la baseline disparues.
- [ ] Les 2 fichiers de logs de `docs/` (`log postgresql 08h à 09.txt`, `supabase_logs.json`) contiennent des données de prod : ne pas les commiter, les supprimer ou les ranger hors du dépôt.
- [ ] Le commit `c35aeec` (« activer Ecomfy Pay dans les menus ») est parti avec la PR sans relecture ni test navigateur : à relire.
- [ ] Vérifier que le lien du CLI Supabase est remis sur la **dev** : `type supabase\.temp\linked-project.json` (attendu : `ecomfy dev`, `xfpbpxncserliskrbaim`).

---

## 8. Quand déclarer le déploiement terminé

Toutes les cases des sections 1, 3 et 4 cochées, la section 2 stable sur 24 h (swap en baisse, purge de J+1 réussie), les sections 5 et 6 vérifiées ou planifiées. Mettre à jour la note de déploiement dans la mémoire du projet avec la date et les éventuels écarts.

## 9. Journal d'exécution

| Contrôle (section) | Heure | Résultat | Remarque |
|---|---|---|---|
| | | | |
| | | | |
| | | | |
