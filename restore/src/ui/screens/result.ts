/**
 * Result screen — displays the decrypted master password and derived keys.
 *
 * Key values are hidden by default behind "press to show" buttons.
 * Copy buttons are always visible so users can copy without revealing on screen.
 * Includes a Hive Keychain import QR code (also hidden by default).
 */

import type { ScreenFn } from '../../types';
import QRCode from 'qrcode';
import { t, fmt } from '../locale';

export const ResultScreen: ScreenFn = async (container, state) => {
  const { backupData, keys } = state;
  if (!backupData || !keys) return;

  const roles = ['owner', 'active', 'posting', 'memo'] as const;
  const roleLabels: Record<string, string> = {
    owner: t.key_owner,
    active: t.key_active,
    posting: t.key_posting,
    memo: t.key_memo,
  };

  // Build Hive Keychain QR payload
  // Format: keychain://add_account=<JSON>
  // where JSON is { name, keys: { posting, active, memo } }
  const keychainPayload = `keychain://add_account=${JSON.stringify({
    name: backupData.username,
    keys: {
      posting: keys.posting.wif,
      active: keys.active.wif,
      memo: keys.memo.wif,
    },
  })}`;

  container.innerHTML = `<div class="ct">
    <h1>${t.result_title}</h1>
    <p class="sm mb">${t.result_desc}</p>

    <div class="card">
      <label>${t.result_account}</label>
      <div class="copy-row">
        <div class="mono-box" id="username">@${backupData.username}</div>
        <button class="copy-btn btn-s" data-copy-value="${backupData.username}">${t.result_copy}</button>
      </div>
    </div>

    <div class="card">
      <label>${t.result_master_label}</label>
      <button class="copy-btn btn-s copy-standalone" data-copy-value="${backupData.masterPassword}">${t.result_master_copy}</button>
      <div class="reveal-container">
        <button class="btn-reveal" id="show-master">${t.result_master_show}</button>
        <div class="reveal-content hidden" id="master-content">
          <div class="mono-box">${backupData.masterPassword}</div>
          <p class="xs mt">${t.result_master_info}</p>
        </div>
      </div>
    </div>

    <div class="card">
      <label>${t.result_keys_label}</label>
      ${roles.map((role) => `
        <div class="key-row">
          <div class="key-role">${roleLabels[role]} key</div>
          <button class="copy-btn btn-s copy-standalone" data-copy-value="${keys[role].wif}">${fmt(t.result_key_copy, roleLabels[role])}</button>
          <div class="reveal-container">
            <button class="btn-reveal btn-reveal-sm" id="show-${role}">${t.result_key_show}</button>
            <div class="reveal-content hidden" id="${role}-content">
              <div class="key-wif">${keys[role].wif}</div>
            </div>
          </div>
        </div>
      `).join('')}
    </div>

    <div class="card">
      <label>${t.result_keychain_label}</label>
      <div class="reveal-container">
        <button class="btn-reveal" id="show-keychain">${t.result_keychain_show}</button>
        <div class="reveal-content hidden" id="keychain-content">
          <div class="qr-keychain center">
            <img id="keychain-qr" alt="Hive Keychain import QR" style="display:none">
            <p class="xs mt">${t.result_keychain_info}</p>
          </div>
        </div>
      </div>
    </div>

    <div class="card wrn-card">
      <p class="sm wrn">${t.result_warning}</p>
    </div>

    <button class="btn-s" id="start-over">${t.result_start_over}</button>
  </div>`;

  // Reveal buttons — show content while held, hide on release
  function setupReveal(btnId: string, contentId: string) {
    const btn = container.querySelector(`#${btnId}`) as HTMLButtonElement;
    const content = container.querySelector(`#${contentId}`) as HTMLElement;
    if (!btn || !content) return;

    function show() {
      content.classList.remove('hidden');
      btn.classList.add('hidden');
    }
    function hide() {
      content.classList.add('hidden');
      btn.classList.remove('hidden');
    }

    btn.addEventListener('mousedown', show);
    document.addEventListener('mouseup', () => {
      if (!content.classList.contains('hidden')) hide();
    });

    btn.addEventListener('touchstart', (e) => { e.preventDefault(); show(); });
    document.addEventListener('touchend', () => {
      if (!content.classList.contains('hidden')) hide();
    });
  }

  setupReveal('show-master', 'master-content');
  for (const role of roles) {
    setupReveal(`show-${role}`, `${role}-content`);
  }
  setupReveal('show-keychain', 'keychain-content');

  // Generate Keychain QR code
  const keychainQrImg = container.querySelector('#keychain-qr') as HTMLImageElement;
  try {
    const qrDataUrl = await QRCode.toDataURL(keychainPayload, {
      errorCorrectionLevel: 'M',
      margin: 2,
      width: 280,
      color: { dark: '#000000', light: '#ffffff' },
    });
    keychainQrImg.src = qrDataUrl;
    keychainQrImg.style.display = 'block';
  } catch {
    keychainQrImg.insertAdjacentHTML('afterend',
      `<p class="err">${t.result_keychain_error}</p>`);
  }

  // Copy buttons — copy from data-copy-value attribute (no need to read DOM text)
  container.querySelectorAll('[data-copy-value]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const value = (btn as HTMLElement).dataset.copyValue!;
      try {
        await navigator.clipboard.writeText(value);
        const original = btn.textContent;
        btn.textContent = t.result_copied;
        setTimeout(() => { btn.textContent = original; }, 2000);
      } catch {
        // Fallback: create temporary textarea for selection
        const ta = document.createElement('textarea');
        ta.value = value;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
        const original = btn.textContent;
        btn.textContent = t.result_copied;
        setTimeout(() => { btn.textContent = original; }, 2000);
      }
    });
  });

  // Start over
  container.querySelector('#start-over')!.addEventListener('click', () => {
    state.encryptedData = null;
    state.backupData = null;
    state.keys = null;
    window.location.reload();
  });
};
