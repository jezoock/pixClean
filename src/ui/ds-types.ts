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

export interface DSToggleGroupEventDetail {
  value?: unknown[];
}

export interface DSSelectValueChangeDetail {
  selectedOption?: HTMLOptionElement;
}

export interface DSSelectElement extends HTMLElement {
  getValue?: () => Promise<{ value: string; label: string }>;
}

export interface DSModalElement extends HTMLElement {
  shown?: boolean;
}

export interface DSThumbElement extends HTMLElement {
  src?: string;
  alt?: string;
  label?: string;
}

export interface DSBadgeElement extends HTMLElement {
  count?: number | string;
  type?: string;
}

export interface DSAlertElement extends HTMLElement {
  type?: 'info' | 'success' | 'warning' | 'error';
  heading?: string;
}
