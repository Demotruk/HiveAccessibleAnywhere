import { html } from 'htm/preact';
import { state, setState, resetState } from '../state.js';
import { loginExternal } from '../auth.js';

function navigate(hash: string, e: Event) {
  e.preventDefault();
  window.location.hash = hash;
}

function logout(e: Event) {
  e.preventDefault();
  resetState();
  window.location.hash = '#login';
}

async function retryExternal() {
  if (!state.username || !state.externalServiceUrl) return;
  setState({ externalError: null });
  const extJwt = await loginExternal(state.username, state.externalServiceUrl);
  if (extJwt) {
    setState({ externalJwt: extJwt, externalConnected: true, externalError: null });
  } else {
    setState({ externalConnected: false, externalError: 'Could not connect to your gift card service' });
  }
}

export function Header({ route }: { route: string }) {
  const isIssuer = state.role === 'issuer' || state.role === 'admin';
  const isAdminUser = state.role === 'admin';
  const needsSetup = state.issuerStatus?.status === 'approved';
  const showExternalBanner = state.externalServiceUrl && !state.externalConnected;

  return html`
    <div>
      <nav>
        ${isIssuer && html`
          <a href="#batches"
            class=${route === 'batch-list' ? 'active' : ''}
            onClick=${(e: Event) => navigate('#batches', e)}>Batches</a>
          <a href="#batches/generate"
            class=${route === 'batch-form' ? 'active' : ''}
            onClick=${(e: Event) => navigate('#batches/generate', e)}>Generate</a>
        `}
        ${needsSetup && html`
          <a href="#setup"
            class=${route === 'setup' ? 'active' : ''}
            onClick=${(e: Event) => navigate('#setup', e)}>Setup</a>
        `}
        ${isIssuer && html`
          <a href="#setup"
            class=${route === 'setup' ? 'active' : ''}
            onClick=${(e: Event) => navigate('#setup', e)}>Setup</a>
        `}
        ${isAdminUser && html`
          <a href="#admin"
            class=${route === 'admin' ? 'active' : ''}
            onClick=${(e: Event) => navigate('#admin', e)}>Admin${state.pendingCount > 0 ? html` <span class="badge">${state.pendingCount}</span>` : ''}</a>
        `}
        <span class="spacer" />
        <span class="user">@${state.username}</span>
        <button class="logout" onClick=${logout}>Logout</button>
      </nav>
      ${showExternalBanner && html`
        <div class="banner-warn">
          Your gift card service is unreachable — batch operations unavailable.
          <button class="btn-link" onClick=${retryExternal}>Retry</button>
        </div>
      `}
    </div>
  `;
}
