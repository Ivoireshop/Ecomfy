# Déploiement — Optimiseur IA de la boutique (23/10/2026)

**Projet prod :** `yfggrceynzcwklbxhgix`. **Projet dev :** `xfpbpxncserliskrbaim`. **Branche :** `jeanmarc`.
**Aucune migration SQL.** À déployer : l'Edge Function `product-ai-optimizer` (le dossier `_shared` part avec) et le front.

Fichiers : `supabase/functions/product-ai-optimizer/index.ts`, `supabase/functions/_shared/openrouter-chat.ts`, `supabase/functions/_shared/openrouter-image.ts`, `src/components/shop/ProductAIOptimizer.tsx`.

## 1. Anomalies corrigées

### Fonction `product-ai-optimizer`

| # | Anomalie | Correction |
|---|---|---|
| O1 | La requête des commandes lisait `orders.status`, colonne qui n'existe pas (c'est `order_status`). L'erreur était ignorée : l'IA recevait toujours « 0 commande » et 0 % de conversion, quel que soit le produit. | Lecture de `order_status`, commandes annulées et retournées exclues, filtre sur le produit fait en base. Une erreur de lecture des statistiques renvoie une erreur au lieu de zéros inventés. |
| O2 | Le chiffre d'affaires du produit était le total de la commande entière (autres articles compris). | Somme des `total_price` des lignes du produit analysé. |
| O3 | Taux de conversion pouvant dépasser 100 %. | Plafonné à 100 %. |
| O4 | Le crédit (ou l'essai gratuit) était débité **avant** de vérifier la boutique et le produit, et perdu si l'IA échouait. | Validation d'abord, appel IA ensuite, **débit après la réponse**. Un échec de l'IA, ou une réponse inexploitable, ne coûte rien. |
| O5 | Réponse de l'IA non nettoyée : JSON entouré de balises ```, champs d'un mauvais type, valeurs hors liste. Un JSON invalide était enregistré comme « diagnostic ». | `parseAiJson` et `normalizeAnalysis` : extraction du JSON, types forcés, `impact` et `effort` ramenés à une valeur connue, tailles bornées. |
| O6 | Si l'enregistrement de l'historique échouait, la réponse ne contenait pas l'analyse (écran avec `undefined`) alors que le crédit était débité. | L'analyse est renvoyée quand même ; l'échec est journalisé. |
| O7 | Aucun `max_tokens` : OpenRouter réservait le maximum du modèle (65 535 tokens) et refusait en **402** toute clé au solde ou au plafond bas, sur chaque modèle de secours. Constaté sur dev. | Option `maxTokens` ajoutée à `geminiChat` (sans effet pour les autres fonctions) ; l'optimiseur demande 4 096. |
| O8 | Jusqu'à 6 tentatives de 60 s (plus de 5 minutes) pour un écran qui abandonnait à 60 s. | 25 s par tentative ; l'écran attend 120 s. |
| O9 | Le `framework` reçu n'était pas contrôlé. | Limité à `hormozi`, `pas`, `aida` (défaut `hormozi`). |
| O10 | Les en-têtes envoyés à OpenRouter portaient l'ancien nom (`HTTP-Referer: https://visuelpro.cloud`, `X-Title: VisuelPro`), visible dans les logs du compte OpenRouter. | `https://ecomfy.cloud` et `Ecomfy`, dans `openrouter-chat.ts` (3 appels) et `openrouter-image.ts` (1 appel). |

### Écran `ProductAIOptimizer.tsx`

| # | Anomalie | Correction |
|---|---|---|
| E1 | Validation `zod` trop stricte : un `score` renvoyé en texte affichait « Format de réponse IA invalide » alors que le crédit était débité. | Validation retirée : le serveur garantit la forme. |
| E2 | Changer de produit pendant une analyse affichait le résultat sur la fiche d'un autre produit ; l'historique pouvait afficher un produit précédent (course entre deux chargements). | Résultat appliqué seulement si le produit sélectionné est inchangé ; chargement de l'historique annulable. |
| E3 | Délai de 60 s dont le minuteur n'était pas nettoyé, message sans issue. | 120 s, minuteur nettoyé, message qui renvoie vers l'historique. |
| E4 | Produit sélectionné jamais recalé si la liste arrivait après le premier rendu ou si le produit était supprimé. | Recalage sur le premier produit. |
| E5 | Plantage possible si `recommendations` ou un champ de la fiche réécrite n'était pas du texte. | Contrôles de type à l'affichage. |
| E6 | « Faible » affiché sans aucune visite ; copie dans le presse-papiers sans gestion d'échec ; aucun message sans produit ; sous-titre promettant la création de fiche avec images, absente de cet écran ; erreur de chargement de l'historique silencieuse. | « Pas assez de visites » ; message d'échec de copie ; invitation à ajouter un produit ; sous-titre corrigé ; message d'erreur. |

## 2. Vérification sur dev (navigateur, 23/10/2026)

Compte `marchand-test@example.test`, boutique « Test Securite Dev », produit « Produit Test HI10 » (3 visites, 8 commandes).

| Contrôle | Résultat |
|---|---|
| Avant correctif de la clé : réponse de la fonction | `Service IA momentanément indisponible` ; logs : OpenRouter 402 (« can only afford 1752 tokens »), `gemini-1.5-flash` 400 (modèle invalide). Aucun crédit débité. |
| Après `maxTokens` : analyse | Succès en 15 à 20 s : diagnostic, 3 recommandations, fiche réécrite complète. |
| Statistiques envoyées à l'IA (O1) | 3 visiteurs, **8 commandes** (avant : toujours 0), conversion 100 % (plafonnée ; données de test). |
| Enregistrement | Analyse relue après rechargement complet de la page. |
| Historique | 2 puis 4 analyses listées ; clic sur une ancienne : son diagnostic s'affiche. |
| Débit (O4) | Profil créé sur dev avec 10 crédits. 1re analyse : essai gratuit consommé, solde **10,00**. 2e analyse : solde **8,50** (1,5 débité). |

**Limites de ce test.** L'échec de l'IA sans débit a été constaté pendant la phase 402, mais sans profil (voir section 4) : il n'a pas été rejoué avec un solde. Les modèles de secours n'ont pas été essayés un par un.

## 3. Déploiement en production

1. **Secret.** Vérifier que `OPENROUTER_API_KEY` existe sur la prod et que le compte OpenRouter a du solde : avec `max_tokens` fixé, la clé n'a besoin que de quelques milliers de tokens par analyse.
2. **Edge Function** (PowerShell, depuis `C:\dev\Ecomfy` ; `--use-api` est obligatoire sous Windows, sans lui la compilation Docker échoue) :
   ```powershell
   npx supabase@latest functions deploy product-ai-optimizer --project-ref yfggrceynzcwklbxhgix --use-api
   ```
3. **Front** : déployer la branche (composant `ProductAIOptimizer.tsx`).
4. **Vérifier** sur une boutique réelle : lancer l'analyse sur un produit qui a des commandes ; « Commandes » doit être supérieur à 0 ; l'analyse apparaît dans l'historique après rechargement ; dans les logs OpenRouter, la source s'appelle `Ecomfy`.

**En-têtes OpenRouter des autres fonctions (facultatif).** `finance-advisor`, `generate-feature-image`, `generate-product-sheet` et `generate-shop-content` utilisent les mêmes fichiers partagés. Elles gardent « VisuelPro » dans les logs OpenRouter tant qu'elles ne sont pas redéployées (même commande, avec leur nom). Aucun effet fonctionnel.

**Ordre.** La fonction et le front sont indépendants : le nouvel écran fonctionne avec l'ancienne fonction (sans les correctifs de statistiques) et la nouvelle fonction avec l'ancien écran. Déployer la fonction d'abord.

**Retour arrière :** redéployer la fonction depuis le commit précédent ; aucune donnée n'est modifiée (les analyses déjà enregistrées gardent leur format).

## 4. Points laissés de côté

- **`consume_ai_credit` et profils absents.** Pour un utilisateur sans ligne dans `profiles`, la fonction répond « essai gratuit » sans jamais le marquer consommé : usage gratuit illimité des fonctions à essai (optimiseur, voix, fiche produit). Constaté sur dev avec 4 comptes de test sans profil (créés à la main, sans le trigger `on_auth_user_created`). **En production : 0 compte sans profil** (vérifié par le propriétaire le 23/10/2026), donc non déclenchable aujourd'hui ; aucune migration écrite. Requête de contrôle : `select count(*) from auth.users u where not exists (select 1 from profiles p where p.id = u.id);`. Durcissement possible : tester `FOUND` après l'`UPDATE` dans la fonction SQL.
- **Modèle invalide.** `google/gemini-1.5-flash` n'existe plus chez OpenRouter (400) : un appel perdu à chaque analyse dans `geminiChat`. Non retiré : fichier partagé par cinq fonctions.
- **Données de dev.** Un profil a été créé pour `marchand-test@example.test` (10 crédits, solde de test) ; il ne concerne pas la prod.
- **Visites.** Le compteur compte chaque chargement de fiche, pas des visiteurs uniques : le taux de conversion est sous-estimé.
- **Collaborateurs.** Seul le propriétaire de la boutique peut lancer l'analyse (le crédit est celui du propriétaire) ; un collaborateur reçoit « Boutique introuvable ».
- **Autres « visuelpro ».** Le domaine d'envoi des e-mails (`notify.visuelpro.cloud`), les gabarits d'e-mail et les redirections de `payment-callback` portent encore l'ancien nom ; non touchés (dépendent de la configuration DNS et e-mail).
