/**
 * Success screen — account created!
 * Shows confirmation details and provides a link to the Propolis wallet.
 * Pre-configures proxy endpoints in localStorage for wallet handoff.
 */

import type { ScreenFn } from '../../types';
import { t, fmt } from '../locale';

/** Base URL for the Propolis wallet on GitHub Pages */
const WALLET_BASE = 'https://demotruk.github.io/HiveAccessibleAnywhere';

export const SuccessScreen: ScreenFn = (container, state) => {
  const result = state.claimResult!;
  const payload = state.payload!;

  // Pre-configure proxy endpoints for the wallet via localStorage
  try {
    if (payload.endpoints.length > 0) {
      localStorage.setItem('propolis_invite_endpoints', JSON.stringify(payload.endpoints));
    }
  } catch { /* ignore storage errors */ }

  const walletUrl = `${WALLET_BASE}/propolis-bootstrap-en.html`;
  const shortTx = result.tx_id ? result.tx_id.slice(0, 16) + '...' : '';

  container.innerHTML = `<div class="ct center">
    <h1>${t.success_title}</h1>
    <p class="gc mb" style="font-size:1.1rem">${fmt(t.success_welcome, result.account)}</p>
    ${shortTx ? `<p class="xs mt mb">${fmt(t.success_tx, shortTx)}</p>` : ''}
    <div class="card">
      <p class="sm mb">${t.success_next}</p>
      <a href="${walletUrl}" target="_blank" rel="noopener">
        <button class="btn-ok">${t.success_wallet_link}</button>
      </a>
      <p class="xs mt1 mt">${t.success_keys_reminder}</p>
    </div>
  </div>`;
};
