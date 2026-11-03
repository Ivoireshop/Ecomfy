# Déploiement — IA (Studio et générateurs) : nouvelle tentative contrôlée, suivi des coûts, quotas (03/11/2026)

**Projet prod :** `yfggrceynzcwklbxhgix` · **Dev :** `xfpbpxncserliskrbaim`. **Branche :** `jeanmarc`. **Ne jamais utiliser `supabase db push`.**

**Attention :** le projet lié du CLI (`supabase/.temp/linked-project.json`) change d'une session à l'autre. Il pointait sur la **prod** à la rédaction de ce guide ; **au 03/11/2026 (contrôle ultérieur) il pointe sur la dev** (`xfpbpxncserliskrbaim`). Ne jamais se fier à `--linked` seul : contrôler le fichier, et passer explicitement `--project-ref <ref>` (fonctions) ou `--remote=<ref>` (requêtes SQL). Les commandes du §4 ci-dessous utilisent `--linked` : les remplacer par `--remote=yfggrceynzcwklbxhgix` pour la prod.

**Contrôle de la prod du 03/11/2026 (lecture seule) :** migration `20261103100000` non appliquée (`ai_generation_log` absente), cinq fonctions en versions antérieures (aucun déploiement depuis le 27/10), colonnes `profiles.is_founder` et `profiles.subscription_status` absentes (le point 1 du §4 donne bien « aucune ligne »). Ce guide est complété, pour la voix et l'assistant de la boutique, par le §10 de [`DEPLOIEMENT-RESTE-A-FAIRE-2026-11.md`](DEPLOIEMENT-RESTE-A-FAIRE-2026-11.md) : `generate-voiceover` (commit `d0297bd`) est à déployer avec les cinq autres.

**Cinq fonctions concernées :** `generate-ai-image` (Studio), `generate-video`, `generate-ad-visual` (visuels publicitaires), `generate-feature-image` (images de services / formations, repli du Générateur), `generate-product-sheet` (fiche produit).

**État :** migration appliquée, cinq fonctions déployées et test SQL passé (36 vérifications) sur **dev** uniquement. Rien en prod. Aucune génération réelle (appel OpenAI facturé) n'a été exécutée de bout en bout : voir « Ce qui n'a pas été testé ».

## 1. Ce qui était cassé

| # | Constat | Conséquence |
|---|---|---|
| S1 | `generate-ai-image` ne vérifiait **jamais** le solde avant de générer. Le décompte venait après coup et ne décrémentait que s'il restait quelque chose. | Un compte à 0 crédit générait des images **gratuitement**, dans la limite de 40 par heure. |
| S2 | La fonction lisait `profiles.is_founder` et `profiles.subscription_status`, **colonnes qui n'existent pas** (vérifié sur dev). | La requête échouait en silence : fondateurs et abonnés étaient débités comme les autres. |
| S3 | `generate-video` : compteur codé en dur à 999, aucun solde exigé. | Toute personne connectée pouvait lancer des vidéos (Replicate / Runway), dans la seule limite de 60 par heure. |
| S4 | Boucle de modèles libre : jusqu'à **6 appels OpenAI facturables** par clic (3 modèles × édition + génération), sans délai maximal, sans distinguer une panne passagère d'un refus définitif (filtre de sécurité, clé invalide, compte sans solde). | Coût multiplié et attente interminable ; un refus de contenu était rejoué 3 à 6 fois. |
| S5 | Si l'API d'édition rejetait la photo de référence, la fonction générait **sans elle** en silence. | L'utilisateur recevait un autre produit sans le savoir. |
| S6 | Aucun coût enregistré (constante unique 0,08 $, alors que gpt-image-1 en qualité haute coûte ~0,17 à 0,25 $). | Impossible de savoir ce que coûte le Studio, ni qui. |
| S8 | `generate-ad-visual` ne vérifiait **ni ne débitait aucun crédit** (seule la limite de 40 par heure bornait la dépense) ; même boucle de 6 appels que S4 ; texte brut d'erreur renvoyé au navigateur. | Visuels publicitaires gratuits et illimités pour tout compte connecté. |
| S9 | `generate-feature-image` : même défaut que S1 (solde jamais vérifié, décompte tardif), débit même quand seul le moteur gratuit de secours répondait, et un refus du filtre de sécurité d'OpenAI était **confié aux moteurs de secours** (OpenRouter, puis Pollinations). | Crédit perdu pour une image dégradée ; filtre de sécurité contourné. |
| S10 | `generate-product-sheet` : crédit débité **avant** la rédaction, y compris quand l'IA tombait en panne et qu'un texte générique de secours était renvoyé ; nombre d'images (`image_count`) fixé par le navigateur ; un essai par modèle sans tri des erreurs. | Utilisateur facturé pour du texte de secours ; coût borné par le client. |
| S7 | Erreurs : le texte brut d'OpenAI était renvoyé au navigateur ; le Studio attendait un statut 402/403 que la fonction ne renvoyait jamais et parlait de « 3 générations gratuites » en dur. | Messages techniques à l'écran, fenêtre de recharge jamais ouverte. |

## 2. Ce qui change

**Réservation avant l'appel payant** (`start_studio_generation`) : exemption fondateur / co-fondateur, puis abonnement actif non échu (mêmes règles que `consume_ai_credit`), sinon essai gratuit, sinon crédits achetés. Atomique et sérialisé par utilisateur : deux clics simultanés ne dépensent plus le même crédit. Refus propre si le solde manque.

**Remboursement automatique** (`finish_studio_generation`) : toute génération qui échoue rend le crédit (ou l'essai gratuit), une seule fois. Les réservations restées ouvertes plus de 30 minutes (fonction interrompue) sont clôturées et remboursées par une tâche planifiée toutes les 10 minutes (`expire-stale-studio-generations`).

**Tentatives contrôlées** (`_shared/ai-retry.ts`, moteur d'image partagé `_shared/openai-image-engine.ts` pour le Studio et les visuels publicitaires) : budget **total de 3 appels** par image (`1 + MAX_GENERATION_RETRIES`), 90 s maximum par appel, échéance globale de 130 s (le client abandonne vers 150 s). Selon l'échec :
- passagère (429 de débit, 5xx, délai dépassé) → même modèle, attente 1,5 s puis 3 s ;
- modèle indisponible ou non autorisé → modèle suivant ;
- définitive (filtre de sécurité, clé invalide, solde OpenAI épuisé, requête invalide) → arrêt immédiat, **rien n'est rejoué**.
Photo de référence rejetée par l'API d'édition → génération sans elle **et** la réponse porte `referenceIgnored: true` (le Studio affiche un avertissement). Vidéo : image de départ, 2 tentatives au plus, sur panne passagère seulement.
- `generate-feature-image` : DALL-E 3, 2 appels au plus sur panne passagère ; **un refus du filtre de sécurité arrête tout** (plus de repli vers OpenRouter / Pollinations) ; sinon repli OpenRouter puis moteur gratuit.
- `generate-product-sheet` : texte gpt-4o, 3 appels au plus (même modèle sur panne passagère, `gpt-4o-mini` seulement si le modèle est indisponible), puis Gemini comme avant.

**Qui est débité, et quand** :
| Fonction | Réservation | Remboursement |
|---|---|---|
| Studio, visuels publicitaires | avant tout appel payant (1 crédit / 1 essai gratuit d'image) | échec |
| Images de services | avant tout appel payant (même solde que les images) | échec, **résultat du cache**, ou seul le moteur gratuit a répondu (statut `cancelled`) |
| Vidéo | avant tout appel payant (essai vidéo, puis 3 crédits) | échec |
| Fiche produit | **jamais bloquée** (règle d'accueil conservée) ; débit `consume_ai_credit` (1,5) **après** une vraie fiche IA | sans objet : rien n'est débité pour le texte de secours |

**Suivi des coûts** : table `ai_generation_log` (une ligne par génération : statut, source du débit, remboursé ou non, nombre d'appels fournisseur, modèle, coût estimé, durée, code d'erreur). Le coût d'un échec reste enregistré (audit visuel, synthèse du prompt, vidéo déjà facturée mais non livrée). Lecture : ses propres lignes, ou tout pour l'équipe fondatrice (`is_founder_or_master()`). Aucune écriture depuis le navigateur. Vue d'équipe `ai_generation_cost_daily` (par jour et par fonction).

**Plafond de coût journalier** : 5 $ estimés par utilisateur et par jour (UTC), **fondateurs et abonnés compris**, partagé par les cinq fonctions (la fiche produit y est soumise bien qu'elle ne bloque pas sur le solde). Réglable sans redéploiement par le secret `AI_DAILY_COST_CAP_USD`.

**Messages** : texte lisible dans `error`, code stable dans `code` (`credits_required`, `daily_limit`, `content_policy`, `rate_limited`…), jamais de détail fournisseur. Les refus et échecs gérés restent en **HTTP 200** (convention des fonctions IA, `ai-quota.ts`) ; avant, un échec de génération était un 500. Un solde épuisé ouvre la fenêtre de recharge. Les échecs critiques (`provider_quota`, `provider_auth`, `model_unavailable`) écrivent `[AI-OPERATOR-ALERT]` dans les logs de la fonction.

## 3. Changements de comportement à connaître AVANT la prod

1. **Un marchand à 0 crédit ne peut plus générer d'image produit** dans l'éditeur de produit (`ProductEditor`, qui appelle la même fonction). C'était gratuit par accident. Message clair + fenêtre de recharge.
2. **Une vidéo coûte désormais 3 crédits** quand l'essai vidéo est épuisé (`VIDEO_CREDIT_COST` dans `_shared/ai-cost.ts`). **Ce tarif est une hypothèse à confirmer** : rien dans le code ne fixait de prix vidéo. Une image reste à 1 crédit (comportement d'avant).
3. **Fondateurs et abonnés ne sont plus débités** (S2 corrigé).
4. **Le plafond de 5 $ par jour** s'applique à tous : un fondateur qui génère ~20 images rectangulaires en qualité haute l'atteint. À relever avec `AI_DAILY_COST_CAP_USD` si besoin.
5. **Fiche produit** : un utilisateur sans crédit peut toujours en générer (accueil), comme avant ; ce qui change : plus de débit si l'IA est en panne, `image_count` plafonné à 5 côté serveur, plafond de coût du jour. Si l'accueil gratuit doit se terminer, c'est une décision à part.
6. **Images de services / formations** (`generate-feature-image`) et **visuels publicitaires** (`generate-ad-visual`) exigent désormais un solde, comme le Studio. Un marchand à 0 crédit ne peut plus les utiliser (avant : gratuit). Le **Générateur** (`Generator.tsx`) vérifie déjà le solde côté écran et bascule sur `generate-feature-image` en cas d'échec : un échec remboursé de l'un puis une réservation de l'autre ne débitent qu'une fois.
7. **Réponses d'échec en HTTP 200** (`success: false`, `error` lisible, `code`) pour ces cinq fonctions ; avant, `generate-ad-visual` et `generate-feature-image` renvoyaient 500 avec le texte brut. `AIImageGenerator`, `VariationGenerator`, `ProductEditor` et `Studio` affichent ce message ; `Generator`, `FeaturesEditorWithImages`, `FormationsEditor`, `AdvancedImageGenerator` le lisaient déjà (`data.error`).
8. Les tarifs de `_shared/ai-cost.ts` sont des **estimations** (tarifs publics connus, modifiables par secrets `AI_COST_*`). Les tarifs Replicate / Runway / OpenRouter sont les moins sûrs : les comparer à une facture réelle avant de se fier au total.

## 4. Mise en production (dans cet ordre)

```bash
# 0. Contrôle de la cible : doit afficher yfggrceynzcwklbxhgix pour la PROD
cat supabase/.temp/linked-project.json

# 1. Vérifier que les colonnes supposées absentes le sont aussi en prod (sinon S2 ne s'y applique pas)
supabase db query --linked "select column_name from information_schema.columns where table_schema='public' and table_name='profiles' and column_name in ('is_founder','subscription_status')"
# attendu : aucune ligne

# 2. Migration (une seule, idempotente)
supabase db query --linked -f supabase/migrations/20261103100000_studio_ai_generation_log.sql

# 3. Les deux Edge Functions (elles appellent les nouvelles RPC : migration d'abord)
supabase functions deploy generate-ai-image generate-video generate-ad-visual generate-feature-image generate-product-sheet --project-ref yfggrceynzcwklbxhgix --use-api

# 4. Front (Studio.tsx, ProductEditor.tsx, AIImageGenerator.tsx, VariationGenerator.tsx) : déploiement habituel de la branche
```

Ordre important : fonctions **après** la migration. Une fonction déployée sans les RPC refuse toute génération (`quota_unavailable`, volontairement fermé : ces appels coûtent de l'argent ; la fiche produit refuse aussi, faute de pouvoir lire la dépense du jour). Front avant les fonctions : sans effet nuisible (il lit `data.error`, comme avant).

Sans `pg_cron` en prod, la migration crée tout sauf la tâche planifiée ; dans ce cas, appeler `select public.expire_stale_studio_generations();` à la main (ou depuis un cron existant) pour rembourser les générations interrompues.

## 5. Vérifications après déploiement

```sql
-- Tâche planifiée créée
select jobname, schedule, active from cron.job where jobname = 'expire-stale-studio-generations';

-- Après quelques générations : coût, appels fournisseur et remboursements par jour
select * from ai_generation_cost_daily order by day desc, feature;

-- Détail des échecs et annulations récents (un « attempts » > 3 ne doit jamais apparaître pour une image)
select created_at, feature, status, charge_source, refunded, attempts, model, estimated_cost_usd, error_code
  from ai_generation_log where status in ('failed', 'cancelled') order by created_at desc limit 50;

-- Coût par fonction sur 7 jours
select feature, count(*) n, sum(attempts) provider_calls, round(sum(estimated_cost_usd), 2) usd from ai_generation_log where created_at > now() - interval '7 days' group by 1 order by usd desc;

-- Réservations restées ouvertes (doit rester vide au-delà de 30 min)
select * from ai_generation_log where status = 'reserved' and created_at < now() - interval '30 minutes';
```

Test SQL de référence (dev uniquement, s'annule lui-même) : `supabase db query --linked --project-ref xfpbpxncserliskrbaim -f supabase/tests/studio_ai_generation_log.sql` → attendu « (0 échecs) ». Tests unitaires et de câblage : `npx vitest run supabase/tests/studio-ai-retry.test.ts` (sans réseau ; le câblage est vérifié dans le code source des cinq fonctions).

## 6. Ce qui n'a pas été testé

- **Aucune génération réelle de bout en bout, pour aucune des cinq fonctions** (clé OpenAI + session utilisateur) : les fonctions déployées sur dev démarrent et refusent sans JWT, la logique de tentatives est couverte par des tests unitaires, les RPC par le test SQL, mais le chemin « vrai appel OpenAI → réservation → clôture » n'a pas été exécuté. À faire sur dev avant la prod : une image réussie, une image avec une photo de référence, un prompt refusé par le filtre (doit rendre le crédit et ne faire qu'**un** appel), une vidéo.
- Chemins propres à chaque fonction, jamais exécutés : le repli OpenRouter / moteur gratuit des images de services, le remboursement sur résultat du cache, le débit tardif de la fiche produit (`consume_ai_credit` après la fiche).
- Les erreurs fournisseur (429, 5xx, délais) sont simulées dans les tests, jamais provoquées chez OpenAI.
- Le cas « fonction coupée en plein travail » repose sur le balayage de 30 minutes, testé en SQL seulement.

## 7. Retour arrière

Les fonctions : redéployer la version précédente (`git show HEAD:supabase/functions/generate-ai-image/index.ts`). La migration n'a pas besoin d'être annulée : tables et RPC inutilisées sont inoffensives, et aucun crédit existant n'a été modifié. En cas de crédit débité à tort, le journal donne la source et le montant de chaque génération (`charge_source`, `charge_amount`, `refunded`).

## 8. Fichiers

`supabase/migrations/20261103100000_studio_ai_generation_log.sql` · `supabase/functions/_shared/ai-retry.ts`, `ai-cost.ts`, `ai-generation-log.ts` · `_shared/openai-image-engine.ts` · `supabase/functions/generate-ai-image/index.ts`, `generate-video/index.ts`, `generate-ad-visual/index.ts`, `generate-feature-image/index.ts`, `generate-product-sheet/index.ts` · `src/pages/Studio.tsx`, `src/components/shop/ProductEditor.tsx`, `src/components/AIImageGenerator.tsx`, `src/components/VariationGenerator.tsx` · tests : `supabase/tests/studio-ai-retry.test.ts`, `supabase/tests/studio_ai_generation_log.sql`.

**Reste hors périmètre :** `generate-showcase-site`, `generate-shop-content`, `correct-text`, `generate-voiceover` et les autres fonctions IA n'ont pas été examinées ici ; `geminiChat` / `geminiImage` (OpenRouter) gardent leurs propres boucles de modèles internes, comptées pour un seul appel dans le journal.
