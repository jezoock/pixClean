import {
  canvasToPixelBuffer,
  exportPixelBufferToPngDataUrl,
  generateCorruptedSampleSprite,
  loadBlobToCanvas,
  pixelBufferToCanvas,
} from '../adapters';
import {
  autoDetectGrid,
  clampGridGeometry,
  computeGridDimensions,
  derivePixelSizeFromTargetWidth,
  hexToRgb,
  processPixelArt,
  type PixelBuffer,
  type ProcessResult,
  type RGB,
  type SamplingMode,
} from '../engine';

type ViewMode = 'split' | 'side' | 'result';

interface RefreshableElement extends HTMLElement {
  refresh?: () => Promise<void>;
}

interface DSToasterElement extends HTMLElement {
  messages?: string | string[];
  displayToast?: () => Promise<void>;
}

interface DSToggleEventDetail {
  name?: string;
  value?: unknown;
  checked?: boolean;
}

interface AppState {
  sourceCanvas: HTMLCanvasElement | null;
  sourceData: PixelBuffer | null;
  result: ProcessResult | null;
  pixelSize: number;
  offsetX: number;
  offsetY: number;
  samplingMode: SamplingMode;
  maxColors: number;
  alphaThreshold: number;
  despeckle: boolean;
  showGrid: boolean;
  viewMode: ViewMode;
  splitRatio: number;
  exportScale: number;
  zoom: number;
  panX: number;
  panY: number;
  paletteOverrides: Map<number, RGB>;
}

export function mountApp(root: HTMLElement): void {
  const state: AppState = {
    sourceCanvas: null,
    sourceData: null,
    result: null,
    pixelSize: 8,
    offsetX: 3,
    offsetY: 2,
    samplingMode: 'mode',
    maxColors: 10,
    alphaThreshold: 128,
    despeckle: false,
    showGrid: true,
    viewMode: 'split',
    splitRatio: 0.5,
    exportScale: 4,
    zoom: 2,
    panX: 0,
    panY: 0,
    paletteOverrides: new Map(),
  };

  root.innerHTML = `
    <div class="pc-shell">
      <header class="pc-header">
        <div class="pc-brand">
          <div class="pc-brand__logo" aria-hidden="true"></div>
          <h1 class="pc-brand__title">PixelClean Studio</h1>
          <span class="pc-brand__badge">dot-stash</span>
        </div>

        <div class="pc-header-actions">
          <input id="file-input" class="pc-file-input" type="file" accept="image/png,image/jpeg,image/webp" />
          <ds-trigger id="btn-import" type="button" mods="stl-2 sm">Importer</ds-trigger>
          <ds-trigger id="btn-sample" type="button" mods="stl-3 sm">Sprite de test</ds-trigger>
          <ds-trigger id="btn-export" type="button" mods="stl-1 sm">Exporter PNG</ds-trigger>
        </div>
      </header>

      <div class="pc-workspace">
        <aside class="pc-sidebar">
          <ds-panel type="collapsible" level="2" expanded>
            <span slot="title">Grille &amp; Anti-Mixels</span>
            <div class="pc-panel-body">
              <div class="pc-panel-actions">
                <ds-trigger id="btn-autodetect" type="button" mods="stl-2 xs">Auto-détecter</ds-trigger>
              </div>

              <div class="pc-range-group">
                <div class="pc-range-label">
                  <label for="pixel-size">Taille du pixel source</label>
                  <span id="pixel-size-val" class="pc-range-label__value">8 px</span>
                </div>
                <ds-range id="range-pixel-size" labels='{"valueText": "{value} pixels"}'>
                  <input id="pixel-size" type="range" min="1" max="32" step="1" value="8" />
                </ds-range>
              </div>

              <ds-field
                id="field-target-width"
                label="Largeur cible (grille)"
                hint="Synchronisée avec la taille du pixel source."
              >
                <input id="target-width" type="number" min="4" max="512" step="1" value="28" />
                <span slot="suffix">px</span>
              </ds-field>

              <div class="pc-row-2">
                <div class="pc-range-group">
                  <div class="pc-range-label">
                    <label for="offset-x">Décalage X</label>
                    <span id="offset-x-val" class="pc-range-label__value">3 px</span>
                  </div>
                  <ds-range id="range-offset-x" labels='{"valueText": "{value} px"}'>
                    <input id="offset-x" type="range" min="0" max="31" step="1" value="3" />
                  </ds-range>
                </div>

                <div class="pc-range-group">
                  <div class="pc-range-label">
                    <label for="offset-y">Décalage Y</label>
                    <span id="offset-y-val" class="pc-range-label__value">2 px</span>
                  </div>
                  <ds-range id="range-offset-y" labels='{"valueText": "{value} px"}'>
                    <input id="offset-y" type="range" min="0" max="31" step="1" value="2" />
                  </ds-range>
                </div>
              </div>

              <ds-field
                id="field-sampling"
                label="Échantillonnage"
                hint="Majoritaire recommandé pour retirer les mixels."
              >
                <select id="sampling-mode">
                  <option value="mode" selected>Majoritaire (Mode quantifié)</option>
                  <option value="center">Centre de cellule</option>
                  <option value="median">Médiane</option>
                  <option value="average">Moyenne</option>
                </select>
              </ds-field>
            </div>
          </ds-panel>

          <ds-panel type="collapsible" level="2" expanded>
            <span slot="title">Palette &amp; Aplats</span>
            <div class="pc-panel-body">
              <div class="pc-panel-actions">
                <ds-trigger id="btn-reset-palette" type="button" mods="stl-3 xs">Réinitialiser</ds-trigger>
              </div>

              <div class="pc-range-group">
                <div class="pc-range-label">
                  <label for="max-colors">Couleurs maximum</label>
                  <span id="max-colors-val" class="pc-range-label__value">10</span>
                </div>
                <ds-range id="range-max-colors" labels='{"valueText": "{value} couleurs"}'>
                  <input id="max-colors" type="range" min="2" max="64" step="1" value="10" />
                </ds-range>
              </div>

              <div class="pc-range-group">
                <div class="pc-range-label">
                  <label for="alpha-threshold">Seuil Alpha</label>
                  <span id="alpha-threshold-val" class="pc-range-label__value">128</span>
                </div>
                <ds-range id="range-alpha" labels='{"valueText": "{value}"}'>
                  <input id="alpha-threshold" type="range" min="1" max="255" step="1" value="128" />
                </ds-range>
              </div>

              <div class="pc-toggle-row">
                <label for="despeckle">Filtre anti-pixels isolés</label>
                <ds-toggle id="despeckle" type="switch" name="despeckle"></ds-toggle>
              </div>

              <div id="palette-grid" class="pc-palette-grid" aria-label="Inspecteur de palette"></div>
            </div>
          </ds-panel>

          <ds-panel type="collapsible" level="2" expanded>
            <span slot="title">Export PNG</span>
            <div class="pc-panel-body">
              <ds-field
                id="field-export-scale"
                label="Facteur d'échelle (Nearest-Neighbor)"
                hint="Export sans flou, pixels nets."
              >
                <select id="export-scale">
                  <option value="1">1× (natif)</option>
                  <option value="2">2×</option>
                  <option value="4" selected>4×</option>
                  <option value="8">8×</option>
                  <option value="16">16×</option>
                </select>
              </ds-field>
            </div>
          </ds-panel>
        </aside>

        <main class="pc-main">
          <div class="pc-toolbar">
            <div class="pc-toolbar__group">
              <ds-trigger id="view-split" type="button" mods="stl-3 xs" class="is-active">Avant / Après</ds-trigger>
              <ds-trigger id="view-side" type="button" mods="stl-3 xs">Côte à côte</ds-trigger>
              <ds-trigger id="view-result" type="button" mods="stl-3 xs">Résultat</ds-trigger>
              <ds-trigger id="toggle-grid" type="button" mods="stl-3 xs" class="is-active">Grille</ds-trigger>
              <ds-trigger id="btn-reset-view" type="button" mods="stl-3 xs">Zoom 1:1</ds-trigger>
            </div>
            <div id="stats-label" class="pc-toolbar__stats">Aucune image</div>
          </div>

          <div id="stage" class="pc-stage">
            <canvas id="viewport"></canvas>
            <div class="pc-drop-hint">Glissez une image, importez ou collez (Ctrl+V) • Molette : zoom • Glisser : déplacer</div>
          </div>
        </main>
      </div>

      <ds-toaster id="notices" mods="success" position="bottom,right" closing-delay="4000"></ds-toaster>
    </div>
  `;

  // DOM references
  const toaster = root.querySelector<DSToasterElement>('#notices')!;
  const fileInput = root.querySelector<HTMLInputElement>('#file-input')!;
  const btnImport = root.querySelector<HTMLElement>('#btn-import')!;
  const btnSample = root.querySelector<HTMLElement>('#btn-sample')!;
  const btnExport = root.querySelector<HTMLElement>('#btn-export')!;
  const btnAutodetect = root.querySelector<HTMLElement>('#btn-autodetect')!;
  const btnResetPalette = root.querySelector<HTMLElement>('#btn-reset-palette')!;
  const btnResetView = root.querySelector<HTMLElement>('#btn-reset-view')!;

  const rangePixelSize = root.querySelector<RefreshableElement>('#range-pixel-size')!;
  const inputPixelSize = root.querySelector<HTMLInputElement>('#pixel-size')!;
  const valPixelSize = root.querySelector<HTMLElement>('#pixel-size-val')!;

  const fieldTargetWidth = root.querySelector<RefreshableElement>('#field-target-width')!;
  const inputTargetWidth = root.querySelector<HTMLInputElement>('#target-width')!;

  const rangeOffsetX = root.querySelector<RefreshableElement>('#range-offset-x')!;
  const inputOffsetX = root.querySelector<HTMLInputElement>('#offset-x')!;
  const valOffsetX = root.querySelector<HTMLElement>('#offset-x-val')!;

  const rangeOffsetY = root.querySelector<RefreshableElement>('#range-offset-y')!;
  const inputOffsetY = root.querySelector<HTMLInputElement>('#offset-y')!;
  const valOffsetY = root.querySelector<HTMLElement>('#offset-y-val')!;

  const selectSampling = root.querySelector<HTMLSelectElement>('#sampling-mode')!;

  const rangeMaxColors = root.querySelector<RefreshableElement>('#range-max-colors')!;
  const inputMaxColors = root.querySelector<HTMLInputElement>('#max-colors')!;
  const valMaxColors = root.querySelector<HTMLElement>('#max-colors-val')!;

  const rangeAlpha = root.querySelector<RefreshableElement>('#range-alpha')!;
  const inputAlpha = root.querySelector<HTMLInputElement>('#alpha-threshold')!;
  const valAlpha = root.querySelector<HTMLElement>('#alpha-threshold-val')!;

  const toggleDespeckle = root.querySelector<HTMLElement>('#despeckle')!;
  const selectExportScale = root.querySelector<HTMLSelectElement>('#export-scale')!;
  const paletteGrid = root.querySelector<HTMLElement>('#palette-grid')!;

  const viewSplitBtn = root.querySelector<HTMLElement>('#view-split')!;
  const viewSideBtn = root.querySelector<HTMLElement>('#view-side')!;
  const viewResultBtn = root.querySelector<HTMLElement>('#view-result')!;
  const toggleGridBtn = root.querySelector<HTMLElement>('#toggle-grid')!;
  const statsLabel = root.querySelector<HTMLElement>('#stats-label')!;

  const stage = root.querySelector<HTMLElement>('#stage')!;
  const viewport = root.querySelector<HTMLCanvasElement>('#viewport')!;
  const ctx = viewport.getContext('2d')!;

  // Offscreen canvas for cleaned pixel art
  const resultCanvas = document.createElement('canvas');

  function notify(message: string): void {
    toaster.messages = [message];
    void toaster.displayToast?.();
  }

  function syncControls(): void {
    const clamped = clampGridGeometry({
      pixelSize: state.pixelSize,
      offsetX: state.offsetX,
      offsetY: state.offsetY,
    });
    state.pixelSize = clamped.pixelSize;
    state.offsetX = clamped.offsetX;
    state.offsetY = clamped.offsetY;

    inputPixelSize.value = String(state.pixelSize);
    valPixelSize.textContent = `${state.pixelSize} px`;
    void rangePixelSize.refresh?.();

    const maxOffset = Math.max(0, state.pixelSize - 1);
    inputOffsetX.max = String(maxOffset);
    inputOffsetY.max = String(maxOffset);

    inputOffsetX.value = String(state.offsetX);
    valOffsetX.textContent = `${state.offsetX} px`;
    void rangeOffsetX.refresh?.();

    inputOffsetY.value = String(state.offsetY);
    valOffsetY.textContent = `${state.offsetY} px`;
    void rangeOffsetY.refresh?.();

    if (state.sourceCanvas) {
      const { gridWidth } = computeGridDimensions(
        state.sourceCanvas.width,
        state.sourceCanvas.height,
        clamped,
      );
      inputTargetWidth.value = String(gridWidth);
      void fieldTargetWidth.refresh?.();
    }

    inputMaxColors.value = String(state.maxColors);
    valMaxColors.textContent = String(state.maxColors);
    void rangeMaxColors.refresh?.();

    inputAlpha.value = String(state.alphaThreshold);
    valAlpha.textContent = String(state.alphaThreshold);
    void rangeAlpha.refresh?.();
  }

  function renderPalette(): void {
    paletteGrid.innerHTML = '';
    if (!state.result) return;

    for (const entry of state.result.palette) {
      const item = document.createElement('label');
      item.className = 'pc-swatch';
      item.title = `${entry.hex} (${entry.count} px) — cliquer pour modifier`;

      const swatch = document.createElement('span');
      swatch.className = 'pc-swatch__color';
      swatch.style.backgroundColor = entry.hex;

      const label = document.createElement('span');
      label.className = 'pc-swatch__hex';
      label.textContent = entry.hex;

      const picker = document.createElement('input');
      picker.type = 'color';
      picker.className = 'pc-swatch__picker';
      picker.value = entry.hex.toLowerCase();
      picker.addEventListener('input', () => {
        state.paletteOverrides.set(entry.index, hexToRgb(picker.value));
        recompute();
      });

      item.append(swatch, label, picker);
      paletteGrid.append(item);
    }
  }

  function recompute(): void {
    if (!state.sourceData || !state.sourceCanvas) return;

    const result = processPixelArt(state.sourceData, {
      pixelSize: state.pixelSize,
      offsetX: state.offsetX,
      offsetY: state.offsetY,
      samplingMode: state.samplingMode,
      maxColors: state.maxColors,
      alphaThreshold: state.alphaThreshold,
      despeckle: state.despeckle,
      paletteOverrides: state.paletteOverrides,
    });

    state.result = result;
    pixelBufferToCanvas(result.buffer, resultCanvas);

    statsLabel.textContent =
      `Source ${state.sourceCanvas.width}×${state.sourceCanvas.height} → ` +
      `Grille ${result.gridWidth}×${result.gridHeight} • ${result.palette.length} couleurs`;

    renderPalette();
    drawViewport();
  }

  function drawViewport(): void {
    const rect = stage.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    viewport.width = Math.max(1, Math.floor(rect.width * dpr));
    viewport.height = Math.max(1, Math.floor(rect.height * dpr));
    viewport.style.width = `${rect.width}px`;
    viewport.style.height = `${rect.height}px`;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, rect.width, rect.height);

    if (!state.sourceCanvas || !state.result) return;

    const srcW = state.sourceCanvas.width;
    const srcH = state.sourceCanvas.height;
    const drawW = srcW * state.zoom;
    const drawH = srcH * state.zoom;
    const centerX = rect.width * 0.5 + state.panX;
    const centerY = rect.height * 0.5 + state.panY;

    ctx.imageSmoothingEnabled = false;

    if (state.viewMode === 'side') {
      const gap = 24;
      const leftX = centerX - drawW - gap * 0.5;
      const rightX = centerX + gap * 0.5;
      const topY = centerY - drawH * 0.5;

      ctx.drawImage(state.sourceCanvas, leftX, topY, drawW, drawH);
      drawGridOverlay(leftX, topY, srcW, srcH);

      const cleanedW = state.result.gridWidth * state.pixelSize * state.zoom;
      const cleanedH = state.result.gridHeight * state.pixelSize * state.zoom;
      ctx.drawImage(
        resultCanvas,
        rightX + state.offsetX * state.zoom,
        topY + state.offsetY * state.zoom,
        cleanedW,
        cleanedH,
      );
      return;
    }

    const ox = centerX - drawW * 0.5;
    const oy = centerY - drawH * 0.5;
    const cleanedX = ox + state.offsetX * state.zoom;
    const cleanedY = oy + state.offsetY * state.zoom;
    const cleanedW = state.result.gridWidth * state.pixelSize * state.zoom;
    const cleanedH = state.result.gridHeight * state.pixelSize * state.zoom;

    if (state.viewMode === 'result') {
      ctx.drawImage(resultCanvas, cleanedX, cleanedY, cleanedW, cleanedH);
      return;
    }

    // Split curtain view (Before / After)
    const splitX = ox + drawW * state.splitRatio;

    ctx.save();
    ctx.beginPath();
    ctx.rect(ox, oy, splitX - ox, drawH);
    ctx.clip();
    ctx.drawImage(state.sourceCanvas, ox, oy, drawW, drawH);
    drawGridOverlay(ox, oy, srcW, srcH);
    ctx.restore();

    ctx.save();
    ctx.beginPath();
    ctx.rect(splitX, oy, ox + drawW - splitX, drawH);
    ctx.clip();
    ctx.drawImage(resultCanvas, cleanedX, cleanedY, cleanedW, cleanedH);
    ctx.restore();

    ctx.save();
    ctx.strokeStyle = '#6c8cff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(splitX, oy - 8);
    ctx.lineTo(splitX, oy + drawH + 8);
    ctx.stroke();

    ctx.fillStyle = '#6c8cff';
    ctx.beginPath();
    ctx.arc(splitX, oy + drawH * 0.5, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#0b0e17';
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('↔', splitX, oy + drawH * 0.5);
    ctx.restore();
  }

  function drawGridOverlay(originX: number, originY: number, srcW: number, srcH: number): void {
    if (!state.showGrid || state.pixelSize * state.zoom < 4) return;
    ctx.save();
    ctx.strokeStyle = 'rgba(108, 140, 255, 0.35)';
    ctx.lineWidth = 1;
    const step = state.pixelSize * state.zoom;
    const startX = originX + state.offsetX * state.zoom;
    const startY = originY + state.offsetY * state.zoom;
    const endX = originX + srcW * state.zoom;
    const endY = originY + srcH * state.zoom;

    ctx.beginPath();
    for (let x = startX; x <= endX + 0.5; x += step) {
      ctx.moveTo(x, startY);
      ctx.lineTo(x, endY);
    }
    for (let y = startY; y <= endY + 0.5; y += step) {
      ctx.moveTo(startX, y);
      ctx.lineTo(endX, y);
    }
    ctx.stroke();
    ctx.restore();
  }

  function loadCanvas(canvas: HTMLCanvasElement, autoRun = true, announce = false): void {
    state.sourceCanvas = canvas;
    state.sourceData = canvasToPixelBuffer(canvas);
    state.paletteOverrides.clear();

    if (autoRun) {
      const detected = autoDetectGrid(state.sourceData);
      state.pixelSize = detected.pixelSize;
      state.offsetX = detected.offsetX;
      state.offsetY = detected.offsetY;
    }

    const rect = stage.getBoundingClientRect();
    const fitScale = Math.min((rect.width - 80) / canvas.width, (rect.height - 80) / canvas.height);
    state.zoom = Math.max(0.5, Math.min(6, Math.round(fitScale * 2) / 2 || 2));
    state.panX = 0;
    state.panY = 0;

    syncControls();
    recompute();

    if (announce) {
      notify(`Image chargée (${canvas.width}×${canvas.height} px)`);
    }
  }

  function loadImageFile(file: File): void {
    void loadBlobToCanvas(file).then((canvas) => {
      loadCanvas(canvas, true, true);
    });
  }

  // Garde sur disabled conforme au contrat d'accessibilité de ds-trigger
  function onTriggerClick(el: HTMLElement, handler: () => void): void {
    el.addEventListener('click', () => {
      if (el.hasAttribute('disabled')) return;
      handler();
    });
  }

  // Controls events
  onTriggerClick(btnImport, () => fileInput.click());
  fileInput.addEventListener('change', () => {
    const file = fileInput.files?.[0];
    if (file) loadImageFile(file);
    fileInput.value = '';
  });

  onTriggerClick(btnSample, () => loadCanvas(generateCorruptedSampleSprite(), true, true));

  onTriggerClick(btnAutodetect, () => {
    if (!state.sourceData) return;
    const detected = autoDetectGrid(state.sourceData);
    state.pixelSize = detected.pixelSize;
    state.offsetX = detected.offsetX;
    state.offsetY = detected.offsetY;
    state.paletteOverrides.clear();
    syncControls();
    recompute();
    notify(`Grille détectée : ${detected.pixelSize} px (décalage ${detected.offsetX}, ${detected.offsetY})`);
  });

  onTriggerClick(btnResetPalette, () => {
    state.paletteOverrides.clear();
    recompute();
    notify('Palette réinitialisée');
  });

  onTriggerClick(btnExport, () => {
    if (!state.result) return;
    const scale = state.exportScale;
    const { dataUrl, width, height } = exportPixelBufferToPngDataUrl(state.result.buffer, scale);

    const a = document.createElement('a');
    a.download = `pixelclean-${state.result.gridWidth}x${state.result.gridHeight}-${scale}x.png`;
    a.href = dataUrl;
    a.click();
    notify(`PNG exporté en ${width}×${height} (${scale}×)`);
  });

  inputPixelSize.addEventListener('input', () => {
    state.pixelSize = Number(inputPixelSize.value);
    state.paletteOverrides.clear();
    syncControls();
    recompute();
  });

  inputTargetWidth.addEventListener('change', () => {
    if (!state.sourceCanvas) return;
    const w = Math.max(4, Number(inputTargetWidth.value) || 16);
    state.pixelSize = derivePixelSizeFromTargetWidth(
      state.sourceCanvas.width,
      state.offsetX,
      w,
      1,
      32,
    );
    state.paletteOverrides.clear();
    syncControls();
    recompute();
  });

  inputOffsetX.addEventListener('input', () => {
    state.offsetX = Number(inputOffsetX.value);
    valOffsetX.textContent = `${state.offsetX} px`;
    recompute();
  });

  inputOffsetY.addEventListener('input', () => {
    state.offsetY = Number(inputOffsetY.value);
    valOffsetY.textContent = `${state.offsetY} px`;
    recompute();
  });

  selectSampling.addEventListener('change', () => {
    state.samplingMode = selectSampling.value as SamplingMode;
    recompute();
  });

  inputMaxColors.addEventListener('input', () => {
    state.maxColors = Number(inputMaxColors.value);
    valMaxColors.textContent = String(state.maxColors);
    state.paletteOverrides.clear();
    recompute();
  });

  inputAlpha.addEventListener('input', () => {
    state.alphaThreshold = Number(inputAlpha.value);
    valAlpha.textContent = String(state.alphaThreshold);
    recompute();
  });

  toggleDespeckle.addEventListener('toggle', (e: Event) => {
    const detail = (e as CustomEvent<DSToggleEventDetail>).detail;
    state.despeckle = Boolean(detail?.checked);
    recompute();
  });

  selectExportScale.addEventListener('change', () => {
    state.exportScale = Number(selectExportScale.value);
  });

  const setViewMode = (mode: ViewMode) => {
    state.viewMode = mode;
    viewSplitBtn.classList.toggle('is-active', mode === 'split');
    viewSideBtn.classList.toggle('is-active', mode === 'side');
    viewResultBtn.classList.toggle('is-active', mode === 'result');
    drawViewport();
  };

  onTriggerClick(viewSplitBtn, () => setViewMode('split'));
  onTriggerClick(viewSideBtn, () => setViewMode('side'));
  onTriggerClick(viewResultBtn, () => setViewMode('result'));

  onTriggerClick(toggleGridBtn, () => {
    state.showGrid = !state.showGrid;
    toggleGridBtn.classList.toggle('is-active', state.showGrid);
    drawViewport();
  });

  onTriggerClick(btnResetView, () => {
    state.zoom = 2;
    state.panX = 0;
    state.panY = 0;
    drawViewport();
  });

  // Pointer interactions (curtain drag + pan + wheel zoom)
  let draggingCurtain = false;
  let panning = false;
  let lastX = 0;
  let lastY = 0;

  stage.addEventListener('pointerdown', (e) => {
    if (!state.sourceCanvas) return;
    const rect = stage.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const drawW = state.sourceCanvas.width * state.zoom;
    const ox = rect.width * 0.5 + state.panX - drawW * 0.5;
    const splitX = ox + drawW * state.splitRatio;

    if (state.viewMode === 'split' && Math.abs(mx - splitX) < 16) {
      draggingCurtain = true;
    } else {
      panning = true;
      stage.classList.add('is-panning');
    }
    lastX = e.clientX;
    lastY = e.clientY;
    stage.setPointerCapture(e.pointerId);
  });

  stage.addEventListener('pointermove', (e) => {
    if (!state.sourceCanvas) return;
    if (draggingCurtain) {
      const rect = stage.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const drawW = state.sourceCanvas.width * state.zoom;
      const ox = rect.width * 0.5 + state.panX - drawW * 0.5;
      state.splitRatio = Math.max(0, Math.min(1, (mx - ox) / drawW));
      drawViewport();
    } else if (panning) {
      state.panX += e.clientX - lastX;
      state.panY += e.clientY - lastY;
      lastX = e.clientX;
      lastY = e.clientY;
      drawViewport();
    }
  });

  const endDrag = () => {
    draggingCurtain = false;
    panning = false;
    stage.classList.remove('is-panning');
  };
  stage.addEventListener('pointerup', endDrag);
  stage.addEventListener('pointercancel', endDrag);

  stage.addEventListener(
    'wheel',
    (e) => {
      e.preventDefault();
      const factor = e.deltaY < 0 ? 1.15 : 1 / 1.15;
      state.zoom = Math.max(0.25, Math.min(20, state.zoom * factor));
      drawViewport();
    },
    { passive: false },
  );

  // Drag & Drop + Paste
  stage.addEventListener('dragover', (e) => {
    e.preventDefault();
    stage.classList.add('is-dragover');
  });
  stage.addEventListener('dragleave', () => stage.classList.remove('is-dragover'));
  stage.addEventListener('drop', (e) => {
    e.preventDefault();
    stage.classList.remove('is-dragover');
    const file = e.dataTransfer?.files?.[0];
    if (file && file.type.startsWith('image/')) loadImageFile(file);
  });

  window.addEventListener('paste', (e) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (const item of items) {
      if (item.type.startsWith('image/')) {
        const file = item.getAsFile();
        if (file) loadImageFile(file);
        break;
      }
    }
  });

  window.addEventListener('resize', drawViewport);

  // Boot with sample sprite
  requestAnimationFrame(() => {
    loadCanvas(generateCorruptedSampleSprite(), true, false);
  });
}
