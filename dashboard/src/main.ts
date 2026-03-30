import './styles.css';
import { render } from 'preact';
import { html } from 'htm/preact';
import { App } from './components/app.js';

// Mock Keychain in dev mode only — Vite tree-shakes this out in production
if (import.meta.env.DEV) {
  import('./mock-keychain.js');
}

render(html`<${App} />`, document.getElementById('app')!);
