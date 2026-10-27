# Déploiement — CI, vitest et correctifs d'audit (25/10/2026)

**Projet prod :** `yfggrceynzcwklbxhgix`. **Branche :** `jeanmarc`.
**Aucune migration SQL, aucune Edge Function, aucun secret Supabase.** Ce lot touche l'outillage (tests, CI) et deux mises à jour de dépendances qui, elles, partent dans le build du front.

## 1. Ce que contient le lot

| Élément | Fichiers | Effet en production |
|---|---|---|
| CI GitHub Actions | `.github/workflows/ci.yml` | Aucun (ne déploie rien) |
| vitest | `vitest.config.ts`, `package.json` (devDependency) | Aucun (non embarqué dans le build) |
| Tests portés / branchés | `supabase/tests/*.test.ts` (6), `src/test/*.test.ts` (2), `src/lib/studio/__tests__/commandEngine.test.ts` | Aucun |
| Baseline lint | `eslint-suppressions.json` | Aucun |
| Baseline types | `scripts/typecheck.mjs`, `typecheck-baseline.txt`, `tsconfig.node.json` | Aucun |
| Correctifs d'audit | `package-lock.json` : `@capacitor/android` et `@capacitor/ios` 8.5.3, `dompurify` 3.4.17 | **Oui, dans le build du front** |

Les montées de version restent dans la plage `^` déjà déclarée dans `package.json` (patchs). Le build (`npm run build`) a été vérifié en local après la mise à jour.

## 2. Déploiement en production

1. **Front (Vercel).** Déployer la branche comme d'habitude. Seul changement visible : les dépendances ci-dessus.
2. **Contrôler l'installation Vercel.** Le dépôt contient `package-lock.json` (à jour) mais aussi `bun.lock` et `bun.lockb` (anciens, de juillet 2026 et novembre 2025). Dans le journal de build Vercel, vérifier la commande d'installation : si Vercel installe avec **bun**, il suit ces anciens verrous et les versions vulnérables restent en place. Dans ce cas, supprimer `bun.lock` et `bun.lockb` du dépôt (ou les régénérer), afin que `npm` soit le seul gestionnaire.
3. **Rien à faire côté Supabase.** Pas de `functions deploy`, pas de SQL.
4. **Vérifier après déploiement** : l'application charge, un texte riche issu d'un utilisateur (description de produit, message de communauté) s'affiche encore (DOMPurify), et le journal de build ne signale aucune erreur.

## 3. La CI

### 3.1 Déclenchement (volontairement restreint)

Le workflow ne tourne que sur les **pushs vers `jeanmarc`**, et à la demande (onglet *Actions* de GitHub, bouton *Run workflow*). Il n'est pas actif sur `main` ni sur les pull requests.

Pour le généraliser, modifier le bloc `on:` de `.github/workflows/ci.yml` :

```yaml
on:
  push:
    branches: [main, jeanmarc]
  pull_request:
  workflow_dispatch:
  schedule:
    - cron: "0 6 * * 1"   # audit hebdomadaire ; ne s'exécute que sur la branche par défaut
```

Avec `schedule`, ajouter `if: github.event_name != 'schedule'` sur les jobs `lint`, `typecheck` et `test` pour que seul l'audit tourne le lundi. Le workflow doit exister sur `main` pour que `schedule` et `pull_request` se déclenchent.

Une fois la CI fiable, la rendre **obligatoire** : GitHub > Settings > Branches > règle de protection de `main` > *Require status checks* > cocher `lint`, `typecheck`, `test`, `audit`.

### 3.2 Les quatre jobs

| Job | Commande | Échoue quand |
|---|---|---|
| `lint` | `npm run lint` | une violation ESLint **nouvelle** apparaît |
| `typecheck` | `npm run typecheck` | une erreur TypeScript **nouvelle** apparaît |
| `test` | `npm test` (vitest, 98 tests) | un test échoue |
| `audit` | `npm run audit:prod` | une vulnérabilité **critique** touche une dépendance de production |

Un cinquième contrôle, `npm audit --audit-level=high`, tourne dans le job `audit` en **non bloquant** : il garde les vulnérabilités « high » visibles dans le journal.

### 3.3 Commandes locales

```powershell
npm run lint              # ESLint, dette historique ignorée
npm run typecheck         # tsc, comparé à typecheck-baseline.txt
npm test                  # vitest run
npm run test:watch        # vitest en continu
npm run audit:prod        # npm audit, dépendances de production, niveau critical
```

### 3.4 Baselines : figer l'existant, bloquer le neuf

Le projet avait 1374 erreurs ESLint et 301 erreurs TypeScript avant ce lot. Une CI stricte aurait échoué d'emblée ; la dette est donc figée et seules les régressions bloquent.

- **Lint** : `eslint-suppressions.json` (suppressions groupées d'ESLint 9). Après avoir corrigé des violations, lancer `npm run lint:prune` et commiter le fichier : le gain est verrouillé.
- **Types** : `typecheck-baseline.txt`. Les numéros de ligne ne comptent pas, déplacer du code ne crée pas d'erreur « nouvelle ». Après correction d'erreurs, ou pour accepter volontairement une erreur : `npm run typecheck:update`, puis commiter le fichier. Le script affiche « N erreur(s) de la baseline ont disparu » quand il y a un gain à verrouiller.
- **Règle** : ne pas élargir une baseline pour faire passer du code neuf ; corriger le code.

### 3.5 Tests

- Les 6 fichiers de `supabase/tests/*.test.ts` utilisaient `node:test` ; ils tournent maintenant sous vitest (même contenu, seul l'import change). Ils vérifient des garanties de sécurité : tarifs serveur, signature du webhook, connecteurs opérateurs, endpoints IA, rôles fondateurs, identifiants de suivi.
- Les 3 suites maison de `src/` (moteur de commandes du Studio IA, système d'affiliation, complétion de profil) n'étaient exécutées par personne ; elles le sont via `test.each`.
- Le test du webhook Ecomfy Pay a été réécrit : depuis le correctif M6, la comparaison du montant encaissé est faite dans la fonction SQL `confirm_ecomfy_payment` (dans la même transaction que le crédit), plus dans l'Edge Function. Le test vérifie que le webhook transmet `p_remote_amount` et que la comparaison précède le crédit du portefeuille.
- Les tests ne touchent ni la base ni le réseau, et n'ont pas besoin de `.env`. Les scripts SQL de `supabase/tests/*.sql` restent à lancer à la main sur dev ; la CI ne les exécute pas.

## 4. Points ouverts

### 4.1 Vulnérabilités restantes (dépendances de production)

`npm audit --omit=dev` : 13 vulnérabilités, **0 critique**, 7 « high ». Le correctif proposé par npm est un changement majeur ou une rétrogradation :

| Paquet | Gravité | Remarque |
|---|---|---|
| `firebase`, `@firebase/firestore`, `@firebase/firestore-compat`, `@grpc/grpc-js` | high | npm propose `firebase@9.14.0` (rétrogradation de la v12) : à ne pas faire. À traiter par une montée de `firebase` quand un correctif sera publié. |
| `zod` | high | Correctif en 4.x (changement majeur, API différente de la 3.x utilisée). |
| `nanoid`, `source-map-js` | high | Dépendances indirectes. `npm audit fix` peut les corriger mais modifie le verrou plus largement : à faire dans un lot séparé, avec build et tests. |
| `react-router`, `react-router-dom`, `postcss-selector-parser` | moderate | Idem. |

Le seuil bloquant (`critical`) pourra être abaissé à `high` une fois ces points traités : modifier `audit:prod` dans `package.json`.

### 4.2 Bugs d'exécution révélés par le typecheck (non corrigés)

Ils sont dans la baseline de types, donc la CI ne les signale pas ; ils sont à corriger :

| Fichier | Problème |
|---|---|
| `src/components/AIImageGenerator.tsx` | `cn` utilisé sans import (ligne ~334) : erreur au rendu. |
| `src/components/TemplatePreviewDialog.tsx` | Importe `@/lib/showcaseTemplates`, qui n'existe pas. |
| `src/pages/GovernanceDocumentPage.tsx` | `Link`, `useNavigate` et `useParams` importés de `react` au lieu de `react-router-dom`. |

Les autres erreurs de la baseline sont en grande partie des écarts avec les types Supabase générés (`src/integrations/supabase/types.ts`, en retard sur le schéma) : régénérer ces types en résorberait plusieurs dizaines d'un coup.

### 4.3 Non vérifié

- **Le workflow n'a pas encore tourné sur GitHub.** Les quatre commandes ont été exécutées en local (Windows) et la syntaxe du fichier validée, mais pas l'exécution sur le runner Linux. Au premier push de `jeanmarc`, ouvrir l'onglet *Actions* et vérifier que les quatre jobs passent.
- Les actions sont référencées par tag (`actions/checkout@v4`, `actions/setup-node@v4`), pas par empreinte de commit.
- Pas de job `build` en CI : il demanderait `VITE_SUPABASE_URL` et `VITE_SUPABASE_PUBLISHABLE_KEY` en secrets GitHub.
- Un échec isolé de test a été observé une fois sur neuf exécutions locales, non reproduit ensuite. La cause la plus probable était la lecture lente (à froid) de tous les fichiers de migration par le test réécrit ci-dessus ; elle a été remplacée par une lecture qui s'arrête dès que la définition est trouvée. Si un échec réapparaît en CI, regarder ce test en premier (`supabase/tests/pricing.test.ts`).

## 5. Retour arrière

Aucun état serveur n'est touché. Pour revenir en arrière : redéployer le build précédent sur Vercel. La CI se désactive en supprimant `.github/workflows/ci.yml` ou en retirant le bloc `push`.
