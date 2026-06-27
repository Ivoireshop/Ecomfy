# Refonte VisualPro — Plan en 4 lots

Travail découpé pour éviter les régressions. Chaque lot est livré, vérifié, puis le suivant démarre.

## Lot 1 — Bug images (priorité absolue, ce tour)

Objectif : aucune image ne disparaît plus jamais sur une nouvelle fiche produit.

- Audit complet du pipeline existant : `ProductEditor.tsx`, `RichTextEditor.tsx`, `ShopEditor.tsx` (handleSaveProduct), `uploadProductImage`, RLS `product_images`, `shop-images` bucket, trigger `strip_base64_images`.
- Garantir que `handleSaveProduct` :
  - upload TOUTES les images avant `INSERT/UPDATE` du produit ;
  - bloque le save si un upload échoue (toast clair, texte préservé) ;
  - pour un nouveau produit, crée d'abord la ligne `products`, puis uploade images avec `product_id` réel ;
  - retry automatique 1× par image en échec réseau.
- Aperçu local immédiat via `URL.createObjectURL`, mais ne JAMAIS l'écrire en base.
- Invalider `shopCache` après save pour éviter l'affichage sans image au retour.
- Messages d'erreur explicites (poids, format, échec réseau, RLS).
- Cache‑busting du `<img>` après upload pour éviter image fantôme.
- Test manuel via Playwright : créer produit avec 1 image, 3 images, recharger, modifier, supprimer 1 image.

## Lot 2 — Dashboard guidé "Commencez dès maintenant" (tour suivant)

- Composant `OnboardingChecklist.tsx` sur `Dashboard.tsx` + `ShopEditor.tsx` overview.
- 8 étapes : activer boutique, créer produit, ajouter images, personnaliser, infos commande, paiement, domaine, publier.
- Statut calculé depuis la DB (shops + products + paramètres).
- Barre de progression %, bouton d'action par étape, redirection ciblée.
- Masquage automatique une fois 100% (réaffichable depuis "Ressources").

## Lot 3 — Mode "Assistant" fiche produit (tour suivant)

- Bouton "Création guidée" en haut de `ProductEditor` qui ouvre un wizard 6 étapes dans un Sheet (Sheet + Stepper).
- Réutilise le state et les champs du `ProductEditor` actuel — zéro duplication de logique de save.
- Étapes : Infos → Images → Description (avec boutons IA existants) → Variantes → Livraison → Aperçu+Publication.
- Bouton "Mode expert" pour revenir à l'éditeur complet à tout moment.
- Auto‑save silencieux 1,5s (déjà en place), indicateur "Enregistré" en haut.
- Avertissement `beforeunload` si des changements non sauvegardés.

## Lot 4 — Liste produits + Ressources + Aperçu (tour suivant)

- `ProductsTable` mobile : carte avec image, nom, prix, statut, vues, commandes, menu actions (Modifier/Dupliquer/Aperçu/Publier/Supprimer).
- Recherche, filtres statut/catégorie, tris.
- Empty state motivant.
- Section "Ressources" : tutoriels, FAQ, support WhatsApp (+225 07 58 15 27 61).
- "Voir comme client" + partage WhatsApp/Facebook + copie de lien.

## Détails techniques Lot 1

### Pipeline cible (handleSaveProduct, nouveau produit)
```text
1. Validation champs requis
2. INSERT products (sans images) → product_id
3. setEditingProduct(productId)   ← anti‑duplication retry
4. Pour chaque newImages[i]:
   a. uploadProductImage(file, user.id, shop.id, product_id)
   b. INSERT product_images(product_id, image_url, is_primary=(i===0), display_order=i)
   c. Retry 1× si erreur réseau
5. Si ≥1 upload KO : toast "Texte enregistré, X image(s) non envoyées — réessayer"
6. Si OK : invalidate shopCache + toast succès + refresh local state
```

### RLS / Storage à vérifier
- `product_images` policies couvrent owner + collaborateurs `edit_shop` (migration 20260627010318 déjà appliquée).
- `shop-images` bucket : INSERT/SELECT autorisés pour path `${auth.uid()}/...`.
- Trigger `strip_base64_images` ne casse plus la description si l'éditeur n'envoie que des URLs `storage.supabase.co`.

### Fichiers Lot 1
- `src/components/shop/ProductEditor.tsx` — robustifier flux save + messages.
- `src/pages/ShopEditor.tsx` — handleSaveProduct (création produit avant upload images).
- `src/lib/shopCache.ts` — exposer `invalidate(shopSlug)`.
- `src/lib/imageCompress.ts` — déjà OK (2 Mo + 7 passes).
- Pas de migration DB nécessaire en Lot 1.

## Règle commune à tous les lots
- Ne pas supprimer de données existantes.
- Pas de changement schema sans migration explicite.
- Pas de modification des anciennes fiches qui marchent.
- Chaque lot testé via Playwright avant de passer au suivant.
