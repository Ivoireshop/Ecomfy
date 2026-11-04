# Déploiement — Apparence et Thèmes de la boutique (23/10/2026)

**Branche :** `jeanmarc`. **Front seul :** aucune migration SQL, aucune Edge Function. **Commité : `01dabda`.** Les thèmes pro affichent désormais aussi les avis et la barre d'avis (voir [`DEPLOIEMENT-AVIS-2026-10.md`](DEPLOIEMENT-AVIS-2026-10.md) A10).

Fichiers : `src/pages/ShopEditor.tsx`, `src/pages/ShopView.tsx`, `src/pages/ProductView.tsx`, `src/components/shop/ShopThemesManager.tsx`, `src/components/shop/ShopThemeSettings.tsx`, `src/components/shop/ShopAIAssistant.tsx`, `src/lib/shopThemes/ShopThemeRenderer.tsx`, `src/lib/shopThemes/themes/DynamicShop.tsx`, `src/lib/productAppearance.ts`.

Périmètre lu : menus « Boutique » (apparence), « Thème » (réglages) et « Thèmes » (catalogue) du tableau de bord, et la façon dont la vitrine publique les applique.

## 1. Anomalies corrigées

| # | Anomalie | Correction |
|---|---|---|
| T1 | Les réglages non enregistrés (couleurs, thème, textes) étaient **perdus** quand le marchand quittait puis revenait sur l'onglet : le rechargement automatique remplaçait toute la boutique par la version de la base. Même effet à la fermeture de l'éditeur produit et sur toute mise à jour temps réel de la boutique. | `fetchData` et le canal temps réel gardent les champs modifiables en cours d'édition et ne rafraîchissent que le reste (activation, paiement…). Empreinte de référence mise à jour à chaque chargement et à chaque « Enregistrer ». |
| T2 | Si l'aperçu d'un thème plantait dans « Thèmes », la **page entière du tableau de bord était rechargée** (`?classic=1`), avec perte des réglages en cours. | `ShopThemeRenderer` reçoit `embedded` : l'erreur reste locale, message à la place de l'aperçu. La vitrine publique garde son repli automatique vers le design classique. |
| T3 | Aperçu d'un thème : le bouton « Installer » restait affiché pour un thème déjà installé ou actif, sans état d'attente ; les liens de l'aperçu faisaient quitter le tableau de bord. | Bouton « Installer » seulement si absent, « Activer » si installé mais inactif, aucun si actif. Liens neutralisés dans l'aperçu. |
| T4 | Le bouton premium « Masquer Propulsé par Ecomfy » n'avait **aucun effet** sur la vitrine par défaut (pied de page de l'accueil et de la fiche produit). Seuls les thèmes installés le respectaient. | Pied de page de `ShopView` et de `ProductView` lisent `hide_ecomfy_branding`. |
| T5 | L'assistant IA de la vitrine lisait une variable `shop` inexistante : **ouvrir la fenêtre de l'assistant faisait planter la page** (ReferenceError). | Nouvelle propriété `hideEcomfyBranding` passée par `ShopView` et `ProductView`. |
| T6 | Réglages du menu « Thème » sans aucun effet sur la vitrine (aucun code ne les lisait) : en-tête (couleur de fond sur l'accueil, bordure on/off, couleur des icônes), bannière du panier (4 réglages), couleur et texte du bouton de commande, couleur de texte générale du check-out, section Hero on/off, section contact on/off, nombre de colonnes de produits. | Branchés : accueil (`ShopView`) pour l'en-tête, le Hero, le contact, les colonnes (3, 4 ou 5) et la bannière du panier ; fiche produit (`ProductView`) pour le bouton de commande (formulaire et deux barres fixes), le texte du check-out, la bordure et les icônes de l'en-tête. Valeurs par défaut inchangées : une boutique qui n'a rien réglé s'affiche comme avant. |
| T7 | Mode d'affichage du logo : « Logo uniquement » apparaissait coché dans « Thème » même sans logo, alors que « Boutique » et la vitrine retombent sur « Nom uniquement ». | Même règle partout (logo présent : logo seul, sinon nom). |
| T8 | Le nom de la boutique dans l'en-tête (accueil et fiche produit) gardait un gris foncé fixe : illisible sur un fond d'en-tête sombre choisi dans « Thème ». | Couleur calculée selon le fond d'en-tête (mobile et bureau séparément) : gris foncé sur fond clair, blanc sur fond sombre (`readableTextOn`, contraste WCAG ≥ 4,5). |
| T9 | Le « Constructeur Dynamique » plantait **toujours** : le thème lisait `data.settings`, qui n'existe pas, et le layout au mauvais endroit (`custom_settings` au lieu de `theme_config.layout`, où l'éditeur visuel l'enregistre). Une boutique l'utilisant retombait en silence sur le design classique. Il était en outre proposé comme thème gratuit prêt à installer alors qu'il n'a de contenu qu'après l'éditeur visuel. | `DynamicShop` lit `theme_config.layout`, le nom et la description de la boutique. Retiré du catalogue « Tous les thèmes gratuits » ; il reste visible comme thème actuel et dans « Mes thèmes installés » quand l'éditeur visuel l'a activé. |

### Passe du 04/11/2026 — installer / activer / désinstaller un thème (non commité)

Fichiers : `src/components/shop/ShopThemesManager.tsx`, `src/pages/ShopEditor.tsx` (une ligne : cache `shop:id:`). Front seul.

| # | Anomalie | Correction |
|---|---|---|
| T10 | Chaque action partait de la configuration **affichée à l'écran** : deux clics rapprochés (installer A puis B) partaient du même état, la seconde écriture effaçait la première ; un changement fait depuis un autre onglet ou l'éditeur visuel était écrasé. | Les écritures sont mises en file (l'une après l'autre) et lisent la configuration **en base** juste avant d'écrire. |
| T11 | L'action écrivait aussi, sans le dire, tous les réglages « Thème » non enregistrés présents à l'écran. | Seules les clés concernées (`installed_themes`, `active_theme_slug`) sont écrites ; les réglages en cours restent en attente de « Sauvegarder ». |
| T12 | Si la base refusait l'écriture sans erreur (boutique restreinte, droit d'accès), l'écran affichait « Thème activé » alors que rien n'était enregistré. | Écriture suivie d'un contrôle du nombre de lignes modifiées ; message d'erreur sinon. Exceptions de lecture/écriture capturées. |
| T13 | Après activation, la copie en cache de la vitrine masquait le changement dans l'aperçu du marchand. | Caches `shop:slug:<slug>` **et** `shop:id:<id>` vidés après chaque changement (l'aperçu par identifiant lit la seconde ; l'enregistrement de l'éditeur ne vidait que la première, corrigé aussi). |

**Vérifié le 04/11 :** `tsc` au même niveau que la référence (482 lignes, aucune dans les fichiers touchés), `eslint --pass-on-unpruned-suppressions` propre sur les deux fichiers (le fichier d'origine avait 5 `any` figés dans `eslint-suppressions.json`, la version corrigée en a moins), `vitest` 152 tests passés.

**Testé dans le navigateur le 04/11 sur dev** (boutique « BOUTIQUE TEST », serveur local port 8082, session du marchand ; `theme_config` initial `{"force_mobile_money_interior": true}` rétabli à l'identique à la fin) :

| Contrôle | Résultat |
|---|---|
| T10 : « Installer » de deux thèmes cliqué dans le même instant (rejoué après le dernier changement de code) | Les deux sont en base, clé existante conservée, les deux affichés dans « Mes thèmes installés ». |
| T10 : deux onglets. L'onglet B ajoute `luxury-shop` en base ; l'onglet A, resté sur l'ancien état (3 thèmes), installe « Mobile First » | La base contient les deux ; l'onglet A affiche ensuite les 5 thèmes. |
| T11 : réglage « Activer la bordure » décoché sans enregistrer, puis installation d'un thème | Base : seule `installed_themes` change ; le réglage reste en attente à l'écran. |
| T11 : « Sauvegarder » après une activation de thème et une modification du réglage | La base garde `active_theme_slug` et reçoit le réglage. |
| Aperçu : « Installer » puis « Activer » dans la fenêtre d'aperçu | Boutons successifs conformes (Installer, Activer, aucun) ; base conforme ; pas d'erreur d'aperçu. |
| Activer, revenir au classique, désinstaller | `active_theme_slug` = `fashion-shop`, puis `null` ; thème retiré de la liste ; autres clés intactes. |
| T12 : écriture sur `shops` simulée à « 0 ligne modifiée » | Message d'erreur affiché, pas de « Thème installé », base inchangée, thème toujours installable. |
| T13 : marqueurs posés dans les clés `shop:slug:` et `shop:id:`, puis activation | Les deux clés de la boutique sont vidées ; la clé d'une autre boutique est conservée. |
| Aperçu propriétaire `/shop-preview/<id>` avec Fashion actif | La vitrine affiche le thème Fashion (rendu différent du classique, sans repli). |

**Constat hors périmètre :** une boutique non activée ouverte par son lien public `/shop/<slug>` est en mode aperçu et lit la boutique avec une requête limitée (sans `theme_config`) : le thème n'y est jamais appliqué. Et un **autre onglet** déjà ouvert sur la vitrine garde sa copie de session (5 min) : constaté en rechargeant l'aperçu, qui affichait encore Fashion après le retour au classique (déjà décrit plus bas).

Non testé : un vrai refus par règle d'accès (simulé), la boîte de confirmation native d'activation (remplacée par « oui » dans le script, la fenêtre bloquerait l'outil), l'affichage mobile. L'enregistrement fait avec « Sauvegarder » réécrit les champs de la boutique tels qu'affichés (valeurs identiques ; `notification_settings` peut passer de vide à `{}` et une ligne `shop_secrets` peut être créée).

## 2. À trancher après (non fait)

Trois points qui demandent une décision avant tout code. Contrôles laissés en place en attendant.

- **Mise en page des images** (`product_layout` : Standard, Grande image, Galerie défilante) : le réglage existe dans « Thème → Paramètres du produit » mais la fiche produit ne le lit pas. Les trois dispositions ne sont définies nulle part : à décider (design de chacune), ou retirer le contrôle.
- **Menu « Boutique » en boutique restreinte** : apparence, logo, bannière, couleurs et SEO ne sont pas enveloppés dans `StoreRestrictedLockScreen`, contrairement à « Thème », « Thèmes » et « Paramètres ». Un marchand restreint peut encore y modifier et enregistrer. À confirmer si c'est voulu.
- **Droit premium** : il n'est vérifié qu'à l'activation de « Masquer Propulsé par Ecomfy ». Un marchand repassé en gratuit garde la mention masquée. À décider : revérifier à l'affichage (ce qui suppose que le plan de la boutique soit exposé à la vitrine publique, à vérifier) ou à l'expiration de l'abonnement.

Aussi constaté, hors périmètre : la vitrine publique affiche d'abord la copie en cache (`sessionStorage`, 5 min) puis ne remplace pas l'affichage quand la version fraîche arrive ; un changement fait dans le tableau de bord n'apparaît donc qu'au rechargement suivant.

## 3. Vérification sur dev (navigateur, 23/10/2026)

Boutique « Test Securite Dev » (dev `xfpbpxncserliskrbaim`, plan gratuit, 1 produit). État initial relevé avant le test (`theme_config` vide) et **rétabli à l'identique après** (champs comparés un à un) ; assistant IA temporaire créé puis supprimé.

| Contrôle | Résultat |
|---|---|
| T1 : deux couleurs modifiées dans « Thème » sans enregistrer, puis `focus` + `visibilitychange` (rechargement vérifié : requêtes `shops`, `shop_secrets`, `orders`…) | Couleurs conservées. « Sauvegarder » : enregistrées en base. |
| T2 : aperçu du « Constructeur Dynamique » (plante réellement à l'affichage) | Message dans la fenêtre d'aperçu, page non rechargée (marqueur JS conservé). |
| T3 : liens de l'aperçu ; « Installer » dans l'aperçu | Clics neutralisés, URL inchangée. « Installer » devient « Activer » ; une fois actif, plus de bouton. L'activation conserve les autres réglages (21 clés). |
| T4 : `hide_ecomfy_branding` | Pied de page de l'accueil et de la fiche produit sans « Créé avec / Propulsé par Ecomfy ». |
| T5 : assistant IA ouvert sur la fiche produit (assistant temporaire activé) | S'ouvre, aucune erreur, pied sans « Propulsé par Ecomfy ». |
| T6 accueil : fond d'en-tête bleu (bureau) / rouge (variable mobile), bordure transparente, icônes jaunes, Hero absent, 3 colonnes (`grid-template-columns` de 3 × 388 px), section contact absente, bannière du panier (texte, fond, couleur) | Tous conformes. |
| T6 fiche produit : fond et bordure d'en-tête, icône, « Confirmer ma commande » et « COMMANDER » (fond vert, texte noir), texte du formulaire (violet) | Conformes, après correction d'un bouton « Commander » que le premier passage avait oublié (texte blanc codé en dur). |
| T7 : « Nom texte uniquement » coché par défaut sans logo | Conforme. |
| T8 : fond d'en-tête bureau sombre (`#0b1b3a`) et mobile clair (`#ffffe0`) | Accueil et fiche produit : nom en blanc sur le fond sombre, variable mobile en gris foncé sur le fond clair. |
| T9 : thème dynamique activé avec un layout (en-tête, bandeau, grille de produits, atouts) ; catalogue des thèmes | La vitrine affiche le layout (avant : repli sur le design classique). Le Constructeur Dynamique n'est plus dans le catalogue gratuit, et reste affiché « Activé » comme thème actuel. |

Non testé : le rendu du bloc « Texte + image » du thème dynamique, l'éditeur visuel lui-même, l'affichage mobile réel (seules les variables CSS mobiles ont été lues), clic réel sur « Enregistrer » après l'activation d'un thème, le contrôle « avant correction » (comportement d'origine non rejoué).

## 4. Déploiement

Build et déploiement du front habituels. Rien d'autre.
