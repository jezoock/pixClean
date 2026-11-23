# PixelClean Studio (`dot-stash`)

Application web pour nettoyer les **mixels** et supprimer les **dégradés subtils** d'images pixel art générées par IA, construite avec **Vite + TypeScript + SCSS** et la bibliothèque de Web Components light-DOM **`dot-stash`**.

## Installation

### Option 1 : depuis un clone local de `dot-stash` (recommandé en dev)

1. Compilez d'abord `dot-stash` dans son dossier (ex. `../dot-stash`) :
   ```bash
   cd ../dot-stash
   npm install
   npm run build:all
   ```
2. Dans ce projet, pointez la dépendance vers votre dossier local :
   ```bash
   npm install ../dot-stash
   npm run dev
   ```

### Option 2 : depuis npm ou GitHub

```bash
npm install
# ou depuis GitHub :
# npm install github:jezoock/dot-stash
npm run dev
```

## Composants `dot-stash` utilisés

- **`ds-panel`** (`type="collapsible"`, `expanded`, `level="2"`) : sections repliables de la barre latérale (*Grille & Anti-Mixels*, *Palette & Aplats*, *Export PNG*).
- **`ds-range`** : curseurs de taille de pixel, décalage X/Y, nombre max de couleurs et seuil alpha (avec appels à `refresh()` lors des mises à jour programmatiques).
- **`ds-field`** : champs de formulaire avec label, aide et suffixe (`Largeur cible`, `Échantillonnage`, `Échelle d'export`).
- **`ds-toggle`** (`type="switch"`) : interrupteur accessible pour le filtre anti-pixels isolés (événement `toggle`).
- **`ds-trigger`** : boutons d'action (`type="button"`, modificateurs `stl-1`, `stl-2`, `stl-3`, `xs`, `sm`).
- **`ds-toaster`** (`position="bottom,right"`, `closing-delay="4000"`) : notifications non intrusives (auto-détection, import, réinitialisation, export PNG).
- **Thème par défaut** : `dot-stash/dist/css/default.css` surchargé via les variables CSS custom (`--ds-panel-*`, `--ds-range-*`, `--ds-field-*`, `--ds-toggle-*`, `--ds-trigger-*`, `--ds-toaster-*`) dans `src/styles/main.scss`.
