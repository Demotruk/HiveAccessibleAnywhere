/**
 * Success screen — account created!
 *
 * For standard invites: guides the user to log into peakd.com via HiveSigner.
 * Shows username + posting key with copy buttons, then a redirect to HiveSigner.
 *
 * For future robust invites: will link to Propolis wallet with pre-configured
 * proxy endpoints (via localStorage handoff).
 */

import type { ScreenFn } from '../../types';
import { t, fmt } from '../locale';

/**
 * Build the HiveSigner OAuth URL for logging into peakd.com.
 * After successful auth, HiveSigner redirects back to peakd.com.
 */
function buildHiveSignerUrl(): string {
  const params = new URLSearchParams({
    client_id: 'peakd.app',
    redirect_uri: 'https://peakd.com/callback/hivesigner',
    scope: 'posting',
    response_type: 'code',
    state: '/',
  });
  return `https://hivesigner.com/oauth2/authorize?${params.toString()}`;
}

/** Copy text to clipboard and briefly update button label. */
function attachCopyHandler(container: HTMLElement, btnId: string, text: string) {
  const btn = container.querySelector(`#${btnId}`) as HTMLButtonElement | null;
  if (!btn) return;
  btn.addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(text); } catch { /* clipboard may not be available */ }
    const orig = btn.textContent;
    btn.textContent = t.success_copied;
    setTimeout(() => { btn.textContent = orig; }, 1500);
  });
}

export const SuccessScreen: ScreenFn = (container, state) => {
  const result = state.claimResult!;
  const payload = state.payload!;
  const username = result.account;
  const postingKey = state.keys!.posting.wif;
  const shortTx = result.tx_id ? result.tx_id.slice(0, 16) + '...' : '';
  const hiveSignerUrl = buildHiveSignerUrl();

  // For future robust invites: pre-configure proxy endpoints for the wallet
  try {
    if (payload.endpoints && payload.endpoints.length > 0) {
      localStorage.setItem('propolis_invite_endpoints', JSON.stringify(payload.endpoints));
    }
  } catch { /* ignore storage errors */ }

  container.innerHTML = `<div class="ct">
    <div class="center">
      <h1>${t.success_title}</h1>
      <p class="gc mb" style="font-size:1.1rem">${fmt(t.success_welcome, username)}</p>
      ${shortTx ? `<p class="xs mt mb">${fmt(t.success_tx, shortTx)}</p>` : ''}
    </div>

    <div class="card">
      <h2>${t.success_peakd_heading}</h2>
      <p class="sm mb">${t.success_peakd_intro}</p>

      <p class="sm mb">${t.success_step_copy}</p>

      <label>${t.success_username_label}</label>
      <div class="copy-row">
        <div class="mono-box">${username}</div>
        <button class="copy-btn btn-s" id="copy-user">${t.success_copy}</button>
      </div>

      <label>${t.success_posting_label}</label>
      <div class="copy-row">
        <div class="mono-box" style="font-size:.7rem">${postingKey}</div>
        <button class="copy-btn btn-s" id="copy-key">${t.success_copy}</button>
      </div>

      <p class="sm mb">${t.success_step_login}</p>

      <a href="${hiveSignerUrl}" target="_blank" rel="noopener" id="hs-link">
        <button class="btn-ok">${t.success_hivesigner_btn}</button>
      </a>

      <p class="xs mt1 mt">${t.success_hivesigner_note}</p>
    </div>

    <div class="card">
      <p class="xs mt">${t.success_keys_reminder}</p>
    </div>
  </div>`;

  // Attach copy handlers
  attachCopyHandler(container, 'copy-user', username);
  attachCopyHandler(container, 'copy-key', postingKey);
};
