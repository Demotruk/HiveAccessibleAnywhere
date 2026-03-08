/**
 * Claiming screen — creates the Hive account via the gift card service.
 *
 * 1. Optional: POST /validate to pre-check token
 * 2. POST /claim with token + username + public keys
 */

import type { ScreenFn } from '../../types';
import { t, fmt } from '../locale';
import { getPublicKeys } from '../../crypto/keygen';

export const ClaimingScreen: ScreenFn = async (container, state, advance) => {
  container.innerHTML = `<div class="ct center">
    <h1>${t.claiming_title}</h1>
    <div class="spinner"></div>
    <p class="status-msg" id="status">${fmt(t.claiming_progress, state.username!)}</p>
  </div>`;

  const statusEl = container.querySelector('#status') as HTMLElement;

  const showError = (msg: string) => {
    const spinner = container.querySelector('.spinner');
    if (spinner) spinner.remove();
    statusEl.textContent = msg;
    statusEl.className = 'err center';

    const retryBtn = document.createElement('button');
    retryBtn.textContent = t.claiming_retry;
    retryBtn.className = 'btn-s mt2';
    retryBtn.style.maxWidth = '200px';
    retryBtn.style.margin = '12px auto';
    retryBtn.addEventListener('click', () => advance('claiming'));
    statusEl.parentElement!.appendChild(retryBtn);
  };

  const payload = state.payload!;
  const keys = getPublicKeys(state.keys!);

  try {
    const response = await fetch(`${payload.serviceUrl}/claim`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token: payload.token,
        username: state.username,
        keys,
        // Merkle proof validation fields
        batchId: payload.batchId,
        signature: payload.signature,
        expires: payload.expires,
        promiseType: payload.promiseType,
        promiseParams: payload.promiseParams,
        merkleProof: payload.merkleProof,
      }),
    });

    const data = await response.json() as {
      success: boolean;
      account?: string;
      tx_id?: string;
      error?: string;
    };

    if (data.success && data.account) {
      state.claimResult = {
        account: data.account,
        tx_id: data.tx_id || '',
      };
      advance('success');
    } else {
      showError(data.error || t.claiming_failed);
    }
  } catch {
    showError(t.err_service_down);
  }
};
