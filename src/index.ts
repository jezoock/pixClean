import { defineCustomElements } from 'dot-stash/loader';
import './styles/main.scss';

export * from './engine';
export * from './adapters';
export {
  createPixelCleanEditor,
  mountApp,
  type PixelCleanApplyPayload,
  type PixelCleanEditor,
  type PixelCleanEditorConfig,
  type PixelCleanLoadOptions,
  type ViewMode,
} from './ui/app';

/**
 * Registers dot-stash Web Components in the host window if the host application
 * has not already called `defineCustomElements(window)`.
 */
export function definePixelCleanElements(win: Window = window): void {
  defineCustomElements(win);
}
