/**
 * Claiming screen — creates the Hive account via the gift card service.
 *
 * 1. Polls /validate until the service is warm (Fly.io cold start mitigation)
 * 2. POST /claim with token + username + public keys
 */

import type { ScreenFn } from '../../types';
import { t, fmt } from '../locale';
import { getPublicKeys } from '../../crypto/keygen';

/**
 * Poll the service until it responds. Uses POST /validate instead of
 * GET /health because a simple health check may not wake a stopped
 * Fly.io machine — /validate exercises the full app pipeline.
 * Returns true if warm, false if timed out.
 */
async function waitForService(serviceUrl: string, timeoutMs: number): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 8_000);
      const res = await fetch(`${serviceUrl}/validate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{"token":"wake"}',
        signal: ctrl.signal,
      });
      clearTimeout(timer);
      // Any response (including 400) means the service is up
      if (res.status < 500) return true;
    } catch { /* retry */ }
    const remaining = deadline - Date.now();
    if (remaining <= 0) break;
    await new Promise(r => setTimeout(r, Math.min(2_000, remaining)));
  }
  return false;
}

export const ClaimingScreen: ScreenFn = async (container, state, advance) => {
  container.innerHTML = `<div class="ct center">
    <h1>${t.claiming_title}</h1>
    <div class="spinner"></div>
    <p class="status-msg" id="status">${t.claiming_connecting}</p>
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

  // Wait for service to be warm before sending the claim.
  // The wake-up fetch was fired back at PIN entry, so the service
  // should already be starting up. This gates the claim until it's ready.
  const warm = await waitForService(payload.serviceUrl, 45_000);
  if (!warm) {
    showError(t.err_service_down);
    return;
  }

  // Service is warm — proceed with claim
  statusEl.textContent = fmt(t.claiming_progress, state.username!);

  try {
    const claimCtrl = new AbortController();
    const claimTimer = setTimeout(() => claimCtrl.abort(), 60_000);
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
      signal: claimCtrl.signal,
    });
    clearTimeout(claimTimer);

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
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      showError(t.claiming_timeout);
    } else {
      showError(t.err_service_down);
    }
  }
};
