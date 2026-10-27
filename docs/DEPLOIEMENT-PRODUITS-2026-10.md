# Déploiement — Produits de la boutique (23/10/2026)

**Projet prod :** `yfggrceynzcwklbxhgix`. **Branche :** `jeanmarc`. **Ne jamais utiliser `supabase db push`** ; appliquer uniquement le fichier ci-dessous, puis le front.

**Migration (optionnelle, une seule) :** `supabase/migrations/20261023100000_product_seo_fields.sql` — ajoute `products.seo_title` et `products.seo_description`. Le front fonctionne **avant et après** : il n'envoie ces champs que s'ils sont remplis ou si la colonne existe déjà sur la ligne lue. Ordre libre ; sans la migration, seuls les champs SEO du produit ne s'enregistrent pas (erreur claire à l'enregistrement).

Aucune Edge Function à déployer pour ces correctifs.

## 1. Éditeur de produit (marchand)

| # | Problème | Correction |
|---|---|---|
| E1 | Zone de description : la première frappe d'un nouveau texte réécrivait le contenu et ramenait le curseur au début (« bonjour » → « onjourb »). | La zone n'est réécrite que si le texte vient de l'extérieur (chargement, assistant IA) et qu'elle n'a pas le focus. |
| E2 | Variantes : impossible de taper plusieurs options (la virgule disparaissait à chaque frappe) ; une retouche cassait « Blanc (S, M, L), Noir (S, M) » en morceaux. | Champ à texte libre ; la virgule dans une parenthèse ne sépare pas (`splitVariantOptions`). |
| E3 | L'adresse « URL slug » saisie sur un produit existant était **ignorée** ; le champ refusait aussi les tirets en fin de frappe. | Le slug est enregistré (unique par boutique, message si déjà pris), avertissement « les anciens liens ne marcheront plus ». |
| E4 | Lien « Copier » vers `visuelpro.cloud` (ancien domaine) ; en-tête `votreboutique.shop/produit/…` factice. | `ecomfy.cloud/shop/<boutique>/p/<slug>` ; copie depuis l'adresse **enregistrée** ; erreur de presse-papiers gérée. |
| E5 | Méta titre, méta description, mots-clés, prix de revient, type de produit, emplacement et « Compte Arribo » : saisis puis **perdus**. | Méta titre / description enregistrés (migration) et utilisés sur la fiche publique ; mots-clés, type, emplacement, Arribo retirés (sans effet) ; prix de revient conservé comme calcul de marge, précisé « non enregistré ». |
| E6 | Interrupteur « Déballer » modifiait en réalité `is_digital` (badge « Digital » côté client) ; « Recocher » doublait « Produit vedette » ; « Masquer le récapitulatif » n'était enregistré nulle part. | Section réécrite : « Produit vedette » et « Produit numérique » (libellé exact). |
| E7 | Enregistrement automatique relancé à chaque rendu de la page (commande reçue, upload…), même sans modification ; il écrivait aussi des valeurs invalides (nom vide, prix négatif, produit visible à 0 FCFA). | Dépend du seul contenu de la fiche, compare à la dernière version enregistrée, applique les mêmes contrôles que « Tout enregistrer ». |
| E8 | Bouton Retour dans la seconde et demie suivant une modification : modification **perdue** ; la liste affichait l'ancien nom / prix. | Le Retour enregistre d'abord (ou demande confirmation si l'enregistrement échoue), puis recharge la liste. Confirmation aussi pour un nouveau produit non créé. |
| E9 | Réordonner les images : rien ne bougeait à l'écran avant réouverture, et la 1re image n'était pas l'image principale (deux pastilles « Principal » possibles). | Mise à jour immédiate, 1re image = principale, même ordre que la boutique. |
| E10 | Supprimer une image effaçait le fichier **avant** la ligne en base ; un fichier partagé était supprimé pour tous. | Ligne d'abord, fichier ensuite, et seulement s'il n'est plus référencé. |
| E11 | Vue « code source » : le HTML était enregistré échappé (`&lt;p&gt;`) et publié tel quel. | Le texte du code est enregistré. |
| E12 | « Insérer une vidéo » : l'iframe était supprimée par la fiche publique (jamais affichée) ; couleur du texte (`<font>`) supprimée aussi. Liens sans protocole devenus relatifs. | Un seul assainisseur partagé (éditeur, aperçu live, fiche publique, thèmes) : YouTube / Vimeo uniquement, `<font>` conservé ; liens normalisés, `javascript:` refusé. |
| E13 | « Autoriser les commandes au-delà du stock » : sans effet pour un produit pas encore créé ; échec silencieux. | Enregistré à la création ; l'interrupteur revient en arrière si le serveur refuse. |
| E14 | Offres en lot avec quantité décimale (inapplicable) ; noms de variantes avec espaces. | Quantité entière ; noms rognés (`cleanBundleOffers`, `cleanVariants`). |

Fichiers : `ProductEditor.tsx`, `ShopEditor.tsx`, `lib/productVariants.ts`, `lib/sanitizeProductHtml.ts`.

## 2. Assistant guidé

| # | Problème | Correction |
|---|---|---|
| W1 | La génération IA ajoutait de faux témoignages « Avis clients vérifiés » (« Awa K., Abidjan »…) et une garantie « Satisfait ou remboursé 14 jours » inventés, y compris quand l'IA échouait. | Témoignages et garantie retirés de la description générée ; plus aucun texte de secours inventé. |
| W2 | Échec ou crédits épuisés : toast « rédigée avec succès ». | Message d'erreur réel ; rien n'est écrit dans la fiche. |
| W3 | La photo n'était jamais transmise à l'IA (aperçu `blob:` testé comme `data:`). | Le fichier est relu en base64 (hors GIF). |
| W4 | Bandeau « rédigée avec succès par l'IA » affiché pour toute description existante. | Affiché seulement après une génération, avec « À relire avant de publier ». |
| W5 | Suppression d'une image existante sans confirmation. | Confirmation. |

## 3. Liste des produits

| # | Problème | Correction |
|---|---|---|
| T1 | Suppression d'un produit **déjà commandé** : images, avis et réglages détruits, puis refus de la base (`order_items.product_id` sans `ON DELETE`). Fiche conservée mais vidée. | Vérification des commandes d'abord : proposition de **masquer** à la place ; sinon le produit est supprimé en premier (cascade), fichiers ensuite. |
| T2 | Stock vide (illimité) affiché « Rupture » et classé en rupture. | « Illimité » ; filtre et tri corrigés. |
| T3 | Compteur « Commandes » : faux positifs par nom (« Sac » compté dans « Sac à dos »). | Rapprochement par nom seulement pour les commandes sans lignes d'articles. |
| T4 | Filtre actif sans résultat : message « Aucun produit — ajoutez votre premier produit ». | « Aucun résultat » + bouton Réinitialiser ; recherche aussi par SKU et catégorie. |
| T5 | Publier (interrupteur) un produit à 0 FCFA ; caches non invalidés après masquer / supprimer / ordre des images. | Refus avec message ; caches invalidés. |

> **Dépendance (suppression de produit)** : la suppression d'un produit était silencieusement annulée par la base (déclencheur `trg_enforce_lock_products`, `RETURN NEW` sur un `BEFORE DELETE`) : le correctif T1 ne pouvait pas aboutir. Il est dans la migration `20261023160000_product_reviews_hardening.sql` (voir [`DEPLOIEMENT-AVIS-2026-10.md`](DEPLOIEMENT-AVIS-2026-10.md) A5) : **à appliquer en prod pour que « Supprimer » fonctionne**, et c'est elle qui fait partir les avis avec le produit.

## 4. Fiche produit publique et boutique

| # | Problème | Correction |
|---|---|---|
| P1 | Bouton « Commander » : l'offre en lot choisie était **perdue** (article ajouté au panier sans son lot → prix plein) ; boutons et barre collante affichaient `prix × quantité` sans le lot. | Le lot suit la ligne du panier (`bundleIndex`), total et boutons utilisent `priceLine` (même règle que le trigger SQL). |
| P2 | Variantes : « S » affiché coché, mais la commande partait **sans taille** ; formulaire direct sans contrôle des variantes obligatoires. | Sélection par défaut enregistrée ; contrôle avant toute commande. |
| P3 | Commandes contenant des clés techniques (`Couleur_main`, `Couleur_sub`) en double dans le détail, libellé « — Taille: » imposé. | Clés techniques retirées à l'envoi et à l'affichage (y compris anciennes commandes dans la liste et les paniers abandonnés) ; libellé « Blanc — S ». |
| P4 | Options coupées à tort (« Noir-Mat », « iPhone 13/14 », « T-shirt ») par le sélecteur. | On ne coupe sur `-` `/` `|` que pour des tailles (S, XL, 2XL, 40…). |
| P5 | Fiche rapide de la boutique : option « Blanc (S, M, L) » affichée comme un seul bouton (taille impossible) ; description HTML affichée avec ses balises. | Même sélecteur que la fiche produit ; description en texte. |
| P6 | Produit absent / masqué : « Connexion lente — votre produit existe bien ». | « Produit introuvable » ; le bouton Réessayer n'apparaît que sur une vraie erreur réseau. |
| P7 | Description `<meta>` = HTML brut de la description quand le résumé court est vide ; `sku` = identifiant interne ; devise « FCFA » (code invalide). | Texte brut tronqué, vrai SKU, `XOF`, disponibilité alignée sur « commandes en rupture autorisées ». |
| P8 | Événement Purchase (pixels) envoyé sans article pour les commandes directes. | Contenus issus de la commande réellement passée. |
| P9 | Produit en rupture (commandes au-delà du stock désactivées) : bloqué sur la fiche mais commandable via le « + » de la grille. | Badge « Rupture de stock » et bouton désactivé. |

## 5. Points relevés, non modifiés (décision à prendre)

- **Edge Function `generate-product-sheet`** : son prompt demande encore à l'IA d'inventer 3 témoignages et sa version de secours en fabrique. Le front ne les utilise plus ; à nettoyer au prochain déploiement de la fonction.
- **Bandeau « 🎁 Livraison gratuite & Offre spéciale »** (fiche produit, si aucune barre d'avis) et « Satisfait ou remboursé » (formulaire) sont écrits en dur pour toutes les boutiques.
- ~~**Nombre d'avis** : « (128 avis) » et 5 étoiles par défaut~~ : **corrigé** le 23/10 (badge = avis réels), voir [`DEPLOIEMENT-AVIS-2026-10.md`](DEPLOIEMENT-AVIS-2026-10.md) A13.
- Le stock est un compteur marketing : la base ne le décrémente pas et ne bloque pas une commande en rupture (le blocage est côté front).
- Prix de revient : non stocké volontairement (la table `products` est lisible publiquement).

## 6. Vérifications faites

- `tsc` : aucune erreur sur les fichiers modifiés (les erreurs restantes du projet sont antérieures) ; `vite build` réussi.
- Contrôles unitaires exécutés (hors dépôt) : découpe des variantes, sélection par défaut, nettoyage des clés, calcul du lot, extraction de texte, URL vidéo ; assainisseur testé sous jsdom (iframe YouTube/Vimeo gardée, autres iframes / `javascript:` / handlers supprimés, `<font>` conservé).
- **Non testé dans un navigateur** (pas de session marchand disponible) : parcours à rejouer après déploiement — créer un produit avec variantes et lot, cliquer « Commander » et comparer le total à l'offre, réordonner les images, supprimer un produit déjà commandé.
