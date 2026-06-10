## Objectifs

Le générateur de visuels et l'éditeur de texte sur image ne sont pas utilisables sur mobile. Le backend accumule aussi les images générées sans limite. On corrige les 4 zones suivantes en une seule passe.

---

## 1. Page Générateur (`/generator`) — mobile-first

Fichier : `src/pages/Generator.tsx` (1893 lignes — on retravaille uniquement la couche présentation, la logique reste).

Problèmes constatés :
- Le sélecteur Image / Vidéo / Pro / Avancé affiche déjà des champs avant qu'on ait choisi → l'écran déborde sur téléphone.
- Boutons trop larges, padding excessif, formulaire vertical infini.
- Zoom-out donne le même rendu cassé.

Changements :
- **Sélecteur de mode en haut, sticky** : 4 tuiles compactes (Image / Vidéo / Pro / Avancé) en grille 2×2 sur mobile, ligne sur desktop. **Aucun champ visible** tant qu'aucun mode n'est sélectionné — juste une carte d'introduction.
- Une fois un mode choisi : le formulaire s'affiche dans une carte plein-largeur, padding réduit (`p-3` mobile / `p-6` desktop), inputs en `h-11` (touch-friendly), labels condensés.
- Bouton "Générer" sticky en bas sur mobile (barre fixe avec safe-area).
- Bouton retour discret en haut-gauche pour changer de mode sans recharger.
- Compteur de crédits sticky en haut-droit, compact.

## 2. Éditeur de texte sur image

Fichier : `src/components/ImageTextEditor.tsx` (687 lignes).

Problème : texte ajouté apparaît minuscule, poignées de redimensionnement non utilisables au doigt, clavier mobile masque la zone.

Changements :
- **Taille par défaut** : `fontSize` initial = `Math.round(imageHeight * 0.08)` (≈ 8 % de la hauteur), `font-weight: 800`, ombre portée pour lisibilité.
- **Poignées tactiles** : passer les handles à 44 × 44 px minimum (norme Apple HIG), avec hit-area transparente élargie.
- **Clavier mobile** : quand un champ texte reçoit le focus, scroller la zone d'édition au-dessus du clavier (`scrollIntoView({ block: 'center' })`).
- Barre d'outils (couleur, taille, gras, alignement) en bas, sticky, scrollable horizontalement sur mobile.
- Bouton "Terminer" sticky en haut-droit (corporate).

## 3. Galerie / Bibliothèque

Fichier : `src/pages/Library.tsx`.

Changements :
- Grille 2 colonnes sur mobile (au lieu de 1), 3 sur tablette, 4 sur desktop.
- Vignettes carrées avec `aspect-square`, action (télécharger / supprimer) en overlay tap.
- Header sticky avec filtres en chips horizontaux scrollables.

## 4. Nettoyage automatique backend (30 jours)

Tables visées : `generated_images`, `generated_videos`.

- Migration SQL : fonction `cleanup_old_generated_media()` qui supprime les lignes `created_at < now() - interval '30 days'` (et les objets storage associés).
- Cron `pg_cron` quotidien à 03:00 UTC.
- Bandeau informatif dans la bibliothèque : *« Les visuels sont conservés 30 jours. Téléchargez ceux que vous voulez garder. »*

---

## Détails techniques

- Tokens design existants (`--primary`, `--background`, `--card`, etc.) — pas de couleurs en dur.
- Pas d'icônes IA (étoiles/baguettes) — respect mémoire `aesthetic-preference`.
- Bouton primaire en haut-droit, secondaire en haut-gauche — respect mémoire `ui-layout-constraints`.
- Aucune modification de la logique de génération, de l'API IA, ou du système de crédits.
- Cron via `supabase--insert` (pas migration) car contient URL + clé anon.

## Hors scope (à demander explicitement)

- Refonte du composant `AdvancedImageGenerator` (661 lignes) — uniquement adapté visuellement, pas refondu.
- Voix off, son — non touché.
- Page boutique / autres sections — non touchées.
