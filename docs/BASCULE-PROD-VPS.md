# Bascule de la prod : Supabase Cloud → Supabase auto-hébergé sur VPS

Plan rédigé le 24/11/2026 à partir de l'environnement de test ([TEST-VPS-SELFHOSTED.md](TEST-VPS-SELFHOSTED.md)). **Rien n'est décidé ni engagé** : ce document sert à décider, puis à exécuter.

- Situation actuelle : base, auth, Storage et Edge Functions sur le projet Supabase Cloud `yfggrceynzcwklbxhgix` ; front sur Vercel (`ecomfy.cloud`) ; apps natives Capacitor (`cloud.visuelpro.app`).
- Cible : base, auth, Storage et Edge Functions sur une pile Supabase Docker auto-hébergée. Le front reste sur Vercel (recommandé, §2.1).

---

## 1. Avant de décider

### 1.1 Ce que la bascule fait perdre, et qu'il faut reconstruire

| Service du cloud | En auto-hébergé | Travail à prévoir |
|---|---|---|
| Sauvegardes quotidiennes et PITR | **aucune** | sauvegardes `pg_dump` et WAL hors du VPS (autre machine ou stockage objet), testées par une restauration |
| Haute disponibilité, mises à jour de sécurité Postgres et services | un seul VPS = point de panne unique | supervision, procédure de reprise, fenêtre de maintenance, mises à jour de la pile Docker |
| Journaux et tableaux de bord (Logs Explorer, rapports) | absents de la pile actuelle (pas de `analytics`/`vector`) | journaux Docker centralisés, alertes ; `app-health-monitor` existe déjà |
| Pare-feu réseau, protection DDoS, limitation de débit gérée | Apache + Envoy seulement | pare-feu (ufw), fail2ban, limites Apache/Envoy, mises à jour système |
| `verify_jwt` par fonction, `deno.json` par fonction | non gérés par le routeur par défaut | modification de `main/index.ts` (faite en test pour le JWT, à faire pour `deno.json`), à réappliquer après chaque mise à jour de la pile |
| Secrets d'Edge Functions (`supabase secrets set`) | fichier `functions.env` | gestion des secrets sur le VPS (droits, sauvegarde chiffrée) |
| Support Supabase | aucun | — |

### 1.2 Questions à trancher

1. **Pourquoi basculer ?** Coût, maîtrise des données, limites du plan cloud… La réponse fixe le niveau de service exigé, donc l'effort sur les sauvegardes et la supervision.
2. **Quel serveur pour la prod ?** Jamais le VPS de test tel quel : il contient des données de test et des configurations de test. Il faut un VPS dédié, ou au minimum une pile Docker séparée. Taille à fixer (CPU, RAM, disque) d'après la charge actuelle du projet cloud.
3. **Quel domaine pour l'API ?** Par exemple `api.ecomfy.cloud`. Il doit être définitif : il est compilé dans les apps natives.
4. **Quelle interruption est acceptable ?** Estimation en §4.4.
5. **Qui est d'astreinte** les jours qui suivent ?

---

## 2. Écarts à combler avant la bascule

Chaque ligne est un prérequis : la bascule n'est pas lancée tant qu'une ligne « bloquant » reste ouverte.

### 2.1 Front et clients

| # | Écart | Gravité | Action |
|---|---|---|---|
| F1 | **Apps natives** : `capacitor.config.ts` embarque le build (`webDir: 'dist'`), donc `VITE_SUPABASE_URL` est figé dans chaque version publiée. Après la bascule, les versions installées viseraient encore le cloud. | bloquant | publier, **avant** la bascule, une version des apps qui vise le nouveau domaine, ou garder le cloud joignable le temps de la migration des utilisateurs ; décider du sort des anciennes versions |
| F2 | [vite.config.ts](../vite.config.ts) refuse en build de prod toute URL qui n'est pas `https://<ref>.supabase.co` | bloquant | ajouter le domaine de l'API de prod à la règle (même principe que le mode `vps`) |
| F3 | CSP de [vercel.json](../vercel.json) et [public/_headers](../public/_headers) : `connect-src` et `form-action` autorisent `*.supabase.co` | bloquant | ajouter `https://<api>` et `wss://<api>` |
| F4 | Domaines personnalisés des boutiques : CNAME vers `sites.ecomfy.cloud` ([DnsConfigurationAssistant.tsx](../src/components/DnsConfigurationAssistant.tsx)) | élevé si le front quitte Vercel | **garder le front sur Vercel** : seules les variables d'environnement changent |
| F5 | Variables Vercel `VITE_SUPABASE_URL` / `VITE_SUPABASE_PUBLISHABLE_KEY` | bloquant | nouvelles valeurs au moment T, puis redéploiement |

### 2.2 Données

| # | Écart | Gravité | Action |
|---|---|---|---|
| D1 | **URL Storage en base** : le front enregistre les URL publiques (`getPublicUrl`, 23 fichiers) avec l'hôte `yfggrceynzcwklbxhgix.supabase.co` (images produits, logos, médias). | bloquant | mesurer les colonnes concernées (texte et JSON), puis les réécrire vers le nouveau domaine pendant la bascule ; prévoir aussi le contenu riche (HTML des descriptions) |
| D2 | Historique des migrations incomplet (39 migrations en prod sans inscription) | élevé | même méthode qu'en test : `--mark-applied` avec [deploy/vps-migrations-deja-en-prod.txt](../deploy/vps-migrations-deja-en-prod.txt), puis application des migrations validées |
| D3 | Facturation par seuil absente de la prod | décision | garder les 6 migrations écartées (comme en test) tant qu'aucune décision contraire n'est prise |
| D4 | Tâches cron et secrets Vault non copiés par un dump | bloquant | lister les tâches cron de la prod (`select jobname, schedule, command from cron.job`) et les recréer ; poser `supabase_project_url` (adresse interne) et `cron_secret` |
| D5 | File d'e-mails `pgmq` : le consommateur `process-email-queue` est planifié hors migrations (outil Lovable) | élevé | vérifier comment il est déclenché en prod et le reproduire |
| D6 | Version de Postgres : le cloud et le VPS doivent avoir la même version majeure (17) | élevé | vérifier, et faire la répétition avec l'image exacte de la prod VPS |

### 2.3 Auth

| # | Écart | Gravité | Action |
|---|---|---|---|
| A1 | **Sessions** : un autre secret JWT invalide toutes les sessions ; chaque utilisateur doit se reconnecter. Les mots de passe sont conservés (empreintes copiées avec `auth.users`). | élevé | prévenir les utilisateurs ; vérifier dans le tableau de bord du projet si le secret JWT d'origine peut être repris (projet en clés symétriques ou asymétriques) |
| A2 | E-mails d'auth : la prod utilise le hook `auth-email-hook` (modèles Ecomfy en français). En auto-hébergé, le lien est construit avec `SUPABASE_URL`, l'adresse interne. | bloquant | correctif de code : lire `SUPABASE_PUBLIC_URL` en priorité dans `auth-email-hook` et `send-email` ; routeur capable de lire le `deno.json` de la fonction (JSX) ; ou SMTP natif avec modèles traduits |
| A3 | Google OAuth : URI de rappel `https://<api>/auth/v1/callback` à ajouter au client de prod | bloquant | console Google, avant la bascule (l'ancienne URI reste valable en parallèle) |
| A4 | `SITE_URL=https://ecomfy.cloud`, `ADDITIONAL_REDIRECT_URLS` (domaine principal, domaines personnalisés si utilisés dans les redirections) | bloquant | à reprendre du projet cloud (Authentication → URL Configuration) |
| A5 | SMTP de prod sans identifiant en clair : TLS obligatoire (port 465/587), sinon « unencrypted connection » | bloquant | fournisseur SMTP de prod (ou Resend SMTP) |
| A6 | Inscription par téléphone ouverte par défaut dans le compose | élevé | `ENABLE_PHONE_SIGNUP=false` comme en test |

### 2.4 Edge Functions et services tiers

| # | Écart | Gravité | Action |
|---|---|---|---|
| E1 | Secrets de prod : Resend, GeniusPay, Lygos, IA (OpenAI, OpenRouter, Lovable, Replicate, Runway, ElevenLabs, Cloudinary), Meta, Google, VAPID, `CRON_SECRET` | bloquant | inventaire complet depuis le projet cloud (`supabase secrets list` donne les noms), saisie dans `functions.env` |
| E2 | **Webhooks de paiement** : GeniusPay (et Lygos) appellent `https://yfggrceynzcwklbxhgix.supabase.co/functions/v1/...` | bloquant | changer l'URL chez chaque opérateur au moment T ; les paiements initiés juste avant la bascule arriveront encore sur l'ancien projet (§4.3) |
| E3 | URI de redirection OAuth Meta (`META_OAUTH_REDIRECT_URI`) et Search Console (`GOOGLE_OAUTH_REDIRECT_URI`) | élevé | déclarer les nouvelles URI chez Meta et Google avant la bascule |
| E4 | `LOVABLE_API_KEY` : passerelle Lovable appelée hors du cloud Supabase | à vérifier | test sur le VPS de test avec une clé de test |
| E5 | Fonction `mcp` : émetteur OAuth `*.supabase.co` en dur | faible | correctif si la fonction est utilisée |
| E6 | Délai de 5 s de `pg_net` dépassé au premier appel d'une fonction (téléchargement des dépendances) | faible | préchauffer les fonctions après chaque déploiement |

### 2.5 Exploitation

| # | Écart | Action |
|---|---|---|
| X1 | Sauvegardes | sauvegarde quotidienne hors VPS + WAL si possible ; **restauration testée** avant la bascule |
| X2 | Supervision | disponibilité de l'API et du front, espace disque, mémoire, certificats ; alertes vers l'équipe |
| X3 | Durcissement | pare-feu (seuls 80/443 et SSH ouverts), SSH par clé, fail2ban, mises à jour automatiques de sécurité, Studio protégé (authentification + restriction d'IP) |
| X4 | Procédures | redémarrage (piège d'Envoy après recréation de `functions`), mise à jour de la pile, réapplication de la modification de `main/index.ts`, rotation des secrets |
| X5 | Capacité | `FUNCTIONS_MEMORY_LIMIT`, connexions Postgres et Supavisor, taille des disques (Storage + WAL + sauvegardes) |

---

## 3. Répétition générale (obligatoire)

Sur le **serveur de prod cible**, avant le jour J, avec la même méthode que le VPS de test. La différence : on ne neutralise pas les données des marchands, mais on **ne pose aucun secret tiers** pendant la répétition.

1. Installer la pile Docker, Apache, certificats, domaine de l'API définitif.
2. Miroir de la prod (adaptation de [scripts/mirror-prod-to-vps.ps1](../scripts/mirror-prod-to-vps.ps1) : cible prod, sans neutralisation, sans `-SkipVpsBackup` si le dump peut se faire sur le serveur).
3. Inscription de l'historique (`--mark-applied`), migrations validées (`--apply`).
4. Réécriture des URL Storage (D1), sur une copie, avec comptage avant et après.
5. Front de répétition (comme `test.ecomfy.cloud`) pointé sur cette instance ; recette complète par les menus.
6. **Chronométrer chaque étape** : c'est la base de l'estimation d'interruption.
7. Restauration d'une sauvegarde sur une machine vide (X1).
8. Effacer la répétition (ou la garder comme base de départ du jour J, si le miroir final est un nouveau miroir complet).

Critère de passage : recette complète sans écart, durées connues, restauration réussie.

---

## 4. Jour J

### 4.1 Préparation (J-7 à J-1)

- Apps natives à jour en production depuis assez longtemps (F1).
- URI OAuth Google, Meta et Search Console déclarées (A3, E3).
- Message aux marchands : date, heure, durée d'interruption, reconnexion obligatoire (A1).
- Variables Vercel préparées (non appliquées).
- Sauvegarde complète du projet cloud, et export des tâches cron, de la configuration d'auth et des noms de secrets.

### 4.2 Déroulé

| Heure | Étape | Contrôle |
|---|---|---|
| T-0 | **Gel des écritures** : page de maintenance sur le front (Vercel) ; pause des tâches cron du cloud (`cron.unschedule` ou désactivation) | plus aucune commande créée côté cloud |
| T+ | Dernier dump de la prod (schéma, données, auth, historique) | — |
| T+ | Restauration sur le serveur de prod, `--mark-applied`, `--apply` | comptes de lignes identiques table par table |
| T+ | Synchronisation Storage (copie complète ou différentielle) | nombre de fichiers identique ; quelques fichiers testés |
| T+ | Réécriture des URL Storage (D1) | plus aucune occurrence de `yfggrceynzcwklbxhgix.supabase.co` dans les colonnes visées |
| T+ | Secrets (`functions.env`), Vault, tâches cron (D4) | `app-health-monitor` répond 200 |
| T+ | Webhooks de paiement : nouvelle URL chez GeniusPay et Lygos (E2) | paiement de test de faible montant, sandbox si possible |
| T+ | Variables Vercel (F5), redéploiement, levée de la page de maintenance | parcours de recette courts : connexion, boutique, commande, tableau de bord |
| T+ | Surveillance renforcée | erreurs Edge Functions, e-mails, paiements |

### 4.3 Points délicats

- **Paiements en cours** : un paiement initié avant le gel peut être confirmé après, par webhook, sur l'ancien projet. Garder l'ancien projet actif (en lecture) et réconcilier à la main les paiements arrivés après T-0.
- **Utilisateurs connectés** : ils sont déconnectés (A1). Les apps natives anciennes échouent si l'ancien projet est arrêté (F1).
- **DNS** : le domaine de l'API est nouveau, sans propagation à attendre ; préparer le certificat la veille.

### 4.4 Estimation de l'interruption

À mesurer pendant la répétition. Repères du test du 24/11 :
- **Données :** environ 290 Mo de données `public`.
- **Restauration :** une quinzaine de minutes à travers un tunnel SSH depuis un poste Windows. Elle serait plus rapide exécutée sur le serveur.
- **Storage :** 668 fichiers.

---

## 5. Retour arrière

**Le projet cloud n'est ni supprimé ni modifié pendant au moins 30 jours.** Le jour J, le retour arrière consiste à :

1. remettre les anciennes variables Vercel et redéployer ;
2. remettre l'ancienne URL des webhooks de paiement chez les opérateurs ;
3. relancer les tâches cron du cloud.

Limite : les données écrites sur le VPS **après** la levée de la maintenance (commandes, comptes, paiements) ne sont pas dans le cloud. Plus le retour arrière est tardif, plus il faut de reprise manuelle. Fixer donc à l'avance :
- une **fenêtre de décision**, par exemple 2 heures après l'ouverture, au-delà de laquelle on corrige en avant plutôt que de revenir ;
- les **critères de retour arrière**, par exemple : connexion impossible pour une partie des utilisateurs, paiements non confirmés, perte de données constatée.

---

## 6. Après la bascule

- J+1 à J+7 : surveillance quotidienne des journaux, des e-mails, des paiements et des sauvegardes.
- Mettre à jour la documentation de déploiement : les guides `docs/DEPLOIEMENT-*.md` supposent `supabase db push` et `supabase functions deploy` vers le cloud.
- Adapter le CI s'il vise le projet cloud.
- Au bout de la période de sécurité : export final du projet cloud, puis arrêt.

---

## 7. Questions ouvertes

1. Motif et niveau de service attendu (§1.2-1).
2. Serveur de prod : fournisseur, taille, localisation des sauvegardes.
3. Domaine définitif de l'API.
4. Calendrier des apps natives (F1) : délai de publication sur les stores et part des utilisateurs à jour.
5. Le secret JWT du projet cloud peut-il être repris (A1) ?
6. Fournisseur SMTP de prod et choix entre hook Ecomfy et SMTP natif (A2, A5).
7. Fenêtre d'interruption acceptable et date envisagée.
