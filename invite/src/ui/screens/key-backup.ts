/**
 * Key backup screen.
 *
 * Generates master password, derives all 4 key pairs, displays them
 * for backup. User must confirm backup before proceeding to account creation.
 */

import type { ScreenFn } from '../../types';
import { t } from '../locale';
import { generateMasterPassword, deriveKeys } from '../../crypto/keygen';
import QRCode from 'qrcode';

export const KeyBackupScreen: ScreenFn = async (container, state, advance) => {
  // Generate keys if not already done
  if (!state.masterPassword) {
    state.masterPassword = generateMasterPassword();
  }
  if (!state.keys) {
    state.keys = deriveKeys(state.username!, state.masterPassword);
  }

  container.innerHTML = `<div class="ct">
    <h1>${t.backup_title}</h1>
    <p class="sm wrn mb">${t.backup_desc}</p>

    <div class="card">
      <label>${t.backup_master_label}</label>
      <div class="copy-row">
        <div class="mono-box" id="master">${state.masterPassword}</div>
        <button class="copy-btn btn-s" id="copy-btn">${t.backup_copy}</button>
      </div>
      <p class="xs mt">${t.backup_master_info}</p>
    </div>

    <div class="card qr-backup">
      <label>${t.backup_qr_label}</label>
      <img id="qr-img" alt="QR backup" style="display:none">
      <p class="xs mt">${t.backup_qr_info}</p>
    </div>

    <div class="card">
      <button class="toggle-link" id="toggle-keys">${t.backup_show_keys}</button>
      <div id="keys-detail" class="hidden">
        <div class="key-row">
          <div class="key-role">${t.backup_owner_wif}</div>
          <div class="key-wif">${state.keys.owner.wif}</div>
        </div>
        <div class="key-row">
          <div class="key-role">${t.backup_active_wif}</div>
          <div class="key-wif">${state.keys.active.wif}</div>
        </div>
        <div class="key-row">
          <div class="key-role">${t.backup_posting_wif}</div>
          <div class="key-wif">${state.keys.posting.wif}</div>
        </div>
        <div class="key-row">
          <div class="key-role">${t.backup_memo_wif}</div>
          <div class="key-wif">${state.keys.memo.wif}</div>
        </div>
      </div>
    </div>

    <label class="check-row">
      <input type="checkbox" id="confirm">
      <span>${t.backup_confirm}</span>
    </label>
    <button id="proceed" disabled>${t.backup_proceed}</button>
  </div>`;

  const copyBtn = container.querySelector('#copy-btn') as HTMLButtonElement;
  const masterEl = container.querySelector('#master') as HTMLElement;
  const qrImg = container.querySelector('#qr-img') as HTMLImageElement;
  const toggleKeys = container.querySelector('#toggle-keys') as HTMLButtonElement;
  const keysDetail = container.querySelector('#keys-detail') as HTMLElement;
  const confirmCheck = container.querySelector('#confirm') as HTMLInputElement;
  const proceedBtn = container.querySelector('#proceed') as HTMLButtonElement;

  // Copy master password to clipboard
  copyBtn.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(state.masterPassword!);
      copyBtn.textContent = t.backup_copied;
      setTimeout(() => { copyBtn.textContent = t.backup_copy; }, 2000);
    } catch {
      // Fallback: select text
      const range = document.createRange();
      range.selectNodeContents(masterEl);
      const sel = window.getSelection();
      sel?.removeAllRanges();
      sel?.addRange(range);
    }
  });

  // Generate QR code of master password
  try {
    const dataUrl = await QRCode.toDataURL(state.masterPassword!, {
      errorCorrectionLevel: 'H',
      margin: 2,
      width: 200,
      color: { dark: '#000000', light: '#ffffff' },
    });
    qrImg.src = dataUrl;
    qrImg.style.display = 'block';
  } catch {
    // QR generation failed silently — user can still copy text
  }

  // Toggle individual key display
  toggleKeys.addEventListener('click', () => {
    const showing = !keysDetail.classList.contains('hidden');
    keysDetail.classList.toggle('hidden');
    toggleKeys.textContent = showing ? t.backup_show_keys : t.backup_hide_keys;
  });

  // Confirm checkbox enables proceed button
  confirmCheck.addEventListener('change', () => {
    proceedBtn.disabled = !confirmCheck.checked;
  });

  proceedBtn.addEventListener('click', () => {
    if (!confirmCheck.checked) return;
    advance('claiming');
  });
};
