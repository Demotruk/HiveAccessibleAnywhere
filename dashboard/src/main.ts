import './styles.css';
import { render } from 'preact';
import { html } from 'htm/preact';
import { App } from './components/app.js';

render(html`<${App} />`, document.getElementById('app')!);
