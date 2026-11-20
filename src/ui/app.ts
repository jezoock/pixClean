import {
  createPixelCleanEditor,
  type PixelCleanEditor,
  type PixelCleanEditorConfig,
} from './pixelclean-editor';

export {
  createPixelCleanEditor,
  type PixelCleanApplyPayload,
  type PixelCleanEditor,
  type PixelCleanEditorConfig,
  type PixelCleanLoadOptions,
  type ViewMode,
} from './pixelclean-editor';

/**
 * Convenience mount helper for standalone usage.
 */
export function mountApp(root: HTMLElement, config?: PixelCleanEditorConfig): PixelCleanEditor {
  return createPixelCleanEditor(root, config);
}
