# PixelClean Studio (`dot-stash`)

Application web et bibliothèque embarquable pour nettoyer les **mixels** et supprimer les **dégradés subtils** d'images pixel art générées par IA.

- **Moteur d'image isolé (`src/engine/` / `pixclean/engine`)** : pur TypeScript, zéro dépendance DOM, exécutable dans un navigateur, un Web Worker ou Node.js.
- **Interface 100 % `dot-stash` (`src/ui/` / `pixclean`)** : Web Components light-DOM `ds-*` + moteur SCSS `dot-stash/scss/engine`, encapsulés dans un contrôleur embarquable dans une application hôte de gestion d'assets.

---

## Installation & Commandes

`dot-stash` est déclaré via l'archive de release GitHub `v0.2.0` (`dot-stash-0.2.0.tgz`) et autorisé au niveau racine via `.npmrc` (`allow-remote=root`) :

```bash
npm install
npm run dev
```

- `npm run dev` : serveur de développement Vite (mode standalone)
- `npm test` : tests unitaires du moteur algorithmique (`tests/engine/`, via `node --test`, sans dépendance DOM)
- `npm run typecheck` : vérification TypeScript de l'application (`src/`)
- `npm run typecheck:tests` : vérification TypeScript des tests (`tests/`)
- `npm run build` : build de production de l'application standalone (`dist/`)
- `npm run build:lib` : build de la bibliothèque multi-entrées (`dist-lib/index.js`, `dist-lib/engine.js`, `dist-lib/pixclean.css` et déclarations `.d.ts`)

### Publier & consommer une release `.tgz` (ex. dans `pixClean-desktop` ou un gestionnaire d'assets)

La création d'un tag `v<version>` correspondant à `package.json` déclenche `.github/workflows/release.yml`, qui compile, teste et attache `pixclean-<version>.tgz` à la GitHub Release.

Une application hôte peut ensuite installer `pixclean` (et `dot-stash` en `peerDependency` pour le mode UI) directement dans son `package.json` (avec `allow-remote=root` dans son `.npmrc`) :

```json
{
  "dependencies": {
    "dot-stash": "https://github.com/jezoock/dot-stash/releases/download/v0.2.0/dot-stash-0.2.0.tgz",
    "pixclean": "https://github.com/jezoock/pixClean/releases/download/v1.0.0/pixclean-1.0.0.tgz"
  }
}
```

---

## Intégration dans une application de gestion d'assets

### 1. Intégration du widget complet (`pixclean`)

```ts
import 'dot-stash/dist/css/default.css';
import 'pixclean/style.css';
import { createPixelCleanEditor, definePixelCleanElements } from 'pixclean';

// Enregistre les Web Components dot-stash si l'application hôte ne l'a pas déjà fait
definePixelCleanElements(window);

const container = document.querySelector<HTMLElement>('#asset-editor-host')!;

const editor = createPixelCleanEditor(container, {
  initialAsset: assetBlobOrUrl, // Blob | File | URL | ImageData | PixelBuffer | HTMLCanvasElement | HTMLImageElement
  assetName: 'hero-idle.png',
  exportScale: 1, // 1× natif recommandé pour stocker l'asset pixel art dans le gestionnaire
  showSampleButton: false,
  onApply: async ({ blob, imageData, result, options, width, height, filename }) => {
    await saveCleanedAsset({
      blob,
      width,
      height,
      filename,
      palette: result.palette,
      processingOptions: options,
    });
  },
  onCancel: () => {
    closeAssetEditorModal();
  },
  onChange: (result) => {
    console.log(`Grille ${result.gridWidth}×${result.gridHeight}, ${result.palette.length} couleurs`);
  },
});

// Chargement dynamique d'un autre asset sélectionné dans la bibliothèque :
// await editor.loadAsset(nextAssetBlob, { assetName: 'potion.png', autoDetect: true });

// Nettoyage complet lors du démontage (listeners, ResizeObserver, DOM) :
// editor.destroy();
```

### 2. Utilisation Headless du moteur uniquement (`pixclean/engine`)

Idéal pour le traitement en lot (batch), un Web Worker ou un script Node.js — aucun code UI ni DOM n'est embarqué :

```ts
import {
  autoDetectGrid,
  createPixelBuffer,
  DEFAULT_PROCESS_OPTIONS,
  processPixelArt,
  scaleNearestNeighbor,
} from 'pixclean/engine';

const source = createPixelBuffer(width, height, rgbaUint8ClampedArray);
const grid = autoDetectGrid(source);

const cleaned = processPixelArt(source, {
  ...DEFAULT_PROCESS_OPTIONS,
  ...grid,
  maxColors: 12,
  despeckle: true,
});

const upscaled = scaleNearestNeighbor(cleaned.buffer, 2);
```

---

## Architecture du projet

```text
src/
  engine/           Algorithmes purs (zéro DOM) : types, color, grid-detect, sampler, quantize, filters, scaler, pipeline
  adapters/         Pont navigateur / Canvas : conversion PixelBuffer <-> ImageData / Canvas / Blob / URL + sample-sprite
  ui/               Contrôleur embarquable (pixelclean-editor.ts), templates light-DOM dot-stash et types ds-*
  styles/           Thème sombre modulaire basé sur @use 'dot-stash/scss/engine' as ds
  index.ts          Point d'entrée bibliothèque (widget + adaptateurs + moteur)
  main.ts           Point d'entrée application standalone
tests/
  engine/           26 tests unitaires natifs Node (node:test) couvrant chaque module du moteur
```

## Composants `dot-stash` utilisés

- **Structure & Layout** : `ds-title-bar`, `ds-title`, `ds-block`, `ds-grid`, `ds-grid-item`, `ds-rsp`
- **Panneaux & Formulaires** : `ds-panel-group`, `ds-panel`, `ds-field`, `ds-select`, `ds-range`, `ds-toggle-group`, `ds-toggle` (`switch` & `icon`), `ds-trigger`
- **Feedback & Inspecteur** : `ds-icon`, `ds-tooltip`, `ds-badge`, `ds-text`, `ds-scroller`, `ds-thumb`, `ds-alert`, `ds-loader`, `ds-modal`, `ds-toaster`
- **Moteur SCSS** : `dot-stash/scss/engine` (`ds.ds-spacing()`, `ds.ds-radius()`, `@include ds.break-p()`) + surcharges des custom properties `--ds-*` sur chaque élément.
