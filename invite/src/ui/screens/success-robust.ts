/**
 * Robust success screen — three sequential phases:
 *
 * Phase 1: Confirmation (brief, auto-advances)
 * Phase 2: Bootstrap file save (blocking — user must confirm)
 * Phase 3: Wallet loading (progress bar, auto-transitions into wallet)
 *
 * The discussion fetch starts immediately in Phase 1 and is reused
 * across Phase 2 (bootstrap generation) and Phase 3 (wallet loading).
 */

import type { ScreenFn, InviteState, GiftCardPayload, DerivedKeys } from '../../types';
import { t, fmt } from '../locale';
import { HiveClient } from '../../hive/client';
import {
  fetchWalletDiscussion,
  assembleWallet,
  type WalletDiscussion,
} from '../../hive/wallet-loader';
import { generateBootstrapFile, downloadFile } from '../../crypto/bootstrap-gen';

/** Endpoints to use for RPC calls — prefers proxy endpoints from payload. */
function getEndpoints(payload: GiftCardPayload): string[] {
  if (payload.endpoints && payload.endpoints.length > 0) {
    return payload.endpoints;
  }
  return ['https://api.hive.blog', 'https://api.openhive.network'];
}

/**
 * Write pre-authenticated credentials to localStorage so the wallet
 * skips the login screen after document.open()/write()/close().
 */
function writeLocalStorage(
  endpoints: string[],
  username: string,
  keys: DerivedKeys,
): void {
  try {
    localStorage.setItem('propolis_manual_endpoints', JSON.stringify(endpoints));
  } catch { /* ignore */ }
  try {
    localStorage.setItem('haa_keys', JSON.stringify({
      account: username,
      activeKeyWif: keys.active.wif,
      memoKeyWif: keys.memo.wif,
    }));
  } catch { /* ignore */ }
  try { localStorage.setItem('haa_account', username); } catch { /* ignore */ }
  try { localStorage.setItem('haa_activeKey', keys.active.wif); } catch { /* ignore */ }
  try { localStorage.setItem('haa_memoKey', keys.memo.wif); } catch { /* ignore */ }
  try { localStorage.setItem('propolis_bootstrap_memo_key', keys.memo.wif); } catch { /* ignore */ }
}

export const SuccessRobustScreen: ScreenFn = async (container, state) => {
  const result = state.claimResult!;
  const payload = state.payload!;
  const keys = state.keys!;
  const username = result.account;
  const locale = payload.locale || 'en';
  const shortTx = result.tx_id ? result.tx_id.slice(0, 16) + '...' : '';

  const endpoints = getEndpoints(payload);
  const client = new HiveClient(endpoints);

  // Start discussion fetch immediately (used in Phase 2 + 3)
  let discussion: WalletDiscussion | null = null;
  let discussionError: Error | null = null;
  const discussionPromise = fetchWalletDiscussion(client, locale)
    .then(d => { discussion = d; })
    .catch(e => { discussionError = e; });

  // ---- Phase 1: Confirmation ----
  showPhase1(container, username, shortTx);

  // Auto-advance to Phase 2 after a brief confirmation pause
  await new Promise(r => setTimeout(r, 2500));

  // ---- Phase 2: Bootstrap File Save ----
  await showPhase2(container, state, payload, keys, username, locale, discussionPromise, () => discussion);

  // ---- Phase 3: Wallet Loading ----
  await showPhase3(container, client, locale, endpoints, username, keys, discussionPromise, () => discussion, discussionError);
};

function showPhase1(container: HTMLElement, username: string, shortTx: string): void {
  container.innerHTML = `<div class="ct">
    <div class="center">
      <div style="font-size:3rem;margin-bottom:.5rem">\u2713</div>
      <h1>${t.robust_title}</h1>
      <p class="gc mb" style="font-size:1.1rem">${fmt(t.robust_created, username)}</p>
      ${shortTx ? `<p class="xs mt mb">${fmt(t.robust_tx, shortTx)}</p>` : ''}
    </div>
  </div>`;
}

async function showPhase2(
  container: HTMLElement,
  state: InviteState,
  payload: GiftCardPayload,
  keys: DerivedKeys,
  username: string,
  locale: string,
  discussionPromise: Promise<void>,
  getDiscussion: () => WalletDiscussion | null,
): Promise<void> {
  return new Promise<void>((resolve) => {
    const filename = fmt(t.robust_save_filename, locale);

    container.innerHTML = `<div class="ct">
      <div class="card">
        <h2>${t.robust_save_heading}</h2>
        <p class="sm mb">${t.robust_save_desc}</p>
        <button class="btn-ok" id="dl-btn">${t.robust_save_download}</button>
        <div class="mt1" style="margin-top:1rem">
          <label style="display:flex;align-items:center;gap:.5rem;cursor:pointer">
            <input type="checkbox" id="save-check" disabled>
            <span class="sm">${t.robust_save_checkbox}</span>
          </label>
        </div>
        <button class="btn-ok mt1" id="continue-btn" disabled style="margin-top:.5rem">${t.robust_save_continue}</button>
      </div>
    </div>`;

    const dlBtn = container.querySelector('#dl-btn') as HTMLButtonElement;
    const saveCheck = container.querySelector('#save-check') as HTMLInputElement;
    const continueBtn = container.querySelector('#continue-btn') as HTMLButtonElement;

    let downloaded = false;

    dlBtn.addEventListener('click', async () => {
      dlBtn.disabled = true;
      dlBtn.textContent = t.robust_save_generating;

      try {
        // Wait for discussion to be available (may already be resolved)
        await discussionPromise;
        const disc = getDiscussion();
        if (!disc) throw new Error('Failed to fetch wallet manifest');

        const html = await generateBootstrapFile({
          endpoints: payload.endpoints || [],
          username,
          keys,
          pin: state.pin!,
          locale,
          manifest: disc.manifest,
        });

        downloadFile(html, filename);
        downloaded = true;
        dlBtn.textContent = t.robust_save_download;
        dlBtn.disabled = false;
        saveCheck.disabled = false;
      } catch (e) {
        dlBtn.textContent = t.robust_save_download;
        dlBtn.disabled = false;
        console.error('Bootstrap generation failed:', e);
      }
    });

    saveCheck.addEventListener('change', () => {
      continueBtn.disabled = !saveCheck.checked;
    });

    continueBtn.addEventListener('click', () => {
      if (saveCheck.checked && downloaded) {
        state.bootstrapSaved = true;
        resolve();
      }
    });
  });
}

async function showPhase3(
  container: HTMLElement,
  client: HiveClient,
  locale: string,
  endpoints: string[],
  username: string,
  keys: DerivedKeys,
  discussionPromise: Promise<void>,
  getDiscussion: () => WalletDiscussion | null,
  discussionError: Error | null,
): Promise<void> {
  container.innerHTML = `<div class="ct">
    <div class="center">
      <h1>${t.robust_loading_title}</h1>
      <p class="sm mb" id="load-status">${t.robust_loading_estimate}</p>
      <div class="progress-outer">
        <div class="progress-inner" id="load-bar" style="width:0%"></div>
      </div>
      <p class="xs mt" id="load-detail"></p>
      <p class="xs mt" id="enroll-status"></p>
    </div>
  </div>`;

  const statusEl = container.querySelector('#load-status') as HTMLElement;
  const barEl = container.querySelector('#load-bar') as HTMLElement;
  const detailEl = container.querySelector('#load-detail') as HTMLElement;
  const enrollEl = container.querySelector('#enroll-status') as HTMLElement;

  function updateProgress(current: number, total: number) {
    const pct = Math.round((current / total) * 100);
    barEl.style.width = pct + '%';
    detailEl.textContent = fmt(t.robust_loading_chunk, current, total);
  }

  // Start enrollment verification in background (non-blocking)
  checkEnrollment(client, username).then(enrolled => {
    enrollEl.textContent = enrolled
      ? t.robust_enrollment_confirmed
      : t.robust_enrollment_timeout;
    enrollEl.style.color = enrolled ? '#4a9' : '#aaa';
  }).catch(() => {
    enrollEl.textContent = t.robust_enrollment_timeout;
    enrollEl.style.color = '#aaa';
  });

  try {
    // Wait for discussion (should already be fetched from Phase 1)
    await discussionPromise;
    const disc = getDiscussion();

    if (!disc || discussionError) {
      throw discussionError || new Error('Failed to fetch wallet data');
    }

    statusEl.textContent = t.robust_loading_title;
    const walletHtml = await assembleWallet(disc, updateProgress);

    // Brief "Ready" state
    statusEl.textContent = t.robust_loading_ready;
    barEl.style.width = '100%';
    detailEl.textContent = t.robust_loading_verifying;
    await new Promise(r => setTimeout(r, 1000));

    // Write credentials to localStorage and load wallet
    writeLocalStorage(endpoints, username, keys);
    document.open();
    document.write(walletHtml);
    document.close();
  } catch (e) {
    statusEl.textContent = t.robust_err_fetch;
    barEl.style.width = '0%';
    detailEl.textContent = e instanceof Error ? e.message : String(e);

    // Show retry button
    const retryBtn = document.createElement('button');
    retryBtn.className = 'btn-ok mt1';
    retryBtn.style.marginTop = '1rem';
    retryBtn.textContent = t.robust_err_retry;
    retryBtn.addEventListener('click', () => {
      showPhase3(container, client, locale, endpoints, username, keys,
        fetchWalletDiscussion(client, locale).then(d => {
          // Re-fetch on retry
          (getDiscussion as any) = () => d;
        }),
        getDiscussion, null);
    });
    container.querySelector('.center')?.appendChild(retryBtn);
  }
}

/**
 * Best-effort enrollment verification — checks if the new username
 * appears in the haa-service endpoint feed (via account existence check).
 * Polls for up to 60 seconds, returns true if confirmed.
 */
async function checkEnrollment(client: HiveClient, username: string): Promise<boolean> {
  const deadline = Date.now() + 60_000;
  const interval = 10_000;

  while (Date.now() < deadline) {
    try {
      const accounts = await client.getAccounts([username]);
      if (accounts.length > 0) return true;
    } catch { /* continue polling */ }
    await new Promise(r => setTimeout(r, interval));
  }
  return false;
}
