/**
 * Typed contracts for dot-stash light-DOM custom elements and custom events.
 */

export interface RefreshableElement extends HTMLElement {
  refresh?: () => Promise<void>;
}

export interface DSToasterElement extends HTMLElement {
  messages?: string | string[];
  displayToast?: () => Promise<void>;
}

export interface DSToggleEventDetail {
  name?: string;
  value?: unknown;
  checked?: boolean;
}

export interface DSSelectValueChangeDetail {
  selectedOption?: HTMLOptionElement;
}

export interface DSSelectElement extends HTMLElement {
  getValue?: () => Promise<{ value: string; label: string }>;
}
