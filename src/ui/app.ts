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

import {
  type DSAlertElement,
  type DSBadgeElement,
  type DSModalElement,
  type DSSelectElement,
  type DSSelectValueChangeDetail,
  type DSThumbElement,
  type DSToasterElement,
  type DSToggleEventDetail,
  type DSToggleGroupEventDetail,
  type RefreshableElement,
} from './ds-types';
import { renderAppShellTemplate } from './templates';

type ViewMode = 'split' | 'side' | 'result';

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

  root.innerHTML = renderAppShellTemplate();

  // DOM references — Header & Notifications
  const toaster = root.querySelector<DSToasterElement>('#notices')!;
  const fileInput = root.querySelector<HTMLInputElement>('#file-input')!;
  const btnImport = root.querySelector<HTMLElement>('#btn-import')!;
  const btnSample = root.querySelector<HTMLElement>('#btn-sample')!;
  const btnExport = root.querySelector<HTMLElement>('#btn-export')!;
  const btnQuickExport = root.querySelector<HTMLElement>('#btn-quick-export')!;
  const btnAutodetect = root.querySelector<HTMLElement>('#btn-autodetect')!;
  const btnResetPalette = root.querySelector<HTMLElement>('#btn-reset-palette')!;
  const btnResetView = root.querySelector<HTMLElement>('#btn-reset-view')!;

  // Sidebar controls
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

  const selectSampling = root.querySelector<DSSelectElement>('#select-sampling-mode')!;

  const rangeMaxColors = root.querySelector<RefreshableElement>('#range-max-colors')!;
  const inputMaxColors = root.querySelector<HTMLInputElement>('#max-colors')!;
  const valMaxColors = root.querySelector<HTMLElement>('#max-colors-val')!;

  const rangeAlpha = root.querySelector<RefreshableElement>('#range-alpha')!;
  const inputAlpha = root.querySelector<HTMLInputElement>('#alpha-threshold')!;
  const valAlpha = root.querySelector<HTMLElement>('#alpha-threshold-val')!;

  const toggleDespeckle = root.querySelector<HTMLElement>('#despeckle')!;
  const selectExportScale = root.querySelector<DSSelectElement>('#select-export-scale')!;

  // Palette & mini preview
  const paletteCountBadge = root.querySelector<DSBadgeElement>('#palette-count-badge')!;
  const paletteScroller = root.querySelector<RefreshableElement>('#palette-scroller')!;
  const paletteGrid = root.querySelector<HTMLElement>('#palette-grid')!;
  const sidebarResultThumb = root.querySelector<DSThumbElement>('#sidebar-result-thumb')!;
  const sidebarExportDims = root.querySelector<HTMLElement>('#sidebar-export-dims')!;

  // Viewport toolbar & stage
  const viewModeGroup = root.querySelector<HTMLElement>('#view-mode-group')!;
  const toggleGrid = root.querySelector<HTMLElement>('#toggle-grid')!;
  const processingLoader = root.querySelector<HTMLElement>('#processing-loader')!;
  const statSource = root.querySelector<HTMLElement>('#stat-source')!;
  const statGrid = root.querySelector<HTMLElement>('#stat-grid')!;
  const statColors = root.querySelector<HTMLElement>('#stat-colors')!;
  const statZoom = root.querySelector<HTMLElement>('#stat-zoom')!;
  const stageAlert = root.querySelector<DSAlertElement>('#stage-alert')!;

  const stage = root.querySelector<HTMLElement>('#stage')!;
  const viewport = root.querySelector<HTMLCanvasElement>('#viewport')!;
  const ctx = viewport.getContext('2d')!;

  // Export modal
  const exportModal = root.querySelector<DSModalElement>('#export-modal')!;
  const exportPreviewThumb = root.querySelector<DSThumbElement>('#export-preview-thumb')!;
  const modalBadgeGrid = root.querySelector<HTMLElement>('#modal-badge-grid')!;
  const modalBadgeOutput = root.querySelector<HTMLElement>('#modal-badge-output')!;
  const modalBadgeColors = root.querySelector<HTMLElement>('#modal-badge-colors')!;
  const inputExportFilename = root.querySelector<HTMLInputElement>('#export-filename')!;
  const selectModalExportScale = root.querySelector<DSSelectElement>('#select-modal-export-scale')!;
  const btnModalCancel = root.querySelector<HTMLElement>('#btn-modal-cancel')!;
  const btnModalDownload = root.querySelector<HTMLElement>('#btn-modal-download')!;

  // Offscreen canvas for cleaned pixel art
  const resultCanvas = document.createElement('canvas');

  function notify(message: string): void {
    toaster.messages = [message];
    void toaster.displayToast?.();
  }

  function defaultExportFilename(result: ProcessResult, scale: number): string {
    return `pixelclean-${result.gridWidth}x${result.gridHeight}-${scale}x.png`;
  }

  function syncExportScaleSelect(selectHost: DSSelectElement, scale: number): void {
    const nativeSelect = selectHost.querySelector<HTMLSelectElement>('select');
    if (nativeSelect && nativeSelect.value !== String(scale)) {
      nativeSelect.value = String(scale);
      const labelEl = selectHost.querySelector<HTMLElement>('.ds-select__label');
      const opt = nativeSelect.selectedOptions[0];
      if (labelEl && opt) {
        labelEl.textContent = opt.textContent;
      }
    }
  }

  function updateExportMetadata(): void {
    if (!state.result) return;
    const scale = state.exportScale;
    const outW = state.result.gridWidth * scale;
    const outH = state.result.gridHeight * scale;

    sidebarExportDims.textContent = `${outW}×${outH} px (${scale}×)`;
    modalBadgeGrid.textContent = `Grille ${state.result.gridWidth}×${state.result.gridHeight}`;
    modalBadgeOutput.textContent = `Sortie ${outW}×${outH} px`;
    modalBadgeColors.textContent = `${state.result.palette.length} couleurs`;
    inputExportFilename.value = defaultExportFilename(state.result, scale);
  }

  function triggerPngDownload(filename?: string): void {
    if (!state.result) return;
    const scale = state.exportScale;
    const { dataUrl, width, height } = exportPixelBufferToPngDataUrl(state.result.buffer, scale);
    const resolvedName = (filename?.trim() || defaultExportFilename(state.result, scale)).replace(
      /(?<!\.png)$/i,
      '.png',
    );

    const a = document.createElement('a');
    a.download = resolvedName;
    a.href = dataUrl;
    a.click();
    notify(`PNG exporté : ${resolvedName} (${width}×${height})`);
  }

  function openExportModal(): void {
    if (!state.result) return;
    const previewScale = Math.max(1, Math.min(8, Math.ceil(192 / Math.max(state.result.gridWidth, state.result.gridHeight))));
    const { dataUrl } = exportPixelBufferToPngDataUrl(state.result.buffer, previewScale);
    exportPreviewThumb.src = dataUrl;
    syncExportScaleSelect(selectModalExportScale, state.exportScale);
    updateExportMetadata();
    exportModal.shown = true;
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

    const totalOpaque = state.result.palette.reduce((acc, entry) => acc + entry.count, 0) || 1;
    paletteCountBadge.count = state.result.palette.length;

    for (const entry of state.result.palette) {
      const pct = ((entry.count / totalOpaque) * 100).toFixed(1);
      const tooltip = document.createElement('ds-tooltip');
      tooltip.setAttribute('position', 'top');
      tooltip.setAttribute('container-selector', '.pc-sidebar');

      const item = document.createElement('label');
      item.className = 'pc-swatch';

      const swatch = document.createElement('span');
      swatch.className = 'pc-swatch__color';
      swatch.style.backgroundColor = entry.hex;

      const label = document.createElement('span');
      label.className = 'pc-swatch__hex';
      label.textContent = entry.hex;

      const countBadge = document.createElement('ds-badge');
      countBadge.className = 'pc-swatch__count';
      countBadge.textContent = String(entry.count);

      const picker = document.createElement('input');
      picker.type = 'color';
      picker.className = 'pc-swatch__picker';
      picker.setAttribute('aria-label', `Modifier la couleur ${entry.hex}`);
      picker.value = entry.hex.toLowerCase();
      picker.addEventListener('input', () => {
        state.paletteOverrides.set(entry.index, hexToRgb(picker.value));
        recompute();
      });

      const msg = document.createElement('span');
      msg.slot = 'message';
      msg.textContent = `${entry.hex} • RGB(${entry.rgb.join(', ')}) • ${entry.count} px (${pct}%) — cliquer pour modifier`;

      item.append(swatch, label, countBadge, picker);
      tooltip.append(item, msg);
      paletteGrid.append(tooltip);
    }

    void paletteScroller.refresh?.();
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

    statSource.textContent = `Source ${state.sourceCanvas.width}×${state.sourceCanvas.height}`;
    statGrid.textContent = `Grille ${result.gridWidth}×${result.gridHeight}`;
    statColors.textContent = `${result.palette.length} couleurs`;

    const thumbScale = Math.max(1, Math.min(6, Math.ceil(96 / Math.max(result.gridWidth, result.gridHeight))));
    sidebarResultThumb.src = exportPixelBufferToPngDataUrl(result.buffer, thumbScale).dataUrl;
    updateExportMetadata();

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

    statZoom.textContent = `${Math.round(state.zoom * 100)}%`;

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
    processingLoader.hidden = false;
    void loadBlobToCanvas(file)
      .then((canvas) => {
        loadCanvas(canvas, true, true);
      })
      .catch(() => {
        stageAlert.type = 'error';
        stageAlert.removeAttribute('hidden');
        stageAlert.textContent = `Impossible de décoder le fichier « ${file.name} ». Formats supportés : PNG, JPEG, WebP.`;
        notify('Erreur lors du chargement de l’image');
      })
      .finally(() => {
        processingLoader.hidden = true;
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

  onTriggerClick(btnExport, () => openExportModal());
  onTriggerClick(btnQuickExport, () => triggerPngDownload());
  onTriggerClick(btnModalCancel, () => {
    exportModal.shown = false;
  });
  onTriggerClick(btnModalDownload, () => {
    triggerPngDownload(inputExportFilename.value);
    exportModal.shown = false;
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

  selectSampling.addEventListener('valueChange', (e: Event) => {
    const detail = (e as CustomEvent<DSSelectValueChangeDetail>).detail;
    const value = detail?.selectedOption?.value;
    if (value) {
      state.samplingMode = value as SamplingMode;
      recompute();
    }
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

  const handleExportScaleChange = (value: number, peerSelect: DSSelectElement) => {
    if (!Number.isNaN(value) && value >= 1) {
      state.exportScale = value;
      syncExportScaleSelect(peerSelect, value);
      updateExportMetadata();
    }
  };

  selectExportScale.addEventListener('valueChange', (e: Event) => {
    const detail = (e as CustomEvent<DSSelectValueChangeDetail>).detail;
    handleExportScaleChange(Number(detail?.selectedOption?.value), selectModalExportScale);
  });

  selectModalExportScale.addEventListener('valueChange', (e: Event) => {
    const detail = (e as CustomEvent<DSSelectValueChangeDetail>).detail;
    handleExportScaleChange(Number(detail?.selectedOption?.value), selectExportScale);
  });

  viewModeGroup.addEventListener('toggleValueChange', (e: Event) => {
    const detail = (e as CustomEvent<DSToggleGroupEventDetail>).detail;
    const mode = detail?.value?.[0];
    if (mode === 'split' || mode === 'side' || mode === 'result') {
      state.viewMode = mode;
      drawViewport();
    }
  });

  toggleGrid.addEventListener('toggle', (e: Event) => {
    const detail = (e as CustomEvent<DSToggleEventDetail>).detail;
    state.showGrid = Boolean(detail?.checked);
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
