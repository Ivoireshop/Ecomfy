# Déploiement — Statistiques de la boutique (22/10/2026)

**Branche :** `jeanmarc`. **Front seul :** aucune migration SQL, aucune Edge Function à déployer. Cette passe complète la section 2 de `DEPLOIEMENT-BOUTIQUE-RESTREINTE-2026-10.md` (tendances réelles, objectif du mois, entonnoir, etc.), qui reste valable.

Fichiers : `src/components/shop/ShopStatistics.tsx`, `src/pages/ShopEditor.tsx`.

## 1. Anomalies corrigées

### Données fausses

| # | Anomalie | Correction |
|---|---|---|
| S1 | Les visites étaient lues en une requête : le serveur plafonne chaque réponse à 1 000 lignes quel que soit `.limit(5000)`. Au-delà de 1 000 visites sur 30 jours, visiteurs sous-comptés et taux de conversion gonflé. | Lecture par pages de 1 000 jusqu'à 5 000 visites (`fetchVisits`, même méthode que les commandes). |
| S2 | « Sources de trafic » : sans visite, la page affichait « Direct 100 % (1) », une valeur inventée, avec un globe. | Liste vide et message « Aucune visite sur la période ». |
| S3 | Une session était attribuée à la source de sa visite la plus **récente**, qui porte souvent un référent interne (le site lui-même). | Attribuée à la **première** visite de la session. |
| S4 | Les référents inconnus s'affichaient en URL complète ; « ig » ou « fb » dans un nom de domaine (`digital.com`) donnait l'icône Instagram ou Facebook. | Référent brut ramené à son domaine (`exemple.com`) ; plateforme reconnue par mot entier (`sourceKind`). |
| S5 | « Ventes par pays » : les visites portent un code (`CI`), les commandes un nom (`Côte d'Ivoire`) : un même pays était listé deux fois (visiteurs d'un côté, ventes de l'autre) et n'avait pas de point sur le globe. | Rapprochement par code ISO (`canonicalCountry`, noms français et anglais, orthographes sans accent ou avec apostrophe typographique) ; une seule ligne par pays, nom en français. `XX` et `T1` (valeurs Cloudflare) comptés comme non spécifiés, ligne placée en dernier. |
| S6 | Globe des pays : correspondance partielle de noms (« Mali » reconnu dans « Somalie ») ; 12 pays seulement. | Coordonnées par code ISO, 29 pays (Afrique de l'Ouest et centrale, Maghreb, Europe, Amérique du Nord). |
| S7 | Pays déduit du téléphone quand la commande n'en a pas : les numéros locaux de 8 ou 9 chiffres étaient attribués au hasard entre pays voisins (Burkina Faso, Mali, Cameroun...). | Indicatif international uniquement, plus les numéros de 10 chiffres commençant par 0 (Côte d'Ivoire) ; sinon « non spécifié ». |
| S8 | Visites sans identifiant de session comptées avec `Math.random()` : chiffres différents d'un affichage à l'autre, et traitement différent selon le bloc. | Une seule règle (`sessionKey`) pour visiteurs, direct, sources et pays. |
| S9 | « Visiteurs en ce moment » figé : les visites ne se rechargeaient qu'au retour sur l'onglet. | Rechargement des visites toutes les 30 s sur la page Statistiques, onglet visible seulement. |

### Affichage

| # | Anomalie | Correction |
|---|---|---|
| A1 | « Aujourd'hui » : un seul point sur le graphique, donc ni courbe ni aire. | Détail par heure, de 0 h à l'heure courante. |
| A2 | Infobulle du graphique : « ventes », « commandes », « panier_moyen » sans unité. | « Ventes », « Panier moyen » en FCFA, « Commandes » en nombre. |
| A3 | Axe des ventes en grands nombres (`150000`), graduations décimales pour les commandes. | Axe abrégé (« 150 k ») ; graduations entières pour les commandes. |
| A4 | Top produits : barre à `NaN %` si le chiffre d'affaires est nul ; produits supprimés (`product_id` nul) tous fusionnés en un ; « cmd » alors que le chiffre est une quantité. | Plancher à 1 pour la barre ; regroupement par nom quand l'identifiant manque ; « 6 vendus ». |

## 2. Vérification sur dev (navigateur, 22/10/2026)

Compte, boutique, 2 produits, 12 commandes et 1 506 visites jetables, **supprimés après le test** (dev revenu à 53 boutiques, 0 compte de test, 0 visite de test).

| Contrôle | Résultat |
|---|---|
| Visites au-delà de 1 000 (S1) | « Visiteurs uniques » : 1 504 (1 500 + session à deux visites + 3 en direct). Conversion 12 / 1 504 = 0,80 %. |
| Pays (S5, S7) | Côte d'Ivoire 602 visiteurs et 9 commandes sur une seule ligne (dont 3 commandes sans pays rattachées par leur indicatif +225), Sénégal 301 et 3, France 301 et 0, « Autres / Non spécifié » 300, en dernier. |
| Source d'une session (S3) | Session dont la 1re visite vient de Google et la dernière d'un référent interne comptée pour Google (301 = 300 + 1) ; le référent interne n'apparaît pas. |
| Domaine (S4) | `https://www.exemple.com/p` affiché « exemple.com ». |
| Période « Aujourd'hui » (A1) | Graphique par heure de 0 h à 17 h ; graduations « 6,5 k ». |
| Infobulle (A2) | « Commandes : 3 / Ventes : 55 000 FCFA / Panier moyen : 18 333 FCFA ». |
| Top produits (A4) | « Sac cuir 150 000 FCFA, 6 vendus ». |
| Direct (S9) | Visite ajoutée pendant que la page était ouverte : « 3 visiteurs en ce moment » devient « 4 » en moins de 30 s, sans rechargement. |

Vérification du rapprochement des pays et des sources aussi en Node (`France` → `FR` et non l'ancien code `FX`, `Burkina Faso` → `BF` et non `HV` : la première correspondance est conservée).

**Limites de ce test.** Le rendu du globe n'a pas pu être vu (WebGL absent du navigateur automatisé) ; son image de fond est chargée en `http://unpkg.com`, bloquée par la politique de sécurité (erreur de console, sans lien avec ces correctifs). Boutique restreinte (commandes masquées, sans articles) non rejouée dans cette passe. La page ne dépend d'aucune table absente de dev.

## 3. Déploiement

1. Déployer le front. Rien d'autre.
2. Vérifier sur une boutique réelle : le nombre de visiteurs d'une période de 30 jours dépasse 1 000 si elle a ce trafic ; un pays n'apparaît qu'une fois dans « Ventes par pays » ; « Aujourd'hui » trace une courbe par heure.

**Retour arrière :** revenir au commit précédent des deux fichiers, sans conséquence sur les données.

## 4. Points laissés de côté

- **Réconciliation Meta** (`TrackingReconciliation.tsx`, Edge Function `reconcile-tracking`) : jamais affichée, car `ShopEditor` ne transmet pas `shopId` à `ShopStatistics` (ajoutée au commit `cb167f9` sans branchement). Non activée : elle appelle une Edge Function qui n'est pas dans les listes de déploiement et afficherait une erreur sur chaque boutique. À décider.
- Les visites restent plafonnées à 5 000 lignes et à 30 jours : au-delà, les chiffres de la période « 30 jours » sont partiels pour les très gros volumes. Un calcul côté base (fonction SQL agrégée) serait la vraie solution.
- Le globe de trafic place les sources (Facebook, Google...) sur des points fixes du globe : choix visuel, pas une géolocalisation.
