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
