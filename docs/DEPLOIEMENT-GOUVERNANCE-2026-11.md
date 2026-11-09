# Gouvernance et audit sur données réelles — 09/11/2026

Front + une migration (documents). Aucune Edge Function modifiée.

## Ce qui était faux

| Où | Problème | Correction |
|---|---|---|
| Documents de gouvernance | Les 10 documents du seed vivaient dans le code avec des ids texte (`doc-01-…`). `corporate_document_acceptances.document_id` est un UUID avec clé étrangère : **aucune signature n'a jamais pu être enregistrée** (0 ligne en base), mais l'écran affichait « Document approuvé » avec un faux e-mail (`associe@ecomfy.cloud`) et une fausse IP. | Migration `20261109100000` : les 10 documents sont en base ; la base est la seule source. Signature écrite puis relue ; succès annoncé seulement si l'écriture a réussi. |
| Signature relue | `user_acceptance` n'était jamais lue en base : au rechargement, tout redevenait « non signé ». | Lecture de `corporate_document_acceptances` ; compteur de signatures par version. |
| Journal d'audit | IP `127.0.0.1` inventée sur chaque ligne ; échec d'écriture silencieux ; compteur d'onglet plafonné à 50. | IP laissée vide (le navigateur ne la connaît pas) ; échec journalisé et signalé ; total exact (`count: exact`). |
| Cap table | « Désiré Tano (10 %) & Couboura Amena (10 %) », « 100 % attribué (80 % + 20 %) », « 800 000 actions », 1 000 000 d'actions, repli à 80 % / 10 % / 100 000 actions : tout en dur. | Tout est calculé sur `corporate_share_allocations` ; un membre sans participation affiche « — » ; dépassement ou reste à attribuer signalé. |
| Vesting | « 48 mois, cliff 12 mois » en dur, « acquis » = colonne brute. | Lecture du plan réel (`corporate_vesting_plans`), éligibilité calculée depuis les dates, « acquis formalisé » distinct. |
| Propositions de cap table | Le formulaire n'avait qu'un champ sur quatre : impossible à soumettre ; `proposed_by = "ulrich-admin"` (UUID attendu) ; la liste n'était jamais affichée. | Formulaire complet (bénéficiaire, %, justification) borné par la place restante ; nouvel onglet « Propositions ». |
| Invitations | Invitations **fabriquées** à partir des membres (jeton `inv-tok-…`, 10 %, 100 000 actions, échéance +7 j) ; l'envoi annonçait « succès » même si l'e-mail n'était pas parti ; `upsert` sur l'e-mail pouvait rétrograder un membre actif ; une participation en double par invitation. | Seules les lignes enregistrées comptent ; refus si le membre est déjà actif ; une seule participation par membre ; résultat réel de l'envoi ; table absente détectée et expliquée. |
| Espace associé | `shareholders[0]` par défaut : un compte sans fiche voyait la participation d'un autre ; étapes 1 à 4 cochées d'office ; une seule série de cases pour tous les documents. | Profil du compte connecté uniquement ; étapes déduites de faits enregistrés ; cases propres à chaque document. |
| Page document | `import { useParams … } from "react"` : la page **plantait** ; correspondance approximative sur le titre. | Import corrigé ; id ou slug exact. |
| Page d'invitation publique | Fausse invitation de démonstration (`inv-demo-1`, « Membre Invité ») ; « acceptation enregistrée » même si aucune écriture. | « Invitation introuvable » sans ligne réelle ; chaque écriture doit réussir avant ACCEPTED. |
| Dérivés en dur | Détection du fondateur par `email.includes("djateulrich")`, auteur « Ulrich DJATÉ YAPI (Fondateur) » codé en dur. | `is_main_founder` et nom de la personne connectée. |

## Déploiement

1. **Migration** `supabase/migrations/20261109100000_corporate_documents_seed.sql` (éditeur SQL, puis `supabase migration repair --status applied 20261109100000`).
   - Ajoute `slug`, `legal_status`, `summary`, `author` à `corporate_documents`.
   - Rattache la Charte d'actionnariat (`1111…`) et l'Accord de vesting (`2222…`) à Doc 02 / Doc 03 ; **leur titre et leur texte ne sont remplacés que si personne ne les a signés**.
   - La Convention de cession de PI (`3333…`) reste un document distinct de Doc 06.
   - Idempotente ; rejouable.
2. Front (déploiement habituel). Le front fonctionne aussi **avant** la migration (il affiche alors les 3 documents présents) ; la migration enrichit, elle n'est pas un prérequis de démarrage.

## À savoir avant de déployer

- **`corporate_invitations` n'existe pas** (ni sur la dev miroir de la prod). L'écran le détecte, désactive « Inviter » et l'explique.
- **Ne pas appliquer `20260906000000_corporate_invitations_workflow.sql` telle quelle** : elle crée la table avec `USING (true)` en lecture ET en écriture, y compris pour `anon` : n'importe qui pourrait lire les jetons d'invitation et en forger. Elle doit être réécrite (RLS réservée aux fondateurs + fonctions `SECURITY DEFINER` par jeton pour l'invité) avant tout usage.
- Le **parcours de l'invité** (page `/governance/invitation/:token`) ne peut pas fonctionner pour une personne sans rôle : les politiques RLS (durcies par `20261012120000`) ne lui laissent lire ni la table des membres, ni les documents. Il affiche maintenant la vérité (introuvable / erreur) au lieu d'un faux succès. Le reconstruire demande un design à part (lecture et acceptation par fonction RPC à jeton).
- 15 lignes historiques du journal d'audit portent l'IP fictive `127.0.0.1`. Le journal est en ajout seul (par conception), elles restent ; l'écran n'affiche plus d'IP.
- `src/data/initialGovernanceDocs.ts` n'est plus lu à l'exécution par la gouvernance (seule la page d'invitation y lit encore ses 3 titres). Il sert de source à la migration.

## Vérification

- `npx vitest run src/lib/governanceMetrics.test.ts` : 25 tests (cap table, place restante, vesting, statut des membres, parcours, signatures).
- Après migration : 10 documents, `select count(*) from corporate_documents` = 11 (10 + la convention PI).
- Signer un document avec un compte associé : une ligne dans `corporate_document_acceptances`, une ligne `DOCUMENT_APPROVED` dans `corporate_audit_logs`, « Signé par vous » après rechargement.
