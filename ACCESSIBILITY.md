# Ecomfy Accessibility & Inclusive Design Standards

Directives d'accessibilité numérique et de réduction des mouvements pour Ecomfy.

---

## ♿ Normes Appliquées

1. **Règle Motion Reduction** :
   ```css
   @media (prefers-reduced-motion: reduce) {
     *, ::before, ::after {
       animation-duration: 0.01ms !important;
       animation-iteration-count: 1 !important;
       transition-duration: 0.01ms !important;
     }
   }
   ```
2. **Contrastes de Couleurs (WCAG AA)** :
   - Fond Slate `#0F172A` avec texte `#FFFFFF` (Ratio > 12:1 - Conforme AAA).
   - Bouton Émeraude `#10B981` avec texte blanc (Ratio > 4.5:1 - Conforme AA).
3. **Navigation Clavier** :
   - Anneaux de focus visibles (`focus-visible:ring-2 focus-visible:ring-emerald-500/50`).
   - Fermeture des modales et menus escamotables via la touche `Échap`.
