import 'dot-stash/dist/css/default.css';
import { defineCustomElements } from 'dot-stash/loader';
import './styles/main.scss';
import { mountApp } from './ui/app';

defineCustomElements(window);

const container = document.querySelector<HTMLElement>('#app');
if (container) {
  mountApp(container);
}
