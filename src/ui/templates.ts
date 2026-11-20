/**
 * Modular dot-stash light-DOM templates for the PixelClean Studio shell and sidebar controls.
 */

export function renderHeaderTemplate(): string {
  return `
    <header class="pc-header">
      <ds-title-bar class="pc-title-bar">
        <div slot="before" class="pc-brand__logo" aria-hidden="true"></div>

        <div class="pc-brand">
          <ds-title page class="pc-brand__title"><h1>PixelClean Studio</h1></ds-title>
          <ds-badge type="info" label="Propulsé par dot-stash">dot-stash</ds-badge>
        </div>

        <div slot="after" class="pc-header-actions">
          <input
            id="file-input"
            class="pc-file-input"
            type="file"
            accept="image/png,image/jpeg,image/webp"
          />

          <ds-tooltip position="bottom" container-selector=".pc-shell">
            <ds-trigger id="btn-import" type="button" mods="stl-2 sm">
              <ds-icon type="upload-cloud"></ds-icon>
              <span>Importer</span>
            </ds-trigger>
            <span slot="message">Importer une image PNG, JPEG ou WebP (ou glisser-déposer / Ctrl+V)</span>
          </ds-tooltip>

          <ds-tooltip position="bottom" container-selector=".pc-shell">
            <ds-trigger id="btn-sample" type="button" mods="stl-3 sm">
              <ds-icon type="picture"></ds-icon>
              <span>Sprite de test</span>
            </ds-trigger>
            <span slot="message">Charger un sprite pixel art corrompu de démonstration</span>
          </ds-tooltip>

          <ds-tooltip position="bottom-right" container-selector=".pc-shell">
            <ds-trigger id="btn-export" type="button" mods="stl-1 sm">
              <ds-icon type="download-cloud"></ds-icon>
              <span>Exporter PNG</span>
            </ds-trigger>
            <span slot="message">Télécharger l'image nettoyée en PNG (Nearest-Neighbor sans flou)</span>
          </ds-tooltip>
        </div>
      </ds-title-bar>
    </header>
  `;
}

export function renderSidebarTemplate(): string {
  return `
    <ds-block section mods="full-width" label="Paramètres de nettoyage" class="pc-sidebar">
      <ds-panel-group type="collapsible" mods="pc-controls">
        <ds-panel level="2" expanded>
          <span slot="title" class="pc-panel-title">
            <ds-icon type="sliders"></ds-icon>
            <span>Grille &amp; Anti-Mixels</span>
          </span>
          <div class="pc-panel-body">
            <div class="pc-panel-actions">
              <ds-tooltip position="left" container-selector=".pc-sidebar">
                <ds-trigger id="btn-autodetect" type="button" mods="stl-2 xs">
                  <ds-icon type="arrows-cw"></ds-icon>
                  <span>Auto-détecter</span>
                </ds-trigger>
                <span slot="message">Estimer automatiquement la taille des pixels et le décalage X/Y</span>
              </ds-tooltip>
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

            <ds-grid
              cols="2"
              h-gap="0.65rem"
              v-gap="0"
              type="fluid"
              data-rsp='{"xxs": {"cols": 1}, "xs": {"cols": 2}}'
            >
              <ds-grid-item width="1">
                <div class="pc-range-group">
                  <div class="pc-range-label">
                    <label for="offset-x">Décalage X</label>
                    <span id="offset-x-val" class="pc-range-label__value">3 px</span>
                  </div>
                  <ds-range id="range-offset-x" labels='{"valueText": "{value} px"}'>
                    <input id="offset-x" type="range" min="0" max="31" step="1" value="3" />
                  </ds-range>
                </div>
              </ds-grid-item>

              <ds-grid-item width="1">
                <div class="pc-range-group">
                  <div class="pc-range-label">
                    <label for="offset-y">Décalage Y</label>
                    <span id="offset-y-val" class="pc-range-label__value">2 px</span>
                  </div>
                  <ds-range id="range-offset-y" labels='{"valueText": "{value} px"}'>
                    <input id="offset-y" type="range" min="0" max="31" step="1" value="2" />
                  </ds-range>
                </div>
              </ds-grid-item>
            </ds-grid>

            <ds-field
              id="field-sampling"
              label="Échantillonnage"
              hint="Majoritaire recommandé pour retirer les mixels."
            >
              <ds-select id="select-sampling-mode" name="sampling-mode">
                <option value="mode" selected>Majoritaire (Mode quantifié)</option>
                <option value="center">Centre de cellule</option>
                <option value="median">Médiane</option>
                <option value="average">Moyenne</option>
              </ds-select>
            </ds-field>
          </div>
        </ds-panel>

        <ds-panel level="2" expanded>
          <span slot="title" class="pc-panel-title">
            <ds-icon type="picture"></ds-icon>
            <span>Palette &amp; Aplats</span>
          </span>
          <div class="pc-panel-body">
            <div class="pc-panel-actions">
              <ds-tooltip position="left" container-selector=".pc-sidebar">
                <ds-trigger id="btn-reset-palette" type="button" mods="stl-3 xs">
                  <ds-icon type="ccw"></ds-icon>
                  <span>Réinitialiser</span>
                </ds-trigger>
                <span slot="message">Annuler toutes les modifications manuelles de couleurs</span>
              </ds-tooltip>
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

        <ds-panel level="2" expanded>
          <span slot="title" class="pc-panel-title">
            <ds-icon type="download-cloud"></ds-icon>
            <span>Export PNG</span>
          </span>
          <div class="pc-panel-body">
            <ds-field
              id="field-export-scale"
              label="Facteur d'échelle (Nearest-Neighbor)"
              hint="Export sans flou, pixels nets."
            >
              <ds-select id="select-export-scale" name="export-scale">
                <option value="1">1× (natif)</option>
                <option value="2">2×</option>
                <option value="4" selected>4×</option>
                <option value="8">8×</option>
                <option value="16">16×</option>
              </ds-select>
            </ds-field>
          </div>
        </ds-panel>
      </ds-panel-group>
    </ds-block>
  `;
}

export function renderMainTemplate(): string {
  return `
    <ds-block section mods="full-width" label="Espace de prévisualisation" class="pc-main">
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
    </ds-block>
  `;
}

export function renderAppShellTemplate(): string {
  return `
    <div class="pc-shell">
      <ds-rsp></ds-rsp>
      ${renderHeaderTemplate()}
      <div class="pc-workspace">
        ${renderSidebarTemplate()}
        ${renderMainTemplate()}
      </div>
      <ds-toaster id="notices" mods="success" position="bottom,right" closing-delay="4000"></ds-toaster>
    </div>
  `;
}
