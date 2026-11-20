# PixelClean Studio (`dot-stash`)

Application web pour nettoyer les **mixels** et supprimer les **dégradés subtils** d'images pixel art générées par IA, construite avec **Vite + TypeScript + SCSS** et la bibliothèque de Web Components light-DOM **`dot-stash`**.

## Installation

`dot-stash` est directement installé depuis l'archive de release GitHub `v0.2.0` (`dot-stash-0.2.0.tgz`) déclarée dans `package.json` :

```bash
npm install
npm run dev
```

Pour développer contre un clone local de `dot-stash` (ex. `../dot-stash`), compilez-le d'abord (`npm run build:all`) puis pointez la dépendance vers le dossier local (`npm install ../dot-stash`).

## Commandes

- `npm run dev` : serveur de développement Vite
- `npm test` : tests unitaires du moteur algorithmique (`src/engine/`, via `node --test`, sans dépendance DOM)
- `npm run typecheck` : vérification TypeScript de l'application (`src/`)
- `npm run typecheck:tests` : vérification TypeScript des tests (`tests/`)
- `npm run build` : vérification TypeScript + build de production Vite

## Composants `dot-stash` utilisés

- **`ds-panel`** (`type="collapsible"`, `expanded`, `level="2"`) : sections repliables de la barre latérale (*Grille & Anti-Mixels*, *Palette & Aplats*, *Export PNG*).
- **`ds-range`** : curseurs de taille de pixel, décalage X/Y, nombre max de couleurs et seuil alpha (avec appels à `refresh()` lors des mises à jour programmatiques).
- **`ds-field`** : champs de formulaire avec label, aide et suffixe (`Largeur cible`, `Échantillonnage`, `Échelle d'export`).
- **`ds-toggle`** (`type="switch"`) : interrupteur accessible pour le filtre anti-pixels isolés (événement `toggle`).
- **`ds-trigger`** : boutons d'action (`type="button"`, modificateurs `stl-1`, `stl-2`, `stl-3`, `xs`, `sm`).
- **`ds-toaster`** (`position="bottom,right"`, `closing-delay="4000"`) : notifications non intrusives (auto-détection, import, réinitialisation, export PNG).
- **Thème par défaut** : `dot-stash/dist/css/default.css` surchargé via les variables CSS custom (`--ds-panel-*`, `--ds-range-*`, `--ds-field-*`, `--ds-toggle-*`, `--ds-trigger-*`, `--ds-toaster-*`) dans `src/styles/main.scss`.
