# Déploiement — Finance de la boutique (23/10/2026)

**Branche :** `jeanmarc`. Page concernée : « Outil Comptable Expert » (`ShopFinances`), connexions publicitaires (`AdAccountsManager`), résumé hebdomadaire par e-mail, bilan IA.

Fichiers : `src/components/shop/ShopFinances.tsx`, `src/components/shop/AdAccountsManager.tsx`, `src/lib/shopFinance.ts` (nouveau, règles de calcul), `supabase/functions/send-weekly-finance-summary`, `supabase/functions/sync-ad-spend`, `supabase/functions/finance-advisor`, gabarit `_shared/transactional-email-templates/finance-weekly-summary.tsx`, migration `20261023110000_finance_weekly_summary_cron.sql`.

## 1. Anomalies corrigées

### Données fausses

| # | Anomalie | Correction |
|---|---|---|
| F1 | **Le résumé hebdomadaire n'était planifié nulle part.** Aucun `cron.schedule` ne l'appelait : l'interrupteur « Rapport auto (Lundi 8h) » ne déclenchait jamais rien. | Migration `20261023110000` : job `weekly-finance-summary`, lundi 8 h UTC, via `invoke_edge_function`. |
| F2 | **« Tester l'envoi » échouait toujours (401).** Le bouton appelle la fonction avec le jeton de l'utilisateur, mais la fonction n'accepte que le planificateur (`isAuthorizedCron`). | La fonction accepte aussi le propriétaire de la boutique pour un envoi de **test** sur sa propre boutique (jeton vérifié, propriété contrôlée). Un test par adresse toutes les 5 minutes. |
| F3 | Le courriel hebdomadaire **ignorait les dépenses publicitaires synchronisées** : bénéfice annoncé trop haut, différent de la page. | Dépenses de `ad_spend_daily` ajoutées (converties en FCFA) ; commandes remboursées exclues ; même fenêtre de 7 jours calendaires que la page. |
| F4 | Le courriel et le test comptaient « envoyé » même quand rien n'était parti (adresse désinscrite, envoi neutralisé hors production : `send-transactional-email` répond 200 dans ces cas). Un test répété le même jour était avalé par la clé d'idempotence tout en affichant « envoyé ». | La réponse est lue : refus et envoi neutralisé sont remontés comme erreurs. Clé d'idempotence horodatée pour un test. |
| F5 | **Synchronisation Meta tronquée.** Meta pagine à 500 jours ; l'historique maximum (37 mois, plus de 1 000 jours) tient sur plusieurs pages et seule la première était lue : dépenses publicitaires et « dépense totale » du compte sous-estimées sans erreur. | Pagination suivie (`paging.next`, 10 pages au plus) ; écriture par lots de 500 ; erreur d'écriture enregistrée sur le compte. |
| F6 | **Lecture limitée à 1 000 lignes** : `ad_spend_daily` (une ligne par jour et par compte) et `shop_expenses` étaient lues d'un bloc, donc tronquées au-delà de 1 000 sans message. | Lecture par pages (`fetchAllPages`). |
| F7 | **Devises mélangées.** Meta renvoie les dépenses dans la devise du compte (USD, EUR...) ; la page les additionnait comme des FCFA. | Conversion par ligne : XOF/XAF à 1, EUR à la parité fixe 655,957. Une devise sans parité fixe (USD...) est **exclue** des totaux avec un bandeau d'avertissement (page, export CSV, courriel) : on ne devine pas de taux. |
| F8 | Les chiffres ne se recoupaient pas : « Dépenses totales » excluait les frais Ecomfy mais le bénéfice les déduisait ; ni le graphique ni la répartition ne les montraient. | « Dépenses totales » inclut les frais Ecomfy (mention « dont X de frais Ecomfy »), ligne « Frais Ecomfy » dans la répartition, sorties du graphique complètes. |
| F9 | **Encaissé** : une commande livrée puis remboursée (`payment_status` `refunded`) ou en échec comptait comme argent encaissé. | Exclue (`isCashedIn`). |
| F10 | **Périodes décalées.** « 7 jours » partait de « maintenant − 7 × 24 h » (heure comprise) alors que les dépenses sont des dates : la dépense du premier jour était exclue selon l'heure. Découpage en UTC vs jours locaux. | Jours calendaires locaux : « 7 jours » = aujourd'hui et les 6 précédents ; « Ce mois » = du 1er à aujourd'hui. |
| F11 | **Graphique de trésorerie** : toujours 30 jours glissants, quelle que soit la période (« Ce mois » ne montrait pas le mois ; « Tout » seulement 30 jours alors que les totaux couvraient tout). | 7 jours / du 1er du mois à aujourd'hui / un point par mois (24 mois au plus) pour « Tout ». |

### Export comptable (.csv)

| # | Anomalie | Correction |
|---|---|---|
| X1 | **Séparateur virgule** : Excel en français lit la virgule comme décimale et colle tout dans une colonne. | Point-virgule, BOM UTF-8 conservé. |
| X2 | Guillemets et virgules d'une description non échappés : une description `Facture "A", lot 2` décalait les colonnes. Une description commençant par `=`, `+`, `-` ou `@` était exécutée comme formule par Excel. | `csvCell` : guillemets doublés, préfixe neutralisant les formules. |
| X3 | Ligne TOTAL **décalée d'une colonne** (les entrées sous « Description », les sorties sous « Entrées »). | Colonnes alignées. |
| X4 | Référence « CMD-xxxxxxxx » tirée de l'UUID ; ventes datées à l'heure UTC ; pas de période dans le nom du fichier. | Numéro de commande réel ; jours locaux ; nom `…_mois_AAAA-MM-JJ.csv`. |

### Saisie et réglages

| # | Anomalie | Correction |
|---|---|---|
| S1 | Dépense : montant décimal, énorme ou date vide acceptés ; description illimitée ; dépense antidatée affichée tout en haut ; date proposée en UTC ; échec de suppression sans motif. | Montant entier de 1 à 1 milliard (aussi contrainte `NOT VALID` en base), date contrôlée, description à 500 caractères, tri par date, date locale, motif d'erreur affiché. |
| S2 | Adresse du rapport hebdomadaire : enregistrée à chaque sortie du champ, même inchangée ou invalide (toast « activé » à chaque clic). Pas de contrôle de format. | Format contrôlé, enregistrement seulement si l'adresse change ; le test enregistre d'abord l'adresse affichée ; champ vide = e-mail du compte (précisé). |
| S3 | Compte publicitaire : si la synchronisation initiale échouait (ID ou token faux), le compte restait créé, listé en « Erreur », et le formulaire était vidé. | Le compte créé est supprimé, le formulaire reste rempli. |
| S4 | `act_123` et `123` créaient deux comptes ; affichage `act_act_123` ; doublon = message SQL brut. | Préfixe retiré avant enregistrement, ID numérique contrôlé, message « Compte déjà connecté ». |
| S5 | Texte « token stocké chiffré » : la colonne est en clair. | Phrase retirée ; mention que le compte doit être en FCFA/XOF ou euro. |
| S6 | Message WhatsApp : numéro local sans indicatif (ex. `0707…`) donnait un lien mort ; préfixe `00` non géré. | `whatsappDigits` : `00` retiré, numéro trop court refusé avec message explicite. |
| S7 | Une lecture en échec s'affichait comme « 0 FCFA ». | Bandeau rouge « données incomplètes » avec bouton Réessayer. |
| S8 | Bilan IA : toute la structure `stats` du client était injectée dans l'invite. | Le client n'envoie que des champs connus ; la fonction les revalide (nombres, catégories connues, nom à 80 caractères). |

## 2. Vérification (23/10/2026)

Faite **sans navigateur** : la page demande un compte propriétaire et des données que je n'ai pas créés sur dev.

| Contrôle | Résultat |
|---|---|
| Règles de calcul (`shopFinance.ts`) : bornes de période (16/10 inclus, 15/10 exclu pour « 7 jours » au 22/10), conversions (100 EUR = 65 595,7 ; USD = refusé), encaissé (livré remboursé exclu), CSV (guillemets, `=`, `-`), e-mail, numéro WhatsApp | assertions Node, toutes passent |
| `tsc` sur `ShopFinances`, `AdAccountsManager`, `shopFinance` | Aucune erreur (les erreurs restantes du projet sont antérieures et dans d'autres fichiers) |
| `deno check` des 3 Edge Functions | Passe |
| Migration, Edge Functions, e-mail réel, synchronisation Meta | **Non exécutés** : rien n'a été appliqué ni déployé sur dev ni sur prod |

À vérifier à la main après déploiement : voir § 3, étape 6.

## 3. Déploiement

1. **Migration** `20261023110000_finance_weekly_summary_cron.sql` (dev puis prod). Elle suppose `invoke_edge_function` (`20261011120000`) et les secrets Vault décrits dans cette migration : `supabase_project_url` et `cron_secret` (même valeur que le secret de fonction `CRON_SECRET`). **Sans eux le job est planifié mais ses appels sont ignorés ou refusés en 401.**
   Contrôle : `select jobname, schedule from cron.job where jobname = 'weekly-finance-summary';` puis `select decrypted_secret is not null from vault.decrypted_secrets where name in ('supabase_project_url','cron_secret');` (2 lignes).
2. **Edge Functions** : `send-weekly-finance-summary`, `sync-ad-spend`, `finance-advisor` et **`send-transactional-email`** (le gabarit `finance-weekly-summary` est embarqué dans cette dernière : son champ `warning` et ses libellés n'apparaissent qu'après son redéploiement).
3. Déployer le front.
4. Les comptes publicitaires déjà connectés gardent leur historique tronqué : demander à chaque boutique de cliquer sur « Actualiser » (⟳) pour récupérer les mois manquants.
5. Si des boutiques ont un compte Meta en USD ou autre devise sans parité : elles verront un bandeau jaune. Les dépenses sont exclues des totaux tant qu'elles ne sont pas passées en FCFA ou ajoutées à la main.
6. Vérifier sur une boutique réelle : (a) « Alertes & Rapports » → activer → icône d'envoi : le courriel arrive, et ses « Dépenses » incluent la publicité ; un second clic dans les 5 minutes affiche le message d'attente ; (b) « Exporter » s'ouvre en colonnes dans Excel français, la ligne TOTAL est sous « Entrées » et « Sorties » ; (c) « Ce mois » : le graphique couvre du 1er à aujourd'hui ; (d) lundi 8 h : le résumé part sans action.

**Retour arrière :** front et fonctions : revenir au commit précédent. Migration : `select cron.unschedule('weekly-finance-summary'); alter table public.shop_expenses drop constraint if exists shop_expenses_amount_max;`

## 4. Points laissés de côté

- **« Encaissé » daté de la création de la commande**, pas de la livraison : la base n'a pas de date de livraison (`delivered_at`), `updated_at` change à chaque modification. Une commande livrée en novembre mais créée en octobre compte en octobre.
- **Double compte possible** : une dépense « Publicité » saisie à la main **et** la même dépense synchronisée depuis Meta s'additionnent. Aucun moyen fiable de les rapprocher.
- **Bénéfice sans coût d'achat des produits** : seules les dépenses saisies (catégorie « Achat de stock ») sont déduites.
- **ROAS** calculé sur l'encaissé (commandes livrées), pas sur les ventes validées : volontairement prudent, à décider.
- **Collaborateurs** : ils peuvent saisir des dépenses (politique existante) mais pas connecter un compte publicitaire (politiques réservées au propriétaire) ni régler le rapport hebdomadaire (`shop_secrets` réservé au propriétaire).
- **Contrôle d'expiration des tokens Meta** (`check-ad-token-expiry`) : je n'ai trouvé aucune planification dans les migrations, comme pour le résumé hebdomadaire ; à vérifier sur prod.
- **API Graph Meta `v19.0`** codée en dur : version ancienne, à relever lors d'une passe dédiée.
- Frais de livraison non isolés : la table `orders` n'a pas de colonne de frais, ils restent dans le total des commandes.
