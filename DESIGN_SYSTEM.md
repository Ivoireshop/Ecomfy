# Ecomfy Design System & UI Specifications (V5)

Ce document centralise les règles de la charte graphique, de l'ergonomie responsive et des composants UI du SaaS **Ecomfy**.

---

## 🎨 Palette de Couleurs Officielle

| Rôle | Nom / Usage | Hex / HSL | Application CSS |
| :--- | :--- | :--- | :--- |
| **Primaire** | Slate Obsidian (Sombre, institutionnel) | `#0F172A` (`hsl(222, 47%, 11%)`) | Headings, Navbar, Boutons par défaut |
| **Accent / CTA** | Émeraude Luxueuse (Conversion, confiance) | `#10B981` (`hsl(160, 84%, 39%)`) | Boutons d'achat, KPI, Badges actifs |
| **Secondaire** | Electric Azure (Lueur & Focus) | `#0284C7` (`hsl(199, 89%, 48%)`) | Subtilités, graphiques |
| **Fond Clair** | Soft Warm Neutral | `#FAFAFA` (`hsl(0, 0%, 99%)`) | Arrière-plan global mode clair |
| **Fond Sombre** | Obsidian Dark | `#0B0F17` (`hsl(222, 47%, 7%)`) | Arrière-plan global mode sombre |

---

## 📐 Typographie & Hiérarchie

- **Famille de police** : `Poppins, sans-serif` (Google Fonts).
- **H1 (Grand titre Hero)** : `2.25rem` (36px) mobile / `3.75rem` (60px) desktop, `font-weight: 800`, `line-height: 1.15`.
- **H2 (Titre de section)** : `1.75rem` (28px) mobile / `2.5rem` (40px) desktop, `font-weight: 700`, `line-height: 1.2`.
- **H3 (Titre de carte / KPI)** : `1.25rem` (20px) mobile / `1.5rem` (24px) desktop, `font-weight: 600`.
- **Corps de texte (Body)** : `1rem` (16px) minimum sur mobile, `line-height: 1.6`.

---

## ⚡ Système de Mouvement & Durées

```css
:root {
  --motion-fast: 160ms;
  --motion-normal: 240ms;
  --motion-slow: 400ms;
  --ease-standard: cubic-bezier(0.2, 0, 0, 1);
  --ease-bounce: cubic-bezier(0.34, 1.56, 0.64, 1);
}
```

- **`.btn-interactive`** : Survol `translateY(-2px) scale(1.02)`, Clic `scale(0.97)`.
- **`.card-interactive`** : Survol `translateY(-4px)` avec ombre et lueur de bordure émeraude.
- **`.shake-error`** : Secousse horizontale 400ms sur erreur de saisie.
- **`.ai-pulse-glow`** : Aura lumineuse clignotante discrète pendant les traitements d'intelligence artificielle.
