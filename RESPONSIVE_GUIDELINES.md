# Ecomfy Responsive Design Guidelines

Spécifications des principes mobile-first et des points de rupture responsive du SaaS Ecomfy.

---

## 📱 Breakpoints Supportés

| Breakpoint | Largeur | Cible | Adaptations Clés |
| :--- | :--- | :--- | :--- |
| **xs** | `320px` - `375px` | Petits Smartphones (iPhone SE) | 1 colonne, boutons pleine largeur, taille de police 16px sur inputs pour éviter le zoom iOS. |
| **sm** | `640px` | Grands Smartphones | Grille 2 colonnes pour les KPI, menus déroulants escamotables. |
| **md** | `768px` | Tablettes | Passage au layout 2 colonnes (Auth, Formulaires), affichage complet de la barre latérale. |
| **lg** | `1024px` | Ordinateurs portables | Grilles 3-4 colonnes pour les tableaux de bord et boutiques. |
| **xl** | `1280px` + | Écrans Large Desktop | Conteneurs centrés `max-w-7xl`, prévisualisation multi-écrans côte à côte dans l'éditeur. |

---

## 🚫 Règles Anti-Bugs Mobile
1. `max-width: 100vw; overflow-x: hidden;` appliqué globalement sur `html, body, #root`.
2. Bouton principal d'achat / validation sticky en bas d'écran sur smartphone.
3. Aucune action critique ne dépend uniquement du survol (`:hover`).
