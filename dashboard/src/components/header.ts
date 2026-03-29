import { html } from 'htm/preact';
import { state, resetState } from '../state.js';

function navigate(hash: string, e: Event) {
  e.preventDefault();
  window.location.hash = hash;
}

function logout(e: Event) {
  e.preventDefault();
  resetState();
  window.location.hash = '#login';
}

export function Header({ route }: { route: string }) {
  return html`
    <nav>
      <a href="#batches"
        class=${route === 'batch-list' ? 'active' : ''}
        onClick=${(e: Event) => navigate('#batches', e)}>Batches</a>
      <a href="#batches/generate"
        class=${route === 'batch-form' ? 'active' : ''}
        onClick=${(e: Event) => navigate('#batches/generate', e)}>Generate</a>
      <span class="spacer" />
      <span class="user">@${state.username}</span>
      <button class="logout" onClick=${logout}>Logout</button>
    </nav>
  `;
}
