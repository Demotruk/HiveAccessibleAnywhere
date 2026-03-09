/**
 * Verifying screen — checks gift card authenticity.
 *
 * 1. Checks expiry date
 * 2. Fetches provider's account from chain (using proxy endpoints from payload)
 * 3. Verifies signature against provider's public memo key
 */

import type { ScreenFn } from '../../types';
import { t } from '../locale';
import { HiveClient } from '../../hive/client';
import { verifyCardSignature, isExpired } from '../../crypto/verify';

const PUBLIC_NODES = [
  'https://api.hive.blog',
  'https://api.deathwing.me',
  'https://hive-api.arcange.eu',
];

export const VerifyingScreen: ScreenFn = async (container, state, advance) => {
  container.innerHTML = `<div class="ct center">
    <h1>${t.verifying_title}</h1>
    <div class="spinner"></div>
    <p class="status-msg" id="status">${t.verifying_checking}</p>
  </div>`;

  const statusEl = container.querySelector('#status') as HTMLElement;

  const showError = (msg: string) => {
    const spinner = container.querySelector('.spinner');
    if (spinner) spinner.remove();
    statusEl.textContent = msg;
    statusEl.className = 'err center';

    // Add retry button
    const retryBtn = document.createElement('button');
    retryBtn.textContent = 'Retry';
    retryBtn.className = 'btn-s mt2';
    retryBtn.style.maxWidth = '200px';
    retryBtn.style.margin = '12px auto';
    retryBtn.addEventListener('click', () => advance('verifying'));
    statusEl.parentElement!.appendChild(retryBtn);
  };

  const payload = state.payload!;

  // Wake up the giftcard service early — Fly.io cold start can take 10-30s.
  // By the time the user gets through username selection + key backup,
  // the machine should be warm and ready for the /claim request.
  fetch(`${payload.serviceUrl}/health`).catch(() => {});

  // Check expiry
  if (isExpired(payload)) {
    showError(t.verifying_expired);
    return;
  }

  // Build endpoint list: proxy endpoints first, then public nodes as fallback
  const endpoints = [...payload.endpoints, ...PUBLIC_NODES];
  const client = new HiveClient(endpoints);

  try {
    // Fetch provider account to get their memo key
    const accounts = await client.getAccounts([payload.provider]);
    if (!accounts || accounts.length === 0) {
      showError(t.verifying_counterfeit);
      return;
    }

    const providerAccount = accounts[0];
    const valid = await verifyCardSignature(payload, providerAccount.memo_key);
    if (!valid) {
      showError(t.verifying_counterfeit);
      return;
    }

    // All checks passed — advance to username selection
    advance('username');
  } catch {
    showError(t.verifying_network);
  }
};
