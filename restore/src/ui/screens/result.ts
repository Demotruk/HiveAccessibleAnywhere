/**
 * Result screen — displays the decrypted master password and derived keys.
 *
 * Key values are hidden by default behind "press to show" buttons.
 * Copy buttons are always visible so users can copy without revealing on screen.
 * Includes a Hive Keychain import QR code (also hidden by default).
 */

import type { ScreenFn } from '../../types';
import QRCode from 'qrcode';

export const ResultScreen: ScreenFn = async (container, state) => {
  const { backupData, keys } = state;
  if (!backupData || !keys) return;

  const roles = ['owner', 'active', 'posting', 'memo'] as const;

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
    <h1>\u2705 Backup Restored</h1>
    <p class="sm mb">Your keys have been decrypted successfully.</p>

    <div class="card">
      <label>Account</label>
      <div class="copy-row">
        <div class="mono-box" id="username">@${backupData.username}</div>
        <button class="copy-btn btn-s" data-copy-value="${backupData.username}">Copy</button>
      </div>
    </div>

    <div class="card">
      <label>Master Password</label>
      <button class="copy-btn btn-s copy-standalone" data-copy-value="${backupData.masterPassword}">Copy Master Password</button>
      <div class="reveal-container">
        <button class="btn-reveal" id="show-master">Press to show master password</button>
        <div class="reveal-content hidden" id="master-content">
          <div class="mono-box">${backupData.masterPassword}</div>
          <p class="xs mt">This password derives all four keys below. Store it securely.</p>
        </div>
      </div>
    </div>

    <div class="card">
      <label>Private Keys (WIF)</label>
      ${roles.map((role) => `
        <div class="key-row">
          <div class="key-role">${role} key</div>
          <button class="copy-btn btn-s copy-standalone" data-copy-value="${keys[role].wif}">Copy ${role} key</button>
          <div class="reveal-container">
            <button class="btn-reveal btn-reveal-sm" id="show-${role}">Press to show</button>
            <div class="reveal-content hidden" id="${role}-content">
              <div class="key-wif">${keys[role].wif}</div>
            </div>
          </div>
        </div>
      `).join('')}
    </div>

    <div class="card">
      <label>Import to Hive Keychain</label>
      <div class="reveal-container">
        <button class="btn-reveal" id="show-keychain">Press to show Keychain import QR</button>
        <div class="reveal-content hidden" id="keychain-content">
          <div class="qr-keychain center">
            <img id="keychain-qr" alt="Hive Keychain import QR" style="display:none">
            <p class="xs mt">Scan with the Hive Keychain mobile app to import this account.</p>
          </div>
        </div>
      </div>
    </div>

    <div class="card wrn-card">
      <p class="sm wrn">\u26A0\uFE0F Keep these keys private. Anyone with your keys controls your account.</p>
    </div>

    <button class="btn-s" id="start-over">Restore Another Backup</button>
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
      `<p class="err">Could not generate QR code.</p>`);
  }

  // Copy buttons — copy from data-copy-value attribute (no need to read DOM text)
  container.querySelectorAll('[data-copy-value]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const value = (btn as HTMLElement).dataset.copyValue!;
      try {
        await navigator.clipboard.writeText(value);
        const original = btn.textContent;
        btn.textContent = 'Copied!';
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
        btn.textContent = 'Copied!';
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
